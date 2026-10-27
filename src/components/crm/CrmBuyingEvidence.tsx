import {CrmAiIndicator} from './CrmAiIndicator';
import { useEffect, useRef, useState } from "react";
import {
  visibleIntentEvidence,
  buyingEvidenceLabel,
  evidenceHeading,
  type BuyingEvidence,
} from "../../utils/crmBuyingEvidence";
import { formatCrmOperatingTime,viewerTimeZone } from "../../utils/crmOperatingTime";

export function CrmBuyingEvidence({
  lead,
  lang,
  timezone,
  focus,
  onSource,
  onTask,
}: any) {
  timezone=viewerTimeZone();
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const rows = visibleIntentEvidence(lead);
  const root = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<string>();
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      const target = Array.from(
        root.current?.querySelectorAll<HTMLElement>("[data-signal-id]") || [],
      ).find((el) => el.dataset.signalId === focus.id);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center", behavior: "instant" });
      setHighlight(focus.id);
    });
    const timer = setTimeout(() => setHighlight(undefined), 4500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [focus, lead.id]);
  const time = (e: BuyingEvidence) => {
    if (!e.at)
      return t("Time not recorded", "Waktu tidak tercatat", "时间未记录");
    const at = /^\d{4}-\d\d-\d\d /.test(e.at)
      ? e.at.replace(" ", "T") + "Z"
      : e.at;
    return formatCrmOperatingTime(at, timezone) + " · " + timezone;
  };
  return (
    <div className="crm-buying-evidence" ref={root}>
      {(["sales", "questionnaire"] as const).map((group) => {
        const entries = rows.filter((e) =>
          group === "sales"
            ? e.kind === "sales" || e.kind === "chat"
            : e.kind === group,
        );
        return (
          <section
            className="crm-signal-section"
            key={group}
            aria-label={evidenceHeading(group, lang)}
          >
            <h4>{evidenceHeading(group, lang)}</h4>
            {!entries.length && (
              <p className="crm-work-muted">
                {t("None recorded", "Belum tercatat", "尚未记录")}
              </p>
            )}
            {entries.map((e) => (
              <article
                key={e.id}
                data-signal-id={e.id}
                data-highlighted={highlight === e.id}
                tabIndex={-1}
                className="crm-signal-evidence-row"
                aria-label={`${evidenceHeading(e.kind, lang)} · ${buyingEvidenceLabel(e, lang)}`}
              >
                <strong>{buyingEvidenceLabel(e, lang)}{e.aiDerived&&<CrmAiIndicator/>}</strong>{e.correctedBy&&<p className="crm-work-muted">{t("Corrected original observation · history only","Observasi semula dikoreksi · hanya riwayat","原观察已被关联修正 · 仅保留历史，不作为当前信号")}</p>}
                <p className="crm-signal-meta">
                  {e.kind === "questionnaire"
                    ? t(
                        "Customer questionnaire",
                        "Kuesioner pelanggan",
                        "客户问卷",
                      )
                    : e.kind === "chat"
                      ? t(
                          "Customer Chat request",
                          "Permintaan Chat pelanggan",
                          e.aiDerived?"客户对话":"客户 Chat 请求",
                        )
                      : e.kind === "sales"
                        ? t("Sales record", "Catatan sales", "销售记录")
                        : t(
                            "Historical profile label",
                            "Label profil historis",
                            "历史资料标签",
                          )}
                  {e.kind === "sales" && e.actor ? ` · ${e.actor}` : ""} ·{" "}
                  <time>{time(e)}</time>
                </p>
                {e.kind === "questionnaire" ? (
                  <p className="crm-signal-original">
                    {t("Saved answer", "Jawaban tersimpan", "保存的选项")}：
                    {buyingEvidenceLabel(e, lang)}{e.aiDerived&&<CrmAiIndicator/>}
                  </p>
                ) : e.original ? (
                  <blockquote>{e.original}</blockquote>
                ) : (
                  <p className="crm-work-muted">
                    {t(
                      "Original evidence unavailable; no source or time inferred.",
                      "Bukti asli tidak tersedia; sumber dan waktu tidak disimpulkan.",
                      "原始依据不可用，不推断来源或时间。",
                    )}
                  </p>
                )}
                {(e.taskId || e.messageId) && (
                  <div className="crm-signal-links">
                    {e.messageId && e.conversationId && onSource && (
                      <button
                        className="crm-work-link"
                        type="button"
                        onClick={() => onSource(e)}
                      >
                        {e.kind === "sales"
                          ? t(
                              "View linked customer message",
                              "Lihat pesan pelanggan terkait",
                              "查看关联客户消息",
                            )
                          : t(
                              "View original message",
                              "Lihat pesan asli",
                              "查看原始消息",
                            )}
                      </button>
                    )}
                    {e.taskId && onTask && (
                      <button
                        className="crm-work-link"
                        type="button"
                        onClick={() => onTask(e.taskId)}
                      >
                        {t(
                          "View linked task",
                          "Lihat tugas terkait",
                          "查看关联任务",
                        )}
                      </button>
                    )}
                    {e.kind === "chat" && e.taskOperation && (
                      <span className="crm-work-muted">
                        {e.value === "Advisor requested"
                          ? t("Advisor contact request recorded", "Permintaan kontak konsultan tercatat", "顾问联系请求已记录")
                          : e.value === "Booking requested"
                            ? t("Booking request recorded", "Permintaan pemesanan tercatat", "预约请求已记录")
                            : t("Enrollment interest recorded", "Minat pendaftaran tercatat", "报名意向已记录")}
                      </span>
                    )}
                  </div>
                )}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
