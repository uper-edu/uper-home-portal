import { createHash, randomUUID } from "node:crypto";
const fail = (message: string, status = 409): never => {
  throw Object.assign(Error(message), { status });
};
export const requestEvidenceId = (
  leadId: string,
  conversationId: string,
  messageId: string,
  action: string,
) =>
  "request:" +
  createHash("sha256")
    .update(JSON.stringify([leadId, conversationId, messageId, action]))
    .digest("hex");
export const activeTask = (task: any) =>
  ["open", "overdue"].includes(task.status);
export function requestDeadline(task: any, requests: any[]) {
  const dates = [
    task.due_at || task.dueAt,
    ...requests
      .filter((r) => r.task_id === task.id && r.state === "linked")
      .map((r) => r.data.dueAt),
  ].filter((v) => Number.isFinite(Date.parse(v)) && Date.parse(v) > 0);
  return dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null;
}
export async function requestEvidence(c: any, leadId: string, selection: any) {
  const row = (
    await c.query(
      "SELECT * FROM crm_engagements WHERE id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2)) FOR UPDATE",
      [selection.id, leadId],
    )
  ).rows[0];
  if (
    !row ||
    row.kind !== "task_request" ||
    !["pending", "linked"].includes(row.state) ||
    row.version !== selection.version
  )
    fail("Request changed; refresh and review");
  return row;
}
export async function taskRequests(c: any, leadId: string) {
  return (
    await c.query(
      "SELECT * FROM crm_engagements WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND kind='task_request' ORDER BY created_at,id",
      [leadId],
    )
  ).rows;
}
export async function attachTaskRequest(
  c: any,
  leadId: string,
  task: any,
  selection: any,
  requirePending = true,
) {
  const row = await requestEvidence(c, leadId, selection);
  if (requirePending && row.state !== "pending")
    fail("Request changed; refresh and review");
  if (!activeTask(task)) fail("Task changed; refresh and review");
  await c.query(
    "UPDATE crm_engagements SET state='linked',task_id=:p2,version=version+1 WHERE id=:p1",
    [row.id, task.id],
  );
  await c.query("UPDATE followup_tasks SET revision=revision+1 WHERE id=:p1", [
    task.id,
  ]);
  return row;
}
export async function handleTaskRequests(
  c: any,
  leadId: string,
  tasks: any[],
  selections: any[] = [],
  processingTaskId?: string,
  resolution: "handled" | "dismissed" = "handled",
) {
  if (
    !Array.isArray(selections) ||
    new Set(selections.map((v) => v?.id)).size !== selections.length
  )
    fail("Choose the requests handled by this result", 400);
  const requests = await taskRequests(c, leadId);
  const required = requests.filter(
    (r) => r.state === "linked" && tasks.some((t) => t.id === r.task_id),
  );
  if (
    required.some(
      (r) => !selections.some((v) => v.id === r.id && v.version === r.version),
    )
  )
    fail("Choose the requests handled by this result", 400);
  let cancelled = 0;
  for (const selection of selections) {
    const row = requests.find((r) => r.id === selection.id);
    if (
      !row ||
      row.state !== "linked" ||
      row.version !== selection.version ||
      (!tasks.some((t) => t.id === row.task_id) &&
        (!processingTaskId || row.task_id !== processingTaskId))
    )
      fail("Request changed; refresh and review");
    await c.query(
      "UPDATE crm_engagements SET state=:p2,version=version+1 WHERE id=:p1",
      [row.id,resolution],
    );
    cancelled += (
      await c.query(
        "UPDATE notification_jobs SET state='cancelled',result='Request handled',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.requestEvidenceId')),'null')=:p1",
        [row.id],
      )
    ).rowCount;
  }
  return { ids: selections.map((v) => v.id), cancelled };
}
/** Shared by the standalone task editor and follow-up save. Never match free text. */
export async function applyTaskChange(
  c: any,
  leadId: string,
  actor: string,
  lead: any,
  body: any,
  tasks: any[],
) {
  fail('General tasks are retired; refresh CRM',410);
  const command = body.command;
  if (["create", "create_request"].includes(command) && body.taskId)
    fail("Invalid task selection", 400);
  const target = body.taskId ? tasks.find((t) => t.id === body.taskId) : null;
  const resolving = ["link_request", "create_request"].includes(command);
  const req = resolving
    ? await requestEvidence(c, leadId, {
        id: body.requestEvidenceId,
        version: body.requestEvidenceVersion,
      })
    : null;
  if (req && req.state !== "pending")
    fail("Request changed; refresh and review");
  if (!["create", "create_request"].includes(command)) {
    if (!target || !activeTask(target) || target.revision !== body.revision)
      fail("Task changed; refresh and review");
    // Review agreements must use the P0 arrangement transaction, not generic task commands.
    if (
      target.kind === "contact_review" ||
      lead.contactReview?.taskId === target.id
    )
      fail("Use the contact arrangement to change this review task", 400);
  }
  if (
    ![
      "create",
      "create_request",
      "link_request",
      "edit",
      "supplement",
      "reschedule",
      "replace",
      "cancel",
    ].includes(command)
  )
    fail("Invalid task action", 400);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if ((!["create","create_request","edit"].includes(command) && !reason) || reason.length > 20000 || (body.reason != null && typeof body.reason !== "string")) fail("Action and reason required", 400);
  if (
    command === "create" &&
    tasks.some(activeTask) &&
    body.relationDecision !== "separate"
  )
    fail("Confirm that this is a separate matter", 400);
  if (command === "replace" && body.sameMatterConfirmed !== true)
    fail("Confirm replacement of the same matter", 400);
  if (
    command === "cancel" &&
    (await taskRequests(c, leadId)).some(
      (r) => r.state === "linked" && r.task_id === target.id,
    )
  )
    fail("Handle or move the linked requests before cancelling", 400);
  let newTaskId: string | null = null;
  if (["create", "replace", "create_request"].includes(command)) {
    const due = req?.data.dueAt || body.dueAt;
    if (
      typeof body.action !== "string" ||
      !body.action.trim() ||
      (command === "replace" && (typeof body.purpose !== "string" || !body.purpose.trim())) ||
      !["response", "appointment", "review"].includes(
        req ? "response" : body.timingKind,
      ) ||
      !/(Z|[+-]\d\d:\d\d)$/.test(due || "") ||
      !Number.isFinite(Date.parse(due)) ||
      (!req && Date.parse(due) <= Date.now())
    )
      fail(["create","create_request"].includes(command) ? "Enter task content and a future time with timezone" : "Enter an action, purpose and future time with timezone", 400);
    newTaskId = randomUUID();
    const details: any = {
      action: body.action.trim(),
      timeReminderVersion: 1,
      ...(typeof body.purpose === "string" && body.purpose.trim() ? {purpose: body.purpose.trim()} : {}),
      matterId: target?.details?.matterId || randomUUID(),
      ...(target
        ? {
            replaces: target.id,
            originalMatterDeadline:
              target.details?.originalMatterDeadline ||
              target.original_due_at ||
              target.due_at,
          }
        : {}),
      ...(req
        ? {
            sourceConversationId: req.data.conversationId,
            sourceMessageId: req.data.messageId,
          }
        : {}),
    };
    await c.query(
      "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,original_due_at,timing_kind,request_key,details) VALUES(:p1,:p2,:p3,:p4,:p5,:p5,:p6,:p7,:p8)",
      [
        newTaskId,
        leadId,
        req?.data.action || target?.kind || "follow_up",
        lead.owner || null,
        new Date(due),
        req ? "response" : body.timingKind,
        actor + ":" + body.requestId,
        details,
      ],
    );
  }
  if(command === "edit"){
    if(typeof body.action!=="string"||!body.action.trim()||body.action.length>20000)fail("Enter the specific task action",400);
    if(body.scheduledAt!==undefined&&(!/(Z|[+-]\d\d:\d\d)$/.test(body.scheduledAt)||!Number.isFinite(Date.parse(body.scheduledAt))||Date.parse(body.scheduledAt)<=Date.now()||!reason))fail("Future appointment time with timezone required",400);
    const details={...target.details,action:body.action.trim(),...(reason?{additions:[...(target.details?.additions||[]),{id:randomUUID(),text:reason,actor,at:new Date().toISOString()}]}:{}),...(body.scheduledAt?{noticeRevision:(Number(target.details?.noticeRevision)||0)+1,timeReminderVersion:1}:{})};
    if(body.scheduledAt)await c.query("UPDATE followup_tasks SET details=:p2,scheduled_at=:p3,revision=revision+1 WHERE id=:p1",[target.id,details,new Date(body.scheduledAt)]);
    else await c.query("UPDATE followup_tasks SET details=:p2,revision=revision+1 WHERE id=:p1",[target.id,details]);
  }
  if (command === "reschedule") {
    if (
      !/(Z|[+-]\d\d:\d\d)$/.test(body.scheduledAt || "") ||
      !Number.isFinite(Date.parse(body.scheduledAt)) ||
      Date.parse(body.scheduledAt) <= Date.now()
    )
      fail("Future appointment time with timezone required", 400);
    await c.query(
      "UPDATE followup_tasks SET scheduled_at=:p2,revision=revision+1,details=JSON_SET(details,'$.noticeRevision',COALESCE(JSON_EXTRACT(details,'$.noticeRevision'),0)+1,'$.timeReminderVersion',1) WHERE id=:p1",
      [target.id, new Date(body.scheduledAt)],
    );
  } else if (command === "supplement") {
    const additions = [
      ...(target.details?.additions || []),
      { id: randomUUID(), text: reason, actor, at: new Date().toISOString() },
    ];
    await c.query(
      "UPDATE followup_tasks SET details=:p2,revision=revision+1 WHERE id=:p1",
      [target.id, { ...target.details, additions }],
    );
  } else if (["replace", "cancel"].includes(command)) {
    await c.query(
      "UPDATE followup_tasks SET status='cancelled',revision=revision+1,details=JSON_SET(details,'$.resolution',:p2,'$.replacedBy',:p3) WHERE id=:p1",
      [target.id, command, newTaskId],
    );
    if (command === "replace")
      for (const r of (await taskRequests(c, leadId)).filter(
        (r) => r.task_id === target.id && r.state === "linked",
      ))
        await c.query(
          "UPDATE crm_engagements SET task_id=:p2,version=version+1 WHERE id=:p1",
          [r.id, newTaskId],
        );
  }
  if (req)
    await attachTaskRequest(
      c,
      leadId,
      { id: newTaskId || target.id, status: "open" },
      { id: req.id, version: req.version },
    );
  return {
    taskId: target?.id || newTaskId,
    newTaskId,
    sourceMessageId:req?.data.messageId,sourceConversationId:req?.data.conversationId,
    requestEvidenceId: req?.id || null,
    command,
  };
}
