import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {savePayment,readPayments,paymentResult} from '../server/portal/payments.ts';
import {builtInRoles} from '../src/utils/accessControl.ts';
import {paymentWorklist,paymentListFilters,paymentListNextAction} from '../src/utils/crmPaymentWorklist.ts';
import {bindSql} from '../cloud/mysql/sql.mjs';

/** Transactional SQL boundary double. Real service authorization, validation, operation receipts,
 * and ledger mutation execute unchanged. Never opens a database or server. */
function fixture(){
 const profile:any={id:'customer-private',owner:'sales',fullName:'PRIVATE-NAME',email:'private@example.invalid',whatsapp:'+628123456789',campaignId:'registered-campaign',currentStage:'progress:enrolled'};
 const project={id:randomUUID(),sourceLeadId:profile.id,course:'HSK 2',expected:1000000,createdAt:'2026-01-01T00:00:00Z',createdBy:'sales',priceSnapshot:{courseId:'hsk2',name:'HSK 2',finalAmount:1000000}};
 const roles=Object.entries({...builtInRoles,ops:{names:['Ops','Ops','运营'],grants:{'crm.read':'all','crm.operations.manage':'all'}}}).map(([id,config])=>({id,config,enabled:true,revision:1}));
 const users=[['sales','sales'],['other','sales'],['finance','finance'],['manager','crm_leader'],['ops','ops']].map(([id,role])=>({id,roles:[role],teams:[],active:true,display_name:id}));
 let db:any={ledger:{projects:[project],entries:[],history:[]},revision:1,operations:[],references:[],audit:[],analytics:[]};
 const statements:string[]=[];
 const c={async query(sql:string,args:any[]=[]):Promise<any>{
  bindSql(sql,args);statements.push(sql);const rows=(rows:any[]=[])=>({rows:structuredClone(rows)});
  if(sql.startsWith('SELECT GET_LOCK'))return rows([{acquired:1}]);
  if(sql.startsWith('SELECT profile FROM portal_leads WHERE id='))return rows(args[0]===profile.id?[{profile}]:[]);
  if(sql.includes('FROM identity_candidates'))return rows();
  if(sql.startsWith('SELECT * FROM crm_users'))return rows(users);
  if(sql.startsWith('SELECT * FROM access_roles'))return rows(roles);
  if(sql.startsWith('SELECT id FROM portal_leads'))return rows();
  if(sql.startsWith('SELECT * FROM crm_payment_ledgers'))return rows([{lead_id:profile.id,revision:db.revision,value:db.ledger}]);
  if(sql.startsWith('SELECT * FROM crm_operations'))return rows(db.operations.filter((r:any)=>r.actor===args[0]&&r.request_id===args[1]));
  if(sql.startsWith('SELECT result FROM crm_operations'))return rows(db.operations.filter((r:any)=>r.actor===args[0]&&r.request_id===args[1]));
  if(sql.startsWith('INSERT INTO crm_operations')){db.operations.push({actor:args[0],request_id:args[1],fingerprint:args[2],result:args[3]});return rows();}
  if(sql.startsWith('SELECT fingerprint FROM crm_payment_references'))return rows(db.references.filter((r:any)=>r.fingerprint===args[0]));
  if(sql.startsWith('INSERT INTO crm_payment_references')){if(db.references.some((r:any)=>r.fingerprint===args[0]))throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});db.references.push({fingerprint:args[0],entry_id:args[2]});return rows();}
  if(sql.startsWith('DELETE FROM crm_payment_references')){db.references=db.references.filter((r:any)=>r.entry_id!==args[1]);return rows();}
  if(sql.startsWith('UPDATE crm_payment_references'))return rows();
  if(sql.startsWith('INSERT INTO crm_payment_ledgers')){db.ledger=structuredClone(args[2]);db.revision=args[1];return rows();}
  if(sql.startsWith('SELECT course_id,state FROM crm_payment_analytics'))return rows(db.analytics.filter((row:any)=>row.id===args[0]));
  if(sql.startsWith('SELECT COALESCE(MAX(sequence_no),0)'))return rows([{last_sequence:Math.max(0,...db.analytics
   .filter((row:any)=>row.environment===args[0]&&row.project_id===args[1]).map((row:any)=>row.sequence_no))}]);
  if(sql.startsWith('INSERT INTO crm_payment_analytics')){
   const [id,environment,project_id,source_entry_id,kind,sequence_no,amount,course_id]=args;
   if(db.analytics.some((row:any)=>row.id===id||(row.environment===environment&&row.project_id===project_id&&row.sequence_no===sequence_no)))throw Error('Duplicate analytics event');
   db.analytics.push({id,environment,project_id,source_entry_id,kind,sequence_no,amount,course_id,state:'held'});
   return rows();
  }
  if(sql.startsWith("UPDATE crm_payment_analytics SET state='cancelled'")){
   for(const row of db.analytics){
    if(row.state==='held'&&(args.length===1?row.id===args[0]:row.environment===args[0]&&row.project_id===args[1]))row.state='cancelled';
   }
   return rows();
  }
  if(sql.startsWith('INSERT INTO portal_audit')){db.audit.push(args);return rows();}
  throw Error('Unexpected SQL: '+sql);
 }};
 let tail=Promise.resolve();
 const tx=async(work:any)=>{const previous=tail;let release:any;tail=new Promise(r=>release=r);await previous;const old=structuredClone(db);try{return await work(c);}catch(e){db=old;throw e;}finally{release();}};
 const command=async(action:string,fields:any={},actor='finance')=>{
  const body={action,projectId:project.id,revision:db.revision,requestId:randomUUID(),...(action==='terminate'?{effectiveAt:'2026-01-02T00:00:00Z'}:{}),...fields};
  return {body,result:await tx((c:any)=>savePayment(c,profile.id,actor,body))};
 };
 const receipt=(amount=400000)=>({amount,receivedAt:'2026-01-01T12:00:00Z',method:'cash',account:'PRIVATE-CASHIER',reference:randomUUID(),evidence:'PRIVATE-EVIDENCE'});
 const read=()=>tx((c:any)=>readPayments(c,profile.id,'sales'));
 return {c,tx,command,receipt,profile,project,read,roles,users,statements,get db(){return db;}};
}

test('scoped sales can terminate, operations can settle, and the confirmed quote and original facts stay intact',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.command('settle',{amount:100,reason:'Before termination'},'ops'),/payment_termination_conflict/);
 await assert.rejects(()=>f.command('terminate',{reason:'No scope'},'other'),/payment_forbidden/);
 await assert.rejects(()=>f.command('terminate',{reason:'Finance verifies money'}),/payment_forbidden/);
 await assert.rejects(()=>f.command('terminate',{reason:'Invalid effective time',effectiveAt:'2025-12-31T23:59:59Z'},'sales'),/payment_termination_before_enrollment/);
 const first=await f.command('receive',f.receipt());
 const termination=await f.command('terminate',{reason:'Course discontinued'},'sales');
 assert.deepEqual((await f.read()).summary[0].settlement,{state:'pending',due:null,refund:null});
 const saved=await f.tx((c:any)=>paymentResult(c,f.profile.id,'sales',termination.body.requestId));
 assert.equal(saved.projectId,f.project.id);
 const replay=await f.tx((c:any)=>savePayment(c,f.profile.id,'sales',termination.body));
 assert.deepEqual(replay,{...termination.result,replayed:true});
 await assert.rejects(()=>f.command('terminate',{reason:'Duplicate termination'},'sales'),/payment_termination_conflict/);
 await assert.rejects(()=>f.command('settle',{amount:100,reason:'No management permission'},'sales'),/payment_forbidden/);
 await assert.rejects(()=>f.command('settle',{amount:100,reason:'',revision:1},'ops'),/payment_conflict/);
 await assert.rejects(()=>f.command('settle',{amount:100,reason:''},'ops'),/payment_information_required/);
 await assert.rejects(()=>f.command('revise_project',{expected:100,reason:'Do not overwrite quote'},'ops'),/已确认报价/);
 await f.command('settle',{amount:400000,reason:'Delivered sessions'},'ops');
 await f.command('settle',{amount:0,reason:'Agreed waiver'},'ops');
 assert.equal((await f.read()).ledger.projects[0].expected,1000000);
 assert.equal(f.db.ledger.entries[0].id,first.result.targetId);
 assert.deepEqual(f.db.ledger.history.filter((h:any)=>h.action==='settle').map((h:any)=>[h.before.settlement?.amount,h.after.settlement.amount]),[[undefined,400000],[400000,0]]);
 assert.ok(f.statements.every(sql=>!/crm_payment_analytics|notification_jobs|INSERT INTO outbox/.test(sql)));
});

test('receipt verification uses actual payment time, then caps post-termination collections at the verified shortfall',async()=>{
 const f=fixture();
 const report=await f.command('submit',{kind:'receipt',amount:400000,reportedAt:'2026-01-01T11:00:00Z',method:'cash'},'sales');
 await f.command('terminate',{reason:'Course discontinued'},'sales');
 const receipt={...f.receipt(),entryId:report.result.targetId};
 await assert.rejects(()=>f.command('verify',{...receipt,receivedAt:'2026-01-02T00:00:00Z'}),/payment_settlement_not_collectible/);
 await f.command('verify',receipt);
 await f.command('receive',f.receipt(50000)); // a second real receipt before termination, recorded later
 await f.command('settle',{amount:500000,reason:'Delivered sessions'},'ops');
 assert.deepEqual((await f.read()).summary[0].settlement,{state:'collect',due:50000,refund:0});
 const supplemental={...f.receipt(50000),receivedAt:'2026-01-02T00:00:00Z'};
 await assert.rejects(()=>f.command('receive',{...supplemental,amount:50001}),/payment_settlement_receipt_exceeds_due/);
 await f.command('receive',supplemental);
 assert.equal((await f.read()).summary[0].settlement.state,'settled');
 assert.equal(f.db.ledger.entries.length,3);
});

test('pure refund work counts once, has an action, and leaves the queue when two real refunds settle it',async()=>{
 const f=fixture();
 await f.command('receive',f.receipt());
 await f.command('terminate',{reason:'Course discontinued'},'sales');
 const roles=f.roles;
 const finance=(await import('../src/utils/accessControl.ts')).projectEmployee(f.users.find(u=>u.id==='finance')!,roles);
 const list=(state='outstanding')=>paymentWorklist(finance,[f.profile],[{lead_id:f.profile.id,value:f.db.ledger}],[],paymentListFilters({state}));
 assert.equal(list().outstandingCount,0);
 await f.command('settle',{amount:200000,reason:'Delivered sessions'},'ops');
 assert.equal(list().outstandingCount,1);
 assert.equal(paymentListNextAction(list().rows[0]),'refund');
 assert.deepEqual(list().rows[0].settlement,{state:'refund',due:0,refund:200000});
 await f.command('refund',{...f.receipt(100000),receivedAt:'2026-01-02T10:00:00Z'});
 assert.equal(list().outstandingCount,1);
 await f.command('refund',{...f.receipt(100000),receivedAt:'2026-01-03T10:00:00Z'});
 assert.equal(list().outstandingCount,0);
 assert.equal(list('terminated').rows[0].refunded,200000);
 assert.equal(list('terminated').rows[0].settlement?.state,'settled');
});

async function withQueue(work:()=>Promise<void>) {
 const previous=process.env.PORTAL_ENV;
 process.env.PORTAL_ENV='dev';
 try {await work();} finally {
  if(previous===undefined)delete process.env.PORTAL_ENV;else process.env.PORTAL_ENV=previous;
 }
}

test('GA holds one contract purchase and two distinct partial refunds in ledger order without sending',()=>withQueue(async()=>{
 const f=fixture();
 await f.command('receive',f.receipt(300000));
 await f.command('receive',f.receipt(200000));
 await f.command('terminate',{reason:'End of enrollment'},'sales');
 await f.command('settle',{amount:350000,reason:'Delivery evidence'},'ops');
 const reported=await f.command('submit',{kind:'refund',amount:100000,reportedAt:'2026-01-02T10:00:00Z',method:'cash'},'sales');
 assert.deepEqual(f.db.analytics.map((row:any)=>row.kind),['purchase']);
 const partial1=await f.command('verify',{...f.receipt(100000),receivedAt:'2026-01-02T10:00:00Z',entryId:reported.result.targetId});
 const replay=await f.tx((c:any)=>savePayment(c,f.profile.id,'finance',partial1.body));
 assert.equal(replay.replayed,true);
 await f.command('refund',{...f.receipt(50000),receivedAt:'2026-01-03T10:00:00Z'});
 assert.deepEqual(f.db.analytics.map(({kind,sequence_no,amount}:any)=>[kind,sequence_no,amount]),[
  ['purchase',0,1000000],['refund',1,100000],['refund',2,50000],
 ]);
 assert.equal(f.db.analytics.filter((row:any)=>row.kind==='refund').reduce((n:number,row:any)=>n+row.amount,0),150000);
 assert.equal((await f.read()).summary[0].net,350000);
 assert.equal(new Set(f.db.analytics.map((row:any)=>row.id)).size,3);
 assert.ok(f.db.analytics.every((row:any)=>row.project_id===f.project.id&&row.state==='held'));
 assert.doesNotMatch(JSON.stringify(f.db.analytics),/PRIVATE|@example|evidence|client_id|referr/i);
}));

test('same-amount refunds are distinct, and voiding an unsent refund cancels only that candidate',()=>withQueue(async()=>{
 const f=fixture();
 const first=await f.command('receive',f.receipt());
 const a=await f.command('refund',f.receipt(100000));
 await f.command('refund',f.receipt(100000));
 await f.command('void',{entryId:a.result.targetId,reason:'Mistaken refund entry'});
 assert.deepEqual(f.db.analytics.map((row:any)=>row.state),['held','cancelled','held']);
 await assert.rejects(()=>f.command('void',{entryId:first.result.targetId,reason:'Verified refund requires real receipts'}),/payment_refund_exceeds_received/);
 assert.deepEqual(f.db.analytics.map((row:any)=>row.state),['held','cancelled','held']);
}));

test('queue write rolls back with the ledger, and old, unpriced and free projects are not backfilled',()=>withQueue(async()=>{
 for (const expected of [null,0]) {
  const f=fixture();
  f.db.ledger.projects[0].expected=expected;
  await f.command('receive',f.receipt());
  assert.deepEqual(f.db.analytics,[]);
 }
 const historical=fixture();
 historical.db.ledger.entries.push({id:randomUUID(),projectId:historical.project.id,kind:'receipt',state:'verified',verifiedAmount:200000});
 await historical.command('receive',historical.receipt());
 await historical.command('refund',historical.receipt(50000));
 assert.deepEqual(historical.db.analytics,[]);
 const f=fixture();
 await assert.rejects(()=>f.tx(async(c:any)=>{
  await savePayment(c,f.profile.id,'finance',{action:'receive',revision:1,projectId:f.project.id,requestId:randomUUID(),...f.receipt()});
  assert.equal(f.db.analytics.length,1);
  throw Error('Injected rollback');
 }),/Injected rollback/);
 assert.deepEqual([f.db.ledger.entries.length,f.db.operations.length,f.db.analytics.length],[0,0,0]);
 const receipt=await f.command('receive',f.receipt());
 await f.command('void',{entryId:receipt.result.targetId,reason:'Mistaken receipt entry'});
 assert.equal(f.db.analytics[0].state,'cancelled');
}));

test('old actual receipts verified after termination qualify, but settlement collections do not create a purchase',()=>withQueue(async()=>{
 const f=fixture();
 await f.command('terminate',{reason:'End of enrollment'},'sales');
 await f.command('receive',f.receipt());
 assert.equal(f.db.analytics[0].kind,'purchase');
 const supplemental=fixture();
 await supplemental.command('terminate',{reason:'End of enrollment'},'sales');
 await supplemental.command('settle',{amount:100000,reason:'Final balance'},'ops');
 await supplemental.command('receive',{...supplemental.receipt(100000),receivedAt:'2026-01-03T10:00:00Z'});
 assert.deepEqual(supplemental.db.analytics,[]);
}));
