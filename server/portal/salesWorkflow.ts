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
  if (body.recordKind && !["contact", "closure"].includes(body.recordKind))
    throw new WorkflowValidationError("Invalid contact channel");
  if (body.recordKind !== "closure" && (!body.channel || !body.connectStatus))
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
  if (body.disposition === "none" && !body.contactArrangement)
    throw new WorkflowValidationError("Choose a contact arrangement");
  if (!["keep", "schedule", "none", "closed"].includes(body.disposition))
    throw new WorkflowValidationError("Choose the next arrangement");
  if (
    body.disposition === "none" &&
    !body.contactArrangement &&
    (typeof body.noNextReason !== "string" || !body.noNextReason.trim())
  )
    throw new WorkflowValidationError("Explain why no next step is planned");
  if (
    body.disposition === "schedule" &&
    (typeof body.nextAction !== "string" ||
      !body.nextAction.trim() ||
      typeof body.nextPurpose !== "string" ||
      !body.nextPurpose.trim() ||
      !/([+-]\d\d:\d\d|Z)$/.test(body.nextFollowUpAt || "") ||
      !Number.isFinite(Date.parse(body.nextFollowUpAt)) ||
      Date.parse(body.nextFollowUpAt) <= Date.now())
  )
    throw new WorkflowValidationError(
      "Enter an action, purpose and future time with timezone",
    );
}
export async function saveSalesWorkflow(
  c: any,
  leadId: string,
  actor: string,
  body: any,
  canWrite: (profile: any) => boolean,
) {
  const current = (
    await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE", [
      leadId,
    ])
  ).rows[0]?.profile;
  if (!current || !canWrite(current))
    throw new WorkflowValidationError("Lead not found");
  const previous = (current.followUpLogs || []).find(
    (log: any) => log.requestId === body.requestId,
  );
  if (previous) {
    if (previous.actor !== actor || previous.input !== JSON.stringify(body))
      throw new WorkflowValidationError("Follow-up request conflict");
    return { lead: current, ...previous.result, replayed: true };
  }
  validateWorkflow(body);
  if (body.contactArrangement) {
    const a = body.contactArrangement;
    if (
      !["active", "waiting", "nurture", "stopped"].includes(a.state) ||
      (body.disposition === "none" && a.state === "active") ||
      !a.reason?.trim()
    )
      throw new WorkflowValidationError("Contact arrangement reason required");
    if (a.version !== (current.contactArrangement?.version || 0))
      throw new WorkflowValidationError(
        "Contact arrangement changed; refresh and review",
      );
    if (
      ["waiting", "nurture"].includes(a.state) &&
      (!/([+-]\d\d:\d\d|Z)$/.test(a.reviewAt || "") ||
        !Number.isFinite(Date.parse(a.reviewAt)) ||
        Date.parse(a.reviewAt) <= Date.now())
    )
      throw new WorkflowValidationError("Future review time required");
  }
  const tasks = (
    await c.query("SELECT * FROM followup_tasks WHERE lead_id=:p1 FOR UPDATE", [
      leadId,
    ])
  ).rows;
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
    !body.contactArrangement
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
        t.kind !== "contact_review" &&
        Number.isFinite(Date.parse(t.due_at)) &&
        Date.parse(t.due_at) > 0,
    )
  )
    throw new WorkflowValidationError("Keep at least one valid task");
  if (
    body.disposition === "schedule" &&
    remaining.some((t: any) => t.kind === "follow_up")
  )
    throw new WorkflowValidationError(
      "Existing follow-up task must be retained or completed first",
    );
  if (body.sourceMessageId) {
    const m = (
      await c.query(
        "SELECT m.id FROM messages m JOIN conversations v ON v.id=m.conversation_id WHERE m.id=:p1 AND v.id=:p2 AND v.lead_id=:p3",
        [body.sourceMessageId, body.sourceConversationId, leadId],
      )
    ).rows[0];
    if (!m) throw new WorkflowValidationError("Source message unavailable");
  }
  let cancelled = 0;
  for (const task of selected) {
    await c.query("UPDATE followup_tasks SET status='completed' WHERE id=:p1", [
      task.id,
    ]);
    cancelled += (
      await c.query(
        "UPDATE notification_jobs SET state='cancelled',result='Task completed',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1",
        [task.id],
      )
    ).rowCount;
  }
  if (body.contactArrangement) {
    const a = body.contactArrangement;
    await c.query(
      "UPDATE followup_tasks SET status='cancelled' WHERE lead_id=:p1 AND kind='contact_review' AND status IN ('open','overdue')",
      [leadId],
    );
    if (["waiting", "nurture"].includes(a.state))
      await c.query(
        "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,details) VALUES(:p1,:p2,'contact_review',:p3,:p4,:p5)",
        [
          randomUUID(),
          leadId,
          current.owner || null,
          a.reviewAt,
          { contactReview: true },
        ],
      );
    await c.query(
      "INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,'contact.arrangement.changed',:p2,:p3)",
      [randomUUID(), leadId, { state: a.state }],
    );
  }
  let createdTaskId: string | null = null;
  if (body.disposition === "schedule") {
    createdTaskId = randomUUID();
    await c.query(
      "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,details) VALUES(:p1,:p2,'follow_up',:p3,:p4,:p5)",
      [
        createdTaskId,
        leadId,
        current.owner || null,
        new Date(body.nextFollowUpAt),
        {
          action: body.nextAction.trim(),
          purpose: body.nextPurpose.trim(),
          sourceMessageId: body.sourceMessageId,
          sourceConversationId: body.sourceConversationId,
        },
      ],
    );
  }
  const result = {
    completedTaskIds: body.completeTaskIds,
    createdTaskId,
    cancelledNotifications: cancelled,
    logId: randomUUID(),
  };
  const at = new Date().toISOString();
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
  const profile = {
    ...current,
    ...(body.contactArrangement
      ? {
          contactArrangement: {
            ...body.contactArrangement,
            version: (current.contactArrangement?.version || 0) + 1,
            at,
            actor,
          },
        }
      : {}),
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
    stageUpdatedAt:
      stage === current.currentStage ? current.stageUpdatedAt : at,
    followUpDisposition: {
      kind: body.disposition,
      reason: body.noNextReason || "",
      at,
      actor,
    },
  };
  if (body.buyingSignalDetected && body.buyingSignalDetected !== "None yet") {
    profile.buyingSignal = body.buyingSignalDetected;
    profile.buyingSignals = [
      ...new Set([
        ...(current.buyingSignals ||
          (current.buyingSignal && current.buyingSignal !== "None yet"
            ? [current.buyingSignal]
            : [])),
        body.buyingSignalDetected,
      ]),
    ];
  }
  // Reuse the existing R1-R6 rules for this new result, never regrade or batch-reclassify history.
  if (
    body.recordKind !== "closure" &&
    !current.tierConfirmed &&
    current.tierSource !== "sales_confirmed" &&
    [
      profile.currentStatus,
      profile.goal,
      profile.levelState,
      profile.city,
      profile.mode,
    ].every(Boolean)
  ) {
    const evaluated = evaluateFullLeadTier({
      ...profile,
      assessmentDone: typeof profile.quizScore === "number",
    });
    Object.assign(profile, {
      tier: evaluated.tier,
      tierSource: evaluated.source,
      flag: evaluated.flag,
    });
    if (
      evaluated.tier !== current.tier ||
      evaluated.source !== current.tierSource
    )
      profile.tierUpdatedAt = at;
  }
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
