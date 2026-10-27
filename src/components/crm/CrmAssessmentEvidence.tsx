import { viewerTimeZone } from "../../utils/crmOperatingTime";
import { CrmAssessmentQuestionTypes } from "./CrmAssessmentQuestionTypes";
import { assessmentQuestionTypes } from "../../utils/crmAssessmentQuestionTypes";
import { CrmDisclosure } from "./CrmDisclosure";
import type { ReactNode } from "react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { crmAssessmentSummary } from "../../utils/crmAssessment";
import { crmValue, type CrmLanguage } from "../../utils/crmLanguage";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";

/** Presentation of saved evidence only. This component never grades or writes data. */
export function CrmAssessmentEvidence({
  lead,
  lang,
  timezone,
  summaryOnly = false,
  historyDetail = false,
}: {
  lead: CrmLeadRecord;
  lang: CrmLanguage;
  timezone: string;
  summaryOnly?: boolean;
  historyDetail?: boolean;
}) {
  timezone = viewerTimeZone();
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const unknown = t("Not recorded", "Belum dicatat", "未记录");
  const summary = crmAssessmentSummary(lead, lang);
  const result =
    lead.latestAssessment &&
    typeof lead.latestAssessment === "object" &&
    !Array.isArray(lead.latestAssessment)
      ? lead.latestAssessment
      : undefined;
  const questionTypes = result ? assessmentQuestionTypes(result) : null;
  const paper =
    summary.kind === "teacher" && result
      ? crmAssessmentSummary(
          { ...lead, levelSource: "assessment", levelConfirmed: undefined },
          lang,
        )
      : summary;
  const mode = result?.attempt?.mode;
  const source =
    mode === "express"
      ? t("Quick assessment", "Asesmen cepat", "快速测评")
      : mode === "full"
        ? t("Full assessment", "Asesmen lengkap", "完整测评")
        : t("Historical assessment", "Asesmen historis", "历史测评");
  const scoreDetail = summary.detail.startsWith(source + " · ")
    ? summary.detail.slice(source.length + 3)
    : summary.detail;
  const date = result?.attempt?.completedAt;
  const completed =
    date && Number.isFinite(Date.parse(date)) && Date.parse(date) > 0
      ? formatCrmOperatingTime(date, viewerTimeZone())
      : t("Unknown time", "Waktu tidak diketahui", "未知时间");
  const facts = (items: Array<[string, ReactNode]>, className = "") => (
    <dl className={`crm-assessment-facts ${className}`}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? unknown}</dd>
        </div>
      ))}
    </dl>
  );
  const reviewReason =
    mode === "express" && result?.screeningPlacement?.needsReview
      ? {
          audio_error: t(
            "Audio playback errors were recorded. Check the affected listening items before using this starting point.",
            "Gangguan audio tercatat. Periksa soal menyimak yang terdampak sebelum memakai titik awal ini.",
            "已记录音频播放异常，请先核实受影响的听力题，再使用此起点建议。",
          ),
          incomplete: t(
            "Some questions were unanswered. Consider a new or full assessment to clarify the starting point.",
            "Sebagian soal belum dijawab. Pertimbangkan asesmen baru atau lengkap untuk memperjelas titik awal.",
            "存在未作答题，建议重新测评或完成完整测评，以明确学习起点。",
          ),
          inconsistent: t(
            "Performance varies across difficulty levels. Review the foundation items before choosing a starting point.",
            "Hasil antar tingkat kesulitan berbeda. Tinjau soal dasar sebelum memilih titik awal.",
            "不同难度的表现不一致，请核对基础题表现后再确定学习起点。",
          ),
          boundary: t(
            "This result is near a starting-point boundary. A full assessment can help distinguish the next learning step.",
            "Hasil mendekati batas titik awal. Asesmen lengkap dapat membantu menentukan langkah belajar berikutnya.",
            "结果接近学习起点分界，可通过完整测评进一步区分下一步学习内容。",
          ),
          clear: "",
        }[result.screeningPlacement.reason] ||
        t(
          "The saved result indicates uncertainty, but the specific limitation was not recorded. Consider a new assessment before selecting a learning starting point.",
          "Hasil tersimpan menunjukkan ketidakpastian, tetapi batasannya tidak dicatat. Pertimbangkan asesmen baru sebelum memilih titik awal belajar.",
          "已保存结果存在不确定性，但未记录具体限制。建议补充测评后再确定学习起点。",
        )
      : "";
  const needsEvidence = paper.kind === "assessment" && paper.evidenceIncomplete;
  const rawNotes = lead.quizResultSummary;
  const sections =
    result?.sections && typeof result.sections === "object"
      ? Object.entries(result.sections)
          .filter(([, row]) => row && typeof row === "object")
          .sort(
            ([a], [b]) =>
              (({ listening: 0, reading: 1, writing: 2 })[a] ?? 3) -
              ({ listening: 0, reading: 1, writing: 2 }[b] ?? 3),
          )
      : [];
  return (
    <div className="crm-assessment-view">
      {!historyDetail && (
        <section
          className="crm-assessment-overview"
          aria-label={
            summaryOnly
              ? t("Current conclusion", "Kesimpulan saat ini", "当前结论")
              : t("Assessment result", "Hasil asesmen", "本次测评结果")
          }
        >
          <div className="crm-assessment-heading">
            <h3>
              {summaryOnly
                ? t("Current conclusion", "Kesimpulan saat ini", "当前结论")
                : t("Assessment result", "Hasil asesmen", "本次测评结果")}
            </h3>
            {summary.kind !== "self" && (
              <span className="crm-assessment-source">
                {summary.kind === "teacher"
                  ? t("Teacher placement", "Penempatan oleh guru", "教师定级")
                  : source}
              </span>
            )}
          </div>
          <p className="crm-assessment-result">
            {summary.kind === "self"
              ? t(
                  "No assessment recorded",
                  "Belum ada asesmen tercatat",
                  "尚无测评记录",
                )
              : summary.conclusion}
          </p>
          {summary.kind === "assessment" && (
            <p className="crm-assessment-meta">
              {scoreDetail} · {completed}
            </p>
          )}
          {summary.kind === "teacher" &&
            facts([
              [t("Teacher", "Guru", "教师"), unknown],
              [t("Placement date", "Tanggal penempatan", "定级时间"), unknown],
            ])}
          {summary.kind === "self" && !summaryOnly && (
            <p className="crm-assessment-meta">
              {t(
                "Self-reported information is available under Assessment evidence and history.",
                "Informasi dari pelanggan tersedia di Bukti dan riwayat asesmen.",
                "客户自报信息可在测评依据与历史记录中查看。",
              )}
            </p>
          )}
          {summary.kind === "assessment" && (
            <p className="crm-assessment-scope">
              {mode === "express"
                ? t(
                    "A quick assessment suggests a learning starting point; it does not establish a complete HSK level or an official result.",
                    "Asesmen cepat menyarankan titik awal belajar; bukan penetapan level HSK lengkap atau hasil resmi.",
                    "快速测评用于建议学习起点，不代表完整 HSK 水平认定或官方成绩。",
                  )
                : mode === "full"
                  ? t(
                      "This assessment covers HSK 1–3 items. Speaking, handwriting and higher levels were not assessed. This is not an official HSK result.",
                      "Asesmen ini mencakup soal HSK 1–3. Berbicara, tulisan tangan, dan level lebih tinggi tidak diuji. Ini bukan hasil HSK resmi.",
                      "本测评覆盖 HSK 1–3 题目，未测口语、手写及更高等级，不代表官方 HSK 成绩。",
                    )
                  : t(
                      "Historical evidence is incomplete. No level is inferred from the score alone.",
                      "Bukti historis belum lengkap. Level tidak disimpulkan hanya dari skor.",
                      "历史依据不完整，不仅凭分数推断水平。",
                    )}
            </p>
          )}
        </section>
      )}
      {(reviewReason ||
        needsEvidence ||
        (mode === "express" && !result?.screeningPlacement)) && (
        <aside
          className="crm-assessment-review"
          aria-label={t(
            "Limitations and suggestions",
            "Batasan dan saran",
            "依据限制与建议",
          )}
        >
          <h3>
            {t("Limitations and suggestions", "Batasan dan saran", "依据限制与建议")}
          </h3>
          <p>
            {reviewReason ||
              t(
                "Saved evidence is missing or inconsistent, so a learning starting point cannot be determined from the score alone. Consider a new assessment if a starting point is needed.",
                "Bukti tersimpan tidak lengkap atau tidak konsisten; titik awal belajar tidak dapat ditentukan hanya dari skor. Pertimbangkan asesmen baru bila titik awal diperlukan.",
                "已保存依据缺失或不一致，不能仅凭分数确定学习起点。如需确定起点，建议补充测评。",
              )}
          </p>
        </aside>
      )}
      {!summaryOnly && result && (
        <section
          className={
            "crm-assessment-performance" +
            (historyDetail ? " is-history-detail" : "")
          }
          aria-label={t("Response breakdown", "Rincian jawaban", "作答表现")}
        >
          {!historyDetail && (
            <h3>
              {summary.kind === "teacher"
                ? t(
                    "Latest assessment · separate evidence",
                    "Asesmen terbaru · bukti terpisah",
                    "最近测评 · 独立依据",
                  )
                : t("Response breakdown", "Rincian jawaban", "作答表现")}
            </h3>
          )}
          {summary.kind === "teacher" && (
            <>
              <p className="crm-assessment-subresult">{paper.conclusion}</p>
              <p className="crm-assessment-meta">
                {paper.detail} · {completed}
              </p>
              <p className="crm-assessment-meta">
                {t(
                  "This assessment is separate from the teacher's placement and does not replace it.",
                  "Asesmen ini terpisah dari penempatan guru dan tidak menggantikannya.",
                  "本次测评与教师定级分别保留，不替代教师结论。",
                )}
              </p>
            </>
          )}
          {(!historyDetail || !questionTypes?.available) &&
            facts(
              [
                [
                  t("Questions", "Jumlah soal", "题目数量"),
                  result.questionCount,
                ],
                [t("Correct", "Benar", "正确题数"), result.correctCount],
                [t("Skipped", "Dilewati", "跳过题数"), result.skippedCount],
                [
                  t("Unanswered", "Belum dijawab", "未作答题数"),
                  result.unansweredCount,
                ],
              ],
              "crm-assessment-stats",
            )}
          {questionTypes && (
            <CrmAssessmentQuestionTypes stats={questionTypes} lang={lang} />
          )}
          {!questionTypes?.available && sections.length > 0 && (
            <table className="crm-assessment-sections">
              <caption>
                {t("Section results", "Hasil per bagian", "分项结果")}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t("Section", "Bagian", "项目")}</th>
                  <th scope="col">
                    {t("Correct / Total", "Benar / Total", "正确／总题数")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">
                      {{
                        listening: t("Listening", "Menyimak", "听力"),
                        reading: t("Reading", "Membaca", "阅读"),
                        writing: t("Writing items", "Soal menulis", "书写题目"),
                      }[key] || t("Other section", "Bagian lain", "其他项目")}
                    </th>
                    <td>
                      {value.correct ?? "—"} / {value.total ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {!summaryOnly && !historyDetail && (
        <CrmDisclosure
          heading={
            <>
              {t(
                "Assessment evidence and history",
                "Bukti dan riwayat asesmen",
                "测评依据与历史记录",
              )}
            </>
          }
          className="crm-assessment-evidence"
        >
          <div className="crm-assessment-evidence-body">
            {result ? (
              facts([
                [t("Completed", "Selesai", "完成时间"), completed],
                [
                  t("Operating timezone", "Zona waktu operasional", "运营时区"),
                  timezone,
                ],
                [
                  t("Exam version", "Versi tes", "试卷版本"),
                  result.attempt?.examVersion,
                ],
                [
                  t("Scoring version", "Versi penilaian", "评分版本"),
                  result.attempt?.scoringVersion,
                ],
              ])
            ) : (
              <p>
                {t(
                  "Structured attempt details are unavailable for this record.",
                  "Rincian upaya terstruktur tidak tersedia untuk catatan ini.",
                  "该记录暂无结构化作答详情。",
                )}
              </p>
            )}
            {!result &&
              lead.quizBreakdown &&
              facts(
                ([1, 2, 3] as const).map((n) => [
                  `HSK ${n}`,
                  `${lead.quizBreakdown?.[`hsk${n}Correct`] ?? "—"} / ${lead.quizBreakdown?.[`hsk${n}Total`] ?? "—"}`,
                ]),
              )}
            {rawNotes && (
              <section className="crm-detail-subsection crm-assessment-original">
                <h4>
                  {t(
                    "Original assessment text",
                    "Teks asesmen asli",
                    "原始测评说明",
                  )}
                </h4>
                <p className="crm-assessment-meta">
                  {t(
                    "Preserved text from the customer record; not a sales note. Its original language is retained. Association with the latest attempt is not verified.",
                    "Teks dari catatan pelanggan dipertahankan; bukan catatan sales. Bahasa aslinya tetap sama. Kaitannya dengan upaya terbaru belum diverifikasi.",
                    "保留的客户级测评原文，并非销售备注；保持原语言，未核实其是否对应最近一次测评。",
                  )}
                </p>
                <p className="crm-assessment-raw">{rawNotes}</p>
              </section>
            )}
          </div>
        </CrmDisclosure>
      )}
    </div>
  );
}
