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
) {
  await c.query(
    "INSERT INTO crm_facts(id,lead_id,kind,actor,data) VALUES(:p1,:p2,:p3,:p4,:p5)",
    [randomUUID(), leadId, kind, actor, data],
  );
}
export async function operation(
  c: any,
  actor: string,
  body: any,
  work: () => Promise<any>,
) {
  if (
    typeof body.requestId !== "string" ||
    !body.requestId.trim() ||
    body.requestId.length > 100
  )
    invalid("Request ID required");
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const prior = (
    await c.query(
      "SELECT * FROM crm_operations WHERE actor=:p1 AND request_id=:p2",
      [actor, body.requestId],
    )
  ).rows[0];
  if (prior) {
    if (prior.fingerprint !== hash)
      invalid("Request conflict; query the original result", 409);
    return { ...prior.result, replayed: true };
  }
  const result = await work();
  await c.query(
    "INSERT INTO crm_operations(actor,request_id,fingerprint,result) VALUES(:p1,:p2,:p3,:p4)",
    [actor, body.requestId, hash, result],
  );
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
) {
  const p = (
    await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE", [
      leadId,
    ])
  ).rows[0]?.profile;
  if (!p || !canWrite(p)) invalid("Lead not found", 404);
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
) {
  return (
    await c.query(
      "UPDATE notification_jobs SET state='cancelled',result=:p2,completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1",
      [taskId, reason],
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
  return operation(c, actor, body, async () => {
    const reason = String(body.reason || "").trim();
    if (!reason) invalid("Action and reason required");
    const command = body.command;
    let task = body.taskId
      ? (
          await c.query(
            "SELECT * FROM followup_tasks WHERE id=:p1 AND lead_id=:p2 FOR UPDATE",
            [body.taskId, leadId],
          )
        ).rows[0]
      : null;
    if (
      command !== "create" &&
      (!task || !["open", "overdue"].includes(task.status))
    )
      invalid("Task changed; refresh and review", 409);
    if (task && task.revision !== body.revision)
      invalid("Task changed; refresh and review", 409);
    let newTaskId: string | null = null;
    if (["create", "replace"].includes(command)) {
      if (
        !body.action?.trim() ||
        !body.purpose?.trim() ||
        !["response", "appointment", "review"].includes(body.timingKind) ||
        !/(Z|[+-]\d\d:\d\d)$/.test(body.dueAt || "") ||
        !Number.isFinite(Date.parse(body.dueAt)) ||
        Date.parse(body.dueAt) <= Date.now()
      )
        invalid("Enter an action, purpose and future time with timezone");
      newTaskId = randomUUID();
      await c.query(
        "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,original_due_at,timing_kind,request_key,details) VALUES(:p1,:p2,'follow_up',:p3,:p4,:p4,:p5,:p6,:p7)",
        [
          newTaskId,
          leadId,
          lead.owner || null,
          new Date(body.dueAt),
          body.timingKind,
          actor + ":" + body.requestId,
          {
            action: body.action.trim(),
            purpose: body.purpose.trim(),
            replaces: task?.id,
          },
        ],
      );
    }
    if (command === "reschedule") {
      if (
        !/(Z|[+-]\d\d:\d\d)$/.test(body.scheduledAt || "") ||
        !Number.isFinite(Date.parse(body.scheduledAt)) ||
        Date.parse(body.scheduledAt) <= Date.now()
      )
        invalid("Future appointment time with timezone required");
      await c.query(
        "UPDATE followup_tasks SET scheduled_at=:p2,revision=revision+1,details=JSON_SET(details,'$.noticeRevision',COALESCE(JSON_EXTRACT(details,'$.noticeRevision'),0)+1) WHERE id=:p1",
        [task.id, new Date(body.scheduledAt)],
      );
    } else if (command === "supplement") {
      await c.query(
        "UPDATE followup_tasks SET revision=revision+1 WHERE id=:p1",
        [task.id],
      );
    } else if (["replace", "cancel"].includes(command)) {
      await c.query(
        "UPDATE followup_tasks SET status='cancelled',revision=revision+1,details=JSON_SET(details,'$.resolution',:p2,'$.replacedBy',:p3) WHERE id=:p1",
        [task.id, command, newTaskId],
      );
      await cancelTaskNotices(c, task.id, command);
    } else if (command !== "create") invalid("Invalid task action");
    if (task && command === "reschedule") {
      await cancelTaskNotices(
        c,
        task.id,
        "Appointment changed; review current task",
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
    });
    return { saved: true, leadId, taskId: task?.id || newTaskId, newTaskId };
  });
}
