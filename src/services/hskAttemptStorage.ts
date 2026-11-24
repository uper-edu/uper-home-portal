import {createBrowserUuid} from '../utils/browserUuid';
import {subscribeVisitorScope,visitorKey} from './visitorScope';
import {
  validateHskAttempt,
  HSK_ATTEMPT_CLOCK_TOLERANCE_MS,
  type HskDraft,
  type HskResult,
  type HskLanguage,
} from "../data/hskAssessment";
import { getVersionQuestions } from "../data/hskAssessmentVersions";
import {
  inspectHskReport,
  inspectHskHistoryRows,
  type HskHistoryState,
  type HskReportView,
} from "../data/hskReportHistory";
const DRAFT_KEY = "uper_hsk_draft_v2";
const HISTORY_KEY = "uper_hsk_history_v2";
let confirmedDraft: {key:string; value:string; validFrom:number} | undefined;
subscribeVisitorScope(()=>{confirmedDraft=undefined;});

function parseHskDraft(value:string): HskDraft | null {
  try {
    const raw = JSON.parse(value);
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
      ...(raw.audioPositionSec !== undefined && Number.isFinite(raw.audioPositionSec) && raw.audioPositionSec >= 0 ? { audioPositionSec: raw.audioPositionSec, paused: true } : {}),
    };
  } catch {
    return null;
  }
}

export function readHskDraft(): HskDraft | null {
  try {
    const value=localStorage.getItem(visitorKey(DRAFT_KEY));
    return value ? parseHskDraft(value) : null;
  }catch{return null;}
}

export function hasHskDraft(): boolean {
  try{
    const key=visitorKey(DRAFT_KEY);
    const value=localStorage.getItem(key);
    if(confirmedDraft && confirmedDraft.key===key && confirmedDraft.value===value &&
      Date.now()>=confirmedDraft.validFrom)return true;
    const draft=value ? parseHskDraft(value) : null;
    confirmedDraft=value&&draft
      ? {key,value,validFrom:Date.parse(draft.attempt.startedAt)-HSK_ATTEMPT_CLOCK_TOLERANCE_MS}
      : undefined;
    return draft!==null;
  }catch{
    confirmedDraft=undefined;
    return false;
  }
}
export function writeHskDraft(draft: HskDraft): boolean {
  try {
    localStorage.setItem(visitorKey(DRAFT_KEY), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
export function clearHskDraft(attemptId?:string) {
  try {
    if (attemptId && readHskDraft()?.attempt.attemptId!==attemptId) return;
    localStorage.removeItem(visitorKey(DRAFT_KEY));
  } catch {}
}
function storedRows(): { rows: unknown[]; serialized?: string; damaged?: string } {
  const raw = localStorage.getItem(visitorKey(HISTORY_KEY));
  if (raw === null) return { rows: [] };
  try {
    const rows = JSON.parse(raw);
    if (Array.isArray(rows)) return { rows, serialized: raw };
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
function retainIncoming(
  rows: unknown[],
  incoming: unknown,
  inspect: (record: unknown) => HskReportView,
): unknown[] {
  const view = inspect(incoming);
  if (view.kind !== "available") {
    // Preserve unverifiable rows, but don't duplicate identical API restores.
    const serialized = JSON.stringify(incoming);
    return rows.some((row) => JSON.stringify(row) === serialized)
      ? rows
      : [...rows, incoming];
  }
  let result = view.result;
  const attemptId = result.attempt.attemptId;
  const entries = rows.map(row => ({row, view: inspect(row)}));
  const matches = ({view}: (typeof entries)[number]) =>
    view.kind === "available" && view.result.attempt.attemptId === attemptId;
  const previous = entries.find(matches)?.view;
  if (previous?.kind === "available" && previous.result.saveStatus === "saved") {
    const unchanged = JSON.stringify(previous.result.attempt) === JSON.stringify(result.attempt);
    if (!unchanged && result.saveStatus === "local") return rows;
    if (unchanged && result.saveStatus !== "saved") result = {...result, saveStatus: "saved"};
  }
  return [...entries.filter(entry => !matches(entry)).map(entry => entry.row), result];
}
/** Back up an unreadable container before replacing it. If either write fails, never claim success. */
function saveRows(rows: unknown[], before: ReturnType<typeof storedRows>): unknown[] | undefined {
  try {
    if (before.damaged !== undefined) {
      const storageKey = `${visitorKey(HISTORY_KEY)}_recovery_${createBrowserUuid()}`;
      localStorage.setItem(storageKey, before.damaged);
      rows = [{ hskRecovery: true, storageKey }, ...rows];
    }
    // Display the latest 20 valid reports, but retain all historical and quarantined rows.
    const serialized = JSON.stringify(rows);
    if (serialized !== before.serialized) localStorage.setItem(visitorKey(HISTORY_KEY), serialized);
    return rows;
  } catch {
    return undefined;
  }
}
export function writeHskResult(result: HskResult): boolean {
  const view = inspectHskReport(result);
  if (view.kind !== "available") return false;
  try {
    const before = storedRows();
    const { rows } = before;
    const updated = retainIncoming(rows, view.result, inspectHskReport);
    return updated !== rows && saveRows(updated, before) !== undefined;
  } catch {
    return false;
  }
}
export function mergeHskHistoryRows(
  rows: readonly unknown[],
  lang: HskLanguage = "en",
): HskHistoryState {
  if (!rows.length) return readHskHistoryState(lang);
  const local = storedRowsSafely();
  const inspected = new Map<unknown, HskReportView>();
  const inspect = (record: unknown) => {
    const cached = inspected.get(record);
    if (cached) return cached;
    const view = inspectHskReport(record);
    inspected.set(record, view);
    // The normalized result may be retained for later comparisons in this batch.
    if (view.kind === "available") inspected.set(view.result, view);
    return view;
  };
  let combined = local?.rows ?? [];
  for (const row of rows) combined = retainIncoming(combined, row, inspect);
  const saved = local && saveRows(combined, local);
  const state = inspectHskHistoryRows(saved ?? combined, lang);
  state.storageAvailable = saved !== undefined;
  if (!saved && local?.damaged !== undefined)
    state.problems.unshift({ key: "container", reason: "invalid_container" });
  return state;
}
function storedRowsSafely(): ReturnType<typeof storedRows> | undefined {
  try {
    return storedRows();
  } catch {
    return undefined;
  }
}
