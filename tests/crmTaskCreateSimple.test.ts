import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';
if(process.env.MYSQL_NATIVE_TEST_ENV){
 const {setupNativeTest}=await import('./helpers/mysql.mjs');await setupNativeTest('simple_task_create');
 const {pool,tx}=await import('../server/portal/store.ts');const {taskCommand}=await import('../server/portal/trustWorkflow.ts');
 test('MySQL task creation without purpose or notes preserves history, idempotency, deadlines and change reasons',async t=>{
  t.after(()=>pool.end());const leadId='TEST-SIMPLE-TASK',can=(p:any)=>p.owner==='Fadhil';
  await pool.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)',[leadId,{id:leadId,owner:'Fadhil',currentStage:'Contacted',tier:'Hot',tierConfirmed:true}]);
  await pool.query('INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,original_due_at,details) VALUES(:p1,:p2,:p3,:p4,:p5,:p5,:p6)',['original',leadId,'follow_up','Fadhil',new Date('2099-01-01T00:00:00Z'),{action:'历史原文动作',purpose:'历史原文用途',additions:[{text:'历史依据原文'}]}]);
  const original=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',['original'])).rows[0];
  const save=(body:any)=>tx(c=>taskCommand(c,leadId,'Fadhil',body,can));
  const body={command:'create',requestId:randomUUID(),relationDecision:'separate',action:'发送客户需要的课表',timingKind:'response',dueAt:'2099-02-01T00:00:00Z'};
  const first=await save(body);for(let i=0;i<3;i++)assert.equal((await save(body)).newTaskId,first.newTaskId);
  const task=(await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',[first.newTaskId])).rows[0];assert.equal(task.details.action,body.action);assert.equal(task.details.purpose,undefined);assert.equal(task.owner_id,'Fadhil');
  const fact=(await pool.query("SELECT data FROM crm_facts WHERE lead_id=:p1 AND kind='task.create'",[leadId])).rows[0];assert.equal(fact.data.reason,'');assert.equal(fact.data.purpose,undefined);
  const noted=await save({...body,requestId:randomUUID(),reason:'客户要求周六上午，保留原文'});assert.ok(noted.newTaskId);
  for(const command of ['cancel','replace','reschedule'])await assert.rejects(()=>save({...body,requestId:randomUUID(),command,taskId:'original',revision:original.revision,sameMatterConfirmed:true,purpose:'replacement',scheduledAt:'2099-03-01T00:00:00Z'}),/reason required/);
  await assert.rejects(()=>save({...body,requestId:randomUUID(),action:''}),/task content/);
  await assert.rejects(()=>save({...body,requestId:randomUUID(),dueAt:'2000-01-01T00:00:00Z'}),/future time/);
  await assert.rejects(()=>save({...body,requestId:randomUUID(),reason:{invalid:true}}),/reason required/);
  assert.deepEqual((await pool.query('SELECT * FROM followup_tasks WHERE id=:p1',['original'])).rows[0],original);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM followup_tasks WHERE lead_id=:p1',[leadId])).rows[0].n),3);
 });
}
