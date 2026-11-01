import {test} from 'node:test';import assert from 'node:assert/strict';
import {setupNativeTest} from './helpers/mysql.mjs';import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {builtInRoles} from '../src/utils/accessControl.ts';import {DEFAULT_CRM_POLICY_CONFIG as defaults} from '../src/types/crmPolicyConfig.ts';
if(!process.env.MYSQL_NATIVE_TEST_ENV)test('backfill requires approved isolated database',{skip:true},()=>{});else{
 const fixture=await setupNativeTest('assignment_backfill');const {pool,tx}=await import('../server/portal/store.ts');
 const {assignmentDirectory}=await import('../server/portal/autoAssignment.ts');const {previewBackfill,confirmBackfill,backfillResult}=await import('../server/portal/assignmentBackfill.ts');
 const config={...structuredClone(defaults),autoAssignment:{enabled:false,strategy:'round_robin',salesIds:['a','b']}};
 const makeLead=async(id:string,extra:any={})=>pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[id,{id,name:'Maya Putri',owner:null,team:'sales',submittedAt:'2020-01-01',tier:'Cold',...extra}]);
 const read=async(id:string)=>(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[id])).rows[0].profile;
 let actor:any,other:any;
 const preview=()=>tx(c=>previewBackfill(c,actor,{configuration:config.autoAssignment}));
 try{
 for(const id of ['sales','crm_leader'])await pool.query('INSERT INTO access_roles(id,config) VALUES(:p1,:p2)',[id,builtInRoles[id]]);
 for(const id of ['a','b','manager','other'])await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,'synthetic',:p2,'[]')",[id,JSON.stringify([['a','b'].includes(id)?'sales':'crm_leader'])]);
 const directory=await assignmentDirectory(pool);actor=directory.find((e:any)=>e.id==='manager');other=directory.find((e:any)=>e.id==='other');
 await pool.query("INSERT INTO portal_settings(id,value) VALUES('crm_policy',:p1)",[config]);await pool.query("INSERT INTO portal_settings(id,value) VALUES('crm_assignment_cursor',:p1)",[{lastEmployeeId:'b'}]);
 for(const id of ['h1','h2','h3'])await makeLead(id);await makeLead('pending',{identityLifecycle:'pending'});await makeLead('owned',{owner:'b'});await makeLead('merged',{identityMergedInto:'owned'});
 await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES('original-task','h2','consultation','2020-01-02')");
 await test('preview is read-only, excludes pending/owned/merged identities and shows round-robin destinations',async()=>{
  const before=JSON.stringify((await pool.query('SELECT * FROM portal_leads ORDER BY id')).rows),p=await preview();assert.equal(p.total,3);assert.deepEqual(p.rows.map((r:any)=>r.ownerId),['a','b','a']);assert.equal(p.confirmable,true);assert.equal(JSON.stringify((await pool.query('SELECT * FROM portal_leads ORDER BY id')).rows),before);assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM crm_operations')).rows[0].n),0);
 });
 await test('confirmation skips a claimed customer, preserves deadline and persists an idempotent receipt',async()=>{
  const p=await preview();await pool.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',['h1',{...await read('h1'),owner:'manager'}]);
  const results=await Promise.all([tx(c=>confirmBackfill(c,actor,p.token)),tx(c=>confirmBackfill(c,actor,p.token))]);assert.deepEqual(results[0],results[1]);assert.equal(results[0].assigned,2);assert.equal(results[0].skipped,1);assert.equal((await read('h2')).owner,'b');assert.equal((await read('h3')).owner,'a');assert.equal((await read('h2')).tier,'Cold');
  const task=(await pool.query("SELECT * FROM followup_tasks WHERE id='original-task'")).rows[0];assert.equal(new Date(task.due_at).toISOString(),'2020-01-02T00:00:00.000Z');assert.equal(task.owner_id,'b');assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM crm_facts WHERE kind='owner.changed'")).rows[0].n),2);
  assert.equal((await tx(c=>backfillResult(c,actor,p.id))).assigned,2);await assert.rejects(()=>tx(c=>backfillResult(c,other,p.id)),/missing/);await assert.rejects(()=>tx(c=>confirmBackfill(c,other,p.token)),/forbidden/);
 });
 await makeLead('h4');
 await test('stale settings, changed rotation, tampered and expired previews are rejected without assigning',async()=>{
  let p=await preview();await pool.query("UPDATE portal_settings SET value=:p1 WHERE id='crm_policy'",[{...config,autoAssignment:{...config.autoAssignment,salesIds:['b','a']}}]);await assert.rejects(()=>tx(c=>confirmBackfill(c,actor,p.token)),/settings_changed/);await pool.query("UPDATE portal_settings SET value=:p1 WHERE id='crm_policy'",[config]);
  p=await preview();await pool.query("UPDATE portal_settings SET value=:p1 WHERE id='crm_assignment_cursor'",[{lastEmployeeId:'b'}]);await assert.rejects(()=>tx(c=>confirmBackfill(c,actor,p.token)),/rotation_changed/);
  p=await preview();await assert.rejects(()=>tx(c=>confirmBackfill(c,actor,p.token+'x')),/invalid/);const clock=Date.now;Date.now=()=>p.expiresAt+1;try{await assert.rejects(()=>tx(c=>confirmBackfill(c,actor,p.token)),/expired/)}finally{Date.now=clock}assert.equal((await read('h4')).owner,null);
 });
 await test('revoked participant is skipped; revoked manager cannot apply or query',async()=>{
  const p=await preview();await pool.query("UPDATE crm_users SET active=false WHERE id='a'");const r=await tx(c=>confirmBackfill(c,actor,p.token));assert.equal(r.assigned,0);assert.equal(r.skipped,1);await pool.query("UPDATE crm_users SET active=true WHERE id='a'");
  const q=await preview();await pool.query("UPDATE crm_users SET roles='[]' WHERE id='manager'");await assert.rejects(()=>tx(c=>confirmBackfill(c,actor,q.token)),/forbidden/);await assert.rejects(()=>tx(c=>backfillResult(c,actor,p.id)),/forbidden/);await pool.query("UPDATE crm_users SET roles=:p1 WHERE id='manager'",['["crm_leader"]']);
 });
 await test('transaction failure rolls back owners, facts, cursor and receipt; no notification is generated',async()=>{
  const p=await preview(),before=(await pool.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor'")).rows[0].value;
  const count=Number((await pool.query('SELECT COUNT(*) n FROM crm_facts')).rows[0].n);await assert.rejects(()=>tx(async c=>{await confirmBackfill(c,actor,p.token);throw Error('Synthetic failure after receipt')}));assert.equal((await read('h4')).owner,null);assert.deepEqual((await pool.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor'")).rows[0].value,before);assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM crm_facts')).rows[0].n),count);await assert.rejects(()=>tx(c=>backfillResult(c,actor,p.id)),/missing/);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM outbox')).rows[0].n),0);assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n),0);
 });

 await test('HTTP preview/confirm/results enforce origin, actor isolation and query-only lost-response recovery',async()=>{
  process.env.PLATFORM_MODE='mock';const {platform}=await import('../server/portal/identity.ts');const auth=platform.authenticate;platform.authenticate=async(q:any)=>(await assignmentDirectory(pool)).find((e:any)=>e.id===q.headers['x-qa-user'])||null;
  const express=(await import('express')).default;const {mountPortal}=await import('../server/portal/runtime.ts');const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
  const native=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(!String(url).startsWith(base+'/'))throw Error('External requests blocked');return native(url,options)};
  const req=async(path:string,body?:any,user='manager',origin=base)=>{const r=await fetch(base+'/api/crm/assignment-backfill/'+path,{method:body?'POST':'GET',headers:{'x-qa-user':user,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()}};
  try{const body={configuration:config.autoAssignment};assert.equal((await req('preview',body,'missing')).status,401);assert.equal((await req('preview',body,'a')).status,403);assert.equal((await req('preview',body,'manager','https://invalid.example')).status,403);
   const p=await req('preview',body);assert.equal(p.status,200);assert.equal((await req('confirm',{token:p.data.token},'other')).status,403);
   const applied=await req('confirm',{token:p.data.token});assert.equal(applied.status,200);const recovered=await req('results/'+p.data.id);assert.equal(recovered.status,200);assert.deepEqual(recovered.data,applied.data);assert.equal((await req('results/'+p.data.id,undefined,'other')).status,404);assert.deepEqual((await req('confirm',{token:p.data.token})).data,recovered.data);
   assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n),0);
  }finally{globalThis.fetch=native;platform.authenticate=auth;await new Promise<void>(r=>server.close(()=>r()));}
 });
 }finally{await pool.end();await disposeNativeTest(fixture)}
}
