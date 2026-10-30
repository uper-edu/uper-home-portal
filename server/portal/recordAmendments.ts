import {withdrawMistakenAgreements} from '../../src/utils/crmAgreementCorrection.ts';
import {extractionRoot} from '../../src/utils/crmExtractionEvidence.ts';
import {queueExtraction} from './aiExtraction.ts';
import {randomUUID}from'node:crypto';
import{fact,operation,lockLead,invalid}from'./trustWorkflow.ts';
import{contactCorrectionOptions,firstRequirementBasis,firstBasisOutcome}from'../../src/utils/crmRecordAmendments.ts';
import{contactStatistics}from'../../src/utils/crmContact.ts';
/** Empty legacy envelopes are harmless; successful old requests replay before this write boundary. */
export function assertAmendmentProfileBoundary(body:any){
 for(const key of ['profileUpdates','profileVersions']){
  const value=body[key];
  if(value!==undefined&&(value===null||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>0))invalid('直接编辑客户资料请到“客户资料”页签。');
 }
}
export async function appendRecordAmendment(c:any,leadId:string,actor:string,b:any,canWrite:(p:any,permission:string)=>boolean,clock=new Date()){
 if(typeof b.targetFactId!=='string'||!b.targetFactId.trim()||b.targetFactId.length>191)invalid('请选择需要补充／修正的原记录');
 const p=await lockLead(c,leadId,()=>true);
 const target=(await c.query('SELECT * FROM crm_facts WHERE id=:p1 AND lead_id=:p2',[b.targetFactId,leadId])).rows[0];
 if(!target||!['followup.recorded','questionnaire.submitted','profile.fields_updated','task.request_evidence'].includes(target.kind))invalid('原记录不存在或不支持在此补充／修正',404);
 const permission=target.kind==='followup.recorded'?'crm.followup':'crm.write';if(!canWrite(p,permission))invalid('无权补充／修正该客户记录',403);
 if(!['supplement','correction'].includes(b.kind)||typeof b.text!=='string'||!b.text.trim()||b.text.length>10000)invalid('请选择记录方式并填写新增内容');
 if(b.kind==='correction'&&(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000))invalid('请说明原记录哪里记错了');
 const originalLog=(p.followUpLogs||[]).find((l:any)=>l.id===target.data?.result?.logId);
 if(b.contactResult&&(b.kind!=='correction'||!originalLog||['closure','internal'].includes(originalLog.recordKind)||!contactCorrectionOptions.some(o=>o[0]===b.contactResult)))invalid('联系结果只能通过原联系记录的修正更新');
 if(b.profileUpdates&&Object.keys(b.profileUpdates).length&&!canWrite(p,'crm.write'))invalid('无权更新客户资料',403);
 return operation(c,actor,b,{leadId,kind:'record.amended'},async()=>{
  if(target.kind==='questionnaire.submitted')invalid('客户问卷原文只读；新情况请通过记录进展补充。',400);
  assertAmendmentProfileBoundary(b);
  const previous=(p.recordAmendments||[]).filter((a:any)=>a.targetFactId===target.id);
  if(b.expectedAmendmentRevision!==previous.length)invalid('该记录已有新的补充／修正，请保留输入并核对后再保存',409);
  const staff=(await c.query('SELECT display_name FROM crm_users WHERE id=:p1',[actor])).rows[0];
  const amendment={staffName:staff?.display_name||actor,id:randomUUID(),requestId:b.requestId,targetFactId:target.id,targetLogId:originalLog?.id||null,kind:b.kind,text:b.text.trim(),reason:b.kind==='correction'?b.reason.trim():null,contactResult:b.contactResult||null,withdrawCommitmentIds:b.withdrawCommitmentIds||[],actor,recordedAt:clock.toISOString()};
  let next:any={...p,recordAmendments:[...(p.recordAmendments||[]),amendment],simpleRevision:(p.simpleRevision||0)+1};
  next.commitments=withdrawMistakenAgreements(p,originalLog,b,amendment);
  for(const id of amendment.withdrawCommitmentIds){await c.query("UPDATE notification_jobs j JOIN outbox o ON o.id=j.event_id SET j.state='cancelled',j.result='Mistaken agreement withdrawn',j.completed_at=:p3 WHERE j.state='pending' AND o.lead_id=:p1 AND JSON_UNQUOTE(JSON_EXTRACT(j.snapshot,'$.payload.commitmentId'))=:p2",[leadId,id,clock]);}
  const eventId=randomUUID();const fieldResults:any[]=[];
  let firstRequirementStatus='unchanged';
  const restoredTasks:any[]=[];
  if(amendment.contactResult){
   const originalFirst=(p.followUpLogs||[]).find((l:any)=>l.id===p.firstFollowup?.logId);
   const ids=[...new Set<string>(p.firstRequirementTaskIds||originalFirst?.result?.completedTaskIds||[])];
   const taskRows=(await c.query('SELECT * FROM followup_tasks WHERE lead_id=:p1 AND kind=\'consultation\' FOR UPDATE',[leadId])).rows;
   const rows=taskRows.filter((r:any)=>ids.includes(r.id));
   const basis=firstRequirementBasis(next),outcome=firstBasisOutcome(basis);
   next.firstRequirementTaskIds=ids;
   next.firstRequirementDueAt=p.firstRequirementDueAt||p.firstFollowup?.dueAt||rows[0]?.original_due_at||rows[0]?.due_at||null;
   if(!ids.length&&!p.firstFollowup&&!p.firstRequirementDueAt){firstRequirementStatus='not_present';}
   else if(basis){next.firstRequirementReview=null;next.firstFollowup={outcome,at:basis.at||basis.timestamp,actor:basis.actor,logId:basis.id,dueAt:next.firstRequirementDueAt};firstRequirementStatus='satisfied';}
   else {next.firstFollowup=null;firstRequirementStatus=rows.length?'restored':p.firstFollowup||p.firstRequirementDueAt?'needs_review':'not_present';next.firstRequirementReview=firstRequirementStatus!=='needs_review'?null:'原联系已修正为未发生／重复登记，暂无其他有效记录；原首次要求无法明确定位，需管理者核对，系统未新建任务。';}
   for(const row of rows){if(!basis&&row.status==='completed'&&taskRows.some((other:any)=>other.id!==row.id&&other.status==='open')){firstRequirementStatus='needs_review';next.firstRequirementReview='该客户存在另一条开放的历史首次要求，系统未覆盖或合并；请管理者核对。';continue;}if(!['open','overdue','completed'].includes(row.status))continue;const status=basis?'completed':Date.parse(row.due_at)<clock.getTime()?'overdue':'open';
    const details={...(row.details||{}),recordAmendmentId:amendment.id,currentFirstOutcome:outcome};
    if(basis)await c.query('UPDATE followup_tasks SET status=:p2,revision=revision+1,details=:p3 WHERE id=:p1',[row.id,status,details]);
    else {
     // The lead lock serializes this with owner transfer. Historical completed actors remain untouched.
     const owner=p.owner||null;
     const restored={taskId:row.id,previousOwner:row.owner_id||null,owner,dueAt:row.due_at,originalDueAt:row.original_due_at};
     await c.query('UPDATE followup_tasks SET status=:p2,revision=revision+1,details=:p3,owner_id=:p4 WHERE id=:p1',[row.id,status,details,owner]);
     restoredTasks.push(restored);
    }
    if(!basis){await c.query("INSERT IGNORE INTO notification_migration_holds(kind,id,reason) VALUES('task',:p1,'record_amendment_no_history_replay')",[row.id]);await c.query("INSERT IGNORE INTO notification_migration_holds(kind,id,reason) SELECT 'job',id,'record_amendment_no_history_replay' FROM notification_jobs WHERE state IN ('pending','unknown') AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId'))=:p1",[row.id]);}
   }
   const stats=contactStatistics(next);next.connectStatus=stats.lastAttempt?.connectStatus||null;next.lastContactedAt=stats.lastAttempt?.at||stats.lastAttempt?.timestamp||null;
  }
  const sourceId=originalLog?.id||target.data.sourceRecordId||target.id;
  const sourceRow=(await c.query('SELECT source_type,source_id,input,output FROM crm_ai_extractions WHERE lead_id=:p1 AND source_id=:p2 ORDER BY created_at DESC LIMIT 1',[leadId,sourceId])).rows[0];
  const sourceRoot:any=sourceRow?extractionRoot(sourceRow):{type:originalLog?'sales_record':target.kind,id:sourceId,occurredAt:originalLog?.occurredAt||target.data.occurredAt||null};
  if(originalLog){const effectiveResult=(next.recordAmendments||[]).filter((a:any)=>a.targetLogId===originalLog.id&&a.contactResult).at(-1)?.contactResult;sourceRoot.countable=!['Not Occurred','Duplicate'].includes(effectiveResult);}
  const relationship={sourceRoot,amendment:{kind:b.kind,sequence:(next.recordAmendments||[]).length,targetFactId:target.id,targetSourceId:sourceId,originalText:originalLog?.summary||target.data.summary||target.data.text||JSON.stringify(target.data.changes||target.data.answers||{}),reason:amendment.reason}};
  await queueExtraction(c,leadId,'sales_amendment',amendment.id,amendment.text,sourceRoot.occurredAt,actor,[],'1',relationship);
  await fact(c,leadId,'record.amended',actor,{...amendment,firstRequirementStatus,restoredTasks,profileUpdates:{},profileFieldResults:fieldResults},eventId);
  await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,next]);
  await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'record.amend',:p2)",[actor,{leadId,amendmentId:amendment.id,targetFactId:target.id,firstRequirementStatus,restoredTasks,withdrawCommitmentIds:amendment.withdrawCommitmentIds}]);
  return {saved:true,lead:next,amendment,firstRequirementStatus,restoredTasks,profileFieldResults:fieldResults,createdTaskId:null};
 });
}
