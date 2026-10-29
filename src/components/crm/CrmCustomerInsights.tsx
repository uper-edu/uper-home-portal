import {insightValueText} from '../../utils/crmClassEquipment';
import {aiInsightDefinition} from '../../utils/crmDimensionCatalog';
import {useCrmExtractions} from './useCrmExtractions';
import {CrmDisclosure} from './CrmDisclosure';
import {CrmAiIndicator} from './CrmAiIndicator';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {useCrmUiText} from './CrmUiLanguage';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import {insightLabel,type CustomerInsight,type InsightEvidence} from '../../utils/crmCustomerInsights';
export function CrmCustomerInsights({lead,lang,onSource,onRefresh,embedded=false}:any){
 const ui=useCrmUiText(lang),all=Object.values(lead.aiInsights||{}) as CustomerInsight[];
 const extraction=useCrmExtractions(lead.id,lead.simpleRevision,undefined,onRefresh,true);
 const pending=extraction.rows.some(r=>r.input?.insightsVersion&&['pending','processing','retry'].includes(r.status));
 const failed=extraction.rows.some(r=>r.input?.insightsVersion&&r.status==='failed');
 const current=all.filter(i=>i.status!=='withdrawn'&&(Array.isArray(i.value)?i.value.some(v=>typeof v==='string'&&v.trim()):typeof i.value==='string'&&!!i.value.trim()));
 const state=(e:any)=>e.decision==='difference'?'未采用，保留当前洞察':e.decision==='evidence'?'仅保留依据':e.status==='withdrawn'?'已撤回当前洞察':e.basis==='inferred'?'AI推断':'原文陈述';
 const source=(h:InsightEvidence)=>onSource&&<CrmEvidenceAction label="查看原记录" behavior="open" kind="record" description={ui('查看洞察对应的原始记录')} onClick={()=>onSource(h)}/>;
 const item=(insight:CustomerInsight)=><article key={insight.dimension.key} className="crm-history-information-item" data-status={insight.status==='tentative'?'difference':undefined}>
  <div className="crm-history-information-heading"><strong title={aiInsightDefinition(insight.dimension).definition[lang as 'zh']||insight.dimension.definition.en}>{insightLabel(insight.dimension,lang)}<CrmAiIndicator/></strong><span className="crm-history-information-state">{ui(state(insight.current))}</span>{source(insight.current)}</div>
  <p className="crm-history-information-value">{insightValueText(insight.value,insight.dimension.key,lang)}</p>
  <CrmDisclosure heading={ui(insight.history.length>1?'依据与历史':'原文依据')+(insight.history.length>1?' · '+insight.history.length:'')}>
   {insight.history.slice().reverse().map(h=><div key={h.id} className="crm-history-information-item" data-status={h.decision==='difference'?'difference':undefined}>
    <div className="crm-history-information-heading"><span className="crm-history-information-state">{ui("录入于")} {formatCrmEventTime(h.recordedAt)} · {ui(state(h))}</span>{h.id!==insight.current.id&&source(h)}</div>
    {insight.history.length>1&&insightValueText(h.value,insight.dimension.key,lang)!==h.quote&&<p className="crm-history-information-value"><span className="crm-history-information-state">{ui('整理结果')} · </span>{insightValueText(h.value,insight.dimension.key,lang)}</p>}
    <blockquote className="crm-progress-original">{insightValueText(h.value,insight.dimension.key,lang)!==h.quote&&<span className="crm-history-information-state">{ui('原文依据')} · </span>}{h.quote}</blockquote>
    {h.decision==='difference'&&<p className="crm-history-information-reason">{ui(h.reason)}</p>}
   </div>)}
  </CrmDisclosure>
 </article>;
 if(!current.length&&!pending&&!failed&&!extraction.error)return null;
 const content=<>
  {(pending||extraction.loading&&!all.length)&&<p className="crm-work-muted" role="status">{ui(pending?'新记录正在整理':'正在读取洞察状态…')}</p>}
  {(extraction.error||failed)&&<p className="crm-work-muted" role="alert">{ui(extraction.error?'洞察状态暂不可用，已有资料保留':'有新记录未完成AI整理，原文保留')} <button type="button" className="crm-work-link" onClick={extraction.reload}>{ui('刷新状态')}</button></p>}
  {current.length?current.map(item):!pending&&!extraction.loading&&!extraction.error&&!failed&&<p className="crm-work-muted">{ui('暂无当前洞察')}</p>}
 </>;
 return embedded?<section className="crm-insights-group" aria-label={ui('学习条件与决策背景')}><h4>{ui('学习条件与决策背景')}</h4>{content}</section>:<section aria-label={ui('客户洞察')}><header className="crm-profile-section-heading"><h3>{ui('客户洞察')}</h3></header>{content}</section>;
}
