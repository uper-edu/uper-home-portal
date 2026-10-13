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
