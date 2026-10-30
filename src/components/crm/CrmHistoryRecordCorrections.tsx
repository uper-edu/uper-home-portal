import type {HistoryGroup} from '../../utils/crmHistoryTimeline';
import type {HistoryInformation} from '../../utils/crmHistoryInformation';
import {historyRecordCorrections} from '../../utils/crmHistoryCardContent';
import {historyInformationValue} from './CrmHistoryInformation';
import {CrmSearchHighlight} from './CrmSearchHighlight';
import {useCrmUiLanguage,useCrmUiText} from './CrmUiLanguage';
import {insightLabel} from '../../utils/crmCustomerInsights';

export function CrmHistoryRecordCorrections({group,items,onEvidence}:{group:HistoryGroup;items:HistoryInformation[];onEvidence?:(scope:string)=>void}){
 const ui=useCrmUiText(),lang=useCrmUiLanguage(),corrections=historyRecordCorrections(group,items);
 if(!corrections.length)return null;
 return <section className="crm-history-record-corrections" aria-label={ui('本条记录修正后')}>
  <h4>{ui('本条记录修正后')}</h4>
  <dl className="crm-history-details">{corrections.map(item=><div key={item.id}>
   <dt>{item.kind==='insight'&&item.observation?.dimension?insightLabel(item.observation.dimension,lang):ui(item.label)}</dt>
   <dd><CrmSearchHighlight text={historyInformationValue(item.field,item.value,lang)}/></dd>
  </div>)}</dl>
  {onEvidence&&[...new Set(corrections.map(item=>item.scope))].map(scope=><button key={scope} type="button" className="crm-work-link" onClick={()=>onEvidence(scope)}>{ui('查看修正依据')}{corrections.some(item=>item.scope!==scope)?' · '+corrections.filter(item=>item.scope===scope).map(item=>ui(item.label)).join('、'):''}</button>)}
 </section>;
}
