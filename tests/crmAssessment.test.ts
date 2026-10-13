import assert from "node:assert/strict";
import {test} from "node:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {crmAssessmentSummary} from "../src/utils/crmAssessment.ts";
import {CrmGoalAssessment} from "../src/components/crm/CrmGoalAssessment.tsx";
import {newHskAttempt, gradeHskAttempt, type HskResult} from "../src/data/hskAssessment.ts";
import {getVersionQuestions} from "../src/data/hskAssessmentVersions.ts";
import type {CrmLeadRecord} from "../src/types/crmLead.ts";

function result(mode: "full" | "express", correct = true, lang: "en" | "zh" | "id" = "id") {
  const attempt = newHskAttempt(mode, "00000000-0000-4000-8000-000000000001");
  for (const q of getVersionQuestions(mode, attempt.examVersion, attempt.scoringVersion))
    attempt.answers[q.id] = q.options.find(o => o.isCorrect === correct)!.id;
  return gradeHskAttempt(attempt, lang);
}
const lead = (extra = {}) => ({goal: "Work in China", reportedLevel: "Not sure", ...extra}) as CrmLeadRecord;
const withResult = (r: HskResult, extra = {}) => lead({latestAssessment: r, levelSource: "assessment", levelConfirmed: r.levelConfirmed, ...extra});
const render = (value: CrmLeadRecord, lang: "en" | "zh", showGoal = true) => renderToStaticMarkup(React.createElement(CrmGoalAssessment, {lead: value, lang, showGoal, isLight: true}));

test("CRM uses saved full thresholds in the selected language, never stored prose or a total-score estimate", () => {
  const value = withResult(result("full"));
  const before = JSON.stringify(value);
  assert.deepEqual(crmAssessmentSummary(value, "en"), {goal: "Work in China", conclusion: "HSK 3 paper threshold met · Provisional", detail: "Full assessment · 100/100 pts", kind: "assessment"});
  assert.equal(crmAssessmentSummary(value, "zh").conclusion, "本卷 HSK 3 门槛达成 · 暂定");
  const below = withResult(result("full", false));
  // A mismatched score cannot upgrade saved threshold outcomes.
  below.latestAssessment!.score = 100;
  assert.equal(crmAssessmentSummary(below, "en").conclusion, "HSK 1 paper threshold not met");
  assert.equal(JSON.stringify(value), before);
});

test("Quick is a starting-point suggestion with its own denominator and review state, never a passed level", () => {
  const value = withResult(result("express"));
  assert.equal(crmAssessmentSummary(value, "en").conclusion, "Suggested start: HSK 3 consolidation");
  assert.equal(crmAssessmentSummary(value, "en").detail, "Quick assessment · 30/30 pts");
  value.latestAssessment!.screeningPlacement!.needsReview = true;
  assert.equal(crmAssessmentSummary(value, "zh").conclusion, "建议起点：HSK 3 进阶内容 · 待复核");
  assert.doesNotMatch(render(value, "en"), /threshold|passed|Confirmed|✓/);
});

test("teacher placement never borrows another assessment's score or conclusion", () => {
  const value = withResult(result("full"), {levelSource: "trial", levelConfirmed: "HSK 2", quizScore: 100, quizMaxScore: 100});
  assert.deepEqual(crmAssessmentSummary(value, "en"), {goal: "Work in China", conclusion: "HSK 2", detail: "Teacher placement", kind: "teacher"});
  assert.doesNotMatch(render(value, "zh"), /100|暂定|✓/);
  value.levelConfirmed = undefined;
  assert.equal(crmAssessmentSummary(value, "zh").conclusion, "未记录定级结果");
});

test("one saved attempt supplies score and maximum without blending stale lead fields", () => {
  const value = withResult(result("express"), {quizScore: 99, quizMaxScore: 100});
  assert.equal(crmAssessmentSummary(value, "zh").detail, "快速测评 · 30/30 分");
  delete (value.latestAssessment as Partial<HskResult>).maxScore;
  assert.equal(crmAssessmentSummary(value, "en").detail, "Quick assessment · 30 pts (maximum unknown)");
  value.latestAssessment!.score = 0;
  assert.match(crmAssessmentSummary(value, "zh").detail, /0 分/);
});

test("legacy prose, unknown modes and missing structures remain unverified rather than inferred from points", () => {
  const legacy = lead({levelSource: "assessment", levelConfirmed: "Paper HSK 3 threshold reached (provisional)", quizScore: 100});
  assert.equal(crmAssessmentSummary(legacy, "zh").conclusion, "结果待复核");
  assert.equal(crmAssessmentSummary(legacy, "en").detail, "Historical assessment · 100 pts (maximum unknown)");
  const quick = withResult(result("express"));
  delete quick.latestAssessment!.screeningPlacement;
  assert.equal(crmAssessmentSummary(quick, "en").conclusion, "Starting point pending review");
  for (const malformed of [[], {attempt: null, thresholds: "bad"}, {attempt: {mode: "future"}, score: 90, maxScore: 100}]) {
    assert.equal(crmAssessmentSummary(lead({latestAssessment: malformed, levelSource: "assessment"}), "en").conclusion, "Result pending review");
  }
});

test("duplicate or inconsistent saved thresholds are review cases, not proficiency claims", () => {
  const value = withResult(result("full"));
  value.latestAssessment!.thresholds[0].reached = false;
  assert.equal(crmAssessmentSummary(value, "en").conclusion, "Result pending review");
  value.latestAssessment!.thresholds[0] = value.latestAssessment!.thresholds[1];
  assert.equal(crmAssessmentSummary(value, "zh").conclusion, "结果待复核");
});

test("self-reported, beginner and unknown states do not pretend an assessment occurred", () => {
  assert.equal(crmAssessmentSummary(lead({reportedLevel: "HSK 2"}), "en").detail, "Self-reported · No assessment recorded");
  assert.equal(crmAssessmentSummary(lead({reportedLevel: "Beginner"}), "zh").conclusion, "零基础");
  assert.equal(crmAssessmentSummary(lead(), "zh").conclusion, "水平未知");
  assert.equal(crmAssessmentSummary(lead({goal: undefined}), "en").goal, "Goal not recorded");
});

test("standard and expanded summaries match; three stacked fields have no tick, repeated source or mixed system language", () => {
  for (const value of [withResult(result("full")), withResult(result("express")), withResult(result("full"), {levelSource: "trial", levelConfirmed: "HSK 2"}), lead({reportedLevel: "Beginner"})]) {
    const before = JSON.stringify(value);
    for (const lang of ["en", "zh"] as const) {
      const standard = render(value, lang), expanded = render(value, lang, false);
      assert.equal((standard.match(/class="crm-assessment-/g) || []).length, 3);
      assert.equal((expanded.match(/class="crm-assessment-/g) || []).length, 2);
      assert.equal(standard.replace(/<div class="crm-assessment-goal"[^>]*>.*?<\/div>/, ""), expanded);
      assert.doesNotMatch(standard, /✓|Paper result|本卷参考|Ambang|Disarankan|Tahap/);
      if (lang === "en") assert.doesNotMatch(standard, /[\u4e00-\u9fff]/);
      else assert.doesNotMatch(standard, /Work in China|assessment ·|placement|Provisional|Suggested|pts/);
    }
    assert.equal(JSON.stringify(value), before);
  }
});
