export const LEAD_ASSIGNED_EVENT = "lead.assigned";

export function assignmentNotificationPayload(ownerId: string, changedAt: string, factId: string) {
  return { source: "crm_assignment", ownerId, changedAt, factId };
}

export function currentAssignmentRecipient(
  lead: { owner?: string; ownerChangedAt?: string } | undefined,
  payload: { ownerId?: string; changedAt?: string } | undefined,
) {
  return payload?.ownerId && payload.changedAt &&
    lead?.owner === payload.ownerId && lead.ownerChangedAt === payload.changedAt
    ? payload.ownerId : undefined;
}

export function assignmentNoticeTargets(channel: "inapp" | "lark", owner: string | undefined, larkAvailable: boolean) {
  if (!owner) return [];
  if (channel === "inapp") return [owner];
  return larkAvailable ? ["personal:" + owner] : [];
}
