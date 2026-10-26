import {listAssessmentConclusion} from '../src/utils/crmLeadPresentation.ts';
import {CrmAssessmentEvidence} from '../src/components/crm/CrmAssessmentEvidence.tsx';
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CrmLeadWorkspace,
  type LeadWorkspaceProps,
} from "../src/components/crm/CrmLeadWorkspace.tsx";
import {
  CrmCustomerProfile,
  CrmCustomerAssessment,
} from "../src/components/crm/CrmCustomerDetails.tsx";
import {
  validCustomerFields,
  workspaceAssessment,
  buyingSignals,
} from "../src/utils/crmWorkspace.ts";
import { crmAssessmentSummary } from "../src/utils/crmAssessment.ts";
import type { CrmLeadRecord } from "../src/types/crmLead.ts";

const lead = (extra = {}) =>
  ({
    id: "synthetic-workspace",
    fullName: "TEST 原名",
    businessNumber: "TEST-001",
    owner: "Fadhil",
    goal: "Work in China",
    reportedLevel: "Not sure",
    city: "Jakarta",
    mode: "Online",
    tier: "Hot",
    tierSource: "buying_signal",
    currentStage: "Contacted",
    buyingSignal: "Asked price",
    submittedAt: "2026-10-13T01:00:00Z",
    followUpLogs: [],
    nextAction: "原始备注 unchanged",
    attention: {
      unreadCount: 1,
      observedAt: "2026-10-13T02:00:00Z",
      tasks: [
        {
          id: "task",
          kind: "booking",
          ownerId: "Wigar",
          status: "open",
          dueAt: "2026-10-14T05:00:00Z",
        },
      ],
    },
    ...extra,
  }) as CrmLeadRecord;
function render(value: CrmLeadRecord, patch: Partial<LeadWorkspaceProps> = {}) {
  return renderToStaticMarkup(
    React.createElement(CrmLeadWorkspace, {
      leads: [value],
      view: "worklist",
      lang: "en",
      isLight: true,
      timezone: "Asia/Jakarta",
      loading: false,
      employeeId: "Robert",
      employees: [
        { id: "Fadhil", displayName: "Fadhil" },
        { id: "Wigar", displayName: "Wigar" },
      ],
      onOpen() {},
      onReset() {},
      ...patch,
    }),
  );
}
test("worklist scans four zones, retaining original names, one next task, its actual owner, and a separate note entry", () => {
  const l = lead(),
    before = JSON.stringify(l),
    html = render(l);
  for (const name of [
    "Customer",
    "Learning needs",
    "Sales progress",
    "Interaction and follow-up",
    "TEST 原名",
    "Fadhil",
    "Wigar",
    "Confirm booking",
    "Manual note available",
  ])
    assert.ok(html.includes(name), name);
  assert.equal((html.match(/Confirm booking/g) || []).length, 1);
  assert.doesNotMatch(html, /<table|1970|原始备注 unchanged/);
  assert.equal(JSON.stringify(l), before);
});
test("field table and worklist preserve the same assessment conclusion and real task deadline without treating a memo as a task", (context) => {
  context.mock.method(Date, "now", () => Date.parse("2026-10-13T01:00:00Z"));
  const l = lead({
    levelSource: "trial",
    levelConfirmed: "HSK 2",
    quizScore: 100,
    quizMaxScore: 100,
  });
  const work = render(l),
    table = render(l, { view: "table" });
  for (const html of [work, table]) {
    assert.match(html, /HSK 2/);
    assert.match(html, /Teacher placement/);
    assert.match(html, /2026-10-14 12:00/);
    assert.doesNotMatch(html, /100\/100|✓/);
  }
  assert.match(table, /原始备注 unchanged/);
});
test("presentation preferences cannot remove customer identity or admit stale/unknown fields", () => {
  assert.deepEqual(validCustomerFields(["stage", "owner", "stage", "secret"]), [
    "number",
    "name",
    "owner",
    "stage",
  ]);
  assert.ok(validCustomerFields(null).includes("name"));
  assert.ok(validCustomerFields([]).includes("number"));
});
test("compact assessment comes from the existing evidence presenter, with score omitted only in the scanning view", () => {
  const l = lead({
    latestAssessment: {
      attempt: { mode: "express" },
      score: 12,
      maxScore: 30,
      screeningPlacement: {
        policyVersion: "screening-15-startpoint-v1",
        stage: 1,
        suggestedStartLevel: 2,
        needsReview: true,
      },
    },
    levelSource: "assessment",
  });
  for (const lang of ["en", "zh"] as const) {
    const brief = workspaceAssessment(l, lang),
      full = crmAssessmentSummary(l, lang);
    assert.equal(brief.conclusion, full.conclusion);
    assert.equal(brief.detail, full.detail);
    assert.ok(!brief.source.includes("12"));
    assert.ok(render(l, { lang }).includes(listAssessmentConclusion(brief.conclusion,lang)));
  }
});
test("missing tasks and historical dates do not become an empty or overdue task; unavailable times stay unknown", () => {
  assert.match(render(lead({ attention: undefined })), /Follow-up information unavailable/);
  const l = lead({
    attention: {
      tasks: [
        {
          id: "old",
          kind: "consultation",
          status: "migration_hold",
          dueAt: "1970-01-01",
          ownerId: null,
        },
      ],
      unreadCount: 0,
    },
  });
  assert.match(render(l), /Historical task: review required/);
  assert.doesNotMatch(render(l), /1970|Overdue/);
});
test("profile includes ownership, source and outcome without inventing enrollment payment or changing source values", () => {
  const l = lead({
      revenue: 0,
      outcome: "Enrolled",
      campaign: "Demo Campaign",
      parentContact: "TEST PARENT",
    }),
    before = JSON.stringify(l);
  const html = renderToStaticMarkup(
    React.createElement(CrmCustomerProfile, {
      lead: l,
      lang: "zh",
      timezone: "Asia/Jakarta",
      ownership: React.createElement("span", null, "Fadhil"),
    }),
  );
  for (const label of [
    "销售进展",
    "获客来源与活动记录",
    "登记金额",
    "Demo Campaign",
    "TEST PARENT",
    "原名",
  ])
    assert.ok(html.includes(label));
  assert.doesNotMatch(html, /已付款|Work in China|Asked price/);
  assert.equal(JSON.stringify(l), before);
});
test("assessment panel keeps teacher evidence separate and does not substitute registration time for missing completion time", () => {
  const l = lead({
    levelSource: "trial",
    levelConfirmed: "HSK 2",
    latestAssessment: {
      attempt: { mode: "full" },
      score: 100,
      maxScore: 100,
      skippedCount: 0,
      unansweredCount: 0,
      thresholds: [
        { level: "HSK 1", reached: true },
        { level: "HSK 2", reached: true },
        { level: "HSK 3", reached: true },
      ],
    },
  });
  const html = renderToStaticMarkup(
    React.createElement(CrmAssessmentEvidence, {
      lead: l,
      lang: "en",
      timezone: "Asia/Jakarta",
    }),
  );
  assert.match(html, /Teacher placement/);
  assert.match(html, /Latest assessment · separate evidence/);
  assert.match(html, /Full assessment · 100\/100 pts/);
  assert.match(html, /Unknown time/);
  assert.doesNotMatch(html, /2026-10-13/);
  assert.match(html, /<dt>Skipped<\/dt><dd>0<\/dd>/);
  assert.match(html, /<dt>Unanswered<\/dt><dd>0<\/dd>/);
});
test("buying signals remain original evidence, deduplicated only for display", () => {
  const l = lead({
      buyingSignals: [
        "Asked price",
        "None yet",
        "Asked schedule",
        "Asked price",
      ],
    }),
    before = JSON.stringify(l);
  assert.deepEqual(buyingSignals(l), ["Asked price", "Asked schedule"]);
  assert.equal(JSON.stringify(l), before);
});
