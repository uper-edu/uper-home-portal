import { crmId } from "../../utils/crmIndonesian";
import React from "react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { leadFollowUp } from "../../utils/crmFollowUp";
export function CrmFollowUp({
  lead,
  lang,
  timezone,
  isLight,
  employees,
  onOpen,
  now,
  compact = false,
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
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const summary = leadFollowUp(lead, lang, timezone, now);
  const task = summary.next?.task;
  const taskOwner = task?.ownerId;
  const ownerName =
    employees.find((person) => person.id === taskOwner)?.displayName ||
    taskOwner;
  return (
    <div className="crm-followup" data-theme={isLight ? "light" : "dark"}>
      {summary.next ? (
        <>
          <div className="crm-followup-action">{summary.next.action}</div>
          <div
            className="crm-followup-timing"
            data-tone={summary.next.tone}
            title={summary.next.deadline === null ? undefined : timezone}
          >
            {summary.next.deadline === null ? (
              summary.next.timing
            ) : (
              <time dateTime={task!.dueAt}>{summary.next.timing}</time>
            )}
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
            ? t("No open tasks", "暂无待办")
            : t("Follow-up unavailable", "跟进信息暂不可用")}
        </div>
      )}
      {summary.note && compact ? (
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
      {summary.additionalCount > 0 && (
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
      )}
    </div>
  );
}
