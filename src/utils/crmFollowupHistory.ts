/** Presentation join only: never deduplicate by text, time, actor or customer name. */
export function followupHistory(facts: any[], journey: any[]) {
  const hasQuestionnaireEvidence = facts.some(
    (f) => f.kind === "questionnaire.submitted",
  );
  const logIds = new Set(
    facts
      .filter((f) => f.kind === "followup.recorded" && f.data?.result?.logId)
      .map((f) => `log-${f.data.result.logId}`),
  );
  return [
    ...facts.map((f) => ({
      id: `fact-${f.id}`,
      at: f.created_at,
      category: f.kind.startsWith("task.")
        ? "tasks"
        : f.kind === "followup.recorded"
          ? "contact"
          : f.kind === "information.recorded"
            ? "notes"
            : "customer",
      fact: f,
    })),
    ...journey
      .filter(
        (e) =>
          !logIds.has(e.id) &&
          !e.id?.startsWith("signal-") &&
          !(hasQuestionnaireEvidence && e.id?.startsWith("intake-")),
      )
      .map((e) => ({
        id: `journey-${e.id}`,
        at: e.timestamp,
        category: e.category === "follow_up" ? "contact" : "customer",
        event: e,
      })),
  ].sort((a, b) => {
    const ta = Date.parse(a.at),
      tb = Date.parse(b.at);
    return (
      (Number.isFinite(tb) ? tb : -Infinity) -
        (Number.isFinite(ta) ? ta : -Infinity) || a.id.localeCompare(b.id)
    );
  });
}
/** Only persisted IDs establish a task relationship; never infer from note text. */
export function historyTaskReferences(row: any) {
  const d = row.fact?.data || row.event?.taskEvidence;
  if (!d) return [];
  const refs = new Map<
    string,
    { id: string; relation: string; snapshot?: any; action?: string }
  >();
  const add = (
    id: unknown,
    relation: string,
    snapshot?: any,
    action?: string,
  ) => {
    if (typeof id === "string" && id.trim())
      refs.set(id, { id, relation, snapshot, action });
  };
  add(d.taskId, "linked");
  add(d.newTaskId, "linked");
  add(d.processingTaskId, "handled");
  for (const id of d.result?.completedTaskIds || d.completeTaskIds || [])
    add(id, "completed");
  if (row.fact?.kind?.startsWith("task.")) {
    const command = row.fact.kind.slice(5);
    add(
      d.taskId,
      command,
      d.before?.id === d.taskId ? d.before : undefined,
      command === "create" ? d.action : undefined,
    );
    if (d.newTaskId && d.newTaskId !== d.taskId)
      add(d.newTaskId, "replacement", undefined, d.action);
  }
  add(d.result?.createdTaskId, "next", undefined, d.nextAction);
  return [...refs.values()];
}
export function historyTouchesTask(row: any, id: string) {
  return historyTaskReferences(row).some((ref) => ref.id === id);
}

/** Describe the recorded author, never infer authorship from a name or message wording. */
export function followupHistorySource(
  row: any,
): "customer" | "sales" | "system" | "unknown" {
  if (row.fact) {
    const actor = row.fact.actor;
    if (actor === "visitor") return "customer";
    if (["system", "worker", "automation"].includes(actor)) return "system";
    return typeof actor === "string" && actor.trim() ? "sales" : "unknown";
  }
  if (
    row.event?.id?.startsWith("signal-") &&
    row.event.actorType !== "consultant"
  )
    return "unknown";
  return (
    ({ client: "customer", consultant: "sales", system: "system" } as const)[
      row.event?.actorType as "client" | "consultant" | "system"
    ] || "unknown"
  );
}

/** Read immutable event evidence, never the customer's current profile or a matching text. */
export function historyBuyingEvidence(
  row: any,
): { kind: "questionnaire" | "sales" | "chat"; values: string[] } | null {
  const f = row.fact;
  if (f?.kind === "questionnaire.submitted") {
    const a = f.data?.answers;
    const values = [
      ...new Set<string>(
        [
          ...(Array.isArray(a?.buyingSignals) ? a.buyingSignals : []),
          a?.buyingSignal,
        ].filter(
          (v): v is string =>
            typeof v === "string" && Boolean(v.trim()) && v !== "None yet",
        ),
      ),
    ];
    return values.length ? { kind: "questionnaire", values } : null;
  }
  if (f?.kind === "task.request_evidence" && f.data?.taskId && ["booking", "enrollment"].includes(f.data?.action)) return {kind:"chat",values:[f.data.action === "booking" ? "Booking requested" : "Ready to enroll"]};
  const signal =
    f?.kind === "followup.recorded"
      ? f.data?.buyingSignalDetected
      : !f
        ? row.event?.buyingSignalDetected
        : null;
  return typeof signal === "string" && signal.trim() && signal !== "None yet"
    ? { kind: "sales", values: [signal] }
    : null;
}

export function historyBuyingLabel(
  value: string,
  kind: "questionnaire" | "sales" | "chat",
  lang: string,
) {
  if(kind === "chat") return value === "Booking requested" ? (lang === "zh" ? "请求预约试听" : lang === "id" ? "Meminta jadwal kelas percobaan" : "Trial booking requested") : (lang === "zh" ? "明确请求报名" : lang === "id" ? "Meminta pendaftaran" : "Enrollment requested");
  const labels: Record<string, [string, string, string]> =
    kind === "questionnaire"
      ? {
          "Asked schedule": [
            "Schedule & start dates",
            "Jadwal & tanggal mulai kelas",
            "开班排期与上课时间",
          ],
          "Asked price": [
            "Class fees & payment plans",
            "Biaya kelas & skema cicilan",
            "课程学费与付款方案",
          ],
          "Asked payment": [
            "Payment options",
            "Pilihan pembayaran",
            "付款方式",
          ],
          "Which level is right": [
            "Suitable starting level",
            "Level awal yang sesuai",
            "适合的起步级别",
          ],
          "Ready to enroll": ["Enrollment", "Pendaftaran kelas", "报名"],
          "Ready to enrol": ["Enrollment", "Pendaftaran kelas", "报名"],
        }
      : {
          "Asked schedule": [
            "Asked about schedule",
            "Menanyakan jadwal",
            "询问排期",
          ],
          "Asked price": ["Asked about fees", "Menanyakan biaya", "询问学费"],
          "Asked payment": [
            "Asked about payment",
            "Menanyakan pembayaran",
            "询问付款方式",
          ],
          "Which level is right": [
            "Asked about starting level",
            "Menanyakan level awal",
            "询问起步级别",
          ],
          "Ready to enroll": ["Ready to enroll", "Siap mendaftar", "准备报名"],
          "Ready to enrol": ["Ready to enroll", "Siap mendaftar", "准备报名"],
        };
  return labels[value]?.[lang === "zh" ? 2 : lang === "id" ? 1 : 0] ?? value;
}
