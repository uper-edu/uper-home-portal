import { crmId } from "./crmIndonesian";
import type { CrmLeadRecord } from "../types/crmLead";
import { crmAssessmentSummary } from "./crmAssessment";
import { crmValue, type CrmLanguage } from "./crmLanguage";
export type CustomerView = "worklist" | "table";
export type CustomerTab =
  "activities" | "chat" | "profile" | "assessment" | "playbook";
export const customerFields = [
  ["number", "Lead number", "客户编号"],
  ["name", "Name", "姓名"],
  ["owner", "Owner", "负责人"],
  ["registered", "Registered", "登记时间"],
  ["identity", "Customer identity", "客户身份"],
  ["phone", "WhatsApp", "WhatsApp"],
  ["email", "Email", "电子邮件"],
  ["city", "City", "城市"],
  ["mode", "Learning format", "授课方式"],
  ["goal", "Learning goal", "学习目标"],
  ["assessment", "Assessment", "测评结果"],
  ["group", "Customer group", "客户分组"],
  ["stage", "Sales stage", "销售阶段"],
  ["signal", "Buying signals", "购买信号"],
  ["contact", "Contact result", "联系结果"],
  ["touches", "Contact count", "联系次数"],
  ["lastContact", "Last contact", "最近联系"],
  ["followup", "Follow-up", "跟进安排"],
  ["source", "First source", "首次来源"],
  ["campaign", "Campaign", "营销活动"],
  ["outcome", "Outcome", "业务结果"],
] as const;
export type CustomerField = (typeof customerFields)[number][0];
export const defaultCustomerFields: CustomerField[] = [
  "number",
  "name",
  "owner",
  "goal",
  "assessment",
  "group",
  "stage",
  "followup",
];
export function validCustomerFields(value: unknown): CustomerField[] {
  if (!Array.isArray(value)) return [...defaultCustomerFields];
  const selected = customerFields
    .map((f) => f[0])
    .filter((f) => value.includes(f));
  // The record remains identifiable even after old/invalid saved preferences.
  return selected.length
    ? [...new Set<CustomerField>(["number", "name", ...selected])]
    : [...defaultCustomerFields];
}
export function buyingSignals(lead: CrmLeadRecord) {
  return [
    ...new Set(
      [...(lead.buyingSignals || []), lead.buyingSignal].filter(
        (s) => s && s !== "None yet",
      ),
    ),
  ];
}
export function workspaceAssessment(lead: CrmLeadRecord, lang: CrmLanguage) {
  const summary = crmAssessmentSummary(lead, lang);
  // The existing evidence-based presenter owns the conclusion and provenance.
  // Omit score detail in the scanning view, without interpreting or regrading it.
  return { ...summary, source: summary.detail.split(" · ")[0] };
}
export function customerCity(city: string | undefined, lang: CrmLanguage) {
  if (city === "Jakarta")
    return lang === "id"
      ? crmId("Jakarta")
      : lang === "zh"
        ? "雅加达"
        : "Jakarta";
  return city
    ? crmValue(city, lang)
    : lang === "id"
      ? crmId("Not provided")
      : lang === "zh"
        ? "未填写"
        : "Not provided";
}
export function customerOutcome(
  outcome: string | undefined,
  lang: CrmLanguage,
) {
  if (outcome === "Paid")
    return lang === "id" ? crmId("Paid") : lang === "zh" ? "已付款" : "Paid";
  if (outcome === "Hold")
    return lang === "id"
      ? crmId("On hold")
      : lang === "zh"
        ? "暂缓"
        : "On hold";
  return crmValue(outcome, lang);
}
