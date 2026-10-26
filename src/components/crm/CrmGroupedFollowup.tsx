import {useCrmUiText} from './CrmUiLanguage';
import {CrmFollowupEvent} from './CrmFollowupEvent';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {CrmProfileValueChange} from './CrmProfileValueChange';
import {profileDisplay} from './CrmSalesBrief';
import {profileFields} from '../../utils/crmDynamicProfile';
/** A single original interaction, with its derived changes attached instead of repeated quote cards. */
export function CrmGroupedFollowup({point,lead,lang,onEvidence}:any){
 const ui=useCrmUiText(lang);

 const changes=point.parts.flatMap((p:any)=>p.kind==='changes'?p.changes:p.kind==='hint'&&p.value.kind==='change'?[p]:[]);
 const source=point.origin.category==='message'?'客户对话':point.origin.category==='sales'?'销售记录':point.origin.category==='questionnaire'?'客户问卷':'资料编辑';
 const texts=[...new Set<string>(point.parts.map((p:any)=>p.kind==='message'?p.value.content:p.kind==='communication'?p.value.text:p.kind==='request'?p.value.data?.text:null).filter(Boolean))];
 const original=point.origin.original||texts[0]||'';
 const ai=point.parts.some((p:any)=>p.value?.id?.startsWith('text-signal:')||p.value?.presentationAiDerived)||point.origin.extractions.length>0;
 return <CrmFollowupEvent id={point.id} title={point.title} channel={source} aiDerived={ai} times={point.times} actions={<CrmEvidenceAction description={ui("查看本次互动的原文与整理依据")} onClick={()=>onEvidence(point.evidenceId)}/>}>
 {original&&<p className="crm-progress-original">{original}</p>}
 {texts.filter(t=>t!==original&&!original.includes(t)).map((text,i)=><p key={i}>{text}</p>)}
 {!original&&point.parts.filter((p:any)=>p.kind==='hint'&&p.value.kind==='evidence').map((p:any)=><p key={p.id}>{p.value.text}</p>)}
 {point.parts.filter((p:any)=>p.kind==='hint'&&p.value.interactionCount>=2).map((p:any)=><small className="crm-work-muted" key={p.id}>{ui(p.value.text.split(' · ')[0])} {ui("· 近7天")}{p.value.interactionCount}{ui("条独立互动")}</small>)}
 {changes.length>0&&<dl className="crm-grouped-field-changes">{changes.map((c:any)=>{const field=c.value.id.slice(7);return <div key={c.id}><dt>{ui(profileFields[field]||field)}</dt><dd>{c.value.presentationChange?<CrmProfileValueChange {...c.value.presentationChange}/>:profileDisplay(lead[field],lang)}</dd></div>;})}</dl>}
 </CrmFollowupEvent>;
}
