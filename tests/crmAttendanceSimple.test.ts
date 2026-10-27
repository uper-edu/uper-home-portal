import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import {
  attendanceInput,
  linkedParticipationCampaign,
} from "../src/utils/crmParticipation";
import { CrmAttendanceFields } from "../src/components/crm/CrmAttendanceEditor";
import { saveAttendance } from "../server/portal/attendance";
const campaign = {
  id: "webinar",
  code: "WKND",
  type: "webinar_class",
  name: "周末职场中文体验课",
};
const lead = {
  campaignId: "webinar",
  tier: "Hot",
  owner: "Robert",
  currentStage: "Contacted",
  followUpLogs: [{ id: "record-1" }],
};
const body = {
  requestId: "participation-1",
  campaignId: "webinar",
  mode: "online",
  confirmed: true,
};
test("source event is matched by exact id or unambiguous code, never chosen from available events", () => {
  assert.equal(
    linkedParticipationCampaign(lead, [
      { id: "other", type: "webinar_class" },
      campaign,
    ]),
    campaign,
  );
  assert.equal(
    linkedParticipationCampaign({ campaignId: "WKND" }, [campaign]),
    campaign,
  );
  assert.equal(linkedParticipationCampaign({}, [campaign]), null);
  assert.equal(
    linkedParticipationCampaign({ campaignId: "missing" }, [campaign]),
    null,
  );
  assert.equal(
    linkedParticipationCampaign({ campaignId: "same" }, [
      { id: "a", code: "same" },
      { id: "b", code: "same" },
    ]),
    null,
  );
});
test("reason can be omitted without inventing one, but mode, confirmation and request identity remain required", () => {
  assert.deepEqual(attendanceInput(body), {
    campaignId: "webinar",
    mode: "online",
    confirmed: true,
    reason: "",
  });
  assert.equal(
    attendanceInput({ ...body, reason: " 原说明 " }).reason,
    "原说明",
  );
  for (const change of [
    { mode: "" },
    { mode: "unknown" },
    { confirmed: "true" },
    { requestId: "" },
    { reason: 42 },
    { reason: "x".repeat(2001) },
  ])
    assert.throws(() => attendanceInput({ ...body, ...change }));
  assert.throws(() => attendanceInput(null));
});
const form = (props: any = {}) =>
  render(
    React.createElement(CrmAttendanceFields, {
      campaign,
      lang: "zh",
      isLight: true,
      mode: "",
      busy: false,
      contextChanged: false,
      onMode() {},
      onSave() {},
      ...props,
    }),
  );
test("form has one required mode choice and a read-only event name, no event picker or reason field", () => {
  const html = form();
  assert.match(html, /周末职场中文体验课/);
  assert.match(html, /aria-required="true"/);
  assert.match(html, /参与方式<span class="admin-required-star"/);
  assert.match(html, /确认参与/);
  assert.doesNotMatch(html, /请选择活动|确认依据|<textarea/);
  assert.match(html, /disabled=""/);
  const ready = form({ mode: "online" });
  assert.doesNotMatch(ready, /disabled=""/);
  assert.doesNotMatch(form({ campaign: null }), /确认参与|参与方式/);
  assert.match(form({ campaign: null }), /未关联/);
  assert.doesNotMatch(
    form({ campaign: { ...campaign, type: "social_ad" } }),
    /确认参与/,
  );
  assert.match(
    form({ mode: "onsite", contextChanged: true }),
    /来源活动已变化/,
  );
  assert.match(form({ mode: "onsite", contextChanged: true }), /disabled=""/);
  assert.match(
    form({
      campaign: { ...campaign, type: "social_ad" },
      record: { confirmed: true },
      mode: "online",
    }),
    /撤销确认/,
  );
});
function database(profile: any = lead) {
  let current = structuredClone(profile);
  const audits: any[] = [];
  let writes = 0;
  return {
    get current() {
      return current;
    },
    audits,
    get writes() {
      return writes;
    },
    async query(sql: string, args: any[]) {
      if (sql.startsWith("SELECT profile"))
        return { rows: [{ profile: structuredClone(current) }] };
      if (sql.startsWith("SELECT data"))
        return {
          rows: audits
            .filter((a) => a.requestId === args[1])
            .map((data) => ({ data })),
        };
      if (sql.startsWith("UPDATE portal_leads")) {
        current = structuredClone(args[1]);
        writes++;
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO portal_audit")) {
        audits.push(args[1]);
        writes++;
        return { rows: [] };
      }
      throw Error("Unexpected query");
    },
  };
}
test("save without reason records staff/time and only source-event participation; idempotency and business state stay intact", async () => {
  const db = database(),
    clock = new Date("2026-10-26T12:00:00Z");
  const result = await saveAttendance(
    db,
    "maya",
    "Robert",
    body,
    [campaign],
    () => true,
    clock,
  );
  assert.deepEqual(result.attendanceRecords, [
    {
      campaignId: "webinar",
      mode: "online",
      confirmed: true,
      reason: "",
      actor: "Robert",
      recordedAt: clock.toISOString(),
    },
  ]);
  for (const key of Object.keys(lead))
    assert.deepEqual(result[key], (lead as any)[key]);
  assert.equal(db.audits.length, 1);
  await saveAttendance(
    db,
    "maya",
    "Robert",
    body,
    [campaign],
    () => true,
    clock,
  );
  assert.equal(db.audits.length, 1);
  assert.equal(db.writes, 2);
  await assert.rejects(
    saveAttendance(
      db,
      "maya",
      "Robert",
      { ...body, mode: "onsite" },
      [campaign],
      () => true,
    ),
    { status: 409 },
  );
  assert.equal(db.writes, 2);
});
test("denied customers, another event, no linked event and non-event categories cannot create participation", async () => {
  for (const [profile, events, allowed, request] of [
    [lead, [campaign], false, body],
    [lead, [campaign], true, { ...body, campaignId: "other" }],
    [{ ...lead, campaignId: "missing" }, [campaign], true, body],
    [lead, [{ ...campaign, type: "social_ad" }], true, body],
  ] as any[]) {
    const db = database(profile);
    await assert.rejects(
      saveAttendance(db, "maya", "Robert", request, events, () => allowed),
    );
    assert.equal(db.writes, 0);
    assert.equal(db.audits.length, 0);
  }
});

test("explicit confirmation counts without a reason; acquisition, missing actor/time and unconfirmed records do not count", async () => {
  const { campaignMetrics } = await import("../src/utils/crmCampaignMetrics");
  const base = { id: "maya", campaignId: campaign.id };
  const oldBlank = {
    campaignId: campaign.id,
    confirmed: true,
    mode: "online",
    actor: "Robert",
    recordedAt: "2026-10-26T12:00:00Z",
    reason: "",
  };
  assert.equal(campaignMetrics([base], campaign).confirmedAttendanceCount, 0);
  assert.equal(
    campaignMetrics([{ ...base, attendanceRecords: [oldBlank] }], campaign)
      .confirmedAttendanceCount,
    1,
  );
  for (const missing of [{confirmed:false},{actor:''},{recordedAt:'invalid'}]) {
    assert.equal(campaignMetrics([{...base,attendanceRecords:[{...oldBlank,...missing}]}],campaign).confirmedAttendanceCount,0);
  }
  assert.equal(
    campaignMetrics(
      [{ ...base, attendanceRecords: [{ ...oldBlank, reason: "原签到记录" }] }],
      campaign,
    ).confirmedAttendanceCount,
    1,
  );
  const db = database();
  const saved = await saveAttendance(
    db,
    "maya",
    "Robert",
    body,
    [campaign],
    () => true,
  );
  assert.equal(
    campaignMetrics([{ ...base, ...saved }], campaign).onlineAttendanceCount,
    1,
  );
  const withdrawn = await saveAttendance(
    db,
    "maya",
    "Robert",
    { ...body, requestId: "withdraw", confirmed: false },
    [campaign],
    () => true,
  );
  assert.equal(
    campaignMetrics([{ ...base, ...withdrawn }], campaign)
      .confirmedAttendanceCount,
    0,
  );
});
