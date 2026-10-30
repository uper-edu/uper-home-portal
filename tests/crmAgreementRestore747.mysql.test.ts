import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {setupNativeTest} from './helpers/mysql.mjs';
import {restoreMistakenFulfilment} from '../server/portal/agreementRestore';

if(!process.env.MYSQL_NATIVE_TEST_ENV)test('747 native acceptance requires isolated MySQL',{skip:'Independent synthetic database required'},()=>{});
else await test('747 isolated MySQL: timing, no replay, concurrent correction and atomic rollback',async t=>{
 const fixture=await setupNativeTest('agreement747');
 process.env.PLATFORM_MODE='mock';
 const {pool,tx}=await import('../server/portal/store');
 const {nativePool:raw}=await import('../cloud/mysql/runtime.mjs');
 const {tick}=await import('../server/portal/worker');
 const {defaults}=await import('../server/portal/policy');
 // Only in-app synthetic delivery; fail closed if any code attempts an external request.
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('747 isolated acceptance forbids external requests')};
 t.after(async()=>{globalThis.fetch=originalFetch;await pool.end();const admin=await mysql.createConnection({user:'root',socketPath:fixture.socket});try{await admin.query('DROP DATABASE `'+fixture.name+'`');const user=decodeURIComponent(new URL(process.env.MYSQL_TRIAL_URL!).username);await admin.query('DROP USER '+mysql.escape(user)+'@localhost');const [schemas]=await admin.query<any[]>('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[fixture.name]);assert.equal(schemas.length,0);const [users]=await admin.query<any[]>('SELECT User FROM mysql.user WHERE User=?',[user]);assert.equal(users.length,0);}finally{await admin.end();}});
 const rule={...defaults,event:'commitment.due',channels:['inapp'],calendarMode:'custom',businessOnly:false,days:[0,1,2,3,4,5,6],start:'00:00',end:'23:59',recipient:'owner',dedupeMinutes:0};
 await raw.query('INSERT INTO notification_rules(id,version,config,enabled) VALUES(?,1,?,true)',['TEST747-rule',JSON.stringify(rule)]);
 const now=new Date(),future=new Date(now.getTime()+3600000),past=new Date(now.getTime()-3600000);
 async function seed(id:string,when:any){const p={id,fullName:'TEST747 '+id,owner:'test-sales',campaignId:'TEST747-CAMPAIGN',currentStage:'progress:proposal',simpleRevision:1,identityLifecycle:'independent',commitments:[{id:'agreement-'+id,action:'TEST 双方约定',status:'fulfilled',...when}],followUpLogs:[{id:'fulfil-'+id,summary:'TEST original fulfilment',commitmentChange:{id:'agreement-'+id,status:'fulfilled'}}]};await raw.query('INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)',[id,'TEST747-'+id,JSON.stringify(p)]);return p;}
 const body=(p:any,requestId='request-'+p.id)=>({requestId,commitmentId:p.commitments[0].id,fulfilmentLogId:p.followUpLogs[0].id,expectedRevision:1,reason:'TEST 误记履行'});
 const restore=(p:any,b=body(p),clock=now)=>tx(c=>restoreMistakenFulfilment(c,p.id,'test-admin',b,()=>true,clock));
 async function profile(id:string){return (await raw.query<any[]>('SELECT profile FROM portal_leads WHERE id=?',[id]))[0][0].profile;}
 async function jobs(id:string){return (await raw.query<any[]>('SELECT j.* FROM notification_jobs j JOIN outbox o ON o.id=j.event_id WHERE o.lead_id=?',[id]))[0];}
 async function count(table:string,where:string,args:any[]){return Number((await raw.query<any[]>('SELECT COUNT(*) n FROM '+table+' WHERE '+where,args))[0][0].n);}
 await t.test('future restore delivers once at original time, never before it; repeated ticks do not resend',async()=>{
  const p=await seed('future',{at:future.toISOString()});await restore(p);await tick(now);assert.equal((await jobs(p.id)).length,0);
  await tick(new Date(future.getTime()+1000));let j=await jobs(p.id);assert.equal(j.length,1);assert.equal(j[0].state,'accepted');assert.equal(j[0].attempts,1);
  for(let i=0;i<3;i++)await tick(new Date(future.getTime()+60000));j=await jobs(p.id);assert.equal(j.length,1);assert.equal(j[0].attempts,1);assert.equal(await count('notification_inbox','id=?',[j[0].id]),1);
  const current=await profile(p.id);assert.deepEqual(current.followUpLogs,p.followUpLogs);assert.equal(current.commitments[0].at,p.commitments[0].at);assert.equal(current.owner,p.owner);assert.equal(current.campaignId,p.campaignId);
 });
 await t.test('past and date-only today do not synthesize catch-up reminders',async()=>{
  const a=await seed('past',{at:past.toISOString()});const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);const b=await seed('date',{date,timezone:'Asia/Jakarta'});
  await restore(a);await restore(b);await tick(new Date(future.getTime()+86400000));
  for(const p of [a,b]){assert.equal((await profile(p.id)).commitments[0].reminderSuppressed,true);assert.equal(await count('outbox','lead_id=?',[p.id]),0);assert.equal((await jobs(p.id)).length,0);}
 });
 await t.test('old pending is cancelled; accepted history is unchanged, and ticks never replay it',async()=>{
  const p=await seed('history',{at:past.toISOString()}),ev='commitment:'+p.commitments[0].id;
  await raw.query("INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES(?,'commitment.due',?,?,UTC_TIMESTAMP(6))",[ev,p.id,JSON.stringify({commitmentId:p.commitments[0].id})]);
  for(const state of ['pending','accepted'])await raw.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,attempts,snapshot) VALUES(?,?,?,1,'inapp','test-sales',?,?,?,?)",['job-'+state,ev,'rule-'+state,state,past,state==='accepted'?1:0,JSON.stringify({rule,event:'commitment.due',leadId:p.id,payload:{commitmentId:p.commitments[0].id}})]);
  const accepted=(await jobs(p.id)).find(j=>j.state==='accepted');await restore(p);await tick(future);const j=await jobs(p.id);assert.equal(j.length,2);assert.deepEqual(j.find(x=>x.id===accepted.id),accepted);assert.equal(j.find(x=>x.id==='job-pending').state,'cancelled');
 });
 await t.test('same request races return one result; competing distinct requests reject stale writer',async()=>{
  for(const same of [true,false]){const p=await seed(same?'same-race':'different-race',{at:future.toISOString()});const res=await Promise.allSettled(Array.from({length:6},(_,i)=>restore(p,body(p,same?'same-request':'different-'+i))));
   assert.equal(res.filter(r=>r.status==='fulfilled').length,same?6:1);
   if(!same)for(const r of res)if(r.status==='rejected')assert.equal(r.reason.status,409);
   assert.equal((await profile(p.id)).commitments[0].fulfilmentCorrections.length,1);assert.equal(await count('crm_facts','lead_id=? AND kind=?',[p.id,'commitment.fulfilment_reversed']),1);assert.equal(await count('crm_operations',"JSON_UNQUOTE(JSON_EXTRACT(result,'$.leadId'))=?",[p.id]),1);
  }
 });
 await t.test('failure after pending cancellation rolls back job, fact, profile and operation together',async()=>{
  const p=await seed('rollback',{at:past.toISOString()}),ev='commitment:'+p.commitments[0].id;
  await raw.query("INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES(?,'commitment.due',?,?,UTC_TIMESTAMP(6))",[ev,p.id,JSON.stringify({commitmentId:p.commitments[0].id})]);
  await raw.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES('rollback-job',?,'rollback-rule',1,'inapp','test-sales',?,?)",[ev,past,JSON.stringify({payload:{commitmentId:p.commitments[0].id}})]);
  const before=await jobs(p.id);await raw.query("CREATE TRIGGER test747_failure BEFORE UPDATE ON portal_leads FOR EACH ROW BEGIN IF NEW.id='rollback' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST747 isolated failure'; END IF; END");
  try{await assert.rejects(restore(p));assert.deepEqual(await profile(p.id),p);assert.deepEqual(await jobs(p.id),before);assert.equal(await count('crm_facts','lead_id=?',[p.id]),0);assert.equal(await count('crm_operations',"JSON_UNQUOTE(JSON_EXTRACT(result,'$.leadId'))=?",[p.id]),0);}finally{await raw.query('DROP TRIGGER test747_failure');}
  await restore(p);assert.equal((await jobs(p.id))[0].state,'cancelled');
 });
 assert.equal(await count('crm_ai_extractions','1=1',[]),0);assert.equal(await count('followup_tasks','1=1',[]),0);
});
