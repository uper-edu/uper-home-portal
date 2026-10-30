import {crmUiText} from '../../utils/crmUiText';
import {useCrmUiText,useCrmUiLanguage} from './CrmUiLanguage';
import {CrmSalesStageChange} from './CrmSalesStage';
import React from 'react';
import {historyAdditionalSources} from '../../utils/crmHistorySources';
import {crmValue} from '../../utils/crmLanguage';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {CrmHistoryAttribution} from './CrmHistoryAttribution';
const display=(v:any,lang:any):string=>v==null||v===''?crmUiText('未填写',lang):Array.isArray(v)?v.map(x=>display(x,lang)).join(lang==='zh'?'、':', '):typeof v==='object'?crmUiText('结构化信息',lang):crmValue(String(v),lang);
export function CrmHistorySources({group,disabled,suspended,editing,primaryId,onAmend,representedRoot=false}:any){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();

 const entries=historyAdditionalSources(group).filter(entry=>!representedRoot||entry.event.eventId!==group.root?.eventId);if(!entries.length)return null;
 return <details className="crm-evidence-explanation crm-history-sources"><summary>{ui("更多来源与变更")}</summary>{entries.map(({event,title,fields,original,reason})=><article key={event.eventId} className="crm-history-additional-source"><h4>{ui(title)}</h4>
  {event.occurredAt&&event.occurredAt!==group.occurredAt&&<p className="crm-work-muted">{ui("实际发生于")}<time dateTime={event.occurredAt}>{formatCrmOperatingTime(event.occurredAt,viewerTimeZone())}</time></p>}
  {!!fields.length&&<dl className="crm-history-details">{fields.map((f,i)=><div key={i}><dt>{ui(f.label)}</dt><dd>{f.key==='currentStage'?<CrmSalesStageChange before={f.before} after={f.value}/>:<>{f.before!=null&&<span className="crm-work-muted">{display(f.before,lang)} → </span>}{f.key?display(f.value,lang):ui(display(f.value,lang))}</>}</dd></div>)}</dl>}
  {original&&<blockquote className="crm-progress-original">{original}</blockquote>}{reason&&<p>{ui("原因：")}{reason}</p>}
  {event.eventId!==group.root?.eventId&&<CrmHistoryAttribution author={event.payload?.staffName||event.actorName||event.actor} recordedAt={event.recordedAt}/>}
  {!disabled&&event.eventType==='task.request_evidence'&&event.eventId!==primaryId&&onAmend&&<button type="button" className="crm-work-link" disabled={editing||suspended} onClick={()=>onAmend(event)}>{ui("补充／修正此项依据")}</button>}
 </article>)}</details>;
}
