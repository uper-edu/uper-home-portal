import {useCrmUiText} from './CrmUiLanguage';
import {CrmAiIndicator} from './CrmAiIndicator';
import type {ReactNode} from 'react';
import {formatCrmOperatingTime,formatCrmSummaryTime,viewerTimeZone} from '../../utils/crmOperatingTime';
export type OccurrenceLabel={label:string;at:string|null};
/** One reading pattern for evidence, messages and human communication. */
export function CrmFollowupEvent({title,channel,aiDerived=false,times=[],timeState='ready',children,actions,kind,id}: {title:string;channel?:string;aiDerived?:boolean;times?:OccurrenceLabel[];timeState?:string;children:ReactNode;actions?:ReactNode;kind?:string;id?:string}){
 const ui=useCrmUiText();

 return <article className="crm-followup-event" data-kind={kind} data-point-id={id} aria-label={ui(title)}><header className="crm-followup-event-header"><strong>{ui(title)}{channel&&<span> · {ui(channel)}{aiDerived&&<CrmAiIndicator/>}</span>}</strong><div className="crm-followup-event-time">{times.map((v,i)=><span key={i}>{v.at ? <>{times.length>1?ui(v.label)+'：':v.label==='资料更新'?ui('资料更新于')+' ':null} <time dateTime={v.at} title={formatCrmOperatingTime(v.at,viewerTimeZone())+' · '+viewerTimeZone()} aria-label={formatCrmOperatingTime(v.at,viewerTimeZone())+' · '+viewerTimeZone()}>{formatCrmSummaryTime(v.at,viewerTimeZone())}</time></> : v.label.includes('无单独') ? v.label : timeState==='loading' ? ui("正在核对发生时间…") : timeState==='error' ? ui("发生时间依据暂不可用") : times.length===1 ? ui("实际发生时间未注明") : (v.label + ui("：未注明"))}</span>)}</div><div className="crm-followup-event-actions">{actions}</div></header><div className="crm-followup-event-body">{children}</div></article>;
}
