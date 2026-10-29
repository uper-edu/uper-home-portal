import {historyFirstInstant,historyElapsedLabel} from '../../utils/crmHistoryElapsed';
import {CrmHistoryStream} from './CrmHistoryStream';
import {historyOrigin} from '../../utils/crmHistoryOrigin';
import {historyQuoteRange} from '../../utils/crmHistoryInformation';
import {CrmHistorySearch,CrmSearchHighlight} from './CrmSearchHighlight';
import {historyBusinessTitle} from '../../utils/crmHistoryTimeline';
import {useCrmUiText} from './CrmUiLanguage';
import {CrmSalesStageChange} from './CrmSalesStage';
import {CrmSingleSelect} from './CrmSingleSelect';
import {historyInformation,historyAmendmentTitle,type HistoryCitation} from '../../utils/crmHistoryInformation';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {CrmHistoryInformation,CrmHistoryOriginal,CrmHistoryQuestionnaireOriginal,historyOriginalId} from './CrmHistoryInformation';
import {CrmHistorySources} from './CrmHistorySources';
import {CrmHistoryAttribution} from './CrmHistoryAttribution';
import {revealRecord} from '../adminScroll';
import {locateLedgerEvent} from '../../utils/crmFollowupPresentation';
import {buildHistoryTimeline,historyCategories,historyGroupFor,historyAssessment,historyContactCorrection,historyStructuredFields,historyPreview} from '../../utils/crmHistoryTimeline';
import {profileSaveSummary} from '../../utils/crmProfileSaveResult';
import {viewerTimeZone,formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import {useEffect,useState,useRef,useId} from 'react';
import {crmValue} from '../../utils/crmLanguage';
import {MessageSquareText,NotebookText,ClipboardList,GraduationCap,UserRoundPen,FileSearch,ArrowLeftRight,ChevronDown,RefreshCw} from 'lucide-react';
import {CrmRecordAmendmentForm}from'./CrmRecordAmendmentForm';
import {CrmSaveFeedback}from'./CrmDetailWorkspace';
import {contactCorrectionOptions}from'../../utils/crmRecordAmendments';
import {historyProgressDetails} from '../../utils/crmProgressDetails';
const amendable=new Set(['followup.recorded','task.request_evidence','questionnaire.submitted','profile.fields_updated']);
const icons:any={message:MessageSquareText,sales:NotebookText,questionnaire:ClipboardList,assessment:GraduationCap,profile:UserRoundPen,ownership:ArrowLeftRight,other:FileSearch};
const value=(v:any)=>v==null?'未填写':Array.isArray(v)?v.map(x=>crmValue(String(x),'zh')).join('、'):typeof v==='object'?'结构化信息':crmValue(String(v),'zh');
export function CrmFactLedger({leadId,lead,revision,timezone,disabled,onChanged,onDirty,onBusy,suspended,canEditProfile,isLight=true,lang='zh',focusRequest,onEditing,hideHeading=false,onProjection,extractions=[],extractionLoading=false,extractionError=false,onReloadExtraction,onViewAssessment,onSource,requests=[],windowMode=false}:any){
 const ui=useCrmUiText(lang);

 const typeId=useId(),searchId=useId(),ledgerRoot=useRef<HTMLElement>(null);
 const[data,setData]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[target,setTarget]=useState<any>(null),[notice,setNotice]=useState(''),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[expanded,setExpanded]=useState<Set<string>>(new Set()),[evidenceSelection,setEvidenceSelection]=useState<{groupId:string;citation:HistoryCitation}|null>(null);
 useEffect(()=>{
  if(!windowMode)return;
  const collapseOutside=(event:PointerEvent)=>{
   const node=event.target;if(!(node instanceof Element))return;
   const card=node.closest('.crm-history-node');
   if(card&&ledgerRoot.current?.contains(card))return;
   setExpanded(current=>current.size?new Set():current);
  };
  document.addEventListener('pointerdown',collapseOutside,true);
  return()=>document.removeEventListener('pointerdown',collapseOutside,true);
 },[windowMode]);
 useEffect(()=>{let active=true;setError('');onProjection?.({state:'loading',events:[]});fetch(`/api/crm/leads/${leadId}/facts`).then(async r=>{if(!r.ok)throw Error('历史依据暂不可用，请重试');return r.json();}).then(d=>{if(active){setData(d);onProjection?.({state:'ready',events:d.events});}}).catch(e=>{if(active){setError(e.message);onProjection?.({state:'error',events:[]});}});return()=>{active=false};},[leadId,revision,retry]);
 const handled=useRef<any>(null),positioned=useRef<any>(null),focusNode=useRef<HTMLDetailsElement>(null),groups=buildHistoryTimeline(data?.events||[],lead,extractions),focused=focusRequest&&data?historyGroupFor(groups,focusRequest.id):null;
 useEffect(()=>{onEditing?.(!!target)},[target]);
 useEffect(()=>{
  if(!data||!focusRequest||handled.current===focusRequest.token)return;
  if(!focused){if(extractionLoading)return;setNotice('未在当前历史中定位该依据，原记录不会被删除；可重试读取或核对原始记录。');handled.current=focusRequest.token;return;}
  if(target)return;
  handled.current=focusRequest.token;setFilter(focusRequest.filter||'all');setSearch(focusRequest.search||'');setExpanded(v=>new Set(windowMode?[focused.id]:[...v,focused.id]));
  if(focusRequest.quote){const sources=[{scope:"main",text:focused.original},...focused.events.filter((e:any)=>e.eventType==="record.amended").map((e:any)=>({scope:e.payload.id||e.eventId,text:e.original||e.payload.text||""}))];const matching=sources.filter(v=>historyQuoteRange(v.text,{scope:v.scope,quote:focusRequest.quote} as any));if(matching.length===1)setEvidenceSelection({groupId:focused.id,citation:{id:"open-source",scope:matching[0].scope,quote:focusRequest.quote,sourceText:matching[0].text}});}
  setNotice('已定位对应原始记录。');
  const row=locateLedgerEvent(data.events,focusRequest.id);if(focusRequest.mode==='amend'&&!disabled&&row&&amendable.has(row.eventType))setTarget({...row,withdrawCommitmentId:focusRequest.withdrawCommitmentId});
 },[data,focusRequest,disabled,target,focused?.id,extractionLoading]);
 useEffect(()=>{
  if(!focusRequest||!focused||positioned.current===focusRequest.token||filter!==(focusRequest.filter||'all')||search!==(focusRequest.search||'')||!expanded.has(focused.id)||target)return;
  const summary=focusNode.current?.querySelector('summary');if(!summary)return;
  const pane=summary.closest<HTMLElement>('.crm-customer-panel-body');
  if(pane&&['auto','scroll'].includes(getComputedStyle(pane).overflowY)&&pane.scrollHeight>pane.clientHeight)revealRecord(pane,summary);
  else summary.scrollIntoView({block:'start'});
  summary.focus({preventScroll:true});positioned.current=focusRequest.token;
  if(windowMode&&focusRequest.quote)requestAnimationFrame(()=>{const mark=focusNode.current?.querySelector<HTMLElement>('mark[data-citation-highlight]');mark?.scrollIntoView({block:'nearest'});});
 },[focusRequest,focused?.id,filter,search,expanded,target]);
 const time=(v:string|null)=>v?formatCrmOperatingTime(v,viewerTimeZone()):'未注明';
 const firstInstant=historyFirstInstant(groups);
 const visible=groups.filter(g=>(filter==='all'||g.category===filter)&&(!search.trim()||[g.title,g.original,...g.events.map(e=>e.original||''),...g.extractions.map(r=>r.input?.text||'')].join('\n').toLowerCase().includes(search.trim().toLowerCase())));
 const day=(g:any)=>g.displayAt?time(g.displayAt).slice(0,10):ui('发生时间未注明');
 return <CrmHistorySearch.Provider value={search}><section ref={ledgerRoot} className={"crm-history-timeline"+(windowMode?" crm-history-bilateral":"")} aria-label={ui("历史记录与依据")}>{!hideHeading&&<h3>{ui("历史记录与依据")}</h3>}
 <div className="crm-history-toolbar" role="group" aria-label={ui("历史记录筛选")}>
 <div className="crm-history-type-filter"><label htmlFor={typeId}>{ui("类型")}</label><CrmSingleSelect controlId={typeId} label={ui("历史记录类型")} value={filter} disabled={!!target} onChange={setFilter} lang={lang} isLight={isLight} options={Object.entries(historyCategories).map(([key,label])=>({value:key,label:ui(label)+(data?'（'+(key==='all'?groups.length:groups.filter(g=>g.category===key).length)+'）':'')}))}/></div>
 <div className="crm-history-search"><label htmlFor={searchId}>{ui("搜索原文与内容")}</label><input id={searchId} type="search" aria-label={ui("搜索历史记录")} value={search} disabled={!!target} onChange={e=>setSearch(e.target.value)}/></div>
 <button type="button" className="crm-work-button crm-history-refresh" disabled={!!target} onClick={()=>{setRetry(n=>n+1);onReloadExtraction?.();}}><RefreshCw size={15} aria-hidden="true"/>{ui("刷新记录")}</button></div>

 {notice&&<p role="status">{ui(notice)}</p>}{error&&<p role="alert">{ui(error)} <button onClick={()=>setRetry(v=>v+1)}>{ui("重试读取")}</button></p>}
 {extractionError&&<p role="alert">{ui("AI整理状态暂不可用，原始记录仍保留。")}<button onClick={onReloadExtraction}>{ui("重试AI整理状态")}</button></p>}
 {!data&&!error&&<p role="status">{ui("正在读取历史依据…")}</p>}{data&&!visible.length&&<p>{groups.length ? ui("没有符合筛选的记录。") : ui("尚无历史记录。")}</p>}
 <CrmHistoryStream enabled={windowMode}>{visible.map((g,i)=>{const Icon=icons[g.category]||FileSearch,correction=historyContactCorrection(g,lead),amendments=g.events.filter(e=>e.eventType==='record.amended'),root=g.root,primary=g.events.find(e=>e.eventType==='followup.recorded')||g.events.find(e=>e.eventType==='questionnaire.submitted')||g.events.find(e=>e.eventType==='task.request_evidence')||g.events.find(e=>amendable.has(e.eventType)),editingHere=!!target&&g.events.some(e=>e.eventId===target.eventId),message=g.events.find(e=>e.eventType==='customer.message'),information=historyInformation(g,extractions),citation=evidenceSelection?.groupId===g.id?evidenceSelection.citation:null;
 const amendmentAction=!disabled&&primary?<button type="button" className="crm-work-link" disabled={!!target||suspended} onClick={()=>{setNotice('');setTarget(primary);}}>{ui("补充／修正记录")}</button>:null;
 const showEvidence=(c:HistoryCitation)=>{setEvidenceSelection({groupId:g.id,citation:c});requestAnimationFrame(()=>{const node=ledgerRoot.current?.querySelector<HTMLElement>('#'+CSS.escape(historyOriginalId(g.id,c.scope)));if(!node)return;const disclosure=node.closest('details');if(disclosure)disclosure.open=true;const mark=node.querySelector<HTMLElement>('mark[data-citation-highlight]')||node,pane=node.closest<HTMLElement>('.crm-customer-panel-body');if(pane)revealRecord(pane,mark);else mark.scrollIntoView({block:'nearest'});mark.focus({preventScroll:true});});};
 const origin=historyOrigin(g),timestamp=<span className="crm-history-when">{g.displayAt ? <>{!windowMode&&g.timeLabel&&ui(g.timeLabel)+' '}<time dateTime={g.displayAt}>{time(g.displayAt)}</time></> : (windowMode?"—":ui("实际发生时间未注明"))}</span>;
 return <div key={g.id} data-history-lane={windowMode?origin.lane:undefined} data-history-focused={windowMode&&focused?.id===g.id&&expanded.has(g.id)||undefined}>{(i===0||day(visible[i-1])!==day(g))&&<h4 className="crm-history-date">{day(g)}</h4>}
 <details onClick={windowMode?e=>{
  if(editingHere||e.defaultPrevented)return;
  const node=e.target;if(!(node instanceof Element))return;
  // Keep text selection and embedded controls independent from the outer card toggle.
  if(node.closest('summary,button,a,input,textarea,select,label,[role="button"],[role="link"],[contenteditable="true"]')||node.closest('details')!==e.currentTarget||!window.getSelection()?.isCollapsed)return;
  setExpanded(v=>v.has(g.id)?new Set():new Set([g.id]));e.currentTarget.querySelector('summary')?.focus({preventScroll:true});
 }:undefined} data-history-id={g.id} className="crm-history-node" ref={g.id===focused?.id?focusNode:undefined} open={editingHere||expanded.has(g.id)} onToggle={e=>{if(windowMode)return;const open=e.currentTarget.open;setExpanded(v=>{if(v.has(g.id)===open)return v;const n=new Set(v);open?n.add(g.id):n.delete(g.id);return n;});}}>
 <summary onClick={windowMode?e=>{e.preventDefault();setExpanded(v=>v.has(g.id)?new Set():new Set([g.id]));}:undefined}><span className="crm-history-icon" title={ui(historyCategories[g.category])}><Icon size={17} aria-hidden="true"/></span><div className="crm-history-summary">{windowMode&&<div className="crm-history-card-time">{timestamp}<span className="crm-history-elapsed" title={ui("距首次记录")} aria-label={ui("距首次记录")+" "+historyElapsedLabel(g.displayAt,firstInstant,lang)}>{historyElapsedLabel(g.displayAt,firstInstant,lang)}</span></div>}<div className="crm-history-head"><strong>{g.root?.eventType==='stage.changed'?<>{ui("销售阶段：")}<CrmSalesStageChange before={g.root.payload.before} after={g.root.payload.after}/></>:<CrmSearchHighlight text={historyBusinessTitle(g,lang)}/>}</strong>{!windowMode&&timestamp}<ChevronDown className="crm-history-chevron" size={16} aria-hidden="true"/></div><div className="crm-history-meta">{ui(historyCategories[g.category])}{g.log?.channel?' · '+crmValue(g.log.channel,lang):''}{amendments.length ? (' · '+amendments.length + ui("条补充／修正")) : ''}{g.extractions.some(r=>r.status==='failed') ? ui(" · AI整理未完成") : ''}{correction ? (ui(" · 联系结果已修正：") + ui(contactCorrectionOptions.find(o=>o[0]===correction.contactResult)?.[1]||'')) : ''}</div>{historyPreview(g,lang)&&<p className="crm-history-preview"><CrmSearchHighlight text={historyPreview(g,lang)}/></p>}</div></summary>
 <div className="crm-history-body" data-primary-record={g.id}>
 {windowMode&&<p className="crm-work-muted">{g.displayAt?<>{g.timeLabel&&ui(g.timeLabel)+" "}{time(g.displayAt)}</>:ui("实际发生时间未注明")}</p>}
 {windowMode&&<div className="crm-history-origin"><strong>{ui(origin.author)}</strong><span>{ui(origin.format)}{origin.channel?" · "+ui(origin.channel):""}</span></div>}
 {root?.effective===false&&<p className="crm-work-muted">{ui("原依据已有历史调整，原文保留。")}</p>}
 {correction&&<p role="note"><strong>{ui("当前采用的联系结果：")}{ui(contactCorrectionOptions.find(o=>o[0]===correction.contactResult)?.[1]||'')}</strong>{ui("；下方保留原记录当时填写的联系信息。")}</p>}
 {g.category==='questionnaire'?<CrmHistoryQuestionnaireOriginal group={g} citation={citation} fields={windowMode&&focused?.id===g.id?focusRequest?.fields:undefined} action={amendmentAction}/>:<><div className="crm-history-original-heading"><h4>{g.category==='assessment' ? ui("测评原始结果") : ui("原文与当时记录")}</h4>{amendmentAction}</div>{g.category==='assessment'?<><p><strong>{historyAssessment(g).conclusion}</strong></p><p>{historyAssessment(g).detail}</p>{onViewAssessment&&<button className="crm-work-link" type="button" onClick={onViewAssessment}>{ui("查看历次测评")}</button>}</>:g.original?<CrmHistoryOriginal groupId={g.id} text={g.original} citation={citation}/>:<p>{ui("原记录为结构化信息，相关字段见下方。")}</p>}</>}
 <CrmHistoryAttribution author={g.log?.staffName||root?.payload?.staffName||root?.actorName||root?.actor} recordedAt={g.recordedAt}/>
 {message&&onSource&&<CrmEvidenceAction kind="conversation" description={ui("查看对话与上下文")} onClick={()=>onSource({returnId:g.root?.eventId||g.id,returnSearch:search,returnFilter:filter,details:{sourceConversationId:message.payload?.conversationId,sourceMessageId:message.sourceRecordId}})}/>}
 {g.log&&<dl className="crm-history-details">{historyProgressDetails(g.log,lead,requests,timezone).map(row=><div key={ui(row.label)}><dt>{correction&&row.label==='实际联系结果' ? (ui("原记录中的") + ui(row.label)) : ui(row.label)}</dt><dd>{row.label==='销售阶段变更'&&g.log?.newStage?<CrmSalesStageChange before={g.log.expectedStage} after={g.log.newStage}/>:ui(row.value)}</dd></div>)}</dl>}

 {g.log?.sourceMessageId&&g.log?.sourceConversationId&&onSource&&!(message?.sourceRecordId===g.log.sourceMessageId&&message?.payload?.conversationId===g.log.sourceConversationId)&&<CrmEvidenceAction kind="conversation" description={ui("查看关联客户原文")} onClick={()=>onSource({returnId:g.root?.eventId||g.id,returnSearch:search,returnFilter:filter,details:{sourceConversationId:g.log.sourceConversationId,sourceMessageId:g.log.sourceMessageId}})}/>}
 {['profile.changed','stage.changed'].includes(root?.eventType)&&<dl className="crm-history-details">{historyStructuredFields(root).map(v=><div key={v.key}><dt>{v.label}</dt><dd>{v.key==='currentStage'?<CrmSalesStageChange before={v.before} after={v.value}/>:<>{v.before!=null&&<span className="crm-work-muted">{value(v.before)} → </span>}{value(v.value)}</>}</dd></div>)}</dl>}
 <CrmHistoryInformation focusedFields={windowMode&&focused?.id===g.id?focusRequest?.fields:undefined} group={g} items={information} allRows={extractions} loading={extractionLoading} error={extractionError} selectedCitation={citation} onEvidence={showEvidence} onViewAssessment={onViewAssessment}/>

 {amendments.length>0&&<section className="crm-history-amendments" aria-label={ui("本条记录的补充／修正")}>{amendments.map(a=>{const title=historyAmendmentTitle(a,information);return <article key={a.eventId} className="crm-history-amendment" data-related-to={g.id}><h4 className="crm-history-amendment-title">{ui(title.kind)}{title.labels.length>0&&<> · {title.labels.map(label=>ui(label)).join('、')}</>}</h4><CrmHistoryOriginal groupId={g.id} scope={a.payload.id||a.eventId} text={a.original||a.payload.text} citation={citation}/><CrmHistoryAttribution author={a.payload.staffName||a.actorName||a.actor} recordedAt={a.recordedAt}/>{a.payload.reason&&<p>{ui("原因：")}{a.payload.reason}</p>}{a.payload.contactResult&&<p>{ui("联系结果修正：")}{ui(contactCorrectionOptions.find(o=>o[0]===a.payload.contactResult)?.[1]||'')}</p>}<CrmHistoryInformation group={g} items={information} allRows={extractions} scope={a.payload.id||a.eventId} selectedCitation={citation} onEvidence={showEvidence} onViewAssessment={onViewAssessment}/></article>;})}</section>}


 <CrmHistorySources group={g} disabled={disabled} suspended={suspended} editing={!!target} primaryId={primary?.eventId} onAmend={setTarget}/>
 {editingHere&&<CrmRecordAmendmentForm key={target.eventId} target={target} lead={lead} timezone={timezone} isLight={isLight} canEditProfile={canEditProfile} suspended={suspended} onDirty={onDirty} onBusy={onBusy} onCancel={()=>setTarget(null)} onSaved={(r:any)=>{setTarget(null);setRetry(n=>n+1);setNotice('补充／修正已保存，原文和关联保留。'+profileSaveSummary(r.profileFieldResults)+(({satisfied:'首次跟进仍满足要求。',restored:'原首次跟进要求已恢复，原期限不变；没有重发旧通知。',needs_review:'原首次要求无法明确定位，请核对；没有新增任务。'}as any)[r.firstRequirementStatus]||''));onChanged?.();}}/>}
 </div></details></div>;
 })}</CrmHistoryStream></section></CrmHistorySearch.Provider>;
}
