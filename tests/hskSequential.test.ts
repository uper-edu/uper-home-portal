import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HskPlayback } from "../src/services/hskPlayback";
import {
  newHskAttempt,
  gradeHskAttempt,
  validateHskAttempt,
} from "../src/data/hskAssessment";
import {
  requireHskVersion,
  HSK_EXAM_VERSION,
  HSK_SCORING_VERSION,
} from "../src/data/hskAssessmentVersions";
import HskAssessmentReport from "../src/components/HskAssessmentReport";
import { HskExamImage } from "../src/components/HskExamVisuals";
import manifest from "../src/data/hskSequentialAudioManifest.json";
import oldAudio from "../src/data/hskAudioManifest.json";
class Media {
  src = "";
  currentTime = 0;
  duration = 30;
  preload = "";
  paused = true;
  onloadedmetadata: any;
  ontimeupdate: any;
  onplaying: any;
  onwaiting: any;
  onended: any;
  onerror: any;
  reject: any;
  play() {
    this.paused = false;
    return this.reject ? Promise.reject(this.reject) : Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
function setup() {
  const m = new Media();
  const status: string[] = [];
  let ends = 0,
    starts = 0,
    errors = 0;
  const times: number[] = [];
  const p = new HskPlayback(m as unknown as HTMLAudioElement, {
    status: (s) => status.push(s),
    time: (s) => times.push(s),
    started: () => starts++,
    ended: () => ends++,
    failed: () => errors++,
  });
  return { m, p, status, times, counts: () => ({ ends, starts, errors }) };
}
test("sequential audio retains the entire source suffix, both readings and answer pause for all 21 items", () => {
  const oldVersion = requireHskVersion(
    "pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2",
    HSK_SCORING_VERSION,
  );
  const current = requireHskVersion(HSK_EXAM_VERSION, HSK_SCORING_VERSION);
  assert.deepEqual(current.questions.map(({isExpressSelected,...q})=>q), oldVersion.questions.map(({isExpressSelected,...q})=>q));
  assert.deepEqual(current.imageAssets, oldVersion.imageAssets);
  assert.deepEqual(current.fullPassCounts, oldVersion.fullPassCounts);
  for (const [id, a] of Object.entries(manifest.assets)) {
    const source = oldAudio.assets[id as keyof typeof oldAudio.assets];
    const before = readFileSync("public" + source.src),
      after = readFileSync("public" + a.src);
    assert.ok(before.subarray(before.length - after.length).equals(after));
    assert.equal(createHash("sha256").update(after).digest("hex"), a.sha256);
    assert.ok(
      a.removedPrefixSec > 0 &&
        a.removedPrefixSec > a.announcementQuietGapSec[0] &&
        a.removedPrefixSec < a.announcementQuietGapSec[1],
    );
    assert.equal(a.spokenRepeats, 2);
    assert.equal(a.tailAndRepeatsUnchanged, true);
    assert.ok(a.durationSec - a.answerPauseStartSec > 5);
  }
});
test("pausing preserves position, resumes without replay and buffering does not advance a wall-clock deadline", () => {
  const { m, p, status, times, counts } = setup();
  p.load("/q1", 8);
  m.onloadedmetadata();
  assert.equal(m.currentTime, 8);
  m.onplaying();
  m.currentTime = 12;
  m.ontimeupdate();
  p.pause();
  assert.equal(p.position, 12);
  assert.equal(m.paused, true);
  p.resume();
  m.onplaying();
  assert.equal(m.currentTime, 12);
  m.onwaiting();
  assert.equal(status.at(-1), "loading");
  assert.deepEqual(times, [12]);
  assert.equal(counts().ends, 0);
});
test("old ended/time/error callbacks cannot affect a later item; ended fires only once", () => {
  const { m, p, counts, times } = setup();
  p.load("/q1");
  const oldEnd = m.onended,
    oldTime = m.ontimeupdate,
    oldError = m.onerror;
  p.load("/q2");
  oldEnd();
  oldTime();
  oldError();
  assert.deepEqual(counts(), { ends: 0, starts: 0, errors: 0 });
  assert.deepEqual(times, []);
  m.onended();
  m.onended();
  assert.equal(counts().ends, 1);
});
test("autoplay blocked is recoverable without marking audio unavailable or ending an item", async () => {
  const { m, p, status, counts } = setup();
  m.reject = Object.assign(new Error("blocked"), { name: "NotAllowedError" });
  p.load("/q1");
  await Promise.resolve();
  assert.equal(status.at(-1), "blocked");
  assert.equal(counts().errors, 0);
  assert.equal(counts().ends, 0);
  m.reject = undefined;
  p.resume();
  m.onplaying();
  assert.equal(status.at(-1), "playing");
});
test("a pending play rejection after pause or manual departure cannot overwrite current state", async () => {
  const { m, p, status, counts } = setup();
  m.reject = new Error("network");
  p.load("/q1");
  p.pause();
  await Promise.resolve();
  assert.equal(status.at(-1), "paused");
  assert.equal(counts().errors, 0);
  p.load("/q2");
  p.stop();
  await Promise.resolve();
  assert.equal(counts().errors, 0);
});
test("navigation evidence is versioned, bounded, preserved for v3 and cannot change grades", () => {
  const a = newHskAttempt("full", randomUUID());
  a.answers[1] = "C";
  a.navigation = { 1: "next", 2: "timeout", 3: "skip" };
  a.audioPositions = { 1: 1.5 };
  a.pauseCount = 1;
  a.completedAt = new Date().toISOString();
  const r = gradeHskAttempt(a);
  assert.equal(r.score, 2);
  assert.deepEqual(r.attempt.navigation, a.navigation);
  assert.equal(r.attempt.pauseCount, 1);
  assert.throws(() => validateHskAttempt({ ...a, audioPositions: { 1: 999 } }));
  assert.throws(() => validateHskAttempt({ ...a, navigation: { 51: "skip" } }));
  assert.throws(() => validateHskAttempt({ ...a, navigation: [] }));
  const old = {
    ...a,
    examVersion: "pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2",
  };
  assert.equal(gradeHskAttempt(old).attempt.navigation, undefined);
});
test("learner results show sections and source stars without grading badges, explanations or retest controls", () => {
  const a = newHskAttempt("express", randomUUID());
  a.completedAt = new Date().toISOString();
  const r = gradeHskAttempt(a);
  for (const lang of ["zh", "en", "id"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(HskAssessmentReport, { result: r, lang }),
    );
    assert.match(html, /0\/15/);
    assert.match(html, /★★★/);
    assert.doesNotMatch(
      html,
      /undetermined|Continue review|Take another|thresholds|查看逐题/,
    );
  }
  const image = renderToStaticMarkup(
    React.createElement(HskExamImage, {
      id: "airplane",
      examVersion: HSK_EXAM_VERSION,
      scoringVersion: HSK_SCORING_VERSION,
    }),
  );
  assert.doesNotMatch(image, /Enlarge|dialog|zoom/);
  assert.match(image, /source-e80a3cbaabc5/);
});
