import {CrmFirstContactCountdown} from './CrmFirstContactCountdown';
import {contactRestriction} from '../../utils/crmContact';
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
  hideFirstContact = false,
  hideContactNotice = false,
}: {
  lead: CrmLeadRecord;
  lang: CrmLanguage;
  timezone: string;
  onOpen: () => void;
  hideFirstContact?: boolean;
  hideContactNotice?: boolean;
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const summary = leadFollowUp(lead, lang, timezone),
    view =
      summary.next && presentFollowUpTask(summary.next.task, lang, timezone);
  if(hideFirstContact&&view?.task.kind==='consultation')return null;
  if(hideContactNotice&&summary.loaded&&!summary.next&&contactRestriction(lead))return null;
  if(summary.loaded&&!summary.next&&!emptyFollowUpLabel(lead,lang))return null;
  return (
    <div className="crm-next-task-summary">
      <span className={view?.task.kind==='consultation'?"crm-first-contact-line":undefined}>
      <span>
        {summary.next?.action ||
          (summary.loaded
            ? emptyFollowUpLabel(lead, lang)
            : t("Follow-up information unavailable", "跟进信息暂不可用"))}
      </span>
      {view?.task.kind==='consultation'&&<span aria-hidden="true" className="crm-first-contact-dot">·</span>}
      {view && (
        <span className="crm-next-task-time">
          {view.task.kind==='consultation'?<CrmFirstContactCountdown dueAt={view.task.dueAt} lang={lang}/>:view.times.map((time, index) => (
            <span key={index}>
              {index > 0 ? " · " : ""}
              {time.label} · {view.formatTime(time.value)}
            </span>
          ))}
          {view.task.kind!=='consultation'&&<span className="crm-work-muted"></span>}
          {view.task.kind!=='consultation'&&["overdue", "review"].includes(view.tone) && (
            <span data-tone={view.tone}> · {view.status}</span>
          )}
        </span>
      )}
      </span>
      <button type="button" className="crm-work-link" onClick={onOpen}>
        {(lang==='zh'?'查看跟进':lang==='id'?'Lihat tindak lanjut':'View follow-up')}
        {summary.next ? ` (${summary.additionalCount + 1})` : ""}
      </button>
    </div>
  );
}
