import crypto from "node:crypto";
export const fingerprint = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function inspectMigration(raw: string) {
  const leads = JSON.parse(raw);
  if (!Array.isArray(leads)) throw Error("Expected lead array");
  const anomalies: {
    leadId: string;
    messageIndex?: number;
    field: string;
    severity: string;
    reason: string;
  }[] = [];
  const counts = new Map<string, number>(),
    contacts = new Map<string, Set<string>>();
  let messages = 0,
    invalidDates = 0;
  const missingIds = leads.filter(
    (l) => !l || typeof l.id !== "string" || !l.id.trim(),
  ).length;
  for (const lead of leads) {
    if (!lead || typeof lead.id !== "string" || !lead.id.trim()) continue;
    counts.set(lead.id, (counts.get(lead.id) || 0) + 1);
    for (const [kind, value] of [
      ["email", lead.email],
      ["phone", lead.phone || lead.whatsapp],
    ] as const) {
      if (!value) continue;
      const normalized =
        kind === "email"
          ? String(value).trim().toLowerCase()
          : String(value).replace(/\D/g, "");
      if (!normalized) continue;
      const key = kind + ":" + normalized;
      const group = contacts.get(key) || new Set<string>();
      group.add(lead.id);
      contacts.set(key, group);
    }
    if (lead.slaDueTime && !Number.isFinite(Date.parse(lead.slaDueTime)))
      anomalies.push({
        leadId: lead.id,
        field: "slaDueTime",
        severity: "blocking",
        reason: "Invalid deadline; cannot preserve exactly",
      });
    if (lead.submittedAt && !Number.isFinite(Date.parse(lead.submittedAt)))
      anomalies.push({
        leadId: lead.id,
        field: "submittedAt",
        severity: "warning",
        reason: "Invalid source date; retained in original profile",
      });
    if (
      lead.chatTranscript !== undefined &&
      !Array.isArray(lead.chatTranscript)
    ) {
      anomalies.push({
        leadId: lead.id,
        field: "chatTranscript",
        severity: "blocking",
        reason: "Expected message array",
      });
      continue;
    }
    for (const [i, m] of (lead.chatTranscript || []).entries()) {
      messages++;
      if (
        !m ||
        typeof m !== "object" ||
        !["user", "assistant", "system"].includes(m.role)
      )
        anomalies.push({
          leadId: lead.id,
          messageIndex: i,
          field: "role",
          severity: "blocking",
          reason: "Unsupported message role",
        });
      if (m && typeof (m.content ?? m.text ?? "") !== "string")
        anomalies.push({
          leadId: lead.id,
          messageIndex: i,
          field: "content",
          severity: "blocking",
          reason: "Expected text",
        });
      if (!m?.timestamp || !Number.isFinite(Date.parse(m.timestamp))) {
        invalidDates++;
        anomalies.push({
          leadId: lead.id,
          messageIndex: i,
          field: "timestamp",
          severity: "warning",
          reason:
            "Unknown/invalid message time; explicit import placeholder required",
        });
      }
    }
  }
  const duplicateCandidates = [...contacts]
    .filter(([, ids]) => ids.size > 1)
    .map(([key, ids]) => ({
      field: key.split(":")[0],
      leadIds: [...ids].sort(),
      reason: "Matching contact; manual review required",
    }));
  return {
    leads,
    report: {
      sha256: crypto.createHash("sha256").update(raw).digest("hex"),
      leads: leads.length,
      messages,
      followUpRecords: leads.reduce(
        (n, l) =>
          n + (Array.isArray(l?.followUpLogs) ? l.followUpLogs.length : 0),
        0,
      ),
      missingIds,
      duplicateIds: [...counts.values()].reduce((n, c) => n + c - 1, 0),
      invalidDates,
      duplicateCandidates,
      anomalies,
    },
  };
}
