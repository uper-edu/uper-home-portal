/** Display the decision made at extraction time, not a claim about the current profile. */
export function extractionDecisionLabel(o:any){return o.kind==='insight'?(o.decision==='apply'?(o.operation==='withdraw'?'已撤回当前洞察':o.basis==='inferred'?'AI推断':'本次已更新客户洞察'):o.decision==='difference'?'未采用，保留当前洞察':'仅保留依据'):o.kind==='protected_field'?'需人工确认，未自动修改':o.kind==='field'?({apply:'本次已采用到客户资料',difference:'保留为不同记录，未覆盖资料',evidence:'仅保留依据，未更新资料',suggestion:'仅供参考'} as Record<string,string>)[o.decision]||'采用状态未记录':o.kind==='signal'?'行为／诉求证据，不代表成交':o.kind==='stage_event'?'原文中的阶段事件，不改变业务状态':'约定建议，未自动建立约定';}
export function extractionSignalValue(o:any){return ({negated:'否定／尚未确认表达（见原文）',uncertain:'尚不确定（见原文）',conditional:'有条件表达（见原文）',future:'未来意向（见原文）',past:'历史表达（见原文）'} as Record<string,string>)[o.temporality]||'已表达';}

/** Stage descriptions are not buying intent: future appointments must not be labelled mere interest. */
export function extractionStageValue(o:any){return ({negated:'否定／尚未发生（见原文）',uncertain:'尚不确定（见原文）',conditional:'有条件描述（见原文）',future:'涉及未来安排（见原文）',past:'描述过去事件（见原文）'} as Record<string,string>)[o.temporality]||'原文明确描述（见原文）';}

/** Read-only status: absence never means a successful extraction with no findings. */
export function extractionViewState(row:any){
 if(row.status==='completed')return row.output?.observations?.length?'ready':'empty';
 return ['pending','processing','retry','failed'].includes(row.status)?row.status:'unknown';
}
export function historyExtractionNotApplicable(group:any){
 return ['questionnaire','assessment'].includes(group.category)||group.category==='profile'&&['profile.changed','stage.changed','profile.fields_updated'].includes(group.root?.eventType);
}
