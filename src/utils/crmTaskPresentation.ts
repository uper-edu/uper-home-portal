import {
  describeFollowUpTask,
  confirmedTaskDeadline,
  pendingFollowUps,
} from "./crmFollowUp";
import { formatCrmOperatingTime } from "./crmOperatingTime";
import { crmId } from "./crmIndonesian";
import type { CrmLanguage } from "./crmLanguage";

export type TaskPresentationInput = {
  id: string;
  kind: string;
  status: string;
  owner_id?: string | null;
  ownerId?: string | null;
  due_at?: string;
  dueAt?: string;
  original_due_at?: string;
  originalDueAt?: string;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
  timing_kind?: string;
  timingKind?: string;
  details?: {
    action?: string;
    purpose?: string;
    sourceMessageId?: string;
    sourceConversationId?: string;
    replacedBy?: string;
  };
};
export function normalizeFollowUpTask(task: TaskPresentationInput) {
  return {
    ...task,
    ownerId: task.owner_id ?? task.ownerId ?? null,
    dueAt: task.due_at || task.dueAt || "",
    originalDueAt: task.original_due_at || task.originalDueAt,
    scheduledAt: task.scheduled_at || task.scheduledAt,
    timingKind:
      task.kind === "contact_review"
        ? "review"
        : task.timing_kind || task.timingKind || "response",
  };
}
/** Match the existing server attention scope, including its closed-customer hold exclusion. */
export function projectPendingTasks(
  tasks: TaskPresentationInput[],
  stage?: string,
) {
  return pendingFollowUps(tasks.map(normalizeFollowUpTask), stage);
}
/** Presentation only. Due dates still govern existing sorting, SLA and overdue rules.
 * A revised execution time never replaces or erases the saved response deadline. */
export function presentFollowUpTask(
  input: TaskPresentationInput,
  lang: CrmLanguage,
  timezone: string,
  now = Date.now(),
) {
  const task = normalizeFollowUpTask(input),
    display = describeFollowUpTask(task, lang, timezone, now);
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const active = ["open", "overdue"].includes(task.status);
  const timeLabel = (original = false) =>
    task.timingKind === "appointment"
      ? t(
          original ? "Original agreed execution time" : "Agreed execution time",
          original ? "原约定执行时间" : "约定执行时间",
        )
      : task.timingKind === "review"
        ? t(
            original ? "Original review time" : "Internal review time",
            original ? "原复查时间" : "内部复查时间",
          )
        : t(
            original ? "Original response deadline" : "Response deadline",
            original ? "原响应截止" : "响应截止",
          );
  const valid = (value?: string | null) =>
    !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) > 0;
  const times: Array<{ label: string; value: string | null; tone: string }> =
    [];
  const hasDeadline = confirmedTaskDeadline(task) !== null;
  if (hasDeadline && valid(task.scheduledAt))
    times.push({
      label: t("Revised execution time", "改约执行时间"),
      value: task.scheduledAt!,
      tone: "normal",
    });
  times.push({
    label: timeLabel(
      Boolean(valid(task.scheduledAt) && task.timingKind !== "response"),
    ),
    value: hasDeadline ? task.dueAt : null,
    tone: active ? display.tone : "normal",
  });
  if (
    hasDeadline &&
    valid(task.originalDueAt) &&
    Date.parse(task.originalDueAt!) !== Date.parse(task.dueAt)
  )
    times.push({
      label: timeLabel(true),
      value: task.originalDueAt!,
      tone: "normal",
    });
  const status =
    task.status === "completed"
      ? t("Completed", "已完成")
      : task.status === "cancelled"
        ? t("Cancelled", "已取消")
        : task.status === "migration_hold"
          ? t("Historical task: review required", "历史待办待确认")
          : active
            ? display.tone === "overdue"
              ? t("Overdue", "已逾期")
              : display.tone === "today"
                ? t("Due today", "今天到期")
                : t("To do", "待处理")
            : t("Follow-up status unavailable", "跟进状态暂不可用");
  return {
    ...display,
    task,
    active,
    times,
    status,
    tone:
      task.status === "completed"
        ? "complete"
        : active
          ? display.tone
          : task.status === "cancelled"
            ? "normal"
            : "review",
    formatTime: (value: string | null) =>
      value
        ? formatCrmOperatingTime(value, timezone).slice(0, 16)
        : t("Deadline pending review", "截止时间待确认"),
  };
}
