import {fact,invalid,lockLead,operation}from'./trustWorkflow.ts';
import{fulfilledAgreementRecord,agreementRestoreIsPast}from'../../src/utils/crmAgreementRestore.ts';
export async function restoreMistakenFulfilment(c:any,leadId:string,actor:string,b:any,canWrite:(p:any)=>boolean,clock=new Date()){
 const p=await lockLead(c,leadId,()=>true);if(!canWrite(p))invalid('无权处理该客户约定',403);
 return operation(c,actor,b,{leadId,kind:'agreement-restore'},async()=>{
  if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000)invalid('请填写纠错说明');
  const target=fulfilledAgreementRecord(p,b.commitmentId);
  if(!target||b.expectedRevision!==(p.simpleRevision||0)||target.log.id!==b.fulfilmentLogId)invalid('约定已有变化或存在后续关联，请核对最新记录',409);
  const at=clock.toISOString(),past=agreementRestoreIsPast(target.agreement,clock);
  const correction={id:b.requestId,kind:'fulfilment_reversed',reason:b.reason.trim(),actor,recordedAt:at,fulfilmentLogId:target.log.id,previousStatus:'fulfilled'};
  const restored={...target.agreement,status:'active',updatedAt:at,updatedBy:actor,reason:correction.reason,fulfilmentCorrections:[...(target.agreement.fulfilmentCorrections||[]),correction],...(past?{reminderSuppressed:true}: {})};
  const next={...p,simpleRevision:(p.simpleRevision||0)+1,commitments:p.commitments.map((a:any)=>a.id===b.commitmentId?restored:a)};
  // Old jobs never return to pending; future, never-generated reminders use the existing worker policy.
  await c.query("UPDATE notification_jobs j JOIN outbox o ON o.id=j.event_id SET j.state='cancelled',j.result='Mistaken fulfilment reversed; no historical replay',j.completed_at=:p3 WHERE j.state='pending' AND o.lead_id=:p1 AND JSON_UNQUOTE(JSON_EXTRACT(j.snapshot,'$.payload.commitmentId'))=:p2",[leadId,b.commitmentId,clock]);
  await fact(c,leadId,'commitment.fulfilment_reversed',actor,{commitmentId:b.commitmentId,...correction,reminderSuppressed:past});
  await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,next]);
  await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'commitment.restore',:p2)",[actor,{leadId,commitmentId:b.commitmentId,...correction}]);
  return {saved:true,lead:next,commitmentId:b.commitmentId};
 });
}
