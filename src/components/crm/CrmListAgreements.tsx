import {CalendarDays} from 'lucide-react';
import {agreementTime,agreementListTime} from '../../utils/crmProgressDetails';
import {priorityAgreements} from '../../utils/crmAgreementPresentation';
import {useCrmUiText} from './CrmUiLanguage';
/** Shared agreement hierarchy in full list, compact list and follow-up. */
export function CrmListAgreements({lead,lang,timezone,onOpen,onCorrect,readOnly=false,detail=false,now=Date.now()}:any){
 const ui=useCrmUiText(lang),rows=priorityAgreements(lead,timezone,now);if(!rows.length)return null;
 const row=(entry:any)=>{const {agreement:v,status}=entry;
  const tone=status==='overdue'?'danger':status==='soon'||status==='today'||status==='invalid'?'warning':'info';
  const labelKey=({overdue:'约定已逾期',soon:'约定临近',today:'今天约定',invalid:'约定时间无效'} as any)[status];
  const label=labelKey?ui(labelKey):'';
  const time=status==='invalid'?'':status==='undated'?ui('未约定时间'):detail?agreementTime(v,timezone,lang,true):agreementListTime(v,timezone,now);
  const icon=<CalendarDays size={14} aria-hidden="true" className="crm-agreement-icon"/>;
  const meta=<span className="crm-agreement-meta">{label&&<span className="crm-agreement-status" data-tone={tone}>{label}</span>}{status!=='invalid'&&<span className="crm-list-agreement-date" data-undated={status==='undated'||undefined}>{time}</span>}</span>;
  return <div key={v.id} className="crm-list-agreement" data-tone={tone} onClick={readOnly?undefined:e=>e.stopPropagation()}>
   {detail?<div className="crm-agreement-detail-row"><span className="crm-agreement-item-icon">{icon}</span><p className="crm-agreement-action">{v.action}</p>{meta}</div>:<>
    {label&&<div className="crm-list-agreement-heading"><span className="crm-agreement-status" data-tone={tone}>{label}</span></div>}
    {readOnly?<div className="crm-interaction-agreement crm-agreement-list-action">{icon}<span className="crm-list-agreement-preview">{v.action}</span></div>:<button type="button" className="crm-work-link crm-interaction-agreement crm-agreement-list-action" onClick={onOpen} title={v.action} aria-label={ui('客户约定')+'：'+v.action}>{icon}<span className="crm-list-agreement-preview">{v.action}</span></button>}
    {status!=='invalid'&&<span className="crm-list-agreement-date" data-undated={status==='undated'||undefined}>{time}</span>}
   </>}
   {detail&&onCorrect&&(lead.followUpLogs||[]).some((l:any)=>[l.id,l.requestId].filter(Boolean).includes(v.sourceId))&&<button type="button" className="crm-work-link" onClick={()=>onCorrect(v)}>{ui("纠正误记约定")}</button>}
  </div>;
 };
 return <section className={'crm-list-agreements'+(detail?' is-detail':'')} aria-label={ui('客户约定')}>
  <h4 className="crm-agreement-section-title">{ui('客户约定')}</h4>{rows.map(row)}
 </section>;
}
