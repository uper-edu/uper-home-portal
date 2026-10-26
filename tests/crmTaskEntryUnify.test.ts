import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';import{prepareTaskInput}from'../src/utils/crmTaskInput';
test('request-based new task needs no duplicated purpose or reason and preserves its source deadline',()=>{
 assert.deepEqual(prepareTaskInput({command:'create_request',action:'Confirm requested trial',purpose:'',reason:'',timing:'',date:''},'Asia/Jakarta'),{dueAt:undefined});
});
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('task_entry_unify');
 const {pool,tx}=await import('../server/portal/store.ts');const {taskCommand}=await import('../server/portal/trustWorkflow.ts');const{saveSalesWorkflow,validateWorkflow}=await import('../server/portal/salesWorkflow.ts');
 test('MySQL unified follow-up and request creation: optional notes, original expired SLA, retries and required change reasons',async t=>{
 t.after(()=>pool.end());const leadId='TEST-ENTRY-UNIFY',can=(p:any)=>p.owner==='Fadhil';await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[leadId,{id:leadId,owner:'Fadhil',tier:'Hot',tierConfirmed:true,currentStage:'Contacted',followUpLogs:[]}]);
 const originalId='TEST-ORIGINAL';await pool.query('INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,original_due_at,details) VALUES(:p1,:p2,:p3,:p4,:p5,:p5,:p6)',[originalId,leadId,'booking','Fadhil',new Date('2099-01-01T00:00:00Z'),{action:'历史任务',purpose:'历史原文'}]);const original=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[originalId])).rows[0];
 const workflow={requestId:randomUUID(),recordKind:'closure',summary:'TEST 安排下一步，不完成任务',disposition:'schedule',completeTaskIds:[],nextAction:'发送客户需要的课表',nextFollowUpAt:'2099-04-01T00:00:00Z',nextTaskChange:{command:'create',relationDecision:'separate'}};
 const first=await tx(c=>saveSalesWorkflow(c,leadId,'Fadhil',workflow,can));const retry=await tx(c=>saveSalesWorkflow(c,leadId,'Fadhil',workflow,can));assert.equal(retry.createdTaskId,first.createdTaskId);assert.equal(retry.replayed,true);
 const task=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[first.createdTaskId])).rows[0];assert.equal(task.details.purpose,undefined);
 const note='客户只在周末有空';await tx(c=>saveSalesWorkflow(c,leadId,'Fadhil',{...workflow,requestId:randomUUID(),nextTaskNotes:note},can));const facts=(await pool.query("SELECT data FROM crm_facts WHERE lead_id=:p1 AND kind='task.create'",[leadId])).rows;assert.ok(facts.some(f=>f.data.reason===note));assert.ok(facts.some(f=>f.data.reason===''));
 const reqId='TEST-REQUEST';await pool.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data,state) VALUES(:p1,:p2,'task_request',:p3,:p4,'pending')",[reqId,leadId,'original-message',{action:'booking',dueAt:'2020-01-01T00:00:00Z',messageId:'original-message',conversationId:'original-conversation',text:'客户原始试听请求'}]);const req=(await pool.query('SELECT * FROM crm_engagements WHERE id=:p1',[reqId])).rows[0];const body={command:'create_request',requestId:randomUUID(),requestEvidenceId:reqId,requestEvidenceVersion:req.version,action:'确认另一次试听'};const created=await tx(c=>taskCommand(c,leadId,'Fadhil',body,can));assert.equal((await tx(c=>taskCommand(c,leadId,'Fadhil',body,can))).newTaskId,created.newTaskId);
 const requestTask=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[created.newTaskId])).rows[0];assert.equal(new Date(requestTask.due_at).toISOString(),'2020-01-01T00:00:00.000Z');assert.equal(requestTask.details.purpose,undefined);assert.equal(requestTask.details.sourceMessageId,'original-message');
 for(const command of ['supplement','reschedule','replace'])assert.throws(()=>validateWorkflow({...workflow,requestId:randomUUID(),nextTaskChange:{command,taskId:originalId}}),/reason required/);
 assert.throws(()=>validateWorkflow({...workflow,requestId:randomUUID(),reviewPlan:{reason:'test',blockBefore:false}}),/reason required/);
 await assert.rejects(()=>tx(c=>taskCommand(c,leadId,'Fadhil',{...body,requestId:randomUUID()},()=>false)),/not found/i);
 assert.deepEqual((await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[originalId])).rows[0],original);
 assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM followup_tasks WHERE lead_id=:p1',[leadId])).rows[0].n),4);
 });
}
