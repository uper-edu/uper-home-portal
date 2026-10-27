import {
  findHskVersion,
  getVersionQuestions,
} from "../data/hskAssessmentVersions";
import type { RealHskQuestion } from "../data/hskQuizQuestions";

export type QuestionTypeRow = {
  section: RealHskQuestion["section"];
  format: RealHskQuestion["format"];
  correct: number;
  incorrect: number;
  skipped: number;
  unanswered: number;
  total: number;
};
type Counts = Pick<
  QuestionTypeRow,
  "correct" | "incorrect" | "skipped" | "unanswered" | "total"
>;
export type QuestionTypeStats =
  | { available: true; rows: QuestionTypeRow[]; totals: Counts }
  | { available: false; reason: "version" | "answers" | "invalid" };

/** Counts archived options against saved answers only; never recalculates scores or placement. */
export function assessmentQuestionTypes(result: any): QuestionTypeStats {
  const attempt = result?.attempt;
  if (
    !attempt ||
    !["full", "express"].includes(attempt.mode) ||
    !findHskVersion(attempt.examVersion, attempt.scoringVersion)
  )
    return { available: false, reason: "version" };
  if (
    !attempt.answers ||
    typeof attempt.answers !== "object" ||
    Array.isArray(attempt.answers)
  )
    return { available: false, reason: "answers" };
  const questions = getVersionQuestions(
    attempt.mode,
    attempt.examVersion,
    attempt.scoringVersion,
  );
  const byId = new Map(
    questions.map((question) => [String(question.id), question]),
  );
  for (const [id, answer] of Object.entries(attempt.answers)) {
    const question = byId.get(id);
    if (
      !question ||
      (answer !== null &&
        !question.options.some((option) => option.id === answer))
    )
      return { available: false, reason: "invalid" };
  }
  const rows = new Map<string, QuestionTypeRow>();
  for (const question of questions) {
    const key = question.section + ":" + question.format;
    const row = rows.get(key) || {
      section: question.section,
      format: question.format,
      correct: 0,
      incorrect: 0,
      skipped: 0,
      unanswered: 0,
      total: 0,
    };
    row.total++;
    const answer = attempt.answers[question.id];
    if (answer === null) row.skipped++;
    else if (!Object.hasOwn(attempt.answers, question.id)) row.unanswered++;
    else if (
      question.options.some(
        (option) => option.id === answer && option.isCorrect,
      )
    )
      row.correct++;
    else row.incorrect++;
    rows.set(key, row);
  }
  const totals: Counts = {
    correct: 0,
    incorrect: 0,
    skipped: 0,
    unanswered: 0,
    total: 0,
  };
  for (const row of rows.values())
    for (const key of Object.keys(totals) as (keyof Counts)[])
      totals[key] += row[key];
  return { available: true, rows: [...rows.values()], totals };
}
