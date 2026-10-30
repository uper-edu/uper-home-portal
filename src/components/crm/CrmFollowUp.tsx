import {CrmFirstContactCountdown} from './CrmFirstContactCountdown';
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { crmId } from "../../utils/crmIndonesian";
import React from "react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { leadFollowUp, emptyFollowUpLabel } from "../../utils/crmFollowUp";
export function CrmFollowUp({
  lead,
  lang,
  timezone,
  isLight,
  employees,
  onOpen,
  now,
  compact = false,
  hideStoppedNotice = false,
  readOnly = false,
}: {
  lead: CrmLeadRecord;
  lang: "zh" | "en" | "id";
  timezone: string;
  isLight: boolean;
  employees: Array<{
    id: string;
    displayName?: string;
  }>;
  onOpen: () => void;
  now?: number;
  compact?: boolean;
  hideStoppedNotice?: boolean;
  readOnly?: boolean;
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const emptyLabel=hideStoppedNotice&&lead.contactArrangement?.state==='stopped'?'':emptyFollowUpLabel(lead,lang);
  const summary = leadFollowUp(lead, lang, timezone, now);
  const task = summary.next?.task;
  const taskView = task && presentFollowUpTask(task, lang, timezone, now);
  const inlineFirst=task?.kind==='consultation'&&task.status!=='migration_hold'&&summary.next?.deadline!==null;
  const taskOwner = task?.ownerId;
  const ownerName =
    employees.find((person) => person.id === taskOwner)?.displayName ||
    taskOwner;
  if(summary.loaded&&!summary.next&&!summary.note&&!emptyLabel)return null;
  return (
    <div className="crm-followup" data-theme={isLight ? "light" : "dark"}>
      {summary.next ? (
        <>
          <div className={inlineFirst?"crm-first-contact-line":undefined}>
          <div className="crm-followup-action">{summary.next.action}</div>
          {inlineFirst&&<span aria-hidden="true" className="crm-first-contact-dot">·</span>}
          <div
            className="crm-followup-timing"
            data-tone={summary.next.tone}
            title={summary.next.deadline === null ? undefined : timezone}
          >
            {(task?.kind!=='consultation'||task.status==='migration_hold'||summary.next.deadline===null) && taskView &&
              ["overdue", "today", "review"].includes(taskView.tone) && (
                <div>{taskView.status}</div>
              )}
            {task?.kind==='consultation'&&task.status!=='migration_hold'&&summary.next.deadline!==null?<CrmFirstContactCountdown dueAt={task.dueAt} lang={lang}/>:taskView?.times.map((time, index) => (
              <div key={index} data-tone={time.tone}>
                {time.label} ·{" "}
                {time.value ? (
                  <time dateTime={time.value}>
                    {taskView.formatTime(time.value)}
                  </time>
                ) : (
                  taskView.formatTime(null)
                )}
              </div>
            ))}
          </div>
          </div>
          {taskOwner !== (lead.owner || null) && (
            <div className="crm-followup-secondary">
              {t("Task owner: ", "任务负责人：")}
              {ownerName || t("Unassigned", "未分配")}
            </div>
          )}
        </>
      ) : (
        <div className="crm-followup-secondary">
          {summary.loaded
            ? emptyLabel
            : t("Follow-up information unavailable", "跟进信息暂不可用")}
        </div>
      )}
      {summary.note && compact && readOnly ? (
        <div className="crm-followup-secondary">{t("Manual note available", "有人工备注")}</div>
      ) : summary.note && compact ? (
        <button
          type="button"
          className="crm-followup-more"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {t("Manual note available", "有人工备注")}
        </button>
      ) : (
        summary.note && (
          <div className="crm-followup-note" title={summary.note}>
            <span className="crm-followup-secondary">
              {t("Note: ", "跟进备注：")}
            </span>
            {summary.note}
          </div>
        )
      )}
      {summary.additionalCount > 0 && (readOnly ? <div className="crm-followup-secondary">{lang === "id" ? `+${summary.additionalCount} tugas lainnya` : t(`+${summary.additionalCount} more ${summary.additionalCount === 1 ? "task" : "tasks"}`,`另有 ${summary.additionalCount} 项`)}</div> : (
        <button
          type="button"
          className="crm-followup-more"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {lang === "id"
            ? `+${summary.additionalCount} tugas lainnya`
            : t(
                `+${summary.additionalCount} more ${summary.additionalCount === 1 ? "task" : "tasks"}`,
                `另有 ${summary.additionalCount} 项`,
              )}
        </button>
      ))}
    </div>
  );
}
