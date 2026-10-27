import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmAssessmentEvidence as CrmCustomerAssessment } from "../src/components/crm/CrmAssessmentEvidence.tsx";
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
      assert.doesNotMatch(html, new RegExp(selfReportLabel));
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

test("Profile does not repeat immediate language editing or mix ownership with basic facts",()=>{
 const value=lead({owner:'Fadhil',communicationLanguage:'unknown'}),before=JSON.stringify(value);
 const html=renderToStaticMarkup(React.createElement(CrmCustomerProfile,{lead:value,lang:'zh',timezone:'Asia/Jakarta',ownership:React.createElement('button',null,'OWNER_CONTROL'),communication:React.createElement('button',null,'LANGUAGE_CONTROL')}));
 assert.doesNotMatch(html,/LANGUAGE_CONTROL|OWNER_CONTROL/);assert.match(html,/客户来源与分组/);
 assert.equal(JSON.stringify(value),before);
});
