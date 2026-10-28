import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrmSimpleWorkflow} from '../src/components/crm/CrmSimpleWorkflow';
import {initialProgressRecord,progressArrangementChoices,progressSaveSummary} from '../src/utils/crmProgressRecord';
import {prepareProgressDraft} from '../src/utils/crmProgressDraft';
import {hasSimpleWorkflowDraft} from '../src/utils/crmSimpleFollowup';
import {contactStatistics} from '../src/utils/crmContact';
import {projectInteractionTimeline} from '../src/utils/crmInteractionTimeline';
import {saveSimpleSalesWorkflow} from '../server/portal/simpleSalesWorkflow';

const clock=new Date('2026-10-28T10:00:00Z');
function database(extra:any={}) {
  let profile:any={id:'TEST737',owner:'Robert',tier:'Warm-Online',currentStage:'progress:proposal',simpleRevision:0,followUpLogs:[],contactArrangement:{state:'stopped',version:4,reason:'客户要求'},...extra};
  const writes:any[]=[];
  return {writes,get profile(){return profile;},async query(sql:string,values:any[]=[]):Promise<any>{
    if(sql.startsWith('SELECT profile'))return {rows:[{profile}]};
    if(sql.startsWith('SELECT display_name'))return {rows:[{display_name:'TEST sales'}]};
    if(sql.startsWith('SELECT * FROM followup_tasks'))return {rows:[{id:'TEST-first',due_at:'2026-10-29T10:00:00Z',original_due_at:'2026-10-29T10:00:00Z'}]};
    if(sql.startsWith('SELECT'))return {rows:[]};
    writes.push([sql,values]);if(sql.startsWith('UPDATE portal_leads'))profile=values[1];
    return {rows:[],rowCount:0};
  }};
}
const note=(overrides:any={})=>({requestId:'TEST737-note',workflowVersion:3,expectedRevision:0,recordKind:'internal',summary:'TEST 已核对班级资料，尚未进行客户联系。',...overrides});
test('stopped customer accepts a note, preserves contact statistics, stage, tasks, arrangement and AI source',async()=>{
  const db=database(),before=structuredClone(db.profile);
  const r=await saveSimpleSalesWorkflow(db,'TEST737','Robert',note(),()=>true,clock);
  assert.equal(r.contactRecorded,false);assert.equal(r.contactPlanChange,null);assert.equal(r.firstOutcome,null);
  assert.deepEqual(r.completedTaskIds,[]);assert.equal(r.createdTaskId,null);
  assert.deepEqual(db.profile.contactArrangement,before.contactArrangement);
  for(const key of ['owner','tier','currentStage','touchCount','lastContactedAt'])assert.equal(db.profile[key],before[key]);
  assert.equal(contactStatistics(db.profile).attemptCount,0);assert.deepEqual(projectInteractionTimeline(db.profile),{communication:null,customer:null,sales:null});
  assert.ok(db.writes.some(([sql])=>sql.startsWith('INSERT INTO crm_ai_extractions')));
  assert.ok(!db.writes.some(([sql])=>/^(UPDATE followup_tasks|UPDATE notification_jobs|INSERT INTO outbox|INSERT INTO followup_tasks)/.test(sql)));
});
test('restore and stop use the saved original as reason; ten retries do not duplicate or change first requirement',async()=>{
  const db=database(),b=note({contactState:'active',expectedContactArrangementVersion:4});
  const r=await saveSimpleSalesWorkflow(db,'TEST737','Robert',b,()=>true,clock);
  assert.equal(r.contactPlanChange,'restored');assert.equal(db.profile.contactArrangement.reason,b.summary);assert.equal(db.profile.contactArrangement.version,5);
  for(let n=0;n<10;n++)assert.equal((await saveSimpleSalesWorkflow(db,'TEST737','Robert',b,()=>true,clock)).replayed,true);
  assert.equal(db.profile.followUpLogs.length,1);assert.equal(db.profile.followUpLogs[0].contactReason,b.summary);
  const stop=await saveSimpleSalesWorkflow(db,'TEST737','Robert',note({requestId:'stop',expectedRevision:1,contactState:'stopped',expectedContactArrangementVersion:5}),()=>true,clock);
  assert.equal(stop.contactPlanChange,'stopped');assert.deepEqual(stop.completedTaskIds,[]);
});
test('stale contact arrangement and same-state transition reject before any writes',async()=>{
  for(const extra of [{contactState:'active',expectedContactArrangementVersion:3},{contactState:'stopped',expectedContactArrangementVersion:4}]){
    const db=database();await assert.rejects(saveSimpleSalesWorkflow(db,'TEST737','Robert',note(extra),()=>true,clock),/Contact arrangement changed/);assert.equal(db.writes.length,0);
  }
});
test('notes cannot carry hidden actual-contact metadata, permissions and identity checks remain enforced',async()=>{
  for(const [extra,allowed] of [[{channel:'WhatsApp'},true],[{connectStatus:'Connected'},true],[{contactDirection:'sales'},true],[{},false]] as any){
    const db=database();await assert.rejects(saveSimpleSalesWorkflow(db,'TEST737','Robert',note(extra),()=>allowed,clock));assert.equal(db.writes.length,0);
  }
  const db=database({identityLifecycle:'pending'});await assert.rejects(saveSimpleSalesWorkflow(db,'TEST737','Robert',note(),()=>true,clock),/IDENTITY_REVIEW_REQUIRED/);assert.equal(db.writes.length,0);
});
test('stopped customer can record real historical contact without restoring contact or changing its occurrence',async()=>{
  const db=database(),b=note({recordKind:'contact',channel:'WhatsApp',connectStatus:'No Response',contactDirection:'sales',occurrenceMode:'specified',occurredAt:'2026-10-20T02:00:00Z'});
  const r=await saveSimpleSalesWorkflow(db,'TEST737','Robert',b,()=>true,clock);
  assert.equal(r.contactRecorded,true);assert.equal(r.contactPlanChange,null);assert.equal(db.profile.contactArrangement.state,'stopped');
  assert.equal(projectInteractionTimeline(db.profile).sales?.at,'2026-10-20T02:00:00.000Z');assert.equal(contactStatistics(db.profile).attemptCount,1);
});
test('fresh notes are clean, toggled-off contact values and hidden exceptions never reach the request',()=>{
  const d=initialProgressRecord({contactArrangement:{state:'stopped',version:4}});
  assert.equal(d.recordKind,'internal');assert.equal(hasSimpleWorkflowDraft(d),false);
  const stale={...d,summary:'TEST original',channel:'WhatsApp',connectStatus:'Connected',contactDirection:'customer',occurrenceMode:'specified',contactLocal:'invalid',internalLocal:'invalid',occurredAt:'invalid',exceptionReason:'old hidden exception',contactReason:'old reason'};
  const b=JSON.parse(JSON.stringify(prepareProgressDraft({...stale,contactState:'active'},'Asia/Jakarta')));
  for(const k of ['channel','connectStatus','contactDirection','occurrenceMode','occurredAt','exceptionReason','internalLocal','contactLocal'])assert.equal(Object.hasOwn(b,k),false,k);
  assert.equal(b.contactReason,stale.summary);assert.equal(b.expectedContactArrangementVersion,4);
  assert.equal(prepareProgressDraft({...stale,contactState:''},'Asia/Jakarta').expectedContactArrangementVersion,undefined);
});
test('arrangement choices follow current state; legacy restrictions are explicitly reviewed',()=>{
  assert.deepEqual(progressArrangementChoices('stopped'),['','active']);
  assert.deepEqual(progressArrangementChoices('active'),['','stopped']);assert.deepEqual(progressArrangementChoices(),['','stopped']);
  for(const state of ['waiting','nurture','unknown'])assert.deepEqual(progressArrangementChoices(state),['','active','stopped']);
});
test('three-language forms default to notes and feedback reports both contact registration and arrangement',()=>{
  for(const lang of ['zh','en','id']){
    const props={lead:{id:'TEST737',contactArrangement:{state:'stopped',version:4}},lang,isLight:true,timezone:'Asia/Jakarta'};
    const h=renderToStaticMarkup(React.createElement(CrmSimpleWorkflow,props));
    assert.ok(h.includes('aria-expanded="false"'));assert.ok(h.includes('crm-progress-section-panel" hidden=""')); 
    const restored=renderToStaticMarkup(React.createElement(CrmSimpleWorkflow,{...props,initialDraft:{simple:{recordKind:'contact',summary:'TEST',channel:'WhatsApp',connectStatus:'No Response'}}}));assert.ok(restored.includes('WhatsApp'));
    const text=progressSaveSummary({contactRecorded:false,contactPlanChange:'restored'},lang);assert.ok(text.length>0);assert.ok(!text.includes('undefined'));
  }
  assert.equal(progressSaveSummary({contactRecorded:false},'zh'),'进展已保存；未登记实际联系；联系安排未变。');
  assert.equal(progressSaveSummary({contactRecorded:true,contactPlanChange:'restored',completed:1},'zh'),'进展已保存；实际联系已登记；已恢复主动联系；首次联系要求已处理。');
});
