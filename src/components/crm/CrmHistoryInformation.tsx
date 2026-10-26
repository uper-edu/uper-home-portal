import {useCrmUiText} from './CrmUiLanguage';
import React,{useState} from 'react';
import {historyInformation,historyExtractionScope,historyQuoteRange,type HistoryCitation,type HistoryInformation} from '../../utils/crmHistoryInformation';
import {crmValue} from '../../utils/crmLanguage';
import {extractionViewState,extractionSignalValue,extractionStageValue} from '../../utils/crmExtractionPresentation';
import {CrmAiIndicator} from './CrmAiIndicator';
import {CrmExtractionRows} from './CrmExtractedInformation';
import {CrmEvidenceAction} from './CrmEvidenceAction';
export const historyOriginalId=(groupId:string,scope:string)=>'crm-history-original-'+encodeURIComponent(groupId+':'+scope);
export function CrmHistoryOriginal({groupId,scope='main',text,citation}:{groupId:string;scope?:string;text:string;citation?:HistoryCitation|null}){
 const range=citation&&citation.scope===scope?historyQuoteRange(text,citation):null;
 return <p id={historyOriginalId(groupId,scope)} tabIndex={-1} className="crm-progress-original crm-history-original">{range?<>{text.slice(0,range.start)}<mark tabIndex={-1}>{text.slice(range.start,range.end)}</mark>{text.slice(range.end)}</>:text}</p>;
}
const show=(v:any):string=>v===null?'明确清空':v===undefined||v===''?'未记录':Array.isArray(v)?v.map(show).join('、'):typeof v==='object'?'结构化信息':({en:'英语',id:'印尼语',zh:'中文',unknown:'未确认',IDR:'印尼盾（IDR）',course:'整门课程',month:'每月',hour:'每小时',unspecified:'周期未说明'}as any)[String(v)]||crmValue(String(v),'zh');
const status=(i:HistoryInformation)=>(({applied:'当次已采用',difference:'未采用，保留不同记录',unchanged:'当次保持原值',evidence:'仅保留依据',suggestion:'仅作建议',recorded:'人工记录',unknown:'采用结果未注明'}as any)[i.status]||'采用结果未注明')+(i.superseded?' · 解释已被关联修正替代':'');
export function CrmHistoryInformation({group,items=historyInformation(group),allRows=group.extractions,scope='main',loading,error,selectedCitation,onEvidence,onViewAssessment}:any){
 const ui=useCrmUiText();

 const [fallback,setFallback]=useState<HistoryCitation|null>(null);
 const information:HistoryInformation[]=items.filter((i:HistoryInformation)=>i.scope===scope),runs=(group.extractions||[]).filter((r:any)=>historyExtractionScope(group,r)===scope);
 const stateRuns=runs.filter((r:any)=>!['ready','empty'].includes(extractionViewState(r)));
 const uniqueCitations=[...new Map<string,HistoryCitation>(information.flatMap(i=>i.citations).map(c=>[c.id,c])).values()];
 const link=(c:HistoryCitation)=>{const text=scope==='main'?group.original:group.events.find((e:any)=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===scope)?.original||group.events.find((e:any)=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===scope)?.payload?.text||runs[0]?.input?.text||'';if(historyQuoteRange(text,c)){setFallback(null);onEvidence?.(c);}else setFallback(c);};
 const assessment=runs.some((r:any)=>r.status==='completed'&&r.output?.observations?.some((o:any)=>o.kind==='stage_event'&&o.field==='assessment_completion_reported'));
 const orphanScopes=scope==='main'?[...new Set<string>((group.extractions||[]).map((r:any)=>historyExtractionScope(group,r)).filter((s:string)=>s.startsWith('sales_amendment:')))]:[];
 return <>
 {!!information.length&&<section className="crm-history-information" aria-label={ui("本次获得的信息与资料变化")}><h4>{ui("本次获得的信息与资料变化")}</h4>{information.map(item=><article key={item.id} className="crm-history-information-item" data-status={item.superseded?'historical':item.status}>
  <div className="crm-history-information-heading"><strong>{ui(item.label)}{item.sources.includes('AI提取')&&<CrmAiIndicator mixed={item.sources.includes('人工填写')}/>}</strong><span className="crm-history-information-state">{ui(status(item))}</span>{item.citations.map(c=><CrmEvidenceAction key={c.id} description={(((((ui("查看") + item.label) + ui("的原文依据")) + (uniqueCitations.length>1?' '+(uniqueCitations.findIndex(v=>v.id===c.id)+1):'')) + '：') + c.quote)} onClick={()=>link(c)}/>)}</div>
  <p className="crm-history-information-value">{item.kind==='field'&&item.beforeKnown&&item.status==='applied'&&<><span className="crm-work-muted">{item.before==null ? ui("未记录") : show(item.before)}</span><span aria-label={ui("变为")}> → </span></>}{item.kind==='stage_event'?extractionStageValue(item.observation):item.kind==='signal'?extractionSignalValue(item.observation):show(item.value)}{item.status==='difference'&&item.retainedKnown&&<span className="crm-work-muted">{ui("；当时保留：")}{item.retainedValue==null ? ui("未记录") : show(item.retainedValue)}</span>}</p>
  {item.aiReferences.map((ref,j)=><p key={j} className="crm-history-information-meta"><span>{ui("参考解读")}</span><CrmAiIndicator/>：{show(ref.value)}</p>)}
  <div className="crm-history-information-meta">{[...item.sources.filter(s=>!['AI提取','AI参考'].includes(s)),item.observation&&item.kind==='field'&&item.observation.temporality!=='current'?({past:'过去情况',future:'未来安排',conditional:'有条件',uncertain:'不确定',negated:'否定表达'}as any)[item.observation.temporality]:'',item.observation?.subject==='sales'?'销售表达':''].filter(Boolean).join(' · ')}{item.sources.includes('AI参考')&&!item.aiReferences.length&&<><span> {ui("· 参考解读")}</span><CrmAiIndicator/></>}</div>
  {item.reasons.length>0&&(item.status==='difference'||item.superseded||['evidence','suggestion','unknown'].includes(item.status)?<p className="crm-history-information-reason">{item.reasons.join('；')}</p>:<details className="crm-history-adoption-reason"><summary>{ui("采用原因")}</summary><p>{item.reasons.join('；')}</p></details>)}
 </article>)}
 {fallback&&<aside className="crm-history-citation"><strong>{ui("原文依据")}</strong><blockquote>{fallback.quote}</blockquote><p className="crm-work-muted">{ui("未能唯一定位此段原文，请结合本条记录的完整原文核对。")}</p></aside>}
 </section>}
 {!!stateRuns.length&&<CrmExtractionRows rows={stateRuns} allRows={allRows} embedded includeSource={false}/>}
 {scope==='main'&&error&&<p role="alert" className="crm-work-muted">{ui("AI整理状态暂不可用，原文及已有结果保留。")}</p>}
 {scope==='main'&&!runs.length&&!information.length&&!error&&loading&&<p className="crm-work-muted" role="status">{ui("正在读取AI整理状态…")}</p>}
 {assessment&&<button type="button" className="crm-work-link" onClick={onViewAssessment}>{ui("核对真实测评记录")}</button>}
 {orphanScopes.map(s=>{const row=(group.extractions||[]).find((r:any)=>historyExtractionScope(group,r)===s);return <section key={s} className="crm-history-amendment"><h4>{ui("关联补充／修正原文")}</h4><CrmHistoryOriginal groupId={group.id} scope={s} text={row.input?.text||'原文未附在本次整理中'} citation={selectedCitation}/><CrmHistoryInformation group={group} items={items} allRows={allRows} scope={s} selectedCitation={selectedCitation} onEvidence={onEvidence} onViewAssessment={onViewAssessment}/></section>;})}
 </>;
}
