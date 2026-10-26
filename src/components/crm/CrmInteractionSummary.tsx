import {useCrmUiText} from './CrmUiLanguage';
import {CrmContactResult} from './CrmContactResult';
import {Clock3} from 'lucide-react';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import type {InteractionEvent} from '../../utils/crmInteractionTimeline';
export function CrmInteractionUnknownTime({children}:{children:React.ReactNode}){return <span className="crm-interaction-unknown"><Clock3 size={13} aria-hidden="true"/>{children}</span>;}
/** Summary time is information, while the record action opens the original. */
export function CrmInteractionSummary({event,title,time,source,channel,result,timezone,onOpen}:{event:InteractionEvent;title:string;time:string;source:string;channel:string;result?:string;timezone:string;onOpen:()=>void}){
 const ui=useCrmUiText();

 return <div className="crm-interaction-summary-content"><div className="crm-interaction-summary-time"><span className="crm-interaction-stamp">{event.at?<time dateTime={event.at} title={timezone}>{time}</time>:<CrmInteractionUnknownTime>{time}</CrmInteractionUnknownTime>}</span><CrmEvidenceAction kind="record" description={(ui("查看原始记录：") + title)} onClick={onOpen}/></div><p className="crm-interaction-meta">{[source,channel].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ')}{result&&<> · <CrmContactResult result={event.result}>{result}</CrmContactResult></>}</p>{(event.undatedCount||0)>0&&(event.at||(event.undatedCount||0)>1)&&<p className="crm-interaction-meta"><CrmInteractionUnknownTime>{ui("发生时间未注明记录 ·")}{event.undatedCount}</CrmInteractionUnknownTime></p>}</div>;
}
