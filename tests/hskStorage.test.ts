import {selectVisitorScope, visitorKey} from '../src/services/visitorScope';
selectVisitorScope('a'.repeat(64));
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newHskAttempt, gradeHskAttempt } from "../src/data/hskAssessment";
import {
  readHskDraft,
  writeHskDraft,
  readHskHistory,
  writeHskResult,
  clearHskDraft,
} from "../src/services/hskAttemptStorage";
test("versioned local drafts restore item/skip/replay state, reject incompatible data and preserve chronological history", () => {
  const values = new Map<string, string>();
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  try {
    const attempt = newHskAttempt("full", randomUUID());
    attempt.answers[1] = null;
    attempt.answers[2] = "B";
    attempt.plays[1] = 2;
    assert.equal(
      writeHskDraft({ attempt, currentIdx: 1, reviewing: false }),
      true,
    );
    assert.deepEqual(readHskDraft(), {
      attempt,
      currentIdx: 1,
      reviewing: false,
    });
    values.set(
      visitorKey("uper_hsk_draft_v2"),
      JSON.stringify({
        attempt: { ...attempt, examVersion: "old" },
        currentIdx: 1,
      }),
    );
    assert.equal(readHskDraft(), null);
    const first = { ...attempt, completedAt: new Date().toISOString() };
    const second = {
      ...first,
      attemptId: randomUUID(),
      completedAt: new Date(Date.now() + 1000).toISOString(),
    };
    const newer = gradeHskAttempt(second, "id");
    assert.equal(writeHskResult(newer), true);
    assert.equal(writeHskResult(gradeHskAttempt(first, "zh")), true);
    assert.equal(readHskHistory("en")[0].attempt.attemptId, second.attemptId);
    assert.equal(readHskHistory().length, 2);
    writeHskResult({ ...newer, saveStatus: "saved" });
    assert.equal(readHskHistory()[0].saveStatus, "saved");
    assert.equal(readHskHistory().length, 2);
    clearHskDraft();
    assert.equal(readHskDraft(), null);
    values.set(visitorKey("uper_hsk_draft_v2"), "bad json");
    assert.equal(readHskDraft(), null);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw Error("disabled");
        },
        setItem: () => {
          throw Error("disabled");
        },
      },
    });
    assert.equal(
      writeHskDraft({ attempt, currentIdx: 0, reviewing: false }),
      false,
    );
    assert.equal(writeHskResult(newer), false);
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else delete (globalThis as any).localStorage;
  }
});

import { getStudentContext } from "../src/services/studentProfileStorage";
test("unscoped legacy context stays stored without being assigned to the current visitor", () => {
  const original = Object.getOwnPropertyDescriptors(globalThis);
  const items = new Map<string, string>();
  const storage = {
    getItem: (k: string) => items.get(k) || null,
    setItem: (k: string, v: string) => items.set(k, v),
  };
  Object.assign(globalThis, {
    window: {},
    localStorage: storage,
    sessionStorage: { getItem: () => null },
  });
  try {
    items.set(
      "uper_lead_profile",
      JSON.stringify({
        fullName: "Legacy QA",
        quizScore: 22,
        totalQuestions: 22,
      }),
    );
    const migrated = getStudentContext();
    assert.equal(migrated, null);
    assert.ok(items.has('uper_lead_profile'));
    assert.equal(migrated?.assessment?.questionCount, undefined);
    assert.equal(migrated?.assessment?.maxScore, undefined);
    items.set(
      "uper_unified_student_context",
      JSON.stringify({
        assessment: { completed: true, score: 20, total: 100 },
        lastUpdated: "legacy",
      }),
    );
    assert.equal(
      getStudentContext()?.assessment?.saveStatus,
      undefined,
    );
    assert.ok(items.has('uper_unified_student_context'));
  } finally {
    for (const k of ["window", "localStorage", "sessionStorage"])
      if (original[k]) Object.defineProperty(globalThis, k, original[k]);
      else delete (globalThis as any)[k];
  }
});
