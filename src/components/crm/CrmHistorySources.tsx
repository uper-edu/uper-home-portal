import {useCrmUiText} from './CrmUiLanguage';
import {CrmSalesStageChange} from './CrmSalesStage';
import React from 'react';
import {historyAdditionalSources} from '../../utils/crmHistorySources';
import {crmValue} from '../../utils/crmLanguage';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {CrmHistoryAttribution} from './CrmHistoryAttribution';
const display=(v:any):string=>v==null||v===''?'未填写':Array.isArray(v)?v.map(display).join('、'):typeof v==='object'?'结构化信息':crmValue(String(v),'zh');
export function CrmHistorySources({group,disabled,suspended,editing,primaryId,onAmend}:any){
 const ui=useCrmUiText();

 const entries=historyAdditionalSources(group);if(!entries.length)return null;
 return <details className="crm-evidence-explanation crm-history-sources"><summary>{ui("更多来源与变更")}</summary>{entries.map(({event,title,fields,original,reason})=><article key={event.eventId} className="crm-history-additional-source"><h4>{title}</h4>
  {event.occurredAt&&event.occurredAt!==group.occurredAt&&<p className="crm-work-muted">{ui("实际发生于")}<time dateTime={event.occurredAt}>{formatCrmOperatingTime(event.occurredAt,viewerTimeZone())}</time></p>}
  {!!fields.length&&<dl className="crm-history-details">{fields.map((f,i)=><div key={i}><dt>{f.label}</dt><dd>{f.key==='currentStage'?<CrmSalesStageChange before={f.before} after={f.value}/>:<>{f.before!=null&&<span className="crm-work-muted">{display(f.before)} → </span>}{display(f.value)}</>}</dd></div>)}</dl>}
  {original&&<blockquote className="crm-progress-original">{original}</blockquote>}{reason&&<p>{ui("原因：")}{reason}</p>}
  {event.eventId!==group.root?.eventId&&<CrmHistoryAttribution author={event.payload?.staffName||event.actorName||event.actor} recordedAt={event.recordedAt}/>}
  {!disabled&&event.eventType==='task.request_evidence'&&event.eventId!==primaryId&&onAmend&&<button type="button" className="crm-work-link" disabled={editing||suspended} onClick={()=>onAmend(event)}>{ui("补充／修正此项依据")}</button>}
 </article>)}</details>;
}
