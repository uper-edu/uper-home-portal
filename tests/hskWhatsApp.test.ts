import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hskWhatsAppDraft } from "../src/services/hskWhatsApp";
import { newHskAttempt, gradeHskAttempt } from "../src/data/hskAssessment";
import { getVersionQuestions } from "../src/data/hskAssessmentVersions";
import HskAssessmentReport from "../src/components/HskAssessmentReport";
import HskAssessmentWelcome from "../src/components/HskAssessmentWelcome";
const profile = {
  fullName: "测试学员 & Budi",
  currentStatus: "University student",
  city: "Jakarta",
  goal: "Work in China",
  mode: "Online",
  reportedLevel: "Beginner",
  email: "excluded@example.invalid",
  whatsapp: "0000000000",
  chatTranscript: [{ content: "EXCLUDED PRIVATE TRANSCRIPT" }],
} as const;
function result(mode: "full" | "express" = "express") {
  const a = newHskAttempt(mode, randomUUID());
  a.completedAt = new Date().toISOString();
  for (const q of getVersionQuestions(mode))
    a.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
  return { ...gradeHskAttempt(a), saveStatus: "saved" as const };
}
test("WhatsApp draft safely encodes a localized whitelist and recomputed assessment, with no contacts, transcript or forged grade", () => {
  for (const lang of ["zh", "en", "id"] as const) {
    const r = result();
    const draft = hskWhatsAppDraft(
      { ...profile, goal: "Work in China" },
      {
        ...r,
        correctCount: 999,
        screeningPlacement: { suggestedStartLevel: 9 },
      },
      lang,
    );
    const url = new URL(draft.url);
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/6281116612062");
    assert.equal(url.searchParams.get("text"), draft.message);
    assert.ok(draft.includesResult);
    assert.match(draft.message, /15\/15/);
    assert.match(draft.message, /HSK 3/);
    assert.doesNotMatch(
      draft.message,
      /999|HSK 9|excluded@example|0000000000|EXCLUDED PRIVATE TRANSCRIPT/,
    );
    assert.ok(draft.message.length < 1100);
  }
});
test("Full and archived reports retain their correct denominators; unknown/corrupt reports cannot be shared as grades", () => {
  const full = hskWhatsAppDraft(profile, result("full"), "en");
  assert.match(full.message, /50\/50/);
  assert.match(full.message, /21\/21/);
  assert.match(full.message, /15\/15.*17\/17.*18\/18/);
  const a = {
    ...newHskAttempt("express", randomUUID()),
    examVersion: "pdf-e80a3cbaabc5-audio-1d13ab13-sequential-v3",
  };
  a.completedAt = new Date().toISOString();
  for (const q of getVersionQuestions("express", a.examVersion))
    a.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
  const legacy = hskWhatsAppDraft(
    profile,
    { ...gradeHskAttempt(a), saveStatus: "saved" },
    "en",
  );
  assert.match(legacy.message, /11\/11/);
  assert.doesNotMatch(
    legacy.message,
    /Character recognition 0\/0|Suggested start/,
  );
  const unavailable = hskWhatsAppDraft(
    profile,
    { ...result(), attempt: { ...a, examVersion: "not-archived" } },
    "en",
  );
  assert.equal(unavailable.includesResult, false);
  assert.match(unavailable.message, /Historical assessment needs review/);
  assert.doesNotMatch(unavailable.message, /items correct/);
  assert.equal(hskWhatsAppDraft(null, null, "en").includesResult, false);
});
test("learner report and WhatsApp merge deliberately skipped and timed out blanks while backend evidence is unchanged", () => {
  const a = newHskAttempt("express", randomUUID());
  a.completedAt = new Date().toISOString();
  a.answers[1] = null;
  a.navigation = { 1: "skip", 4: "timeout" };
  for (const q of getVersionQuestions("express").filter(
    (q) => q.id !== 1 && q.id !== 4,
  ))
    a.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
  const r = { ...gradeHskAttempt(a), saveStatus: "saved" as const };
  assert.equal(r.skippedCount, 1);
  assert.equal(r.unansweredCount, 1);
  assert.deepEqual(r.attempt.navigation, { 1: "skip", 4: "timeout" });
  for (const lang of ["zh", "en", "id"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(HskAssessmentReport, { result: r, lang }),
    );
    assert.doesNotMatch(html, /Skipped|Dilewati|跳过/);
    assert.match(html, /13/);
    assert.match(html, /未作答: 2|Unanswered: 2|Belum dijawab: 2/);
  }
  assert.match(hskWhatsAppDraft(profile, r, "en").message, /Unanswered：2/);
  assert.doesNotMatch(hskWhatsAppDraft(profile, r, "en").message, /skipped/i);
});
test("post-assessment welcome identifies reported foundation and completion instead of prompting another assessment", () => {
  for (const lang of ["zh", "en", "id"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(HskAssessmentWelcome, { profile, lang }),
    );
    assert.match(html, /测试学员/);
    assert.ok(!html.includes("Verification Required"));
    assert.ok(!html.includes("prepared"));
    assert.ok(!html.includes("测评已在下方开启"));
    assert.ok(!html.includes("exam score"));
  }
});
