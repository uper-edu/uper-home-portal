import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmId } from "../../utils/crmIndonesian";
import React, { useEffect, useRef, useState } from "react";
import { PanelRightOpen } from "lucide-react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { crmValue, type CrmLanguage } from "../../utils/crmLanguage";
import { leadDisplayNumber } from "../../utils/leadNumber";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import { safeStorage } from "../../utils/safeStorage";
import {
  buyingSignals,
  customerCity,
  customerOutcome,
  customerFields,
  defaultCustomerFields,
  validCustomerFields,
  workspaceAssessment,
  type CustomerView,
  type CustomerField,
  type CustomerTab,
} from "../../utils/crmWorkspace";
import { LeadActivity } from "../LeadAttention";
import { CrmFollowUp } from "./CrmFollowUp";
import { CrmGoalAssessment } from "./CrmGoalAssessment";
export interface LeadWorkspaceProps {
  leads: CrmLeadRecord[];
  selectedId?: string;
  view: CustomerView;
  lang: CrmLanguage;
  isLight: boolean;
  timezone: string;
  loading: boolean;
  employeeId: string;
  employees: Array<{
    id: string;
    displayName?: string;
  }>;
  onClaim?: (lead:CrmLeadRecord)=>void;
  onProcess?: (lead:CrmLeadRecord)=>void;
  canProcess?: (lead:CrmLeadRecord)=>boolean;
  onOpen: (lead: CrmLeadRecord, tab?: CustomerTab) => void;
  onReset: () => void;
  children?: React.ReactNode;
}
export function CrmLeadWorkspace({
  leads,
  selectedId,
  view,
  lang,
  isLight,
  timezone,
  loading,
  employeeId,
  employees,
  onOpen,onClaim,onProcess,canProcess,
  onReset,
  children,
}: LeadWorkspaceProps) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const workspace = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(150);
  const storageKey = `uper_crm_customer_fields_${employeeId}`;
  const [fields, setFields] = useState<CustomerField[]>(() => {
    try {
      return validCustomerFields(
        JSON.parse(safeStorage.getItem(storageKey) || "null"),
      );
    } catch {
      return [...defaultCustomerFields];
    }
  });
  useEffect(() => {
    const header = document.querySelector("[data-crm-header]");
    if (!header) return;
    const measure = () =>
      setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const updateFields = (values: CustomerField[]) => {
    const next = validCustomerFields(values);
    setFields(next);
    safeStorage.setItem(storageKey, JSON.stringify(next));
  };
  const owner = (lead: CrmLeadRecord) =>
    employees.find((e) => e.id === lead.owner)?.displayName ||
    lead.owner ||
    t("Unassigned", "未分配");
  const date = (value?: string) =>
    value && Date.parse(value) > 0
      ? formatCrmOperatingTime(value, timezone)
      : t("Unknown time", "未知时间");
  const follow = (lead: CrmLeadRecord, compact = false) => (
    <CrmFollowUp
      lead={lead}
      lang={lang}
      timezone={timezone}
      isLight={isLight}
      employees={employees}
      onOpen={() => onOpen(lead, "activities")}
      compact={compact}
    />
  );
  const field = (key: CustomerField, lead: CrmLeadRecord): React.ReactNode => {
    switch (key) {
      case "number":
        return leadDisplayNumber(lead);
      case "name":
        return (
          <button
            type="button"
            className="crm-work-link crm-customer-open"
            onClick={() => onOpen(lead)}
          >
            {lead.fullName || t("Unnamed customer", "未填写姓名")}
          </button>
        );
      case "owner":
        return owner(lead);
      case "registered":
        return date(lead.submittedAt);
      case "identity":
        return crmValue(lead.currentStatus, lang);
      case "phone":
        return lead.whatsapp || "—";
      case "email":
        return lead.email || "—";
      case "city":
        return customerCity(lead.city, lang);
      case "mode":
        return crmValue(lead.mode, lang);
      case "goal":
        return crmValue(lead.goal, lang);
      case "assessment":
        return (
          <CrmGoalAssessment
            lead={lead}
            lang={lang}
            isLight={isLight}
            showGoal={false}
          />
        );
      case "group":
        return crmValue(lead.tier, lang);
      case "stage":
        return crmValue(lead.currentStage, lang);
      case "signal":
        return (
          buyingSignals(lead)
            .map((s) => crmValue(s, lang))
            .join(lang === "id" ? crmId(", ") : lang === "zh" ? "、" : ", ") ||
          "—"
        );
      case "contact":
        return lead.connectStatus==="Interested"?t("Historical interest record","历史意向记录"):crmValue(lead.connectStatus, lang);
      case "touches":
        return lead.touchCount ?? 0;
      case "lastContact":
        return lead.lastContactedAt
          ? date(lead.lastContactedAt)
          : t("No contact recorded", "尚无联系记录");
      case "followup":
        return follow(lead);
      case "source":
        return crmValue(lead.entryPoint, lang);
      case "campaign":
        return lead.campaign || "—";
      case "outcome":
        return customerOutcome(lead.outcome, lang);
    }
  };
  // Selection can outlive a filter change (e.g. reading an unread customer).
  // Keep the authorized detail open, without injecting it into filtered results.
  return (
    <div
      ref={workspace}
      className="crm-customer-workspace"
      data-theme={isLight ? "light" : "dark"}
      data-open={!!children}
      style={
        { "--crm-shell-height": `${headerHeight}px` } as React.CSSProperties
      }
    >
      <div className="crm-customer-results">
        {view === "table" && !children && (
          <div className="crm-field-toolbar">
            <span className="crm-work-muted">
              {t("Data table", "字段表")} · {timezone}
            </span>
            <CrmSingleSelect
              label={t("Visible fields", "显示字段")} value="" multiple values={fields}
              options={customerFields.map((field) => ({ value: field[0], label: lang === "id" ? crmId(field[1]) : field[lang === "zh" ? 2 : 1], disabled: field[0] === "name" || field[0] === "number" }))}
              onChange={() => {}} onValuesChange={(values) => updateFields(values as CustomerField[])}
              lang={lang} isLight={isLight} className="min-w-[180px]"
              displayValue={t("Choose fields", "选择字段") + ` (${fields.length})`}
              footer={(close) => <><button type="button" onClick={() => updateFields([...defaultCustomerFields])}>{t("Default fields", "默认字段")}</button><button type="button" onClick={close}>{t("Done", "完成")}</button></>}
            />
          </div>
        )}
        {loading && !leads.length ? (
          <p className="crm-work-empty" role="status">
            {t("Loading customers…", "正在加载客户…")}
          </p>
        ) : !leads.length ? (
          <div className="crm-work-empty">
            <p>
              {t(
                "No customers match the current filters",
                "暂无符合当前筛选条件的客户",
              )}
            </p>
            <button type="button" className="crm-work-link" onClick={onReset}>
              {t("Reset to default view", "恢复默认视图")}
            </button>
          </div>
        ) : view === "table" && !children ? (
          <div
            className="crm-data-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t("Customer data table", "客户字段表")}
          >
            <table className="crm-data-table">
              <thead>
                <tr>
                  {fields.map((k) => (
                    <th scope="col" key={k}>
                      {lang === "id"
                        ? crmId(customerFields.find((f) => f[0] === k)![1])
                        : customerFields.find((f) => f[0] === k)![
                            lang === "zh" ? 2 : 1
                          ]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} data-lead-id={lead.id}>
                    {fields.map((k) => (
                      <td key={k} data-field={k}>
                        {field(k, lead)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="crm-work-head" aria-hidden="true">
              <span>{t("Customer", "客户")}</span>
              <span>{t("Learning needs", "学习需求")}</span>
              <span>{t("Sales progress", "销售进展")}</span>
              <span>{t("Follow-up", "跟进安排")}</span>
            </div>
            <div
              className="crm-work-rows"
              role="list"
              aria-label={t("Customer worklist", "客户工作列表")}
            >
              {leads.map((lead) => {
                const assessment = workspaceAssessment(lead, lang),
                  signals = buyingSignals(lead);
                return (
                  <article
                    className="crm-work-row"
                    role="listitem"
                    key={lead.id}
                    data-lead-id={lead.id}
                    data-selected={lead.id === selectedId}
                    onClick={(e) => {
                      if (
                        !(e.target as HTMLElement).closest(
                          "button,a,input,select",
                        )
                      )
                        onOpen(lead);
                    }}
                  >
                    <div className="crm-work-identity">
                      <button
                        type="button"
                        className="crm-customer-open crm-work-name"
                        aria-label={
                          t("Open customer: ", "打开客户：") + lead.fullName
                        }
                        aria-current={lead.id === selectedId ? true : undefined}
                        onClick={() => onOpen(lead)}
                      >
                        {lead.fullName || t("Unnamed customer", "未填写姓名")}
                        <PanelRightOpen size={14} />
                      </button>
                      <div className="crm-work-muted">
                        {leadDisplayNumber(lead)} · {owner(lead)}
                      </div>
                      {!lead.owner&&onClaim&&<button type="button" className="crm-work-link" onClick={()=>onClaim(lead)}>{t("Claim for myself","认领给自己")}</button>}
                      <LeadActivity
                        lead={lead}
                        lang={lang}
                        timezone={timezone}
                        onOpen={() =>
                          onOpen(
                            lead,
                            [
                              "conversation.updated",
                              "conversation.reactivated",
                              "handoff.requested",
                            ].includes(lead.attention?.latest?.type || "")
                              ? "chat"
                              : "activities",
                          )
                        }
                      />
                    </div>
                    <div className="crm-work-needs">
                      <div>{assessment.goal}{(lead.goals||[]).filter(g=>g&&g!==lead.goal).length>0&&<button type="button" className="crm-work-link" onClick={()=>onOpen(lead,"profile")}> · +{(lead.goals||[]).filter(g=>g&&g!==lead.goal).length} {t("Other goals","其他目标")}</button>}</div>
                      <div className="crm-work-muted">
                        {customerCity(lead.city, lang)} ·{" "}
                        {crmValue(lead.mode, lang)}
                      </div>
                      <button
                        type="button"
                        className="crm-work-assessment"
                        onClick={() => onOpen(lead, "assessment")}
                      >
                        <span>{assessment.source}</span>
                        <span>{assessment.conclusion}</span>
                      </button>
                    </div>
                    <div className="crm-work-progress">
                      <div>{crmValue(lead.currentStage, lang)}</div>
                      <span className="crm-work-group">
                        {crmValue(lead.tier, lang)}
                      </span>
                      {signals.length > 0 && (
                        <button
                          type="button"
                          className="crm-work-support-link"
                          onClick={() => onOpen(lead, "profile")}
                        >
                          {crmValue(signals[0], lang)}
                          {signals.length > 1 && ` +${signals.length - 1}`}
                        </button>
                      )}
                    </div>
                    <div className="crm-work-next">{follow(lead, true)}<button type="button" className="crm-work-button" data-primary="true" disabled={canProcess?.(lead)===false} onClick={()=>onProcess?onProcess(lead):onOpen(lead,"activities")}>{t("Record result","记录处理结果")}</button></div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      {children}
    </div>
  );
}
