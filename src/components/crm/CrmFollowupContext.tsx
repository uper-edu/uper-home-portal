import { useState } from "react";
import { Clock3, MessageSquare, ArrowUpRight } from "lucide-react";
import { CrmDisclosure } from "./CrmDisclosure";
import { followupOverview, messageTaskLinks } from "../../utils/crmFollowupOverview";
import { crmMessageTimestamp } from "../../utils/crmMessageTime";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { crmValue } from "../../utils/crmLanguage";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
export function CrmFollowupContext({ lead, lang, timezone, onSource, tasks, facts, taskError, onTask }: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const stats = followupOverview(lead),
    a = lead.contactArrangement;
  const [expanded, setExpanded] = useState(false);
  const log = stats.lastConnected,
    message = stats.message;
  const links = messageTaskLinks(message, lead.chatTranscript || [], tasks || [], facts || []);
  return (
    <div className="crm-communication-overview">
      <div
        className="crm-contact-arrangement"
        data-state={a?.state || "active"}
      >
        <div className="crm-contact-arrangement-line">
          <span className="crm-arrangement-dot" aria-hidden="true" />
          <span>
            {t("Contact arrangement", "Pengaturan kontak", "联系安排")}:
          </span>
          <strong>
            {
              (
                {
                  active: t(
                    "Active follow-up",
                    "Tindak lanjut aktif",
                    "正常跟进",
                  ),
                  waiting: t(
                    "Waiting for review",
                    "Menunggu tinjauan",
                    "等待复查",
                  ),
                  nurture: t(
                    "Nurture review",
                    "Tinjauan pemeliharaan",
                    "培育复查",
                  ),
                  stopped: t(
                    "Proactive contact stopped",
                    "Kontak proaktif dihentikan",
                    "停止主动联系",
                  ),
                } as any
              )[a?.state || "active"]
            }
          </strong>
        </div>
        {a?.reason && <p>{a.reason}</p>}
        {a?.reviewAt && (
          <p>
            {t("Review time", "Waktu tinjauan", "复查时间")}:{" "}
            {formatCrmOperatingTime(a.reviewAt, timezone)} · {timezone}
          </p>
        )}
      </div>
      <div
        className="crm-communication-grid"
        data-has-message={Boolean(message)}
      >
        <div className="crm-contact-summary">
          <h4>
            <MessageSquare size={16} aria-hidden="true" />
            {t(
              "Latest effective conversation",
              "Komunikasi efektif terakhir",
              "最近有效沟通",
            )}
          </h4>
          {log ? (
            <>
              <p
                id="crm-last-contact-excerpt"
                className={`crm-contact-excerpt ${expanded ? "is-expanded" : ""}`}
              >
                {log.summary}
              </p>
              <p className="crm-contact-metadata">
                {log.staffName} · {crmValue(log.channel, lang)} ·{" "}
                {crmValue(log.connectStatus, lang)}
                <span>
                  {t("Recorded", "Dicatat", "记录于")}{" "}
                  {formatCrmOperatingTime(log.timestamp || log.at, timezone)}
                </span>
              </p>
              {log.summary?.length > 150 && (
                <button
                  type="button"
                  className="crm-work-link"
                  aria-expanded={expanded}
                  aria-controls="crm-last-contact-excerpt"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? t("Show less", "Tutup", "收起")
                    : t("Read full note", "Baca selengkapnya", "展开全文")}
                </button>
              )}
              {log.sourceMessageId && log.sourceConversationId && (
                <button
                  type="button"
                  className="crm-work-link"
                  onClick={() => onSource({ details: log })}
                >
                  <ArrowUpRight size={14} aria-hidden="true" />
                  {t(
                    "View linked customer message",
                    "Lihat pesan pelanggan terkait",
                    "查看关联客户消息",
                  )}
                </button>
              )}
            </>
          ) : (
            <p className="crm-work-muted">
              {t(
                "No connected or replied contact recorded",
                "Belum ada kontak tersambung atau dibalas",
                "尚无接通或回复记录",
              )}
            </p>
          )}
        </div>
        {message && (
          <div className="crm-contact-summary crm-contact-new-message">
            <h4>
              <MessageSquare size={16} aria-hidden="true" />
              {stats.newer
                ? t(
                    "Customer message since then",
                    "Pesan pelanggan setelahnya",
                    "此后客户的新消息",
                  )
                : t(
                    "Latest customer message",
                    "Pesan pelanggan terbaru",
                    "最近客户消息",
                  )}
            </h4>
            <p className="crm-contact-excerpt">{message.content}</p>
            <p className="crm-contact-metadata">
              {lead.fullName}
              <span>
                {formatCrmOperatingTime(
                  crmMessageTimestamp(message)!,
                  timezone,
                )}
              </span>
            </p>
            <div className="crm-message-task-links">
              <h5>{t("Linked tasks · current status", "Tugas terkait · status saat ini", "关联任务 · 当前状态")}</h5>
              {taskError || !tasks ? (
                <p className="crm-work-muted">{taskError
                  ? t("Task links unavailable. Retry loading follow-up information.", "Tautan tugas tidak tersedia. Coba muat ulang informasi tindak lanjut.", "任务关联暂不可用，请重试加载跟进信息。")
                  : t("Loading task links…", "Memuat tautan tugas…", "正在加载任务关联…")}</p>
              ) : links.length ? links.map(({id,task}) => {
                const view = task && presentFollowUpTask(task, lang, timezone);
                return view ? <button key={id} type="button" className="crm-work-link crm-message-task-link" onClick={()=>onTask?.(id)}>
                  <ArrowUpRight size={14} aria-hidden="true" />
                  <span>{view.action} · {view.status}</span>
                </button> : <p key={id} className="crm-work-muted">{t("Linked task information unavailable", "Informasi tugas terkait tidak tersedia", "关联任务信息暂不可用")}</p>;
              }) : <p className="crm-work-muted">{t("No task link recorded", "Belum ada tautan tugas tercatat", "未记录任务关联")}</p>}
            </div>
            {message.conversation_id && (message.id || message.request_id) && (
              <button
                type="button"
                className="crm-work-link"
                onClick={() =>
                  onSource({
                    details: {
                      sourceConversationId: message.conversation_id,
                      sourceMessageId: message.id || message.request_id,
                    },
                  })
                }
              >
                <ArrowUpRight size={14} aria-hidden="true" />
                {t("View original message", "Lihat pesan asli", "查看对应原文")}
              </button>
            )}
          </div>
        )}
      </div>
      {stats.lastAttempt &&
        stats.lastAttempt.id !== stats.lastConnected?.id && (
          <div className="crm-contact-later-attempt">
            <Clock3 size={15} aria-hidden="true" />
            <div>
              <span>
                {t(
                  "Latest contact attempt",
                  "Percobaan kontak terakhir",
                  "最近联系尝试",
                )}
                : {crmValue(stats.lastAttempt.connectStatus, lang)} ·{" "}
                {crmValue(stats.lastAttempt.channel, lang)} ·{" "}
                {stats.lastAttempt.staffName} ·{" "}
                {formatCrmOperatingTime(
                  stats.lastAttempt.timestamp || stats.lastAttempt.at,
                  timezone,
                )}
              </span>
              {stats.lastAttempt.summary && (
                <CrmDisclosure
                  heading={t(
                    "Attempt notes",
                    "Catatan upaya kontak",
                    "查看尝试记录",
                  )}
                >
                  <p className="crm-followup-record-text">
                    {stats.lastAttempt.summary}
                  </p>
                </CrmDisclosure>
              )}
            </div>
          </div>
        )}
      {lead.nextAction && (
        <div className="crm-saved-customer-note">
          <CrmDisclosure
            heading={t(
              "Saved customer note",
              "Catatan pelanggan tersimpan",
              "客户人工备注",
            )}
          >
            <p className="crm-followup-record-text">{lead.nextAction}</p>
          </CrmDisclosure>
        </div>
      )}
    </div>
  );
}
