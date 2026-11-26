import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test from 'node:test';
import type {Express,Request,Response} from 'express';
import type {Employee} from '../server/portal/identity';

const databaseHook=registerHooks({load(url,context,next){
 if(!url.endsWith('/cloud/mysql/runtime.mjs'))return next(url,context);
 return {shortCircuit:true,format:'module',source:`
  const unused=()=>{throw Error('Purchase intent test attempted to open a database');};
  export const nativePool={},pool={},initialize=unused,connection=unused,tx=unused,event=unused,id=unused;
 `};
}});
const {mountEnrollmentCrm}=await import('../server/portal/enrollmentCrm');
databaseHook.deregister();

const customerId='customer';
const existingId='12c7318b-280d-44b7-b614-e9be7284f595';
const secondId='40f61ac3-4553-4016-8d5c-0213f10a0219';
const route='/api/crm/leads/:id/enrollment-opportunities';

function fixture({ids=[],pending=false,servicing=true}:{ids?:string[];pending?:boolean;servicing?:boolean}={}){
 const get=new Map(),post=new Map();
 const app={get:get.set.bind(get),post:post.set.bind(post)} as unknown as Express;
 const actor={id:'sales',scope:'all',permissions:['crm.read','crm.followup']} as Employee;
 const writes:string[]=[];
 const client={async query(sql:string,params:unknown[]=[]){
  if(sql.includes('GET_LOCK')||sql.includes('SELECT * FROM crm_operations'))return {rows:[]};
  if(sql.includes('SELECT id,profile FROM portal_leads'))return {rows:[{
   id:customerId,profile:{id:customerId,owner:actor.id,identityLifecycle:pending?'pending':'independent'},
  }]};
  if(sql.includes('o.level=:p2')){
   assert.deepEqual(params,[customerId,'HSK 2']);
   return {rows:ids.map(id=>({id,level:'HSK 2',sales_stage:'progress:unreached',revision:1}))};
  }
  if(sql.includes('WHERE r.opportunity_id IN')||sql.includes('AND r.opportunity_id IS NULL'))return {rows:[]};
  if(sql.includes('INSERT INTO enrollment_opportunities')){writes.push('new:'+params[0]);return {rows:[]};}
  if(sql.includes('INSERT INTO crm_operations')){writes.push('receipt');return {rows:[]};}
  throw Error('Unexpected SQL: '+sql);
 }};
 mountEnrollmentCrm(app,{
  wrap:handler=>handler,staff:async()=>actor,transact:work=>work(client),servicing,
  saveProgress:async(_client,leadId,_actor,body)=>{
   assert.equal(leadId,customerId);
   assert.equal(body.summary,'想报名 HSK 2');
   writes.push('progress:'+body.opportunityLink.id);
   return {logId:'progress-record'};
  },
 });
 async function call(verb:'get'|'post',body?:object){
  const host='localhost:3000';
  const request={params:{id:customerId},query:{level:'HSK 2'},body,protocol:'http',
   headers:{origin:'http://'+host},get:()=>host,is:()=>true} as unknown as Request;
  let response:unknown;
  const reply={set:()=>reply,json:(data:unknown)=>{response=data;}} as unknown as Response;
  await (verb==='get'?get:post).get(route)(request,reply);
  return response;
 }
 const save=(expectedOpportunityId:string|null)=>call('post',{
  level:'HSK 2',note:'想报名 HSK 2',requestId:'purchase-intent-test',expectedOpportunityId,
 });
 return {preview:()=>call('get'),save,writes};
}

test('purchase intent preview and save identify the same existing opportunity',async()=>{
 const {preview,save,writes}=fixture({ids:[existingId]});
 assert.deepEqual(await preview(),{opportunities:[{id:existingId}]});
 assert.deepEqual(await save(existingId),{opportunityId:existingId,created:false,logId:'progress-record',
  leadId:customerId,operationKind:'enrollment.opportunity.open'});
 assert.deepEqual(writes,['progress:'+existingId,'receipt']);
});

test('purchase intent with no match creates only the new opportunity shown in preview',async()=>{
 const {preview,save,writes}=fixture();
 assert.deepEqual(await preview(),{opportunities:[]});
 const result=await save(null) as {opportunityId:string;created:boolean};
 assert.equal(result.created,true);
 assert.deepEqual(writes,['new:'+result.opportunityId,'progress:'+result.opportunityId,'receipt']);
});

test('a changed or ambiguous match cannot write to a different opportunity',async()=>{
 const changed=fixture({ids:[existingId]});
 await assert.rejects(changed.save(null),{status:409,message:'enrollment_opportunity_preview_changed'});
 assert.deepEqual(changed.writes,[]);
 const ambiguous=fixture({ids:[existingId,secondId]});
 assert.deepEqual(await ambiguous.preview(),{opportunities:[{id:existingId},{id:secondId}]});
 await assert.rejects(ambiguous.save(existingId),{status:409,message:'enrollment_opportunity_selection_required'});
 assert.deepEqual(ambiguous.writes,[]);
});

test('purchase intent preview withholds matches when writes are blocked',async()=>{
 const pending=fixture({ids:[existingId],pending:true});
 await assert.rejects(pending.preview(),{status:403});
 await assert.rejects(pending.save(existingId),{status:403});
 await assert.rejects(fixture({servicing:false}).preview(),{status:503});
 assert.deepEqual(pending.writes,[]);
});

test('private lesson confirmation requires record scope and saves once on the original request',async()=>{
  const route='/api/crm/opportunities/:id/private-lessons/:recordId';
  const handlers=new Map();
  const actor={id:'sales',scope:'all',permissions:['crm.read','crm.followup']} as Employee;
  let owner=actor.id,state='active',linked=true,writes=0,facts=0;
  let criteria:any={level:'HSK 1',format:'one-on-one',appointment:{templateId:'fixture',lessons:23,minutes:45,total:8050000}};
  mountEnrollmentCrm({get:()=>{},post:handlers.set.bind(handlers)} as unknown as Express,{
    wrap:handler=>handler,
    staff:async(_,permission)=>{assert.equal(permission,'crm.followup');return actor;},
    servicing:true,
    saveProgress:async()=>assert.fail('Confirming a schedule must not advance sales stage'),
    transact:async work=>work({async query(sql,args=[]){
      if(sql.includes('GET_LOCK'))return {rows:[]};
      if(sql.includes('FROM enrollment_demands WHERE id'))return {rows:[{state,criteria}]};
      if(sql==='SELECT * FROM enrollment_opportunities WHERE id=:p1')return {rows:[{id:existingId,lead_id:customerId,level:'HSK 1',revision:1}]};
      if(sql.includes('SELECT id,profile FROM portal_leads'))return {rows:[{id:customerId,profile:{id:customerId,owner,identityLifecycle:'independent'}}]};
      if(sql.includes('LEFT JOIN enrollment_demands'))return {rows:[{kind:'demand',record_id:linked?'fixture-request':'other-request',state,criteria}]};
      if(sql.includes('UPDATE enrollment_demands')){criteria=args[0];writes++;return {rows:[]};}
      if(sql.includes('INSERT INTO crm_facts')){facts++;return {rows:[]};}
      assert.fail('Unexpected SQL: '+sql);
    }}),
  });
  const confirmation={firstLessonAt:'2026-12-12T02:00:00.000Z',teacher:'Lina Zhang',schedule:'Saturdays'};
  async function save(body=confirmation,origin='http://localhost:3000'){
    let result:unknown;
    const reply={set:()=>reply,json:(data:unknown)=>{result=data;}} as unknown as Response;
    await handlers.get(route)({params:{id:existingId,recordId:'fixture-request'},body,protocol:'http',headers:{origin},
      get:()=> 'localhost:3000',is:()=>true} as unknown as Request, reply);
    return result;
  }
  await assert.rejects(save(confirmation,'https://other.example.invalid'),/origin_rejected/);
  linked=false;
  await assert.rejects(save(),/interest_not_found/);
  linked=true;
  owner='another-sales';
  actor.scope='own';
  await assert.rejects(save(),/not_found|forbidden/);
  owner=actor.id;
  actor.scope='all';
  assert.deepEqual(await save(),{confirmation});
  assert.deepEqual(await save(),{confirmation});
  await assert.rejects(save({...confirmation,teacher:'Another teacher'}),/enrollment_demand_conflict/);
  state='withdrawn';
  await assert.rejects(save(),/conflict|forbidden/);
  assert.equal(writes,1);
  assert.equal(facts,1);
  assert.equal(criteria.appointment.total,8050000);
});
