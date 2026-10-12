import {
  validateHskAttempt,
  type HskDraft,
  type HskResult,
  type HskLanguage,
} from "../data/hskAssessment";
import { getVersionQuestions } from "../data/hskAssessmentVersions";
import {
  inspectHskReport,
  inspectHskHistoryRows,
  type HskHistoryState,
} from "../data/hskReportHistory";
const DRAFT_KEY = "uper_hsk_draft_v2";
const HISTORY_KEY = "uper_hsk_history_v2";
export function readHskDraft(): HskDraft | null {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (!raw) return null;
    const attempt = validateHskAttempt(raw.attempt);
    if (
      attempt.completedAt ||
      !Number.isInteger(raw.currentIdx) ||
      raw.currentIdx < 0 ||
      raw.currentIdx >=
        getVersionQuestions(
          attempt.mode,
          attempt.examVersion,
          attempt.scoringVersion,
        ).length
    )
      return null;
    return {
      attempt,
      currentIdx: raw.currentIdx,
      reviewing: raw.reviewing === true,
    };
  } catch {
    return null;
  }
}
export function writeHskDraft(draft: HskDraft): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
export function clearHskDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}
function storedRows(): { rows: unknown[]; damaged?: string } {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw === null) return { rows: [] };
  try {
    const rows = JSON.parse(raw);
    if (Array.isArray(rows)) return { rows };
  } catch {}
  return { rows: [], damaged: raw };
}
export function readHskHistoryState(lang: HskLanguage = "en"): HskHistoryState {
  try {
    const { rows, damaged } = storedRows();
    if (damaged !== undefined)
      return {
        results: [],
        problems: [{ key: "container", reason: "invalid_container" }],
        storageAvailable: true,
      };
    return inspectHskHistoryRows(rows, lang);
  } catch {
    return { results: [], problems: [], storageAvailable: false };
  }
}
export function readHskHistory(lang: HskLanguage = "en"): HskResult[] {
  return readHskHistoryState(lang).results;
}
function retainIncoming(rows: unknown[], incoming: unknown): unknown[] {
  const view = inspectHskReport(incoming);
  if (view.kind !== "available") {
    // Preserve unverifiable rows, but don't duplicate identical API restores.
    const serialized = JSON.stringify(incoming);
    return rows.some((row) => JSON.stringify(row) === serialized)
      ? rows
      : [...rows, incoming];
  }
  const previous = rows
    .map((row) => inspectHskReport(row))
    .find(
      (old) =>
        old.kind === "available" &&
        old.result.attempt.attemptId === view.result.attempt.attemptId,
    );
  if (
    previous?.kind === "available" &&
    previous.result.saveStatus === "saved"
  ) {
    if (
      view.result.saveStatus === "local" &&
      JSON.stringify(previous.result.attempt) !==
        JSON.stringify(view.result.attempt)
    )
      return rows;
    if (
      JSON.stringify(previous.result.attempt) ===
      JSON.stringify(view.result.attempt)
    )
      view.result.saveStatus = "saved";
  }
  return [
    ...rows.filter((row) => {
      const old = inspectHskReport(row);
      return (
        old.kind !== "available" ||
        old.result.attempt.attemptId !== view.result.attempt.attemptId
      );
    }),
    view.result,
  ];
}
/** Back up an unreadable container before replacing it. If either write fails, never claim success. */
function saveRows(incoming: readonly unknown[]): boolean {
  try {
    let { rows, damaged } = storedRows();
    if (damaged !== undefined) {
      const storageKey = `${HISTORY_KEY}_recovery_${crypto.randomUUID()}`;
      localStorage.setItem(storageKey, damaged);
      rows = [{ hskRecovery: true, storageKey }];
    }
    for (const record of incoming) rows = retainIncoming(rows, record);
    // Display the latest 20 valid reports, but retain all historical and quarantined rows.
    localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}
export function writeHskResult(result: HskResult): boolean {
  const view = inspectHskReport(result);
  if (view.kind !== "available") return false;
  const previous = storedRowsSafely()
    .rows.map((row) => inspectHskReport(row))
    .find(
      (old) =>
        old.kind === "available" &&
        old.result.attempt.attemptId === view.result.attempt.attemptId,
    );
  const previousResult =
    previous?.kind === "available" ? previous.result : undefined;
  if (
    previousResult?.saveStatus === "saved" &&
    view.result.saveStatus === "local" &&
    JSON.stringify(previousResult.attempt) !==
      JSON.stringify(view.result.attempt)
  )
    return false;
  return saveRows([view.result]);
}
export function mergeHskHistoryRows(
  rows: readonly unknown[],
  lang: HskLanguage = "en",
): HskHistoryState {
  const local = storedRowsSafely();
  let combined = local.rows;
  for (const row of rows) combined = retainIncoming(combined, row);
  const state = inspectHskHistoryRows(combined, lang);
  if (local.damaged !== undefined)
    state.problems.unshift({ key: "container", reason: "invalid_container" });
  state.storageAvailable = rows.length
    ? saveRows(rows)
    : readHskHistoryState(lang).storageAvailable;
  return rows.length && state.storageAvailable
    ? readHskHistoryState(lang)
    : state;
}
function storedRowsSafely(): { rows: unknown[]; damaged?: string } {
  try {
    return storedRows();
  } catch {
    return { rows: [] };
  }
}
