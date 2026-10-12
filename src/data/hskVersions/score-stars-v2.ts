import type { HskVersion } from "../hskAssessmentVersions";
import type { RealHskQuestion } from "../hskQuizQuestions";
/** Versioned scoring family. Add a new scorer for a new model; never redirect old attempts to it. */
export function scoreStarsV2(
  questions: readonly RealHskQuestion[],
  answers: Record<number, string | null>,
  mode: "express" | "full",
  gates: HskVersion["fullPassCounts"],
) {
  const counts = ["HSK 1", "HSK 2", "HSK 3"].map((level) => {
    const items = questions.filter((q) => q.level === level);
    return {
      total: items.length,
      correct: items.filter((q) =>
        q.options.some((o) => o.id === answers[q.id] && o.isCorrect),
      ).length,
    };
  });
  const requirements = [
    [gates.hsk1.hsk1, 0, 0],
    [gates.hsk2.hsk1, gates.hsk2.hsk2, 0],
    [gates.hsk3.hsk1, gates.hsk3.hsk2, gates.hsk3.hsk3],
  ];
  const passed =
    mode === "full"
      ? requirements.map((row) => row.every((n, i) => counts[i].correct >= n))
      : [false, false, false];
  return {
    totalScore: counts.reduce((sum, c) => sum + c.correct * 2, 0),
    hsk1Correct: counts[0].correct,
    hsk1Total: counts[0].total,
    hsk2Correct: counts[1].correct,
    hsk2Total: counts[1].total,
    hsk3Correct: counts[2].correct,
    hsk3Total: counts[2].total,
    levelConfirmed: passed[2]
      ? "HSK 3"
      : passed[1]
        ? "HSK 2"
        : passed[0]
          ? "HSK 1"
          : "Below HSK 1",
  };
}
