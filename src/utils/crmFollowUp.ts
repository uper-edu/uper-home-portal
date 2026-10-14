import {contactPaused} from "./crmContact";
import { crmId } from "./crmIndonesian";
import type { CrmLeadRecord, LeadAttention } from "../types/crmLead";
import { calendarDay } from "./crmLeadFilters";
import { formatCrmOperatingTime } from "./crmOperatingTime";
export type FollowUpTask = LeadAttention["tasks"][number];
export function confirmedTaskDeadline(task: FollowUpTask): number | null {
  if (task.status === "migration_hold") return null;
  const value = Date.parse(task.dueAt);
  return Number.isFinite(value) && value > 0 ? value : null;
}
export function pendingFollowUps(tasks: FollowUpTask[]): FollowUpTask[] {
  const pending = tasks.filter((task) =>
    ["open", "overdue", "migration_hold"].includes(task.status),
  );
  return pending.sort((a, b) => {
    // Historical placeholders must never outrank a real, dated task.
    const rank = (task: FollowUpTask) =>
      task.status === "migration_hold"
        ? 2
        : confirmedTaskDeadline(task) === null
          ? 1
          : 0;
    return (
      rank(a) - rank(b) ||
      (confirmedTaskDeadline(a) ?? 0) - (confirmedTaskDeadline(b) ?? 0) ||
      a.id.localeCompare(b.id)
    );
  });
}
export function describeFollowUpTask(
  task: FollowUpTask,
  lang: "zh" | "en" | "id",
  timezone: string,
  now = Date.now(),
) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const actions: Record<string, [string, string]> = {
    contact_review: ["Internal contact review", "内部联系复查"],
    consultation: ["Contact and qualify", "联系客户并确认需求"],
    handoff: ["Arrange advisor contact", "安排顾问联系"],
    booking: ["Confirm booking", "确认预约安排"],
    enrollment: ["Follow up enrollment", "跟进报名意向"],
    follow_up: ["Follow up with customer", "联系客户跟进"],
  };
  const deadline = confirmedTaskDeadline(task);
  const overdue = deadline !== null && deadline < now;
  const today =
    deadline !== null &&
    calendarDay(deadline, timezone) === calendarDay(now, timezone);
  const date =
    deadline === null
      ? ""
      : formatCrmOperatingTime(task.dueAt, timezone).slice(0, 16);
  const timing =
    task.status === "migration_hold"
      ? t("Historical task: review required", "历史待办待确认")
      : deadline === null
        ? t("Deadline pending review", "截止时间待确认")
        : overdue
          ? t(`Overdue · Due ${date}`, `已逾期 · 截止 ${date}`)
          : today
            ? t(`Due today ${date.slice(11)}`, `今天 ${date.slice(11)} 到期`)
            : t(`Due ${date}`, `截止 ${date}`);
  return {
    task,
    action:
      (task as any).details?.action || ((lang === "id"
        ? crmId(actions[task.kind]?.[0])
        : actions[task.kind]?.[lang === "zh" ? 1 : 0]) ??
      t("Follow up with customer", "联系客户跟进")),
    timing,
    deadline,
    tone: overdue
      ? "overdue"
      : task.status === "migration_hold" || deadline === null
        ? "review"
        : today
          ? "today"
          : "normal",
  };
}
export function leadFollowUp(
  lead: Pick<CrmLeadRecord, "attention" | "nextAction" | "owner">,
  lang: "zh" | "en" | "id",
  timezone: string,
  now = Date.now(),
) {
  const tasks = pendingFollowUps(lead.attention?.tasks ?? []);
  return {
    loaded: !!lead.attention,
    next: tasks[0] ? {...describeFollowUpTask(tasks[0], lang, timezone, now),...(contactPaused(lead)?{action:(lang==='zh'?'内部核实／复查':lang==='id'?'Tinjauan internal':'Internal review')+' · '+describeFollowUpTask(tasks[0],lang,timezone,now).action}:{})} : null,
    additionalCount: Math.max(0, tasks.length - 1),
    // A lead-level memo is not a task description or proof of a scheduled task.
    note: lead.nextAction?.trim() ?? "",
  };
}
export function emptyFollowUpLabel(lead:any,lang:'en'|'id'|'zh'){
 const t=(en:string,zh:string)=>lang==='id'?crmId(en):lang==='zh'?zh:en;
 if(['Enrolled','Lost'].includes(lead.currentStage))return t('No unfinished follow-up','无未完成跟进事项');
 if(lead.followUpDisposition?.kind==='none')return t('No next step planned','暂不安排')+' · '+lead.followUpDisposition.reason;
 return t('Next step not scheduled','未安排下一步');
}
