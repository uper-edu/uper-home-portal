import { crmId } from "./crmIndonesian";
import type { CrmLeadRecord } from "../types/crmLead";
import { crmValue, type CrmLanguage } from "./crmLanguage";
type AssessmentLead = Pick<
  CrmLeadRecord,
  | "goal"
  | "reportedLevel"
  | "levelConfirmed"
  | "levelSource"
  | "latestAssessment"
  | "quizScore"
  | "quizMaxScore"
>;
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const finiteScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
/** Display saved evidence only. Never regrade attempts or infer a level from a score. */
export function crmAssessmentSummary(lead: AssessmentLead, lang: CrmLanguage) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const goal = lead.goal
    ? crmValue(lead.goal, lang)
    : t("Goal not recorded", "未填写学习目标");
  const levelText = (value?: string) => {
    if (!value) return "";
    if (/^HSK\s*[1-6]\+?$/i.test(value.trim()))
      return value
        .trim()
        .toUpperCase()
        .replace(/^HSK\s*/, "HSK ");
    if (["Beginner", "Complete beginner", "ZERO", "ZERO_BASE"].includes(value))
      return t("Beginner", "零基础");
    if (value === "Below HSK 1") return t("Below HSK 1", "低于 HSK 1");
    return crmValue(value, lang);
  };
  // Teacher placement and the latest paper can come from different events.
  if (lead.levelSource === "trial")
    return {
      goal,
      conclusion:
        levelText(lead.levelConfirmed) ||
        t("Placement not recorded", "未记录定级结果"),
      detail: t("Teacher placement", "教师定级"),
      kind: "teacher" as const,
      evidenceIncomplete: false,
    };
  const result = record(lead.latestAssessment);
  const mode = record(result.attempt).mode;
  const hasResult = Object.keys(result).length > 0;
  const hasAssessment =
    hasResult ||
    lead.levelSource === "assessment" ||
    finiteScore(lead.quizScore) ||
    (!!lead.levelConfirmed && lead.levelSource !== "self");
  if (hasAssessment) {
    const source =
      mode === "express"
        ? t("Quick assessment", "快速测评")
        : mode === "full"
          ? t("Full assessment", "完整测评")
          : t("Historical assessment", "历史测评");
    // Never combine one attempt's score with a different lead-level denominator.
    const score = hasResult ? result.score : lead.quizScore;
    const max = hasResult ? result.maxScore : lead.quizMaxScore;
    const scoreText = finiteScore(score)
      ? finiteScore(max) && max > 0 && score <= max
        ? t(`${score}/${max} pts`, `${score}/${max} 分`)
        : t(`${score} pts (maximum unknown)`, `${score} 分（满分未知）`)
      : t("Score unavailable", "暂无分数");
    let conclusion = t("Evidence incomplete; starting point undetermined", "依据不完整，无法确定学习起点");
    let evidenceIncomplete = true;
    if (mode === "full" && Array.isArray(result.thresholds)) {
      const thresholds = result.thresholds.map(record);
      const levels = ["HSK 1", "HSK 2", "HSK 3"];
      const complete =
        thresholds.length === 3 &&
        levels.every(
          (level) =>
            thresholds.filter(
              (row) => row.level === level && typeof row.reached === "boolean",
            ).length === 1,
        );
      if (complete) {
        const reached = levels.filter(
          (level) => thresholds.find((row) => row.level === level)!.reached,
        );
        // Corrupt, nonconsecutive threshold flags cannot support a placement claim.
        if (reached.every((level, index) => level === levels[index])) {
          evidenceIncomplete = false;
          const level = reached.at(-1);
          conclusion = level
            ? t(
                `${level} criteria met on this assessment`,
                `达到本卷 ${level} 设定标准`,
              )
            : t("HSK 1 paper threshold not met", "未达到本卷 HSK 1 门槛");
        }
      }
    } else if (mode === "express") {
      const placement = record(result.screeningPlacement);
      if (
        placement.policyVersion === "screening-15-startpoint-v1" &&
        [0, 1, 2, 3].includes(placement.stage as number) &&
        [1, 2, 3].includes(placement.suggestedStartLevel as number) &&
        typeof placement.needsReview === "boolean"
      ) {
        evidenceIncomplete = false;
        conclusion =
          placement.stage === 3
            ? t(
                "Suggested start: HSK 3 consolidation",
                "建议起点：HSK 3 进阶内容",
              )
            : t(
                `Suggested start: HSK ${placement.suggestedStartLevel}`,
                `建议起点：HSK ${placement.suggestedStartLevel}`,
              );
        if (placement.needsReview)
          conclusion += " · " + t(
            ({audio_error:"Listening audio errors",incomplete:"Unanswered questions",inconsistent:"Uneven performance across levels",boundary:"Near a starting-point boundary"} as Record<string,string>)[String(placement.reason)] || "Limitations not recorded",
            ({audio_error:"听力播放异常",incomplete:"存在未答题",inconsistent:"不同难度表现不一致",boundary:"接近学习起点分界"} as Record<string,string>)[String(placement.reason)] || "未记录具体限制",
          );
      } else {
        conclusion = t("Starting-point evidence incomplete", "学习起点依据不完整");
      }
    }
    return {
      goal,
      conclusion,
      detail: `${source} · ${scoreText}`,
      kind: "assessment" as const,
      evidenceIncomplete,
    };
  }
  const reported = levelText(lead.reportedLevel);
  const known =
    !!reported &&
    !["Unknown", "Not sure", "Beginner / Not sure"].includes(
      lead.reportedLevel,
    );
  return {
    goal,
    conclusion: known ? reported : t("Level unknown", "水平未知"),
    detail: known
      ? t("Self-reported · No assessment recorded", "自述基础 · 暂无测评记录")
      : t("No assessment recorded", "暂无测评记录"),
    kind: "self" as const,
    evidenceIncomplete: false,
  };
}
