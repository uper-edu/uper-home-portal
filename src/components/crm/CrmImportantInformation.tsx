import {useCrmUiText} from './CrmUiLanguage';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {CrmAiIndicator} from './CrmAiIndicator';
import {CrmProfileValueChange} from './CrmProfileValueChange';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {CrmFollowupEvent,type OccurrenceLabel} from './CrmFollowupEvent';
/** All hints remain visible. No receipt, resolution, owner or task state. */
export function CrmInformationHint({hint:h,onEvidence,times,timeState='ready'}:{hint:any;onEvidence?:(id:string)=>void;times?:OccurrenceLabel[];timeState?:string}){
 const ui=useCrmUiText();

 return <CrmFollowupEvent id={'hint:'+h.id} kind={h.kind} title={h.kind==='difference' ? (h.presentationField?h.presentationField+' · 信息差异':'信息差异') : h.kind==='change' ? (h.presentationLabel||'资料变化') : h.kind==='agreement' ? ui("客户约定") : h.presentationTitle||'客户信息'} channel={h.presentationSource} aiDerived={h.presentationAiDerived} times={h.presentationSources?.length?[]:times} timeState={timeState} actions={!h.presentationSources?.length&&h.evidenceIds?.[0]&&onEvidence?<CrmEvidenceAction description={ui("查看此条信息的原文依据")} onClick={()=>onEvidence(h.evidenceIds[0])}/>:undefined}><>{h.presentationSources?.length?<div className="crm-hint-source-list">{h.presentationSources.map((s:any,i:number)=><div key={i}><div><strong>{ui(s.label)}</strong><span> · {ui(s.source.label)}</span>{s.source.aiDerived&&<CrmAiIndicator/>}</div><p>{s.value}</p><div className="crm-hint-source-evidence"><span className="crm-work-muted">{(()=>{const at=times?.find(v=>v.label===s.label+'发生')?.at;return at?<time dateTime={at} title={viewerTimeZone()}>{formatCrmOperatingTime(at,viewerTimeZone())}</time>:timeState==='loading'?'正在核对发生时间…':timeState==='error'?'发生时间依据暂不可用':'实际发生时间未注明';})()}</span>{s.evidenceId&&onEvidence&&<CrmEvidenceAction description={((ui("查看") + ui(s.label)) + ui("的原文依据"))} onClick={()=>onEvidence(s.evidenceId)}/>}</div></div>)}</div>:h.presentationChange?<div className="crm-single-field-change"><span>{ui(h.presentationField)}：</span><CrmProfileValueChange {...h.presentationChange}/></div>:<p className="crm-progress-original">{h.presentationText||h.text}</p>}</></CrmFollowupEvent>;
}
export function CrmImportantInformation({hints,onEvidence,times,timeState='ready'}: {hints:any[];onEvidence?:(id:string)=>void;times?:(hint:any)=>OccurrenceLabel[];timeState?:string}){
 const ui=useCrmUiText();

 return <section aria-label={ui("画像重要信息")}>{hints.map(h=><CrmInformationHint key={h.id} hint={h} onEvidence={onEvidence} times={times?.(h)} timeState={timeState}/>)}</section>;
}
