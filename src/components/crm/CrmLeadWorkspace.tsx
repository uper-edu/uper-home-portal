import {CrmCurrentSalesState,CrmIdentityStatus} from './CrmCurrentSalesState';
import {CrmIdentityAction} from './CrmIdentityAction';
import {CrmProgressAction} from './CrmProgressAction';
import type {ProgressActionState} from '../../utils/crmProgressAction';
import {CrmSalesStage,CrmStopContact} from './CrmSalesStage';
import {CrmListMilestones} from './CrmListMilestones';
import {listLeadHint,listLearningNeeds,listAssessmentConclusion} from '../../utils/crmLeadPresentation';
import {CrmListAgreements} from './CrmListAgreements';
import {CrmContactResult} from './CrmContactResult';
import {CrmInteractionTimelines} from './CrmInteractionTimelines';
import {containPaneKeys} from '../adminScroll';
import {CrmRecordRow, CrmRecordSearch, CrmRecordSidebar, CrmRecordSidebarToggle} from './CrmRecordWorkspace';
import {useCrmShellHeight,useRecordScrollMode} from "./CrmDetailWorkspace";
import { worklistIntents, visibleIntentEvidence, buyingEvidenceLabel, evidenceHeading } from "../../utils/crmBuyingEvidence";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmId } from "../../utils/crmIndonesian";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { crmValue, type CrmLanguage } from "../../utils/crmLanguage";
import { leadDisplayNumber } from "../../utils/leadNumber";
import { formatCrmOperatingTime,viewerTimeZone,crmInstant } from "../../utils/crmOperatingTime";
import { safeStorage } from "../../utils/safeStorage";
import {
  customerCity,
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
/** Expand only text that actually overflows; no hidden original value is discarded. */
function LearningNeedText({value,lang}:{value:string;lang:CrmLanguage}){
 const ref=useRef<HTMLDivElement>(null),[expanded,setExpanded]=useState(false),[preview,setPreview]=useState<string|null>(null);
 const contentId=React.useId(),more=lang==='zh'?'展开':lang==='id'?'Selengkapnya':'Show more',less=lang==='zh'?'收起':lang==='id'?'Ringkas':'Show less';
 useLayoutEffect(()=>{
  const el=ref.current;if(!el)return;
  const measure=()=>{
   const width=el.getBoundingClientRect().width;if(width<=0)return;
   // Measure a disposable, inaccessible copy; never change the saved original.
   const style=getComputedStyle(el),probe=document.createElement('span');
   Object.assign(probe.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',display:'block',width:width+'px',font:style.font,lineHeight:style.lineHeight,whiteSpace:'pre-wrap',overflowWrap:'anywhere'});
   probe.setAttribute('aria-hidden','true');el.appendChild(probe);
   try{
    const limit=parseFloat(style.lineHeight)*2+1;probe.textContent=value;
    if(probe.getBoundingClientRect().height<=limit){setPreview(null);return;}
    const chars=Array.from(value);let low=0,high=chars.length;
    while(low<high){const mid=Math.ceil((low+high)/2);probe.textContent=chars.slice(0,mid).join('')+'…  '+more;if(probe.getBoundingClientRect().height<=limit)low=mid;else high=mid-1;}
    setPreview(chars.slice(0,low).join('')+'…');
   }finally{probe.remove();}
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();
 },[value,more]);
 return <div ref={ref} className="crm-work-learning-value is-inline"><span id={contentId}>{expanded||preview===null?value:preview}</span>{preview!==null&&<>{' '}<button type="button" className="crm-work-link crm-learning-expand" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpanded(v=>!v)}>{expanded?less:more}</button></>}</div>;
}
function CustomerOpportunities({lead,lang,table=false}:{lead:CrmLeadRecord;lang:CrmLanguage;table?:boolean}){
 const summary=lead.enrollmentOpportunitySummary;
 if(!summary)return table?'—':<CrmSalesStage stage={lead.currentStage} lang={lang}/>;
 if(!summary.count)return table?'0':<span className="crm-work-muted">{lang==='zh'?'暂无进行中商机':lang==='id'?'Belum ada peluang aktif':'No active opportunities'}</span>;
 const list='/crm?'+new URLSearchParams({tab:'opportunities',customerId:lead.id,opportunityOwner:'all'});
 if(!table&&summary.only)return <>
  <a className="crm-work-link" href={list+'&'+new URLSearchParams({opportunity:summary.only.id})}>{summary.only.level}</a>
  <CrmSalesStage stage={summary.only.stage} lang={lang}/>
 </>;
 const label=lang==='zh'?`${summary.count} 笔进行中`:lang==='id'?`${summary.count} berlangsung`:`${summary.count} in progress`;
 return <a className="crm-work-link" href={list} aria-label={label}>{table?summary.count:label}</a>;
}
export interface LeadWorkspaceProps {
  leads: CrmLeadRecord[];
  selectedId?: string;
  view: CustomerView;
  lang: CrmLanguage;
  isLight: boolean;
  timezone: string;
  loading: boolean;
  loadUnavailable?: boolean;
  accessibleCount?:number|null;
  employeeId: string;
  employees: Array<{
    id: string;
    displayName?: string;
  }>;
  onSignal?: (lead:CrmLeadRecord,id:string)=>void;
  onIdentity?: (lead:CrmLeadRecord)=>void;
  onClaim?: (lead:CrmLeadRecord)=>void;
  canClaim?: (lead:CrmLeadRecord)=>boolean;
  onProcess?: (lead:CrmLeadRecord)=>void;
  canProcess?: (lead:CrmLeadRecord)=>boolean;
  progressAction?: (lead:CrmLeadRecord)=>ProgressActionState;
  onOpen: (lead: CrmLeadRecord, tab?: CustomerTab) => void;
  onReset: () => void;
  sidebarFilters?: React.ReactNode;
  detailNavigation?: (toggle: React.ReactNode, showDetail: boolean) => React.ReactNode;
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
  loadUnavailable,accessibleCount,
  employeeId,
  employees,
  onSignal,onOpen,onIdentity,onClaim,onProcess,canProcess,canClaim,progressAction,
  onReset,sidebarFilters,detailNavigation,search="",onSearch,
  children,
}: LeadWorkspaceProps) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const [agreementNow,setAgreementNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setAgreementNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const headerHeight=useCrmShellHeight();
  const scrollMode=useRecordScrollMode(headerHeight);
  const independent=scrollMode==='independent';
  const [collapsed,setCollapsed]=useState(false);
  const [showList,setShowList]=useState(false);
  const sidebarVisible=independent?!collapsed:showList;
  const open:typeof onOpen=(lead,tab)=>{
    if(!independent&&lead.id===selectedId)setShowList(false);
    onOpen(lead,tab);
  };
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
      ? formatCrmOperatingTime(value, viewerTimeZone())
      : t("Unknown time", "未知时间");
  const identityAction=(lead:CrmLeadRecord)=>lead.identityReview?.pending&&lead.identityReview.canReview?<CrmIdentityAction lang={lang} onClick={()=>onIdentity?onIdentity(lead):open(lead,'profile')}/>:null;
  const follow = (lead: CrmLeadRecord, compact = false, readOnly = false) => (
    <>{!readOnly&&<CrmStopContact lead={lead} lang={lang}/>}<CrmFollowUp
      hideStoppedNotice
      readOnly={readOnly}
      lead={lead}
      lang={lang}
      timezone={timezone}
      isLight={isLight}
      employees={employees}
      onOpen={() => open(lead, "activities")}
      compact={compact}
    /></>
  );
  const field = (key: CustomerField, lead: CrmLeadRecord): React.ReactNode => {
    switch (key) {
      case "number":
        return leadDisplayNumber(lead);
      case "name":
        return (
          <div><button
            type="button"
            className="crm-work-link crm-customer-open"
            onClick={() => open(lead)}
          >
            {lead.fullName || t("Unnamed customer", "未填写姓名")}
          </button><CrmIdentityStatus lead={lead} lang={lang} explain/>{!fields.includes("followup")&&identityAction(lead)}</div>
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
      case "opportunities":
        return <CustomerOpportunities lead={lead} lang={lang} table/>;
      case "signal":
        return (
          visibleIntentEvidence(lead)
            .map((s) => `${evidenceHeading(s.kind,lang)}: ${buyingEvidenceLabel(s,lang)}`)
            .join(lang === "id" ? crmId(", ") : lang === "zh" ? "、" : ", ") ||
          "—"
        );
      case "contact":
        return lead.connectStatus==="Interested"?t("Historical interest record","历史意向记录"):<CrmContactResult result={lead.connectStatus}>{crmValue(lead.connectStatus, lang)}</CrmContactResult>;
      case "touches":
        return lead.touchCount ?? 0;
      case "lastContact":
        return lead.lastContactedAt
          ? date(lead.lastContactedAt)
          : t("No contact recorded", "尚无联系记录");
      case "followup":
        return <>{identityAction(lead)}{follow(lead)}</>;
      case "source":
        return crmValue(lead.entryPoint, lang);
      case "campaign":
        return lead.campaign || "—";
    }
  };
  const emptyResults=loading&&!leads.length?<p className="crm-record-sidebar-message" role="status">{t("Loading customers…","正在加载客户…")}</p>:
    loadUnavailable&&!leads.length?<p className="crm-record-sidebar-message" role="alert">{lang==='zh'?'客户列表暂不可用，请查看刷新提示并重试。':lang==='id'?'Daftar pelanggan belum tersedia. Periksa pesan pembaruan dan coba lagi.':'Customer list unavailable. Check the refresh message and retry.'}</p>:
    !leads.length?<div className="crm-record-sidebar-message">
      <p>{accessibleCount===0?t("No accessible leads are currently available","当前没有可访问的客户"):t("No leads match the current filters","当前筛选条件下没有匹配客户")}</p>
      {accessibleCount!==0&&<button type="button" className="crm-work-link" onClick={onReset}>{t("Clear filters and show all accessible leads","清空筛选，查看全部可见客户")}</button>}
    </div>:undefined;
  const listToggle=<CrmRecordSidebarToggle controls="crm-customer-records" expanded={sidebarVisible}
    label={sidebarVisible?(lang==='zh'?'收起客户侧栏':lang==='id'?'Sembunyikan panel pelanggan':'Hide customer sidebar'):
      (lang==='zh'?'展开客户侧栏':lang==='id'?'Tampilkan panel pelanggan':'Show customer sidebar')}
    onClick={()=>independent?setCollapsed(value=>!value):setShowList(value=>!value)}/>;
  // Filters can hide the current row while its authorized detail and draft stay open.
  return (
    <div
      className="crm-customer-workspace crm-detail-root"
      data-theme={isLight ? "light" : "dark"} lang={lang==='zh'?'zh-CN':lang}
      data-open={!!children}
      data-record-scroll={scrollMode}
      onKeyDown={containPaneKeys}
      data-list-collapsed={Boolean(children&&!sidebarVisible)}
      data-show-list={Boolean(children&&!independent&&showList)}
      data-record-detail={children?true:undefined}
      style={
        { "--crm-shell-height": `${headerHeight}px` } as React.CSSProperties
      }
    >
      {children&&detailNavigation?.(listToggle,independent||!showList)}
      {children?<CrmRecordSidebar id="crm-customer-records" title={t("Customers","客户")} count={leads.length}
        selectedId={leads.some(lead=>lead.id===selectedId)?selectedId:undefined}
        busy={loading} busyLabel={t('Updating…','更新中…')} hidden={!sidebarVisible}
        filters={sidebarFilters??(onSearch&&<CrmRecordSearch label={t("Search customers","搜索客户")}
          placeholder={t("Search customers…","搜索客户…")} value={search} onChange={onSearch}/>)}
        note={selectedId&&!loading&&!leads.some(lead=>lead.id===selectedId)?
          (lang==='zh'?'当前客户不在筛选结果中，已打开的详情与草稿保持不变。':lang==='id'?'Pelanggan ini di luar hasil filter. Detail dan draf tetap terbuka.':'The current customer is outside these filters. The detail and draft stay open.'):undefined}
        empty={emptyResults}>
        {leads.map(lead=><CrmRecordRow key={lead.id} selected={lead.id===selectedId}
          name={lead.fullName||t("Unnamed customer","未填写姓名")} title={t("Open customer: ","打开客户：")+lead.fullName}
          onClick={()=>open(lead)} meta={<>{leadDisplayNumber(lead)} · {owner(lead)}</>}
          extra={<>
            <CrmCurrentSalesState lead={lead} lang={lang} compact/>
            <LeadActivity readOnly lead={lead} lang={lang} timezone={timezone} onOpen={()=>open(lead,'activities')}/>
            {follow(lead,true,true)}
            <CrmListAgreements lead={lead} lang={lang} timezone={timezone} now={agreementNow} readOnly onOpen={()=>open(lead,'activities')}/>
          </>}/>)}
      </CrmRecordSidebar>:<div className="crm-customer-results" aria-busy={loading}>
        {view === "table" && (
          <div className="crm-field-toolbar">
            <span className="crm-work-muted">
              {t("Data table", "字段表")}
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
            <p>{accessibleCount===0 ? t("No accessible leads are currently available","当前没有可访问的客户") : t("No leads match the current filters","当前筛选条件下没有匹配客户")}</p>
            {accessibleCount!==0&&<button type="button" className="crm-work-link" onClick={onReset}>
              {t("Clear filters and show all accessible leads","清空筛选，查看全部可见客户")}
            </button>}

          </div>
        ) : view === "table" ? (
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
              <span>{lang==='zh'?'互动与跟进':lang==='id'?'Interaksi dan tindak lanjut':'Interaction and follow-up'}</span>
              <span>{t("Sales progress", "销售进展")}</span>
              <span>{t("Learning needs", "学习需求")}</span>
            </div>
            <div
              className="crm-work-rows"
              role="list"
              aria-label={t("Customer worklist", "客户工作列表")}
            >
              {leads.map((lead) => {
                const assessment = workspaceAssessment(lead, lang),
                  intents = worklistIntents(lead);
                const identityFacts=[typeof lead.city==='string'&&lead.city.trim()?customerCity(lead.city,lang):null,typeof lead.currentStatus==='string'&&lead.currentStatus.trim()?(String(lead.currentStatus)==='Employee'?(lang==='zh'?'在职人士':lang==='id'?'Karyawan':'Employee'):crmValue(lead.currentStatus,lang)):null].filter(Boolean);
                return (
                  <article
                    className="crm-work-row" data-identity-pending={lead.identityReview?.pending||undefined}
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
                      </button>
                      <div className="crm-work-muted">
                        {leadDisplayNumber(lead)} · {owner(lead)}
                      </div>
                      {identityFacts.length>0&&<div className="crm-work-muted crm-work-demographics" aria-label={lang==='zh'?'居住地与客户身份':lang==='id'?'Domisili dan identitas pelanggan':'Residence and customer identity'}>{identityFacts.join(' · ')}</div>}
                      {<CrmIdentityStatus lead={lead} lang={lang} explain/>}
                      {['ai.failed','task.overdue'].includes(lead.attention?.latest?.type||'')&&<LeadActivity
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
                      />}
                      {<div className="crm-list-actions crm-identity-actions">
                        {lead.identityReview?.pending?identityAction(lead):!lead.owner&&onClaim&&canClaim?.(lead)!==false?
                          <button type="button" className="crm-work-button" onClick={()=>onClaim(lead)}>{lang==='en'?"Assign to me":t("Claim for myself","自己认领")}</button>:
                          <CrmProgressAction state={progressAction?.(lead)??(canProcess?.(lead)===false?'hidden':'enabled')} lang={lang} primary onClick={()=>onProcess?onProcess(lead):open(lead,"activities")}/>}
                      </div>}
                    </div>
                    <div className="crm-work-next">{follow(lead, true)}<CrmListAgreements lead={lead} lang={lang} timezone={timezone} now={agreementNow}  onOpen={()=>open(lead,'activities')}/>{<CrmInteractionTimelines lead={lead} lang={lang} timezone={timezone} isLight={isLight} compact/>}{listLeadHint(lead,lang)&&<p className="crm-work-muted crm-list-key-hint">{listLeadHint(lead,lang)}</p>}</div>
                    <div className="crm-work-progress">
                      <div className="crm-list-stage-line"><CustomerOpportunities lead={lead} lang={lang}/><span className="crm-work-group" title={t('Customer group','客户分组')}>{crmValue(lead.tier,lang)}</span></div>
                      {intents.length>0&&<div className="crm-list-intent"><span className="crm-list-progress-label">{intents[0].evidence.kind==='questionnaire'?t('Questionnaire interest','问卷关注'):t('Requests and interests','诉求与意向')}</span>
                        {intents.map(({evidence,unknownCount})=>{const label=buyingEvidenceLabel(evidence,lang),valid=Boolean(crmInstant(evidence.at||undefined)),stamp=valid?formatCrmOperatingTime(evidence.at!,viewerTimeZone()):'';const time=valid?stamp.slice(5,16):lang==='zh'?'时间未知':lang==='id'?'Waktu tidak diketahui':'Time unknown';const description=valid?`${unknownCount?t('Latest known occurrence: ','最近已知发生时间：'):t('Occurred: ','实际发生于：')}${stamp}`:t('Occurrence time unknown','实际发生时间未知');return <button type="button" key={evidence.value} className="crm-work-support-link crm-list-intent-row" title={`${label} · ${description}`} aria-label={`${label}, ${description}, ${t('View original evidence and history','查看原文依据及历次记录')}`} onClick={()=>onSignal?onSignal(lead,evidence.id):open(lead,'profile')}><span>{label}</span><span className="crm-list-intent-time" data-unknown={!valid}>{time}</span></button>;})}
                      </div>}
                      {<CrmListMilestones lang={lang} lead={lead} onOpen={()=>open(lead,'activities')}/>}
                    </div>
                    <div className="crm-work-needs">
                      <div className={`crm-learning-goal${lead.goal?.trim()?'':' is-empty'}`}><LearningNeedText value={assessment.goal} lang={lang}/>{(lead.goals||[]).filter(g=>g&&g!==lead.goal).length>0&&<button type="button" className="crm-work-link" onClick={()=>open(lead,"profile")}> · +{(lead.goals||[]).filter(g=>g&&g!==lead.goal).length} {t("Other goals","其他目标")}</button>}</div>
                      {lead.mode?.trim()&&<div className="crm-work-muted">
                        {crmValue(lead.mode, lang)}
                      </div>}
                      <button
                        type="button"
                        className="crm-work-assessment"
                        onClick={() => open(lead, "assessment")}
                      >
                        {assessment.kind==='self'&&assessment.conclusion===(lang==='zh'?'水平未知':lang==='id'?crmId('Level unknown'):'Level unknown')?<span>{lang==='zh'?'尚无测评记录':lang==='id'?'Belum ada catatan asesmen':'No assessment recorded'}</span>:<><span>{assessment.source}</span><span>{listAssessmentConclusion(assessment.conclusion,lang)}</span></>}
                      </button>
                      {listLearningNeeds(lead,lang).length>0&&<dl className="crm-learning-details">{listLearningNeeds(lead,lang).map(row=><div className="crm-learning-need" key={row.label}><dt>{row.label}</dt><dd><LearningNeedText value={row.value} lang={lang}/></dd></div>)}</dl>}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>}
      {children&&<div className="crm-lead-detail-column" hidden={!independent&&showList}>{children}</div>}
    </div>
  );
}
