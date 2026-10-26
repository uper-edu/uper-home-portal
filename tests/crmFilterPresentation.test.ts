import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CrmLeadFilters } from "../src/components/crm/CrmLeadFilters";
import {
  defaultLeadFilters,
  leadMatches,
  restoreLeadFilters,
  parseLeadFilters,
} from "../src/utils/crmLeadFilters";
import {
  clearLeadConditions,
  leadConditionCount,
} from "../src/utils/crmFilterPresentation";
const now = Date.parse("2026-10-26T12:00:00Z");
const matches = (lead: any, patch: any) =>
  leadMatches(
    lead,
    { ...defaultLeadFilters("all"), ...patch },
    "sales",
    "Asia/Jakarta",
    now,
  );
test("clear conditions retains sorting; role default restores mine without hidden needs-handling restriction", () => {
  const f = {
    ...defaultLeadFilters("own"),
    search: "Maya",
    task: "overdue",
    sort: "activity",
    tier: ["Hot"],
    stage: ["progress:proposal"],
  };
  const c = clearLeadConditions(f);
  assert.equal(c.sort, "activity");
  assert.equal(c.ownership, "all");
  assert.equal(leadConditionCount(c), 0);
  assert.equal(defaultLeadFilters("own").ownership, "mine");
  assert.equal(defaultLeadFilters("own").workScope, "all");
  assert.equal(f.search, "Maya");
});
test("latest sales result uses the same timeline as the list, not stale profile status or customer reply", () => {
  const lead = {
    connectStatus: "Connected",
    interactionTimeline: {
      sales: { result: "No Response", at: "2026-10-25T12:00:00Z" },
      communication: null,
      customer: null,
    },
  };
  assert.equal(matches(lead, { connect: ["No Response"] }), true);
  assert.equal(matches(lead, { connect: ["Connected"] }), false);
  assert.equal(matches(lead, { connect: ["__unknown"] }), false);
  assert.equal(
    matches({ connectStatus: "Connected" }, { connect: ["__unknown"] }),
    true,
  );
  assert.equal(
    matches(
      {
        ...lead,
        interactionTimeline: {
          sales: null,
          communication: { result: "Connected" },
        },
      },
      { connect: ["__unknown"] },
    ),
    true,
  );
});
test("requests match the evidenced categories visible in the list; unsupported tags and completed assessment excluded", () => {
  const lead = {
    buyingEvidence: [
      {
        id: "a",
        kind: "sales",
        value: "Advisor requested",
        at: "2026-10-26T10:00:00Z",
      },
      { id: "b", kind: "legacy", value: "Asked price" },
      {
        id: "c",
        kind: "sales",
        value: "Trial interest",
        correctedBy: "correction",
      },
      { id: "d", kind: "sales", value: "Assessment Done" },
    ],
  };
  assert.equal(matches(lead, { signal: ["Advisor requested"] }), true);
  assert.equal(matches(lead, { signal: ["Asked price"] }), false);
  assert.equal(matches(lead, { signal: ["Trial interest"] }), false);
  assert.equal(
    matches(
      {
        buyingEvidence: [
          { id: "q", kind: "questionnaire", value: "Asked schedule" },
        ],
      },
      { signal: ["Asked schedule"] },
    ),
    true,
  );
  assert.equal(
    matches({ buyingSignal: "Asked price" }, { signal: ["__unknown"] }),
    true,
  );
});
test("restore validates conditions and removes retired filters instead of mapping old stages", () => {
  const f = restoreLeadFilters(
    {
      ...defaultLeadFilters("own"),
      stage: ["New", "progress:proposal"],
      connect: ["Interested"],
      situation: ["historical"],
      signal: ["None yet"],
      workScope: "action",
    },
    "own",
  );
  assert.deepEqual(f.stage, ["progress:proposal"]);
  assert.deepEqual(f.connect, []);
  assert.deepEqual(f.situation, []);
  assert.deepEqual(f.signal, []);
  assert.equal(f.workScope, "all");
  assert.equal(f.ownership, "mine");
  assert.throws(() => parseLeadFilters({ stage: "New" }));
});
test("all active conditions remain visible with primary selectors and accessible remove controls", () => {
  const html = renderToStaticMarkup(
    createElement(CrmLeadFilters, {
      value: {
        ...defaultLeadFilters("all"),
        ownership: "unassigned",
        stage: ["progress:proposal"],
        mode: ["Online"],
        signal: ["Advisor requested"],
      },
      onChange: () => {},
      lang: "zh",
      scope: "all",
      owners: [],
      count: 2,
      loading: false,
      timezone: "Asia/Jakarta",
      viewMode: "worklist",
      onViewMode: () => {},
    }),
  );
  for (const text of [
    "销售阶段 · 方案确认中",
    "首次联系 · 不限",
    "已选条件",
    "移除负责人：未分配",
    "移除授课方式：线上",
    "移除客户诉求／意向：请求顾问联系",
    "清空条件",
    "恢复默认筛选",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes("历史联系状态"));
  assert.ok(!html.includes("历史与兼容条件"));
});
