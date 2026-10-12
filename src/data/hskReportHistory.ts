import {
  gradeHskAttempt,
  type HskLanguage,
  type HskResult,
} from "./hskAssessment";
import { findHskVersion, type HskVersion } from "./hskAssessmentVersions";
export type HskReportView =
  | { kind: "available"; result: HskResult; version: HskVersion }
  | {
      kind: "unknown_version";
      recorded: {
        attemptId: string;
        examVersion: string;
        scoringVersion: string;
        completedAt: string;
        mode: "express" | "full";
        score?: number;
        maxScore?: number;
        summary?: string;
        level?: string;
      };
    }
  | { kind: "invalid_record" };
const object = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, limit: number) =>
  typeof value === "string" ? value.slice(0, limit) : undefined;
/** Historical reads never use today's bank as a fallback and never trust a recorded claimed grade. */
export function inspectHskReport(
  raw: unknown,
  lang: HskLanguage = "en",
): HskReportView {
  if (!object(raw) || !object(raw.attempt)) return { kind: "invalid_record" };
  const a = raw.attempt;
  if (
    typeof a.attemptId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      a.attemptId,
    ) ||
    typeof a.examVersion !== "string" ||
    !a.examVersion ||
    a.examVersion.length > 200 ||
    typeof a.scoringVersion !== "string" ||
    !a.scoringVersion ||
    a.scoringVersion.length > 200 ||
    !["express", "full"].includes(a.mode) ||
    typeof a.completedAt !== "string" ||
    !Number.isFinite(Date.parse(a.completedAt))
  )
    return { kind: "invalid_record" };
  const version = findHskVersion(a.examVersion, a.scoringVersion);
  if (!version) {
    const scoreValid =
      Number.isInteger(raw.score) &&
      Number.isInteger(raw.maxScore) &&
      raw.score >= 0 &&
      raw.score <= raw.maxScore &&
      raw.maxScore > 0 &&
      raw.maxScore <= 10000;
    return {
      kind: "unknown_version",
      recorded: {
        attemptId: a.attemptId,
        examVersion: a.examVersion,
        scoringVersion: a.scoringVersion,
        completedAt: a.completedAt,
        mode: a.mode,
        ...(scoreValid ? { score: raw.score, maxScore: raw.maxScore } : {}),
        summary: text(raw.summary, 3000),
        level: text(raw.levelConfirmed, 200),
      },
    };
  }
  try {
    return {
      kind: "available",
      version,
      result: {
        ...gradeHskAttempt(a, lang),
        saveStatus: raw.saveStatus === "saved" ? "saved" : "local",
      },
    };
  } catch {
    return { kind: "invalid_record" };
  }
}
export function safeHskResult(
  raw: unknown,
  lang: HskLanguage = "en",
): HskResult | undefined {
  const view = inspectHskReport(raw, lang);
  return view.kind === "available" ? view.result : undefined;
}
export interface HskHistoryProblem {
  key: string;
  reason:
    | "unknown_version"
    | "invalid_record"
    | "invalid_container"
    | "recovery_backup";
  record?: unknown;
}
export interface HskHistoryState {
  results: HskResult[];
  problems: HskHistoryProblem[];
  storageAvailable: boolean;
}
export function inspectHskHistoryRows(
  rows: readonly unknown[],
  lang: HskLanguage = "en",
): HskHistoryState {
  const byId = new Map<string, HskResult>();
  const problems: HskHistoryProblem[] = [];
  rows.forEach((record, index) => {
    if (object(record) && record.hskRecovery === true) {
      problems.push({ key: `backup-${index}`, reason: "recovery_backup" });
      return;
    }
    const view = inspectHskReport(record, lang);
    if (view.kind === "available") {
      const previous = byId.get(view.result.attempt.attemptId);
      if (!previous || view.result.saveStatus === "saved")
        byId.set(view.result.attempt.attemptId, view.result);
    } else
      problems.push({ key: `history-${index}`, reason: view.kind, record });
  });
  return {
    results: [...byId.values()]
      .sort(
        (a, b) =>
          Date.parse(b.attempt.completedAt!) -
          Date.parse(a.attempt.completedAt!),
      )
      .slice(0, 20),
    problems,
    storageAvailable: true,
  };
}
