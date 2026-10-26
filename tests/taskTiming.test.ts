import{test}from'node:test';import assert from'node:assert/strict';import{executionTime,taskNoticeCancellation,timingEventLabel}from'../server/portal/taskTiming';
test('task timing preserves deadlines while invalidating old execution arrangements',()=>{
 const task={status:'overdue',timing_kind:'review',due_at:'2099-08-02T02:00:00Z',scheduled_at:'2099-08-03T02:00:00Z',details:{noticeRevision:2,timeReminderVersion:1}};
 assert.equal(taskNoticeCancellation(task,'task.overdue',{taskNoticeVersion:0}),null);
 assert.equal(taskNoticeCancellation(task,'task.appointment_due',{taskNoticeVersion:1}),'Task arrangement changed');
 assert.equal(taskNoticeCancellation(task,'task.appointment_due',{taskNoticeVersion:2}),null);
 assert.equal(taskNoticeCancellation({...task,status:'completed'},'task.overdue',{}),'Task completed');
 assert.equal(taskNoticeCancellation({...task,status:'cancelled'},'task.overdue',{}),'Task cancelled');
 assert.equal(executionTime(task),task.scheduled_at);
 assert.equal(executionTime({...task,scheduled_at:null}),task.due_at);
 assert.equal(executionTime({...task,scheduled_at:null,details:{}}),null,'old rows are not backfilled');
 assert.equal(executionTime({...task,scheduled_at:null,timing_kind:'response'}),null,'response deadline is not an appointment');
 assert.equal(executionTime({...task,scheduled_at:null,timing_kind:'response',kind:'contact_review'}),task.due_at);
 for(const lang of ['zh','id','en'])assert.notEqual(timingEventLabel('task.appointment_due',task,false,lang),'task.appointment_due');
 assert.equal(timingEventLabel('task.created',task,false,'zh'),'已安排内部复查');
});

import{presentFollowUpTask}from'../src/utils/crmTaskPresentation';
test('review reschedule labels agree in all three languages without losing original time',()=>{
 for(const [lang,label]of [['en','Revised review time'],['id','Waktu peninjauan baru'],['zh','新复查时间']] as const){
 const view=presentFollowUpTask({id:'review',kind:'follow_up',status:'open',timing_kind:'review',due_at:'2099-08-02T02:00:00Z',scheduled_at:'2099-08-03T02:00:00Z'},lang,'Asia/Jakarta');
 assert.equal(view.times[0].label,label);assert.equal(view.times.length,2);
 }
});
