import {test} from 'node:test';import assert from 'node:assert/strict';
import {setupNativeTest} from './helpers/mysql.mjs';
import {defaultRules,CRM_BOT_CHANNEL,TASK_NOTICE_EVENTS} from '../server/portal/policy';
test('619 fresh task templates use CRM Bot without silently enabling stored policies',()=>{
 for(const event of TASK_NOTICE_EVENTS)assert.equal(defaultRules.find(r=>r.event===event)?.group,CRM_BOT_CHANNEL);
});
if(process.env.MYSQL_NATIVE_TEST_ENV){
 await setupNativeTest('task_notice619');process.env.PLATFORM_MODE='local';
 const {pool,tx}=await import('../server/portal/store');const {mountPortal}=await import('../server/portal/runtime');const {activateTaskNotifications}=await import('../server/portal/taskNotificationActivation');const {taskCommand}=await import('../server/portal/trustWorkflow');const {tick}=await import('../server/portal/worker');
 const express=(await import('express')).default;const app=express();app.use(express.json());await mountPortal(app);
 await test('619 explicit activation, three event types, routing and no historical replay',async t=>{
 t.after(()=>pool.end());
 const query=(sql:string,args:any[]=[])=>pool.query(sql,args);const taskRules=async()=>(await query('SELECT * FROM notification_rules WHERE id IN (:p1) ORDER BY id',[[...TASK_NOTICE_EVENTS]])).rows;
 const othersBefore=JSON.stringify((await query('SELECT * FROM notification_rules WHERE id NOT IN (:p1) ORDER BY id',[[...TASK_NOTICE_EVENTS]])).rows);
 await t.test('missing channel and preview cannot change rules',async()=>{
  const before=JSON.stringify(await taskRules());await assert.rejects(tx(c=>activateTaskNotifications(c,'TEST619',true)),/CRM Bot channel required/);assert.equal(JSON.stringify(await taskRules()),before);
  await query('INSERT INTO notification_channels(id,config) VALUES(:p1,:p2)',[CRM_BOT_CHANNEL,{mode:'simulation',maxPerHour:100}]);
  await tx(c=>activateTaskNotifications(c,'TEST619',false));assert.equal(JSON.stringify(await taskRules()),before);
 });
 const now=Date.now();const clock=new Date(now+10*60000);const originalDue=new Date(now+86400000);
 const owner=(await query("SELECT id FROM crm_users WHERE login_key='fadhil'")).rows[0].id;
 for(const [id,own] of [['owned619',owner],['shared619',null],['historical619',owner]])await query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[id,{id,fullName:'TEST '+id,owner:own,tier:'Hot',currentStage:'Contacted'}]);
 await query("INSERT INTO followup_tasks(id,lead_id,kind,status,due_at,original_due_at,scheduled_at) VALUES('old-task619','historical619','follow_up','open',:p1,:p1,:p2)",[originalDue,new Date(now-7200000)]);
 await query("INSERT INTO outbox(id,type,lead_id,payload,created_at) VALUES('old-event619','task.created','historical619',:p1,:p2)",[{taskId:'old-task619',source:'crm'},new Date(now-86400000)]);
 await query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot,result) VALUES('old-job619','old-event619','task.created',1,'lark','sales','failed',:p1,:p2,'TEST historical failure retained')",[new Date(now-86400000),{event:'task.created',rule:{group:'sales'},leadId:'historical619'}]);
 const oldJob=JSON.stringify((await query("SELECT * FROM notification_jobs WHERE id='old-job619'")).rows[0]);
 // Custom conditions and pacing must survive activation exactly.
 for(const r of await taskRules())await query('UPDATE notification_rules SET config=:p2 WHERE id=:p1',[r.id,{...r.config,group:'sales',calendarMode:'custom',timezone:'UTC',days:[0,1,2,3,4,5,6],start:'00:00',end:'23:59',sources:['crm'],tiers:['Hot'],states:['Contacted'],timing:'delay',delayMinutes:2,dedupeMinutes:3,maxPerHour:50,retries:[2,7]}]);
 const before=await taskRules();
 await t.test('transaction failure rolls back rule changes and versions',async()=>{
  const beforeState=JSON.stringify(await taskRules());await query("CREATE TRIGGER reject_task_notice619 BEFORE INSERT ON rule_versions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST activation rollback619'");
  await assert.rejects(tx(c=>activateTaskNotifications(c,'TEST619',true)),/rollback619/);await query('DROP TRIGGER reject_task_notice619');assert.equal(JSON.stringify(await taskRules()),beforeState);
 });
 await t.test('activation preserves all other fields and is idempotent',async()=>{
  const result=await tx(c=>activateTaskNotifications(c,'TEST619',true));assert.equal(result.filter((r:any)=>r.applied).length,3);
  const after=await taskRules();for(const r of after){const prev=before.find((x:any)=>x.id===r.id);assert.equal(r.enabled,true);assert.equal(r.version,prev.version+1);assert.deepEqual(r.config,{...prev.config,group:CRM_BOT_CHANNEL});assert.ok(r.effective_at>prev.effective_at);}
  const snapshot=JSON.stringify(after);assert.equal((await tx(c=>activateTaskNotifications(c,'TEST619',true))).filter((r:any)=>r.applied).length,0);assert.equal(JSON.stringify(await taskRules()),snapshot);
  assert.equal(JSON.stringify((await query('SELECT * FROM notification_rules WHERE id NOT IN (:p1) ORDER BY id',[[...TASK_NOTICE_EVENTS]])).rows),othersBefore);
 });
 const create=async(id:string,requestId:string)=>tx(c=>taskCommand(c,id,'TEST619',{requestId,command:'create',reason:'TEST simulated task',action:'TEST send schedule',purpose:'TEST notification verification',timingKind:'appointment',dueAt:originalDue.toISOString()},()=>true));
 const owned=await create('owned619','create-owned619');const shared=await create('shared619','create-shared619');
 await t.test('new and shared tasks notify Owner or Managers using unchanged route',async()=>{
  for(let i=0;i<15;i++)await tick(clock);
  const jobs=(await query("SELECT * FROM notification_jobs WHERE snapshot->>'$.leadId' IN ('owned619','shared619') ORDER BY id")).rows;
  assert.ok(jobs.some((j:any)=>j.channel==='inapp'&&j.snapshot.leadId==='owned619'&&j.recipient===owner&&j.state==='accepted'));
  const fallback=jobs.filter((j:any)=>j.channel==='inapp'&&j.snapshot.leadId==='shared619');assert.ok(fallback.length>0);const sales=(await query("SELECT id FROM crm_users WHERE login_key='wigar'")).rows[0].id;assert.ok(fallback.every((j:any)=>j.recipient!==owner&&j.recipient!==sales&&j.snapshot.routingReason==='unassigned_to_crm_leader'));
  assert.equal(jobs.filter((j:any)=>j.channel==='lark').length,2);assert.ok(jobs.filter((j:any)=>j.channel==='lark').every((j:any)=>j.recipient===CRM_BOT_CHANNEL&&j.state==='simulated'));
  assert.equal(JSON.stringify((await query("SELECT * FROM notification_jobs WHERE id='old-job619'")).rows[0]),oldJob);
  assert.equal(Number((await query("SELECT COUNT(*) AS n FROM notification_jobs WHERE event_id='old-event619'")).rows[0].n),1,'old event creates no new delivery');
  assert.equal(Number((await query("SELECT COUNT(*) AS n FROM notification_jobs WHERE snapshot->>'$.leadId'='historical619' AND snapshot->>'$.event'='task.appointment_due'")).rows[0].n),0,'missed appointment before rule activation is not replayed');
 });
 await t.test('reschedule and appointment due each produce one event and simulated delivery',async()=>{
  const task=(await query('SELECT * FROM followup_tasks WHERE id=:p1',[owned.taskId])).rows[0];const body={requestId:'reschedule619',command:'reschedule',taskId:task.id,revision:task.revision,reason:'TEST confirmed appointment',scheduledAt:new Date(now+5*60000).toISOString()};
  await tx(c=>taskCommand(c,'owned619','TEST619',body,()=>true));await tx(c=>taskCommand(c,'owned619','TEST619',body,()=>true));
  for(let i=0;i<12;i++)await tick(clock);
  const jobs=(await query("SELECT * FROM notification_jobs WHERE snapshot->>'$.leadId'='owned619' AND snapshot->>'$.event' IN ('task.rescheduled','task.appointment_due')")).rows;
  for(const event of ['task.rescheduled','task.appointment_due']){assert.equal(jobs.filter((j:any)=>j.snapshot.event===event&&j.channel==='lark'&&j.state==='simulated').length,1);assert.equal(jobs.filter((j:any)=>j.snapshot.event===event&&j.channel==='inapp'&&j.recipient===owner&&j.state==='accepted').length,1);}
  const updated=(await query('SELECT * FROM followup_tasks WHERE id=:p1',[owned.taskId])).rows[0];assert.equal(updated.status,'open');assert.equal(updated.due_at.toISOString(),originalDue.toISOString());assert.equal(updated.original_due_at.toISOString(),originalDue.toISOString());
 });
 await t.test('stale task notice revision is cancelled, not sent',async()=>{
  const task=(await query('SELECT * FROM followup_tasks WHERE id=:p1',[shared.taskId])).rows[0];await tx(c=>taskCommand(c,'shared619','TEST619',{requestId:'reschedule-shared619',command:'reschedule',taskId:task.id,revision:task.revision,reason:'TEST review',scheduledAt:new Date(now+86400000).toISOString()},()=>true));
  await tick(new Date(now+1000)); // queued, Lark still respects delay
  await query("UPDATE followup_tasks SET details=JSON_SET(details,'$.noticeRevision',2) WHERE id=:p1",[shared.taskId]);
  for(let i=0;i<12;i++)await tick(clock);
  const jobs=(await query("SELECT * FROM notification_jobs WHERE snapshot->>'$.leadId'='shared619' AND snapshot->>'$.event'='task.rescheduled' AND channel='lark'")).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].state,'cancelled');
 });
 });
}
