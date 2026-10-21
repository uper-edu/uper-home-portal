import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { campaignUi, campaignUiMessages } from "../src/utils/campaignI18n.ts";
import { CampaignCards } from "../src/components/crm/CampaignCards.tsx";
import { CampaignInformation } from "../src/components/crm/CampaignInformation.tsx";
import { CampaignEditor } from "../src/components/crm/CampaignEditor.tsx";
import { CampaignMaterials } from "../src/components/crm/CampaignMaterials.tsx";
import { CampaignSourceEvidence } from "../src/components/crm/CampaignSourceEvidence.tsx";
import { CampaignWorkspaceHeading } from "../src/components/crm/CampaignWorkspaceHeading.tsx";
import { CampaignOverview } from "../src/components/crm/CampaignOverview.tsx";
import { CrmPromotionReviews } from "../src/components/crm/CrmPromotionReviews.tsx";
import {
  CrmSaveFeedback,
  CrmDiscardDialog,
} from "../src/components/crm/CrmDetailWorkspace.tsx";
import {
  CAMPAIGN_TYPE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
} from "../src/types/crmCampaign.ts";
import {
  PROMOTION_MEDIA,
  PROMOTION_MEDIUM_LABELS,
  PROMOTION_EXPERIENCE_LABEL,
} from "../src/utils/campaignPromotion.ts";
import { promotionReviewActions } from "../src/utils/promotionReviewActions.ts";
import { guideSections } from "../src/components/crm/CrmGuideContent.ts";
import { guideLessons } from "../src/components/crm/CrmGuideLearning.ts";
const c: any = {
  id: "old",
  code: "cl-original",
  name: "原始 Nama TEST Name",
  nameEn: "Unused alias",
  type: "campus_seminar",
  status: "planning",
  locationType: "hybrid",
  startDate: "2026-11-10",
  endDate: "2026-11-11",
  startTime: "10:00",
  endTime: "16:00",
  city: "Jakarta",
  venue: "TEST Venue",
  organizer: "TEST 原始 Organizer",
  address: "TEST Address",
  onlineLink: "",
  scheduleNotes: "TEST Original Note",
  targetAudience: ["TEST Audience"],
  keyTopics: ["TEST Human Fact"],
  speakers: [],
  stats: { leadsCount: 1, assessedCount: 0, enrolledCount: 0, budgetCost: 0 },
  boundUtm: { defaultLang: "id", defaultHook: "hsk_assessment" },
  aiAssets: { templateDrafts: { id: { socialCopy: "TEST Original Draft" } } },
  promotionModel: "multiple",
  promotionLinks: [
    {
      id: "p_original",
      source: "campus_original",
      medium: "poster",
      language: "id",
      name: "TEST Link",
    },
  ],
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};
const render = (Component: any, props: any) =>
  renderToStaticMarkup(React.createElement(Component, props)).replaceAll(
    "&amp;",
    "&",
  );
const placeholders = (s: string) =>
  [...s.matchAll(/\{([a-zA-Z]\w*)\}/g)].map((m) => m[1]).sort();

test("Campaign system messages have complete ID/ZH translations and preserve interpolation variables", () => {
  for (const [en, pair] of Object.entries(campaignUiMessages)) {
    assert.equal(pair.length, 2, en);
    for (const text of pair) {
      assert.ok(text.trim(), en);
      assert.deepEqual(placeholders(text), placeholders(en), en);
    }
  }
  const files = [
    "CampaignCards",
    "CampaignEditor",
    "CampaignInformation",
    "CampaignMaterials",
    "CampaignOverview",
    "CampaignWorkspaceHeading",
    "CampaignSourceEvidence",
    "CampaignPromotionLinks",
    "CrmPromotionReviews",
    "CrmCampaignHub",
    "CrmCampaignSources",
    "CampaignDateTimeField",
  ];
  for (const name of files) {
    const file = `src/components/crm/${name}.tsx`,
      ast = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
    function visit(n: ts.Node) {
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(ast) === "u" &&
        n.arguments[0] &&
        ts.isStringLiteral(n.arguments[0])
      )
        assert.ok(
          campaignUiMessages[n.arguments[0].text],
          `${name}: ${n.arguments[0].text}`,
        );
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  for (const key of [
    ...CAMPAIGN_TYPE_OPTIONS.map((o) => o.labelEn),
    ...CAMPAIGN_STATUS_OPTIONS.map((o) => o.labelEn),
    ...PROMOTION_MEDIA.map((m) => PROMOTION_MEDIUM_LABELS[m]),
    PROMOTION_EXPERIENCE_LABEL,
    ...promotionReviewActions.flatMap((a) => [a.label, a.scenario, a.effect]),
  ])
    assert.ok(campaignUiMessages[key], key);
});

test("Campaign cards, four-tab facts, editor, materials and source evidence localize without changing original facts", () => {
  const before = JSON.stringify(c);
  for (const lang of ["en", "id", "zh"] as const) {
    const u = campaignUi(lang);
    const card = render(CampaignCards, {
      campaigns: [c],
      lang,
      onOpen: () => {},
      onEdit: () => {},
    });
    for (const value of [
      c.name,
      c.code,
      c.organizer,
      u("Planned budget"),
      u("Registered customers"),
      u("Links & QR"),
      u("Campus Seminar"),
    ])
      assert.ok(card.includes(value), `${lang}: ${value}`);
    const info = render(CampaignInformation, { campaign: c, lang });
    for (const value of [
      u("Basic information"),
      u("Start"),
      u("End"),
      c.scheduleNotes,
      c.keyTopics[0],
      c.organizer,
    ])
      assert.ok(info.includes(value), `${lang}: ${value}`);
    const editor = render(CampaignEditor, {
      campaign: c,
      lang,
      isLight: true,
      onClose: () => {},
      onSaved: () => {},
    });
    assert.equal((editor.match(/type="datetime-local"/g) || []).length, 2);
    assert.doesNotMatch(editor, /type="date"|type="time"/);
    assert.ok(editor.includes(u("Start date and time")));
    const materials = render(CampaignMaterials, {
      campaign: c,
      lang,
      isLight: true,
      canEdit: true,
      onSaved: () => {},
      onStateChange: () => {},
    });
    assert.ok(materials.includes(u("Link to include in the template")));
    const evidence = render(CampaignSourceEvidence, {
      lang,
      source: {
        rawCode: "UNKNOWN-original",
        leads: [
          {
            id: "test",
            name: c.name,
            rawCode: "UNKNOWN-original",
            evidence: {},
          },
        ],
      },
    });
    assert.ok(evidence.includes(u("What triggered this review?")));
    assert.ok(evidence.includes("UNKNOWN-original"));
    assert.ok(evidence.includes(c.name));
    assert.equal(JSON.stringify(c), before);
  }
});

test("home page actions/subtitle, overview, review and save/discard feedback follow interface language", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    const u = campaignUi(lang);
    const props = {
      lang,
      reviewing: false,
      canManage: true,
      isLight: true,
      state: { pending: true, loading: false, unavailable: false },
      onOpen: () => {},
      onReturn: () => {},
      showSubtitle: true,
      onCreate: () => {},
      onRefresh: () => {},
    };
    const html = render(CampaignWorkspaceHeading, props);
    for (const key of [
      "Create campaign",
      "Refresh campaigns",
      "Source review",
      "Create campaigns and promotion links, verify acquisition sources, and review customer and enrollment results.",
    ])
      assert.ok(html.includes(u(key)), `${lang}: ${key}`);
    assert.doesNotMatch(
      render(CampaignWorkspaceHeading, { ...props, canManage: false }),
      new RegExp(">" + u("Create campaign") + "<"),
    );
    assert.ok(
      render(CampaignOverview, {
        lang,
        campaigns: [c],
        expanded: true,
        onToggle: () => {},
        loading: false,
        error: false,
        onRetry: () => {},
        isLight: true,
      }).includes(u("Campaign overview · Current results")),
    );
    assert.ok(
      render(CrmPromotionReviews, {
        lang,
        isLight: true,
        onChanged: () => {},
        reloadToken: 0,
        onCount: () => {},
      }).includes(u("Unverified promotion entries")),
    );
    assert.ok(
      render(CrmSaveFeedback, { lang, state: "unknown" }).includes(
        u("Save outcome unknown. Check the result before submitting again."),
      ),
    );
    const discard = render(CrmDiscardDialog, {
      lang,
      isLight: true,
      onKeep: () => {},
      onDiscard: () => {},
    });
    assert.ok(discard.includes(u("Keep editing")));
    assert.ok(discard.includes(u("Discard and continue")));
  }
});

test("Campaign guide reflects two steps, immutable IDs, evidence-based review and templates in all languages", () => {
  const body = guideSections.find((s) => s.key === "campaigns")!.body;
  for (let i = 0; i < 3; i++) {
    const content = body.map((p) => p[i]).join("\n");
    for (const code of ["camp-", "UTM", "c", "p", "organic"])
      assert.ok(content.includes(code));
    assert.doesNotMatch(
      content,
      /English and Indonesian display names|沿用原始 \?c=|memakai kode \?c= asli|type and format letters/,
    );
    const procedure = guideLessons.campaigns;
    assert.equal(procedure.nodes.length, 7);
    assert.ok(procedure.nodes[0].detail[i].includes("camp-"));
    assert.ok(procedure.nodes[1].detail[i].includes("utm_medium"));
  }
  assert.equal(
    campaignUi("zh")("Campaign: {name}", { name: c.name }),
    `活动：${c.name}`,
  );
});
