import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { assessmentQuestionTypes } from "../src/utils/crmAssessmentQuestionTypes";
import { CrmAssessmentEvidence } from "../src/components/crm/CrmAssessmentEvidence";
import { newHskAttempt, gradeHskAttempt } from "../src/data/hskAssessment";
import {
  getVersionQuestions,
  HSK_EXAM_VERSION,
  HSK_SCORING_VERSION,
} from "../src/data/hskAssessmentVersions";
function fixture(
  mode: "full" | "express" = "full",
  examVersion = HSK_EXAM_VERSION,
  scoringVersion = HSK_SCORING_VERSION,
) {
  const a = {
    ...newHskAttempt(mode, "00000000-0000-4000-8000-000000000001"),
    examVersion,
    scoringVersion,
  };
  const questions = getVersionQuestions(mode, examVersion, scoringVersion);
  questions.forEach((q, i) => {
    if (i % 4 === 0) a.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
    else if (i % 4 === 1)
      a.answers[q.id] = q.options.find((o) => !o.isCorrect)!.id;
    else if (i % 4 === 2) a.answers[q.id] = null;
  });
  a.completedAt = a.startedAt;
  return gradeHskAttempt(a, "zh");
}
test("counts actual archived item answers by section and format, separately preserving skips and unanswered", () => {
  const result = fixture(),
    before = JSON.stringify(result),
    stats = assessmentQuestionTypes(result);
  assert.equal(stats.available, true);
  if (!stats.available) return;
  assert.deepEqual(stats.totals, {
    correct: 13,
    incorrect: 13,
    skipped: 12,
    unanswered: 12,
    total: 50,
  });
  assert.equal(stats.rows.length, 8);
  assert.deepEqual(
    stats.rows.find(
      (row) => row.section === "listening" && row.format === "image_select",
    ),
    {
      section: "listening",
      format: "image_select",
      correct: 2,
      incorrect: 2,
      skipped: 1,
      unanswered: 1,
      total: 6,
    },
  );
  assert.ok(
    stats.rows.some(
      (row) => row.section === "reading" && row.format === "image_select",
    ),
  );
  for (const row of stats.rows)
    assert.equal(
      row.total,
      row.correct + row.incorrect + row.skipped + row.unanswered,
    );
  assert.equal(JSON.stringify(result), before);
});
test("quick tests count only that version’s selected questions and old archives do not use today’s paper", () => {
  const versions = [
    "pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2",
    "pdf-e80a3cbaabc5-audio-1d13ab13-sequential-v3",
    HSK_EXAM_VERSION,
  ];
  for (const version of versions)
    for (const mode of ["express", "full"] as const) {
      const result = fixture(mode, version),
        stats = assessmentQuestionTypes(result);
      assert.equal(stats.available, true);
      if (stats.available) {
        assert.equal(
          stats.totals.total,
          getVersionQuestions(mode, version, result.attempt.scoringVersion)
            .length,
        );
        assert.equal(stats.totals.correct, result.correctCount);
        assert.equal(stats.totals.skipped, result.skippedCount);
        assert.equal(stats.totals.unanswered, result.unansweredCount);
      }
    }
  const quick = assessmentQuestionTypes(fixture("express"));
  assert.ok(quick.available);
  if (quick.available) assert.equal(quick.totals.total, 15);
});
test("ignores totals and saved grade, never fills missing answer/version evidence with defaults", () => {
  const result = fixture(),
    before = assessmentQuestionTypes(result);
  assert.deepEqual(
    assessmentQuestionTypes({
      ...result,
      score: 999,
      correctCount: 999,
      questionCount: 999,
      sections: {},
    }),
    before,
  );
  assert.deepEqual(
    assessmentQuestionTypes({
      ...result,
      attempt: { ...result.attempt, answers: undefined },
    }),
    { available: false, reason: "answers" },
  );
  for (const attempt of [
    { ...result.attempt, examVersion: undefined },
    { ...result.attempt, examVersion: "unsupported" },
    { ...result.attempt, scoringVersion: "unsupported" },
    { ...result.attempt, mode: "unknown" },
  ])
    assert.deepEqual(assessmentQuestionTypes({ attempt }), {
      available: false,
      reason: "version",
    });
  assert.deepEqual(
    assessmentQuestionTypes({
      ...result,
      attempt: { ...result.attempt, answers: { 99999: "A" } },
    }),
    { available: false, reason: "invalid" },
  );
  assert.deepEqual(
    assessmentQuestionTypes({
      ...result,
      attempt: { ...result.attempt, answers: { 1: "invalid-option" } },
    }),
    { available: false, reason: "invalid" },
  );
});
test("an explicitly empty answers object is all unanswered, not all wrong or skipped", () => {
  const result = fixture("express"),
    stats = assessmentQuestionTypes({
      ...result,
      attempt: { ...result.attempt, answers: {} },
    });
  assert.ok(stats.available);
  if (stats.available)
    assert.deepEqual(stats.totals, {
      correct: 0,
      incorrect: 0,
      skipped: 0,
      unanswered: 15,
      total: 15,
    });
});
test("history details render compact labeled numeric table, preserve grade, and do not repeat coarse summary", () => {
  const result = fixture();
  const html = render(
    React.createElement(CrmAssessmentEvidence, {
      lead: { latestAssessment: result, levelSource: "assessment" } as any,
      lang: "zh",
      timezone: "Asia/Jakarta",
    }),
  );
  assert.match(html, /<caption>题型表现/);
  assert.match(html, /scope="col">正确/);
  assert.match(html, /scope="col">错误/);
  assert.match(html, /跳过/);
  assert.match(html, /未作答/);
  assert.match(html, /选词填空|句子匹配/);
  assert.match(html, /选字填空/);
  assert.doesNotMatch(html, /<caption>分项结果/);
  const noAnswers = {
    ...result,
    attempt: { ...result.attempt, answers: undefined },
  };
  const unavailable = render(
    React.createElement(CrmAssessmentEvidence, {
      lead: { latestAssessment: noAnswers, levelSource: "assessment" } as any,
      lang: "zh",
      timezone: "Asia/Jakarta",
    }),
  );
  assert.match(unavailable, /缺少逐题答案/);
  assert.doesNotMatch(unavailable, /<caption>题型表现/);
  assert.match(unavailable, /<caption>分项结果/);
  const full = fixture();
  const questions = getVersionQuestions(
    "full",
    full.attempt.examVersion,
    full.attempt.scoringVersion,
  );
  questions.forEach(
    (q) =>
      (full.attempt.answers[q.id] = q.options.find((o) => o.isCorrect)!.id),
  );
  const completeHtml = render(
    React.createElement(CrmAssessmentEvidence, {
      lead: { latestAssessment: full, levelSource: "assessment" } as any,
      lang: "zh",
      timezone: "Asia/Jakarta",
    }),
  );
  assert.doesNotMatch(completeHtml, /<th[^>]*>未作答<\/th>/);
});

test('per-record detail keeps the type table without repeating summary, stat cards or nested history metadata',()=>{
 const result=fixture(),before=JSON.stringify(result);
 const html=render(React.createElement(CrmAssessmentEvidence,{lead:{latestAssessment:result,levelSource:'assessment'} as any,lang:'zh',timezone:'Asia/Jakarta',historyDetail:true}));
 assert.match(html,/题型表现/);assert.match(html,/50.*题/);assert.match(html,/选词填空/);
 assert.doesNotMatch(html,/本次测评结果|当前结论|测评依据与历史记录|正确题数|跳过题数|完成时间|记录时间|试卷版本|评分版本/);
 assert.equal(JSON.stringify(result),before);
});
