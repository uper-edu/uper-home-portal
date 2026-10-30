import {questionnaireSalesRows,questionnaireAnswerText} from '../../utils/crmQuestionnaireSalesContent';
import {useCrmUiLanguage,useCrmUiText} from './CrmUiLanguage';
import {CrmSearchHighlight} from './CrmSearchHighlight';

export function CrmQuestionnaireSalesSummary({source}:{source:any}){
 const ui=useCrmUiText(),lang=useCrmUiLanguage(),rows=questionnaireSalesRows(source);
 return <section className="crm-history-questionnaire-summary" aria-label={ui('问卷中的学习需求')}>
 {rows.length?<dl className="crm-history-details">{rows.map(row=><div key={row.key}><dt>{ui(row.label)}</dt><dd>{row.values.map((value,index)=><span key={value}>{index>0&&(lang==='zh'?'、':', ')}<CrmSearchHighlight text={questionnaireAnswerText(row.key,value,lang)}/></span>)}</dd></div>)}</dl>:<p>{ui('本条问卷暂未记录学习需求，请查看完整原始问卷。')}</p>}
 </section>;
}
