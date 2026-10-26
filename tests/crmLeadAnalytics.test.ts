import { test } from "node:test";
import assert from "node:assert/strict";
import { processMetrics } from "../src/utils/crmProcessMetrics";
import {
  metricSelections,
  matchesLeadMetric,
  DAY,
} from "../src/utils/crmLeadAnalytics";
import {
  filterAndSummarize,
  defaultLeadFilters,
  filterQuery,
  parseLeadFilters,
} from "../src/utils/crmLeadFilters";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmProcessOverview } from "../src/components/crm/CrmProcessOverview";
const now = Date.parse("2026-10-26T12:00:00Z"),
  iso = (delta: number) => new Date(now + delta).toISOString();
const contact = (
  id: string,
  result = "No Response",
  delta = -DAY,
  direction = "sales",
) => ({
  id,
  recordKind: "contact",
  connectStatus: result,
  contactDirection: direction,
  occurredAt: iso(delta),
  timestamp: iso(0),
  summary: "已通过WhatsApp联系客户。",
});
const base = (id: string, extra: any = {}) => ({
  id,
  fullName: "Maya Putri",
  owner: "sales-a",
  submittedAt: iso(-3 * DAY),
  currentStage: "progress:discovery",
  stagePolicyVersion: 2,
  stageEffectiveAt: iso(-DAY),
  followUpLogs: [],
  attention: { tasks: [] },
  ...extra,
});
test("overview uses only first requirements, distinct customers and independent contact facts", () => {
  const rows = [
    base("maya", {
      followUpLogs: [contact("a")],
      attention: {
        tasks: [
          { kind: "consultation", status: "open", dueAt: iso(-1000) },
          { kind: "consultation", status: "overdue", dueAt: iso(-2000) },
          { kind: "handoff", status: "open", dueAt: iso(-DAY) },
        ],
      },
    }),
    base("rina", {
      followUpLogs: [contact("b", "Connected")],
      firstFollowup: {
        outcome: "connected",
        at: iso(-1000),
        dueAt: iso(-2000),
      },
    }),
    base("sari", {
      attention: {
        tasks: [{ kind: "booking", status: "open", dueAt: iso(-DAY) }],
      },
    }),
  ];
  const before = JSON.stringify(rows),
    m = processMetrics(rows, now);
  assert.equal(m.customers, 3);
  assert.equal(m.firstPending, 1);
  assert.equal(m.firstOverdue, 1);
  assert.equal(m.engagedCustomers, 1);
  assert.equal(m.firstTimed, 2);
  assert.equal(m.firstOnTime, 0);
  assert.equal(m.attempts, 2);
  assert.equal(JSON.stringify(rows), before);
});
test("actual contact duration ignores recording time; customer replies do not become proactive outreach", () => {
  const m = processMetrics(
    [
      base("maya", {
        followUpLogs: [
          contact("a", "No Response", -2 * DAY),
          contact("b", "Connected", -DAY, "customer"),
        ],
      }),
    ],
    now,
  );
  assert.equal(m.firstContactMedianMs, DAY);
  assert.equal(m.firstResponseMedianMs, 2 * DAY);
  assert.equal(m.firstContactSamples, 1);
  assert.equal(m.connectedRecords, 1);
});
test("unknown and before-registration contacts stay out of durations and never become zero", () => {
  const m = processMetrics(
    [
      base("maya", {
        followUpLogs: [
          { ...contact("a"), occurredAt: null },
          contact("b", "Connected"),
        ],
      }),
      base("rina", { followUpLogs: [contact("c", "Connected", -4 * DAY)] }),
    ],
    now,
  );
  assert.equal(m.firstContactSamples, 0);
  assert.equal(m.contactTimeUnknown, 1);
  assert.equal(m.contactBeforeRegistration, 1);
  assert.equal(m.firstResponseSamples, 1);
  assert.equal(m.responseBeforeRegistration, 1);
  const empty = processMetrics([], now);
  assert.equal(empty.firstContactMedianMs, null);
  assert.equal(empty.firstTimed, 0);
});
test("customer activity 168h boundary uses customer events, excludes AI replies, future and unknown time", () => {
  const events = [
    base("a", {
      interactionTimeline: {
        customer: { at: iso(-7 * DAY) },
        sales: null,
        communication: null,
      },
    }),
    base("b", {
      interactionTimeline: {
        customer: { at: iso(-7 * DAY - 1) },
        sales: null,
        communication: null,
      },
    }),
    base("c", {
      interactionTimeline: {
        customer: { recordedAt: iso(0) },
        sales: null,
        communication: null,
      },
    }),
    base("d", {
      interactionTimeline: {
        customer: { at: iso(1) },
        sales: null,
        communication: null,
      },
    }),
    base("e", { followUpLogs: [contact("s", "Connected", -1000)] }),
  ];
  const m = processMetrics(events, now);
  assert.equal(m.recentCustomer, 1);
  assert.equal(m.customerTimeUnknown, 2);
  assert.equal(m.breakdown.sales_connected, 1);
});
test("linked correction removes conversation, without altering original text or actual outreach time", () => {
  const lead = base("maya", {
    followUpLogs: [contact("a", "Connected")],
    recordAmendments: [
      {
        id: "fix",
        kind: "correction",
        targetLogId: "a",
        contactResult: "No Response",
      },
    ],
  });
  const original = JSON.stringify(lead),
    m = processMetrics([lead], now);
  assert.equal(m.engagedCustomers, 0);
  assert.equal(m.breakdown.sales_unanswered, 1);
  assert.equal(m.firstPending, 0);
  assert.equal(JSON.stringify(lead), original);
});
test("stage distributions keep seven stages and unknown distinct; closed and enrolled do not enter ongoing aging", () => {
  const m = processMetrics(
    [
      base("maya"),
      base("rina", { currentStage: "New" }),
      base("sari", { currentStage: "progress:closed" }),
      base("dewi", { currentStage: "progress:enrolled" }),
    ],
    now,
  );
  assert.equal(m.stages.length, 8);
  assert.equal(
    m.stages.reduce((n, r) => n + r.customers, 0),
    4,
  );
  assert.equal(m.stages.find((r) => r.stage === "__unknown")?.customers, 1);
  assert.equal(m.stageSamples, 1);
  assert.equal(m.stageMedianMs, DAY);
});
test("all metric drilldowns match counters, preserve AND/OR and enforce owner scope before aggregates", () => {
  const rows = [
    base("maya", { followUpLogs: [contact("a", "Connected")] }),
    base("rina", { owner: "sales-b", followUpLogs: [contact("b")] }),
    base("sari"),
  ];
  const metrics = processMetrics(rows, now);
  for (const key of Object.keys(metricSelections)) {
    const f = { ...defaultLeadFilters("all"), overview: [key] };
    const q = parseLeadFilters(
      Object.fromEntries(new URLSearchParams(filterQuery(f))),
    );
    assert.deepEqual(q.overview, [key]);
    const result = filterAndSummarize(rows, f, "sales-a", "Asia/Jakarta", now);
    assert.equal(result.total, metrics.breakdown[key], key);
  }
  const own = filterAndSummarize(
    rows,
    { ...defaultLeadFilters("own"), overview: ["sales_unanswered"] },
    "sales-a",
    "Asia/Jakarta",
    now,
  );
  assert.equal(own.total, 0);
  assert.throws(() => parseLeadFilters({ overview: "anything" }));
});
test("overview never represents AI replies or manual stage as a real contact, renders accessible cohort analysis", () => {
  const m = processMetrics(
    [
      base("maya", {
        owner: "刘 Alice",
        chatTranscript: [{ role: "assistant", content: "你好" }],
      }),
    ],
    now,
  );
  assert.equal(m.engagedCustomers, 0);
  const html = renderToStaticMarkup(
    createElement(CrmProcessOverview, {
      metrics: m,
      lang: "zh",
      isLight: true,
      timezone: "Asia/Jakarta",
      leader: true,
      employees: [{ id: "刘 Alice", displayName: "刘 Alice" }],
      onMetric: () => {},
      onStage: () => {},
    }),
  );
  for (const label of [
    "当前客户",
    "首次联系未完成",
    "近7天客户互动",
    "有效沟通覆盖",
    "当前阶段分布",
    "联系与推进分析",
    "有效样本",
    "刘 Alice",
  ])
    assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /无效／撤回|首条人工联系记录|正在生成任务/);
  assert.match(html, /aria-pressed/);
});

test("successive metric selections intersect the current cohort instead of replacing its condition", () => {
  const rows = [
    base("maya", {
      followUpLogs: [contact("a", "Connected")],
      interactionTimeline: {
        customer: { at: iso(-DAY) },
        sales: null,
        communication: { result: "Connected" },
      },
    }),
    base("rina", {
      interactionTimeline: {
        customer: { at: iso(-DAY) },
        sales: null,
        communication: null,
      },
    }),
    base("sari", { followUpLogs: [contact("c", "Connected")] }),
  ];
  const first = filterAndSummarize(
    rows,
    { ...defaultLeadFilters("all"), overview: ["communication"] },
    "sales-a",
    "Asia/Jakarta",
    now,
  );
  const expected = processMetrics(first.leads, now).recentCustomer;
  const both = filterAndSummarize(
    rows,
    {
      ...defaultLeadFilters("all"),
      overview: ["communication", "recent_customer"],
    },
    "sales-a",
    "Asia/Jakarta",
    now,
  );
  assert.equal(expected, 1);
  assert.equal(both.total, expected);
  const parsed = parseLeadFilters({
    overview: ["communication", "recent_customer", "communication"],
  });
  assert.deepEqual(parsed.overview, ["communication", "recent_customer"]);
});

test('sales can read timing and stages without receiving manager-only owner comparisons',()=>{
 const m=processMetrics([base('maya',{owner:'manager-only-name'})],now);
 const html=renderToStaticMarkup(createElement(CrmProcessOverview,{metrics:m,lang:'zh',isLight:true,timezone:'Asia/Jakarta',leader:false,employees:[{id:'manager-only-name',displayName:'经理分组姓名'}],onMetric:()=>{},onStage:()=>{}}));
 assert.match(html,/首次实际主动联系|当前阶段停留/);assert.doesNotMatch(html,/按当前负责人查看|经理分组姓名/);
});

// Native MySQL adapters return Date objects before JSON serialization.
test('native database dates and HTTP ISO dates produce identical deadline metrics',()=>{const base={id:'native',currentStage:'progress:unreached',attention:{tasks:[{kind:'consultation',status:'open',dueAt:new Date(now-1000)}]}};const native=processMetrics([base],now),http=processMetrics([JSON.parse(JSON.stringify(base))],now);assert.deepEqual(native,http);assert.equal(native.firstOverdue,1);assert.equal(native.firstDeadlineUnknown,0);const future=processMetrics([{...base,attention:{tasks:[{kind:'consultation',status:'open',dueAt:new Date(now+1000)}]}}],now);assert.equal(future.firstOverdue,0);assert.equal(future.firstDeadlineUnknown,0);const invalid=processMetrics([{...base,attention:{tasks:[{kind:'consultation',status:'open',dueAt:new Date(NaN)}]}}],now);assert.equal(invalid.firstDeadlineUnknown,1);});
