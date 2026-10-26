import {useCrmUiText} from './CrmUiLanguage';
import {CrmSalesStage,CrmStopContact} from './CrmSalesStage';
import {useEffect,useState} from 'react';
import {CrmOperationLayer} from './CrmOperationLayer';
import {budgetPresentation} from '../../utils/crmLeadPresentation';
import {CrmEvidenceAction} from './CrmEvidenceAction';
import {crmValue} from '../../utils/crmLanguage';
import {crmSourcePresentation} from '../../utils/crmSourcePresentation';
import {CrmAiIndicator} from './CrmAiIndicator';
import {customerCity} from '../../utils/crmWorkspace';
/** A read-only view of existing profile values, never a new inferred sales conclusion. */
export function profileDisplay(value:any,lang:any='zh'):string{
 if(value==null||value===''||Array.isArray(value)&&!value.length)return '未记录';
 if(lang==='zh'&&value==='course')return '整门课程';if(lang==='zh'&&value==='month')return '每月';if(lang==='zh'&&value==='hour')return '每小时';if(lang==='zh'&&value==='IDR')return '印尼盾（IDR）';if(lang==='zh'&&value==='Within 6 months')return '6个月内';
 return Array.isArray(value)?value.map(v=>crmValue(String(v),lang)).join('、'):crmValue(String(value),lang);
}
export function budgetSourceGroups(lead:any){const groups=new Map<string,{id:string;fields:string[]}>();for(const key of ['budgetMax','budgetMin','budgetCurrency','budgetPeriod']){const id=lead.profileFieldMeta?.[key]?.sourceFactIds?.[0];if(lead[key]==null||!id)continue;const g=groups.get(id)||{id,fields:[]};g.fields.push(key);groups.set(id,g);}return [...groups.values()];}
export function CrmSalesBrief({lead,lang,onEvidence,onProfile,onStage,canEdit,milestones,isLight}:any){
 const ui=useCrmUiText(lang);

 const budget=budgetPresentation(lead,lang),[showBudget,setShowBudget]=useState(false);
 useEffect(()=>setShowBudget(false),[lead.id]);
 const has=(key:string)=>lead[key]!=null&&lead[key]!==''&&(!Array.isArray(lead[key])||lead[key].length>0);
 const evidence=(key:string,label:string)=>{const meta=lead.profileFieldMeta?.[key],source=crmSourcePresentation(meta?.sourceType);return <>{source.aiDerived&&<CrmAiIndicator/>}{meta?.sourceFactIds?.[0]&&onEvidence&&<CrmEvidenceAction description={(((ui("查看") + ui(label)) + ui("的原文依据 · ")) + ui(source.label))} onClick={()=>onEvidence(meta.sourceFactIds[0])}/>}</>;};
 const field=(key:string,label:string)=>has(key)?<div className="crm-sales-condition" key={key}><dt>{ui(label)}</dt><dd><span>{profileDisplay(lead[key],lang)}</span><span className="crm-sales-inline-evidence">{evidence(key,label)}</span></dd></div>:null;
 const budgetEvidence=budgetSourceGroups(lead);
 const budgetLabels:Record<string,string>={budgetMax:'预算上限',budgetMin:'预算下限',budgetCurrency:'币种',budgetPeriod:'计价周期'};
 return <section className="crm-sales-brief" aria-label={ui("客户当前情况")}>
 <div className="crm-followup-section-heading"><h3>{ui("客户当前情况")}</h3>{onProfile&&<button type="button" className="crm-work-link" onClick={onProfile}>{ui("客户资料")}</button>}</div>
 <div className="crm-sales-stage-focus"><div><span>{ui("当前阶段")}</span><strong><CrmSalesStage stage={lead.currentStage} lang={lang}/></strong></div></div>
 {milestones&&<div className="crm-sales-brief-events">{milestones}</div>}
 <div className="crm-sales-brief-columns" data-has-milestones="false">
 <div className="crm-sales-needs" aria-label={ui("学习需求摘要")}><h4>{ui("学习目标与条件")}</h4>
 {has('goal')&&<div className="crm-sales-goal"><span className="crm-sales-goal-label">{ui("主要目标")}</span><strong>{profileDisplay(lead.goal,lang)}</strong><span className="crm-sales-inline-evidence">{evidence('goal','主要目标')}</span></div>}
 {(has('mode')||has('city'))&&<div className="crm-sales-brief-context">{has('mode')&&<span>{profileDisplay(lead.mode,lang)}<span className="crm-sales-inline-evidence">{evidence('mode','授课方式')}</span></span>}{has('mode')&&has('city')&&<span aria-hidden="true">·</span>}{has('city')&&<span>{customerCity(lead.city,lang)}<span className="crm-sales-inline-evidence">{evidence('city','现居城市')}</span></span>}</div>}
 <dl className="crm-sales-conditions">{field('availability','可上课时段')}{field('preferredStart','希望开始')}
 {budget&&<div className="crm-sales-condition"><dt>{budget.label}</dt><dd><span>{budget.value}</span><span className="crm-sales-inline-evidence">{budgetEvidence.length>0&&onEvidence&&<CrmEvidenceAction description={ui("查看预算金额与单位的各项原文依据")} onClick={()=>setShowBudget(true)}/>}</span></dd></div>}
 {field('concerns','学习顾虑')}</dl>
 {!['goal','preferredStart','availability','mode','city','concerns'].some(has)&&!budget&&<p className="crm-work-muted crm-sales-brief-empty">{ui("尚无学习需求信息")}</p>}
 </div>

 </div>
 {lead.contactArrangement?.state==='stopped'&&<aside className="crm-followup-restriction"><strong><CrmStopContact lead={lead} lang={lang}/></strong><p>{lead.contactArrangement.reason}</p></aside>}
 {showBudget&&<CrmOperationLayer compose isLight={isLight} title={ui("预算信息依据")} context={lead.fullName} lang={lang} onClose={()=>setShowBudget(false)}><div className="crm-editor-compose"><div className="crm-editor-scroll">{budgetEvidence.map(g=><div key={g.id} className="crm-budget-source-group">{g.fields.map(key=><div key={key}><strong>{ui(budgetLabels[key])}</strong><span>{profileDisplay(lead[key],lang)}</span>{crmSourcePresentation(lead.profileFieldMeta?.[key]?.sourceType).aiDerived&&<CrmAiIndicator/>}</div>)}<CrmEvidenceAction description={((ui("查看") + g.fields.map(k=>budgetLabels[k]).join('、')) + ui("的原文依据"))} onClick={()=>{setShowBudget(false);onEvidence(g.id);}}/></div>)}</div><div className="crm-editor-actions"><button type="button" className="crm-work-button" onClick={()=>setShowBudget(false)}>{ui("关闭")}</button></div></div></CrmOperationLayer>}
 </section>;
}
