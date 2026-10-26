import { randomUUID } from 'node:crypto';
export function contactPlanError(message:string):never {throw Object.assign(Error(message),{status:message.includes('changed')?409:400});}
export function validateContactPlan(current:any,body:any,tasks:any[],clock:Date){
  const change=body.contactArrangement,plan=body.reviewPlan;
  if(!change&&!plan)return;
  if([body.expectedArrangementVersion,change?.version,plan?.version].filter(v=>v!==undefined).length===0||[body.expectedArrangementVersion,change?.version,plan?.version].filter(v=>v!==undefined).some(v=>v!==(current.contactArrangement?.version||0)))contactPlanError('Contact arrangement changed; refresh and review');
  if(change&&(!['active','stopped'].includes(change.state)||typeof change.reason!=='string'||!change.reason.trim()))contactPlanError('Contact arrangement reason required');
  if(body.disposition==='none'&&change?.state!=='stopped')contactPlanError('Choose a contact arrangement');
  if(plan){
    if(typeof plan.reason!=='string'||!plan.reason.trim()||plan.reason.length>2000)contactPlanError('Contact arrangement reason required');
    if(plan.cancel!==true && (body.disposition!=='schedule'||typeof plan.blockBefore!=='boolean'||!Number.isFinite(Date.parse(body.nextFollowUpAt))||Date.parse(body.nextFollowUpAt)<=clock.getTime()))contactPlanError('Future review time required');
    if(plan.cancel===true&&!current.contactReview&&!['waiting','nurture'].includes(current.contactArrangement?.state))contactPlanError('Contact arrangement changed; refresh and review');
  }
  if((change?.state==='active'||plan?.cancel===true)&&!(body.disposition==='closed'&&['Enrolled','Lost'].includes(body.newStage||current.currentStage))){
    const validRemaining=tasks.some(t=>['open','overdue'].includes(t.status)&&!body.completeTaskIds.includes(t.id)&&!(plan&&t.id===current.contactReview?.taskId)&&!(['waiting','nurture'].includes(current.contactArrangement?.state)&&t.kind==='contact_review'&&t.details?.contactReview===true)&&Number.isFinite(Date.parse(t.due_at))&&Date.parse(t.due_at)>0);
    if(!validRemaining&&body.disposition!=='schedule')contactPlanError('Keep at least one valid task');
  }
}
/** Change only the explicitly linked review arrangement; ordinary task deadlines never move. */
export async function applyContactPlan(c:any,current:any,body:any,tasks:any[],actor:string,clock:Date){
  const change=body.contactArrangement,plan=body.reviewPlan;
  if(!change&&!plan)return {profile:{},createdTaskId:null,cancelledNotifications:0};
  const legacy=['waiting','nurture'].includes(current.contactArrangement?.state);
  const replace=Boolean(plan)||Boolean(change?.state==='active'&&legacy);
  let cancelledNotifications=0;
  if(replace){
    const linked=tasks.filter(t=>['open','overdue'].includes(t.status)&&(t.id===current.contactReview?.taskId||(legacy&&t.kind==='contact_review'&&t.details?.contactReview===true&&Date.parse(t.due_at)===Date.parse(current.contactArrangement?.reviewAt))));
    for(const task of linked){
      if(body.completeTaskIds.includes(task.id))continue;
      await c.query("UPDATE followup_tasks SET status='cancelled',revision=revision+1 WHERE id=:p1",[task.id]);
      cancelledNotifications+=(await c.query("UPDATE notification_jobs SET state='cancelled',result='Task cancelled',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1",[task.id])).rowCount;
    }
  }
  const at=clock.toISOString();
  let review=replace?null:current.contactReview,createdTaskId=null;
  if(plan&&plan.cancel!==true){
    createdTaskId=randomUUID();
    review={taskId:createdTaskId,reviewAt:body.nextFollowUpAt,reason:plan.reason.trim(),blockBefore:plan.blockBefore,at,actor};
    await c.query("INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,details) VALUES(:p1,:p2,'contact_review',:p3,:p4,:p5)",[createdTaskId,current.id,current.owner||null,body.nextFollowUpAt,{contactReview:true,timeReminderVersion:1,action:body.nextAction.trim(),purpose:body.nextPurpose.trim(),blockBefore:plan.blockBefore,sourceMessageId:body.sourceMessageId,sourceConversationId:body.sourceConversationId}]);
  }
  if(createdTaskId){
    const priorReview=tasks.find(t=>t.id===current.contactReview?.taskId&&['open','overdue'].includes(t.status));
    const {event}=await import('./store.ts');
    await event(c,priorReview?'task.rescheduled':'task.created',current.id,{taskId:createdTaskId,previousTaskId:priorReview?.id||null,source:'crm',taskNoticeVersion:0});
  }
  const state=change?.state||(legacy&&plan?'active':current.contactArrangement?.state||'active');
  const arrangement={state,reason:change?.reason?.trim()||plan?.reason.trim(),version:(current.contactArrangement?.version||0)+1,at,actor};
  await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",[actor,'contact.plan.changed',{leadId:current.id,before:{contactArrangement:current.contactArrangement||null,contactReview:current.contactReview||null},after:{contactArrangement:arrangement,contactReview:review}}]);
  await c.query("INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,'contact.arrangement.changed',:p2,:p3)",[randomUUID(),current.id,{state,reviewTaskId:review?.taskId||null}]);
  return {profile:{contactArrangement:arrangement,contactReview:review},createdTaskId,cancelledNotifications};
}
