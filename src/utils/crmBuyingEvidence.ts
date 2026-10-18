import { historyBuyingLabel } from "./crmFollowupHistory";

export type BuyingEvidence = {
  id: string;
  kind: "questionnaire" | "sales" | "chat" | "legacy";
  value: string;
  at: string | null;
  actor?: string;
  original?: string;
  taskId?: string;
  taskOperation?: string;
  messageId?: string;
  conversationId?: string;
};
const values = (items: unknown[]) => [
  ...new Set(
    items
      .filter(
        (v): v is string =>
          typeof v === "string" && !!v.trim() && v !== "None yet",
      )
      .map((v) => (v === "Ready to enrol" ? "Ready to enroll" : v)),
  ),
];
/** Derived read model only. Never writes classification inputs or guesses source from text. */
export function projectBuyingEvidence(
  facts: any[],
  profile: any,
): BuyingEvidence[] {
  const result: BuyingEvidence[] = [];
  const logs = new Set<string>();
  for (const f of facts) {
    const d = f.data || {};
    if (f.kind === "questionnaire.submitted") {
      const a = d.answers || {};
      for (const value of values([...(a.buyingSignals || []), a.buyingSignal]))
        result.push({
          id: `${f.id}:${encodeURIComponent(value)}`,
          kind: "questionnaire",
          value,
          at: f.created_at || null,
          actor: "visitor",
          original: value,
        });
    } else if (f.kind === "followup.recorded") {
      if (d.result?.logId) logs.add(d.result.logId);
      for (const value of values([d.buyingSignalDetected]))
        result.push({
          id: `${f.id}:${encodeURIComponent(value)}`,
          kind: "sales",
          value,
          at: f.created_at || null,
          actor: f.actor,
          original: d.summary || "",
          taskId: d.processingTaskId,
          messageId: d.sourceMessageId,
          conversationId: d.sourceConversationId,
        });
    } else if (
      f.kind === "task.request_evidence" &&
      ["booking", "enrollment"].includes(d.action) &&
      d.taskId
    ) {
      result.push({
        id: `${f.id}:${d.action}`,
        kind: "chat",
        value: d.action === "booking" ? "Booking requested" : "Ready to enroll",
        at: f.message_at || null,
        actor: "visitor",
        original: f.message_content || "",
        messageId: f.message_id,
        conversationId: d.conversationId,
        taskId: d.taskId,
        taskOperation: d.taskOperation,
      });
    }
  }
  for (const log of profile.followUpLogs || [])
    if (!logs.has(log.id)) {
      for (const value of values([log.buyingSignalDetected]))
        result.push({
          id: `log-${log.id}:${encodeURIComponent(value)}`,
          kind: "sales",
          value,
          at: log.at || log.timestamp || null,
          actor: log.staffName || log.actor,
          original: log.summary || "",
          taskId: log.processingTaskId,
          messageId: log.sourceMessageId,
          conversationId: log.sourceConversationId,
        });
    }
  const supported = new Set(result.map((r) => r.value));
  for (const value of values([
    ...(profile.buyingSignals || []),
    profile.buyingSignal,
  ]))
    if (!supported.has(value))
      result.push({
        id: `legacy:${encodeURIComponent(value)}`,
        kind: "legacy",
        value,
        at: null,
      });
  for (const entry of result)
    if (entry.at && /^\d{4}-\d\d-\d\d /.test(entry.at))
      entry.at = entry.at.replace(" ", "T") + "Z";
  return result.sort(
    (a, b) =>
      (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0) ||
      a.id.localeCompare(b.id),
  );
}
export function evidenceForLead(lead: any): BuyingEvidence[] {
  return lead.buyingEvidence ?? projectBuyingEvidence([], lead);
}
export function actualSignalValues(lead: any) {
  return values(
    evidenceForLead(lead)
      .filter((e) => e.kind === "sales" || e.kind === "chat")
      .map((e) => e.value),
  );
}
export function worklistSignal(lead: any) {
  const all = evidenceForLead(lead);
  const actual = all.filter((e) => e.kind === "sales" || e.kind === "chat");
  const interests = all.filter((e) => e.kind === "questionnaire");
  const pool = actual.length ? actual : interests.length ? interests : all;
  return pool.length
    ? { evidence: pool[0], more: values(pool.map((e) => e.value)).length - 1 }
    : null;
}
export function buyingEvidenceLabel(
  e: Pick<BuyingEvidence, "kind" | "value">,
  lang: string,
) {
  if (e.value === "Booking requested")
    return lang === "zh"
      ? "请求预约试听"
      : lang === "id"
        ? "Meminta jadwal kelas percobaan"
        : "Trial booking requested";
  if (e.kind === "chat" && e.value === "Ready to enroll")
    return lang === "zh"
      ? "明确请求报名"
      : lang === "id"
        ? "Meminta pendaftaran"
        : "Enrollment requested";
  return historyBuyingLabel(
    e.value,
    e.kind === "questionnaire" ? "questionnaire" : "sales",
    lang,
  );
}
export function evidenceHeading(kind: BuyingEvidence["kind"], lang: string) {
  const labels = {
    questionnaire: [
      "Questionnaire interests",
      "Minat dalam kuesioner",
      "问卷关注内容",
    ],
    sales: ["Buying intent signals", "Sinyal minat pembelian", "购买意向信号"],
    chat: ["Buying intent signals", "Sinyal minat pembelian", "购买意向信号"],
    legacy: [
      "Historical labels · evidence unavailable",
      "Label historis · bukti tidak tersedia",
      "历史标签 · 依据待核实",
    ],
  };
  return labels[kind][lang === "zh" ? 2 : lang === "id" ? 1 : 0];
}
