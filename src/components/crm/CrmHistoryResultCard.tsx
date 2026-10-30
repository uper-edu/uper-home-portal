import {useCrmUiLanguage,useCrmUiText} from './CrmUiLanguage';
import {CrmSearchHighlight} from './CrmSearchHighlight';
import {CrmSalesStageChange} from './CrmSalesStage';
import {CrmHistoryOriginal,historyInformationValue} from './CrmHistoryInformation';
import {historyAssessmentCounts,historyOwnerNames,historyResultAssessment,historyResultKind,historyResultReasons,historyResultRows,historyResultTitle,type HistoryResultRow} from '../../utils/crmHistoryResultContent';
import type {HistoryGroup} from '../../utils/crmHistoryTimeline';

function ResultValue({row}:{row:HistoryResultRow}){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();
 const value=Array.isArray(row.value)&&!row.value.length?ui('明确清空'):historyInformationValue(row.field,row.value,lang);
 return <>{row.field==='currentStage'?<CrmSalesStageChange before={row.showBefore?row.before:undefined} after={row.value}/>:<>{row.showBefore&&<><span className="crm-work-muted">{historyInformationValue(row.field,row.before,lang)}</span> → </>}<CrmSearchHighlight text={value}/></>}{row.note&&<span className="crm-history-business-qualifier">{ui(row.note)}</span>}</>;
}
export function CrmHistoryResultHeadline({group,expanded=false}:{group:HistoryGroup;expanded?:boolean}){
 const ui=useCrmUiText(),lang=useCrmUiLanguage(),kind=historyResultKind(group),p=group.root?.payload||{};
 if(expanded)return <>{ui(historyResultTitle(group))}</>;
 if(kind==='assessment')return <>{historyResultAssessment(group,lang).detail}</>;
 if(kind==='stage')return <>{p.before==null&&<>{ui('原阶段未记录')} → </>}<CrmSalesStageChange before={p.before} after={p.after} lang={lang}/></>;
 if(kind==='ownership'){const names=historyOwnerNames(group);return <>{names.map((n,i)=><span key={i}>{i>0?' → ':''}{n.translate?ui(n.text):n.text}</span>)}</>;}
 const rows=historyResultRows(group),row=rows[0];
 return row?<>{ui(row.label)}{lang==='zh'?'：':': '}<ResultValue row={row}/></>:<>{ui('资料变更')}</>;
}
export function CrmHistoryResultPreview({group}:{group:HistoryGroup}){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();
 if(historyResultKind(group)==='assessment')return <CrmSearchHighlight text={historyResultAssessment(group,lang).conclusion}/>;
 if(historyResultKind(group)==='profile'){
  const rows=historyResultRows(group);return rows.length>1?<>{rows.slice(1,3).map((row,i)=><span key={row.field}>{i>0?' · ':''}{ui(row.label)}{lang==='zh'?'：':': '}<ResultValue row={row}/></span>)}{rows.length>3?<span className="crm-history-business-qualifier">{ui('展开查看全部变更')}</span>:null}</>:null;
 }
 return null;
}
/** Read-only event snapshot; no regrading, extraction, profile update or current-owner lookup. */
export function CrmHistoryResultCard({group,citation}:any){
 const ui=useCrmUiText(),lang=useCrmUiLanguage(),kind=historyResultKind(group),p=group.root?.payload||{},reasons=kind==='assessment'?[]:historyResultReasons(group);
 return <section className="crm-history-result-card" aria-label={ui(historyResultTitle(group))}>
 {kind==='assessment'?<><p className="crm-history-result-primary">{historyResultAssessment(group,lang).detail}</p><p className="crm-history-result-conclusion"><CrmSearchHighlight text={historyResultAssessment(group,lang).conclusion}/></p>{historyAssessmentCounts(group).length>0&&<details className="crm-evidence-explanation"><summary>{ui('答题概况')}</summary><dl className="crm-history-details">{historyAssessmentCounts(group).map(row=><div key={row.key}><dt>{ui(row.label)}</dt><dd>{row.value}</dd></div>)}</dl></details>}</>:
 kind==='profile'?<dl className="crm-history-details">{historyResultRows(group).map((row,i)=><div key={row.field+':'+i}><dt>{ui(row.label)}</dt><dd><ResultValue row={row}/></dd></div>)}</dl>:
 <p className="crm-history-result-primary"><CrmHistoryResultHeadline group={group}/></p>}
 {reasons.length>0&&<section className="crm-history-result-evidence"><h4>{ui('变更依据')}</h4>{reasons.map((text,i)=>i===0&&text===group.original?<CrmHistoryOriginal key={i} groupId={group.id} text={text} citation={citation}/>:<p key={i}><CrmSearchHighlight text={text}/></p>)}</section>}
 {kind==='stage'&&Array.isArray(p.basis)&&p.basis.filter((b:any)=>typeof b.text==='string'&&b.text&&!reasons.includes(b.text)).length>0&&<details className="crm-evidence-explanation"><summary>{ui('关联依据原文')}</summary>{p.basis.filter((b:any)=>typeof b.text==='string'&&b.text&&!reasons.includes(b.text)).map((b:any,i:number)=><blockquote key={i}><CrmSearchHighlight text={b.text}/></blockquote>)}</details>}
 </section>;
}
