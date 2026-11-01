import {test} from 'node:test';import assert from 'node:assert/strict';
import {setupNativeTest} from './helpers/mysql.mjs';import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {builtInRoles} from '../src/utils/accessControl.ts';
if(!process.env.MYSQL_NATIVE_TEST_ENV)test('inbox isolation requires approved temporary database',{skip:true},()=>{});else{
 const fixture=await setupNativeTest('inapp_inbox');const {pool,tx}=await import('../server/portal/store.ts');const {assignmentDirectory}=await import('../server/portal/autoAssignment.ts');const {listInbox,readInbox}=await import('../server/portal/inappInbox.ts');
 const notice=async(id:string,employee:string,leadId:string|null,event='task.overdue',payload:any={taskId:'task-a'},content:any={},state='accepted')=>{
  await pool.query('INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,:p2,:p3,:p4)',['event-'+id,event,leadId,payload]);
  await pool.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot,completed_at) VALUES(:p1,:p2,'qa',1,'inapp',:p3,:p4,'2030-01-01',:p5,'2030-01-01')",[id,'event-'+id,employee,state,{leadId,event,payload}]);
  await pool.query('INSERT INTO notification_inbox(id,employee_id,content) VALUES(:p1,:p2,:p3)',[id,employee,{leadId,...content}]);
 };
 try{
 for(const id of ['sales','crm_leader'])await pool.query('INSERT INTO access_roles(id,config) VALUES(:p1,:p2)',[id,builtInRoles[id]]);
 for(const id of ['a','b','manager'])await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,'synthetic',:p2,'[]')",[id,JSON.stringify([id==='manager'?'crm_leader':'sales'])]);
 const actors=await assignmentDirectory(pool),a=actors.find((e:any)=>e.id==='a'),b=actors.find((e:any)=>e.id==='b'),manager=actors.find((e:any)=>e.id==='manager');
 for(const owner of ['a','b']){await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',['lead-'+owner,{id:'lead-'+owner,name:owner==='a'?'Maya':'Arif',owner,team:'sales'}]);await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES(:p1,:p2,'consultation','2030-01-01')",['task-'+owner,'lead-'+owner]);}
 await notice('n1','a','lead-a');await notice('foreign','a','lead-b','task.overdue',{taskId:'task-b'});await notice('other','b','lead-b','task.overdue',{taskId:'task-b'});await notice('cross','a','lead-a','task.overdue',{taskId:'task-b'});await notice('missing','a','lead-a','task.overdue',{taskId:'deleted'});await notice('spoof','a','lead-a','task.overdue',{taskId:'task-a'},{leadId:'lead-b',name:'DO NOT USE THIS NAME'});await notice('pending','a','lead-a','task.overdue',{taskId:'task-a'},{},'pending');await notice('ops','manager',null,'notification.failed',{jobId:'n1'});
 await test('list and unread count are employee- and current-customer-scoped; snapshot identity wins over content',async()=>{
  const list=await tx(c=>listInbox(c,a));assert.equal(list.unreadCount,4);assert.equal(list.items.length,4);assert.ok(list.items.every((n:any)=>n.name==='Maya'));assert.equal(list.items.find((n:any)=>n.id==='cross').canOpen,false);assert.equal(list.items.find((n:any)=>n.id==='missing').canOpen,false);
  assert.equal((await tx(c=>listInbox(c,b))).unreadCount,1);assert.equal((await tx(c=>listInbox(c,manager))).unreadCount,1);
 });
 await test('read acknowledgement is isolated and idempotent; cross-customer and deleted targets do not mark read',async()=>{
  await assert.rejects(()=>tx(c=>readInbox(c,a,'other')),/unavailable/);await assert.rejects(()=>tx(c=>readInbox(c,manager,'n1')),/unavailable/);
  await assert.rejects(()=>tx(c=>readInbox(c,a,'cross',true)),/target_unavailable/);await assert.rejects(()=>tx(c=>readInbox(c,a,'missing',true)),/target_unavailable/);assert.equal((await tx(c=>listInbox(c,a))).unreadCount,4);
  const opened=await tx(c=>readInbox(c,a,'n1',true));const u=new URL(opened.url,'http://localhost');assert.equal(u.searchParams.get('lead'),'lead-a');assert.equal(u.searchParams.get('targetId'),'task-a');assert.equal(u.searchParams.get('target'),'task');
  assert.equal((await tx(c=>listInbox(c,a))).unreadCount,3);const first=(await pool.query("SELECT content FROM notification_inbox WHERE id='n1'")).rows[0].content;await tx(c=>readInbox(c,a,'n1'));assert.deepEqual((await pool.query("SELECT content FROM notification_inbox WHERE id='n1'")).rows[0].content,first);
 });
 await test('pagination is stable without duplicate items and count covers all visible unread records',async()=>{
  for(let i=0;i<55;i++)await notice('page-'+String(i).padStart(3,'0'),'a','lead-a');const p=await tx(c=>listInbox(c,a));assert.equal(p.items.length,50);assert.equal(p.unreadCount,58);const q=await tx(c=>listInbox(c,a,p.nextCursor));assert.equal(q.items.length,9);assert.equal(new Set([...p.items,...q.items].map((n:any)=>n.id)).size,59);
 });
 await test('failed read transaction rolls back; transferred customers and revoked permissions disappear',async()=>{
  await assert.rejects(()=>tx(async c=>{await readInbox(c,a,'spoof');throw Error('Synthetic failure')}));assert.equal((await tx(c=>listInbox(c,a))).unreadCount,58);
  await pool.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',['lead-a',{id:'lead-a',name:'Maya',owner:'b',team:'sales'}]);assert.equal((await tx(c=>listInbox(c,a))).unreadCount,0);await assert.rejects(()=>tx(c=>readInbox(c,a,'n1',true)),/unavailable/);
  await pool.query("UPDATE crm_users SET roles='[]' WHERE id='manager'");await assert.rejects(()=>tx(c=>listInbox(c,manager)),/forbidden/);await pool.query("UPDATE crm_users SET roles=:p1 WHERE id='manager'",['["crm_leader"]']);
 });
 await test('real HTTP endpoints enforce login/origin and read without producing notifications',async()=>{
  process.env.PLATFORM_MODE='mock';const {platform}=await import('../server/portal/identity.ts');const original=platform.authenticate;platform.authenticate=async(q:any)=>(await assignmentDirectory(pool)).find((e:any)=>e.id===q.headers['x-qa-user'])||null;const {mountPortal}=await import('../server/portal/runtime.ts');const express=(await import('express')).default;const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;const native=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(!String(url).startsWith(base+'/'))throw Error('External sends blocked');return native(url,options)};
  const req=async(path:string,user='b',post=false,origin=base)=>{const r=await fetch(base+'/api/crm/notifications/inbox'+path,{method:post?'POST':'GET',headers:{Origin:origin,'x-qa-user':user,'Content-Type':'application/json'},body:post?'{}':undefined});return {status:r.status,data:await r.json()}};
  try{const jobs=Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n);assert.equal((await req('','missing')).status,401);assert.equal((await req('/other/read','b',true,'https://invalid.example')).status,403);assert.equal((await req('/other/read','a',true)).status,404);assert.equal((await req('/other/read','b',true)).status,200);assert.equal((await req('?summary=1','b')).data.unreadCount,0);const ops=await req('/ops/open','manager',true);assert.equal(ops.status,200);assert.ok(ops.data.url.includes('job=n1'));assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n),jobs);}finally{platform.authenticate=original;globalThis.fetch=native;await new Promise<void>(r=>server.close(()=>r()));}
 });
 }finally{await pool.end();await disposeNativeTest(fixture)}
}
