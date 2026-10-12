import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getExamQuestions,
  evaluateOfficialHskScore,
} from "../src/data/hskQuizQuestions";
import { FULL_HSK_LEVEL_IDS } from "../src/data/hskScoring";
import { HskPinyinText } from "../src/components/HskPinyinText";
import { HskExamImage } from "../src/components/HskExamVisuals";
import { HskQuestionPrompt } from "../src/components/HskQuestionPrompt";

const full = getExamQuestions("full");
const compact = (text: string) => text.replace(/\s+/gu, "");
const unnumbered = (text: string) =>
  text.replace(/^\s*(?:\d+|[A-F])[.．]\s*/u, "");
const phonetic = (text: string) => text.replace(/[\s\p{P}]/gu, "");
function answersForCounts(counts: readonly number[]) {
  const answers: Record<number, string> = {};
  Object.entries(FULL_HSK_LEVEL_IDS).forEach(([level, ids], index) => {
    full
      .filter((q) => q.level === level)
      .forEach((q, position) => {
        answers[q.id] = q.options.find(
          (o) => o.isCorrect === position < counts[index],
        )!.id;
      });
  });
  return answers;
}

test("Full keeps all 50 source IDs, 21/21/8 sections and the confirmed 15/17/18 levels", () => {
  assert.deepEqual(
    full.map((q) => q.id),
    Array.from({ length: 50 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    ["HSK 1", "HSK 2", "HSK 3"].map(
      (level) => full.filter((q) => q.level === level).length,
    ),
    [15, 17, 18],
  );
  for (const [level, ids] of Object.entries(FULL_HSK_LEVEL_IDS)) {
    assert.deepEqual(
      full.filter((q) => q.level === level).map((q) => q.id),
      ids,
    );
  }
  assert.deepEqual(
    ["listening", "reading", "writing"].map(
      (s) => full.filter((q) => q.section === s).length,
    ),
    [21, 21, 8],
  );
  full.forEach((q) =>
    assert.equal(
      q.options.filter((o) => o.isCorrect).length,
      1,
      `Q${q.id} needs one answer`,
    ),
  );
});

test("Full evaluates each prerequisite at its confirmed integer boundary", () => {
  const cases: Array<[number[], string]> = [
    [[10, 17, 18], "Below HSK 1"],
    [[11, 0, 0], "HSK 1"],
    [[11, 17, 18], "HSK 1"],
    [[12, 11, 18], "HSK 1"],
    [[12, 12, 0], "HSK 2"],
    [[12, 13, 18], "HSK 2"],
    [[12, 14, 12], "HSK 2"],
    [[12, 14, 13], "HSK 3"],
    [[15, 17, 18], "HSK 3"],
  ];
  for (const [counts, expected] of cases) {
    const result = evaluateOfficialHskScore(
      answersForCounts(counts),
      full,
      "full",
    );
    assert.equal(result.levelConfirmed, expected, counts.join("/"));
    assert.equal(result.totalScore, counts.reduce((sum, n) => sum + n, 0) * 2);
  }
});

test("Full rejects missing, duplicate and reclassified source questions instead of silently moving thresholds", () => {
  assert.throws(
    () => evaluateOfficialHskScore({}, full.slice(1), "full"),
    /50 unique/,
  );
  assert.throws(
    () => evaluateOfficialHskScore({}, [...full.slice(1), full[1]], "full"),
    /50 unique/,
  );
  assert.throws(
    () =>
      evaluateOfficialHskScore(
        {},
        full.map((q) => (q.id === 41 ? { ...q, level: "HSK 3" } : q)),
        "full",
      ),
    /Q41/,
  );
});

test("Q45 preserves the PDF blank for 好 while remaining a mobile choice question", () => {
  const q = full.find((q) => q.id === 45)!;
  assert.equal(q.format, "writing_pinyin");
  assert.equal(compact(unnumbered(q.promptText!)), "我不（）意思让朋友帮忙。");
  assert.equal(q.options.find((o) => o.isCorrect)?.text, "好");
  assert.ok(
    q.options.every((option) => !option.pinyin),
    "Do not reveal the character answer by matching option pinyin to hǎo.",
  );
  assert.equal(q.promptTokens?.find((t) => t.kind === "blank")?.pinyin, "hǎo");
});

test("every annotated prompt preserves the full source text and all phonetic content", () => {
  const annotated = full.filter((q) => q.promptPinyin);
  assert.equal(annotated.length, 22);
  for (const q of annotated) {
    assert.ok(q.promptTokens?.length, `Q${q.id} requires explicit annotations`);
    assert.equal(
      compact(q.promptTokens!.map((t) => t.hanzi).join("")),
      compact(unnumbered(q.promptText!)),
      `Q${q.id} text`,
    );
    assert.equal(
      phonetic(q.promptTokens!.map((t) => t.pinyin || "").join("")),
      phonetic(q.promptPinyin!),
      `Q${q.id} pinyin`,
    );
  }
  for (const q of full)
    for (const option of q.options.filter((o) => o.pinyin)) {
      assert.ok(option.tokens?.length, `Q${q.id}/${option.id} annotations`);
      assert.equal(
        compact(option.tokens!.map((t) => t.hanzi).join("")),
        compact(unnumbered(option.text!)),
        `Q${q.id}/${option.id} text`,
      );
      assert.equal(
        phonetic(option.tokens!.map((t) => t.pinyin || "").join("")),
        phonetic(option.pinyin!),
        `Q${q.id}/${option.id} pinyin`,
      );
    }
});

test("unprompted word-bank blanks stay unannotated; Q46–50 annotate only the requested blank", () => {
  for (const q of full.filter((q) => q.format === "word_bank")) {
    assert.equal(q.promptTokens?.filter((t) => t.kind === "blank").length, 1);
    assert.equal(
      q.promptTokens?.find((t) => t.kind === "blank")?.pinyin,
      undefined,
    );
  }
  for (const q of full.filter((q) => q.id >= 46)) {
    const annotated = q.promptTokens!.filter((t) => t.pinyin);
    assert.equal(annotated.length, 1);
    assert.equal(annotated[0].kind, "blank");
  }
  const html = renderToStaticMarkup(
    React.createElement(HskPinyinText, {
      tokens: full.find((q) => q.id === 30)!.promptTokens!,
    }),
  );
  for (const word of ["Suīrán", "wàiguórén", "zhōngwén", "míngzì"])
    assert.ok(html.includes(word), word);
});

test("all 21 unique scored images use direct PDF crops with verified asset hashes", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../src/data/hskPdfImages.json", import.meta.url),
      "utf8",
    ),
  );
  const keys = [
    ...new Set(
      full.flatMap((q) => q.options.map((o) => o.imageKey).filter(Boolean)),
    ),
  ].sort();
  assert.equal(keys.length, 21);
  assert.deepEqual(Object.keys(manifest.assets).sort(), keys);
  assert.equal(manifest.method, "direct_pdf_page_crop");
  assert.equal(
    manifest.sourceSha256,
    "e80a3cbaabc5e75c186001a54bb98793a29129fb3459e6b75903e69e5c9e4a54",
  );
  for (const key of keys) {
    const asset = manifest.assets[key];
    const bytes = readFileSync(
      new URL("../public" + asset.src, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
      key,
    );
    assert.ok(asset.width > 0 && asset.height > 0);
    const html = renderToStaticMarkup(
      React.createElement(HskExamImage, { id: key! }),
    );
    assert.ok(html.includes(asset.src));
    assert.ok(!html.includes("<svg"));
  }
  assert.ok(
    !renderToStaticMarkup(
      React.createElement(HskExamImage, { id: "missing" }),
    ).includes("<svg"),
  );
});

import { randomUUID } from "node:crypto";
import {
  displayOptions,
  gradeHskAttempt,
  newHskAttempt,
  validateHskAttempt,
} from "../src/data/hskAssessment";
import { HSK_EXPLANATIONS_ID } from "../src/data/hskExplanationsId";
import { hskExample } from "../src/data/hskInstructions";
import HskAssessmentReport from "../src/components/HskAssessmentReport";
import HSKPlacementAssessment from "../src/components/HSKPlacementAssessment";

test("Express derives 11 items / 22 points and never assigns a pass level from 3–4 items", () => {
  const qs = getExamQuestions("express");
  assert.equal(qs.length, 11);
  const attempt = newHskAttempt("express", randomUUID());
  for (const q of qs)
    attempt.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
  const result = gradeHskAttempt(attempt, "en");
  assert.equal(result.score, 22);
  assert.equal(result.maxScore, 22);
  assert.equal(result.questionCount, 11);
  assert.equal(result.correctCount, 11);
  assert.equal(result.thresholds.length, 0);
  assert.match(result.levelConfirmed, /undetermined/);
  for (const q of qs) {
    const changed = {
      ...attempt,
      answers: { ...attempt.answers, [q.id]: null },
    };
    assert.equal(
      gradeHskAttempt(changed, "en").levelConfirmed,
      result.levelConfirmed,
    );
  }
});
test("source A–E choices, full word banks and deterministic adapted-choice IDs are preserved", () => {
  for (const q of full.filter((q) => q.id >= 36 && q.id <= 40))
    assert.deepEqual(
      q.options.map((o) => o.id),
      ["A", "B", "C", "D", "E"],
    );
  for (const q of full.filter((q) => q.wordBank))
    assert.deepEqual(
      q.options.map((o) => o.id),
      q.wordBank!.map((o) => o.id),
    );
  assert.deepEqual(
    full
      .filter((q) => q.id >= 30 && q.id <= 32)
      .map((q) => q.options.findIndex((o) => o.isCorrect)),
    [1, 0, 2],
  );
  const positions = full
    .filter((q) => q.section === "writing")
    .map((q) => displayOptions(q).findIndex((o) => o.isCorrect));
  assert.deepEqual(
    [0, 1, 2].map((i) => positions.filter((p) => p === i).length).sort(),
    [2, 3, 3],
  );
  for (const q of full) {
    assert.deepEqual(displayOptions(q), displayOptions(q));
    assert.deepEqual(
      displayOptions(q)
        .map((o) => o.id)
        .sort(),
      q.options.map((o) => o.id).sort(),
    );
  }
});
test("skipped and unanswered items are distinct, both score zero, and section totals remain reproducible", () => {
  const attempt = newHskAttempt("full", randomUUID());
  attempt.answers[1] = null;
  attempt.answers[22] = full[21].options.find((o) => o.isCorrect)!.id;
  const result = gradeHskAttempt(attempt);
  assert.equal(result.score, 2);
  assert.equal(result.correctCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.unansweredCount, 48);
  assert.equal(result.sections.listening.skipped, 1);
  assert.equal(result.sections.reading.correct, 1);
  assert.equal(result.sections.writing.total, 8);
  assert.deepEqual(result.thresholds[0].missing, [10, 0, 0]);
});
test("untrusted attempt fields cannot change grades, unknown options and mismatched versions are rejected", () => {
  const a = newHskAttempt("express", randomUUID());
  assert.equal(
    gradeHskAttempt({ ...a, score: 100, levelConfirmed: "HSK 9" } as any).score,
    0,
  );
  for (const patch of [
    { examVersion: "old" },
    { answers: { 1: "Z" } },
    { answers: { 43: "A" } },
    { plays: { 26: 1 } },
    { activeSeconds: { 1: -1 } },
    { activeSeconds: { 1: 1.2 } },
    { audioFailures: [26] },
    { audioFailures: [1, 1] },
    { completedAt: "invalid" },
    { answers: [] },
    { attemptId: "not-a-uuid" },
    { attemptId: [a.attemptId] },
    { startedAt: 2026 },
    { completedAt: 2026 },
  ])
    assert.throws(() => validateHskAttempt({ ...a, ...patch }));
  assert.deepEqual(
    validateHskAttempt({ ...a, answers: { 4: "B", 1: "A" } }).answers,
    { 1: "A", 4: "B" },
  );
});
test("all source listening slices are versioned MP3 frame copies with 21 verified hashes and valid non-overlapping ranges", () => {
  const audio = JSON.parse(
    readFileSync(
      new URL("../src/data/hskAudioManifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(audio.sourceAudioUsed, true);
  assert.equal(audio.method, "direct_mp3_frame_copy");
  assert.equal(Object.keys(audio.assets).length, 21);
  let previous = 0;
  for (const q of full.filter((q) => q.section === "listening")) {
    const asset = audio.assets[q.id];
    assert.ok(asset.startSec >= previous);
    assert.ok(asset.endSec <= audio.sourceAudioDurationSec);
    assert.ok(
      Math.abs(asset.durationSec - (asset.endSec - asset.startSec)) < 0.15,
    );
    previous = asset.endSec;
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL("../public" + asset.src, import.meta.url)))
        .digest("hex"),
      asset.sha256,
    );
    assert.equal(q.audioStartSec, asset.startSec);
  }
});
test("instructions include the missing Q11 source example and Indonesian explanation coverage is complete", () => {
  assert.match(hskExample(full[10]).text, /姓名/);
  assert.equal(hskExample(full[10]).source, true);
  for (const q of full)
    assert.ok(HSK_EXPLANATIONS_ID[q.id]?.length, `Q${q.id}`);
});
test("reports keep localized point units, limits and actual save status; screen modes expose native radio inputs", () => {
  const attempt = newHskAttempt("full", randomUUID());
  attempt.completedAt = new Date().toISOString();
  for (const lang of ["zh", "en", "id"] as const) {
    const result = gradeHskAttempt(attempt, lang);
    const html = renderToStaticMarkup(
      React.createElement(HskAssessmentReport, { result, lang }),
    );
    assert.ok(html.includes("0/100"));
    assert.ok(html.includes("0/50"));
    assert.ok(!/600\s*(词|words|kata)/.test(html));
    assert.ok(!html.includes("HSK 3+"));
    if (lang === "id") {
      assert.match(html, /Pilihan karakter/);
      assert.match(html, /poin/);
    }
  }
  const html = renderToStaticMarkup(
    React.createElement(HSKPlacementAssessment, {
      lang: "en",
      studentName: "QA",
      onComplete: () => {},
    }),
  );
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  assert.match(html, /11.*items/);
  assert.ok(!html.includes("10 Questions"));
});

test("reading passages keep every source word and separate the question without source numbering", () => {
  for (const question of full.filter(
    (q) => q.format === "passage_comprehension",
  )) {
    for (const lang of ["zh", "en", "id"] as const) {
      const html = renderToStaticMarkup(
        React.createElement(HskQuestionPrompt, { question, lang }),
      );
      assert.match(html, /<section aria-label=/);
      assert.match(html, /data-hsk-passage-question/);
      const visible = html.replace(/<[^>]+>/g, "");
      assert.equal(
        compact(visible),
        compact(unnumbered(question.promptText!).replace("★", "")),
      );
      assert.doesNotMatch(visible, /^(41|42)[．.]/);
    }
  }
});
