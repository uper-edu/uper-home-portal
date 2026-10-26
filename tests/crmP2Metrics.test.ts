import { test } from "node:test";
import assert from "node:assert/strict";
import { processMetrics } from "../src/utils/crmProcessMetrics.ts";
import { campaignMetrics } from "../src/utils/crmCampaignMetrics.ts";
import React from "react";
import { draftsFor, clearStaffDrafts } from "../src/utils/crmDrafts.ts";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmProcessOverview } from "../src/components/crm/CrmProcessOverview.tsx";
import { CrmCampaignMeasures } from "../src/components/crm/CrmCampaignMeasures.tsx";
import {
  filterAndSummarize,
  defaultLeadFilters,
} from "../src/utils/crmLeadFilters.ts";
const now = Date.parse("2026-10-14T12:00:00Z");
test("participation drafts are isolated from workflow drafts and other employees; logout clears both areas", () => {
  draftsFor("p2-sales").lead = { summary: "TEST contact" };
  draftsFor("p2-sales", "attendance").lead = { reason: "TEST participation" };
  assert.equal(draftsFor("p2-sales").lead.summary, "TEST contact");
  assert.equal(draftsFor("p2-other", "attendance").lead, undefined);
  clearStaffDrafts("p2-sales");
  assert.equal(draftsFor("p2-sales").lead, undefined);
  assert.equal(draftsFor("p2-sales", "attendance").lead, undefined);
  clearStaffDrafts("p2-sales");
  clearStaffDrafts("p2-other");
});
const base = (id: string, extra: any = {}) => ({
  id,
  owner: "Fadhil",
  currentStage: "Contacted",
  stageUpdatedAt: "2026-10-14T06:00:00Z",
  submittedAt: "2026-10-14T00:00:00Z",
  followUpLogs: [],
  attention: { tasks: [] },
  ...extra,
});
const campaign = {
  id: "p2-a",
  code: "p2-a",
  name: "TEST P2",
  nameEn: "TEST P2",
};
test("campaign measures distinguish first-touch registration, saved assessment and explicit onsite/online evidence", () => {
  const attendance = (mode: string) => ({
    campaignId: "p2-a",
    confirmed: true,
    mode,
    reason: "TEST check-in evidence",
    actor: "Fadhil",
    recordedAt: "2026-10-14T10:00Z",
  });
  const a = {
    id: "a",
    campaignId: "p2-a",
    currentStage: "Enrolled",
    assessmentProvenance: "server_recomputed_adapted_paper",
    latestAssessment: { score: 0 },
    attendanceRecords: [attendance("onsite")],
  };
  const b = {
    id: "b",
    campaignId: "p2-a",
    currentStage: "Trial Attended",
    attendanceConfirmed: true,
    quizScore: 30,
  };
  const c = {
    id: "c",
    campaignId: "elsewhere",
    campaign: "TEST P2",
    attendanceRecords: [attendance("online")],
    outcome: "Paid",
    revenue: 100,
  };
  const m = campaignMetrics([a, b, c, a], campaign);
  assert.equal(m.leadsCount, 2);
  assert.equal(m.assessedCount, 1);
  assert.equal(m.confirmedAttendanceCount, 2);
  assert.equal(m.onsiteAttendanceCount, 1);
  assert.equal(m.onlineAttendanceCount, 1);
  assert.equal(m.enrolledCount, 1);
  assert.equal(m.conversionRate, 50);
  assert.equal(m.revenueMissingCount, 1);
  assert.equal(m.totalRevenue, 0);
});
test("withdrawn or unscoped participation and empty denominators do not fabricate attendance or a zero-percent conversion", () => {
  const m = campaignMetrics(
    [
      {
        id: "a",
        campaignId: "other",
        attendanceConfirmed: true,
        attendanceRecords: [
          {
            campaignId: "p2-a",
            confirmed: false,
            mode: "onsite",
            actor: "Fadhil",
            reason: "TEST correction",
            recordedAt: "2026-10-14",
          },
        ],
      },
    ],
    campaign,
  );
  assert.equal(m.confirmedAttendanceCount, 0);
  assert.equal(m.leadsCount, 0);
  assert.equal(m.conversionRate, null);
  assert.equal(m.assessmentRate, null);
});
test("P2 process and marketing dashboards render all three languages while retaining employee names", () => {
  const name = "刘 Alice";
  const metrics = processMetrics([base("a")], now);
  for (const [lang, processLabel, campaignLabel, empty] of [
    ["en", "Current customers", "Enrollment share", "Not calculable"],
    [
      "id",
      "Pelanggan saat ini",
      "Proporsi pendaftaran kelas",
      "Tidak dapat dihitung",
    ],
    ["zh", "当前客户", "登记客户报名占比", "不可计算"],
  ] as const) {
    const process = renderToStaticMarkup(
      React.createElement(CrmProcessOverview, {
        metrics,
        lang,
        isLight: true,
        timezone: "Asia/Jakarta",
        leader: true,
        employees: [{ id: "Fadhil", displayName: name }],
      }),
    );
    const marketing = renderToStaticMarkup(
      React.createElement(CrmCampaignMeasures, {
        campaigns: [],
        lang,
        isLight: true,
      }),
    );
    assert.ok(process.includes(processLabel));
    assert.ok(process.includes(name));
    assert.ok(marketing.includes(campaignLabel));
    assert.ok(marketing.includes(empty));
    if (lang !== "zh") {
      assert.ok(!/[\u4e00-\u9fff]/.test(process.replaceAll(name, "")));
      assert.ok(!/[\u4e00-\u9fff]/.test(marketing));
    }
  }
});

test('first-attempt timeliness excludes invalid and exception cases and separates unknown deadlines and pending requests',()=>{
 const rows=[
 base('timely',{firstFollowup:{outcome:'attempted',at:'2026-10-14T01:00:00Z',dueAt:'2026-10-14T02:00:00Z'}}),
 base('late',{firstFollowup:{outcome:'connected',at:'2026-10-14T03:00:00Z',dueAt:'2026-10-14T02:00:00Z'}}),
 base('unknown',{firstFollowup:{outcome:'attempted',at:'2026-10-14T03:00:00Z'}}),
 base('invalid',{firstFollowup:{outcome:'invalid_contact',at:'2026-10-14T03:00:00Z',dueAt:'2026-10-14T02:00:00Z'}}),
 base('exception',{firstFollowup:{outcome:'exception',at:'2026-10-14T03:00:00Z',dueAt:'2026-10-14T02:00:00Z'}}),
 base('request',{attention:{tasks:[],customerRequests:[{id:'request'}]}}),
 ];const before=JSON.stringify(rows),m=processMetrics(rows,now);
 assert.equal(m.firstTimed,2);assert.equal(m.firstOnTime,1);assert.equal(m.firstExceptions,2);assert.equal(m.firstTimingUnknown,1);assert.equal(JSON.stringify(rows),before);
});
