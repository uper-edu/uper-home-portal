import type { HskLanguage } from "./hskAssessment";

export interface HskScreeningPlacement {
  policyVersion: "screening-15-startpoint-v1";
  /** Highest consecutive source-star group with at least four correct answers. */
  stage: 0 | 1 | 2 | 3;
  suggestedStartLevel: 1 | 2 | 3;
  reason: "clear" | "boundary" | "inconsistent" | "incomplete" | "audio_error";
  needsReview: boolean;
}

export function deriveScreeningPlacement(
  counts: number[],
  answered: number,
  audioFailures: number[],
  passCount: number,
): HskScreeningPlacement {
  let stage = 0;
  while (stage < 3 && counts[stage] >= passCount) stage++;
  const inconsistent = counts.slice(stage + 1).some((n) => n >= passCount);
  const reason = audioFailures.length
    ? "audio_error"
    : answered < 15
      ? "incomplete"
      : inconsistent
        ? "inconsistent"
        : stage < 3 && counts[stage] === passCount - 1
          ? "boundary"
          : "clear";
  return {
    policyVersion: "screening-15-startpoint-v1",
    stage: stage as HskScreeningPlacement["stage"],
    suggestedStartLevel: Math.min(3, stage + 1) as 1 | 2 | 3,
    reason,
    needsReview: reason !== "clear",
  };
}

export function screeningGuidance(p: HskScreeningPlacement, lang: HskLanguage) {
  const t = (zh: string, en: string, id: string) => ({ zh, en, id })[lang];
  const stage =
    p.stage === 0
      ? t("HSK 1 基础阶段", "HSK 1 foundation stage", "Tahap dasar HSK 1")
      : p.stage === 3
        ? t(
            "HSK 3 内容表现较好",
            "Strong performance on HSK 3 content",
            "Hasil baik pada materi HSK 3",
          )
        : t(
            `HSK ${p.stage} 基础较稳，向 HSK ${p.stage + 1} 过渡`,
            `HSK ${p.stage} foundation is stronger; progressing toward HSK ${p.stage + 1}`,
            `Dasar HSK ${p.stage} lebih kuat; menuju HSK ${p.stage + 1}`,
          );
  const start =
    p.stage === 3
      ? t(
          "建议从 HSK 3 进阶内容开始",
          "Suggested start: HSK 3 consolidation",
          "Disarankan mulai dari penguatan HSK 3",
        )
      : t(
          `建议从 HSK ${p.suggestedStartLevel} 内容开始`,
          `Suggested start: HSK ${p.suggestedStartLevel} content`,
          `Disarankan mulai dari materi HSK ${p.suggestedStartLevel}`,
        );
  const review = {
    clear: "",
    boundary: t(
      "处于边界，起点建议需复核。",
      "Borderline result; verify the suggested starting point.",
      "Hasil berada di batas; titik awal perlu ditinjau.",
    ),
    inconsistent: t(
      "不同难度表现不一致，建议先复核基础。",
      "Performance varies across difficulty levels; review the foundations first.",
      "Hasil antar tingkat kesulitan tidak konsisten; tinjau dasar terlebih dahulu.",
    ),
    incomplete: t(
      "有未作答题，起点建议需复核。",
      "Some items were unanswered; verify the starting point.",
      "Ada soal belum dijawab; titik awal perlu ditinjau.",
    ),
    audio_error: t(
      "听力发生播放异常，起点建议需复核。",
      "Listening playback errors occurred; verify the starting point.",
      "Ada gangguan audio; titik awal perlu ditinjau.",
    ),
  }[p.reason];
  // Unreliable samples must not assert a stable foundation, even if some groups passed.
  return {
    stage: p.needsReview
      ? t(
          `初步参考：${stage}`,
          `Tentative: ${stage}`,
          `Perkiraan awal: ${stage}`,
        )
      : stage,
    start,
    review,
  };
}
