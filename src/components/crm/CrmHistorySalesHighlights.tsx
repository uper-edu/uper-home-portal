import {useCrmUiLanguage,useCrmUiText} from './CrmUiLanguage';
import {historyInformationValue,historyOriginalId} from './CrmHistoryInformation';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {CrmSearchHighlight} from './CrmSearchHighlight';
import {insightLabel} from '../../utils/crmCustomerInsights';
import {historyCitationKey,type HistoryCitation} from '../../utils/crmHistoryInformation';
import {crmUiText} from '../../utils/crmUiText';
import type {HistorySalesPoint} from '../../utils/crmHistorySalesContent';

export const historyPointLabel=(point:HistorySalesPoint,lang:string)=>point.item.kind==='insight'&&point.item.observation?.dimension?insightLabel(point.item.observation.dimension,lang):crmUiText(point.label,lang);
/** Qualifiers must keep their actual condition/negation visible, not merely qualify a positive noun.
 * Use only saved, already source-validated quotations; this is not new semantic interpretation. */
export function historyPointQualifiedQuotes(point:HistorySalesPoint){
 const observation=point.item.observation;
 if(!observation||!(['negated','conditional'].includes(observation.temporality)||['remove','withdraw'].includes(observation.operation)))return [];
 return [...new Set(point.citations.map(c=>c.quote))];
}
export const historyPointValue=(point:HistorySalesPoint,lang:string)=>{
 const quotes=historyPointQualifiedQuotes(point);
 return quotes.length?quotes.join(lang==='zh'?'；':'; '):point.item.kind==='signal'?crmUiText(point.value,lang):historyInformationValue(point.field,point.value,lang);
};
export function historyPointSummary(point:HistorySalesPoint,lang:string){
 const main=(point.kind==='request'?'':historyPointLabel(point,lang)+(lang==='zh'?'：':': '))+historyPointValue(point,lang);
 const notes=point.kind==='change'&&!point.qualifiers.length?['本次变化']:point.qualifiers;
 return main+(notes.length?' · '+notes.map(q=>crmUiText(q,lang)).join(' · '):'');
}

export function CrmHistorySalesHighlights({groupId,points,onEvidence}:{groupId:string;points:HistorySalesPoint[];onEvidence?:(citation:HistoryCitation)=>void}){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();
 if(!points.length)return null;
 const seen=new Set<string>(),sections=[['request','诉求与意向'],['concern','顾虑与限制'],['change','本次变化'],['context','本次提及']];
 return <section className="crm-history-sales-highlights" aria-label={ui('本条记录重点')}>
 {sections.map(([kind,title])=>{const rows=points.filter(p=>p.kind===kind);return rows.length>0&&<section key={kind} className="crm-history-business-section"><h4>{ui(title)}</h4>
 {rows.map(point=><div key={point.id} className={'crm-history-business-point'+(kind==='request'?' is-request':'')}>
  {kind!=='request'&&<span className="crm-history-business-label">{historyPointLabel(point,lang)}</span>}
  <div className="crm-history-business-value">{point.showBefore&&<><span className="crm-work-muted">{historyInformationValue(point.field,point.before,lang)}</span><span aria-label={ui('变为')}> → </span></>}<CrmSearchHighlight text={historyPointValue(point,lang)}/>
   {point.qualifiers.map(word=><span key={word} className="crm-history-business-qualifier">{ui(word)}</span>)}
  </div>
  {onEvidence&&point.citations.filter(c=>{const key=historyCitationKey(c);if(seen.has(key))return false;seen.add(key);return true;}).map(c=><CrmEvidenceAction key={historyCitationKey(c)} label="依据" behavior="locate" controls={historyOriginalId(groupId,c.scope)} description={ui('定位原文')+' · '+points.filter(p=>p.citations.some(other=>historyCitationKey(other)===historyCitationKey(c))).map(p=>historyPointLabel(p,lang)).join('、')+'：'+c.quote} onClick={()=>onEvidence(c)}/>)}
 </div>)}
 </section>;})}
 </section>;
}
