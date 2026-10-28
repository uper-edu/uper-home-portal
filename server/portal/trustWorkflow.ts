import {ledgerMetadata} from '../../src/utils/crmFactLedger.ts';
import {assertIdentitySalesAllowed,recordIdentityRefusal} from './identityConsolidation.ts';
import {applyTaskChange} from './taskManagement.ts';
import {customerReplied} from "./noResponse.ts";
import { createHash, randomUUID } from "node:crypto";
export function invalid(message: string, status = 400): never {
  throw Object.assign(Error(message), { status });
}
export async function fact(
  c: any,
  leadId: string,
  kind: string,
  actor: string,
  data: any,
  explicitEventId?: string,
) {
  const ledger=ledgerMetadata(leadId,kind,actor,data);
  const hex=ledger.dedupKey?createHash('sha256').update(ledger.dedupKey).digest('hex').slice(0,32):null;
  const eventId=explicitEventId||(hex?`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`:randomUUID());
  await c.query(
    "INSERT INTO crm_facts(id,lead_id,kind,actor,data) VALUES(:p1,:p2,:p3,:p4,:p5) ON DUPLICATE KEY UPDATE id=id",
    [eventId, leadId, kind, actor, {...data,ledger}],
  );
}
export async function operation(
  c: any,
  actor: string,
  body: any,
  scope: { leadId: string; kind: string; authorize?: () => Promise<unknown> },
  work: () => Promise<any>,
) {
  if (
    typeof body.requestId !== "string" ||
    !body.requestId.trim() ||
    body.requestId.length > 100
  )
    invalid("Request ID required");
  const hash = createHash("sha256")
    .update(JSON.stringify(["crm-operation-v2", scope.leadId, scope.kind, body]))
    .digest("hex");
  const prior = (
    await c.query(
      "SELECT * FROM crm_operations WHERE actor=:p1 AND request_id=:p2",
      [actor, body.requestId],
    )
  ).rows[0];
  if (prior) {
    if (prior.result?.leadId !== scope.leadId ||
        prior.result?.operationKind !== scope.kind || prior.fingerprint !== hash)
      invalid("Request context conflict; query the original result and refresh before saving", 409);
    await scope.authorize?.();
    return { ...prior.result, replayed: true };
  }
  await scope.authorize?.();
  const result = { ...await work(), leadId: scope.leadId, operationKind: scope.kind };
  try {
    await c.query(
      "INSERT INTO crm_operations(actor,request_id,fingerprint,result) VALUES(:p1,:p2,:p3,:p4)",
      [actor, body.requestId, hash, result],
    );
  } catch (error: any) {
    // A competing target may have committed this actor/key while work ran.
    // Throw so the enclosing transaction rolls back all of this attempt.
    if (error.code === "ER_DUP_ENTRY")
      invalid("Request context conflict; query the original result and refresh before saving", 409);
    throw error;
  }
  return result;
}
export function normalizeContactPhone(value: any) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  return digits.startsWith("0") ? "62" + digits.slice(1) : digits;
}
export function contactsConflict(previous: any, incoming: any) {
  const email = (s: any) =>
    String(s || "")
      .trim()
      .toLowerCase();
  const phone = normalizeContactPhone;
  return Boolean(
    (previous.email &&
      incoming.email &&
      email(previous.email) !== email(incoming.email)) ||
    (previous.whatsapp &&
      (incoming.whatsapp || incoming.phone) &&
      phone(previous.whatsapp) !== phone(incoming.whatsapp || incoming.phone)),
  );
}
export async function engagement(
  c: any,
  leadId: string,
  kind: string,
  sourceId: string,
  data: any,
) {
  const key = kind + ":" + sourceId;
  const lead=(await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",[leadId])).rows[0];
  const exists=(await c.query("SELECT id FROM crm_engagements WHERE id=:p1",[key])).rows.length;
  if(!exists&&lead&&kind==='message'&&typeof data.text==='string')await recordIdentityRefusal(c,leadId,data.text,sourceId);
  if(!exists && lead && kind==='message' && typeof data.text==='string' && data.text.trim())
    await customerReplied(c,leadId,key,data.messageRecordedAt);
  await c.query(
    "INSERT INTO crm_engagements(id,lead_id,kind,source_id,data) VALUES(:p1,:p2,:p3,:p4,:p5) ON DUPLICATE KEY UPDATE id=id",
    [key, leadId, kind, sourceId, data],
  );
}
export async function lockLead(
  c: any,
  leadId: string,
  canWrite: (p: any) => boolean,
  identityReview = false,
) {
  const p = (
    await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE", [
      leadId,
    ])
  ).rows[0]?.profile;
  if (!p || !canWrite(p)) invalid("Lead not found", 404);
  if(!identityReview)await assertIdentitySalesAllowed(c,leadId);
  return p;
}
export async function stageFact(
  c: any,
  leadId: string,
  actor: string,
  current: any,
  body: any,
  reason: string,
) {
  if (
    body.newStage &&
    (body.expectedStageRevision ?? 0) !== (current.stageRevision ?? 0)
  )
    invalid("Stage changed; refresh and review", 409);
  if (body.newStage && body.newStage !== current.currentStage) {
    if (!reason?.trim()) invalid("Stage change reason required");
    if (body.expectedStage !== current.currentStage)
      invalid("Stage changed; refresh and review", 409);
    await fact(c, leadId, "stage.changed", actor, {
      before: current.currentStage,
      after: body.newStage,
      reason,
      sourceMessageId: body.sourceMessageId,
    });
  }
}
export async function cancelTaskNotices(
  c: any,
  taskId: string,
  reason: string,
  preserveDeadline = false,
) {
  return (
    await c.query(
      "UPDATE notification_jobs SET state='cancelled',result=:p2,completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1 AND (:p3=false OR JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.event'))<>'task.overdue')",
      [taskId, reason, preserveDeadline],
    )
  ).rowCount;
}
export async function taskCommand(
  c: any,
  leadId: string,
  actor: string,
  body: any,
  canWrite: (p: any) => boolean,
) {
  const lead = await lockLead(c, leadId, canWrite);
  return operation(c, actor, body, { leadId, kind: "task-actions" }, async () => {
    const tasks=(await c.query("SELECT * FROM followup_tasks WHERE lead_id=:p1 FOR UPDATE",[leadId])).rows;
    const task=tasks.find((t:any)=>t.id===body.taskId);
    const reason=String(body.reason||'').trim(),command=body.command;
    const result=await applyTaskChange(c,leadId,actor,lead,body,tasks);
    const newTaskId=result.newTaskId;
    if(task&&['replace','cancel'].includes(command))await cancelTaskNotices(c,task.id,command);
    if (task && (command === "reschedule" || (command === "edit" && body.scheduledAt))) {
      await cancelTaskNotices(
        c,
        task.id,
        "Task arrangement changed",
        true,
      );
      const { event } = await import("./store.ts");
      await event(c, "task.rescheduled", leadId, {
        taskId: task.id,
        source: "crm",
        scheduledAt: body.scheduledAt,
        taskNoticeVersion: (Number(task.details?.noticeRevision) || 0) + 1,
      });
    }
    if (newTaskId) {
      const { event } = await import("./store.ts");
      await event(c, "task.created", leadId, {
        taskId: newTaskId,
        source: "crm",
      });
    }
    await fact(c, leadId, "task." + command, actor, {
      taskId: task?.id || newTaskId,
      newTaskId,
      reason,
      before: task,
      scheduledAt: body.scheduledAt,
      action: body.action,
      purpose: body.purpose,
      sourceMessageId:result.sourceMessageId,sourceConversationId:result.sourceConversationId,requestEvidenceId:result.requestEvidenceId,
    });
    return { saved: true, leadId, ...result };
  });
}
