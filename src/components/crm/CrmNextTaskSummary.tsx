import { leadFollowUp, emptyFollowUpLabel } from "../../utils/crmFollowUp";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { crmId } from "../../utils/crmIndonesian";
import type { CrmLeadRecord } from "../../types/crmLead";
import type { CrmLanguage } from "../../utils/crmLanguage";
export function CrmNextTaskSummary({
  lead,
  lang,
  timezone,
  onOpen,
}: {
  lead: CrmLeadRecord;
  lang: CrmLanguage;
  timezone: string;
  onOpen: () => void;
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const summary = leadFollowUp(lead, lang, timezone),
    view =
      summary.next && presentFollowUpTask(summary.next.task, lang, timezone);
  return (
    <div className="crm-next-task-summary">
      <span className="crm-work-muted">{t("Priority task", "优先待办")}</span>
      <span>
        {summary.next?.action ||
          (summary.loaded
            ? emptyFollowUpLabel(lead, lang)
            : t("Follow-up information unavailable", "跟进信息暂不可用"))}
      </span>
      {view && (
        <span className="crm-next-task-time">
          {view.times.map((time, index) => (
            <span key={index}>
              {index > 0 ? " · " : ""}
              {time.label} · {view.formatTime(time.value)}
            </span>
          ))}
          <span className="crm-work-muted"> · {timezone}</span>
          {["overdue", "review"].includes(view.tone) && (
            <span data-tone={view.tone}> · {view.status}</span>
          )}
        </span>
      )}
      <button type="button" className="crm-work-link" onClick={onOpen}>
        {t("View tasks", "查看任务")}
        {summary.next ? ` (${summary.additionalCount + 1})` : ""}
      </button>
    </div>
  );
}
