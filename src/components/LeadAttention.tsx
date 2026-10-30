import {formatCrmEventTime,viewerTimeZone} from '../utils/crmOperatingTime';
import { crmLocale } from "../utils/crmLanguage";
import { crmId } from "../utils/crmIndonesian";
import type { CrmLeadRecord } from "../types/crmLead";
export function LeadActivity({
  lead,
  lang,
  onOpen,
  timezone,
  readOnly = false,
}: {
  lead: CrmLeadRecord;
  lang: "en" | "zh" | "id";
  onOpen: () => void;
  timezone?: string;
  readOnly?: boolean;
}) {
  const a = lead.attention;
  if (!a?.latest) return null;
  const labels: Record<string, [string, string]> = {
    "lead.created": ["New inquiry", "新咨询"],
    "conversation.updated": ["Customer message", "客户消息"],
    "conversation.reactivated": ["Returning inquiry", "再次咨询"],
    "assessment.completed": ["Assessment completed", "测评完成"],
    "handoff.requested": ["Advisor requested", "请求顾问"],
    "booking.requested": ["Booking requested", "预约请求"],
    "enrollment.requested": ["Enrollment requested", "报名请求"],
    "task.overdue": ["Past overdue event", "历史逾期事件"],
    "ai.failed": ["AI response failed", "AI 回复失败"],
  };
  const label =
    a.latest.source === "crm_assignment"
      ? lang === "id"
        ? crmId("Ownership updated")
        : lang === "zh"
          ? "归属已更新"
          : "Ownership updated"
      : (lang === "id"
          ? crmId(labels[a.latest.type]?.[0])
          : labels[a.latest.type]?.[lang === "zh" ? 1 : 0]) ||
        (lang === "id"
          ? crmId("Customer activity")
          : lang === "zh"
            ? "客户动态"
            : "Customer activity");
  const content=<><span>{label}</span><time title={viewerTimeZone()} className="font-normal" dateTime={a.latest.at}>{formatCrmEventTime(a.latest.at).slice(5,16)}</time></>;
  if(readOnly)return <div className="crm-lead-activity mt-1 flex items-center gap-1 max-w-full">{content}</div>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="crm-lead-activity mt-1 flex items-center gap-1 max-w-full"
      aria-label={label}
    >
      {content}
    </button>
  );
}
