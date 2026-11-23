import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {lockIdentityRegistry} from '../server/portal/identityConsolidation.ts';

const databaseHook=registerHooks({load(url,context,next){
  if(!url.endsWith('/cloud/mysql/runtime.mjs'))return next(url,context);
  return {shortCircuit:true,format:'module',source:`
    const unused=()=>{throw Error('Identity enrollment test attempted to open a database');};
    export const nativePool={},pool={},initialize=unused,connection=unused,tx=unused,event=unused,id=unused;
  `};
}});
const {reconcileEnrollmentAfterIdentityReview,recordEnrollmentCustomer,validateAssistedContacts}=await import('../server/portal/enrollmentCrm.ts');
databaseHook.deregister();

const customerId='verified-customer',sourceId='enrollment-registration',actor='reviewer';
const sourceProfile={id:sourceId,fullName:'Demo learner',email:'learner@example.invalid',enrollmentEmailVerified:true,whatsapp:'+6281212345678',identityMergedInto:customerId};
const customer={id:customerId,profile:{id:customerId,owner:actor,identityLifecycle:'independent'}};
const lead={id:sourceId,profile:sourceProfile};
const active={id:'opportunity-1',level:'HSK 2',sales_stage:'progress:unreached',revision:0};
const classData={level:'HSK 2'};
const order={kind:'order',record_id:'order-1',opportunity_id:null as string|null,state:'awaiting_payment',class_data:classData,price:920000,received:0};
const waitlist={kind:'waitlist',record_id:'waitlist-1',opportunity_id:null as string|null,state:'waiting',class_data:classData,price:null,received:null};
const demand={kind:'demand',record_id:'demand-1',opportunity_id:null as string|null,state:'active',criteria:{level:'HSK 2'},price:null,received:null};

function fixture(records:any[],opportunities=[active],pending=false) {
  const rows=structuredClone(records),writes:{sql:string;params:unknown[]}[]=[];
  const db={async query(sql:string,params:unknown[]=[]){
    if(sql.startsWith('SELECT GET_LOCK'))return {rows:[{acquired:true}]};
    if(sql.includes('SELECT id,profile FROM portal_leads WHERE id=')){
      if(params[0]===sourceId)return {rows:[lead]};
      assert.equal(params[0],customerId);
      return {rows:[pending?{...customer,profile:{...customer.profile,identityLifecycle:'pending'}}:customer]};
    }
    if(sql.includes("profile->>'$.enrollmentEmailVerified'"))return {rows:[lead]};
    if(sql.includes('REGEXP_REPLACE')){
      assert.ok(JSON.parse(String(params[1])).includes('62081212345678'));
      return {rows:[lead]};
    }
    if(sql.includes('SELECT r.lead_id,r.opportunity_id,o.level'))return {rows:rows.filter(row=>row.kind===params[0]&&row.record_id===params[1])
      .map(row=>({...row,level:opportunities.find(opportunity=>opportunity.id===row.opportunity_id)?.level}))};
    if(sql.startsWith('SELECT o.* FROM enrollment_opportunities')){
      assert.equal(params[0],customerId);
      return {rows:opportunities.filter(row=>row.level===params[1])};
    }
    if(sql.startsWith('SELECT r.kind,r.record_id,')){
      if(sql.includes('r.opportunity_id IS NULL')){
        assert.equal(params[0],customerId);
        return {rows:rows.filter(row=>!row.opportunity_id)};
      }
      return {rows:rows.filter(row=>row.opportunity_id&&params.includes(row.opportunity_id))};
    }
    writes.push({sql,params});
    if(sql.startsWith('UPDATE enrollment_customer_records')){
      const row=rows.find(row=>row.kind===params[1]&&row.record_id===params[2]&&!row.opportunity_id);
      if(!row)return {rows:[],rowCount:0};
      row.opportunity_id=params[0];
      return {rows:[],rowCount:1};
    }
    if(sql.startsWith('INSERT INTO enrollment_customer_records')){
      const prior=rows.find(row=>row.kind===params[0]&&row.record_id===params[1]);
      if(prior)prior.opportunity_id=params[3];
      else rows.push({kind:params[0],record_id:params[1],lead_id:params[2],opportunity_id:params[3]});
      return {rows:[],rowCount:1};
    }
    if(sql.startsWith('UPDATE enrollment_opportunities')||sql.startsWith('INSERT INTO crm_facts'))return {rows:[],rowCount:1};
    throw Error('Unexpected SQL: '+sql);
  }};
  return {db,rows,writes};
}

test('after identity confirmation, order, same-level waitlist and demand use the unique existing opportunity; repeat is a no-op',async()=>{
  const f=fixture([{...order,lead_id:sourceId},waitlist,demand,{...demand,record_id:'unknown',criteria:{}}]);
  await reconcileEnrollmentAfterIdentityReview(f.db,customerId,actor);
  assert.deepEqual(f.rows.map(row=>row.opportunity_id),[active.id,active.id,active.id,null]);
  assert.equal(f.rows[0].lead_id,sourceId);
  assert.equal(f.rows[0].price,920000);
  assert.equal(f.rows[0].state,'awaiting_payment');
  assert.equal(f.writes.filter(write=>write.params[2]==='enrollment.opportunity.linked').length,3);
  assert.ok(f.writes.filter(write=>write.params[2]==='enrollment.opportunity.linked').every(write=>(write.params[4] as any).via==='identity_review'));
  assert.ok(f.writes.every(write=>!/(enrollment_orders|enrollment_payment|notification|outbox)/.test(write.sql)));
  const writes=f.writes.length;
  await reconcileEnrollmentAfterIdentityReview(f.db,customerId,actor);
  assert.equal(f.writes.length,writes);
});

test('an order submitted after identity resolution resolves through the original verified enrollment contact to the same opportunity',async()=>{
  const f=fixture([]);
  await recordEnrollmentCustomer(f.db,{kind:'order',id:'order-after-review',level:'HSK 2',email:sourceProfile.email,phone:'81212345678',name:sourceProfile.fullName});
  assert.deepEqual(f.rows,[{kind:'order',record_id:'order-after-review',lead_id:customerId,opportunity_id:active.id}]);
  assert.equal(f.writes.some(write=>write.sql.startsWith('INSERT INTO enrollment_opportunities')),false);
});

test('assisted enrollment accepts equivalent phone formats and still blocks a shared number', async () => {
  const primary = {id:'primary', profile:{...sourceProfile, whatsapp:'81212345678'}};
  const shared = {id:'shared', profile:{whatsapp:'+62 081212345678'}};
  for (const matches of [[primary], [primary, shared]]) {
    const db = {async query(sql: string, args: unknown[]) {
      assert.match(sql, /JSON_TABLE/);
      assert.deepEqual(args, [sourceProfile.email, JSON.stringify([
        '6281212345678', '006281212345678', '62081212345678', '0062081212345678', '81212345678', '081212345678',
      ])]);
      return {rows:matches};
    }};
    const checked = validateAssistedContacts(db, primary, sourceProfile.fullName, sourceProfile.email, '0062 081212345678');
    if (matches.length === 1) await checked;
    else await assert.rejects(checked, /enrollment_assistance_identity/);
  }
});

test('pending identity, missing or multiple candidates, and independent same-level orders stay available for manual review',async()=>{
  const cases=[
    fixture([order],[active],true),
    fixture([order],[]),
    fixture([order],[active,{...active,id:'second-opportunity'}]),
    fixture([order,{...order,record_id:'same-level-other-order'}]),
    fixture([order,{...order,record_id:'linked-order',opportunity_id:active.id}]),
    fixture([{...order,class_data:{level:'HSK 3'}}]),
  ];
  for(const f of cases){
    await reconcileEnrollmentAfterIdentityReview(f.db,customerId,actor);
    assert.equal(f.rows[0].opportunity_id,null);
    assert.deepEqual(f.writes,[]);
  }
});

test('simultaneous identity reconciliation and a repeated enrollment submission produce one association in either lock order',async()=>{
  for(const identityFirst of [true,false]){
    const f=fixture([{...order,lead_id:sourceId}]);
    let tail=Promise.resolve();
    const locked=async(work:(db:typeof f.db)=>Promise<void>)=>{
      let release=()=>{};
      try{
        await work({async query(sql,params){
          if(sql.startsWith('SELECT GET_LOCK')){
            assert.deepEqual(params,['crm-identity-registry-v1']);
            const previous=tail;
            tail=new Promise<void>(done=>{release=done;});
            await previous;
          }
          return f.db.query(sql,params);
        }});
      }finally{release();}
    };
    const identity=()=>locked(async db=>{
      await lockIdentityRegistry(db);
      await reconcileEnrollmentAfterIdentityReview(db,customerId,actor);
    });
    const replay=()=>locked(db=>recordEnrollmentCustomer(db,{kind:'order',id:order.record_id,level:'HSK 2',
      email:sourceProfile.email,phone:sourceProfile.whatsapp,name:sourceProfile.fullName}));
    await Promise.all(identityFirst?[identity(),replay()]:[replay(),identity()]);
    assert.deepEqual(f.rows,[{...order,lead_id:sourceId,opportunity_id:active.id}]);
    assert.equal(f.writes.filter(write=>write.sql.startsWith('UPDATE enrollment_customer_records ')||write.sql.startsWith('INSERT INTO enrollment_customer_records(')).length,1);
  }
});
