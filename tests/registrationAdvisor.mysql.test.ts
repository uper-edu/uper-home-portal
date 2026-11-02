import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import express from 'express';
import {setupNativeTest} from './helpers/mysql.mjs';import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
if(!process.env.MYSQL_NATIVE_TEST_ENV)test('registration advisor receipts require approved isolated MySQL',{skip:'Synthetic isolated database only'},()=>{});
else{
 const fixture=await setupNativeTest('ga_advisor');process.env.PLATFORM_MODE='local';
 const {pool}=await import('../server/portal/store');const {mountPortal}=await import('../server/portal/runtime');
 await test('anonymous advisor registration receipts preserve evidence, scope and atomicity',async t=>{
  const app=express();app.use(express.json());await mountPortal(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+(server.address()as any).port;
  t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();await disposeNativeTest(fixture);});
  function client(){let cookie='',scope='';return async(path:string,body?:any,override?:string)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,Origin:base,'Content-Type':'application/json',...(scope?{'X-Visitor-Scope':override||scope}:{})},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie())cookie=c.split(';')[0];const data=await r.json();if(data.cacheScope)scope=data.cacheScope;return{status:r.status,data};};}
  let contact=0;const profile=()=>({submissionId:randomUUID(),fullName:'Sari Wulandari',whatsapp:'+628121235'+String(++contact).padStart(4,'0'),email:'sari-'+contact+'@ga.example.invalid'});
  const anonymous=async(action='handoff')=>{const call=client();await call('/api/portal/session');const c=await call('/api/portal/conversations',{source:'homepage_widget'}),messageId=randomUUID(),content='原始隔离验收请求，请安排顾问联系我。';const r=await call('/api/portal/actions',{conversationId:c.data.conversationId,messageId,content,action,language:'zh'});assert.equal(r.status,200);assert.equal(r.data.status,'contact_required');return{call,conversationId:c.data.conversationId,messageId,content};};
  const count=async(sql:string,params:any[]=[])=>Number((await pool.query(sql,params)).rows[0].n);
  await t.test('newly attached request survives duplicate submission and result query, with no extra tasks or events',async()=>{
   const a=await anonymous(),p=profile();const saved=await a.call('/api/portal/register',p);assert.equal(saved.status,200);
   const receipt=saved.data.advisorRequests;assert.deepEqual(receipt,[{leadId:saved.data.lead.id,messageId:a.messageId,action:'handoff',status:'awaiting_advisor',taskOperation:'recorded'}]);
   const replies=await Promise.all(Array.from({length:5},()=>a.call('/api/portal/register',p)));for(const r of replies){assert.equal(r.status,200);assert.deepEqual(r.data.advisorRequests,receipt);}
   const read=await a.call('/api/portal/registrations/'+p.submissionId);assert.equal(read.status,200);assert.deepEqual(read.data.advisorRequests,receipt);
   const leadId=saved.data.lead.id;assert.equal(await count("SELECT COUNT(*) n FROM crm_facts WHERE lead_id=:p1 AND kind='task.request_evidence'",[leadId]),1);assert.equal(await count("SELECT COUNT(*) n FROM outbox WHERE lead_id=:p1 AND type='handoff.requested'",[leadId]),1);assert.equal(await count('SELECT COUNT(*) n FROM followup_tasks WHERE lead_id=:p1',[leadId]),1);
   const raw=(await pool.query("SELECT content FROM messages WHERE conversation_id=:p1 AND request_id=:p2 AND role='user'",[a.conversationId,a.messageId])).rows;assert.equal(raw[0].content,a.content);
   const other=client();await other('/api/portal/session');assert.equal((await other('/api/portal/registrations/'+p.submissionId)).status,404);assert.equal((await a.call('/api/portal/registrations/'+p.submissionId,undefined,'stale-scope')).status,409);
   assert.equal((await a.call('/api/portal/register',{...p,fullName:'Different'})).status,409);
   const next=await a.call('/api/portal/register',{...p,submissionId:randomUUID()});assert.equal(next.status,200);assert.deepEqual(next.data.advisorRequests,[]);assert.equal(await count("SELECT COUNT(*) n FROM outbox WHERE lead_id=:p1 AND type='handoff.requested'",[leadId]),1);
  });
  await t.test('registration without a request cannot inject an advisor conversion',async()=>{
   const call=client();await call('/api/portal/session');const r=await call('/api/portal/register',{...profile(),advisorRequests:[{action:'handoff',messageId:'fake'}]});assert.equal(r.status,200);assert.deepEqual(r.data.advisorRequests,[]);assert.equal(await count("SELECT COUNT(*) n FROM crm_facts WHERE lead_id=:p1 AND kind='task.request_evidence'",[r.data.lead.id]),0);
  });
  await t.test('booking and enrollment requests retain their own business evidence without being counted as advisor requests',async()=>{
   for(const action of ['booking','enrollment']){const a=await anonymous(action),r=await a.call('/api/portal/register',profile());assert.equal(r.status,200);assert.deepEqual(r.data.advisorRequests,[]);assert.equal(await count("SELECT COUNT(*) n FROM crm_facts WHERE lead_id=:p1 AND kind='task.request_evidence'",[r.data.lead.id]),1);}
  });
  await t.test('failed registration rolls back request evidence and produces no conversion receipt; retry commits once',async()=>{
   const a=await anonymous(),p=profile(),tables=['portal_leads','crm_facts','outbox','followup_tasks','site_submissions'];const snapshot=async()=>Promise.all(tables.map(table=>count('SELECT COUNT(*) n FROM '+table)));const before=await snapshot();
   await pool.query("CREATE TRIGGER ga_advisor_receipt_failure BEFORE INSERT ON site_submissions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST advisor rollback'");
   try{const r=await a.call('/api/portal/register',p);assert.equal(r.status,503);assert.equal(r.data.saved,undefined);assert.equal(r.data.advisorRequests,undefined);assert.deepEqual(await snapshot(),before);assert.equal((await a.call('/api/portal/registrations/'+p.submissionId)).status,404);}finally{await pool.query('DROP TRIGGER ga_advisor_receipt_failure');}
   const saved=await a.call('/api/portal/register',p);assert.equal(saved.status,200);assert.equal(saved.data.advisorRequests.length,1);
  });
 });
}
