import { contactStatistics } from "./crmContact.ts";

// Durations use recorded server times. Missing/placeholder/future evidence is never zero.
const time = (value: unknown, now: number) => {
  const n = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(n) && n > 0 && n <= now ? n : null;
};
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
export function processMetrics(leads: any[], now: number) {
  const rows = leads.map((lead) => {
    const logs = contactStatistics({
        ...lead,
        followUpLogs: (lead.followUpLogs || []).filter(
          (l: any) => time(l.timestamp || l.at, now) !== null,
        ),
      }),
      registered = time(lead.submittedAt, now);
    const connected = (lead.followUpLogs || []).filter(
      (l: any) => l.recordKind !== "closure" && l.connectStatus === "Connected",
    );
    const first = connected
      .filter(
        (l: any) =>
          l.timestampKnown !== false && time(l.timestamp || l.at, now) !== null,
      )
      .map((l: any) => time(l.timestamp || l.at, now)!)
      .sort((a: number, b: number) => a - b)[0];
    const responseMs =
      registered !== null && first !== undefined && first >= registered
        ? first - registered
        : null;
    const attempts = (lead.followUpLogs || []).filter(
      (l: any) =>
        l.recordKind !== "closure" &&
        ["Connected", "No Response", "Wrong Number"].includes(l.connectStatus),
    );
    const firstContact = attempts
      .filter(
        (l: any) =>
          l.timestampKnown !== false && time(l.timestamp || l.at, now) !== null,
      )
      .map((l: any) => time(l.timestamp || l.at, now)!)
      .sort((a: number, b: number) => a - b)[0];
    const contactMs =
      registered !== null &&
      firstContact !== undefined &&
      firstContact >= registered
        ? firstContact - registered
        : null;
    const tasksKnown = Boolean(
      lead.attention && Array.isArray(lead.attention.tasks),
    );
    const tasks = (lead.attention?.tasks || []).filter(
      (t: any) =>
        ["open", "overdue"].includes(t.status) && Date.parse(t.dueAt) > 0,
    );
    const tasksUnknown =
      !tasksKnown ||
      (lead.attention?.tasks || []).some(
        (t: any) => t.status === "migration_hold" || !(Date.parse(t.dueAt) > 0),
      );
    const history = lead._taskHistory || [];
    let lateCompleted = 0,
      completionUnknown = 0;
    for (const task of history.filter((t: any) => t.status === "completed")) {
      const record = (lead.followUpLogs || []).find(
        (l: any) =>
          l.timestampKnown !== false &&
          l.completeTaskIds?.includes(task.id) &&
          time(l.timestamp || l.at, now) !== null,
      );
      const at = record && time(record.timestamp || record.at, now),
        due = Date.parse(task.dueAt);
      if (!record || !Number.isFinite(due) || due <= 0) completionUnknown++;
      else if (at > due) lateCompleted++;
    }
    const ownerAt = time(lead.ownerChangedAt, now),
      stageAt = time(lead.stageUpdatedAt, now);
    const active = !["Enrolled", "Lost"].includes(lead.currentStage);
    return {
      id: lead.id,
      owner: lead.owner || "",
      stage: lead.currentStage || "",
      unassigned: !lead.owner,
      unassignedMs: !lead.owner && ownerAt !== null ? now - ownerAt : null,
      responseMs,
      contactMs,
      awaitingContact: active && !attempts.length,
      contactTimeUnknown: attempts.length > 0 && contactMs === null,
      awaitingResponse: active && !connected.length,
      responseUnknown: connected.length > 0 && responseMs === null,
      noNext:
        active &&
        lead.contactArrangement?.state !== "stopped" &&
        !tasksUnknown &&
        tasks.length === 0,
      tasksUnknown,
      overdueTasks: tasks.filter((t: any) => Date.parse(t.dueAt) < now).length,
      attempts: logs.attemptCount,
      connected: logs.connectedCount,
      active,
      stageMs: !active || stageAt === null ? null : now - stageAt,
      lateCompleted,
      completionUnknown,
    };
  });
  const summarize = (items: typeof rows) => ({
    customers: items.length,
    unassigned: items.filter((r) => r.unassigned).length,
    unassignedTimeUnknown: items.filter(
      (r) => r.unassigned && r.unassignedMs === null,
    ).length,
    longestUnassignedMs: items.some((r) => r.unassignedMs !== null)
      ? Math.max(
          ...items
            .filter((r) => r.unassignedMs !== null)
            .map((r) => r.unassignedMs!),
        )
      : null,
    firstResponseMedianMs: median(
      items.filter((r) => r.responseMs !== null).map((r) => r.responseMs!),
    ),
    firstContactMedianMs: median(
      items.filter((r) => r.contactMs !== null).map((r) => r.contactMs!),
    ),
    firstContactSamples: items.filter((r) => r.contactMs !== null).length,
    awaitingContact: items.filter((r) => r.awaitingContact).length,
    contactTimeUnknown: items.filter((r) => r.contactTimeUnknown).length,
    firstResponseSamples: items.filter((r) => r.responseMs !== null).length,
    awaitingResponse: items.filter((r) => r.awaitingResponse).length,
    responseUnknown: items.filter((r) => r.responseUnknown).length,
    noNext: items.filter((r) => r.noNext).length,
    tasksUnknown: items.filter((r) => r.tasksUnknown).length,
    overdueCustomers: items.filter((r) => r.overdueTasks > 0).length,
    overdueTasks: items.reduce((n, r) => n + r.overdueTasks, 0),
    lateCompletedTasks: items.reduce((n, r) => n + r.lateCompleted, 0),
    completionUnknown: items.reduce((n, r) => n + r.completionUnknown, 0),
    engagedCustomers: items.filter((r) => r.connected > 0).length,
    connectedRecords: items.reduce((n, r) => n + r.connected, 0),
    attempts: items.reduce((n, r) => n + r.attempts, 0),
    stageMedianMs: median(
      items.filter((r) => r.stageMs !== null).map((r) => r.stageMs!),
    ),
    stageSamples: items.filter((r) => r.stageMs !== null).length,
    stageTimeUnknown: items.filter((r) => r.active && r.stageMs === null)
      .length,
  });
  return {
    asOf: new Date(now).toISOString(),
    ...summarize(rows),
    owners: [...new Set(rows.map((r) => r.owner))].sort().map((owner) => ({
      owner,
      ...summarize(rows.filter((r) => r.owner === owner)),
    })),
    stages: [...new Set(rows.map((r) => r.stage))].sort().map((stage) => ({
      stage,
      ...summarize(rows.filter((r) => r.stage === stage)),
    })),
  };
}
export type ProcessMetrics = ReturnType<typeof processMetrics>;
