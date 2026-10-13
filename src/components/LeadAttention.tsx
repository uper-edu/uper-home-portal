import {isOverdueTask} from '../utils/crmLeadFilters';
import {crmValue,crmLocale} from '../utils/crmLanguage';
import type { CrmLeadRecord } from "../types/crmLead";
export function LeadActivity({
  lead,
  lang,
  onOpen,
}: {
  lead: CrmLeadRecord;
  lang: "en" | "zh";
  onOpen: () => void;
}) {
  const a = lead.attention;
  if (!a?.latest) return null;
  const labels: Record<string, [string, string]> = {
    "lead.created": ["New inquiry", "新咨询"],
    "conversation.updated": ["New message", "新消息"],
    "conversation.reactivated": ["Returning inquiry", "再次咨询"],
    "assessment.completed": ["Assessment completed", "测评完成"],
    "handoff.requested": ["Advisor requested", "请求顾问"],
    "booking.requested": ["Booking requested", "预约请求"],
    "enrollment.requested": ["Enrollment requested", "报名请求"],
    "task.overdue": ["Follow-up overdue", "跟进逾期"],
    "ai.failed": ["AI response failed", "AI 回复失败"],
  };
  const label = a.latest.source==='crm_assignment' ? (lang==='zh'?'归属已更新':'Ownership updated') :
    labels[a.latest.type]?.[lang === "zh" ? 1 : 0] ||
    (lang === "zh" ? "客户动态" : "Customer activity");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={`mt-1 flex items-center gap-1 text-[10px] max-w-full ${a.unreadCount ? "text-blue-600 dark:text-blue-300 font-semibold" : "text-slate-500 dark:text-slate-400"}`}
      aria-label={`${a.unreadCount ? (lang === "zh" ? "未读" : "Unread") + " · " : ""}${label}`}
    >
      <span>
        {a.unreadCount ? "● " : ""}
        {label}
      </span>
      <time className="font-normal" dateTime={a.latest.at}>
        {new Date(a.latest.at).toLocaleString(
          lang === "zh" ? "zh-CN" : "en-GB",
          {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          },
        )}
      </time>
    </button>
  );
}
export function LeadPendingAction({
  lead,
  lang,
  timezone = "Asia/Jakarta",
}: {
  lead: CrmLeadRecord;
  lang: "en" | "zh";
  timezone?: string;
}) {
  const task = lead.attention?.tasks.find(t=>['open','overdue'].includes(t.status)) || lead.attention?.tasks[0];
  if (!task) return null;
  const overdue = isOverdueTask(task,Date.now());
  const label =
    (
      {
        consultation: ["Consultation", "咨询跟进"],
        handoff: ["Contact requested", "顾问联系"],
        booking: ["Booking", "预约跟进"],
        enrollment: ["Enrollment", "报名跟进"],
      } as Record<string, string[]>
    )[task.kind]?.[lang === "zh" ? 1 : 0] ||
    (lang === "zh" ? "客户跟进" : "Follow-up");
  return (
    <div
      className={`text-[10px] mt-1 ${overdue ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`}
    >
      {overdue ? (lang === "zh" ? "逾期 · " : "Overdue · ") : ""}
      {task.status === "migration_hold"
        ? lang === "zh"
          ? "历史待办待确认 · "
          : "Historical task pending review · "
        : ""}
      {label} · {task.status==='migration_hold' ? (lang==='zh'?'截止时间待确认':'Deadline pending review') : <>{new Date(task.dueAt).toLocaleString(crmLocale(lang),{timeZone:timezone})} ({timezone})</>}
      <span className="block">
        {task.ownerId || (lang === "zh" ? "待分配" : "Unassigned")}
      </span>
    </div>
  );
}
