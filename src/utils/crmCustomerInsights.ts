import {CLASS_EQUIPMENT_KEY,classEquipmentWords,validateClassEquipment} from './crmClassEquipment';
import {assertAiInsightKey,validateAiDimensionRecord,validateAiInsightValue,aiInsightDefinition,validateDimensionValue,type DimensionWords,type AiDimensionRecord} from './crmDimensionCatalog';
export const CUSTOMER_INSIGHTS_VERSION='customer-insights-v2-equipment';
export const supportsCustomerInsights=(v:string)=>v==='customer-insights-v1'||v===CUSTOMER_INSIGHTS_VERSION;
export type InsightWords=DimensionWords;
export type InsightDimension=AiDimensionRecord;
export type InsightEvidence={id:string;eventId:string;value:string|string[];basis:'stated'|'inferred';status:string;decision:string;reason:string;quote:string;sourceId:string;sourceType:string;root:{type:string;id:string};occurredAt:string|null;recordedAt:string};
export type CustomerInsight={dimension:InsightDimension;value:string|string[];basis:'stated'|'inferred';status:'active'|'tentative'|'withdrawn';revision:number;current:InsightEvidence;history:InsightEvidence[]};
const invalid=(message:string):never=>{throw Error(message);};
export function validateInsightDimension(raw:any,key:string):InsightDimension{
 return validateAiDimensionRecord(raw,key);
}
export function validateInsightObservation(o:any){
 assertAiInsightKey(o.field);
 if(o.field===CLASS_EQUIPMENT_KEY&&Array.isArray(o.value))validateClassEquipment(o.value);else validateAiInsightValue(o.value);
 if(!['stated','inferred'].includes(o.basis)||!['set','withdraw',...(o.field===CLASS_EQUIPMENT_KEY?['add','remove','replace']:[])].includes(o.operation))invalid('洞察值、依据类型或更新方式不合法');
 if(o.dimension!==undefined)validateInsightDimension(o.dimension,o.field);
}
export function insightLabel(d:InsightDimension,lang:string){return d.key===CLASS_EQUIPMENT_KEY?classEquipmentWords[lang as keyof InsightWords]||classEquipmentWords.en:d.labels[lang as keyof InsightWords]||d.labels.en;}
/** A separate JSON namespace: never spread a model-generated field into core profile properties. */
export function applyInsightObservation(profile:any,dimension:InsightDimension,o:any,context:{eventId:string;sourceId:string;sourceType:string;root:{type:string;id:string};recordedAt:string;occurredAt:string|null;baseRevision:number;amendment:boolean;ambiguous?:boolean;standardEquipment?:boolean}){
 validateInsightDimension(dimension,dimension.key);validateInsightObservation({...o,field:dimension.key});if(dimension.key!==CLASS_EQUIPMENT_KEY||Array.isArray(o.value))validateDimensionValue(aiInsightDefinition(dimension),o.value);
 if(context.standardEquipment&&dimension.key===CLASS_EQUIPMENT_KEY&&!Array.isArray(o.value))invalid('上课使用设备须使用标准值');
 const existing:CustomerInsight|undefined=profile.aiInsights?.[dimension.key],history=existing?.history||[];
 const id=context.eventId+':'+dimension.key+':'+JSON.stringify([o.operation,o.value,o.basis,o.quote]);
 if(history.some(h=>h.id===id))return {profile,decision:'evidence',reason:'本条洞察依据已保存',value:existing?.value};
 const nextTime=context.occurredAt&&existing?.current.occurredAt?context.occurredAt:context.recordedAt;
 const oldTime=context.occurredAt&&existing?.current.occurredAt?existing.current.occurredAt:existing?.current.recordedAt;
 let decision='apply',reason='已更新客户洞察，保留原文与历史';
 const withdrawal=(o.operation==='withdraw'||o.operation==='remove')&&o.basis==='stated'&&o.change==='changed'&&['current','negated'].includes(o.temporality);
 if(o.subject!=='customer'||!withdrawal&&o.temporality!=='current'){decision='evidence';reason='仅保留原文，不作为当前客户洞察';}
 else if(dimension.key===CLASS_EQUIPMENT_KEY&&Array.isArray(o.value)&&o.basis!=='stated'){decision='evidence';reason='设备使用情况须有明确原文，不从拥有情况推断';}
 else if(o.operation==='remove'&&!withdrawal){decision='difference';reason='未明确停止使用，保留当前设备';}
 else if(context.ambiguous){decision='difference';reason='同一原文的洞察结论冲突，保留现值';}
 else if((existing?.revision||0)!==context.baseRevision){decision='difference';reason='洞察已被更新，保留当前值和本次依据';}
 else if(context.amendment&&existing&&(existing.current.root.type!==context.root.type||existing.current.root.id!==context.root.id)){decision='difference';reason='旧记录修正不覆盖其他来源更新的洞察';}
 else if(!context.amendment&&existing&&(!Number.isFinite(Date.parse(nextTime))||!Number.isFinite(Date.parse(oldTime||''))||Date.parse(nextTime)<=Date.parse(oldTime||''))){decision='difference';reason='较早的洞察不覆盖当前值';}
 else if(o.operation==='withdraw'&&!withdrawal){decision='evidence';reason='未明确撤回，保留当前洞察';}
 else if(existing?.basis==='stated'&&o.basis==='inferred'){decision='difference';reason='AI推断不覆盖客户明确陈述';}
 let adoptedValue=o.value;
 if(dimension.key===CLASS_EQUIPMENT_KEY&&Array.isArray(o.value)){
  const before=Array.isArray(existing?.value)?existing.value:[];
  if(existing&&!Array.isArray(existing.value)&&['add','remove'].includes(o.operation)){decision='difference';reason='原设备记录为文字，本次未说明完整使用设备，保留原记录';}
  if(o.operation==='add')adoptedValue=[...new Set([...before,...o.value])];
  if(o.operation==='remove')adoptedValue=before.filter(v=>!o.value.includes(v));
  if(adoptedValue.some((v:string)=>v==='laptop'||v==='desktop'))adoptedValue=adoptedValue.filter((v:string)=>v!=='computer_unspecified');
  validateClassEquipment(adoptedValue);
 }
 const status=o.operation==='withdraw'?'withdrawn':o.basis==='inferred'?'tentative':'active';
 const evidence:InsightEvidence={id,eventId:context.eventId,value:adoptedValue,basis:o.basis,status,decision,reason,quote:o.quote,sourceId:context.sourceId,sourceType:context.sourceType,root:context.root,occurredAt:context.occurredAt,recordedAt:context.recordedAt};
 if(!existing&&decision!=='apply')return {profile,decision,reason,value:undefined};
 const next:CustomerInsight=decision==='apply'?{dimension,value:adoptedValue,basis:o.basis,status,revision:(existing?.revision||0)+1,current:evidence,history:[...history,evidence]}:{...existing!,history:[...history,evidence]};
 return {profile:{...profile,aiInsights:{...(profile.aiInsights||{}),[dimension.key]:next}},decision,reason,value:next.value};
}
