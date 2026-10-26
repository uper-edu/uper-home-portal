import {
  leadAnalyticRow,
  matchesMetricRow,
  metricSelections,
} from "./crmLeadAnalytics";
import { salesProgressStages } from "./crmSalesProgress";
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
/** Read-only, permission-scoped cohort. Occurrence and processing are separate clocks. */
export function processMetrics(leads: any[], now: number) {
  const rows = leads.map((l) => leadAnalyticRow(l, now));
  const summarize = (items: typeof rows) => {
    const count = (field: keyof (typeof rows)[number]) =>
      items.filter((r) => r[field] === true).length;
    const contact = items.flatMap((r) =>
        r.contactMs === null ? [] : [r.contactMs],
      ),
      response = items.flatMap((r) =>
        r.responseMs === null ? [] : [r.responseMs],
      ),
      stage = items.flatMap((r) => (r.stageMs === null ? [] : [r.stageMs]));
    return {
      customers: items.length,
      unassigned: count("unassigned"),
      firstPending: count("firstPending"),
      firstOverdue: count("firstOverdue"),
      firstDeadlineUnknown: count("firstDeadlineUnknown"),
      firstOnTime: count("firstOnTime"),
      firstTimed: count("firstTimed"),
      firstExceptions: count("firstExceptions"),
      firstTimingUnknown: count("firstTimingUnknown"),
      recentCustomer: count("recentCustomer"),
      customerTimeUnknown: count("customerTimeUnknown"),
      engagedCustomers: count("engaged"),
      connectedRecords: items.reduce((n, r) => n + r.connectedRecords, 0),
      attempts: items.reduce((n, r) => n + r.attempts, 0),
      firstContactMedianMs: median(contact),
      firstContactSamples: contact.length,
      contactTimeUnknown: count("contactTimeUnknown"),
      contactBeforeRegistration: count("contactBeforeRegistration"),
      firstResponseMedianMs: median(response),
      firstResponseSamples: response.length,
      responseUnknown: count("responseUnknown"),
      responseBeforeRegistration: count("responseBeforeRegistration"),
      stageMedianMs: median(stage),
      stageSamples: stage.length,
      stageTimeUnknown: count("stageTimeUnknown"),
      breakdown: Object.fromEntries(
        Object.keys(metricSelections).map((k) => [
          k,
          items.filter((r) => matchesMetricRow(r, k)).length,
        ]),
      ),
    };
  };
  return {
    asOf: new Date(now).toISOString(),
    ...summarize(rows),
    owners: [...new Set(rows.map((r) => r.owner))]
      .sort()
      .map((owner) => ({
        owner,
        ...summarize(rows.filter((r) => r.owner === owner)),
      })),
    stages: [...salesProgressStages.map((s) => s[0]), "__unknown"].map(
      (stage) => ({
        stage,
        ...summarize(rows.filter((r) => r.stage === stage)),
      }),
    ),
  };
}
export type ProcessMetrics = ReturnType<typeof processMetrics>;
