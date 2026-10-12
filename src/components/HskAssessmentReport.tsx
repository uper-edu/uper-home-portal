import React from "react";
import {
  chooseText,
  stripSourceLabel,
  type HskLanguage,
} from "../data/hskAssessment";
import {
  getVersionQuestions,
  displayVersionOptions,
} from "../data/hskAssessmentVersions";
import { inspectHskReport } from "../data/hskReportHistory";
import { HskExamImage } from "./HskExamVisuals";
export default function HskAssessmentReport({
  result: stored,
  lang,
  onRetry,
  saving = false,
}: {
  result: unknown;
  lang: HskLanguage;
  onRetry?: () => void;
  saving?: boolean;
}) {
  const t = (zh: string, en: string, id: string) =>
    chooseText(lang, zh, en, id);
  const view = inspectHskReport(stored, lang);
  if (view.kind !== "available")
    return (
      <section
        aria-label={t(
          "历史报告状态",
          "Historical report status",
          "Status laporan lama",
        )}
        className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800"
      >
        <h3 className="font-semibold">
          {view.kind === "unknown_version"
            ? t(
                "历史版本暂不可复核",
                "Historical version unavailable for review",
                "Versi lama belum dapat ditinjau",
              )
            : t(
                "此历史记录无法读取",
                "This historical record cannot be read",
                "Catatan lama ini tidak dapat dibaca",
              )}
        </h3>
        <p role="status">
          {t(
            "原始记录已保留，不会按当前题库重算或影响其他报告。可重新测评，或联系教师核对这份历史记录。",
            "The original record is retained. It is not regraded with the current bank and does not affect other reports. Take a new assessment or ask a teacher to review this record.",
            "Catatan asli dipertahankan. Catatan tidak dinilai ulang dengan soal saat ini dan tidak memengaruhi laporan lain. Ikuti tes baru atau minta guru meninjau catatan ini.",
          )}
        </p>
        {view.kind === "unknown_version" && (
          <>
            <p className="font-semibold">
              {t(
                "保存时的摘要（未复核）",
                "Recorded summary (not reverified)",
                "Ringkasan tersimpan (belum diverifikasi ulang)",
              )}
            </p>
            {view.recorded.score !== undefined && (
              <p>
                {t("记录分数", "Recorded points", "Poin tersimpan")}:{" "}
                {view.recorded.score}/{view.recorded.maxScore}
              </p>
            )}
            {view.recorded.level && (
              <p>
                {t("记录结论", "Recorded conclusion", "Kesimpulan tersimpan")}:{" "}
                {view.recorded.level}
              </p>
            )}
            {view.recorded.summary && (
              <p className="whitespace-pre-line">{view.recorded.summary}</p>
            )}
            <p className="break-all text-xs">
              {view.recorded.completedAt}
              <br />
              {view.recorded.examVersion} · {view.recorded.scoringVersion}
              <br />
              {view.recorded.attemptId}
            </p>
            <p>
              {t(
                "对应题库与评分档案不可用，不能显示可靠的逐题解析，也不能重新提交这份旧版本成绩。",
                "Its question and scoring archive is unavailable, so item explanations and resubmission are unavailable.",
                "Arsip soal dan aturan nilai tidak tersedia; penjelasan per soal dan pengiriman ulang tidak tersedia.",
              )}
            </p>
          </>
        )}
      </section>
    );
  const { result, version } = view;
  const qs = getVersionQuestions(
    result.attempt.mode,
    result.attempt.examVersion,
    result.attempt.scoringVersion,
  );
  const gates = version.fullPassCounts;
  const gateText = `HSK 1 ≥${gates.hsk1.hsk1}; HSK 2 ≥${gates.hsk2.hsk1}/${gates.hsk2.hsk2}; HSK 3 ≥${gates.hsk3.hsk1}/${gates.hsk3.hsk2}/${gates.hsk3.hsk3}`;
  const sectionNames = {
    listening: t(
      "听力（原始录音）",
      "Listening (source recording)",
      "Menyimak (rekaman sumber)",
    ),
    reading: t("阅读", "Reading", "Membaca"),
    writing: t("识字选择", "Character recognition choices", "Pilihan karakter"),
  };
  return (
    <section
      aria-label={t("测评报告", "Assessment report", "Laporan tes")}
      className="space-y-4 text-sm text-slate-800"
    >
      <div>
        <p className="text-xs font-semibold text-primary-700">
          {t(
            "UPER 分班参考 · 非官方考试成绩",
            "UPER placement reference · No official exam score",
            "Referensi penempatan UPER · Bukan nilai ujian resmi",
          )}
        </p>
        <h3 className="mt-1 text-lg font-bold">{result.levelConfirmed}</h3>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 grid grid-cols-2 gap-3">
        <p>
          <strong>
            {result.score}/{result.maxScore}
          </strong>{" "}
          {t("分", "points", "poin")}
          <br />
          {result.correctCount}/{result.questionCount}{" "}
          {t("题正确", "items correct", "soal benar")}
        </p>
        <p>
          {t("跳过", "Skipped", "Dilewati")}: {result.skippedCount}
          <br />
          {t("未作答", "Unanswered", "Belum dijawab")}: {result.unansweredCount}
        </p>
      </div>
      <p className="whitespace-pre-line leading-relaxed">{result.summary}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="text-left font-semibold pb-2">
            {t("题型表现", "Performance by section", "Hasil per bagian")}
          </caption>
          <thead>
            <tr>
              <th className="py-2">{t("领域", "Section", "Bagian")}</th>
              <th>{t("正确 / 题数", "Correct / items", "Benar / soal")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(result.sections).map(([key, v]) => (
              <tr key={key} className="border-t border-slate-200">
                <td className="py-2">
                  {sectionNames[key as keyof typeof sectionNames]}
                </td>
                <td>
                  {v.total
                    ? `${v.correct}/${v.total}`
                    : t("未测", "Not tested", "Tidak diuji")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-slate-200 p-3 space-y-2">
        <p className="font-semibold">
          {t(
            "按原题星级的正确题数",
            "Correct items by source star level",
            "Jawaban benar per tingkat bintang sumber",
          )}
        </p>
        {[1, 2, 3].map((n) => {
          const count =
            result.breakdown[`hsk${n}Correct` as keyof typeof result.breakdown];
          const total =
            result.breakdown[`hsk${n}Total` as keyof typeof result.breakdown];
          return (
            <p key={n}>
              HSK {n}: {count}/{total}
              {result.attempt.mode === "express" && (
                <>
                  {" "}
                  ·{" "}
                  {t(
                    "一题会改变比例",
                    "One item changes the proportion by",
                    "Satu soal mengubah proporsi sebesar",
                  )}{" "}
                  {Math.round(100 / total)}%
                </>
              )}
            </p>
          );
        })}
      </div>
      {result.thresholds.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">
            {t(
              "本卷门槛及差距",
              "Paper thresholds and gaps",
              "Ambang tes dan selisih",
            )}
          </h4>
          <p className="text-xs text-slate-600">
            {t(
              `各级最低正确数：${gateText}。差距按HSK1/2/3列出。`,
              `Minimum correct counts: ${gateText}. Gaps are listed for HSK1/2/3.`,
              `Jumlah benar minimum: ${gateText}. Selisih ditampilkan untuk HSK1/2/3.`,
            )}
          </p>
          {result.thresholds.map((th) => (
            <p key={th.level}>
              {th.level}:{" "}
              {th.reached
                ? t("达成", "Reached", "Tercapai")
                : t("未达成", "Not reached", "Belum tercapai")}{" "}
              ·{" "}
              {t(
                "还差",
                "Additional correct items needed",
                "Tambahan jawaban benar yang dibutuhkan",
              )}{" "}
              {th.missing.join(" / ")}
            </p>
          ))}
        </div>
      )}
      <p>
        {t(
          "下一步：复习下方错题和跳过题，再由教师结合口语、学习目标与试听表现给出分班建议。",
          "Next: review missed and skipped items below. A teacher can combine speaking, your goals and a trial lesson to recommend placement.",
          "Langkah berikutnya: pelajari soal salah dan dilewati. Guru dapat mempertimbangkan kemampuan berbicara, tujuan dan kelas percobaan untuk menyarankan penempatan.",
        )}
      </p>
      {!!result.attempt.audioFailures.length && (
        <p role="alert" className="text-amber-800">
          {t(
            "本次部分题目发生音频错误，听力表现需谨慎解释。",
            "Some audio failed in this attempt; interpret listening performance with caution.",
            "Sebagian audio gagal pada percobaan ini; hasil menyimak perlu ditafsirkan dengan hati-hati.",
          )}
        </p>
      )}
      <div
        role="status"
        className={`rounded-xl p-3 border ${result.saveStatus === "saved" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
      >
        <p>
          {result.saveStatus === "saved"
            ? t(
                "服务端已重算并保存本次作答。此状态不代表能力认证；顾问跟进及WhatsApp发送需另行确认。",
                "The server recalculated and saved this attempt. This is not proficiency certification; advisor follow-up and WhatsApp delivery require separate confirmation.",
                "Server telah menghitung ulang dan menyimpan jawaban. Ini bukan sertifikasi kemampuan; tindak lanjut konsultan dan pengiriman WhatsApp perlu dikonfirmasi terpisah.",
              )
            : t(
                "报告已在本页生成；服务端尚未确认保存。可以重试。",
                "The report is available here; server saving is not confirmed. You can retry.",
                "Laporan tersedia di halaman ini; penyimpanan server belum dikonfirmasi. Anda dapat mencoba lagi.",
              )}
        </p>
        {result.saveStatus === "local" && onRetry && (
          <button
            type="button"
            disabled={saving}
            onClick={onRetry}
            className="mt-2 underline font-semibold"
          >
            {saving
              ? t("保存中…", "Saving…", "Menyimpan…")
              : t("重试保存", "Retry saving", "Coba simpan lagi")}
          </button>
        )}
      </div>
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer font-semibold">
          {t(
            "查看逐题答案与解释",
            "Review answers and explanations",
            "Tinjau jawaban dan penjelasan",
          )}{" "}
          ({qs.length})
        </summary>
        <div className="mt-3 space-y-3">
          {qs.map((q) => {
            const options = displayVersionOptions(q, version);
            const selected = options.find(
              (o) => o.id === result.attempt.answers[q.id],
            );
            const correct = options.find((o) => o.isCorrect)!;
            const good = selected?.isCorrect;
            const explain =
              lang === "id"
                ? version.explanationsId[q.id]
                : lang === "zh"
                  ? q.explanationZh
                  : q.explanationEn;
            return (
              <article key={q.id} className="border-t border-slate-200 pt-3">
                <h5 className="font-semibold">
                  {t("原卷第", "Source item", "Soal sumber")} {q.id} ·{" "}
                  {good
                    ? t("正确", "Correct", "Benar")
                    : result.attempt.answers[q.id] === null
                      ? t("跳过", "Skipped", "Dilewati")
                      : selected
                        ? t("错误", "Incorrect", "Salah")
                        : t("未答", "Unanswered", "Belum dijawab")}
                </h5>
                <p className="mt-1 whitespace-pre-line font-serif">
                  {q.section === "listening"
                    ? q.spokenScript
                    : stripSourceLabel(q.promptText)}
                </p>
                <p>
                  {t("你的答案", "Your answer", "Jawaban Anda")}:{" "}
                  {selected
                    ? `${selected.label} ${stripSourceLabel(selected.text)}`
                    : "—"}
                </p>
                <p>
                  {t("参考答案", "Reference answer", "Jawaban acuan")}:{" "}
                  {correct.label} {stripSourceLabel(correct.text)}
                </p>
                {correct.imageKey && (
                  <HskExamImage
                    id={correct.imageKey}
                    examVersion={result.attempt.examVersion}
                    scoringVersion={result.attempt.scoringVersion}
                    className="w-36 h-28"
                    lang={lang}
                  />
                )}
                <p className="mt-1 text-slate-600">
                  {q.section === "writing"
                    ? explain
                        .replace(/Correct:\s*[A-F]\s*/g, "")
                        .replace(/正确答案[为是]\s*[A-F]/g, "正确答案")
                    : explain}
                </p>
              </article>
            );
          })}
        </div>
      </details>
      <p className="text-xs text-slate-500 break-all">
        {result.attempt.mode === "full"
          ? t("完整测评", "Full diagnostic", "Diagnostik lengkap")
          : t("快测", "Screening", "Skrining")}{" "}
        ·{" "}
        {result.attempt.completedAt &&
          new Date(result.attempt.completedAt).toLocaleString(
            lang === "id" ? "id-ID" : lang === "zh" ? "zh-CN" : "en-US",
          )}
        <br />
        {t(
          "页面可见时长",
          "Time with page visible",
          "Waktu halaman terlihat",
        )}:{" "}
        {Math.round(
          Object.values(result.attempt.activeSeconds).reduce(
            (sum, n) => sum + n,
            0,
          ) / 60,
        )}{" "}
        {t("分钟", "minutes", "menit")} ·{" "}
        {t("播放启动次数", "Playback starts", "Jumlah mulai putar")}:{" "}
        {Object.values(result.attempt.plays).reduce((sum, n) => sum + n, 0)}
        <br />
        {result.attempt.examVersion} · {result.attempt.scoringVersion}
        <br />
        {result.attempt.attemptId}
      </p>
    </section>
  );
}
