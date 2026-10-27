import {useCrmUiText,useCrmUiLanguage} from './CrmUiLanguage';
import React,{useState} from 'react';
import {historyInformation,historyDisplayInformation,historySharedCitations,historyCitationKey,historyBusinessReasons,historyInformationBatches,historyExtractionScope,historyQuoteRange,type HistoryCitation,type HistoryInformation,type HistoryDisplayInformation} from '../../utils/crmHistoryInformation';
import {crmUiText} from '../../utils/crmUiText';
import {budgetPresentation} from '../../utils/crmLeadPresentation';
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
const show=(v:any,lang:any):string=>v===null?crmUiText('明确清空',lang):v===undefined||v===''?crmUiText('未记录',lang):Array.isArray(v)?v.map(x=>show(x,lang)).join(lang==='zh'?'、':', '):typeof v==='object'?crmUiText('结构化信息',lang):({en:lang==='zh'?'英语':lang==='id'?'Inggris':'English',id:lang==='zh'?'印尼语':'Bahasa Indonesia',zh:lang==='zh'?'中文':lang==='id'?'Mandarin':'Chinese',unknown:crmUiText('未确认',lang)}as any)[String(v)]||crmValue(String(v),lang);
const fieldValue=(field:string,v:any,lang:any)=>field==='budgetAmount'?budgetPresentation({budgetAmount:v},lang)?.value||show(v,lang):show(v,lang);
const status=(i:HistoryInformation)=>i.superseded&&i.status==='applied'?'当时采用，后续已修正':(({applied:'当次已采用',difference:'未采用，保留不同记录',unchanged:'当次保持原值',evidence:'仅保留依据',suggestion:'仅作建议',recorded:'人工记录',unknown:'采用结果未注明'}as any)[i.status]||'采用结果未注明')+(i.superseded?' · 后续已修正':'');
export function CrmHistoryInformation({group,items=historyInformation(group),allRows=group.extractions,scope='main',loading,error,selectedCitation,onEvidence,onViewAssessment}:any){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();

 const [fallback,setFallback]=useState<HistoryCitation|null>(null);
 const information=historyDisplayInformation(group,items.filter((i:HistoryInformation)=>i.scope===scope)),runs=(group.extractions||[]).filter((r:any)=>historyExtractionScope(group,r)===scope);
 const correction=scope!=='main'&&(group.events?.some((e:any)=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===scope&&e.payload?.kind==='correction')||runs.some((r:any)=>r.input?.amendment?.kind==='correction'));
 const batches=historyInformationBatches(group,information);
 const stateRuns=runs.filter((r:any)=>!['ready','empty'].includes(extractionViewState(r)));
 const citationKey=historyCitationKey;
 const sharedCitations=historySharedCitations(information);
 const refId=(index:number)=>historyOriginalId(group.id,scope)+'-shared-'+index;
 const refMark=(index:number)=>index<20?String.fromCodePoint(0x2460+index):'['+(index+1)+']';
 const uniqueCitations=[...new Map<string,HistoryCitation>(information.flatMap(i=>i.citations).map(c=>[citationKey(c),c])).values()];
 const link=(c:HistoryCitation)=>{const text=scope==='main'?group.original:group.events.find((e:any)=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===scope)?.original||group.events.find((e:any)=>e.eventType==='record.amended'&&(e.payload?.id||e.eventId)===scope)?.payload?.text||runs[0]?.input?.text||'';if(historyQuoteRange(text,c)){setFallback(null);onEvidence?.(c);}else setFallback(c);};
 const assessment=runs.some((r:any)=>r.status==='completed'&&r.output?.observations?.some((o:any)=>o.kind==='stage_event'&&o.field==='assessment_completion_reported'));
 const orphanScopes=scope==='main'?[...new Set<string>((group.extractions||[]).map((r:any)=>historyExtractionScope(group,r)).filter((s:string)=>s.startsWith('sales_amendment:')))]:[];
 const renderReasons=(item:HistoryInformation)=>{const reasons=historyBusinessReasons(item);return reasons.length>0&&(item.status==='difference'||['evidence','suggestion','unknown'].includes(item.status)?<p className="crm-history-information-reason">{reasons.join('；')}</p>:<details className="crm-history-adoption-reason"><summary>{ui("采用原因")}</summary><p>{reasons.join('；')}</p></details>);};
 const renderItem=(item:HistoryDisplayInformation,shared=false,sharedReasons=false)=>{const itemIndex=information.indexOf(item),refs=sharedCitations.map((ref,index)=>({ref,index})).filter(({ref})=>ref.items.includes(item));return <article key={item.id} className="crm-history-information-item" aria-describedby={refs.length?refs.map(({index})=>refId(index)).join(' '):undefined} data-status={item.superseded?'historical':item.status} data-correction={correction&&item.status==='applied'&&item.beforeKnown?true:undefined}>
  <div className="crm-history-information-heading"><strong title={item.displayMembers?.map(i=>ui(i.label)).join('、')} aria-label={item.displayMembers?.map(i=>ui(i.label)).join('、')}>{ui(item.label)}{item.sources.includes('AI提取')&&<CrmAiIndicator mixed={item.sources.includes('人工填写')}/>}</strong>{refs.map(({index})=><span key={index} className="crm-history-shared-marker" aria-describedby={refId(index)} aria-label={ui("共同依据")+' '+(index+1)} title={ui("共同依据")+' '+(index+1)}>{refMark(index)}</span>)}{!shared&&<span className="crm-history-information-state">{ui(status(item))}</span>}{(uniqueCitations.length>1||scope!=='main')&&item.citations.filter(c=>!sharedCitations.some(ref=>ref.key===citationKey(c))).filter((c,index,own)=>own.findIndex(x=>citationKey(x)===citationKey(c))===index&&!information.slice(0,itemIndex).some(prior=>prior.citations.some(x=>citationKey(x)===citationKey(c)))).map(c=><CrmEvidenceAction label="定位原文" behavior="locate" controls={historyOriginalId(group.id,c.scope)} key={c.id} description={(((((ui("查看") + item.label) + ui("的原文依据")) + (uniqueCitations.length>1?' '+(uniqueCitations.findIndex(v=>v.id===c.id)+1):'')) + '：') + c.quote)} onClick={()=>link(c)}/>)}</div>
  <p className="crm-history-information-value">{item.kind==='field'&&item.beforeKnown&&item.before!=null&&item.status==='applied'&&<><span className="crm-history-information-before crm-work-muted">{fieldValue(item.field,item.before,lang)}</span><span aria-label={ui("变为")}> → </span></>}{item.kind==='stage_event'?ui(extractionStageValue(item.observation)):item.kind==='signal'?ui(extractionSignalValue(item.observation)):<span className="crm-history-information-after">{fieldValue(item.field,item.value,lang)}</span>}{item.status==='difference'&&item.retainedKnown&&<span className="crm-work-muted">{ui("；当时保留：")}{item.retainedValue==null ? ui("未记录") : fieldValue(item.field,item.retainedValue,lang)}</span>}</p>
  {item.aiReferences.map((ref,j)=><p key={j} className="crm-history-information-meta"><span>{ui("参考解读")}</span><CrmAiIndicator/>：{fieldValue(item.field,ref.value,lang)}</p>)}
  <div className="crm-history-information-meta">{[...item.sources.filter(s=>!shared&&!['AI提取','AI参考'].includes(s)),item.observation&&item.kind==='field'&&item.observation.temporality!=='current'?({past:'过去情况',future:'未来安排',conditional:'有条件',uncertain:'不确定',negated:'否定表达'}as any)[item.observation.temporality]:'',item.observation?.subject==='sales'?'销售表达':''].filter(Boolean).map(ui).join(' · ')}{item.sources.includes('AI参考')&&!item.aiReferences.length&&<><span> {ui("· 参考解读")}</span><CrmAiIndicator/></>}</div>
  {!sharedReasons&&renderReasons(item)}
 </article>;};
 return <>
 {!!information.length&&<section className="crm-history-information" aria-label={ui(scope==='main'?"整理结果":"补充／修正结果")} data-original-id={historyOriginalId(group.id,scope)}>{scope==='main'&&<div className="crm-history-derived-heading"><h4>{ui("整理结果")}</h4>{uniqueCitations.length===1&&!sharedCitations.length&&<CrmEvidenceAction label="定位原文" description={ui("定位本次信息对应的原文片段")} behavior="locate" controls={historyOriginalId(group.id,scope)} onClick={()=>link(uniqueCitations[0])}/>}</div>}{sharedCitations.map((ref,index)=><div className="crm-history-shared-evidence" key={ref.key}><p id={refId(index)}><span className="crm-history-shared-marker">{refMark(index)}</span>{ui("共同依据")} · {ref.items.map(i=>ui(i.label)).join('、')}</p><CrmEvidenceAction label="定位原文" behavior="locate" controls={historyOriginalId(group.id,scope)} description={ui("共同依据")+' '+(index+1)+'：'+ref.items.map(i=>ui(i.label)).join('、')+'；'+ref.citation.quote} onClick={()=>link(ref.citation)}/></div>)}{batches.map((batch,index)=>batch.shared?<div className="crm-history-result-group" data-status={batch.items[0].superseded?'historical':batch.items[0].status} key={batch.items[0].id} role="group" aria-labelledby={historyOriginalId(group.id,scope)+'-result-'+index}><p className="crm-history-common-meta" id={historyOriginalId(group.id,scope)+'-result-'+index}>{batch.items[0].sources.filter(s=>!['AI提取','AI参考'].includes(s)).map(s=>ui(s)).join(' · ')}{batch.items[0].sources.some(s=>!['AI提取','AI参考'].includes(s))?' · ':''}<span className="crm-history-information-state">{ui(status(batch.items[0]))}</span></p>{batch.items.map(item=>renderItem(item,true,batch.sharedReasons))}{batch.sharedReasons&&renderReasons(batch.items[0])}</div>:renderItem(batch.items[0]))}
 {fallback&&<aside className="crm-history-citation"><strong>{ui("原文依据")}</strong><blockquote>{fallback.quote}</blockquote><p className="crm-work-muted">{ui("未能唯一定位此段原文，请结合本条记录的完整原文核对。")}</p></aside>}
 </section>}
 {!!stateRuns.length&&<CrmExtractionRows rows={stateRuns} allRows={allRows} embedded includeSource={false}/>}
 {scope==='main'&&error&&<p role="alert" className="crm-work-muted">{ui("AI整理状态暂不可用，原文及已有结果保留。")}</p>}
 {scope==='main'&&!runs.length&&!information.length&&!error&&loading&&<p className="crm-work-muted" role="status">{ui("正在读取AI整理状态…")}</p>}
 {assessment&&<button type="button" className="crm-work-link" onClick={onViewAssessment}>{ui("核对真实测评记录")}</button>}
 {orphanScopes.map(s=>{const row=(group.extractions||[]).find((r:any)=>historyExtractionScope(group,r)===s);return <section key={s} className="crm-history-amendment"><h4>{ui("关联补充／修正原文")}</h4><CrmHistoryOriginal groupId={group.id} scope={s} text={row.input?.text||ui('原文未附在本次整理中')} citation={selectedCitation}/><CrmHistoryInformation group={group} items={items} allRows={allRows} scope={s} selectedCitation={selectedCitation} onEvidence={onEvidence} onViewAssessment={onViewAssessment}/></section>;})}
 </>;
}


export function CrmHistoryQuestionnaireOriginal({group,citation,action}:{group:any;citation?:HistoryCitation|null;action?:React.ReactNode}){
 const ui=useCrmUiText();
 return <div className="crm-history-questionnaire-original"><details className="crm-history-original-answers"><summary>{ui("问卷原始答案")}</summary><CrmHistoryOriginal groupId={group.id} text={group.original} citation={citation}/></details>{action}</div>;
}
