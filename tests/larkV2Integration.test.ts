import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupNativeTest} from './helpers/mysql.mjs';
import {disposeNativeTest} from './helpers/disposeNativeTest.mjs';
import {defaults} from '../server/portal/policy.ts';
if(!process.env.MYSQL_NATIVE_TEST_ENV){test('Lark V2 integration requires approved isolated database',{skip:true},()=>{});}else{
 const fixture=await setupNativeTest('lark_v2');
 process.env.PLATFORM_MODE='mock'; process.env.LARK_TEST_GROUP='qa';process.env.TEST_LARK_V2='https://open.larksuite.com/open-apis/bot/v2/hook/fixture';
 const {pool}=await import('../server/portal/store.ts');const {tick}=await import('../server/portal/worker.ts');
 const native=globalThis.fetch;let cards:any[]=[];
 globalThis.fetch=async()=>{throw Error('Unexpected external request blocked');};
 try{
 const clock=new Date('2030-01-06T01:00:00Z');
 const reset=async()=>{cards=[];await fixture.reset('hsk_attempts,messages,ai_attempts,conversations,visitor_sessions,notification_jobs,notification_inbox,outbox,notification_rules,notification_channels,portal_leads,crm_facts,crm_engagements,crm_ai_extractions,followup_tasks,portal_audit');await pool.query("INSERT INTO portal_leads(id,profile) VALUES('lead-a',:p1)",[{id:'lead-a',fullName:'Maya Putri',owner:'test-admin'}]);await pool.query("INSERT INTO notification_channels(id,config) VALUES('qa',:p1)",[{mode:'simulation'}]);};
 const rule=async(event='lead.created',channels=['inapp','lark'],timing='immediate')=>{await pool.query("INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES('qa',1,:p1,true,'2020-01-01')",[{...defaults,language:'zh',event,channels,group:'qa',timing,dedupeMinutes:0}]);};
 const event=async(key:string,payload:any,type='lead.created')=>{await pool.query('INSERT INTO outbox(id,type,lead_id,payload,created_at) VALUES(:p1,:p2,\'lead-a\',:p3,:p4)',[key,type,payload,clock]);};
 await test('V2 queue gives immediate Sunday Lark; legacy pending event keeps Monday schedule',async()=>{
 await reset();await rule();await event('new',{notificationPolicyVersion:2});await event('old',{});await tick(clock);
 const rows=(await pool.query('SELECT event_id,channel,due_at,snapshot FROM notification_jobs ORDER BY event_id,channel')).rows;
 assert.equal(rows.length,4);
 const by=(e:string,c:string)=>rows.find(r=>r.event_id===e&&r.channel===c);
 assert.equal(by('new','lark').due_at.toISOString(),clock.toISOString());
 assert.equal(by('old','lark').due_at.toISOString(),'2030-01-07T02:00:00.000Z');
 assert.equal(by('new','inapp').due_at.toISOString(),clock.toISOString());
 });
 await test('Sunday daily aggregate creates Lark only and repeated planning does not duplicate',async()=>{
 await reset();await rule('daily.digest',['inapp','lark'],'digest');
 await tick(new Date('2030-01-06T12:00:00Z'));await tick(new Date('2030-01-06T12:00:00Z'));
 const rows=(await pool.query('SELECT channel FROM notification_jobs')).rows;
 assert.deepEqual(rows.map(r=>r.channel),['lark']);
 assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM outbox')).rows[0].n),1);
 });
 await test('actual V2 send builds safe standard card with linked questionnaire goal and localized labels',async()=>{
 await reset();await rule('lead.created',['lark']);
 await pool.query("INSERT INTO crm_facts(id,lead_id,kind,actor,data) VALUES('fact-a','lead-a','questionnaire.submitted','visitor',:p1)",[{answers:{goal:'Prepare for HSK certification',goals:['private text 08123456']}}]);
 await pool.query("UPDATE notification_channels SET config=:p1 WHERE id='qa'",[{mode:'live',secretRef:'TEST_LARK_V2'}]);
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),process.env.TEST_LARK_V2);cards.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({code:0}),{status:200});};
 await event('safe',{notificationPolicyVersion:2,questionnaireFactId:'fact-a'});await tick(clock);
 assert.equal(cards.length,1);const text=JSON.stringify(cards[0]);assert.ok(text.includes('客户问卷'));assert.ok(text.includes('学习目标'));assert.ok(!text.includes('private text'));assert.ok(text.includes('记录时间'));
 assert.equal((await pool.query('SELECT state FROM notification_jobs')).rows[0].state,'accepted');
 globalThis.fetch=async()=>{throw Error('Unexpected external request blocked');};
 });
 await test('missing assessment source cancels instead of announcing unverified completion',async()=>{
 await reset();await rule('assessment.completed',['lark']);
 await pool.query("UPDATE notification_channels SET config=:p1 WHERE id='qa'",[{mode:'live',secretRef:'TEST_LARK_V2'}]);
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No send allowed');};
 await event('missing',{notificationPolicyVersion:2,attemptId:'absent'},'assessment.completed');
 await tick(new Date('2030-01-06T12:00:00Z'));
 const row=(await pool.query('SELECT state,result FROM notification_jobs')).rows[0];
 assert.equal(calls,0);assert.equal(row.state,'cancelled');assert.equal(row.result,'Original source missing');
 });

 await test('six new V3 event cards use exact sources through the real worker; no real sends',async()=>{
 for(const kind of ['booking.requested','enrollment.requested','conversation.reactivated','task.overdue','ai.failed','notification.failed']){
  await reset();await rule(kind,['lark']);await pool.query("UPDATE notification_channels SET config=:p1 WHERE id='qa'",[{mode:'live',secretRef:'TEST_LARK_V2'}]);
  const payload:any={notificationPolicyVersion:2,notificationContentVersion:3};
  if(['booking.requested','enrollment.requested','ai.failed','conversation.reactivated'].includes(kind)){
   await pool.query("INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES('visitor-a','lead-a','2031-01-01')");
   await pool.query("INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES('conv-a','visitor-a','lead-a','standalone_chat')");
   payload.conversationId='conv-a';
  }
  if(kind==='booking.requested'||kind==='enrollment.requested'){
   await pool.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES('msg-a','conv-a','req-a','user','请确认周六课程安排。','saved')");
   await pool.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data,state) VALUES('evidence-a','lead-a','task_request','msg-a',:p1,'pending')",[{action:kind==='booking.requested'?'booking':'enrollment',conversationId:'conv-a',messageId:'msg-a'}]);payload.requestEvidenceId='evidence-a';
  }
  if(kind==='ai.failed'){await pool.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status,error) VALUES('ai-a','conv-a','req-a','assistant','','failed','SECRET RAW ERROR')");payload.messageId='ai-a';}
  if(kind==='task.overdue'){await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at) VALUES('task-a','lead-a','consultation','overdue','2030-01-05 01:00:00')");payload.taskId='task-a';}
  if(kind==='notification.failed'){
   await pool.query("INSERT INTO outbox(id,type,payload,created_at,processed_at) VALUES('parent','lead.created',:p1,:p2,:p2)",[{},clock]);
   await pool.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,state,snapshot,result,attempts) VALUES('failed-a','parent','qa',1,'lark','qa',:p1,'unknown',:p2,'SECRET RAW ERROR',2)",[clock,{event:'lead.created'}]);payload.jobId='failed-a';
  }
  globalThis.fetch=async(_url,options)=>{cards.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({code:0}),{status:200});};
  await event('new-v3',payload,kind);await tick(clock);
  assert.equal(cards.length,1,kind);const text=JSON.stringify(cards[0]);assert.ok(!text.includes('SECRET RAW ERROR'));assert.ok(!text.includes(kind));assert.ok(!text.includes('Unassigned'));
  if(kind==='booking.requested'||kind==='enrollment.requested')assert.ok(text.includes('请确认周六课程安排。'));
  if(kind==='notification.failed')assert.ok(text.includes('发送结果未确认'));
 }
 });
 await test('daily aggregation respects reporting date and scope, renders counts and deduplicates actual send',async()=>{
 await reset();await rule('daily.digest',['inapp','lark'],'digest');
 await pool.query("UPDATE portal_leads SET created_at='2030-01-06 01:00:00',profile=:p1 WHERE id='lead-a'",[{id:'lead-a',fullName:'Maya Putri',currentStage:'progress:discovery',tier:'A',entryPoint:'standalone_chat'}]);
 for(const [key,date,tier] of [['other-day','2030-01-05 01:00:00','A'],['other-tier','2030-01-06 01:00:00','B']])await pool.query('INSERT INTO portal_leads(id,business_number,created_at,profile) VALUES(:p1,:p1,:p2,:p3)',[key,date,{currentStage:'progress:discovery',tier,entryPoint:'standalone_chat'}]);
 await pool.query("UPDATE notification_rules SET config=:p1 WHERE id='qa'",[{...defaults,event:'daily.digest',channels:['inapp','lark'],group:'qa',timing:'digest',digestTime:'18:00',tiers:['A'],states:['progress:discovery'],sources:['standalone_chat'],dedupeMinutes:0}]);
 await pool.query("UPDATE notification_channels SET config=:p1 WHERE id='qa'",[{mode:'live',secretRef:'TEST_LARK_V2'}]);
 globalThis.fetch=async(_url,options)=>{cards.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({code:0}),{status:200});};
 await tick(new Date('2030-01-06T12:00:00Z'));await tick(new Date('2030-01-06T12:01:00Z'));
 assert.equal(cards.length,1);const text=cards[0].card.elements[0].text.content;assert.ok(text.includes('当日新增客户：1'));assert.ok(text.includes('需求沟通中：1'));assert.ok(text.includes('按本通知规则筛选'));assert.ok(!text.includes('"count"'));
 assert.deepEqual((await pool.query('SELECT channel FROM notification_jobs')).rows.map(v=>v.channel),['lark']);
 });
 await test('missing or cross-customer request cannot send the new request card',async()=>{
 await reset();await rule('booking.requested',['lark']);await pool.query("UPDATE notification_channels SET config=:p1 WHERE id='qa'",[{mode:'live',secretRef:'TEST_LARK_V2'}]);
 await pool.query("INSERT INTO portal_leads(id,profile) VALUES('lead-b',:p1)",[{fullName:'Arif Hidayat'}]);
 await pool.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data,state) VALUES('other-evidence','lead-b','task_request','other',:p1,'pending')",[{action:'booking'}]);
 globalThis.fetch=async()=>{throw Error('Cross-customer send forbidden');};
 await event('cross',{notificationPolicyVersion:2,notificationContentVersion:3,requestEvidenceId:'other-evidence'},'booking.requested');await tick(clock);
 assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM notification_jobs')).rows[0].n),0);
 });

 await test('assessment payload reads the exact stored result and customer; no total-score grade inference',async()=>{
 await reset();await rule('assessment.completed',['lark']);await pool.query("UPDATE notification_channels SET config=:p1 WHERE id='qa'",[{mode:'live',secretRef:'TEST_LARK_V2'}]);
 await pool.query("INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES('visitor-a','lead-a','2031-01-01')");
 const result={attempt:{mode:'full'},score:72,maxScore:100,thresholds:[{level:'HSK 1',reached:true}],sections:{listening:{correct:20,total:25},reading:{correct:16,total:25}},skippedCount:2};
 await pool.query("INSERT INTO hsk_attempts(id,visitor_id,lead_id,input_hash,attempt,result) VALUES('attempt-a','visitor-a','lead-a','hash',:p1,:p2)",[{mode:'full'},result]);
 globalThis.fetch=async(_url,options)=>{cards.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({code:0}),{status:200});};
 await event('assessment-source',{notificationPolicyVersion:2,attemptId:'attempt-a'},'assessment.completed');await tick(clock);
 assert.equal(cards.length,1);const text=cards[0].card.elements[0].text.content;assert.ok(text.includes('72 / 100'));assert.ok(text.includes('20/25'));assert.ok(text.includes('HSK 1'));assert.ok(!text.includes('HSK 2'));
 });
 }finally{globalThis.fetch=native;await pool.end();await disposeNativeTest(fixture);delete process.env.TEST_LARK_V2;}
}
