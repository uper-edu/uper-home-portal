import {useCrmShellHeight} from "./CrmDetailWorkspace";
import { worklistSignal, evidenceForLead, buyingEvidenceLabel, evidenceHeading } from "../../utils/crmBuyingEvidence";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmId } from "../../utils/crmIndonesian";
import React, { useEffect, useRef, useState } from "react";
import { Search,PanelLeftClose,PanelLeftOpen,PanelRightOpen } from "lucide-react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { crmValue, type CrmLanguage } from "../../utils/crmLanguage";
import { leadDisplayNumber } from "../../utils/leadNumber";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import { safeStorage } from "../../utils/safeStorage";
import {
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
  loadUnavailable?: boolean;
  employeeId: string;
  employees: Array<{
    id: string;
    displayName?: string;
  }>;
  onSignal?: (lead:CrmLeadRecord,id:string)=>void;
  onClaim?: (lead:CrmLeadRecord)=>void;
  canClaim?: (lead:CrmLeadRecord)=>boolean;
  onProcess?: (lead:CrmLeadRecord)=>void;
  canProcess?: (lead:CrmLeadRecord)=>boolean;
  onOpen: (lead: CrmLeadRecord, tab?: CustomerTab) => void;
  onReset: () => void;
  sidebarFilters?: React.ReactNode;
  search?:string;
  onSearch?:(value:string)=>void;
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
  loadUnavailable,
  employeeId,
  employees,
  onSignal,onOpen,onClaim,onProcess,canProcess,canClaim,
  onReset,sidebarFilters,search="",onSearch,
  children,
}: LeadWorkspaceProps) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const workspace = useRef<HTMLDivElement>(null);
  const headerHeight=useCrmShellHeight();
  const [collapsed,setCollapsed]=useState(false),[showList,setShowList]=useState(false);
  const listToggle=useRef<HTMLButtonElement>(null);
  const open:typeof onOpen=(lead,tab)=>{setShowList(false);onOpen(lead,tab);};
  const revealList=()=>{setCollapsed(false);setShowList(true);requestAnimationFrame(()=>{workspace.current?.scrollIntoView({block:'start',behavior:'instant'});workspace.current?.querySelector<HTMLElement>('.crm-customer-open[aria-current=true]')?.focus({preventScroll:true});});};
  useEffect(()=>{setShowList(false);},[selectedId]);
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
      onOpen={() => open(lead, "activities")}
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
            onClick={() => open(lead)}
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
          evidenceForLead(lead)
            .map((s) => `${evidenceHeading(s.kind,lang)}: ${buyingEvidenceLabel(s,lang)}`)
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
      className="crm-customer-workspace crm-detail-root"
      data-theme={isLight ? "light" : "dark"}
      data-open={!!children}
      data-list-collapsed={Boolean(children&&collapsed)}
      data-show-list={Boolean(children&&showList)}
      style={
        { "--crm-shell-height": `${headerHeight}px` } as React.CSSProperties
      }
    >
      <div className={`crm-customer-results ${children?'crm-list-shell':''}`}>
        {children&&<div className="crm-workspace-list-heading"><span>{t("Customers","客户")}</span><button className="crm-collapse-list" aria-label={t("Collapse customer list","收起客户列表")} onClick={()=>{setCollapsed(true);requestAnimationFrame(()=>listToggle.current?.focus());}}><PanelLeftClose size={18}/></button></div>}
        {children&&!sidebarFilters&&onSearch&&<div className="crm-workspace-list-search"><Search size={16}/><input aria-label={t("Search customer list","搜索客户侧栏")} placeholder={t("Search customers…","搜索客户…")} value={search} onChange={e=>onSearch(e.target.value)}/></div>}
        {children&&sidebarFilters}
        {children&&selectedId&&!loading&&!leads.some(lead=>lead.id===selectedId)&&<p className="crm-sidebar-selection-note" role="status">{t("Selected customer is outside the current filters. Your open details and draft are retained.","当前客户不在筛选结果中，已打开的详情与草稿保持不变。")}</p>}
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
        ) : loadUnavailable && !leads.length ? (
          <p className="crm-work-empty" role="alert">{lang==='zh'?'客户列表暂不可用，请查看刷新提示并重试。':lang==='id'?'Daftar pelanggan belum tersedia. Periksa pesan pembaruan dan coba lagi.':'Customer list unavailable. Check the refresh message and retry.'}</p>
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
                  signal = worklistSignal(lead);
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
                        open(lead);
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
                        onClick={() => open(lead)}
                      >
                        {lead.fullName || t("Unnamed customer", "未填写姓名")}
                        <PanelRightOpen size={14} />
                      </button>
                      <div className="crm-work-muted">
                        {leadDisplayNumber(lead)} · {owner(lead)}
                      </div>
                      {!lead.owner&&onClaim&&canClaim?.(lead)!==false&&<button type="button" className="crm-work-link" onClick={()=>onClaim(lead)}>{t("Claim for myself","认领给自己")}</button>}
                      <LeadActivity
                        lead={lead}
                        lang={lang}
                        timezone={timezone}
                        onOpen={() =>
                          open(
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
                      <div>{assessment.goal}{(lead.goals||[]).filter(g=>g&&g!==lead.goal).length>0&&<button type="button" className="crm-work-link" onClick={()=>open(lead,"profile")}> · +{(lead.goals||[]).filter(g=>g&&g!==lead.goal).length} {t("Other goals","其他目标")}</button>}</div>
                      <div className="crm-work-muted">
                        {customerCity(lead.city, lang)} ·{" "}
                        {crmValue(lead.mode, lang)}
                      </div>
                      <button
                        type="button"
                        className="crm-work-assessment"
                        onClick={() => open(lead, "assessment")}
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
                      {signal && (
                        <button
                          type="button"
                          className="crm-work-support-link"
                          onClick={() => onSignal ? onSignal(lead,signal.evidence.id) : open(lead, "profile")}
                        >
                          {evidenceHeading(signal.evidence.kind,lang)} · {buyingEvidenceLabel(signal.evidence,lang)}
                          {signal.more > 0 && ` +${signal.more}`}
                        </button>
                      )}
                    </div>
                    <div className="crm-work-next">{follow(lead, true)}<button type="button" className="crm-work-button" data-primary="true" disabled={canProcess?.(lead)===false} onClick={()=>onProcess?onProcess(lead):open(lead,"activities")}>{t("Record result","记录处理结果")}</button></div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      {children&&<div className="crm-lead-detail-column"><div className="crm-workspace-list-access"><button ref={listToggle} className="crm-workspace-toggle" onClick={revealList} aria-expanded={!collapsed}><PanelLeftOpen size={17}/>{lang==='zh'?'显示客户侧栏':lang==='id'?'Tampilkan panel pelanggan':'Show customer sidebar'}</button><button className="crm-workspace-toggle crm-return-selected" onClick={()=>{setShowList(false);requestAnimationFrame(()=>document.querySelector<HTMLElement>('#crm-customer-panel h2')?.focus({preventScroll:true}));}}>{t("Return to selected customer","返回当前客户")}</button></div>{children}</div>}
    </div>
  );
}
