import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getVersionQuestions,
  requireHskVersion,
  HSK_EXAM_VERSION,
  HSK_SCORING_VERSION,
} from "../src/data/hskAssessmentVersions";
import { newHskAttempt, gradeHskAttempt } from "../src/data/hskAssessment";
import { safeHskResult } from "../src/data/hskReportHistory";
import HskAssessmentReport from "../src/components/HskAssessmentReport";
import HSKPlacementAssessment from "../src/components/HSKPlacementAssessment";
const qs = getVersionQuestions("express");
function sample(counts: number[]) {
  const a = newHskAttempt("express", randomUUID());
  a.completedAt = new Date().toISOString();
  for (const [index, level] of ["HSK 1", "HSK 2", "HSK 3"].entries()) {
    qs.filter((q) => q.level === level).forEach((q, i) => {
      a.answers[q.id] = q.options.find(
        (o) => o.isCorrect === i < counts[index],
      )!.id;
    });
  }
  return a;
}
test("15-item quick sample keeps the approved source IDs, five per star and 6/7/2 skills without changing media, keys or Full gates", () => {
  assert.deepEqual(
    qs.map((q) => q.id),
    [1, 4, 8, 11, 14, 21, 24, 27, 29, 30, 36, 40, 41, 45, 50],
  );
  assert.deepEqual(
    ["HSK 1", "HSK 2", "HSK 3"].map(
      (l) => qs.filter((q) => q.level === l).length,
    ),
    [5, 5, 5],
  );
  assert.deepEqual(
    ["listening", "reading", "writing"].map(
      (s) => qs.filter((q) => q.section === s).length,
    ),
    [6, 7, 2],
  );
  const v = requireHskVersion(HSK_EXAM_VERSION, HSK_SCORING_VERSION),
    old = requireHskVersion(
      "pdf-e80a3cbaabc5-audio-1d13ab13-sequential-v3",
      HSK_SCORING_VERSION,
    );
  assert.deepEqual(
    v.questions.map(({ isExpressSelected, ...q }) => q),
    old.questions.map(({ isExpressSelected, ...q }) => q),
  );
  for (const key of [
    "audioAssets",
    "imageAssets",
    "displayOptions",
    "fullPassCounts",
  ] as const)
    assert.deepEqual(v[key], old[key]);
  const r = gradeHskAttempt(sample([5, 5, 5]));
  assert.equal(r.questionCount, 15);
  assert.equal(r.maxScore, 30);
  assert.equal(r.correctCount, 15);
  assert.equal(r.thresholds.length, 0);
});
test("starting point follows consecutive foundation groups and handles boundaries and conflicting harder results", () => {
  for (const [counts, stage, start, reason] of [
    [[2, 0, 0], 0, 1, "clear"],
    [[4, 2, 0], 1, 2, "clear"],
    [[4, 4, 2], 2, 3, "clear"],
    [[4, 4, 4], 3, 3, "clear"],
    [[3, 1, 0], 0, 1, "boundary"],
    [[5, 3, 2], 1, 2, "boundary"],
    [[5, 5, 3], 2, 3, "boundary"],
    [[3, 4, 4], 0, 1, "inconsistent"],
    [[5, 2, 4], 1, 2, "inconsistent"],
  ] as const) {
    const r = gradeHskAttempt(sample([...counts]));
    assert.deepEqual(
      [
        r.screeningPlacement!.stage,
        r.screeningPlacement!.suggestedStartLevel,
        r.screeningPlacement!.reason,
      ],
      [stage, start, reason],
      counts.join("/"),
    );
    assert.equal(r.screeningPlacement!.needsReview, reason !== "clear");
  }
});
test("missing/skipped answers and playback failures qualify the recommendation; client-supplied placement cannot forge it", () => {
  const a = sample([5, 5, 5]);
  a.answers[50] = null;
  assert.equal(gradeHskAttempt(a).screeningPlacement!.reason, "incomplete");
  delete a.answers[50];
  assert.equal(gradeHskAttempt(a).screeningPlacement!.reason, "incomplete");
  a.audioFailures = [1];
  assert.equal(gradeHskAttempt(a).screeningPlacement!.reason, "audio_error");
  const zero = sample([0, 0, 0]);
  const r = gradeHskAttempt({
    ...zero,
    screeningPlacement: { stage: 3, suggestedStartLevel: 3 },
    score: 30,
  });
  assert.equal(r.screeningPlacement!.stage, 0);
  assert.equal(r.score, 0);
});
test("new quick guidance is localized and restored by recomputing the versioned policy; legacy 11-item reports stay legacy", () => {
  for (const lang of ["zh", "en", "id"] as const) {
    const r = gradeHskAttempt(sample([5, 2, 1]), lang),
      restored = safeHskResult(
        { ...r, screeningPlacement: { stage: 3 } },
        lang,
      )!;
    assert.equal(restored.screeningPlacement!.suggestedStartLevel, 2);
    const html = renderToStaticMarkup(
      React.createElement(HskAssessmentReport, { result: r, lang }),
    );
    assert.match(html, /HSK 2/);
    assert.ok(!html.includes("undetermined"));
    assert.ok(!html.includes("3–4"));
  }
  for (const examVersion of [
    "pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2",
    "pdf-e80a3cbaabc5-audio-1d13ab13-sequential-v3",
  ]) {
    const a = { ...newHskAttempt("express", randomUUID()), examVersion };
    a.completedAt = new Date().toISOString();
    for (const q of getVersionQuestions("express", examVersion))
      a.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
    const r = gradeHskAttempt(a);
    assert.equal(r.questionCount, 11);
    assert.equal(r.maxScore, 22);
    assert.equal(r.screeningPlacement, undefined);
    assert.match(r.levelConfirmed, /undetermined/);
  }
  const legacy = readFileSync(
    "src/data/hskVersions/pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2.json",
  );
  assert.equal(
    createHash("sha256").update(legacy).digest("hex"),
    "d8740a702e6c9d3cde78a9d90344a4cb333cbca40ee043e580b1c8409b013251",
  );
});
test("Full is first and selected by default, with 15-item Quick second and updated duration", () => {
  const html = renderToStaticMarkup(
    React.createElement(HSKPlacementAssessment, {
      lang: "en",
      studentName: "QA",
      onComplete: () => {},
    }),
  );
  assert.ok(html.indexOf("Full assessment") < html.indexOf("Quick assessment"));
  assert.match(html, /type="radio"[^>]*checked=""/);
  assert.match(html, /15 items/);
  assert.match(html, /6–10 minutes/);
});
