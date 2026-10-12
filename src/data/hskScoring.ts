import type { RealHskQuestion } from "./hskQuizQuestions";

/** Confirmed on 2026-10-12: retain the PDF's per-question star levels. */
export const FULL_HSK_LEVEL_IDS = {
  "HSK 1": [1, 2, 3, 4, 5, 6, 7, 22, 23, 24, 25, 26, 27, 28, 29],
  "HSK 2": [8, 9, 10, 11, 12, 13, 30, 31, 32, 33, 34, 35, 41, 42, 43, 44, 45],
  "HSK 3": [
    14, 15, 16, 17, 18, 19, 20, 21, 36, 37, 38, 39, 40, 46, 47, 48, 49, 50,
  ],
} as const;

export const FULL_HSK_LEVEL_COUNTS = { hsk1: 15, hsk2: 17, hsk3: 18 } as const;
export const FULL_HSK_PASS_COUNTS = {
  hsk1: { hsk1: 11 },
  hsk2: { hsk1: 12, hsk2: 12 },
  hsk3: { hsk1: 12, hsk2: 14, hsk3: 13 },
} as const;

export function assertFullHskProfile(
  questions: readonly RealHskQuestion[],
): void {
  if (
    questions.length !== 50 ||
    new Set(questions.map((question) => question.id)).size !== 50
  ) {
    throw new Error(
      "Full HSK assessment must contain the 50 unique source questions.",
    );
  }
  for (const question of questions) {
    const expectedIds: readonly number[] =
      FULL_HSK_LEVEL_IDS[question.level] || [];
    if (!expectedIds.includes(question.id)) {
      throw new Error(
        `HSK Q${question.id} does not match the confirmed source-star scoring profile.`,
      );
    }
  }
}
