import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmCustomerProfile } from "../src/components/crm/CrmCustomerDetails.tsx";
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

test("Preferred language is a contact fact row; empty auxiliary tiers and source tracking are omitted in three languages", () => {
  const value = lead({ tierConfirmed: " ", tierPredicted: null });
  const before = JSON.stringify(value);
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(value, lang);
    assert.match(
      html,
      /<dt>[^<]+<\/dt><dd><button>LANGUAGE_CONTROL<\/button><\/dd>/,
    );
    assert.doesNotMatch(
      html,
      /crm-customer-preference|Sales-confirmed group|Rule-calculated group|人工确认分组|规则计算分组|Source tracking details|来源追踪详情/,
    );
    assert.doesNotMatch(html, /Predicted group|规则预测分组/);
    if (lang !== "zh")
      assert.doesNotMatch(html.replace("原名 Alice", ""), /[\u4e00-\u9fff]/);
  }
  assert.equal(JSON.stringify(value), before);
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
  assert.match(html, /Sales-confirmed group/);
  assert.match(html, /Rule-calculated group/);
  assert.match(html, /Campaign name not recorded/);
  assert.match(html, /TEST-campaign-id/);
  assert.doesNotMatch(
    html,
    /Link placement|Acquisition content|Acquisition context/,
  );
  assert.match(
    html,
    /<details class="crm-disclosure crm-acquisition-records">/,
  );
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

test("Profile has five business chapters with learning needs before sales progress and registration under acquisition", () => {
  const value = lead({
    submittedAt: "2026-10-17T08:00:00Z",
    owner: "Fadhil",
    parentContact: "TEST parent contact",
  });
  const before = JSON.stringify(value);
  const headings = {
    en: [
      "Customer and contact details",
      "Learning needs",
      "Sales progress",
      "Customer group",
      "Acquisition and activity records",
    ],
    id: [
      "Data pelanggan dan kontak",
      "Kebutuhan pembelajaran",
      "Kemajuan penjualan",
      "Grup pelanggan",
      "Sumber akuisisi dan catatan kegiatan",
    ],
    zh: [
      "客户与联系方式",
      "学习需求",
      "销售进展",
      "客户分组",
      "获客来源与活动记录",
    ],
  };
  for (const lang of ["en", "id", "zh"] as const) {
    const chapters = mainChapters(render(value, lang));
    assert.equal(chapters.length, 5);
    headings[lang].forEach((h, i) => assert.ok(chapters[i].includes(h), h));
    assert.match(chapters[0], /LANGUAGE_CONTROL/);
    assert.match(chapters[0], /TEST parent contact/);
    assert.ok(
      chapters[0].indexOf("LANGUAGE_CONTROL") >
        chapters[0].indexOf("TEST parent contact"),
    );
    assert.match(chapters[0], /LANGUAGE_CONTROL<\/button><\/dd>(?:<\/div>)?<\/dl>/);
    assert.match(chapters[2], /OWNER_CONTROL/);
    assert.doesNotMatch(chapters[0], /2026-10-17/);
    assert.match(chapters[4], /2026-10-17/);
  }
  assert.equal(JSON.stringify(value), before);
});

test("Customer group is a separate always-visible chapter with its current value, signals below and no disclosure", () => {
  const value = lead({
    tier: "Hot",
    buyingSignals: ["Asked price", "Asked schedule"],
  });
  const before = JSON.stringify(value);
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(value, lang);
    const group = mainChapters(html)[3];
    const title = group.match(/<h3[^>]*>(.*?)<\/h3>/s)?.[1] || "";
    assert.match(title, /Customer group|Grup pelanggan|客户分组/);
    assert.doesNotMatch(title, /Hot|Minat tinggi|高意向/);
    assert.match(
      group,
      /<dt>(Current group|Grup saat ini|当前分组)<\/dt><dd>(Hot|Minat tinggi|高意向)<\/dd>/,
    );
    assert.doesNotMatch(
      group,
      /<details|<summary|Classification evidence|分组依据/,
    );
    assert.doesNotMatch(group, /Asked about fees|Menanyakan biaya|询问学费/);
    assert.match(group, /Customer requests and interests|Permintaan dan minat pelanggan|客户诉求与意向/);
    assert.match(group, /Questionnaire interests|Minat dalam kuesioner|问卷关注内容/);
    assert.doesNotMatch(group, /Historical labels|Label historis|历史标签/);
    assert.doesNotMatch(
      mainChapters(html)[2],
      /Buying signals|Sinyal pembelian|购买信号/,
    );
  }
  assert.equal(JSON.stringify(value), before);
  const missing = render(lead({ tier: " " }), "en");
  assert.match(missing, /<dt>Current group<\/dt><dd>Not recorded<\/dd>/);
  assert.doesNotMatch(missing, /<dt>Current group<\/dt><dd>Hot<\/dd>/);
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
    assert.equal(chapters.length, 5);
    assert.match(sales, /<section class="crm-profile-outcome">/);
    assert.match(sales, /TEST 班级 asli/);
    assert.match(sales, /Rp 0/);
    assert.doesNotMatch(sales, /<details|<summary/);
    assert.doesNotMatch(sales, /Paid|已付款/);
    assert.doesNotMatch(chapters[4], /crm-profile-outcome|TEST 班级 asli/);
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
