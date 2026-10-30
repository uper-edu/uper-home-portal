import {fact,invalid,lockLead,operation} from './trustWorkflow.ts';
import {effectiveEnrollmentFacts,enrollmentVoids,isEnrollmentConfirmation} from '../../src/utils/crmEnrollment.ts';
import {isSalesProgressStage,isEnrolledStage} from '../../src/utils/crmSalesProgress.ts';

/** Explicit correction of a mistaken confirmation, not a refund, stage inference or AI operation. */
export async function voidEnrollmentConfirmation(c:any,leadId:string,actor:string,b:any,canWrite:(p:any)=>boolean,clock=new Date()){
 const current=await lockLead(c,leadId,()=>true);
 if(!canWrite(current))invalid('无权作废该客户的报名误记',403);
 return operation(c,actor,b,{leadId,kind:'enrollment-void'},async()=>{
  if(typeof b.targetFactId!=='string'||!b.targetFactId.trim()||b.targetFactId.length>191)invalid('请选择原报名确认记录');
  if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000)invalid('请填写纠错说明');
  const facts=(await c.query("SELECT * FROM crm_facts WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND kind IN ('stage.changed','enrollment.confirmation_voided') ORDER BY created_at,id",[leadId])).rows;
  const target=facts.find((f:any)=>f.id===b.targetFactId);
  if(!isEnrollmentConfirmation(target))invalid('原报名确认不属于当前客户或不可用',404);
  if(enrollmentVoids(facts).has(target.id))invalid('该报名确认已作废，请核对最新记录',409);
  if(b.expectedStage!==current.currentStage||b.expectedStageRevision!==(current.stageRevision||0)||b.expectedEnrollmentRevision!==(current.enrollmentRevision||0))invalid('客户阶段或报名确认已有变化，请核对后再保存',409);
  const remaining=effectiveEnrollmentFacts(facts).filter((f:any)=>f.id!==target.id);
  const needsStage=isEnrolledStage(current.currentStage)&&!remaining.length;
  if(needsStage&&(!isSalesProgressStage(b.newStage)||b.newStage==='progress:enrolled'))invalid('请选择纠错后的销售阶段');
  if(!needsStage&&b.newStage)invalid('当前无需同步改变销售阶段，请核对最新状态',409);
  const at=clock.toISOString(),reason=b.reason.trim();
  const next={...current,enrollmentRevision:(current.enrollmentRevision||0)+1,simpleRevision:(current.simpleRevision||0)+1};
  if(needsStage){
   const decision={schema:2,before:current.currentStage,after:b.newStage,reason,effectiveAt:at,recordedAt:at,basis:[],enrollmentConfirmed:false,correctionOfEnrollment:target.id};
   await fact(c,leadId,'stage.changed',actor,decision);
   Object.assign(next,{currentStage:b.newStage,stageRevision:(current.stageRevision||0)+1,stageUpdatedAt:at,stageEffectiveAt:at,stagePolicyVersion:2});
  }
  const correction={targetFactId:target.id,reason,recordedAt:at,originalActor:target.actor,stageChanged:needsStage,stageBefore:current.currentStage,stageAfter:next.currentStage};
  await fact(c,leadId,'enrollment.confirmation_voided',actor,correction);
  await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,next]);
  await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.void',:p2)",[actor,{leadId,...correction}]);
  return {saved:true,lead:next,targetFactId:target.id,stageChanged:needsStage,remainingConfirmations:remaining.length};
 });
}
