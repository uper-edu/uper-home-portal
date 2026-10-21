import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupNativeTest} from './helpers/mysql.mjs';
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const fixture=await setupNativeTest('unread640');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store');const {hashPassword}=await import('../server/portal/localAuth');const {mountPortal}=await import('../server/portal/runtime');
 const express=(await import('express')).default;const app=express();app.use(express.json());await mountPortal(app);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>((r,j)=>{server.once('listening',r);server.once('error',j);});
 const base='http://127.0.0.1:'+(server.address() as any).port;
 const password='TEST-640-independent-password';const users=['test640-A','test640-B'];const lead='test640-shared';
 async function api(cookie:string,path:string,body?:any){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 await test('640 customer unread is per employee, independent of delivery, access-scoped and race-safe',async t=>{
 t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
 for(const id of users)await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,:p2,:p3,'[]')",[id,await hashPassword(password),JSON.stringify(['sales'])]);
 const login=async(id:string)=>{const r=await api('','/api/crm/auth/login',{loginId:id,password});assert.equal(r.status,200);return r.cookie!;};
 const a=await login(users[0]),b=await login(users[1]);
 await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[lead,{id:lead,fullName:'TEST 640 Shared',currentStage:'New',owner:null}]);
 await pool.query("INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES('visitor640',:p1,UTC_TIMESTAMP(6)+INTERVAL 1 day)",[lead]);
 await pool.query("INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES('conv640','visitor640',:p1,'TEST640')",[lead]);
 const message=async(id:string,role='user',status='saved',stamp='2026-10-01 10:00:00.123456')=>pool.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status,created_at) VALUES(:p1,'conv640',:p1,:p2,'TEST inquiry',:p3,:p4) ON DUPLICATE KEY UPDATE id=id",[id,role,status,stamp]);
 await message('first640');
 await pool.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data) VALUES('eng640',:p1,'message','first640','{}')",[lead]);
 await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,owner_id,status,due_at,original_due_at) VALUES('task640',:p1,'follow_up',:p2,'open','2027-12-02 10:00:00','2027-12-02 10:00:00')",[lead,users[0]]);
 const protectedState=async()=>JSON.stringify({tasks:(await pool.query('SELECT * FROM followup_tasks')).rows,rules:(await pool.query('SELECT * FROM notification_rules ORDER BY id')).rows,channels:(await pool.query('SELECT * FROM notification_channels ORDER BY id')).rows});const before=await protectedState();
 const list=async(cookie:string,unread=false)=>(await api(cookie,'/api/crm/leads?workScope=all&ownership=all'+(unread?'&unread=true':''))).data;
 const one=async(cookie:string)=>(await list(cookie)).leads.find((l:any)=>l.id===lead);
 const read=async(cookie:string,cutoff:string)=>api(cookie,'/api/crm/leads/'+lead+'/read',{readThrough:cutoff});
 await t.test('two Sales see a new shared inquiry even without any notification inbox',async()=>{
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_inbox')).rows[0].n),0);
  for(const cookie of [a,b]){const r=await list(cookie,true);assert.equal(r.stats.total,1);assert.equal(r.leads[0].attention.unreadCount,1);assert.equal(r.leads[0].attention.latest.type,'conversation.updated');assert.equal(r.leads[0].attention.pendingEngagements,1);}
 });
 const first=(await one(a)).attention.observedAt;
 await t.test('exact microsecond read, independent read marks and unchanged tasks/requests',async()=>{
  assert.equal(first,'2026-10-01T10:00:00.123456Z');assert.equal((await read(a,first)).status,200);
  assert.equal((await list(a,true)).stats.total,0);assert.equal((await list(b,true)).stats.total,1);
  assert.equal((await one(a)).attention.pendingEngagements,1);assert.equal(await protectedState(),before);
 });
 await t.test('later and concurrently committed messages survive the earlier watermark',async()=>{
  const lease=await fixture.connect();await lease.query('BEGIN');
  await lease.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status,created_at) VALUES('late640','conv640','late640','user','TEST late inquiry','saved','2026-10-01 10:00:00.123457')");
  assert.equal((await one(a)).attention.unreadCount,0);await read(a,first);await lease.query('COMMIT');lease.release();
  assert.equal((await one(a)).attention.unreadCount,1);assert.equal((await one(b)).attention.unreadCount,2);
  await read(a,first);assert.equal((await one(a)).attention.unreadCount,1);
  await message('late640');assert.equal((await one(a)).attention.unreadCount,1,'message retry is not duplicated');
  const newer=(await one(a)).attention.observedAt;await read(a,newer);await read(a,first);assert.equal((await one(a)).attention.unreadCount,0,'older read cannot move watermark backward');
 });
 await t.test('AI, staff edits and delivery state are not customer activity',async()=>{
  await message('assistant640','assistant','completed','2026-10-01 10:00:01');await message('failed640','user','failed','2026-10-01 10:00:02');
  for(const type of ['conversation.updated','ai.failed','notification.failed','task.overdue'])await pool.query('INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,:p2,:p3,:p4)',[type+'640',type,lead,{source:'crm'}]);
  assert.equal((await one(a)).attention.unreadCount,0);
  await pool.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot,state) VALUES('notice640','conversation.updated640','test',1,'inapp',:p1,UTC_TIMESTAMP(6),'{}','accepted')",[users[0]]);
  await pool.query("INSERT INTO notification_inbox(id,employee_id,content) VALUES('notice640',:p1,:p2)",[users[0],{leadId:lead,event:'conversation.updated'}]);
  assert.equal((await one(a)).attention.unreadCount,0,'receiving a staff notification adds no customer unread');
  await message('third640','user','saved','2026-10-01 10:00:03.654321');
  assert.equal((await api(a,'/api/crm/notifications/notice640/read',{})).status,200);
  assert.equal((await one(a)).attention.unreadCount,1,'reading notification does not read customer activity');assert.equal((await one(a)).attention.latest.type,'conversation.updated','unread badge describes the customer activity, not an unrelated failure');
 });
 await t.test('explicit requests and assessment are visible before notifications are processed',async()=>{
  for(const type of ['lead.created','assessment.completed','conversation.reactivated','handoff.requested','booking.requested','enrollment.requested'])await pool.query('INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,:p2,:p3,\'{}\')',[type+'640',type,lead]);
  assert.equal((await one(a)).attention.unreadCount,7);
  const detail=await api(a,'/api/crm/leads/'+lead);assert.equal(detail.status,200);assert.equal(detail.data.lead.attention.unreadCount,7,'deep links carry the same read watermark');
  await read(a,detail.data.lead.attention.observedAt);assert.equal((await one(a)).attention.unreadCount,0);
 });
 await t.test('snapshot excludes messages arriving after the listed content',async()=>{
  const cutoff=(await one(a)).attention.observedAt;
  await pool.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status,created_at) VALUES('last640','conv640','last640','user','TEST next','saved',UTC_TIMESTAMP(6)+INTERVAL 1 MICROSECOND)");
  const clipped=(await pool.leadAttention([users[0],[lead],cutoff])).rows[0];assert.equal(clipped.unread_count,0);
  await read(a,cutoff);assert.equal((await one(a)).attention.unreadCount,1);
 });
 await t.test('reassignment revokes access without clearing another Sales unread',async()=>{
  await pool.query('UPDATE portal_leads SET profile=JSON_SET(profile,\'$.owner\',:p1) WHERE id=:p2',[users[0],lead]);
  assert.equal((await list(b,true)).stats.total,0);assert.equal((await api(b,'/api/crm/leads/'+lead)).status,404);assert.equal((await read(b,first)).status,404);
  assert.ok((await one(a)).attention.unreadCount>0);
  await pool.query('UPDATE portal_leads SET profile=JSON_SET(profile,\'$.owner\',NULL) WHERE id=:p1',[lead]);
  assert.ok((await one(b)).attention.unreadCount>0);assert.equal(await protectedState(),before);
 });
 });
}
