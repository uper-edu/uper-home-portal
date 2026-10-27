import { viewerTimeZone } from "../../utils/crmOperatingTime";
import { useEffect, useState } from "react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { crmAssessmentSummary } from "../../utils/crmAssessment";
import {
  assessmentDifferences,
  assessmentHistory,
  crossTypeConclusionDifference,
  type AssessmentHistoryEntry,
} from "../../utils/crmAssessmentHistory";
import { type CrmLanguage } from "../../utils/crmLanguage";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import { CrmDisclosure } from "./CrmDisclosure";
import { CrmAssessmentEvidence } from "./CrmAssessmentEvidence";
type Data = {
  leadId: string;
  attempts: AssessmentHistoryEntry[];
  current: Partial<CrmLeadRecord>;
};
export function CrmCustomerAssessment({
  lead,
  lang,
  timezone,
}: {
  lead: CrmLeadRecord;
  lang: CrmLanguage;
  timezone: string;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  timezone = viewerTimeZone();
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/assessments`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const d = await r.json();
        if (d.leadId !== lead.id || !Array.isArray(d.attempts)) throw Error();
        if (!controller.signal.aborted) setData(d);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [lead.id, lead.latestAssessment?.attempt?.attemptId, retry]);
  return (
    <CrmAssessmentHistoryContent
      lead={lead}
      data={data}
      error={error}
      onRetry={() => setRetry((v) => v + 1)}
      lang={lang}
      timezone={timezone}
    />
  );
}
/** Shared read-only presentation, including loading/error states; no scoring or writes. */
export function CrmAssessmentHistoryContent({
  lead,
  data,
  error = false,
  onRetry,
  lang,
  timezone,
}: any) {
  timezone = viewerTimeZone();
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const current =
    data?.leadId === lead.id ? { ...lead, ...data.current } : lead;
  const rows =
    data?.leadId === lead.id
      ? assessmentHistory(data.attempts, current.latestAssessment)
      : [];
  const differences = assessmentDifferences(rows);
  const flagged = new Set(differences.flatMap((d) => [d.newerId, d.olderId]));
  const crossType = crossTypeConclusionDifference(rows);
  const time = (v?: string) =>
    v && Number.isFinite(Date.parse(v))
      ? formatCrmOperatingTime(v, viewerTimeZone())
      : t("Not recorded", "Belum dicatat", "未记录");
  return (
    <div className="crm-assessment-history-view">
      {(data || crmAssessmentSummary(current, lang).kind !== "self") && (
        <CrmAssessmentEvidence
          lead={current}
          lang={lang}
          timezone={timezone}
          summaryOnly
        />
      )}

      {differences.length > 0 && (
        <aside className="crm-assessment-review" role="note">
          <h3>
            {t(
              "Different results · manual review needed",
              "Hasil berbeda · perlu tinjauan manual",
              "结果差异明显 · 请人工复核",
            )}
          </h3>
          <p>
            {t(
              "Highlighted records differ materially. Check test conditions, unanswered items and dates with the learner. No progress, regression or final placement is inferred.",
              "Catatan yang ditandai berbeda secara nyata. Periksa kondisi tes, soal yang belum dijawab, dan tanggal bersama peserta. Tidak disimpulkan kemajuan, penurunan, atau penempatan akhir.",
              "标记的记录存在明显差异，请与客户核实作答条件、未答题及测评时间；不据此判定进步、退步或最终等级。",
            )}
          </p>
        </aside>
      )}
      {crossType && (
        <aside className="crm-assessment-review" role="note">
          <h3>
            {t(
              "Different evidence types · verify conclusions",
              "Jenis bukti berbeda · periksa kesimpulan",
              "依据类型不同 · 请核实结论",
            )}
          </h3>
          <p>
            {t(
              "The latest quick starting-point suggestion and full-paper conclusion are far apart. Their coverage differs: compare the saved evidence with the learner; do not compare raw points or select a final level automatically.",
              "Saran titik awal cepat terbaru dan kesimpulan tes lengkap berbeda jauh. Cakupannya berbeda: periksa bukti bersama peserta; jangan membandingkan skor mentah atau memilih level akhir secara otomatis.",
              "最近快速测评的起点建议与完整测评的本卷结论差异较大。两者覆盖范围不同，请结合原始依据向客户核实；不直接比较原始分数，也不自动确定最终等级。",
            )}
          </p>
        </aside>
      )}

      {(!data || error || rows.length > 0) && (
        <section
          className="crm-assessment-history"
          aria-label={t(
            "Assessment history",
            "Riwayat asesmen",
            "历次测评记录",
          )}
        >
          <div className="crm-assessment-heading">
            <h3>
              {t("Assessment history", "Riwayat asesmen", "历次测评记录")}
            </h3>
            {data && (
              <span>
                {rows.length} {t("records", "catatan", "条记录")}
              </span>
            )}
          </div>

          {error ? (
            <p role="alert">
              {t(
                "Assessment history unavailable. Please retry.",
                "Riwayat asesmen tidak tersedia. Silakan coba lagi.",
                "历次记录暂不可用，请重试。",
              )}{" "}
              <button type="button" className="crm-work-link" onClick={onRetry}>
                {t("Retry", "Coba lagi", "重试")}
              </button>
            </p>
          ) : !data ? (
            <p role="status">
              {t(
                "Loading assessment history…",
                "Memuat riwayat asesmen…",
                "正在加载历次测评记录…",
              )}
            </p>
          ) : !rows.length ? (
            <p>
              {t(
                "No saved test attempts. Self-reported information is not a test result.",
                "Belum ada upaya tes tersimpan. Informasi dari pelanggan bukan hasil tes.",
                "尚无已保存的测评记录；客户自报信息不是测评结果。",
              )}
            </p>
          ) : (
            rows.map((row) => {
              const result = row.result;
              const entry = {
                ...current,
                latestAssessment: result,
                levelSource: "assessment",
                levelConfirmed: undefined,
                reportedLevel: undefined,
                quizResultSummary: undefined,
              } as CrmLeadRecord;
              const summary = crmAssessmentSummary(entry, lang);
              const mode = result?.attempt?.mode;
              const source =
                mode === "express"
                  ? t("Quick assessment", "Asesmen cepat", "快速测评")
                  : mode === "full"
                    ? t("Full assessment", "Asesmen lengkap", "完整测评")
                    : t(
                        "Historical assessment",
                        "Asesmen historis",
                        "历史测评",
                      );
              const detail = summary.detail.startsWith(source + " · ")
                ? summary.detail.slice(source.length + 3)
                : summary.detail;
              return (
                <CrmDisclosure
                  key={`${lead.id}:${row.id}`}
                  className="crm-assessment-history-entry"
                  hideChevron
                  heading={
                    <span className="crm-assessment-history-summary">
                      <span className="crm-assessment-history-title">
                        <strong>{source}</strong>
                        <time
                          className="crm-assessment-history-date"
                          dateTime={result?.attempt?.completedAt}
                          title={`${t("Completed", "Selesai", "完成时间")} · ${time(result?.attempt?.completedAt)} · ${timezone}`}
                        >
                          {time(result?.attempt?.completedAt)}
                        </time>
                      </span>
                      <span className="crm-assessment-history-result">
                        <span className="crm-assessment-history-conclusion">
                          {summary.conclusion}
                        </span>
                        <span className="crm-assessment-meta">{detail}</span>
                        {flagged.has(row.id) && (
                          <span className="crm-assessment-review-tag">
                            {t(
                              "Compare · review needed",
                              "Bandingkan · perlu ditinjau",
                              "对比记录 · 待复核",
                            )}
                          </span>
                        )}
                      </span>
                    </span>
                  }
                >
                  <CrmAssessmentEvidence
                    historyDetail
                    lead={entry}
                    lang={lang}
                    timezone={timezone}
                  />
                </CrmDisclosure>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
