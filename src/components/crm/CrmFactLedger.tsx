import {useCrmUiText} from './CrmUiLanguage';
import {CrmSalesStageChange} from './CrmSalesStage';
import {CrmSingleSelect} from './CrmSingleSelect';
import {historyInformation,type HistoryCitation} from '../../utils/crmHistoryInformation';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {CrmHistoryInformation,CrmHistoryOriginal,historyOriginalId} from './CrmHistoryInformation';
import {CrmHistorySources} from './CrmHistorySources';
import {CrmHistoryAttribution} from './CrmHistoryAttribution';
import {revealRecord} from '../adminScroll';
import {locateLedgerEvent} from '../../utils/crmFollowupPresentation';
import {buildHistoryTimeline,historyCategories,historyGroupFor,historyChanges,historyAssessment,historyContactCorrection,historyStructuredFields,historyPreview} from '../../utils/crmHistoryTimeline';
import {profileSaveSummary} from '../../utils/crmProfileSaveResult';
import {viewerTimeZone,formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import {useEffect,useState,useRef,useId} from 'react';
import {crmValue} from '../../utils/crmLanguage';
import {MessageSquareText,NotebookText,ClipboardList,GraduationCap,UserRoundPen,FileSearch,ChevronDown,RefreshCw} from 'lucide-react';
import {CrmRecordAmendmentForm}from'./CrmRecordAmendmentForm';
import {CrmSaveFeedback}from'./CrmDetailWorkspace';
import {contactCorrectionOptions}from'../../utils/crmRecordAmendments';
import {progressDetails} from '../../utils/crmProgressDetails';
const amendable=new Set(['followup.recorded','task.request_evidence','questionnaire.submitted','profile.fields_updated']);
const icons:any={message:MessageSquareText,sales:NotebookText,questionnaire:ClipboardList,assessment:GraduationCap,profile:UserRoundPen,other:FileSearch};
const value=(v:any)=>v==null?'未填写':Array.isArray(v)?v.map(x=>crmValue(String(x),'zh')).join('、'):typeof v==='object'?'结构化信息':crmValue(String(v),'zh');
export function CrmFactLedger({leadId,lead,revision,timezone,disabled,onChanged,onDirty,onBusy,suspended,canEditProfile,isLight=true,lang='zh',focusRequest,onEditing,hideHeading=false,onProjection,extractions=[],extractionLoading=false,extractionError=false,onReloadExtraction,onViewAssessment,onSource,requests=[]}:any){
 const ui=useCrmUiText(lang);

 const typeId=useId(),searchId=useId();
 const[data,setData]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[target,setTarget]=useState<any>(null),[notice,setNotice]=useState(''),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[expanded,setExpanded]=useState<Set<string>>(new Set()),[evidenceSelection,setEvidenceSelection]=useState<{groupId:string;citation:HistoryCitation}|null>(null);
 useEffect(()=>{let active=true;setError('');onProjection?.({state:'loading',events:[]});fetch(`/api/crm/leads/${leadId}/facts`).then(async r=>{if(!r.ok)throw Error('历史依据暂不可用，请重试');return r.json();}).then(d=>{if(active){setData(d);onProjection?.({state:'ready',events:d.events});}}).catch(e=>{if(active){setError(e.message);onProjection?.({state:'error',events:[]});}});return()=>{active=false};},[leadId,revision,retry]);
 const handled=useRef<any>(null),positioned=useRef<any>(null),focusNode=useRef<HTMLDetailsElement>(null),groups=buildHistoryTimeline(data?.events||[],lead,extractions),focused=focusRequest&&data?historyGroupFor(groups,focusRequest.id):null;
 useEffect(()=>{onEditing?.(!!target)},[target]);
 useEffect(()=>{
  if(!data||!focusRequest||handled.current===focusRequest.token)return;
  if(!focused){if(extractionLoading)return;setNotice('未在当前历史中定位该依据，原记录不会被删除；可重试读取或核对原始记录。');handled.current=focusRequest.token;return;}
  if(target)return;
  handled.current=focusRequest.token;setFilter('all');setSearch('');setExpanded(v=>new Set([...v,focused.id]));setNotice('已定位对应原始记录。');
  const row=locateLedgerEvent(data.events,focusRequest.id);if(focusRequest.mode==='amend'&&!disabled&&row&&amendable.has(row.eventType))setTarget(row);
 },[data,focusRequest,disabled,target,focused?.id,extractionLoading]);
 useEffect(()=>{
  if(!focusRequest||!focused||positioned.current===focusRequest.token||filter!=='all'||search||!expanded.has(focused.id)||target)return;
  const summary=focusNode.current?.querySelector('summary');if(!summary)return;
  const pane=summary.closest<HTMLElement>('.crm-customer-panel-body');
  if(pane&&['auto','scroll'].includes(getComputedStyle(pane).overflowY)&&pane.scrollHeight>pane.clientHeight)revealRecord(pane,summary);
  else summary.scrollIntoView({block:'start'});
  summary.focus({preventScroll:true});positioned.current=focusRequest.token;
 },[focusRequest,focused?.id,filter,search,expanded,target]);
 const time=(v:string|null)=>v?formatCrmOperatingTime(v,viewerTimeZone()):'未注明';
 const visible=groups.filter(g=>(filter==='all'||g.category===filter)&&(!search.trim()||[g.title,g.original,...g.events.map(e=>e.original||''),...g.extractions.map(r=>r.input?.text||'')].join('\n').toLowerCase().includes(search.trim().toLowerCase())));
 const day=(g:any)=>g.occurredAt?time(g.occurredAt).slice(0,10):'发生时间未注明';
 return <section className="crm-history-timeline" aria-label={ui("历史记录与依据")}>{!hideHeading&&<h3>{ui("历史记录与依据")}</h3>}
 <div className="crm-history-toolbar" role="group" aria-label={ui("历史记录筛选")}>
 <div className="crm-history-type-filter"><label htmlFor={typeId}>{ui("类型")}</label><CrmSingleSelect controlId={typeId} label={ui("历史记录类型")} value={filter} disabled={!!target} onChange={setFilter} lang={lang} isLight={isLight} options={Object.entries(historyCategories).map(([key,label])=>({value:key,label:ui(label)+(data?'（'+(key==='all'?groups.length:groups.filter(g=>g.category===key).length)+'）':'')}))}/></div>
 <div className="crm-history-search"><label htmlFor={searchId}>{ui("搜索原文与内容")}</label><input id={searchId} type="search" aria-label={ui("搜索历史记录")} value={search} disabled={!!target} onChange={e=>setSearch(e.target.value)}/></div>
 <button type="button" className="crm-work-button crm-history-refresh" disabled={!!target} onClick={()=>{setRetry(n=>n+1);onReloadExtraction?.();}}><RefreshCw size={15} aria-hidden="true"/>{ui("刷新记录")}</button></div>

 {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>{ui("重试读取")}</button></p>}
 {extractionError&&<p role="alert">{ui("AI整理状态暂不可用，原始记录仍保留。")}<button onClick={onReloadExtraction}>{ui("重试AI整理状态")}</button></p>}
 {!data&&!error&&<p role="status">{ui("正在读取历史依据…")}</p>}{data&&!visible.length&&<p>{groups.length ? ui("没有符合筛选的记录。") : ui("尚无历史记录。")}</p>}
 {visible.map((g,i)=>{const Icon=icons[g.category]||FileSearch,correction=historyContactCorrection(g,lead),changes=g.events.flatMap(e=>historyChanges(e).map((c:any)=>({...c,eventId:e.eventId}))),amendments=g.events.filter(e=>e.eventType==='record.amended'),root=g.root,primary=g.events.find(e=>e.eventType==='followup.recorded')||g.events.find(e=>e.eventType==='questionnaire.submitted')||g.events.find(e=>e.eventType==='task.request_evidence')||g.events.find(e=>amendable.has(e.eventType)),editingHere=!!target&&g.events.some(e=>e.eventId===target.eventId),message=g.events.find(e=>e.eventType==='customer.message'),information=historyInformation(g,extractions),citation=evidenceSelection?.groupId===g.id?evidenceSelection.citation:null;
 const showEvidence=(c:HistoryCitation)=>{setEvidenceSelection({groupId:g.id,citation:c});requestAnimationFrame(()=>{const node=document.getElementById(historyOriginalId(g.id,c.scope));if(!node)return;const disclosure=node.closest('details');if(disclosure)disclosure.open=true;const mark=node.querySelector<HTMLElement>('mark')||node,pane=node.closest<HTMLElement>('.crm-customer-panel-body');if(pane)revealRecord(pane,mark);else mark.scrollIntoView({block:'nearest'});mark.focus({preventScroll:true});});};
 return <div key={g.id}>{(i===0||day(visible[i-1])!==day(g))&&<h4 className="crm-history-date">{day(g)}</h4>}
 <details data-history-id={g.id} className="crm-history-node" ref={g.id===focused?.id?focusNode:undefined} open={editingHere||expanded.has(g.id)} onToggle={e=>{const open=e.currentTarget.open;setExpanded(v=>{if(v.has(g.id)===open)return v;const n=new Set(v);open?n.add(g.id):n.delete(g.id);return n;});}}>
 <summary><span className="crm-history-icon"><Icon size={17} aria-hidden="true"/></span><div className="crm-history-summary"><div className="crm-history-head"><strong>{g.root?.eventType==='stage.changed'?<>{ui("销售阶段：")}<CrmSalesStageChange before={g.root.payload.before} after={g.root.payload.after}/></>:ui(g.title)}</strong><span className="crm-history-when">{g.occurredAt ? <time dateTime={g.occurredAt} title={viewerTimeZone()}>{time(g.occurredAt)}</time> : ui("实际发生时间未注明")}</span><ChevronDown className="crm-history-chevron" size={16} aria-hidden="true"/></div><div className="crm-history-meta">{ui(historyCategories[g.category])}{g.log?.channel?' · '+crmValue(g.log.channel,lang):''}{changes.length ? (' · '+changes.length + ui("项资料记录")) : ''}{amendments.length ? (' · '+amendments.length + ui("条补充／修正")) : ''}{g.extractions.some(r=>r.status==='failed') ? ui(" · AI整理未完成") : ''}{correction ? (ui(" · 联系结果已修正：") + contactCorrectionOptions.find(o=>o[0]===correction.contactResult)?.[1]) : ''}</div>{historyPreview(g)&&<p className="crm-history-preview">{historyPreview(g)}</p>}</div></summary>
 <div className="crm-history-body">
 {root?.effective===false&&<p className="crm-work-muted">{ui("原依据已有历史调整，原文保留。")}</p>}
 {correction&&<p role="note"><strong>{ui("当前采用的联系结果：")}{contactCorrectionOptions.find(o=>o[0]===correction.contactResult)?.[1]}</strong>{ui("；下方保留原记录当时填写的联系信息。")}</p>}
 <h4>{g.category==='assessment' ? ui("测评原始结果") : ui("原文与当时记录")}</h4>{g.category==='assessment'?<><p><strong>{historyAssessment(g).conclusion}</strong></p><p>{historyAssessment(g).detail}</p><button className="crm-work-link" type="button" onClick={onViewAssessment}>{ui("查看历次测评")}</button></>:g.original?g.category==='questionnaire'?<details className="crm-history-original-answers"><summary>{ui("查看问卷原始答案")}</summary><CrmHistoryOriginal groupId={g.id} text={g.original} citation={citation}/></details>:<CrmHistoryOriginal groupId={g.id} text={g.original} citation={citation}/>:<p>{ui("原记录为结构化信息，相关字段见下方。")}</p>}
 <CrmHistoryAttribution author={g.log?.staffName||root?.payload?.staffName||root?.actorName||root?.actor} recordedAt={g.recordedAt}/>
 {message&&onSource&&<CrmEvidenceAction kind="conversation" description={ui("查看对话与上下文")} onClick={()=>onSource({details:{sourceConversationId:message.payload?.conversationId,sourceMessageId:message.sourceRecordId}})}/>}
 {g.log&&<dl className="crm-history-details">{progressDetails(g.log,lead,requests,'zh',timezone).filter(row=>!['实际发生时间','记录类型','联系渠道','本次记录的阶段事实','新增购买信号'].includes(row.label)&&!row.label.startsWith('资料更新 · ')).map(row=><div key={ui(row.label)}><dt>{correction&&['实际联系结果','首次跟进处理结果'].includes(row.label) ? (ui("原记录中的") + row.label) : row.label}</dt><dd>{row.label==='销售阶段变更'&&g.log?.newStage?<CrmSalesStageChange before={g.log.expectedStage} after={g.log.newStage}/>:row.value}</dd></div>)}</dl>}

 {g.log?.sourceMessageId&&g.log?.sourceConversationId&&onSource&&<CrmEvidenceAction kind="conversation" description={ui("查看关联客户原文")} onClick={()=>onSource({details:{sourceConversationId:g.log.sourceConversationId,sourceMessageId:g.log.sourceMessageId}})}/>}
 {['profile.changed','stage.changed'].includes(root?.eventType)&&<dl className="crm-history-details">{historyStructuredFields(root).map(v=><div key={v.key}><dt>{v.label}</dt><dd>{v.key==='currentStage'?<CrmSalesStageChange before={v.before} after={v.value}/>:<>{v.before!=null&&<span className="crm-work-muted">{value(v.before)} → </span>}{value(v.value)}</>}</dd></div>)}</dl>}
 <CrmHistoryInformation group={g} items={information} allRows={extractions} loading={extractionLoading} error={extractionError} selectedCitation={citation} onEvidence={showEvidence} onViewAssessment={onViewAssessment}/>
 {!disabled&&g.events.filter(e=>e.eventType==='profile.fields_updated'&&e.eventId!==primary?.eventId).map((e,j)=><button key={e.eventId} type="button" className="crm-work-link" disabled={!!target||suspended} onClick={()=>setTarget(e)}>{ui("补充／修正资料依据")}{g.events.filter(v=>v.eventType==='profile.fields_updated').length>1?' · '+(j+1):''}</button>)}
 {amendments.length>0&&<section><h4>{ui("关联补充／修正")}</h4>{amendments.map(a=><article key={a.eventId} className="crm-history-amendment"><strong>{a.payload.kind==='correction' ? ui("修正误记") : ui("补充说明")}</strong><CrmHistoryOriginal groupId={g.id} scope={a.payload.id||a.eventId} text={a.original||a.payload.text} citation={citation}/><CrmHistoryAttribution author={a.payload.staffName||a.actorName||a.actor} recordedAt={a.recordedAt}/>{a.payload.reason&&<p>{ui("原因：")}{a.payload.reason}</p>}{a.payload.contactResult&&<p>{ui("联系结果修正：")}{contactCorrectionOptions.find(o=>o[0]===a.payload.contactResult)?.[1]}</p>}<CrmHistoryInformation group={g} items={information} allRows={extractions} scope={a.payload.id||a.eventId} selectedCitation={citation} onEvidence={showEvidence} onViewAssessment={onViewAssessment}/></article>)}</section>}

 {!disabled&&primary&&<button type="button" className="crm-work-link" disabled={!!target||suspended} onClick={()=>{setNotice('');setTarget(primary);}}>{ui("补充／修正本记录")}</button>}
 <CrmHistorySources group={g} disabled={disabled} suspended={suspended} editing={!!target} primaryId={primary?.eventId} onAmend={setTarget}/>
 {editingHere&&<CrmRecordAmendmentForm key={target.eventId} target={target} lead={lead} timezone={timezone} isLight={isLight} canEditProfile={canEditProfile} suspended={suspended} onDirty={onDirty} onBusy={onBusy} onCancel={()=>setTarget(null)} onSaved={(r:any)=>{setTarget(null);setRetry(n=>n+1);setNotice('补充／修正已保存，原文和关联保留。'+profileSaveSummary(r.profileFieldResults)+(({satisfied:'首次跟进仍满足要求。',restored:'原首次跟进要求已恢复，原期限不变；没有重发旧通知。',needs_review:'原首次要求无法明确定位，请核对；没有新增任务。'}as any)[r.firstRequirementStatus]||''));onChanged?.();}}/>}
 </div></details></div>;
 })}</section>;
}
