import {useCrmUiText} from './CrmUiLanguage';
import {CrmFollowupEvent} from './CrmFollowupEvent';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {useId,useState} from 'react';
import {historyInformation} from '../../utils/crmHistoryInformation';
import {CrmFollowupFields,type FollowupField} from './CrmFollowupFields';
/** A single original interaction, with its derived changes attached instead of repeated quote cards. */
export function CrmGroupedFollowup({point,lead,lang,onEvidence}:any){
 const ui=useCrmUiText(lang),[expanded,setExpanded]=useState(false),originalId=useId();

 const changes=point.parts.flatMap((p:any)=>p.kind==='changes'?p.changes:p.kind==='hint'&&p.value.kind==='change'?[p]:[]);
 const recorded=point.origin.events?.length?historyInformation(point.origin).filter(v=>v.kind==='field'&&v.scope==='main'&&v.status==='applied'&&!v.superseded):[];
 const fields:FollowupField[]=recorded.length?recorded.map(v=>({id:v.id,field:v.field,value:v.value,before:v.before,beforeKnown:v.beforeKnown,batch:v.extractionIds.length?'ai:'+v.extractionIds.slice().sort().join(','):v.manualSourceId?'manual:'+v.manualSourceId:v.factIds.join(',')})):changes.map((c:any)=>({id:c.id,field:c.value.id.slice(7),value:lead[c.value.id.slice(7)],batch:c.id,currentOnly:true}));
 const source=point.origin.category==='message'?'客户对话':point.origin.category==='sales'?'销售记录':point.origin.category==='questionnaire'?'客户问卷':'资料编辑';
 const texts=[...new Set<string>(point.parts.map((p:any)=>p.kind==='message'?p.value.content:p.kind==='communication'?p.value.text:p.kind==='request'?p.value.data?.text:null).filter(Boolean))];
 const original=point.origin.original||texts[0]||'';
 const ai=point.parts.some((p:any)=>p.value?.id?.startsWith('text-signal:')||p.value?.presentationAiDerived)||point.origin.extractions.length>0;
 return <CrmFollowupEvent id={point.id} title={point.title} channel={source} aiDerived={ai} times={point.times} actions={<CrmEvidenceAction description={ui("查看本次互动的原文与整理依据")} onClick={()=>onEvidence(point.evidenceId)}/>}>
 {original&&<p id={originalId} className="crm-progress-original crm-followup-original-preview">{fields.length>0&&!expanded&&original.length>80?original.slice(0,80)+"…":original}</p>}
 {texts.filter(t=>t!==original&&!original.includes(t)).map((text,i)=><p key={i}>{text}</p>)}
 {!original&&point.parts.filter((p:any)=>p.kind==='hint'&&p.value.kind==='evidence').map((p:any)=><p key={p.id}>{p.value.text}</p>)}
 {point.parts.filter((p:any)=>p.kind==='hint'&&p.value.interactionCount>=2).map((p:any)=><small className="crm-work-muted" key={p.id}>{ui(p.value.text.split(' · ')[0])} {ui("· 近7天")}{p.value.interactionCount}{ui("条独立互动")}</small>)}
 {original&&fields.length>0&&original.length>80&&<button type="button" className="crm-work-link crm-followup-original-toggle" aria-expanded={expanded} aria-controls={originalId} onClick={()=>setExpanded(v=>!v)}>{ui(expanded?'收起原文':'展开原文')}</button>}
 {fields.length>0&&<CrmFollowupFields items={fields} lang={lang}/>}

 </CrmFollowupEvent>;
}
