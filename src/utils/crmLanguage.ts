import { crmId } from "./crmIndonesian";
import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
export type CrmLanguage = "en" | "zh" | "id";
export const crmLocale = (lang: CrmLanguage) =>
  lang === "id" ? "id-ID" : lang === "zh" ? "zh-CN" : "en-GB";
export function readAdminLanguage(): CrmLanguage {
  const stored = safeStorage.getItem("uper_admin_lang") || safeStorage.getItem("uper_crm_lang") || safeStorage.getItem("uper_cms_lang");
  return stored === "zh" || stored === "id" ? stored : "en";
}
export function useCrmLanguage() {
  const [lang, setState] = useState<CrmLanguage>(readAdminLanguage);
  const setLang = (value: CrmLanguage) => {
    setState(value);
    safeStorage.setItem("uper_admin_lang", value);
    // Keep the existing CRM preference key for callers outside the workspaces.
    safeStorage.setItem("uper_crm_lang", value);
    window.dispatchEvent(new Event("uper-admin-preferences"));
  };
  useEffect(() => {
    const update = () => setState(readAdminLanguage());
    window.addEventListener("storage", update);
    window.addEventListener("uper-admin-preferences", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("uper-admin-preferences", update); };
  }, []);
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    return () => { document.documentElement.lang = previous; };
  }, [lang]);
  return [lang, setLang] as const;
}
const values: Record<string, [string, string]> = {
  inapp: ["In-app notification", "站内通知"],
  lark: ["Lark", "Lark"],
  sms: ["SMS", "短信"],
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
  if(value==='contact_form')return lang==='zh'?'联系表单':lang==='id'?'Formulir kontak':'Contact form';
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
    "Confirm routing review before enabling": ["Confirm routing review before enabling", "请先确认历史通知范围复核，再启用策略"],
    "Retired team filters require explicit review": ["Retired team filters require explicit review", "历史团队过滤条件须先明确复核"],
    "Choose a valid campaign": ["Choose a valid campaign", "请选择有效活动"],
    "Choose participation mode and enter evidence": ["Choose participation mode and enter evidence", "请选择参与方式并填写确认依据"],
    "Attendance request conflict": ["Attendance request conflict", "该提交已被使用，请核对参与记录后重新提交"],
    "Follow-up summary required": ["Enter follow-up notes", "请填写沟通或处理记录"],
 "Save outcome unknown; retry unchanged draft":["Save outcome unknown; retry unchanged draft","保存结果尚未确认，请保留原内容重试"],
 "Contact arrangement reason required":["Contact arrangement reason required","请填写联系安排原因"],
 "Contact arrangement changed; refresh and review":["Contact arrangement changed; refresh and review","联系安排已变化，请刷新核对"],
 "Future review time required":["Future review time required","请选择未来复查时间"],
 "Choose a contact arrangement":["Choose a contact arrangement","请选择等待、培育或停止联系安排"],
 "Invalid communication language":["Invalid communication language","沟通语言无效"],
    "Sales operations configuration required":["Sales operations configuration required","请提供销售运营配置"],
    "Follow-up service unavailable":["Follow-up service unavailable","跟进保存服务暂不可用，请重试"],
    "Invalid buying signal":["Invalid buying signal","购买信号无效"],
    "Owner cannot access and follow up this customer":["Owner cannot access and follow up this customer","该负责人无法在授权范围内查看及跟进此客户"],
    "Invalid sales stage":["Invalid sales stage","销售阶段无效"],
    "Invalid contact channel":["Invalid contact channel","联系渠道无效"],
    "Refresh CRM and use the updated follow-up form": ["Refresh CRM and use the updated follow-up form", "请刷新 CRM 并使用新版跟进表单"],
    "Invalid task selection": ["Invalid task selection", "任务选择无效"],
    "Choose a contact result": ["Choose a contact result", "请选择联系结果"],
    "Choose the next arrangement": ["Choose the next arrangement", "请选择后续安排"],
    "Explain why no next step is planned": ["Explain why no next step is planned", "请说明暂不安排的原因"],
    "Enter an action, purpose and future time with timezone": ["Enter an action, purpose and future time with timezone", "请填写动作、依据和带时区的未来时间"],
    "Follow-up request conflict": ["Follow-up request conflict", "该提交已被使用，请刷新核对"],
    "Selected task changed; refresh and review": ["Selected task changed; refresh and review", "任务状态已变化，请刷新核对"],
    "Only a closed customer can omit the next arrangement": ["Only a closed customer can omit the next arrangement", "仅已成交或关闭客户可省略后续安排"],
    "Keep at least one valid task": ["Keep at least one valid task", "须保留至少一个有效任务"],
    "Existing follow-up task must be retained or completed first": ["Existing follow-up task must be retained or completed first", "请先保留或明确完成已有跟进任务"],
    "Source message unavailable": ["Source message unavailable", "关联消息不可用"],
    "Login required": ["Please sign in.", "请先登录。"],
    "Education platform authentication required": [
      "Please sign in.",
      "请先登录。",
    ],
    "Invalid login ID, email or password": ["Invalid login ID, email or password", "登录ID、邮箱或密码不正确"],
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
  const known: Record<string, [string, string]> = {
    "Confirm routing review before enabling": ["Confirm routing review before enabling", "请先确认历史通知范围复核，再启用策略"],
    "Retired team filters require explicit review": ["Retired team filters require explicit review", "历史团队过滤条件须先明确复核"],
 "Contact arrangement reason required":["Contact arrangement reason required","请填写联系安排原因"],
 "Contact arrangement changed; refresh and review":["Contact arrangement changed; refresh and review","联系安排已变化，请刷新核对"],
 "Future review time required":["Future review time required","请选择未来复查时间"],
 "Choose a contact arrangement":["Choose a contact arrangement","请选择等待、培育或停止联系安排"],
 "Invalid communication language":["Invalid communication language","沟通语言无效"],
    "Follow-up service unavailable":["Follow-up service unavailable","跟进保存服务暂不可用，请重试"],
    "Invalid buying signal":["Invalid buying signal","购买信号无效"],
    "Invalid sales stage":["Invalid sales stage","销售阶段无效"],
    "Invalid contact channel":["Invalid contact channel","联系渠道无效"],
    "Refresh CRM and use the updated follow-up form": ["Refresh CRM and use the updated follow-up form", "请刷新 CRM 并使用新版跟进表单"],
    "Invalid task selection": ["Invalid task selection", "任务选择无效"],
    "Choose a contact result": ["Choose a contact result", "请选择联系结果"],
    "Choose the next arrangement": ["Choose the next arrangement", "请选择后续安排"],
    "Explain why no next step is planned": ["Explain why no next step is planned", "请说明暂不安排的原因"],
    "Enter an action, purpose and future time with timezone": ["Enter an action, purpose and future time with timezone", "请填写动作、依据和带时区的未来时间"],
    "Follow-up request conflict": ["Follow-up request conflict", "该提交已被使用，请刷新核对"],
    "Selected task changed; refresh and review": ["Selected task changed; refresh and review", "任务状态已变化，请刷新核对"],
    "Only a closed customer can omit the next arrangement": ["Only a closed customer can omit the next arrangement", "仅已成交或关闭客户可省略后续安排"],
    "Keep at least one valid task": ["Keep at least one valid task", "须保留至少一个有效任务"],
    "Existing follow-up task must be retained or completed first": ["Existing follow-up task must be retained or completed first", "请先保留或明确完成已有跟进任务"],
    "Source message unavailable": ["Source message unavailable", "关联消息不可用"],
    "Group hourly limit reached": [
      "Group hourly limit reached; delivery deferred.",
      "达到群每小时发送上限，已顺延。",
    ],
    "Recipient changed or no longer authorized": [
      "Recipient changed or no longer authorized.",
      "接收人已变更或失去访问权限。",
    ],
    "Task completed": ["Follow-up task completed.", "跟进任务已完成。"],
    "Lease expired": ["Task lease expired.", "任务领取租约已过期。"],
    "Missing notification channel":["Missing notification channel","通知渠道不存在，请修复配置"],
    "No live channel configured": [
      "No live channel configured; delivery simulated.",
      "没有启用真实发送渠道，本次为模拟发送。",
    ],
  };
  const summaries: Record<string, [string, string]> = {
    accepted: [
      "API accepted; this does not mean read or followed up.",
      "接口已接受；不代表员工已读或已跟进。",
    ],
    simulated: [
      "Simulation completed; no message sent.",
      "模拟完成，未实际发送。",
    ],
    failed: [
      "Delivery failed; original receipt recorded.",
      "发送失败，原始回执已记录。",
    ],
    unknown: [
      "Delivery outcome unknown; manual review required.",
      "结果未知，需要人工核查。",
    ],
    cancelled: ["Notification cancelled.", "本次通知已取消。"],
    pending: [
      "Awaiting delivery; execution details recorded.",
      "等待发送，执行详情已记录。",
    ],
    sending: ["Sending.", "正在发送。"],
  };
  // Vendor receipts can be in any language. Keep them in the explicitly labelled
  // original-receipt disclosure, rather than leaking them into system summaries.
  const text = known[result] ||
    summaries[state] || ["Delivery result recorded.", "执行结果已记录。"];
  return lang === "id" ? crmId(text[0]) : text[lang === "zh" ? 1 : 0];
}
