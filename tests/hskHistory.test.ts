import {selectVisitorScope, visitorKey} from '../src/services/visitorScope';
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  newHskAttempt,
  gradeHskAttempt,
  validateHskAttempt,
  type HskResult,
} from "../src/data/hskAssessment";
import {
  getVersionQuestions,
  requireHskVersion,
  HSK_EXAM_VERSION,
  HSK_SCORING_VERSION,
} from "../src/data/hskAssessmentVersions";
import {
  getExamQuestions,
  evaluateOfficialHskScore,
} from "../src/data/hskQuizQuestions";
import { FULL_HSK_PASS_COUNTS } from "../src/data/hskScoring";
import {
  inspectHskReport,
  inspectHskHistoryRows,
} from "../src/data/hskReportHistory";
import {
  readHskHistoryState,
  readHskHistory,
  writeHskResult,
  mergeHskHistoryRows,
} from "../src/services/hskAttemptStorage";
import HskAssessmentReport from "../src/components/HskAssessmentReport";
selectVisitorScope("a".repeat(64));
const historyKey = visitorKey("uper_hsk_history_v2");
function report(mode: "full" | "express" = "full", offset = 0): HskResult {
  const attempt = newHskAttempt(mode, randomUUID());
  attempt.startedAt = new Date(Date.now() - 200000 + offset).toISOString();
  attempt.completedAt = new Date(Date.now() - 100000 + offset).toISOString();
  for (const q of getVersionQuestions(mode))
    attempt.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
  return gradeHskAttempt(attempt);
}
function storage(
  run: (
    values: Map<string, string>,
    storage: {
      getItem: (k: string) => string | null;
      setItem: (k: string, v: string) => void;
    },
  ) => void,
) {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  const store = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: store,
  });
  try {
    run(values, store);
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else delete (globalThis as any).localStorage;
  }
}
const unknown = (r: HskResult) => ({
  ...r,
  score: 42,
  levelConfirmed: "Recorded legacy conclusion",
  summary: "Recorded legacy summary",
  attempt: {
    ...r.attempt,
    examVersion: "unavailable-old-paper",
    scoringVersion: "old-rule",
  },
});
test("archived v2 bank equals the verified current bank and is recursively frozen", () => {
  const version = requireHskVersion(HSK_EXAM_VERSION, HSK_SCORING_VERSION);
  assert.deepEqual(
    JSON.parse(JSON.stringify(version.questions.map(({isExpressSelected,...q})=>q))),
    JSON.parse(JSON.stringify(getExamQuestions("full").map(({isExpressSelected,...q})=>q))),
  );
  assert.deepEqual(version.fullPassCounts, FULL_HSK_PASS_COUNTS);
  assert.ok(Object.isFrozen(version));
  assert.ok(Object.isFrozen(version.questions[0].options[0]));
  assert.equal(getVersionQuestions("express").length, 15);
  assert.throws(() => requireHskVersion(HSK_EXAM_VERSION, "unavailable-rule"));
});
test("archived grades and report content do not follow mutable authoring-bank or live threshold changes", () => {
  const r = report();
  const live = getExamQuestions("full")[0];
  const option = live.options.find((o) => o.isCorrect)!;
  const oldCorrect = option.isCorrect;
  const oldScript = live.spokenScript;
  const oldGate = FULL_HSK_PASS_COUNTS.hsk1.hsk1;
  try {
    option.isCorrect = false;
    live.spokenScript = "New authoring text must not appear in the archive";
    (FULL_HSK_PASS_COUNTS.hsk1 as any).hsk1 = 100;
    assert.equal(gradeHskAttempt(r.attempt).score, 100);
    assert.match(gradeHskAttempt(r.attempt).levelConfirmed, /HSK 3/);
    const html = renderToStaticMarkup(
      React.createElement(HskAssessmentReport, { result: r, lang: "zh", detailed: true }),
    );
    assert.doesNotMatch(html, /New authoring text/);
    assert.match(html, /HSK 1 ≥11/);
  } finally {
    option.isCorrect = oldCorrect;
    live.spokenScript = oldScript;
    (FULL_HSK_PASS_COUNTS.hsk1 as any).hsk1 = oldGate;
  }
});
test("unknown versions show recorded unverified summaries without grading, resubmission or current explanations", () => {
  const r = unknown(report());
  assert.equal(inspectHskReport(r).kind, "unknown_version");
  assert.throws(() => validateHskAttempt(r.attempt));
  for (const lang of ["zh", "en", "id"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(HskAssessmentReport, {
        result: r,
        lang,
        onRetry: () => {
          throw Error("Not reachable");
        },
      }),
    );
    assert.match(html, /42\/100/);
    assert.match(html, /Recorded legacy summary/);
    assert.doesNotMatch(
      html,
      /查看逐题答案|Review answers|Tinjau jawaban|重试保存|Retry saving|Coba simpan lagi/,
    );
  }
});
test("a malformed history row cannot suppress valid reports or crash a report render", () => {
  const one = report(),
    two = report("express", 1000);
  const rows = [
    one,
    null,
    { attempt: [] },
    { ...one, attempt: { ...one.attempt, answers: { 999: "A" } } },
    unknown(two),
    two,
  ];
  const state = inspectHskHistoryRows(rows, "id");
  assert.equal(state.results.length, 2);
  assert.equal(state.problems.length, 4);
  assert.equal(state.results[0].attempt.attemptId, two.attempt.attemptId);
  for (const raw of [null, {}, 42, { attempt: {} }])
    assert.match(
      renderToStaticMarkup(
        React.createElement(HskAssessmentReport, { result: raw, lang: "en" }),
      ),
      /cannot be read/,
    );
});
test("saving a new result retains every raw incompatible or damaged row and all earlier valid reports", () =>
  storage((values) => {
    const one = report(),
      legacy = unknown(report("express")),
      bad = { keep: "exactly this malformed row" };
    values.set(historyKey, JSON.stringify([one, legacy, bad]));
    assert.equal(readHskHistory().length, 1);
    assert.equal(writeHskResult(report("express", 2000)), true);
    const raw = JSON.parse(values.get(historyKey)!);
    assert.equal(raw.length, 4);
    assert.deepEqual(raw[1], legacy);
    assert.deepEqual(raw[2], bad);
    assert.equal(readHskHistoryState().problems.length, 2);
    assert.equal(readHskHistory().length, 2);
  }));
test("malformed container is backed up byte-for-byte before new report replaces it", () =>
  storage((values) => {
    const damaged = '[{"broken":  ';
    values.set(historyKey, damaged);
    assert.equal(readHskHistoryState().problems[0].reason, "invalid_container");
    assert.equal(values.get(historyKey), damaged);
    assert.equal(writeHskResult(report()), true);
    const marker = JSON.parse(values.get(historyKey)!)[0];
    assert.equal(marker.hskRecovery, true);
    assert.equal(values.get(marker.storageKey), damaged);
    assert.equal(readHskHistory().length, 1);
    assert.equal(readHskHistoryState().problems[0].reason, "recovery_backup");
  }));
test("failed recovery backup or primary storage write leaves the original malformed container untouched", () => {
  for (const failure of ["backup", "primary"])
    storage((values, store) => {
      const damaged = "not JSON";
      values.set(historyKey, damaged);
      store.setItem = (k, v) => {
        if (
          (failure === "primary" && k === historyKey) ||
          (failure === "backup" && k !== historyKey)
        )
          throw Error("quota");
        values.set(k, v);
      };
      assert.equal(writeHskResult(report()), false);
      assert.equal(values.get(historyKey), damaged);
      if (failure === "primary")
        assert.ok(
          [...values].some(([k, v]) => k !== historyKey && v === damaged),
        );
    });
});
test("valid reports remain readable when an unknown or malformed server row is restored, and repeated restores do not duplicate it", () =>
  storage((values) => {
    const one = report(),
      bad = { corrupt: true },
      old = unknown(report());
    writeHskResult(one);
    const restored = mergeHskHistoryRows([
      bad,
      old,
      { ...report("express", 1000), saveStatus: "saved" },
    ]);
    assert.equal(restored.results.length, 2);
    assert.equal(restored.problems.length, 2);
    assert.equal(restored.results[0].saveStatus, "saved");
    mergeHskHistoryRows([bad, old]);
    assert.equal(JSON.parse(values.get(historyKey)!).length, 4);
  }));
test("a blocked local store still returns usable server reports and their isolated unknown records", () =>
  storage((_values, store) => {
    store.getItem = () => {
      throw Error("blocked");
    };
    store.setItem = () => {
      throw Error("blocked");
    };
    const state = mergeHskHistoryRows(
      [report(), null, unknown(report())],
      "zh",
    );
    assert.equal(state.storageAvailable, false);
    assert.equal(state.results.length, 1);
    assert.equal(state.problems.length, 2);
  }));
test("local history displays latest twenty but retains older rows instead of truncating storage", () =>
  storage((values) => {
    for (let n = 0; n < 23; n++)
      assert.equal(writeHskResult(report("express", n * 1000)), true);
    assert.equal(readHskHistory().length, 20);
    assert.equal(JSON.parse(values.get(historyKey)!).length, 23);
  }));
test("saved records are not downgraded or replaced by changed local attempts using the same ID", () =>
  storage(() => {
    const r = { ...report(), saveStatus: "saved" as const };
    assert.equal(writeHskResult(r), true);
    assert.equal(writeHskResult({ ...r, saveStatus: "local" }), true);
    assert.equal(readHskHistory()[0].saveStatus, "saved");
    const changed = gradeHskAttempt({ ...r.attempt, answers: {} });
    assert.equal(writeHskResult(changed), false);
    assert.equal(readHskHistory()[0].score, 100);
  }));

test("baseline v2 archive has a fixed fingerprint, including option labels and assets", () => {
  const digest = createHash("sha256")
    .update(
      readFileSync(
        "src/data/hskVersions/pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2.json",
      ),
    )
    .digest("hex");
  assert.equal(
    digest,
    "d8740a702e6c9d3cde78a9d90344a4cb333cbca40ee043e580b1c8409b013251",
  );
  const version = requireHskVersion(HSK_EXAM_VERSION, HSK_SCORING_VERSION);
  assert.equal(Object.keys(version.displayOptions).length, 50);
  assert.equal(Object.keys(version.audioAssets).length, 21);
  assert.equal(Object.keys(version.imageAssets).length, 22);
});
test("versioned scorer matches every confirmed Full boundary and partial-answer count", () => {
  for (const counts of [
    [10, 17, 18],
    [11, 0, 0],
    [11, 17, 18],
    [12, 11, 18],
    [12, 12, 0],
    [12, 13, 18],
    [12, 14, 12],
    [12, 14, 13],
    [15, 17, 18],
  ]) {
    const attempt = newHskAttempt("full", randomUUID());
    ["HSK 1", "HSK 2", "HSK 3"].forEach((level, index) =>
      getVersionQuestions("full")
        .filter((q) => q.level === level)
        .forEach((q, pos) => {
          attempt.answers[q.id] = q.options.find(
            (o) => o.isCorrect === pos < counts[index],
          )!.id;
        }),
    );
    const expected = evaluateOfficialHskScore(
      attempt.answers as Record<number, string>,
      getExamQuestions("full"),
      "full",
    );
    const actual = gradeHskAttempt(attempt, "en");
    assert.equal(actual.score, expected.totalScore);
    assert.equal(actual.thresholds[0].reached, expected.passStandards.passHsk1);
    assert.equal(actual.thresholds[1].reached, expected.passStandards.passHsk2);
    assert.equal(actual.thresholds[2].reached, expected.passStandards.passHsk3);
  }
});

test("saved report protection also applies beyond the twenty displayed records", () =>
  storage((values) => {
    const original = {
      ...report("full", -10000),
      saveStatus: "saved" as const,
    };
    writeHskResult(original);
    for (let n = 0; n < 21; n++) writeHskResult(report("express", n * 1000));
    assert.equal(
      readHskHistory().some(
        (r) => r.attempt.attemptId === original.attempt.attemptId,
      ),
      false,
    );
    const changed = gradeHskAttempt({ ...original.attempt, answers: {} });
    assert.equal(writeHskResult(changed), false);
    assert.equal(
      JSON.parse(values.get(historyKey)!).find(
        (r) => r?.attempt?.attemptId === original.attempt.attemptId,
      ).score,
      100,
    );
  }));
