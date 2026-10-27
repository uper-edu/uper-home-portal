import {CrmListAgreements} from './CrmListAgreements';
import {useCrmUiText} from './CrmUiLanguage';
import {groupFollowupInteractions} from '../../utils/crmFollowupGrouping';
import {CrmGroupedFollowup} from './CrmGroupedFollowup';
import {CrmFactMilestones} from './CrmFactMilestones';
import {CrmProfileValueChange} from './CrmProfileValueChange';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {crmSourcePresentation} from '../../utils/crmSourcePresentation';
import {profileFields} from '../../utils/crmDynamicProfile';
import {requestSourceLabel,salesRecentHints,hintOccurrenceTimes,sortFollowupOccurrences,followupWindowGroups,groupSameSourceChanges,profileChangeLabel,profileChangeValues} from '../../utils/crmFollowupPresentation';
import {CrmSalesBrief,profileDisplay} from './CrmSalesBrief';
import {projectInteractionTimeline} from '../../utils/crmInteractionTimeline';
import {useCrmExtractions} from './useCrmExtractions';
import {CrmFactLedger} from './CrmFactLedger';
import {CrmInformationHint} from './CrmImportantInformation';
import {CrmFollowupEvent} from './CrmFollowupEvent';
import {CrmInteractionTimelines} from './CrmInteractionTimelines';
import {useEffect,useRef,useState} from 'react';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {dynamicProfileHints} from '../../utils/crmDynamicProfile';
import {followupOverview} from '../../utils/crmFollowupOverview';
import {crmMessageTimestamp} from '../../utils/crmMessageTime';
import {agreementTime} from '../../utils/crmProgressDetails';
export function CrmSimpleAttention({lead,lang,timezone,isLight,disabled,children,feedback,onSource,onRefresh,onDirty,onBusy,modalSuspended,canEditProfile,recentSourceId,onViewAssessment,onViewProfile,onViewStage,stageFeedback,now:clockNow}:any){
 const ui=useCrmUiText(lang);

 const [clock,setClock]=useState(Date.now());const now=clockNow??clock;
 useEffect(()=>{if(clockNow!==undefined)return;const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer);},[clockNow]);
 const [data,setData]=useState<any>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0),[ledgerOpen,setLedgerOpen]=useState(false),[focusRequest,setFocusRequest]=useState<any>(null),[editing,setEditing]=useState(false),[factProjection,setFactProjection]=useState<any>({state:'loading',events:[]});const ledger=useRef<HTMLDetailsElement>(null),token=useRef(0);
 useEffect(()=>{if(recentSourceId){setLedgerOpen(true);setFocusRequest({id:recentSourceId,mode:'view',token:++token.current});}},[recentSourceId]);
 useEffect(()=>{let cancelled=false;setError(false);setData(null);fetch(`/api/crm/leads/${lead.id}/trust`).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!cancelled)setData(d);}).catch(()=>{if(!cancelled)setError(true);});return()=>{cancelled=true};},[lead.id,lead.simpleRevision,retry]);
 const extraction=useCrmExtractions(lead.id,lead.simpleRevision,recentSourceId,onRefresh);
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const evidence=(id:string,mode='view')=>{if(mode==='amend'&&editing)return;setLedgerOpen(true);setFocusRequest({id,mode,token:++token.current});};
 const freshHints=dynamicProfileHints(lead,now);
 const hints=[...(lead.informationHints||freshHints).filter((h:any)=>h.kind!=='change'),...freshHints.filter((h:any)=>h.kind==='change')],requests=[...(data?.requests||[])].sort((a:any,b:any)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const communication=projectInteractionTimeline(lead).communication;
 const visibleHints=salesRecentHints(lead,hints,v=>profileDisplay(v,lang)).map((h:any)=>{if(h.kind==='evidence'&&h.id?.startsWith('text-signal:')){const row=extraction.rows.find((r:any)=>h.evidenceIds?.includes(r.source_id));return {...h,presentationTitle:h.text.split(' · ')[0],presentationSource:row?.source_type==='customer_message'?'客户对话':row?.source_type==='sales_record'?'销售记录':row?.source_type==='sales_amendment'?'补充／修正':undefined,presentationAiDerived:Boolean(row)};}if(h.kind==='difference'&&h.id?.startsWith('difference:')){const field=h.id.slice(11),meta=lead.profileFieldMeta?.[field];if(meta){const differences=(meta.pendingDifferences||[]).filter((d:any)=>d.effective!==false&&!d.supersededBy&&h.evidenceIds?.includes(d.sourceFactId));return {...h,presentationField:profileFields[field]||field,presentationSource:'多份来源',presentationSources:[{label:'当前资料依据',value:profileDisplay(lead[field],lang),source:crmSourcePresentation(meta.sourceType),evidenceId:meta.sourceFactIds?.[0]},...differences.map((d:any,i:number)=>({label:'不同记录'+(i+1),value:profileDisplay(d.value,lang),source:crmSourcePresentation(d.sourceType),evidenceId:d.sourceFactId}))]};}}if(h.kind!=='change'||!h.id?.startsWith('change:'))return h;const field=h.id.slice(7),sourceType=lead.profileFieldMeta?.[field]?.sourceType,label=profileChangeLabel(lead,h,factProjection.events),values=profileChangeValues(lead,h,factProjection.events);return {...h,presentationLabel:label,presentationField:profileFields[field]||field,presentationChange:label==='资料变更'&&values?{before:profileDisplay(values.before,lang),after:values.after==null||typeof values.after==='string'&&!values.after.trim()||Array.isArray(values.after)&&!values.after.length?'已清空':profileDisplay(values.after,lang)}:undefined,presentationAiDerived:sourceType?crmSourcePresentation(sourceType).aiDerived:false,presentationSource:sourceType?crmSourcePresentation(sourceType).label:undefined,presentationText:sourceType?(profileFields[field]||field)+'：'+profileDisplay(lead[field],lang):h.text};});
 const openRecord=(id:string)=>evidence(id);
 const past=(lead.commitments||[]).filter((v:any)=>v.status!=='active');

 const requestOccurred=(r:any)=>{const d=r.data||{},m=(lead.chatTranscript||[]).find((m:any)=>m.role==='user'&&(!d.conversationId||m.conversation_id===d.conversationId)&&[d.messageId,d.sourceMessageId,d.requestId,r.source_id].filter(Boolean).some(id=>id===m.id||id===m.request_id));return m?crmMessageTimestamp(m):null;};
 const lastMessage=followupOverview(lead).message;const latest=lastMessage&&!requests.some((r:any)=>{const d=r.data||{};return (!d.conversationId||d.conversationId===lastMessage.conversation_id)&&[d.messageId,d.sourceMessageId,d.requestId,r.source_id].some(id=>id&&[lastMessage.id,lastMessage.request_id].includes(id));})?lastMessage:null;
 const points=sortFollowupOccurrences<any>([
  ...visibleHints.map((h:any)=>({id:'hint:'+h.id,kind:'hint',value:h,times:hintOccurrenceTimes(lead,h,extraction.rows,factProjection.events)})),
  ...requests.map((r:any)=>({id:'request:'+r.id,kind:'request',value:r,times:[{label:'实际发生',at:requestOccurred(r)}]})),
  ...(latest?[{id:'message:'+(latest.id||latest.request_id),kind:'message',value:latest,times:[{label:'实际发生',at:crmMessageTimestamp(latest)}]}]:[]),
  ...(communication?[{id:'communication:'+communication.id,kind:'communication',value:communication,times:[{label:'实际发生',at:communication.at||null}]}]:[])
 ]);
 const buckets=followupWindowGroups(points,now);
 const sections=[{id:'recent',title:'近7天动态',items:groupFollowupInteractions(groupSameSourceChanges(buckets.recent,lead,factProjection.events),lead,factProjection.events,extraction.rows)},{id:'important',title:'持续重要信息',items:groupFollowupInteractions(groupSameSourceChanges(buckets.important,lead,factProjection.events),lead,factProjection.events,extraction.rows)},{id:'unknown',title:'发生时间未注明',items:groupFollowupInteractions(groupSameSourceChanges(buckets.unknown,lead,factProjection.events),lead,factProjection.events,extraction.rows)}];
 return <div className="crm-followup-focus"><div className="crm-followup-save-feedback">{feedback}{recentSourceId&&<button type="button" className="crm-work-link" onClick={()=>openRecord(recentSourceId)}>{ui("查看本次记录")}</button>}</div>
 {feedback&&recentSourceId&&onViewStage&&canEditProfile&&<button type="button" className="crm-work-link" onClick={()=>onViewStage(recentSourceId)}>{ui("基于本次记录更新阶段")}</button>}
 {stageFeedback&&<p role="status" className="crm-stage-saved-notice">{stageFeedback}</p>}
 <CrmSalesBrief evidenceEvents={factProjection.events} lead={lead} lang={lang} isLight={isLight} onEvidence={evidence} onProfile={onViewProfile} onStage={onViewStage} canEdit={canEditProfile} milestones={<CrmFactMilestones key={lead.id} lead={lead} lang={lang} isLight={isLight}/>}/>
 <section className="crm-followup-now" aria-label={ui("沟通动态与重要信息")}><div className="crm-followup-section-heading"><h3>{t('Communication and important information','Komunikasi dan informasi penting','沟通动态与重要信息')}</h3></div>
 <CrmListAgreements lead={lead} lang={lang} timezone={timezone} detail now={now}/>
 <CrmInteractionTimelines lead={lead} lang={lang} timezone={timezone} isLight={isLight} summaryMode hideHeading/>
 {lead.firstRequirementReview&&<p role="note">{lead.firstRequirementReview}</p>}
 {error?<p role="alert">{ui("客户请求信息暂不可用")}<button type="button" className="crm-work-link" onClick={()=>setRetry(v=>v+1)}>{ui("重试")}</button></p>:!data&&<p role="status">{ui("正在读取客户请求…")}</p>}
 <div className="crm-followup-event-stream">{sections.filter(s=>s.items.length>0).map(section=><section key={section.id} className="crm-followup-time-group" aria-label={ui(section.title)}>{section.id!=='recent'&&<h4>{ui(section.title)}</h4>}{section.items.map((point:any)=><div key={point.id}>
 {point.kind==='interaction'?<CrmGroupedFollowup point={point} lead={lead} lang={lang} onEvidence={evidence}/>:point.kind==='changes'?<CrmFollowupEvent id={point.id} title={((new Set(point.changes.map((c:any)=>c.value.presentationLabel)).size===1?point.changes[0].value.presentationLabel:'资料变化')+' · '+point.changes.length + ui("项"))} channel={crmSourcePresentation(point.sourceType).label} aiDerived={crmSourcePresentation(point.sourceType).aiDerived} times={point.times} actions={<CrmEvidenceAction description={ui("查看这组资料的共同原文依据")} onClick={()=>evidence(point.commonEvidenceId)}/>}><dl className="crm-grouped-field-changes">{point.changes.map((change:any)=>{const field=change.value.id.slice(7);return <div key={change.id}><dt>{ui(profileFields[field]||field)}{new Set(point.changes.map((c:any)=>c.value.presentationLabel)).size>1&&<small className="crm-field-change-kind">{ui(change.value.presentationLabel)}</small>}</dt><dd>{change.value.presentationChange?<CrmProfileValueChange {...change.value.presentationChange}/>:profileDisplay(lead[field],lang)}</dd></div>;})}</dl></CrmFollowupEvent>:point.kind==='hint'?<CrmInformationHint hint={point.value} times={point.times} timeState={factProjection.state} onEvidence={id=>evidence(id)}/>:
 point.kind==='message'?<CrmFollowupEvent id={point.id} title={ui("最近客户消息")} channel="客户对话" times={point.times} actions={onSource&&point.value.conversation_id&&(point.value.id||point.value.request_id)?<CrmEvidenceAction kind="conversation" description={ui("在对话中查看原文与上下文")} onClick={()=>onSource({details:{sourceConversationId:point.value.conversation_id,sourceMessageId:point.value.id||point.value.request_id}})}/>:undefined}><p className="crm-progress-original">{point.value.content}</p></CrmFollowupEvent>:
 point.kind==='communication'?<CrmFollowupEvent id={point.id} title={ui("最近有效沟通")} channel={(ui("销售记录 · ") + profileDisplay(point.value.channel,lang))} times={point.times} actions={<CrmEvidenceAction kind="record" description={ui("查看这次有效沟通的完整记录")} onClick={()=>openRecord(point.value.id)}/>}><p className="crm-progress-original">{point.value.text||ui('该次记录未填写沟通内容。')}</p>{point.value.log?.amendments?.length>0&&<details><summary>{ui("另有")}{point.value.log.amendments.length} {ui("条补充／修正")}</summary>{point.value.log.amendments.map((v:any)=><p key={v.id}>{v.text}</p>)}</details>}</CrmFollowupEvent>:
 <CrmFollowupEvent id={point.id} title={ui("客户明确诉求")} channel={requestSourceLabel(point.value)==='客户对话原文' ? ui("客户对话") : requestSourceLabel(point.value)} times={point.times} actions={<CrmEvidenceAction kind={onSource&&point.value.data?.conversationId&&(point.value.data?.messageId||point.value.data?.sourceMessageId)?'conversation':'evidence'} description={ui("查看客户诉求的原文依据")} onClick={()=>{const d=point.value.data||{};if(onSource&&d.conversationId&&(d.messageId||d.sourceMessageId))onSource({details:{sourceConversationId:d.conversationId,sourceMessageId:d.messageId||d.sourceMessageId}});else evidence(point.value.source_id||point.value.id);}}/>}><p className="crm-progress-original">{point.value.data?.text||'原文未记录'}</p></CrmFollowupEvent>}
 </div>)}</section>)}</div>
 {!sections.some(s=>s.items.length)&&!error&&data&&<p className="crm-work-muted">{ui("当前没有额外变化提示；未记录的信息不代表客户没有相关需求。")}</p>}

 {past.length>0&&<details className="crm-followup-secondary"><summary>{ui("客户约定历史 ·")}{past.length}</summary>{past.map((a:any)=><div key={a.id}><p>{a.action}</p><small>{agreementTime(a,timezone,lang)} · {ui(({fulfilled:'已履行',cancelled:'已取消',rescheduled:'已改约'} as any)[a.status])}</small>{a.reason&&<p>{a.reason}</p>}</div>)}</details>}
 {lead.nextAction&&<details className="crm-followup-secondary"><summary>{ui("客户人工备注")}</summary><p className="crm-progress-original">{lead.nextAction}</p></details>}
 </section>

 <details className="crm-followup-source-section" open={ledgerOpen} ref={ledger} onToggle={e=>setLedgerOpen(e.currentTarget.open)}><summary><span>{ui("历史记录与依据")}</span><span>{ui("按原始互动追溯")}</span></summary><div className="crm-followup-source-body"><CrmFactLedger lang={lang} key={lead.id} onProjection={setFactProjection} hideHeading focusRequest={focusRequest} onEditing={setEditing} leadId={lead.id} lead={lead} onDirty={onDirty} onBusy={onBusy} suspended={modalSuspended} canEditProfile={canEditProfile} isLight={isLight} revision={lead.simpleRevision} timezone={timezone} disabled={disabled} onChanged={onRefresh} extractions={extraction.rows} extractionLoading={extraction.loading} extractionError={extraction.error} onReloadExtraction={extraction.reload} onViewAssessment={onViewAssessment} onSource={onSource} requests={data?.requests||[]}/></div></details>
 {children}
 </div>;
}
