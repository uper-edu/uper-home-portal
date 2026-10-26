import type { ReactNode } from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  presentFollowUpTask,
  type TaskPresentationInput,
} from "../../utils/crmTaskPresentation";
import { contactPaused } from "../../utils/crmContact";
import { crmId } from "../../utils/crmIndonesian";
import type { CrmLanguage } from "../../utils/crmLanguage";

export function CrmTaskCard({
  task,
  lead,
  lang,
  timezone,
  readOnly,
  onProcess,
  onSource,
  menu,
  focused,
  onHistory,
  compact,
  sourceQuote,
  evidence,
}: {
  task: TaskPresentationInput;
  lead: any;
  lang: CrmLanguage;
  timezone: string;
  readOnly?: boolean;
  onProcess?: () => void;
  onSource?: () => void;
  menu?: ReactNode;
  focused?: boolean;
  onHistory?: () => void;
  compact?: boolean;
  sourceQuote?: string;
  evidence?: ReactNode;
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const view = presentFollowUpTask(task, lang, timezone);
  return (
    <article
      id={"crm-followup-task-" + task.id}
      tabIndex={-1}
      className="crm-unified-task"
      data-task-id={task.id}
      data-tone={view.tone}
      data-focused={focused || undefined}
    >
      <div className="crm-unified-task-copy">
        <h4>
          {contactPaused(lead) && task.kind !== "contact_review" && (
            <span>{t("Internal review", "内部核实／复查")} · </span>
          )}
          {view.action}
        </h4>
        {task.details?.purpose && (
          <p className="crm-unified-task-purpose">{task.details.purpose}</p>
        )}
        {view.task.ownerId !== (lead.owner || null) && (
          <p className="crm-work-muted">
            {t("Task owner: ", "任务负责人：")}
            {view.task.ownerId || t("Unassigned", "未分配")}
          </p>
        )}
        {onSource && (
          <button type="button" className="crm-work-link" onClick={onSource}>
            {t("View customer request", "查看客户原话")}
          </button>
        )}
        {sourceQuote && !compact && <blockquote className="crm-task-source-quote">{sourceQuote}</blockquote>}
        {evidence}

        {task.details?.additions?.length ? <details className="crm-task-evidence"><summary>{lang==='zh'?'补充信息':lang==='id'?'Informasi tambahan':'Added information'} ({task.details.additions.length})</summary>{task.details.additions.map(v=><div key={v.id}><p>{v.text}</p><small>{v.actor} · {view.formatTime(v.at)}</small></div>)}</details>:null}
        {task.details?.replaces && <p className="crm-work-muted">{lang==='zh'?'替代原任务；原处理历史保留':lang==='id'?'Menggantikan tugas sebelumnya; riwayat dipertahankan':'Replaces an earlier task; handling history retained'}{task.details.originalMatterDeadline?' · '+view.formatTime(task.details.originalMatterDeadline):''}</p>}
        {task.details?.replacedBy && (
          <p className="crm-work-muted">
            {t("Replaced by a new task", "已由新任务替代")}
          </p>
        )}
      </div>
      <div className="crm-unified-task-schedule">
        <p className="crm-unified-task-state" data-tone={view.tone}>
          {view.status}
        </p>
        <dl className="crm-task-times">
          {view.times.map((time, index) => (
            <div key={index} data-secondary={index > 0 || undefined}>
              <dt>{time.label}</dt>
              <dd data-tone={time.tone}>
                {time.value ? (
                  <time dateTime={time.value}>
                    {view.formatTime(time.value)}
                  </time>
                ) : (
                  view.formatTime(null)
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="crm-unified-task-actions">
        {view.active && onProcess && !readOnly && (
          <button
            type="button"
            className="crm-task-process"
            onClick={onProcess}
          >
            <MessageSquarePlus size={15} aria-hidden="true" />
            {lang === "zh" ? "添加进展" : lang === "id" ? "Tambah progres" : "Add progress"}
          </button>
        )}
        {!view.active && onHistory && (
          <button type="button" className="crm-work-link" onClick={onHistory}>
            {t("View handling history", "查看处理记录")}
          </button>
        )}
        {menu}
      </div>
    </article>
  );
}
