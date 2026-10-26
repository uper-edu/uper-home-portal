import{test}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';
if(process.env.MYSQL_NATIVE_TEST_ENV)await test('first and revised task reminders, original deadlines and no historical arrival replay',async()=>{
const{setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('task_time_audit');process.env.PLATFORM_MODE='mock';
const{pool,tx}=await import('../server/portal/store.ts');const{taskCommand}=await import('../server/portal/trustWorkflow.ts');const{saveSalesWorkflow}=await import('../server/portal/salesWorkflow.ts');const{tick}=await import('../server/portal/worker.ts');const{defaults}=await import('../server/portal/policy.ts');
const group='TEST_TIME_SIMULATION',owner='test-sales';const initial='2099-08-02T02:00:00Z',original='2099-08-05T02:00:00Z',revised='2099-08-06T02:00:00Z';
try{
 await pool.query("INSERT INTO portal_settings(id,value) VALUES('sla',:p1)",[{...defaults,hotHours:1,warmHours:24,coldHours:72}]);await pool.query('INSERT INTO notification_channels(id,config) VALUES(:p1,:p2)',[group,{mode:'simulation',maxPerHour:10000}]);
 for(const event of ['task.created','task.rescheduled','task.appointment_due','task.overdue'])await pool.query("INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES(:p1,1,:p2,true,'2020-01-01')",['TEST-'+event,{...defaults,event,group,channels:['inapp','lark'],recipient:'owner',calendarMode:'custom',businessOnly:false,days:[0,1,2,3,4,5,6],start:'00:00',end:'23:59',dedupeMinutes:0,maxPerHour:10000,language:'zh',template:'TEST {{event}} | {{due}}'}]);
 const cases:any[]=[];
 async function create(label:string,timing:string,dueAt:string,review=false){const leadId='TEST-TIME-'+label;await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[leadId,{id:leadId,owner,fullName:leadId,tier:'Hot',tierConfirmed:true,currentStage:'Contacted',followUpLogs:[]}]);let taskId;
 if(review){const r=await tx(c=>saveSalesWorkflow(c,leadId,owner,{requestId:randomUUID(),recordKind:'closure',summary:'TEST 安排内部复查',disposition:'schedule',completeTaskIds:[],nextAction:'TEST 复查客户新情况',nextPurpose:'TEST 复查依据',nextFollowUpAt:dueAt,expectedArrangementVersion:0,reviewPlan:{version:0,reason:'TEST 稍后复查',blockBefore:false}},()=>true));taskId=r.createdTaskId;}
 else{const r=await tx(c=>taskCommand(c,leadId,owner,{requestId:randomUUID(),command:'create',relationDecision:'separate',action:'TEST '+label,timingKind:timing,dueAt},()=>true));taskId=r.newTaskId;}
 const row=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[taskId])).rows[0];cases.push({label,leadId,taskId,review,timing,originalTaskId:taskId,createdDue:row.due_at,createdScheduled:row.scheduled_at,createdTiming:row.timing_kind});return cases.at(-1);}
 for(const [label,timing]of [['response','response'],['appointment','appointment'],['generic-review','review']] as const){await create('initial-'+label,timing,initial);await create('rescheduled-'+label,timing,original);}
 await create('initial-contact-review','review',initial,true);await create('rescheduled-contact-review','review',original,true);
 async function drain(at:string){for(let i=0;i<100;i++){await tick(new Date(at));const n=Number((await pool.query("SELECT COUNT(*) n FROM notification_jobs WHERE state='pending' AND due_at<=:p1",[new Date(at)])).rows[0].n);if(!n)return;}throw Error('Simulation queue did not drain');}
 async function snapshot(label:string){return {label,tasks:(await pool.query('SELECT * FROM followup_tasks ORDER BY lead_id,id')).rows,events:(await pool.query('SELECT id,type,lead_id,payload FROM outbox ORDER BY created_at,id')).rows,jobs:(await pool.query('SELECT id,channel,state,result,snapshot FROM notification_jobs ORDER BY id')).rows,inbox:(await pool.query('SELECT id,employee_id,content FROM notification_inbox ORDER BY id')).rows};}
 await drain('2099-08-01T02:00:00Z');const created=await snapshot('created');
 // Reschedule before the original deadline; review agreements use their own explicit replacement flow.
 for(const v of cases.filter(c=>c.label.startsWith('rescheduled-'))){if(v.review){const p=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[v.leadId])).rows[0].profile;const r=await tx(c=>saveSalesWorkflow(c,v.leadId,owner,{requestId:randomUUID(),recordKind:'closure',summary:'TEST 修改复查安排',disposition:'schedule',completeTaskIds:[],nextAction:'TEST 新时间复查',nextPurpose:'TEST 复查时间调整依据',nextFollowUpAt:revised,expectedArrangementVersion:p.contactArrangement.version,reviewPlan:{version:p.contactArrangement.version,reason:'TEST 改复查时间',blockBefore:false}},()=>true));v.taskId=r.createdTaskId;}else{const row=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[v.taskId])).rows[0];await tx(c=>taskCommand(c,v.leadId,owner,{requestId:randomUUID(),command:'reschedule',taskId:v.taskId,revision:row.revision,reason:'TEST 明确调整执行时间',scheduledAt:revised},()=>true));}}
 await drain('2099-08-01T03:00:00Z');const rescheduled=await snapshot('rescheduled-before-due');
 await drain('2099-08-02T02:00:01Z');const firstDue=await snapshot('first-due');
 await drain('2099-08-05T02:00:01Z');const originalDue=await snapshot('original-due-after-reschedule');
 await drain('2099-08-06T02:00:01Z');const revisedDue=await snapshot('revised-due');const countBefore=revisedDue.events.filter(e=>e.type==='task.appointment_due').length;await drain('2099-08-06T02:01:01Z');const repeat=await snapshot('repeat');assert.equal(repeat.events.filter(e=>e.type==='task.appointment_due').length,countBefore,'Unexpected duplicate appointment event');
 for(const v of cases){
 const due=v.label.startsWith('initial-')?firstDue:revisedDue;
 const events=due.events.filter(e=>e.lead_id===v.leadId);
 const arrival=events.filter(e=>e.type==='task.appointment_due');
 assert.equal(arrival.length,v.label==='initial-response'?0:1,v.label+' arrival count');
 const overdue=due.jobs.filter(j=>j.snapshot.leadId===v.leadId&&j.snapshot.event==='task.overdue');
 assert.equal(overdue.filter(j=>j.state==='accepted').length,1,v.label+' overdue inapp');
 assert.equal(overdue.filter(j=>j.state==='simulated').length,1,v.label+' overdue lark mock');
 if(v.review){assert.equal(events.filter(e=>e.type==='task.created').length,1);assert.equal(events.filter(e=>e.type==='task.rescheduled').length,v.label.startsWith('rescheduled-')?1:0);}
 assert.ok(!due.jobs.some(j=>j.snapshot.leadId===v.leadId&&j.result==='Task completed'),v.label+' not falsely completed');
 }

 // Pending original-deadline alerts survive a second reschedule; obsolete schedule alerts do not.
 const target=cases.find(v=>v.label==='rescheduled-response');
 const task=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[target.taskId])).rows[0];
 for(const [id,event]of [['TEST-pending-deadline','task.overdue'],['TEST-pending-execution','task.appointment_due']]){
 await pool.query("INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES(:p1,:p2,:p3,:p4,UTC_TIMESTAMP(6))",[id+'-event',event,target.leadId,{}]);
 const job=revisedDue.jobs.find(j=>j.snapshot.leadId===target.leadId&&j.snapshot.event==='task.overdue'&&j.channel==='inapp');
 await pool.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) SELECT :p1,:p4,rule_id,version,channel,recipient,'pending',due_at,:p3 FROM notification_jobs WHERE id=:p2",[id,job.id,{...job.snapshot,event,payload:{...job.snapshot.payload,taskNoticeVersion:task.details.noticeRevision}},id+'-event']);
 }
 await tx(c=>taskCommand(c,target.leadId,owner,{requestId:randomUUID(),command:'reschedule',taskId:task.id,revision:task.revision,reason:'TEST second revision',scheduledAt:'2099-08-07T02:00:00Z'},()=>true));
 const pending=(await pool.query("SELECT id,state,result FROM notification_jobs WHERE id IN ('TEST-pending-deadline','TEST-pending-execution')")).rows;
 assert.equal(pending.find(j=>j.id==='TEST-pending-deadline').state,'pending');
 assert.equal(pending.find(j=>j.id==='TEST-pending-execution').result,'Task arrangement changed');
 // Existing unmarked first-time arrangements are not silently opted in.
 await pool.query("INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,timing_kind,details) VALUES('TEST-legacy-no-replay',:p1,'follow_up',:p2,'2099-08-01','appointment',:p3)",[target.leadId,owner,{}]);
 await drain('2099-08-06T03:00:00Z');
 assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM outbox WHERE type='task.appointment_due' AND payload->>'$.taskId'='TEST-legacy-no-replay'")).rows[0].n),0);
}finally{await pool.end();}

});
