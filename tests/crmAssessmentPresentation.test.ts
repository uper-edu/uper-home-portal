import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmCustomerAssessment } from "../src/components/crm/CrmAssessmentDetails.tsx";
import { CrmCustomerProfile } from "../src/components/crm/CrmCustomerDetails.tsx";
import {
  communicationTemplate,
  communicationTemplates,
  templateLabel,
} from "../src/utils/crmCommunicationTemplates.ts";
import { newHskAttempt, gradeHskAttempt } from "../src/data/hskAssessment.ts";
import { getVersionQuestions } from "../src/data/hskAssessmentVersions.ts";
import type { CrmLeadRecord } from "../src/types/crmLead.ts";

const result = (mode: "express" | "full") => {
  const attempt = newHskAttempt(mode, "00000000-0000-4000-8000-000000000002");
  for (const q of getVersionQuestions(
    mode,
    attempt.examVersion,
    attempt.scoringVersion,
  ))
    attempt.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
  attempt.completedAt = new Date().toISOString();
  return gradeHskAttempt(attempt, "id");
};
const lead = (extra = {}) =>
  ({
    fullName: "原名 Alice",
    reportedLevel: "Beginner",
    goal: "Work in China",
    ...extra,
  }) as CrmLeadRecord;
const render = (value: CrmLeadRecord, lang: "en" | "id" | "zh") =>
  renderToStaticMarkup(
    React.createElement(CrmCustomerAssessment, {
      lead: value,
      lang,
      timezone: "Asia/Jakarta",
    }),
  );

test("Assessment hierarchy in three languages preserves evidence, zeros and scores without blanket advisor approval", () => {
  for (const mode of ["full", "express"] as const) {
    const value = lead({
      levelSource: "assessment",
      latestAssessment: result(mode),
      quizResultSummary: "ORIGINAL 原文 · Catatan asli",
    });
    const before = JSON.stringify(value);
    for (const lang of ["en", "id", "zh"] as const) {
      const html = render(value, lang);
      assert.doesNotMatch(
        html,
        /Provisional|Original saved notes|Use the assessment as a reference|confirm learning needs|✓/,
      );
      assert.match(html, /crm-assessment-overview/);
      assert.match(html, /crm-assessment-performance/);
      assert.match(
        html,
        /<details class="crm-disclosure crm-assessment-evidence">/,
      );
      assert.doesNotMatch(
        html,
        /crm-assessment-context|Learning context|Konteks belajar|学习背景|Work in China|Bekerja di Tiongkok|赴华工作/,
      );
      const evidenceIndex = html.indexOf(
        'class="crm-disclosure crm-assessment-evidence"',
      );
      const selfReportLabel = {
        en: "Self-reported level",
        id: "Level menurut pelanggan",
        zh: "客户自报水平",
      }[lang];
      assert.ok(html.indexOf(selfReportLabel) > evidenceIndex);
      assert.match(
        html,
        /<section class="crm-detail-subsection crm-assessment-original">/,
      );
      assert.ok(
        html.indexOf("ORIGINAL 原文 · Catatan asli") >
          html.indexOf('class="crm-disclosure crm-assessment-evidence"'),
      );
      assert.match(html, /<dd>0<\/dd>/);
      assert.match(html, new RegExp(mode === "full" ? "100/100" : "30/30"));
      assert.doesNotMatch(html, /crm-assessment-review/);
      // Only original text is allowed to retain a different language.
      const interfaceText = html.replace("ORIGINAL 原文 · Catatan asli", "");
      if (lang !== "zh") assert.doesNotMatch(interfaceText, /[\u4e00-\u9fff]/);
      if (lang === "id") assert.match(html, /Kriteria HSK 3|Saran mulai/);
    }
    assert.equal(JSON.stringify(value), before);
  }
});

test("Profile groups visibly labeled customer language with contact preferences, keeping goals and ownership separate", () => {
  const value = lead({ owner: "Fadhil", communicationLanguage: "unknown" });
  const before = JSON.stringify(value);
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmCustomerProfile, {
        lead: value,
        lang,
        timezone: "Asia/Jakarta",
        ownership: React.createElement("button", null, "OWNER_CONTROL"),
        communication: React.createElement("button", null, "LANGUAGE_CONTROL"),
      }),
    );
    const sections = html.split("</section>");
    assert.match(sections[0], /LANGUAGE_CONTROL/);
    assert.doesNotMatch(sections[0], /OWNER_CONTROL/);
    assert.match(sections[2], /OWNER_CONTROL/);
    assert.doesNotMatch(sections[2], /LANGUAGE_CONTROL/);
    assert.match(sections[1], /Work in China|Bekerja di Tiongkok|赴华工作/);
    const label = {
      en: "Preferred communication language",
      id: "Bahasa komunikasi pilihan",
      zh: "首选沟通语言",
    }[lang];
    assert.ok(sections[0].includes(label));
    if (lang !== "zh")
      assert.doesNotMatch(html.replace("原名 Alice", ""), /[\u4e00-\u9fff]/);
  }
  assert.equal(JSON.stringify(value), before);
});

test("Self-report alone stays in collapsed evidence and never appears as an assessment result", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(lead({ reportedLevel: "HSK 2" }), lang);
    const split = html.indexOf(
      'class="crm-disclosure crm-assessment-evidence"',
    );
    assert.doesNotMatch(html.slice(0, split), /HSK 2/);
    assert.match(html.slice(split), /HSK 2/);
    assert.doesNotMatch(html, /crm-assessment-performance/);
    assert.ok(
      html.includes(
        {
          en: "No assessment recorded",
          id: "Belum ada asesmen tercatat",
          zh: "尚无测评记录",
        }[lang],
      ),
    );
  }
});

test("Teacher, self-report and historical evidence remain separate; no invented dates or teacher identity", () => {
  const value = lead({
    levelSource: "trial",
    levelConfirmed: "HSK 2",
    latestAssessment: result("full"),
  });
  const html = render(value, "en");
  assert.match(html, /Latest assessment · separate evidence/);
  assert.match(html, /HSK 2/);
  assert.match(html, /HSK 3 criteria met/);
  assert.match(html, /<dt>Teacher<\/dt><dd>Not recorded/);
  const historical = render(
    lead({
      levelSource: "assessment",
      quizScore: 0,
      quizResultSummary: "HISTORICAL ORIGINAL",
    }),
    "en",
  );
  assert.match(historical, /Evidence to check/);
  assert.match(historical, /0 pts \(maximum unknown\)/);
  assert.match(historical, /HISTORICAL ORIGINAL/);
  assert.doesNotMatch(
    render(lead(), "en"),
    /crm-assessment-performance|crm-assessment-review/,
  );
});

test("Specific saved quick-assessment concerns explain review, corrupt evidence never becomes a passed level", () => {
  for (const reason of [
    "boundary",
    "incomplete",
    "inconsistent",
    "audio_error",
  ] as const) {
    const r = result("express");
    r.screeningPlacement!.needsReview = true;
    r.screeningPlacement!.reason = reason;
    for (const lang of ["en", "id", "zh"] as const) {
      const html = render(lead({ latestAssessment: r }), lang);
      assert.match(html, /crm-assessment-review/);
      assert.doesNotMatch(html, /advisor approval|confirm learning needs/);
    }
  }
  const malformed = result("full");
  malformed.thresholds[0].reached = false;
  assert.match(
    render(lead({ latestAssessment: malformed }), "en"),
    /Evidence to check/,
  );
});

test("Communication templates follow customer language, retain names verbatim and make no fabricated commercial promises", () => {
  for (const item of communicationTemplates)
    for (const lang of ["en", "id", "zh"] as const) {
      const text = communicationTemplate(
        item.id,
        lang,
        "原名 Alice",
        "Sales Budi",
      );
      assert.match(text, /原名 Alice/);
      assert.match(text, /Sales Budi/);
      assert.ok(templateLabel(item, lang).length > 0);
      assert.doesNotMatch(
        text,
        /\b\d+%|Rp\s*\d|seats left|reserved a seat|已发送|已为您预留|优惠截止/,
      );
      if (lang === "id") assert.match(text, /Halo/);
    }
  assert.equal(communicationTemplate("trial", "unknown", "X", "Y"), "");
  assert.equal(communicationTemplate("custom", "en", "X", "Y"), "");
  assert.match(
    communicationTemplate("trial", "en", "X", "Y"),
    /check whether a suitable trial is available/,
  );
});
