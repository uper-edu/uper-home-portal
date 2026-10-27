import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmCustomerProfile } from "../src/components/crm/CrmCustomerDetails.tsx";
import { CrmProfileEditor } from "../src/components/crm/CrmProfileFields.tsx";
import { CrmAttendanceEditor } from "../src/components/crm/CrmAttendanceEditor.tsx";
import { supportsParticipationRecord } from "../src/utils/crmParticipation.ts";
import { campaignMetrics } from "../src/utils/crmCampaignMetrics.ts";
import type { CrmLeadRecord } from "../src/types/crmLead.ts";
const lead = (extra = {}) =>
  ({
    id: "TEST-profile",
    fullName: "原名 Alice",
    tier: "Warm-Online",
    goal: "Work in China",
    ...extra,
  }) as CrmLeadRecord;
const render = (value: CrmLeadRecord, lang: "en" | "id" | "zh") =>
  renderToStaticMarkup(
    React.createElement(CrmCustomerProfile, {
      lead: value,
      lang,
      timezone: "Asia/Jakarta",
      ownership: React.createElement("span", null, "OWNER_CONTROL"),
      communication: React.createElement("button", null, "LANGUAGE_CONTROL"),
    }),
  );

test("Profile keeps contacts read-only and omits the duplicate immediate language editor",()=>{
 const value=lead({whatsapp:'+628123456789',communicationLanguage:'id',tierConfirmed:' ',tierPredicted:null});const before=JSON.stringify(value),html=render(value,'zh');
 assert.match(html,/基本资料/);assert.match(html,/628123456789/);assert.doesNotMatch(html,/LANGUAGE_CONTROL|画像来源与变化|当前画像与来源/);assert.equal(JSON.stringify(value),before);
});

test("Existing auxiliary classifications and attribution remain in folded evidence without resolving names or inventing source values", () => {
  const value = lead({
    tierConfirmed: "Hot",
    tierPredicted: "Warm-Online",
    tierSource: "sales_confirmed",
    campaignId: "TEST-campaign-id",
    placement: "",
    hookType: " ",
    hookContext: null,
  });
  const html = render(value, "en");
  assert.doesNotMatch(html, /Sales-confirmed group/);
  assert.doesNotMatch(html, /Rule-calculated group/);
  assert.match(html, /Campaign name not recorded/);
  assert.match(html, /TEST-campaign-id/);
  assert.doesNotMatch(
    html,
    /Link placement|Acquisition content|Acquisition context/,
  );
  assert.doesNotMatch(html, /crm-acquisition-records/);
});

test("Historical participation and withdrawals stay accessible as original evidence, and attribution alone never counts as attendance", () => {
  const value = lead({
    campaignId: "event-1",
    attendanceConfirmed: true,
    attendanceRecords: [
      {
        campaignId: "event-1",
        confirmed: true,
        mode: "online",
        reason: "TEST 原文 catatan asli <script>",
        actor: "Fadhil",
        recordedAt: "2026-10-17T08:00:00Z",
      },
      {
        campaignId: "ad-1",
        confirmed: false,
        mode: "onsite",
        reason: "TEST correction",
        actor: "Robert",
        recordedAt: "2026-10-17T08:01:00Z",
      },
    ],
  });
  const before = JSON.stringify(value);
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(value, lang);
    assert.match(
      html,
      /<section class="crm-detail-subsection crm-participation-history">/,
    );
    assert.match(html, /TEST 原文 catatan asli &lt;script&gt;/);
    assert.match(html, /TEST correction/);
    assert.match(html, /Fadhil/);
    assert.match(html, /Robert/);
    assert.doesNotMatch(html, /crm-profile-outcome/);
  }
  assert.equal(JSON.stringify(value), before);
  assert.equal(
    campaignMetrics([lead({ campaignId: "event-1" })], {
      id: "event-1",
      code: "event-1",
      name: "Event",
    }).confirmedAttendanceCount,
    0,
  );
});

test("Optional event eligibility uses event category, never the online/offline/hybrid location format", () => {
  for (const type of [
    "campus_seminar",
    "enterprise_roadshow",
    "webinar_class",
    "education_fair",
  ]) {
    assert.equal(supportsParticipationRecord({ type }), true);
    assert.equal(
      supportsParticipationRecord({ type, systemManaged: true }),
      false,
    );
  }
  for (const type of [
    "social_paid_ad",
    "community_referral",
    "other",
    undefined,
  ]) {
    assert.equal(supportsParticipationRecord({ type }), false);
  }
  assert.equal(
    supportsParticipationRecord({
      type: "social_paid_ad",
      locationType: "offline",
    } as any),
    false,
  );
  assert.equal(
    supportsParticipationRecord({
      type: "webinar_class",
      locationType: "online",
    } as any),
    true,
  );
});

test("Participation is optional and initially has no confirm button before an eligible event is selected", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmAttendanceEditor, {
        lead: lead(),
        lang,
        isLight: true,
        timezone: "Asia/Jakarta",
        staffId: "Fadhil",
        onUpdated: () => {},
      }),
    );
    assert.doesNotMatch(html, /<button/);
    assert.doesNotMatch(html, /<textarea/);
    if (lang !== "zh") assert.doesNotMatch(html, /[\u4e00-\u9fff]/);
  }
});

function mainChapters(html: string) {
  const sections: string[] = [];
  let depth = 0,
    start = 0;
  for (const match of html.matchAll(/<\/?section\b[^>]*>/g)) {
    if (match[0].startsWith("</")) {
      depth--;
      if (!depth)
        sections.push(html.slice(start, match.index! + match[0].length));
    } else {
      if (!depth) start = match.index!;
      depth++;
    }
  }
  return sections;
}

test("Basic details and current needs precede folded business management and source records",()=>{
 const html=render(lead({submittedAt:'2026-10-17T08:00:00Z',parentContact:'家长号码',city:'Bandung'}),'zh');
 assert.ok(html.indexOf('基本资料')<html.indexOf('学习背景与需求'));
 assert.ok(html.indexOf('学习背景与需求')<html.indexOf('客户来源与分组'));
 assert.match(html,/<section class="crm-profile-origin">/);
 assert.doesNotMatch(html,/OWNER_CONTROL/);assert.match(html,/家长号码/);assert.match(html,/Bandung|万隆/);assert.match(html,/登记时间/);
});

test("Business group remains accessible but intent summaries are not duplicated on profile",()=>{
 const html=render(lead({tier:'Hot',buyingSignals:['Asked price','Asked schedule']}),'zh');
 assert.match(html,/当前分组/);assert.match(html,/高意向/);assert.doesNotMatch(html,/客户诉求与意向|问卷关注内容|询问学费/);
});

test("Recorded outcome stays visible in sales progress, preserving zero and raw class names without implying payment", () => {
  const value = lead({
    outcome: "Enrolled",
    enrolledClass: "TEST 班级 asli",
    revenue: 0,
    currentStage: "New",
  });
  const before = JSON.stringify(value);
  for (const lang of ["en", "id", "zh"] as const) {
    const chapters = mainChapters(render(value, lang)),
      sales = chapters[2];
    assert.equal(chapters.length, 4);
    assert.match(sales, /<section class="crm-profile-outcome">/);
    assert.match(sales, /TEST 班级 asli/);
    assert.match(sales, /Rp 0/);
    assert.doesNotMatch(sales, /<details|<summary/);
    assert.doesNotMatch(sales, /Paid|已付款/);
    assert.doesNotMatch(chapters[3], /crm-profile-outcome|TEST 班级 asli/);
  }
  assert.equal(JSON.stringify(value), before);
});

test("Empty outcome area is omitted, while partial saved outcomes show only the actual fields", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    for (const patch of [
      {},
      { outcome: " ", enrolledClass: " ", revenue: undefined },
      { revenue: Number.NaN },
    ])
      assert.doesNotMatch(render(lead(patch), lang), /crm-profile-outcome/);
  }
  const zero = mainChapters(render(lead({ revenue: 0 }), "en"))[2];
  assert.match(zero, /Recorded amount/);
  assert.doesNotMatch(
    zero,
    /<dt>Outcome<|<dt>Enrolled class<|Paid|Enrolled<\/dd>/,
  );
  assert.match(zero, /Rp 0/);
});


test("Promotion review facts render in three languages while preserving raw evidence", () => {
  const value = lead({campaignId: "camp-demo", promotionReview: {status: "linked", revision: 1, rawCampaignCode: "camp-original", rawPromotionLinkId: "p-raw", campaignId: "camp-demo", linkId: "p-verified", snapshot: {name: "TEST Original Entry", source: "test_source", medium: "poster"}, actor: "Robert", at: "2026-10-20T08:00:00Z", reason: "TEST Human 原文", scope: "this_customer_only"}});
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(value, lang);
    assert.match(html, /p-raw/);
    assert.match(html, /TEST Original Entry/);
    assert.match(html, /TEST Human 原文/);
    assert.match(html, lang === "zh" ? /推广入口核实/ : lang === "id" ? /Verifikasi entri promosi/ : /Promotion entry review/);
    if(lang !== "en") assert.doesNotMatch(html, /Reviewed by \/ time|Invalid promotion attribution/);
  }
});

test('one source/group section deduplicates current group while retaining explicit original classification and attribution',()=>{
 const value=lead({fullName:'Arif Hidayat',tier:'Hot',tierConfirmed:'Hot',tierPredicted:'Hot',tierSource:'initial_registration',tierUpdatedAt:'2026-10-26T12:00:00Z',entryPoint:'Website',campaign:'周末中文体验课',campaignId:'campaign-1',initialTierDecision:{ruleId:'rule-1',ruleVersion:'v1',at:'2026-10-26T12:00:00Z',input:{goal:'工作交流'},sourceFactIds:['original-questionnaire']}}),before=JSON.stringify(value),html=render(value,'zh');
 assert.equal(html.split('<h3>客户来源与分组</h3>').length-1,1);assert.doesNotMatch(html,/业务状态与管理|获客来源与活动记录/);
 assert.doesNotMatch(html,/人工确认分组|规则计算分组|分组详细依据|首次分类依据|rule-1|original-questionnaire/);assert.match(html,/首次登记自动分类/);assert.match(html,/campaign-1/);assert.match(html,/周末中文体验课/);assert.doesNotMatch(html,/<details[^>]*open=/);assert.equal(JSON.stringify(value),before);
});
test('auxiliary classification and initial decision remain in data without a profile detail panel',()=>{
 const value=lead({tier:'Warm-Online',tierConfirmed:'Hot',tierPredicted:'Hot'}),before=JSON.stringify(value),html=render(value,'zh');
 assert.doesNotMatch(html,/人工确认分组|规则计算分组|分组详细依据|高意向/);assert.match(html,/培育池|线上|在线/);assert.equal(JSON.stringify(value),before);
});
test('empty optional evidence and outcomes create no empty panels; saved zero outcome stays separate from source and group',()=>{
 const html=render(lead({tier:'Hot'}),'zh');assert.doesNotMatch(html,/分组详细依据|来源与活动依据|已登记业务结果/);
 const withOutcome=render(lead({tier:'Hot',revenue:0,enrolledClass:'周六晚班'}),'zh');const chapters=mainChapters(withOutcome);
 assert.match(chapters[2],/已登记业务结果|周六晚班|Rp 0/);assert.doesNotMatch(chapters[2],/客户来源与分组/);assert.match(chapters[3],/客户来源与分组/);assert.doesNotMatch(chapters[3],/周六晚班|Rp 0/);
});

test('recorded tracking fields continue directly below source/group with no heading or empty evidence disclosure',()=>{
 const value=lead({campaign:'周末职场中文体验课',campaignId:'campaign-readable',placement:'group_message',hookType:'HSK Assessment',hookContext:'Website'}),before=JSON.stringify(value),html=render(value,'zh');
 assert.match(html,/活动标识/);assert.match(html,/campaign-readable/);assert.match(html,/链接投放位置/);assert.doesNotMatch(html,/来源追踪详情|分组详细依据|crm-acquisition-records/);
 assert.ok(html.indexOf('当前分组')<html.indexOf('活动标识'));assert.equal(JSON.stringify(value),before);
});

test('profile attributes keep their values, evidence and edit actions without subgroup headings',()=>{
 const value=lead({fullName:'Maya Putri',city:'Jakarta',communicationLanguage:'id',preferredChannel:'whatsapp',reportedLevel:'HSK 2',mode:'Online',availability:'周六晚上',budgetAmount:800000,concerns:['时间安排'],campaign:'周末中文体验课'}),before=JSON.stringify(value);
 const dynamicProfile=React.createElement(CrmProfileEditor,{lead:value,timezone:'Asia/Jakarta',isLight:true,onSaved(){}});
 const html=renderToStaticMarkup(React.createElement(CrmCustomerProfile,{lead:value,lang:'zh',timezone:'Asia/Jakarta',dynamicProfile}));
 assert.doesNotMatch(html,/<h4>/);
 for(const text of ['基本资料','学习背景与需求','客户来源与分组','客户自报水平','HSK 2','周六晚上','时间安排','周末中文体验课','当前分组','首选沟通语言','调整学习需求']){
   assert.ok(html.includes(text),text);
 }
 assert.match(html,/调整可上课时段/);assert.equal(JSON.stringify(value),before);
});
