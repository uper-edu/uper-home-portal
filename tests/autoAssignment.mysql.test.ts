import {test} from 'node:test';import assert from 'node:assert/strict';
import {setupNativeTest} from './helpers/mysql.mjs';import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {builtInRoles} from '../src/utils/accessControl.ts';import {DEFAULT_CRM_POLICY_CONFIG as defaults} from '../src/types/crmPolicyConfig.ts';
if(!process.env.MYSQL_NATIVE_TEST_ENV){test('automatic assignment requires approved isolation',{skip:true},()=>{});}else{
 const fixture=await setupNativeTest('auto_assignment');process.env.PORTAL_WORKER_ENABLED='false';
 const {pool,tx}=await import('../server/portal/store.ts');const {assignNewLead,prepareAssignmentPolicy,assignmentDirectory}=await import('../server/portal/autoAssignment.ts');
 const lead=async(id:string,extra:any={})=>{await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[id,{id,name:'Maya Putri',team:'sales',owner:null,submittedAt:'2030-01-01T00:00:00Z',...extra}]);};
 const read=async(id:string)=>(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile;
 try{
 for(const id of ['sales','crm_leader'])await pool.query('INSERT INTO access_roles(id,config) VALUES(:p1,:p2)',[id,builtInRoles[id]]);
 for(const id of ['a','b','manager'])await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,'synthetic',:p2,:p3)",[id,JSON.stringify([id==='manager'?'crm_leader':'sales']),'[]']);
 const config={...structuredClone(defaults),autoAssignment:{enabled:true,strategy:'round_robin',salesIds:['a','b']}};
 const manager=(await assignmentDirectory(pool)).find((p:any)=>p.id==='manager');
 await test('policy activation requires assignment permission and validates current participants',async()=>{
  const sales=(await assignmentDirectory(pool)).find((p:any)=>p.id==='a');await assert.rejects(()=>tx(c=>prepareAssignmentPolicy(c,defaults,config,sales)),/access/);
  await assert.rejects(()=>tx(c=>prepareAssignmentPolicy(c,defaults,{...config,autoAssignment:{...config.autoAssignment,salesIds:['missing']}},manager)),/unavailable/);
  await tx(async c=>{await prepareAssignmentPolicy(c,defaults,config,manager);await c.query("INSERT INTO portal_settings(id,value) VALUES('crm_policy',:p1)",[config]);});
 });
 await test('parallel registrations rotate atomically; repeat preserves owner and original deadline',async()=>{
  await lead('lead-a',{tier:'Cold',goal:'Study in China',currentStage:'progress:unreached'});await lead('lead-b');await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES('task-a','lead-a','consultation','2030-01-02')");
  const result=await Promise.all(['lead-a','lead-b'].map(id=>tx(c=>assignNewLead(c,id,'registration'))));assert.deepEqual(result.map(p=>p.owner).sort(),['a','b']);
  const first=await read('lead-a');assert.equal(first.tier,'Cold');assert.equal(first.goal,'Study in China');assert.equal(first.currentStage,'progress:unreached');await tx(c=>assignNewLead(c,'lead-a','registration'));assert.equal((await read('lead-a')).owner,first.owner);
  const task=(await pool.query("SELECT owner_id,due_at,status FROM followup_tasks WHERE id='task-a'")).rows[0];assert.equal(task.owner_id,first.owner);assert.equal(new Date(task.due_at).toISOString(),'2030-01-02T00:00:00.000Z');
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM crm_facts WHERE kind='owner.changed'")).rows[0].n),2);
 });
 await test('inactive participants and revoked roles are skipped; no eligible staff leaves unassigned',async()=>{
  await pool.query("UPDATE crm_users SET active=false WHERE id='a'");await lead('lead-c');assert.equal((await tx(c=>assignNewLead(c,'lead-c','registration'))).owner,'b');
  await pool.query("UPDATE crm_users SET roles=:p1 WHERE id='b'",['[]']);await lead('lead-d');assert.equal((await tx(c=>assignNewLead(c,'lead-d','registration'))).owner,null);
  await assert.rejects(()=>tx(c=>prepareAssignmentPolicy(c,defaults,config,manager)),/unavailable/);
  await pool.query("UPDATE crm_users SET active=true,roles=:p1 WHERE id IN (:p2)",['["sales"]',['a','b']]);
 });
 await test('pending, historical and already-owned customers are not reassigned; released identities may enter',async()=>{
  for(const [id,extra] of [['pending',{identityLifecycle:'pending'}],['historical',{submittedAt:'2020-01-01'}],['owned',{owner:'manager'}]] as const){await lead(id,extra);assert.equal((await tx(c=>assignNewLead(c,id,'registration'))).owner,extra.owner||null);}
  await lead('released',{submittedAt:'2020-01-01',identityLifecycle:'independent',identityReleasedAt:'2030-01-01'});assert.ok((await tx(c=>assignNewLead(c,'released','identity_release'))).owner);
 });
 await test('revoked manager access cannot enable assignment',async()=>{await pool.query("UPDATE crm_users SET roles=:p1 WHERE id='manager'",['[]']);await assert.rejects(()=>tx(c=>prepareAssignmentPolicy(c,defaults,config,manager)),/access/);await pool.query("UPDATE crm_users SET roles=:p1 WHERE id='manager'",['["crm_leader"]']);});
 await test('rollback restores owner, history and cursor; disabling stops new assignments',async()=>{
  await lead('rollback');const cursor=(await pool.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor'")).rows[0].value;
  const facts=Number((await pool.query('SELECT COUNT(*) n FROM crm_facts')).rows[0].n);
  await assert.rejects(()=>tx(async c=>{await assignNewLead(c,'rollback','registration');throw Error('Synthetic transaction failure')}));
  assert.equal((await read('rollback')).owner,null);assert.deepEqual((await pool.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor'")).rows[0].value,cursor);assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM crm_facts')).rows[0].n),facts);
  await pool.query("UPDATE portal_settings SET value=:p1 WHERE id='crm_policy'",[{...config,autoAssignment:{...config.autoAssignment,enabled:false}}]);await lead('off');assert.equal((await tx(c=>assignNewLead(c,'off','registration'))).owner,null);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM outbox')).rows[0].n),0);assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n),0);
 });

 await test('real policy API enforces authorization, unsupported strategy and concurrency; real registration assigns once',async()=>{
  process.env.PLATFORM_MODE='mock';
  const {platform}=await import('../server/portal/identity.ts');const original=platform.authenticate;platform.authenticate=async(q:any)=>(await assignmentDirectory(pool)).find((e:any)=>e.id===q.headers['x-qa-user'])||null;
  const express=(await import('express')).default;const {mountPortal}=await import('../server/portal/runtime.ts');const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
  const native=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(!String(url).startsWith(base+'/'))throw Error('External requests blocked');return native(url,options)};
  const request=async(path:string,body?:any,user='manager',origin=base)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'x-qa-user':user,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
  try{
   const initial=(await request('/api/crm/policy-config')).data;const body={base:{autoAssignment:initial.autoAssignment},patch:{autoAssignment:config.autoAssignment}};const path='/api/crm/policy-config/topics/assignment';
   assert.equal((await request(path,body,'a')).status,403);assert.equal((await request(path,body,'manager','https://invalid.example')).status,403);
   assert.equal((await request(path,{...body,patch:{autoAssignment:{...config.autoAssignment,strategy:'weighted'}}})).status,400);
   assert.equal((await request(path,body)).status,200);assert.equal((await request(path,body)).data.unchanged,true);
   assert.equal((await request(path,{...body,patch:{autoAssignment:{...config.autoAssignment,salesIds:['b']}}})).status,409);
   let cookie='',scope='';const visitor=async(path:string,b?:any)=>{const r=await fetch(base+path,{method:b?'POST':'GET',headers:{cookie,Origin:base,'Content-Type':'application/json',...(scope?{'X-Visitor-Scope':scope}:{})},body:b?JSON.stringify(b):undefined});for(const h of r.headers.getSetCookie())cookie=h.split(';')[0];const data=await r.json();if(data.cacheScope)scope=data.cacheScope;return {status:r.status,data}};
   await visitor('/api/portal/session');const profile={submissionId:'auto-assignment-registration-qa',fullName:'Sari Dewi',email:'sari.assignment@example.com',whatsapp:'+6281212345887',currentStatus:'Working professional',goal:'Improve my Mandarin skills',reportedLevel:'Complete beginner',levelState:'ZERO',city:'Jakarta',mode:'Online'};
   const registration=await visitor('/api/portal/register',profile);assert.equal(registration.status,200,JSON.stringify(registration.data));const id=registration.data.lead.id,assigned=await read(id);assert.ok(['a','b'].includes(assigned.owner));
   assert.equal((await visitor('/api/portal/register',profile)).status,200);assert.equal((await read(id)).owner,assigned.owner);assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM crm_facts WHERE lead_id=:p1 AND kind='owner.changed'",[id])).rows[0].n),1);
   assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n),0);
  }finally{globalThis.fetch=native;platform.authenticate=original;await new Promise<void>(r=>server.close(()=>r()));}
 });
 }finally{await pool.end();await disposeNativeTest(fixture)}
}
