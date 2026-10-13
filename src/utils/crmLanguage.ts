import { crmId } from "./crmIndonesian";
import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
export type CrmLanguage = "en" | "zh" | "id";
export const crmLocale = (lang: CrmLanguage) =>
  lang === "id" ? "id-ID" : lang === "zh" ? "zh-CN" : "en-GB";
export function useCrmLanguage() {
  const [lang, setState] = useState<CrmLanguage>(() => {
    const stored = safeStorage.getItem("uper_crm_lang");
    return stored === "zh" || stored === "id" ? stored : "en";
  });
  const setLang = (value: CrmLanguage) => {
    setState(value);
    safeStorage.setItem("uper_crm_lang", value);
  };
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang =
      lang === "id" ? "id" : lang === "zh" ? "zh-CN" : "en";
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);
  return [lang, setLang] as const;
}
const values: Record<string, [string, string]> = {
  minutes: ["minutes", "分钟"],
  hours: ["hours", "小时"],
  days: ["days", "天"],
  homepage_widget: ["Homepage assistant", "主页助手"],
  homepage_floating_chatbot: ["Homepage assistant", "主页助手"],
  standalone_chat: ["Consultation page", "独立咨询页"],
  legacy_unknown: ["Historical source unknown", "历史来源未知"],
  mbti_test: ["Personality assessment", "性格测评"],
  download_guide: ["Guide download", "资料下载"],
  campus_career_talk: ["Campus career talk", "校园职业讲座"],
  school_talk: ["School talk", "学校讲座"],
  paid_social: ["Paid social ads", "社交平台广告"],
  organic_dm: ["Direct social message", "社交平台私信"],
  website: ["Website", "官网"],
  expo: ["Exhibition", "展会"],
  "Asked price": ["Asked price", "咨询价格"],
  "Asked schedule": ["Asked schedule", "询问开班时间"],
  "Asked payment": ["Asked payment", "咨询付款方案"],
  "Ready to enroll": ["Ready to enroll", "准备报名"],
  "Ready to enrol": ["Ready to enrol", "准备报名"],
  Hot: ["Hot", "高意向"],
  "Warm-Offline": ["Warm · On campus", "中意向 · 线下"],
  "Warm-Online": ["Warm · Online", "中意向 · 线上"],
  School: ["School", "院校合作"],
  "Cold-Nurture": ["Cold nurture", "培育池"],
  Unqualified: ["Unqualified", "待评估"],
  New: ["New", "待初访"],
  Contacted: ["Contacted", "已建联"],
  "Assessment Booked": ["Assessment booked", "已约测评"],
  "Assessment Done": ["Assessment done", "测评完成"],
  "Trial Booked": ["Trial booked", "已约试听"],
  "Trial Attended": ["Trial attended", "试听出席"],
  Enrolled: ["Enrolled", "已报名"],
  Lost: ["Lost", "已流失"],
  Connected: ["Connected", "已接通"],
  "No Response": ["No response", "未接通"],
  "Wrong Number": ["Wrong number", "号码无效"],
  Interested: ["Interested", "有意向"],
  WhatsApp: ["WhatsApp", "WhatsApp"],
  "Phone Call": ["Phone call", "电话"],
  "Campus Visit": ["Campus visit", "校区面谈"],
  Email: ["Email", "电子邮件"],
  Other: ["Other", "其他"],
  "Working professional": ["Working professional", "在职人士"],
  "Fresh graduate": ["Fresh graduate", "应届毕业生"],
  "University student": ["University student", "大学生"],
  "High school student": ["High school student", "高中生"],
  "Teacher or school staff": ["Teacher or school staff", "教师或学校职员"],
  "Complete beginner": ["Complete beginner", "零基础"],
  Beginner: ["Beginner", "初学者"],
  "Not sure": ["Not sure", "不确定"],
  "Beginner / Not sure": ["Beginner / Not sure", "初学或等级不确定"],
  ZERO: ["Beginner", "零基础"],
  PARTIAL: ["Needs assessment", "待测评"],
  KNOWN: ["Level reported", "已自报等级"],
  ZERO_BASE: ["Beginner", "零基础"],
  Offline: ["On campus", "线下面授"],
  Online: ["Online", "线上直播"],
  "Flexible / Pending": ["Flexible / Pending", "灵活安排／待确认"],
  Unknown: ["Unknown", "未知"],
  "Skip Assessment": ["Skip assessment", "无需测评"],
  "Assessment Needed": ["Assessment needed", "需要测评"],
  consultation: ["Consultation", "咨询跟进"],
  handoff: ["Advisor follow-up", "顾问跟进"],
  booking: ["Booking", "预约跟进"],
  enrollment: ["Enrollment", "报名跟进"],
  new_lead: ["New lead", "新客户跟进"],
  legacy: ["Historical follow-up", "历史跟进"],
  open: ["Open", "待跟进"],
  overdue: ["Overdue", "已逾期"],
  migration_hold: ["Historical task awaiting confirmation", "历史待办待确认"],
  completed: ["Completed", "已完成"],
  "None yet": ["None yet", "暂无"],
  None: ["None", "无"],
  Ready: ["Ready", "已就绪"],
  "Work in China": ["Work in China", "赴华工作"],
  "Study in China or scholarship": [
    "Study in China or scholarship",
    "赴华留学或申请奖学金",
  ],
  "Prepare for HSK certification": [
    "Prepare for HSK certification",
    "准备汉语水平考试",
  ],
  "Improve my Mandarin skills": ["Improve my Mandarin skills", "提升中文能力"],
  "Work at a Chinese or China-Indonesia joint venture company in Indonesia": [
    "Work at a Chinese or China-Indonesia joint venture company in Indonesia",
    "在印尼中资或合资企业工作",
  ],
  campus_offline: ["Campus event", "校园活动"],
  enterprise_offline: ["Enterprise event", "企业活动"],
  edufair: ["Education fair", "教育展会"],
  cpc: ["Paid clicks", "按点击付费"],
  social: ["Social media", "社交媒体"],
  qr_poster: ["QR poster", "二维码海报"],
  flyer: ["Flyer", "传单"],
  email: ["Email", "电子邮件"],
  referral: ["Referral", "转介绍"],
  hsk_assessment: ["HSK assessment", "汉语水平测评"],
  trial_class: ["Trial class", "试听体验课"],
  scholarship_materials: ["Scholarship materials", "奖学金资料"],
  webinar: ["Webinar", "在线讲座"],
  ingestion: ["Ingestion", "来源"],
  profile: ["Profile", "客户画像"],
  academic: ["Assessment", "测评定级"],
  cadence: ["Follow-up rules", "跟进规则"],
  touch: ["Logs and outcomes", "跟进与转化"],
};
// Only call this for system enums/labels, never names or customer free text.
export function crmValue(value: string | null | undefined, lang: CrmLanguage) {
  if (!value) return "—";
  const found = values[value];
  return found
    ? lang === "id"
      ? crmId(found[0])
      : found[lang === "zh" ? 1 : 0]
    : value;
}
export function crmError(message: string, lang: CrmLanguage) {
  const known: Record<string, [string, string]> = {
    "Login required": ["Please sign in.", "请先登录。"],
    "Education platform authentication required": [
      "Please sign in.",
      "请先登录。",
    ],
    "Invalid login ID or password": [
      "Invalid login ID or password.",
      "登录账号或密码错误。",
    ],
    "Too many failed attempts; retry later": [
      "Too many failed attempts. Please try later.",
      "失败次数过多，请稍后重试。",
    ],
    "Current password is incorrect": [
      "Current password is incorrect.",
      "当前密码错误。",
    ],
    "New password must contain 8–200 characters": [
      "New password must contain 8–200 characters.",
      "新密码须为 8 至 200 个字符。",
    ],
    "Authentication service unavailable": [
      "Authentication service unavailable. Please try later.",
      "登录服务暂不可用，请稍后重试。",
    ],
    "Permission denied": [
      "You do not have permission for this action.",
      "你没有执行此操作的权限。",
    ],
    "Lead not found": [
      "This lead is unavailable. Refresh the list.",
      "此客户不可访问，请刷新列表。",
    ],
    "Lead has already been assigned; refresh the list": [
      "This lead has already been assigned. Refresh the list.",
      "此客户已被认领或分配，请刷新列表。",
    ],
    "Failed to fetch": [
      "Connection failed. Please retry.",
      "连接失败，请重试。",
    ],
  };
  const found = known[message];
  if (found)
    return lang === "id" ? crmId(found[0]) : found[lang === "zh" ? 1 : 0];
  return lang === "id"
    ? "Permintaan gagal. Silakan coba lagi atau hubungi administrator."
    : lang === "zh"
      ? "操作未成功，请重试或联系管理员。"
      : /[\u4e00-\u9fff]/.test(message)
        ? "The request failed. Please retry or contact an administrator."
        : message;
}
export function crmDeliveryResult(
  result: string,
  state: string,
  lang: CrmLanguage,
) {
  if (lang === "id") return crmId(result || "Delivery result recorded.");
  if (lang === "en") return result;
  const known: Record<string, string> = {
    "Group hourly limit reached": "达到群每小时发送上限，已顺延。",
    "Recipient changed or no longer authorized": "接收人已变更或失去访问权限。",
    "Task completed": "跟进任务已完成。",
    "Lease expired": "任务领取租约已过期。",
    "No live channel configured": "没有启用真实发送渠道，本次为模拟发送。",
  };
  return (
    known[result] ||
    (
      {
        accepted: "接口已接受；不代表员工已读或已跟进。",
        simulated: "模拟完成，未实际发送。",
        failed: "发送失败，原始回执已记录。",
        unknown: "结果未知，需要人工核查。",
        cancelled: "本次通知已取消。",
        pending: "等待发送，执行详情已记录。",
        sending: "正在发送。",
      } as Record<string, string>
    )[state] ||
    "执行结果已记录。"
  );
}
