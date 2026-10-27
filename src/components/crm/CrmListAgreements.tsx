import {agreementTime} from '../../utils/crmProgressDetails';
import {priorityAgreements} from '../../utils/crmAgreementPresentation';
import {useCrmUiText} from './CrmUiLanguage';
/** Shared agreement hierarchy in full list, compact list and follow-up. */
export function CrmListAgreements({lead,lang,timezone,onOpen,detail=false,now=Date.now()}:any){
 const ui=useCrmUiText(lang),rows=priorityAgreements(lead,timezone,now);if(!rows.length)return null;
 const row=(entry:any)=>{const {agreement:v,status}=entry;
  const tone=status==='overdue'?'danger':status==='soon'||status==='today'?'warning':'neutral';
  const labelKey=({overdue:'约定已逾期',soon:'约定临近',today:'今天约定',invalid:'约定时间无效'} as any)[status];
  const label=labelKey?ui(labelKey):'';
  const time=status==='invalid'?'':status==='undated'?ui('未约定时间'):agreementTime(v,timezone,lang,true);
  return <div key={v.id} className="crm-list-agreement" data-tone={tone} onClick={e=>e.stopPropagation()}>
   <div className="crm-list-agreement-heading"><span className="crm-list-agreements-label">{ui('客户约定')}</span>{detail?<span className="crm-agreement-meta">{label&&<span className="crm-agreement-status" data-tone={tone}>{label}</span>}{status!=='invalid'&&<span className="crm-list-agreement-date">{time}</span>}</span>:label&&<span className="crm-agreement-status" data-tone={tone}>{label}</span>}</div>
   {detail?<p className="crm-agreement-action">{v.action}</p>:<button type="button" className="crm-work-link crm-interaction-agreement" onClick={onOpen} title={v.action} aria-label={ui('客户约定')+'：'+v.action}><span className="crm-list-agreement-preview">{v.action}</span></button>}
   {!detail&&status!=='invalid'&&<span className="crm-list-agreement-date">{time}</span>}
  </div>;
 };
 return <section className={'crm-list-agreements'+(detail?' is-detail':'')} aria-label={ui('客户约定')}>
  {row(rows[0])}
  {rows.length>1&&(detail?<details className="crm-other-agreements"><summary>{ui('其他客户约定')}（{rows.length-1}）</summary>{rows.slice(1).map(row)}</details>:<button type="button" className="crm-work-link crm-agreement-more" onClick={e=>{e.stopPropagation();onOpen?.();}}>{ui('其他客户约定')}（{rows.length-1}）</button>)}
 </section>;
}
