import { useId } from "react";
import { TriangleAlert } from "lucide-react";
import { chooseText, type HskLanguage, type HskResult } from "../data/hskAssessment";
import { learnerAssessmentGuidance } from "../data/hskLearnerGuidance";

type Performance = { label: string; correct: number; total: number };

function ReportBreakdown({ title, entries, countLabel }: {
  title: string;
  entries: Performance[];
  countLabel: string;
}) {
  const heading = useId();
  if (!entries.length) return null;
  return <section className="hsk-report-breakdown" aria-labelledby={heading}>
    <h3 id={heading}>{title}</h3>
    <ul>
      {entries.map(({ label, correct, total }) => <li className="hsk-report-row" key={label}>
        <span>{label}</span>
        <span className="hsk-report-track" aria-hidden="true">
          <span style={{ width: `${100 * correct / total}%` }} />
        </span>
        <span className="hsk-report-count">
          <span className="sr-only">{countLabel} </span><strong>{correct}</strong><span> / {total}</span>
        </span>
      </li>)}
    </ul>
  </section>;
}

export function HskAssessmentOverview({ result, lang, onRetry, saving }: {
  result: HskResult;
  lang: HskLanguage;
  onRetry?: () => void;
  saving: boolean;
}) {
  const t = (zh: string, en: string, id: string) => chooseText(lang, zh, en, id);
  const guidance = learnerAssessmentGuidance(result, lang);
  const mode = result.attempt.mode === "express"
    ? t("HSK 1–3 快速测评", "HSK 1–3 · Quick assessment", "HSK 1–3 · Tes singkat")
    : t("HSK 1–3 完整测评", "HSK 1–3 · Full assessment", "HSK 1–3 · Tes lengkap");
  const date = result.attempt.completedAt && new Date(result.attempt.completedAt);
  const completed = date && Number.isFinite(date.valueOf())
    ? new Intl.DateTimeFormat({zh:"zh-CN", en:"en-GB", id:"id-ID"}[lang], {dateStyle:"medium"}).format(date)
    : undefined;
  const unanswered = result.skippedCount + result.unansweredCount;
  const countLabel = t("答对／总题数", "Correct / total", "Benar / total");
  const sectionNames = {
    listening: t("听力", "Listening", "Menyimak"),
    reading: t("阅读", "Reading", "Membaca"),
    writing: t("识字选择", "Character recognition", "Pengenalan karakter"),
  };
  const sections = (Object.keys(sectionNames) as (keyof typeof sectionNames)[])
    .map(key => ({ label: sectionNames[key], ...result.sections[key] }))
    .filter(entry => entry.total > 0);
  const levels = ([1, 2, 3] as const).map(level => ({
    label: `HSK ${level}`,
    correct: result.breakdown[`hsk${level}Correct`],
    total: result.breakdown[`hsk${level}Total`],
  })).filter(entry => entry.total > 0);
  const review = guidance?.review || (result.attempt.audioFailures.length
    ? t("部分听力未正常播放，建议请顾问进一步确认听力基础。", "Some listening audio did not play correctly. Ask an advisor to help check your listening.", "Sebagian audio tidak diputar dengan benar. Minta konsultan membantu memeriksa kemampuan menyimak.")
    : "");

  return <section className="hsk-report-overview" aria-label={t("测评结果", "Assessment results", "Hasil tes")}>
    <div className="hsk-report-hero">
      <p className="hsk-report-meta">
        <span>{mode}</span>
        {completed && <time dateTime={result.attempt.completedAt}>{completed}</time>}
      </p>
      <div className="hsk-report-headline">
        {guidance && <div className="hsk-report-guidance">
          <p>{t("建议学习起点", "Suggested starting point", "Titik awal yang disarankan")}</p>
          <h3>{guidance.start}</h3>
        </div>}
        <div className="hsk-report-score">
          <p><strong>{result.correctCount}</strong><span> / {result.questionCount}</span></p>
          <span>{countLabel}</span>
        </div>
      </div>
      <p className="hsk-report-attempts">
        <span>{t("已作答", "Answered", "Dijawab")} <strong>{result.questionCount - unanswered}</strong></span>
        <span>{t("未作答", "Unanswered", "Belum dijawab")} <strong>{unanswered}</strong></span>
      </p>
    </div>

    {review && <p className="hsk-report-notice" role="status">
      <TriangleAlert size={16} aria-hidden="true" />
      <span>{review}</span>
    </p>}

    <div className="hsk-report-performance">
      <ReportBreakdown title={t("题型表现", "By skill", "Per keterampilan")} entries={sections} countLabel={countLabel} />
      <ReportBreakdown title={t("各级题目表现", "By question level", "Per tingkat soal")} entries={levels} countLabel={countLabel} />
    </div>
    <p className="hsk-report-scope">{t("本次表现仅用于学习和选班参考，非官方 HSK 成绩。", "For learning and class placement only. This is not an official HSK score.", "Untuk panduan belajar dan penempatan kelas. Ini bukan nilai HSK resmi.")}</p>
    {result.saveStatus !== "saved" && <div className="hsk-report-notice hsk-report-save">
      <p role="status">{saving
        ? t("正在同步结果…", "Syncing results…", "Menyinkronkan hasil…")
        : t("结果暂未同步。", "Results have not synced.", "Hasil belum tersinkron.")}</p>
      {onRetry && <button type="button" disabled={saving} onClick={onRetry}>
        {t("重试保存", "Retry saving", "Coba simpan lagi")}
      </button>}
    </div>}
  </section>;
}
