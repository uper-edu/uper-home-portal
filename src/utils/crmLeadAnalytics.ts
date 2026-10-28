import { effectiveContactRecords } from "./crmRecordAmendments";
import {
  interactionInstant,
  projectInteractionTimeline,
} from "./crmInteractionTimeline";
import { isSalesProgressStage } from "./crmSalesProgress";
export const DAY = 86400000;
export function metricTime(value: unknown, now = Infinity): number | null {
  const at = interactionInstant(value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : value);
  return at && Date.parse(at) <= now ? Date.parse(at) : null;
}
export const metricSelections = {
  first_pending: [
    "首次联系未完成",
    "First contact pending",
    "Kontak pertama belum selesai",
  ],
  first_overdue: [
    "首次联系已逾期",
    "First contact overdue",
    "Kontak pertama terlambat",
  ],
  recent_customer: [
    "近7天互动客户",
    "Customers with interactions · 7 days",
    "Pelanggan yang berinteraksi · 7 hari",
  ],
  communication: ["有有效沟通记录", "With conversation", "Ada komunikasi"],
  no_communication: [
    "暂无有效沟通记录",
    "No conversation recorded",
    "Belum ada komunikasi",
  ],
  sales_connected: [
    "最近销售联系：已接通／已回复",
    "Latest outreach: connected",
    "Kontak terakhir terhubung",
  ],
  sales_unanswered: [
    "最近销售联系：未接通／未回复",
    "Latest outreach: unanswered",
    "Kontak terakhir tanpa balasan",
  ],
  sales_wrong_number: [
    "最近销售联系：号码异常",
    "Latest outreach: invalid number",
    "Nomor bermasalah",
  ],
  sales_none: [
    "暂无销售联系记录",
    "No outreach recorded",
    "Belum ada kontak penjualan",
  ],
  contact_fast: [
    "首次主动联系：1小时内",
    "First outreach within 1h",
    "Kontak pertama dalam 1 jam",
  ],
  contact_day: [
    "首次主动联系：1–24小时",
    "First outreach 1–24h",
    "Kontak pertama 1–24 jam",
  ],
  contact_later: [
    "首次主动联系：超过24小时",
    "First outreach over 24h",
    "Kontak pertama lebih dari 24 jam",
  ],
  contact_unknown: [
    "首次主动联系时长不可计算",
    "First outreach duration unavailable",
    "Durasi kontak pertama tidak tersedia",
  ],
  response_fast: [
    "首次有效沟通：1小时内",
    "First conversation within 1h",
    "Komunikasi pertama dalam 1 jam",
  ],
  response_day: [
    "首次有效沟通：1–24小时",
    "First conversation 1–24h",
    "Komunikasi pertama 1–24 jam",
  ],
  response_later: [
    "首次有效沟通：超过24小时",
    "First conversation over 24h",
    "Komunikasi pertama lebih dari 24 jam",
  ],
  response_unknown: [
    "首次有效沟通时长不可计算",
    "First conversation duration unavailable",
    "Durasi komunikasi pertama tidak tersedia",
  ],
  outreach_day: [
    "上次销售联系：不足1天",
    "Last outreach under 1 day",
    "Kontak terakhir kurang dari 1 hari",
  ],
  outreach_week: [
    "上次销售联系：1–7天",
    "Last outreach 1–7 days",
    "Kontak terakhir 1–7 hari",
  ],
  outreach_month: [
    "上次销售联系：7–30天",
    "Last outreach 7–30 days",
    "Kontak terakhir 7–30 hari",
  ],
  outreach_old: [
    "上次销售联系：30天以上",
    "Last outreach 30+ days",
    "Kontak terakhir lebih dari 30 hari",
  ],
  outreach_unknown: [
    "销售联系实际时间未知",
    "Outreach time unknown",
    "Waktu kontak tidak diketahui",
  ],
} as const;
export type MetricSelection = keyof typeof metricSelections;
export function metricSelectionLabel(key: string, lang = "zh") {
  const labels = metricSelections[key as MetricSelection];
  return labels ? labels[lang === "zh" ? 0 : lang === "id" ? 2 : 1] : key;
}
export function leadAnalyticRow(lead: any, now: number) {
  const records = effectiveContactRecords(lead).filter(
    (l) =>
      !["internal", "closure"].includes(l.recordKind) &&
      ["Connected", "No Response", "Wrong Number"].includes(l.connectStatus),
  );
  const sales = records.filter((l) => l.contactDirection === "sales"),
    connected = records.filter((l) => l.connectStatus === "Connected");
  const timeline = lead.interactionTimeline || projectInteractionTimeline(lead),
    registered = metricTime(lead.submittedAt, now);
  const interval = (logs: any[]) => {
    const known = logs.map((l) => metricTime(l.occurredAt, now));
    const missing = known.some((t) => t === null);
    const first = known
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b)[0];
    const before =
      registered !== null && first !== undefined && first < registered;
    return {
      ms:
        !missing && registered !== null && first !== undefined && !before
          ? first - registered
          : null,
      unknown: logs.length > 0 && (missing || registered === null),
      before,
    };
  };
  const contact = interval(sales),
    response = interval(connected);
  const firstTasks = (lead.attention?.tasks || []).filter(
    (t: any) =>
      t.kind === "consultation" && ["open", "overdue"].includes(t.status),
  );
  const overdue = firstTasks.some((t: any) => {
    const due = metricTime(t.dueAt);
    return due !== null && due < now;
  });
  const outcome = lead.firstFollowup?.outcome,
    normal = ["attempted", "connected"].includes(outcome),
    processed = metricTime(lead.firstFollowup?.at, now),
    due = metricTime(lead.firstFollowup?.dueAt);
  const onTime =
    normal && processed !== null && due !== null ? processed <= due : null;
  const stage = isSalesProgressStage(lead.currentStage)
    ? lead.currentStage
    : "__unknown";
  const stageAt =
    lead.stagePolicyVersion === 2
      ? metricTime(lead.stageEffectiveAt, now)
      : null;
  const stageEligible = ![
    "__unknown",
    "progress:enrolled",
    "progress:closed",
  ].includes(stage);
  const salesAt = metricTime(timeline.sales?.at, now),
    customerAt = metricTime(timeline.customer?.at, now);
  return {
    id: lead.id,
    owner: lead.owner || "",
    stage,
    unassigned: !lead.owner,
    firstPending: firstTasks.length > 0,
    firstOverdue: overdue,
    firstDeadlineUnknown: firstTasks.some(
      (t: any) => metricTime(t.dueAt) === null,
    ),
    firstOnTime: onTime === true,
    firstTimed: onTime !== null || overdue,
    firstExceptions: ["invalid_contact", "exception"].includes(outcome),
    firstTimingUnknown: normal && onTime === null,
    recentCustomer: customerAt !== null && customerAt >= now - 7 * DAY,
    customerTimeUnknown: !!timeline.customer && customerAt === null,
    engaged: connected.length > 0,
    connectedRecords: connected.length,
    attempts: sales.length,
    contactMs: contact.ms,
    responseMs: response.ms,
    contactTimeUnknown: contact.unknown,
    responseUnknown: response.unknown,
    contactBeforeRegistration: contact.before,
    responseBeforeRegistration: response.before,
    salesResult: timeline.sales?.result || "",
    hasSales: !!timeline.sales,
    salesElapsed: salesAt !== null ? now - salesAt : null,
    stageMs: stageEligible && stageAt !== null ? now - stageAt : null,
    stageTimeUnknown:
      stage === "__unknown" || (stageEligible && stageAt === null),
  };
}
export function matchesMetricRow(
  r: ReturnType<typeof leadAnalyticRow>,
  key: string,
) {
  const band = (v: number | null, kind: string) =>
    v !== null &&
    (kind === "fast"
      ? v < 3600000
      : kind === "day"
        ? v >= 3600000 && v < DAY
        : v >= DAY);
  switch (key) {
    case "first_pending":
      return r.firstPending;
    case "first_overdue":
      return r.firstOverdue;
    case "recent_customer":
      return r.recentCustomer;
    case "communication":
      return r.engaged;
    case "no_communication":
      return !r.engaged;
    case "sales_connected":
      return r.salesResult === "Connected";
    case "sales_unanswered":
      return r.salesResult === "No Response";
    case "sales_wrong_number":
      return r.salesResult === "Wrong Number";
    case "sales_none":
      return !r.hasSales;
    case "contact_unknown":
      return r.attempts > 0 && r.contactMs === null;
    case "response_unknown":
      return r.engaged && r.responseMs === null;
    case "outreach_day":
      return r.salesElapsed !== null && r.salesElapsed < DAY;
    case "outreach_week":
      return (
        r.salesElapsed !== null &&
        r.salesElapsed >= DAY &&
        r.salesElapsed < 7 * DAY
      );
    case "outreach_month":
      return (
        r.salesElapsed !== null &&
        r.salesElapsed >= 7 * DAY &&
        r.salesElapsed < 30 * DAY
      );
    case "outreach_old":
      return r.salesElapsed !== null && r.salesElapsed >= 30 * DAY;
    case "outreach_unknown":
      return r.hasSales && r.salesElapsed === null;
    default:
      if (key.startsWith("contact_")) return band(r.contactMs, key.slice(8));
      if (key.startsWith("response_")) return band(r.responseMs, key.slice(9));
      return false;
  }
}
export const matchesLeadMetric = (lead: any, key: string, now: number) =>
  matchesMetricRow(leadAnalyticRow(lead, now), key);
