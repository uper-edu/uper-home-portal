export type ContactState = "active" | "waiting" | "nurture" | "stopped";
export function contactStatistics(lead: any) {
  const logs = (lead.followUpLogs || [])
    .filter(
      (l: any) =>
        l.recordKind !== "closure" &&
        l.timestampKnown !== false &&
        ["Connected", "No Response", "Wrong Number"].includes(
          l.connectStatus,
        ) &&
        Number.isFinite(Date.parse(l.timestamp || l.at)) &&
        Date.parse(l.timestamp || l.at) > 0,
    )
    .sort(
      (a: any, b: any) =>
        Date.parse(b.timestamp || b.at) - Date.parse(a.timestamp || a.at),
    );
  const connected = logs.filter((l: any) => l.connectStatus === "Connected");
  return {
    attemptCount: logs.length,
    connectedCount: connected.length,
    lastAttempt: logs[0] || null,
    lastConnected: connected[0] || null,
  };
}
export function contactPaused(lead: any) {
  return ["waiting", "nurture", "stopped"].includes(
    lead.contactArrangement?.state,
  );
}
export function needsHandling(
  lead: any,
  now: number,
  day: (n: number) => string,
) {
  if (!lead.attention) return true;
  const tasks = (lead.attention.tasks || []).filter((t: any) =>
    ["open", "overdue", "migration_hold"].includes(t.status),
  );
  const ordinary = tasks.filter((t: any) => t.kind !== "contact_review");
  if (
    tasks.some(
      (t: any) =>
        t.status === "migration_hold" || !Number.isFinite(Date.parse(t.dueAt)),
    )
  )
    return true;
  if (contactPaused(lead))
    return (
      ordinary.length > 0 ||
      tasks.some((t: any) => Date.parse(t.dueAt) <= now) ||
      ([
        "conversation.updated",
        "conversation.reactivated",
        "handoff.requested",
      ].includes(lead.attention.latest?.type) &&
        Date.parse(lead.attention.latest.at) >
          Date.parse(lead.contactArrangement.at))
    );
  if (
    tasks.some(
      (t: any) =>
        Date.parse(t.dueAt) < now ||
        day(Date.parse(t.dueAt)) === day(now) ||
        ["handoff", "booking", "enrollment"].includes(t.kind),
    )
  )
    return true;
  if (["Enrolled", "Lost"].includes(lead.currentStage)) return false;
  return (
    !lead.lastContactedAt ||
    !tasks.length ||
    lead.followUpDisposition?.kind === "none"
  );
}
export function greeting(language: string, name: string, advisor: string) {
  if (language === "zh")
    return `您好，${name}！我是 UPER Education 的 ${advisor}。感谢您的咨询，可以先确认您的学习需求和方便联系的时间吗？`;
  if (language === "id")
    return `Halo ${name}! Saya ${advisor} dari UPER Education. Terima kasih telah menghubungi kami. Boleh saya mengonfirmasi kebutuhan belajar dan waktu yang sesuai untuk Anda?`;
  if (language === "en")
    return `Hello ${name}! I'm ${advisor} from UPER Education. Thank you for your inquiry. May I confirm your learning needs and a convenient time to contact you?`;
  return "";
}
