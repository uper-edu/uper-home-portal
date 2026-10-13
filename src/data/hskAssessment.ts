import { scoreStarsV2 } from "./hskVersions/score-stars-v2";
import {deriveScreeningPlacement, screeningGuidance, type HskScreeningPlacement} from "./hskScreeningPlacement";
import type { RealHskQuestion } from "./hskQuizQuestions";
import {
  HSK_EXAM_VERSION,
  HSK_SCORING_VERSION,
  getVersionQuestions,
  requireHskVersion,
} from "./hskAssessmentVersions";
export { HSK_EXAM_VERSION, HSK_SCORING_VERSION } from "./hskAssessmentVersions";
export type HskLanguage = "zh" | "en" | "id";
export type HskMode = "express" | "full";
export interface HskAttempt {
  attemptId: string;
  examVersion: string;
  scoringVersion: string;
  mode: HskMode;
  startedAt: string;
  completedAt?: string;
  answers: Record<number, string | null>;
  activeSeconds: Record<number, number>;
  plays: Record<number, number>;
  audioFailures: number[];
  navigation?: Record<number, "next" | "skip" | "timeout">;
  audioPositions?: Record<number, number>;
  pauseCount?: number;
}
export interface HskDraft {
  attempt: HskAttempt;
  currentIdx: number;
  reviewing: boolean;
  audioPositionSec?: number;
  paused?: boolean;
}
export interface HskResult {
  attempt: HskAttempt;
  score: number;
  /** Legacy points field. New consumers use maxScore. */
  total: number;
  maxScore: number;
  questionCount: number;
  correctCount: number;
  skippedCount: number;
  unansweredCount: number;
  levelConfirmed: string;
  summary: string;
  breakdown: {
    hsk1Correct: number;
    hsk1Total: number;
    hsk2Correct: number;
    hsk2Total: number;
    hsk3Correct: number;
    hsk3Total: number;
  };
  sections: Record<
    "listening" | "reading" | "writing",
    { correct: number; total: number; skipped: number }
  >;
  thresholds: { level: string; reached: boolean; missing: number[] }[];
  screeningPlacement?: HskScreeningPlacement;
  /** Saved means server recomputed answers, not verified language proficiency. */
  saveStatus: "local" | "saved";
}
export const chooseText = (
  lang: HskLanguage,
  zh: string,
  en: string,
  id: string,
) => ({ zh, en, id })[lang];
export const stripSourceLabel = (text = "") =>
  text.replace(/^\s*(?:\d+|[A-F])[.．]\s*/u, "").trim();
export function displayOptions(q: RealHskQuestion) {
  if (q.section !== "writing")
    return q.options.map((o) => ({ ...o, label: o.id }));
  // Stable IDs are retained for scoring; rotate the *display* order of adapted choices.
  const offset = (q.id - 42) % q.options.length;
  const ordered = [...q.options.slice(offset), ...q.options.slice(0, offset)];
  return ordered.map((o, i) => ({ ...o, label: String.fromCharCode(65 + i) }));
}
export function newHskAttempt(mode: HskMode, attemptId: string): HskAttempt {
  return {
    attemptId,
    mode,
    examVersion: HSK_EXAM_VERSION,
    scoringVersion: HSK_SCORING_VERSION,
    startedAt: new Date().toISOString(),
    answers: {},
    activeSeconds: {},
    plays: {},
    audioFailures: [],
    navigation: {},
    audioPositions: {},
    pauseCount: 0,
  };
}
/** Treat both saved drafts and network payloads as untrusted. */
export function validateHskAttempt(input: unknown): HskAttempt {
  const a = input as HskAttempt;
  const invalid = () => {
    throw Error("Invalid or incompatible HSK attempt");
  };
  if (
    !a ||
    typeof a !== "object" ||
    typeof a.attemptId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      a.attemptId,
    ) ||
    typeof a.examVersion !== "string" ||
    typeof a.scoringVersion !== "string" ||
    !["express", "full"].includes(a.mode)
  )
    invalid();
  if (
    typeof a.startedAt !== "string" ||
    (a.completedAt !== undefined && typeof a.completedAt !== "string")
  )
    invalid();
  const start = Date.parse(a.startedAt),
    end = a.completedAt ? Date.parse(a.completedAt) : undefined;
  if (
    !Number.isFinite(start) ||
    start > Date.now() + 300000 ||
    (end !== undefined &&
      (!Number.isFinite(end) || end < start || end > Date.now() + 300000))
  )
    invalid();
  const qs = getVersionQuestions(a.mode, a.examVersion, a.scoringVersion);
  const ids = new Set(qs.map((q) => String(q.id)));
  for (const field of ["answers", "activeSeconds", "plays"] as const) {
    const value = a[field];
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
    for (const [key, v] of Object.entries(value)) {
      if (!ids.has(key)) invalid();
      if (field === "answers") {
        if (
          v !== null &&
          !qs.find((q) => String(q.id) === key)?.options.some((o) => o.id === v)
        )
          invalid();
      } else if (
        !Number.isInteger(v) ||
        Number(v) < 0 ||
        Number(v) > (field === "plays" ? 1000 : 86400)
      )
        invalid();
      if (
        field === "plays" &&
        qs.find((q) => String(q.id) === key)?.section !== "listening"
      )
        invalid();
    }
  }
  if (
    !Array.isArray(a.audioFailures) ||
    new Set(a.audioFailures).size !== a.audioFailures.length ||
    a.audioFailures.some(
      (id) => !qs.some((q) => q.id === id && q.section === "listening"),
    )
  )
    invalid();
  // Normalize key order and ignore extra client fields (score, claimed level, etc.).
  const sequential = requireHskVersion(a.examVersion, a.scoringVersion).administration;
  if (sequential) {
    for (const value of [a.navigation,a.audioPositions]) if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) invalid();
    if (a.pauseCount !== undefined && (!Number.isInteger(a.pauseCount) || a.pauseCount < 0 || a.pauseCount > 10000)) invalid();
    for (const [key, reason] of Object.entries(a.navigation || {}))
      if (!ids.has(key) || !["next", "skip", "timeout"].includes(reason)) invalid();
    for (const [key, seconds] of Object.entries(a.audioPositions || {})) {
      const asset = requireHskVersion(a.examVersion, a.scoringVersion).audioAssets[key];
      if (!asset || !Number.isFinite(seconds) || seconds < 0 || seconds > asset.durationSec + 0.1) invalid();
    }
  }
  const ordered = <T>(v: Record<number, T>) =>
    Object.fromEntries(
      qs.filter((q) => Object.hasOwn(v, q.id)).map((q) => [q.id, v[q.id]]),
    );
  return {
    attemptId: a.attemptId,
    examVersion: a.examVersion,
    scoringVersion: a.scoringVersion,
    mode: a.mode,
    startedAt: a.startedAt,
    ...(a.completedAt ? { completedAt: a.completedAt } : {}),
    answers: ordered(a.answers),
    activeSeconds: ordered(a.activeSeconds),
    plays: ordered(a.plays),
    audioFailures: [...a.audioFailures].sort((a, b) => a - b),
    ...(sequential ? { navigation: ordered(a.navigation || {}), audioPositions: ordered(a.audioPositions || {}), pauseCount: a.pauseCount || 0 } : {}),
  };
}
export function gradeHskAttempt(
  input: unknown,
  lang: HskLanguage = "en",
): HskResult {
  const attempt = validateHskAttempt(input);
  const version = requireHskVersion(
    attempt.examVersion,
    attempt.scoringVersion,
  );
  const qs = getVersionQuestions(
    attempt.mode,
    attempt.examVersion,
    attempt.scoringVersion,
  );
  const FULL_HSK_PASS_COUNTS = version.fullPassCounts;
  if (version.gradingModel !== "source-stars-two-points-v2")
    throw new Error("Unsupported archived HSK scoring model");
  const evalResult = scoreStarsV2(
    qs,
    attempt.answers,
    attempt.mode,
    version.fullPassCounts,
  );
  const sections: HskResult["sections"] = {
    listening: { correct: 0, total: 0, skipped: 0 },
    reading: { correct: 0, total: 0, skipped: 0 },
    writing: { correct: 0, total: 0, skipped: 0 },
  };
  let skippedCount = 0,
    unansweredCount = 0;
  for (const q of qs) {
    const answer = attempt.answers[q.id];
    sections[q.section].total++;
    if (answer === null) {
      skippedCount++;
      sections[q.section].skipped++;
    } else if (answer === undefined) unansweredCount++;
    else if (q.options.some((o) => o.id === answer && o.isCorrect))
      sections[q.section].correct++;
  }
  const breakdown = {
    hsk1Correct: evalResult.hsk1Correct,
    hsk1Total: evalResult.hsk1Total,
    hsk2Correct: evalResult.hsk2Correct,
    hsk2Total: evalResult.hsk2Total,
    hsk3Correct: evalResult.hsk3Correct,
    hsk3Total: evalResult.hsk3Total,
  };
  const counts = [
    breakdown.hsk1Correct,
    breakdown.hsk2Correct,
    breakdown.hsk3Correct,
  ];
  const screeningPlacement = attempt.mode === "express" && version.screeningPolicy
    ? deriveScreeningPlacement(counts, qs.length-skippedCount-unansweredCount, attempt.audioFailures, version.screeningPolicy.passCountPerLevel)
    : undefined;
  const thresholds =
    attempt.mode === "express"
      ? []
      : [
          [FULL_HSK_PASS_COUNTS.hsk1.hsk1, 0, 0],
          [FULL_HSK_PASS_COUNTS.hsk2.hsk1, FULL_HSK_PASS_COUNTS.hsk2.hsk2, 0],
          [
            FULL_HSK_PASS_COUNTS.hsk3.hsk1,
            FULL_HSK_PASS_COUNTS.hsk3.hsk2,
            FULL_HSK_PASS_COUNTS.hsk3.hsk3,
          ],
        ].map((required, i) => ({
          level: `HSK ${i + 1}`,
          reached: required.every((v, j) => counts[j] >= v),
          missing: required.map((v, j) => Math.max(0, v - counts[j])),
        }));
  const label =
    screeningPlacement ? screeningGuidance(screeningPlacement,lang).stage : attempt.mode === "express"
      ? chooseText(
          lang,
          "快测：暂不定级",
          "Screening: level undetermined",
          "Skrining: tingkat belum ditentukan",
        )
      : evalResult.levelConfirmed === "Below HSK 1"
        ? chooseText(
            lang,
            "未达到本卷HSK 1门槛",
            "Paper HSK 1 threshold not reached",
            "Ambang HSK 1 pada tes ini belum tercapai",
          )
        : chooseText(
            lang,
            `本卷${evalResult.levelConfirmed}门槛达成（暂定）`,
            `Paper ${evalResult.levelConfirmed} threshold reached (provisional)`,
            `Ambang ${evalResult.levelConfirmed} pada tes ini tercapai (sementara)`,
          );
  const summary =
    chooseText(
      lang,
      "只反映本次改编试卷HSK1–3题目的作答表现；未评测更高等级。录音直接截自提供的原始MP3，听力按录音语义判分；未取得发行机构答案表。未测口语和手写，不推断官方成绩、词汇量或奖学金资格。",
      "This describes performance on the HSK1–3 items of this adapted paper only; higher levels were not assessed. Audio is cropped directly from the supplied MP3; listening keys follow its meaning. No publisher answer sheet has been provided. Speaking and handwriting were not tested; no official score, vocabulary size or scholarship eligibility is inferred.",
      "Hasil ini hanya menunjukkan jawaban pada soal HSK1–3 dalam tes adaptasi ini; tingkat yang lebih tinggi tidak diuji. Audio dipotong langsung dari MP3 yang diberikan; kunci menyimak mengikuti makna rekaman. Kunci jawaban dari penerbit belum tersedia. Berbicara dan tulisan tangan tidak diuji; hasil tidak membuktikan nilai resmi, jumlah kosakata, atau kelayakan beasiswa.",
    ) +
    (screeningPlacement
      ? "\n\n" + Object.values(screeningGuidance(screeningPlacement,lang)).filter(Boolean).join(" · ")
      : attempt.mode === "express"
      ? "\n\n" +
        chooseText(
          lang,
          "每级只有3–4题，无识字选择题；单题误差会显著影响比例。这一小样本没有经过分级校准，请完成50题或请教师复核。",
          "Only 3–4 items per level, with no character choices. One item substantially changes the proportion. This sample has no validated placement calibration; complete all 50 items or request teacher review.",
          "Hanya 3–4 soal per tingkat, tanpa pilihan karakter. Satu soal sangat memengaruhi proporsi. Sampel belum dikalibrasi untuk penempatan; selesaikan 50 soal atau minta peninjauan guru.",
        )
      : "");
  return {
    attempt,
    score: evalResult.totalScore,
    total: qs.length * 2,
    maxScore: qs.length * 2,
    questionCount: qs.length,
    correctCount: evalResult.totalScore / 2,
    skippedCount,
    unansweredCount,
    levelConfirmed: label,
    summary,
    breakdown,
    sections,
    thresholds,
    ...(screeningPlacement ? {screeningPlacement} : {}),
    saveStatus: "local",
  };
}
