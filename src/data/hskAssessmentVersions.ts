import { readHskVersionArchive } from "./hskVersionArchives";
import type { RealHskQuestion } from "./hskQuizQuestions";

export const HSK_EXAM_VERSION = "pdf-e80a3cbaabc5-audio-1d13ab13-screening15-v4";
export const HSK_SCORING_VERSION = "stars-15-17-18-v2";
export interface HskVersion {
  administration?: "sequential-source-two-readings-v3";
  screeningPolicy?: {version: "screening-15-startpoint-v1"; passCountPerLevel: number; sourceIds: number[]};
  examVersion: string;
  scoringVersion: string;
  gradingModel: "source-stars-two-points-v2";
  questions: RealHskQuestion[];
  fullPassCounts: {
    hsk1: { hsk1: number };
    hsk2: { hsk1: number; hsk2: number };
    hsk3: { hsk1: number; hsk2: number; hsk3: number };
  };
  explanationsId: Record<number, string>;
  imageAssets: Record<string, { src: string }>;
  audioAssets: Record<string, { src: string; durationSec: number; answerPauseStartSec?: number }>;
  displayOptions: Record<number, { id: string; label: string }[]>;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const loadedVersions = new Map<string, HskVersion>();
export class HskVersionUnavailableError extends Error {}
export function findHskVersion(examVersion: unknown, scoringVersion: unknown) {
  if (typeof examVersion !== "string") return;
  let version = loadedVersions.get(examVersion);
  if (!version) {
    const archive = readHskVersionArchive(examVersion) as HskVersion | undefined;
    if (!archive || archive.scoringVersion !== scoringVersion) return;
    version = freeze(archive);
    loadedVersions.set(examVersion, version);
  }
  if (version.scoringVersion === scoringVersion) return version;
}
export function requireHskVersion(
  examVersion: unknown,
  scoringVersion: unknown,
): HskVersion {
  const version = findHskVersion(examVersion, scoringVersion);
  if (!version)
    throw new HskVersionUnavailableError("HSK version archive unavailable");
  return version;
}
export function getVersionQuestions(
  mode: "express" | "full",
  examVersion = HSK_EXAM_VERSION,
  scoringVersion = HSK_SCORING_VERSION,
) {
  const questions = requireHskVersion(examVersion, scoringVersion).questions;
  return mode === "express"
    ? questions.filter((q) => q.isExpressSelected)
    : questions;
}

export function displayVersionOptions(
  question: RealHskQuestion,
  version: HskVersion,
) {
  return version.displayOptions[question.id].map((display) => {
    const option = question.options.find((o) => o.id === display.id);
    if (!option) throw new Error("Incomplete archived HSK display options");
    return { ...option, label: display.label };
  });
}
