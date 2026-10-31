import test from 'node:test';import assert from 'node:assert/strict';
import {setupNativeTest} from './helpers/mysql.mjs';import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
if(!process.env.MYSQL_NATIVE_TEST_ENV){test('notification targets require approved isolated database',{skip:true},()=>{});}else{
 const fixture=await setupNativeTest('notification_targets');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store');const {hashPassword}=await import('../server/portal/localAuth');const {mountPortal}=await import('../server/portal/runtime');const express=(await import('express')).default;
 const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 const native=globalThis.fetch;globalThis.fetch=async(url,opts)=>{if(!String(url).startsWith(base+'/'))throw Error('External notification/network blocked');return native(url,opts);};
 async function api(cookie:string,path:string,body?:any){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
 await test('exact notification targets: real roles, cross-customer and missing records, older source and merged identity',async t=>{
  t.after(async()=>{globalThis.fetch=native;await new Promise<void>(r=>server.close(()=>r()));await pool.end();await disposeNativeTest(fixture);});
  const cookies:Record<string,string>={};
  for(const [id,role]of [['owner','sales'],['other','sales'],['cms','cms_admin']]){await pool.query("INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,:p2,:p3,'[]')",[id,await hashPassword('TEST isolated only'),JSON.stringify([role])]);const r=await api('','/api/crm/auth/login',{loginId:id,password:'TEST isolated only'});assert.equal(r.status,200);cookies[id]=r.cookie;}
  for(const [id,owner,extra]of [['a','owner',{}],['b','other',{}],['alias','owner',{identityMergedInto:'a'}]] as const)await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[id,{id,owner,fullName:id,...extra}]);
  for(const id of ['a','b','alias']){await pool.query("INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES(:p1,:p2,'2099-01-01')",['v-'+id,id]);for(const suffix of ['old','new'])await pool.query("INSERT INTO hsk_attempts(id,visitor_id,lead_id,input_hash,attempt,result) VALUES(:p1,:p2,:p3,'fixture','{}','{}')",[id+'-'+suffix,'v-'+id,id]);}
  const route=(lead:string,ref:string)=>'/api/crm/leads/'+lead+'/notification-target?kind=assessment&ref='+ref;
  assert.equal((await api('',route('a','a-old'))).status,401);
  assert.equal((await api(cookies.cms,route('a','a-old'))).status,403);
  assert.equal((await api(cookies.other,route('a','a-old'))).status,404);
  assert.equal((await api(cookies.owner,route('a','b-old'))).status,404);
  assert.equal((await api(cookies.owner,route('a','missing'))).status,404);
  const exact=await api(cookies.owner,route('a','a-old'));assert.equal(exact.status,200);assert.equal(exact.data.assessmentId,'a-old');assert.equal(exact.data.leadId,'a');
  const merged=await api(cookies.owner,route('alias','alias-old'));assert.equal(merged.status,200);assert.equal(merged.data.leadId,'a');assert.equal(merged.data.assessmentId,'alias-old');
  assert.equal((await api(cookies.owner,route('a','a-old').replace('kind=assessment','kind=invalid'))).status,400);
  await pool.query("INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES('conv-a','v-a','a','standalone_chat')");await pool.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES('msg-a','conv-a','req-a','user','模拟顾问请求原文','saved')");
  await pool.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data) VALUES('request-a','a','task_request','req-a',:p1)",[{conversationId:'conv-a',messageId:'req-a'}]);
  const request=await api(cookies.owner,'/api/crm/leads/a/notification-target?kind=request&ref=request-a');assert.equal(request.status,200);assert.equal(request.data.historyId,'message:msg-a');assert.equal(request.data.tab,'activities');assert.equal(request.data.messageId,'msg-a');assert.equal(request.data.conversationId,'conv-a');
  await pool.query("DELETE FROM messages WHERE id='msg-a'");assert.equal((await api(cookies.owner,'/api/crm/leads/a/notification-target?kind=request&ref=request-a')).status,404);
 });
}
