import {useCrmUiText,useCrmUiLanguage} from './CrmUiLanguage';
import React from 'react';
import {activeExtractionEvidence,observationKey} from '../../utils/crmExtractionEvidence';
import {profileFields} from '../../utils/crmDynamicProfile';
import {signalLabels,stageEventLabels} from '../../utils/crmExtractionContract';
import {extractionDecisionLabel,extractionSignalValue,extractionStageValue,extractionViewState} from '../../utils/crmExtractionPresentation';
import {extractionSummary} from '../../utils/crmFollowupPresentation';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import {CrmAiIndicator} from './CrmAiIndicator';
import {useCrmExtractions} from './useCrmExtractions';
const label=(o:any)=>profileFields[o.field]||signalLabels[o.field]||stageEventLabels[o.field]||'约定建议';
const value=(v:any):string=>v===true?'已表达':v===null?'明确空值':Array.isArray(v)?v.join('、'):({Online:'线上直播',Offline:'线下面授','Not sure':'尚未确定',course:'整门课程',month:'每月',hour:'每小时',unspecified:'周期未说明',IDR:'印尼盾（IDR）',en:'英语',id:'印尼语',zh:'中文',unknown:'未确认'} as any)[String(v)]||String(v);
export function CrmExtractionRows({rows,allRows=rows,onViewAssessment,includeSource=true,initiallyExpanded=false,embedded=false}:any){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();

 const evidence=activeExtractionEvidence(allRows||[]);
 return <>{rows.map((r:any)=>{
  const state=extractionViewState(r),hasResults=state==='ready';
  if(state==='empty')return null;
  const source=r.source_type==='customer_message'?'客户原文':r.source_type==='sales_amendment'?'补充／修正原文':'销售原文';
  const sourceTime=r.input?.occurredAt?ui('发生于')+' '+formatCrmEventTime(r.input.occurredAt):ui('整理记录于')+' '+formatCrmEventTime(r.created_at);
  const heading=<>{includeSource&&<span>{ui(source)} · {sourceTime}</span>}<span>{hasResults&&embedded?(rows.length>1?ui(source)+' · '+ui('已整理'):ui('提取结果')):(r.source_type==='sales_amendment'?ui('补充／修正')+' · ':'')+extractionSummary(r,lang)}</span></>;
  const content=<>
   {hasResults&&(r.output.observations||[]).map((o:any,i:number)=>{
    const superseded=evidence.find(e=>e.row.id===r.id&&observationKey(e.observation)===observationKey(o)&&e.observation.quote===o.quote)?.supersededBy;
    return <article key={i} className="crm-extraction-observation" data-decision={superseded?'history':o.decision}>
     <div><strong>{ui(label(o))}<CrmAiIndicator/></strong><span className="crm-extraction-decision">{superseded ? ui("历史解释，已被关联修正替代") : ui(extractionDecisionLabel(o))}</span></div>
     <p className="crm-extraction-value">{o.kind==='stage_event'?ui(extractionStageValue(o)):o.kind==='signal'?ui(extractionSignalValue(o)):ui(value(o.value))}</p>
     <blockquote><span className="crm-extraction-caption">{ui("原文依据")}</span>{o.quote}</blockquote>
     <p>{ui("采用原因：")}{o.reason||ui('未记录采用原因')}</p>
     <small className="crm-work-muted">{ui(({current:'当前表达',past:'过去情况',future:'未来安排',conditional:'有条件',uncertain:'不确定',negated:'否定表达'} as any)[o.temporality]||'时间语义未注明')} {ui("· 表达主体：")}{o.subject==='sales' ? ui("销售") : o.subject==='customer' ? ui("客户") : ui("未注明")}</small>
    </article>;
   })}
   {hasResults&&r.output.observations.some((o:any)=>o.kind==='stage_event'&&o.field==='assessment_completion_reported')&&<aside className="crm-assessment-source-note"><p>{r.output.assessmentReferences?.length ? ui("该客户有真实测评记录；仅凭本段描述不能确定对应哪一次。") : ui("本次整理时未找到该客户的真实测评记录，仅保留描述。")}</p><button type="button" className="crm-work-link" onClick={onViewAssessment}>{ui("查看真实测评记录")}</button></aside>}
   {includeSource&&<details className="crm-evidence-explanation"><summary>{ui("查看关联原文")}</summary><p className="crm-progress-original">{r.input?.text}</p>{r.input?.amendment&&<><p>{ui("被关联的原记录：")}{r.input.amendment.originalText}</p>{r.input.amendment.reason&&<p>{ui("原因：")}{r.input.amendment.reason}</p>}</>}</details>}
  </>;
  // Empty, pending and failed runs have one status line, never an empty result disclosure.
  if(!hasResults||embedded)return <section key={r.id} className="crm-extraction-run" data-state={state} aria-label={(ui(source) + ui("的AI整理"))}>
   {(!hasResults||rows.length>1||includeSource)&&<p className="crm-extraction-status" role={state==='failed'?'alert':undefined}>{heading}</p>}
   {content}
  </section>;
  return <details key={r.id} open={initiallyExpanded?true:undefined} className="crm-record-ai" data-state={r.status}><summary>{heading}</summary><div className="crm-record-ai-body">{content}</div></details>;
 })}</>;
}
/** History has one disclosure for useful results; terminal/working states remain readable inline. */
export function CrmHistoryExtraction({group,allRows,loading,error,onViewAssessment}:any){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();

 const rows=group.extractions||[];
 if(!rows.length){return loading?<p className="crm-work-muted" role="status">{ui("正在读取AI整理状态…")}</p>:error?<p className="crm-work-muted" role="alert">{ui("AI整理状态暂不可用，原文已保留。")}</p>:null;}
 const content=<><CrmExtractionRows rows={rows} allRows={allRows} includeSource={false} embedded onViewAssessment={onViewAssessment}/>{rows.filter((r:any)=>r.input?.amendment?.originalText&&r.input.amendment.originalText!==group.original).map((r:any)=><details key={r.id} className="crm-evidence-explanation"><summary>{ui("补充／修正关联的原记录")}</summary><p className="crm-progress-original">{r.input.amendment.originalText}</p>{r.input.amendment.reason&&<p>{ui("原因：")}{r.input.amendment.reason}</p>}</details>)}</>;
 return rows.some((r:any)=>extractionViewState(r)==='ready')?<details className="crm-evidence-explanation"><summary>{ui("AI整理与采用说明")}</summary>{content}</details>:content;
}
/** Kept for existing callers; Follow-up embeds these rows under their original records. */
export function CrmExtractedInformation({leadId,onRefresh,revision,recentSourceId,onViewAssessment}:any){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();
const s=useCrmExtractions(leadId,revision,recentSourceId,onRefresh);return <section aria-label={ui("原文结构化信息")}><h3>{ui("AI提取与字段采用结果")}</h3><button type="button" className="crm-work-link" onClick={s.reload}>{ui("刷新提取结果")}</button>{s.loading&&<p role="status">{ui("正在读取整理状态…")}</p>}{s.error&&<p role="alert">{ui("整理状态暂不可用，原文保存状态不受影响。")}</p>}<CrmExtractionRows rows={s.rows} onViewAssessment={onViewAssessment}/></section>;}
