import {contactPaused,needsTaskPlanning} from "./crmContact";
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
export function pendingFollowUps(tasks: FollowUpTask[], stage?: string, now=Date.now(), timezone="Asia/Jakarta"): FollowUpTask[] {
  const pending = tasks.filter((task) =>
    ["open", "overdue", "migration_hold"].includes(task.status) &&
      !(task.status === "migration_hold" && ["Enrolled", "Lost"].includes(stage || "")),
  );
  return pending.sort((a, b) => {
    // Historical placeholders must never outrank a real, dated task.
    const rank = (task: FollowUpTask) =>
      task.status === "migration_hold"
        ? 2
        : confirmedTaskDeadline(task) === null
          ? 1
          : 0;
    const due=(t:FollowUpTask)=>Math.min(confirmedTaskDeadline(t)??Infinity,Date.parse(t.requestDueAt||'')||Infinity);
    const urgency=(t:FollowUpTask)=>rank(t)>0?4:due(t)<now?0:calendarDay(due(t),timezone)===calendarDay(now,timezone)?1:['handoff','booking','enrollment'].includes(t.kind)?2:3;
    return (
      rank(a) - rank(b) || urgency(a)-urgency(b) ||
      (Math.min(confirmedTaskDeadline(a)??Infinity,Date.parse(a.requestDueAt||'')||Infinity)) - (Math.min(confirmedTaskDeadline(b)??Infinity,Date.parse(b.requestDueAt||'')||Infinity)) ||
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
    consultation: ["First contact attempt", "首次联系尝试"],
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
  lead: Pick<CrmLeadRecord, "attention" | "nextAction" | "owner" | "currentStage">,
  lang: "zh" | "en" | "id",
  timezone: string,
  now = Date.now(),
) {
  const tasks = pendingFollowUps(lead.attention?.tasks ?? [], lead.currentStage,now,timezone);
  return {
    loaded: !!lead.attention,
    next: tasks[0] ? {...describeFollowUpTask(tasks[0], lang, timezone, now),...(contactPaused(lead,now)?{action:(lang==='zh'?'内部核实／复查':lang==='id'?'Tinjauan internal':'Internal review')+' · '+describeFollowUpTask(tasks[0],lang,timezone,now).action}:{})} : null,
    additionalCount: Math.max(0, tasks.length - 1),
    // A lead-level memo is not a task description or proof of a scheduled task.
    note: lead.nextAction?.trim() ?? "",
  };
}
export function emptyFollowUpLabel(lead:any,lang:'en'|'id'|'zh'){
 if(contactPaused(lead))return lang==='zh'?'仅内部核实，勿主动联系':lang==='id'?'Tinjauan internal saja; jangan hubungi secara proaktif':'Internal review only; no proactive contact';
 return '';
}
