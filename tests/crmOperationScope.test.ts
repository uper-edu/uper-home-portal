import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {confirmCrmOperation} from '../src/utils/crmOperationResult.ts';
import {trustError} from '../src/utils/crmTrustLanguage.ts';
import {operation} from '../server/portal/trustWorkflow.ts';

test('save confirmation rejects another customer, operation or unconfirmed response',()=>{
 for(const response of [{saved:true,leadId:'B',operationKind:'stage'},{saved:true,leadId:'A',operationKind:'information'},{saved:false,leadId:'A',operationKind:'stage'},{saved:true,leadId:'A'}])
  assert.throws(()=>confirmCrmOperation(response,'A','stage'));
 assert.doesNotThrow(()=>confirmCrmOperation({saved:true,leadId:'A',operationKind:'stage'},'A','stage'));
 for(const lang of ['en','id','zh'] as const)assert.ok(trustError('Request context conflict; query the original result and refresh before saving',lang).length>10);
});

test('related-record permission is rechecked before replaying an identity result',async()=>{
 let row:any, permitted=true, writes=0;
 const client={query:async(sql:string,params:any[])=>{
   if(sql.startsWith('SELECT'))return {rows:row?[row]:[]};
   row={fingerprint:params[2],result:params[3]};return {rows:[]};
 }};
 const scope={leadId:'A',kind:'identity-actions',authorize:async()=>{if(!permitted)throw Object.assign(Error('Lead not found'),{status:404});}};
 const body={requestId:'identity-retry',candidateId:'B',decision:'different',reason:'TEST'};
 const work=async()=>{writes++;return {saved:true};};
 await operation(client,'Sales',body,scope,work);permitted=false;
 await assert.rejects(()=>operation(client,'Sales',body,scope,work),/Lead not found/);
 assert.equal(writes,1);
});

if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');
 await setupNativeTest('operation696');process.env.PLATFORM_MODE='local';
 const {pool,tx}=await import('../server/portal/store.ts');
 const {mountPortal}=await import('../server/portal/runtime.ts');
 const {default:express}=await import('express');
 test('MySQL operation scope: cross-target, cross-action, revoked access, old cache and concurrent retries',async t=>{
  const app=express();app.use(express.json());await mountPortal(app);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
  const base='http://127.0.0.1:'+(server.address() as any).port;
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
  function session(){let cookie='';return async(path:string,body?:any,method?:string)=>{const r=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});for(const h of r.headers.getSetCookie())cookie=h.split(';')[0];return {status:r.status,data:await r.json()};};}
  const sales=session(),manager=session(),other=session();
  for(const [s,name] of [[sales,'Fadhil'],[manager,'Suki'],[other,'Wigar']] as const)assert.equal((await s('/api/crm/auth/login',{loginId:name,password:name})).status,200);
  const ids=Array.from({length:6},(_,i)=>'TEST696-'+i+'-'+randomUUID());const [a,b,c,d,legacy,transferred]=ids;
  for(const id of ids)await pool.query('INSERT INTO portal_leads(id,business_number,profile) VALUES(:p1,:p2,:p3)',[id,id,{id,fullName:id,email:id+'@example.invalid',owner:'Fadhil',currentStage:'New',stageRevision:0,tier:'Warm-Online'}]);
  const path=(id:string,action='stage')=>'/api/crm/leads/'+id+'/'+action;
  const body=()=>({requestId:randomUUID(),newStage:'progress:discovery',expectedStage:'New',expectedStageRevision:0,reason:'客户已回复，开始沟通课程需求。',basisRefs:[],effectiveTimeMode:'unknown'});
  const request=body();assert.equal((await sales(path(a),request)).status,200);
  const repeated=await Promise.all(Array.from({length:10},()=>sales(path(a),request)));
  assert.ok(repeated.every(r=>r.status===200&&r.data.replayed===true));
  for(const action of ['information','task-actions','engagement-actions','identity-actions']){const r=await sales(path(a,action),request);assert.equal(r.status,action==='identity-actions'?403:action==='task-actions'?410:409);assert.equal(r.data.lead,undefined);}
  assert.equal((await sales(path(a),{...request,reason:'different'})).status,409);
  assert.equal((await manager('/api/crm/leads/'+a,{owner:'Wigar'},'PATCH')).status,200);
  for(const action of ['', '/stage','/operations/'+request.requestId])assert.equal((await sales('/api/crm/leads/'+a+action,action==='/stage'?request:undefined)).status,404);
  const cross=await sales(path(b),request);assert.equal(cross.status,409);assert.equal(cross.data.lead,undefined);assert.equal(cross.data.leadId,undefined);
  assert.equal((await sales(path(b,'operations/'+request.requestId))).status,404);
  assert.equal((await other('/api/crm/leads/'+a)).status,200);
  const current=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[b])).rows[0].profile;assert.equal(current.currentStage,'New');
  const collision=body();const simultaneous=await Promise.all([sales(path(c),collision),sales(path(d),collision)]);
  assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
  const changed=(await pool.query('SELECT profile FROM portal_leads WHERE id IN (:p1,:p2)',[c,d])).rows.filter((r:any)=>r.profile.currentStage==='progress:discovery');assert.equal(changed.length,1);
  const old=body();const oldResult={saved:true,leadId:legacy,lead:{id:legacy,currentStage:'Contacted'}};
  await pool.query('INSERT INTO crm_operations(actor,request_id,fingerprint,result) VALUES(:p1,:p2,:p3,:p4)',['Fadhil',old.requestId,createHash('sha256').update(JSON.stringify(old)).digest('hex'),oldResult]);
  assert.equal((await sales(path(legacy),old)).status,409);assert.equal((await sales(path(legacy,'operations/'+old.requestId))).status,200);
  // Hold a transfer's row lock while the old owner starts a retry.
  const transferRequest=body();
  assert.equal((await sales(path(transferred),transferRequest)).status,200);
  let unlock!:()=>void, locked!:()=>void;
  const gate=new Promise<void>(r=>unlock=r), ready=new Promise<void>(r=>locked=r);
  const transfer=tx(async(client:any)=>{
    const profile=(await client.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[transferred])).rows[0].profile;
    await client.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[transferred,{...profile,owner:'Wigar'}]);
    locked();await gate;
  });
  await ready;
  let settled=false;
  const pending=sales(path(transferred),transferRequest).then(r=>{settled=true;return r;});
  try { await new Promise(r=>setTimeout(r,40));assert.equal(settled,false); }
  finally { unlock(); }
  await transfer;assert.equal((await pending).status,404);
  const facts=(await pool.query("SELECT lead_id FROM crm_facts WHERE kind='stage.changed'",[])).rows;
  assert.equal(facts.filter((r:any)=>r.lead_id===a).length,1);
  assert.equal(facts.filter((r:any)=>r.lead_id===b).length,0);
  assert.equal(facts.filter((r:any)=>[c,d].includes(r.lead_id)).length,1);
  assert.equal((await pool.query('SELECT id FROM notification_jobs',[])).rows.length,0);
 });
}

else test('operation scope native concurrency and revoked access require explicit independent MySQL',{skip:'MYSQL_NATIVE_TEST_ENV not configured; no implicit acceptance'},()=>{});
