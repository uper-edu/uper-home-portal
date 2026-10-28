import {assertIdentitySalesAllowed} from './identityConsolidation.ts';
import {observedBuyingSignals,appendBuyingSignals,buyingSignalOptions} from '../../src/utils/crmBuyingSignals.ts';
import {applyTaskChange,handleTaskRequests} from './taskManagement.ts';
import {validateContactPlan,applyContactPlan} from './contactPlans.ts';
import {applyContactSequence} from "./noResponse.ts";
import {stageFact,fact} from "./trustWorkflow.ts";
import { evaluateFullLeadTier } from "../../src/types/crmLead.ts";
import { randomUUID } from "node:crypto";
export class WorkflowValidationError extends Error {}
export function validateWorkflow(body: any) {
  if (
    !body.requestId ||
    typeof body.requestId !== "string" ||
    body.requestId.length > 100
  )
    throw new WorkflowValidationError(
      "Refresh CRM and use the updated follow-up form",
    );
  if (typeof body.summary !== "string" || !body.summary.trim())
    throw new WorkflowValidationError("Follow-up summary required");
  if (
    !Array.isArray(body.completeTaskIds) ||
    body.completeTaskIds.some((v: any) => typeof v !== "string") ||
    new Set(body.completeTaskIds).size !== body.completeTaskIds.length
  )
    throw new WorkflowValidationError("Invalid task selection");
  if (Object.hasOwn(body, "processingTaskId")) {
    if (body.processingTaskId !== null && (typeof body.processingTaskId !== "string" || !body.processingTaskId))
      throw new WorkflowValidationError("Invalid task selection");
    if (body.completeTaskIds.some((id:string) => id !== body.processingTaskId) || body.completeTaskIds.length > 1)
      throw new WorkflowValidationError("Invalid task selection");
  }
  if (body.customerReplied !== undefined && (typeof body.customerReplied !== 'boolean' || (body.customerReplied && (body.recordKind !== 'closure' || !body.channel))))
    throw new WorkflowValidationError("Reply confirmation requires a channel and an internal record");
  if (body.recordKind && !["contact", "closure"].includes(body.recordKind))
    throw new WorkflowValidationError("Invalid contact channel");
  if (body.processingTaskId) {
    if (!["keep", "complete", "cancel"].includes(body.taskOutcome))
      throw new WorkflowValidationError("Choose a task outcome");
    if ((body.taskOutcome === "complete") !== body.completeTaskIds.includes(body.processingTaskId))
      throw new WorkflowValidationError("Task outcome does not match completion");
  }
  if (body.recordKind !== "closure" && !body.channel)
    throw new WorkflowValidationError("Choose a contact channel");
  if (body.recordKind !== "closure" && !body.connectStatus)
    throw new WorkflowValidationError("Choose a contact result");
  if (
    body.newStage &&
    ![
      "New",
      "Contacted",
      "Assessment Booked",
      "Assessment Done",
      "Trial Booked",
      "Trial Attended",
      "Enrolled",
      "Lost",
    ].includes(body.newStage)
  )
    throw new WorkflowValidationError("Invalid sales stage");
  if (
    body.buyingSignalDetected &&
    ![
      "None yet",
      "Asked price",
      "Asked schedule",
      "Asked payment",
      "Ready to enroll",
    ].includes(body.buyingSignalDetected)
  )
    throw new WorkflowValidationError("Invalid buying signal");
  if (body.buyingSignalsDetected !== undefined && (!Array.isArray(body.buyingSignalsDetected) || body.buyingSignalsDetected.some((v:any)=>!buyingSignalOptions.includes(v))))
    throw new WorkflowValidationError("Invalid buying signal");
  if (body.taskOutcome === "cancel" && (!body.processingTaskId || body.recordKind !== "closure" || body.disposition !== "independent"))
    throw new WorkflowValidationError("Invalid task selection");
  if (
    body.channel &&
    !["WhatsApp", "Phone Call", "Campus Visit", "Email", "Other"].includes(
      body.channel,
    )
  )
    throw new WorkflowValidationError("Invalid contact channel");
  if (body.recordKind === "closure" && !body.summary?.trim())
    throw new WorkflowValidationError("Closure reason required");
  if (
    body.connectStatus &&
    !["Connected", "No Response", "Wrong Number"].includes(body.connectStatus)
  )
    throw new WorkflowValidationError("Choose a contact result");
  if(body.disposition==="independent"&&(body.contactArrangement||body.reviewPlan||body.nextTaskChange||body.nextFollowUpAt))throw new WorkflowValidationError("Invalid task action");
  if(body.disposition==="record_only"&&(body.completeTaskIds.length||body.contactArrangement||body.reviewPlan))throw new WorkflowValidationError("Record-only cannot complete tasks or change contact arrangements");
  if (body.disposition === "none" && !body.contactArrangement)
    throw new WorkflowValidationError("Choose a contact arrangement");
  if (!["keep", "schedule", "none", "closed", "record_only", "independent"].includes(body.disposition))
    throw new WorkflowValidationError("Choose the next arrangement");
  if (
    body.disposition === "none" &&
    !body.contactArrangement &&
    (typeof body.noNextReason !== "string" || !body.noNextReason.trim())
  )
    throw new WorkflowValidationError("Explain why no next step is planned");
  if(body.disposition==='schedule'){
    const change=body.nextTaskChange||{command:'create'};
    if(!['create','supplement','reschedule','replace'].includes(change.command))throw new WorkflowValidationError('Invalid task action');
    if((change.command!=='create'||body.reviewPlan)&&(typeof body.nextPurpose!=='string'||!body.nextPurpose.trim()))throw new WorkflowValidationError('Action and reason required');
    if(body.nextTaskNotes!==undefined&&(typeof body.nextTaskNotes!=='string'||body.nextTaskNotes.length>20000))throw new WorkflowValidationError('Action and reason required');
    if(['create','replace'].includes(change.command)||body.reviewPlan){
      if(typeof body.nextAction!=='string'||!body.nextAction.trim())throw new WorkflowValidationError('Enter an action, purpose and future time with timezone');
    }
    if(change.command!=='supplement'&&(!/([+-]\d\d:\d\d|Z)$/.test(body.nextFollowUpAt||'')||!Number.isFinite(Date.parse(body.nextFollowUpAt))||Date.parse(body.nextFollowUpAt)<=Date.now()))throw new WorkflowValidationError('Enter an action, purpose and future time with timezone');
  }
}
export async function saveSalesWorkflow(
  c: any,
  leadId: string,
  actor: string,
  body: any,
  canWrite: (profile: any) => boolean,
  clock = new Date(),
) {
  const current = (
    await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE", [
      leadId,
    ])
  ).rows[0]?.profile;
  if (!current || !canWrite(current))
    throw new WorkflowValidationError("Lead not found");
  await assertIdentitySalesAllowed(c,leadId);
  const previous = (current.followUpLogs || []).find(
    (log: any) => log.requestId === body.requestId,
  );
  if (previous) {
    if (previous.actor !== actor || previous.input !== JSON.stringify(body))
      throw new WorkflowValidationError("Follow-up request conflict");
    return { lead: current, ...previous.result, replayed: true };
  }
  validateWorkflow(body);
  if(body.customerReplied && body.customerReplySequenceRevision!==(current.noResponseSequence?.revision||0))throw new WorkflowValidationError("Contact sequence changed; refresh and review");
  await stageFact(c,leadId,actor,current,body,body.summary);
  const tasks = (
    await c.query("SELECT * FROM followup_tasks WHERE lead_id=:p1 FOR UPDATE", [
      leadId,
    ])
  ).rows;
  validateContactPlan(current,body,tasks,clock);
  if (body.processingTaskId) {
    const bound = tasks.find((task:any)=>task.id===body.processingTaskId);
    if (!bound || !["open","overdue"].includes(bound.status) || (body.expectedTaskRevision !== undefined && Number(bound.revision) !== Number(body.expectedTaskRevision)))
      throw new WorkflowValidationError("Selected task changed; refresh and review");
  }
  const selected = body.completeTaskIds.map((taskId: string) => {
    const task = tasks.find((t: any) => t.id === taskId);
    if (!task || !["open", "overdue"].includes(task.status))
      throw new WorkflowValidationError(
        "Selected task changed; refresh and review",
      );
    return task;
  });
  if (
    selected.some((t: any) => t.kind === "contact_review") &&
    ["waiting","nurture"].includes(current.contactArrangement?.state) && !body.contactArrangement && !body.reviewPlan
  )
    throw new WorkflowValidationError("Choose a contact arrangement");
  const remaining = tasks.filter(
    (t: any) =>
      !body.completeTaskIds.includes(t.id) &&
      ["open", "overdue"].includes(t.status),
  );
  const stage = body.newStage || current.currentStage;
  if (body.disposition === "closed" && !["Enrolled", "Lost"].includes(stage))
    throw new WorkflowValidationError(
      "Only a closed customer can omit the next arrangement",
    );
  if (
    body.disposition === "keep" &&
    !remaining.some(
      (t: any) =>
        Number.isFinite(Date.parse(t.due_at)) &&
        Date.parse(t.due_at) > 0,
    )
  )
    throw new WorkflowValidationError("Keep at least one valid task");
  if(body.sourceMessageAnswered!==undefined&&(typeof body.sourceMessageAnswered!=='boolean'||(body.sourceMessageAnswered&&(body.recordKind==='closure'||body.connectStatus!=='Connected'||!body.sourceMessageId))))throw new WorkflowValidationError('Source message unavailable');
  if (body.sourceMessageId) {
    const m = (
      await c.query(
        "SELECT m.id,m.role FROM messages m JOIN conversations v ON v.id=m.conversation_id WHERE m.id=:p1 AND v.id=:p2 AND v.lead_id=:p3",
        [body.sourceMessageId, body.sourceConversationId, leadId],
      )
    ).rows[0];
    if (!m || (body.sourceMessageAnswered&&m.role!=="user")) throw new WorkflowValidationError("Source message unavailable");
  }
  if(body.disposition==='record_only'&&(body.handledRequests||[]).length)throw new WorkflowValidationError('Record-only cannot complete tasks or change contact arrangements');
  const cancelledTask = body.taskOutcome === "cancel" ? tasks.find((t:any)=>t.id===body.processingTaskId) : null;
  const requestResult=await handleTaskRequests(c,leadId,cancelledTask?[cancelledTask]:selected,body.handledRequests||[],body.processingTaskId,cancelledTask?"dismissed":"handled");
  const handledRequestIds=cancelledTask?[]:requestResult.ids;
  let cancelled = requestResult.cancelled;
  for (const task of selected) {
    await c.query("UPDATE followup_tasks SET status='completed',revision=revision+1 WHERE id=:p1", [
      task.id,
    ]);
    cancelled += (
      await c.query(
        "UPDATE notification_jobs SET state='cancelled',result='Task completed',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1",
        [task.id],
      )
    ).rowCount;
  }
  if(cancelledTask){
    await c.query("UPDATE followup_tasks SET status='cancelled',revision=revision+1,details=JSON_SET(details,'$.resolution','cancel') WHERE id=:p1",[cancelledTask.id]);
    cancelled += await (await import('./trustWorkflow.ts')).cancelTaskNotices(c,cancelledTask.id,'Task cancelled');
  }
  const planResult=await applyContactPlan(c,{...current,id:leadId},body,tasks,actor,clock);
  cancelled+=planResult.cancelledNotifications;
  let createdTaskId: string | null = planResult.createdTaskId;
  let taskChange:any=null;
  if(body.disposition==='schedule'&&(!body.reviewPlan||body.reviewPlan.cancel===true)){
    const change=body.nextTaskChange||{command:'create'};
    if(change.taskId&&body.completeTaskIds.includes(change.taskId))throw new WorkflowValidationError('Task changed; refresh and review');
    taskChange=await applyTaskChange(c,leadId,actor,current,{...change,requestId:body.requestId,action:body.nextAction,purpose:body.nextPurpose,reason:change.command==='create'?(body.nextTaskNotes??body.nextPurpose??''):body.nextPurpose,timingKind:'response',dueAt:body.nextFollowUpAt,scheduledAt:body.nextFollowUpAt},tasks.map((t:any)=>body.completeTaskIds.includes(t.id)?{...t,status:'completed'}:t));
    createdTaskId=taskChange.newTaskId;
    const {event}=await import('./store.ts');
    if(change.command==='replace')cancelled+=(await c.query("UPDATE notification_jobs SET state='cancelled',result='Task replaced',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1",[change.taskId])).rowCount;
    if(change.command==='reschedule'){
      cancelled+=(await c.query("UPDATE notification_jobs SET state='cancelled',result='Task arrangement changed',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1 AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.event'))<>'task.overdue'",[change.taskId])).rowCount;
      await event(c,'task.rescheduled',leadId,{taskId:change.taskId,source:'crm',scheduledAt:body.nextFollowUpAt,taskNoticeVersion:(Number(tasks.find((t:any)=>t.id===change.taskId)?.details?.noticeRevision)||0)+1});
    }
    if(createdTaskId)await event(c,'task.created',leadId,{taskId:createdTaskId,source:'crm'});
    await fact(c,leadId,'task.'+change.command,actor,{...taskChange,reason:change.command==='create'?(body.nextTaskNotes??body.nextPurpose??''):body.nextPurpose,before:tasks.find((t:any)=>t.id===change.taskId),scheduledAt:body.nextFollowUpAt});
  }
  const result = {
    completedTaskIds: body.completeTaskIds,
    cancelledTaskIds: cancelledTask ? [cancelledTask.id] : [],
    terminatedRequestIds: cancelledTask ? requestResult.ids : [],
    handledRequestIds, taskChange,
    createdTaskId,
    cancelledNotifications: cancelled,
    contactPlanChange: body.reviewPlan ? (body.reviewPlan.cancel===true?'review_cancelled':'review_scheduled') : body.contactArrangement ? (body.contactArrangement.state==='stopped'?'stopped':'restored') : null,
    logId: randomUUID(),
  };
  const at = clock.toISOString();
  const log = {
    ...body,
    id: result.logId,
    staffName: actor,
    actor,
    at,
    timestamp: at,
    previousStage: current.currentStage,
    input: JSON.stringify(body),
    result,
  };
  let profile = {
    ...current,
    ...planResult.profile,
    followUpLogs: [...(current.followUpLogs || []), log],
    lastContactedAt:
      body.recordKind === "closure" ? current.lastContactedAt : at,
    touchCount:
      (current.touchCount || 0) + (body.recordKind === "closure" ? 0 : 1),
    connectStatus:
      body.recordKind === "closure"
        ? current.connectStatus
        : body.connectStatus || current.connectStatus,
    currentStage: stage,
    stageRevision:stage===current.currentStage?(current.stageRevision||0):(current.stageRevision||0)+1,
    stageUpdatedAt:
      stage === current.currentStage ? current.stageUpdatedAt : at,
    followUpDisposition: ["record_only","independent"].includes(body.disposition)?current.followUpDisposition:{
      kind: body.disposition,
      reason: body.noNextReason || "",
      at,
      actor,
    },
  };
  Object.assign(profile,appendBuyingSignals(current,observedBuyingSignals(body)));
  // Existing Tier is only changed by explicit authorized classification.
  profile = await applyContactSequence(c,{...profile,id:leadId},body,actor,clock);
  await fact(c,leadId,"followup.recorded",actor,{...body,result});
  await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
    leadId,
    profile,
  ]);
  await c.query(
    "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
    [
      actor,
      "followup.save",
      { leadId, ...result, disposition: body.disposition },
    ],
  );
  return { lead: profile, ...result };
}
