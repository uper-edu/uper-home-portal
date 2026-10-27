import {crmUiText} from './crmUiText';
import {crmAssessmentSummary} from './crmAssessment';
import {extractionRoot} from './crmExtractionEvidence';
import {ledgerOccurrenceTime} from './crmFollowupPresentation';
import {profileFields} from './crmDynamicProfile';
import {crmValue} from './crmLanguage';
import {budgetPresentation} from './crmLeadPresentation';
import {interactionInstant} from './crmInteractionTimeline';
export const historyCategories:Record<string,string>={all:'全部',ownership:'负责人变更',message:'客户对话',sales:'销售记录',questionnaire:'客户问卷',assessment:'测评记录',profile:'资料编辑',other:'其他依据'};
export type HistoryGroup={id:string;category:string;title:string;original:string;occurredAt:string|null;recordedAt:string|null;displayAt?:string|null;timeLabel?:string;events:any[];extractions:any[];log?:any;root?:any;aliases:string[]};
const short=(s:any,n=92)=>{const text=String(s||'').replace(/\s+/g,' ').trim();return text.length>n?text.slice(0,n)+'…':text;};
const display=(v:any)=>v==null?'未填写':Array.isArray(v)?v.map(x=>crmValue(String(x),'zh')).join('、'):typeof v==='object'?'结构化资料':crmValue(String(v),'zh');
export function historyChanges(event:any){return Array.isArray(event?.payload?.changes)?event.payload.changes.filter((v:any)=>v&&typeof v.field==='string'):[];}
const fieldDisplay=(field:string,value:any)=>field==='budgetAmount'?budgetPresentation({budgetAmount:value})?.value||display(value):display(value);
function chineseHistoryBusinessTitle(group:HistoryGroup){
 if(group.root?.eventType==='owner.changed'){const p=group.root.payload;return '负责人：'+(p.beforeName||p.before||'未分配')+' → '+(p.afterName||p.after);}
 if(group.category==='profile'){
  const changes=group.events.flatMap(historyChanges);if(changes.length){const c=changes[0],label=profileFields[c.field]||c.field,value=c.applied===false?c.observation:c.after;return (c.applied===false?'记录不同的':c.before==null?'新增':'更新')+label+'：'+(c.before==null?'':short(fieldDisplay(c.field,c.before),22)+' → ')+short(fieldDisplay(c.field,value),28)+(changes.length>1?' 等'+changes.length+'项':'');}
  if(group.root?.eventType==='stage.changed')return '销售阶段：'+display(group.root.payload.before)+' → '+display(group.root.payload.after);
  const keys=historyStructuredFields(group.root).map(v=>v.label);if(keys.length)return '更新客户资料：'+keys.slice(0,4).join('、');
 }
 if(group.category==='questionnaire')return '客户提交学习需求问卷';
 if(group.category==='assessment'){const summary=historyAssessment(group);return summary.detail+' · '+summary.conclusion;}
 return short(group.original,44)||({message:'客户对话原文',sales:'销售进展记录',profile:'客户资料编辑',other:'历史依据'}as any)[group.category];
}
export function historyBusinessTitle(group:HistoryGroup,lang:any='zh'){
 if(lang==='zh')return chineseHistoryBusinessTitle(group);
 const ui=(v:string)=>crmUiText(v,lang);
 const show=(field:string,v:any):string=>field==='budgetAmount'?budgetPresentation({budgetAmount:v},lang)?.value||'—':v==null?ui('未填写'):Array.isArray(v)?v.map(x=>crmValue(String(x),lang)).join(', '):typeof v==='object'?ui('结构化信息'):crmValue(String(v),lang);
 if(group.root?.eventType==='owner.changed'){const p=group.root.payload;return ui('负责人：')+(p.beforeName||p.before||ui('未分配'))+' → '+(p.afterName||p.after);}
 if(group.category==='profile'){
  const changes=group.events.flatMap(historyChanges);
  if(changes.length){const c=changes[0];return ui(c.applied===false?'记录不同的':c.before==null?'新增':'更新')+ui(profileFields[c.field]||c.field)+': '+(c.before==null?'':short(show(c.field,c.before),22)+' → ')+short(show(c.field,c.applied===false?c.observation:c.after),28)+(changes.length>1?(lang==='id'?' dan ':' and ')+(changes.length-1)+(lang==='id'?' lainnya':' more'):'');}
  if(group.root?.eventType==='stage.changed')return ui('销售阶段：')+crmValue(group.root.payload.before,lang)+' → '+crmValue(group.root.payload.after,lang);
  const keys=historyStructuredFields(group.root).map(v=>ui(v.label));if(keys.length)return ui('更新客户资料：')+keys.slice(0,4).join(', ');
 }
 if(group.category==='questionnaire')return ui('客户提交学习需求问卷');
 if(group.category==='assessment'){const summary=historyAssessment(group,lang);return summary.detail+' · '+summary.conclusion;}
 return short(group.original,44)||ui(({message:'客户对话原文',sales:'销售进展记录',profile:'客户资料编辑',other:'历史依据'}as any)[group.category]);
}
/** Read-only projection. Only explicit source identities connect events; time/text never create links. */
export function buildHistoryTimeline(events:any[]=[],lead:any={},rows:any[]=[]):HistoryGroup[]{
 const scoped=events.filter(e=>(!e.leadId||e.leadId===lead.id)&&(e.eventType!=='profile.changed'||historyStructuredFields(e).length>0)),byId=new Map(scoped.map(e=>[e.eventId,e])),logs=lead.followUpLogs||[],groups=new Map<string,HistoryGroup>();
 const message=(id:string,conversationId?:string)=>{
  const candidates=scoped.filter(e=>e.eventType==='customer.message'&&(!conversationId||e.payload?.conversationId===conversationId)&&(e.sourceRecordId===id||(lead.chatTranscript||[]).some((m:any)=>m.id===e.sourceRecordId&&m.request_id===id&&(!conversationId||m.conversation_id===conversationId))));
  return candidates.length===1?candidates[0]:null;
 };
 const rootKey=(type:string,id:string,conversationId?:string):string=>{
  if(type==='customer_message'){const m=message(id,conversationId);return 'message:'+(m?.sourceRecordId||id);}
  if(type==='sales_record')return 'log:'+id;
  return type+':'+id;
 };
 const resolve=(e:any,seen=new Set<string>()):string=>{
  if(seen.has(e.eventId))return 'event:'+e.eventId;seen.add(e.eventId);const p=e.payload||{};
  if(e.eventType==='customer.message')return 'message:'+e.sourceRecordId;
  if(e.eventType==='followup.recorded')return 'log:'+(p.result?.logId||e.sourceRecordId||e.eventId);
  if(e.eventType==='assessment.submitted')return 'assessment:'+(p.attemptId||e.sourceRecordId||e.eventId);
  if(e.eventType==='record.amended'&&byId.has(p.targetFactId))return resolve(byId.get(p.targetFactId),seen);
  if(e.eventType==='information.extracted'){
   const r=p.sourceRoot||{type:p.sourceType,id:p.sourceId};if(r.type&&r.id){if(!['customer_message','sales_record'].includes(r.type)&&byId.has(r.id))return resolve(byId.get(r.id),seen);return rootKey(r.type,r.id,p.conversationId);}
  }
  if(e.eventType==='task.request_evidence'&&p.messageId){const m=message(p.messageId,p.conversationId);if(m)return resolve(m,seen);}
  if(e.eventType==='profile.fields_updated'){
   if(p.adoption==='explicit_sales_edit'||p.sourceType==='sales_edit')return 'event:'+e.eventId;
   if(p.basisFactIds?.length===1&&byId.has(p.basisFactIds[0]))return resolve(byId.get(p.basisFactIds[0]),seen);
   if(p.sourceRecordId&&logs.some((l:any)=>l.id===p.sourceRecordId))return 'log:'+p.sourceRecordId;
  }
  if(e.eventType==='sales.stage_observed'&&p.sourceLogId)return 'log:'+p.sourceLogId;
  return 'event:'+e.eventId;
 };
 const ensure=(id:string)=>{if(!groups.has(id))groups.set(id,{id,category:'other',title:'',original:'',occurredAt:null,recordedAt:null,events:[],extractions:[],aliases:[]});return groups.get(id)!;};
 for(const e of scoped){const g=ensure(resolve(e));g.events.push(e);g.aliases.push(e.eventId,...(e.sourceRecordId?[e.sourceRecordId]:[]));if(e.eventType==='task.request_evidence'&&e.payload?.messageId){const m=message(e.payload.messageId,e.payload.conversationId);if(m&&g.id==='message:'+m.sourceRecordId)g.aliases.push(e.payload.messageId);}}
 for(const l of logs){const g=ensure('log:'+l.id);g.log=l;g.aliases.push(l.id);}
 for(const row of rows.filter(r=>!r.lead_id||r.lead_id===lead.id)){
  const r=extractionRoot(row);let key=rootKey(r.type,r.id,row.input?.conversationId);
  // Non-message/non-sales roots can name an exact existing fact (for amendments to structured originals).
  if(!['customer_message','sales_record'].includes(r.type)&&byId.has(r.id))key=resolve(byId.get(r.id));
  const g=ensure(key);g.extractions.push(row);g.aliases.push(row.id,row.source_id);
 }
 for(const g of groups.values()){
  const root=g.events.find(e=>['customer.message','followup.recorded','questionnaire.submitted','assessment.submitted'].includes(e.eventType))||g.events.find(e=>!['information.extracted','record.amended','sales.stage_observed'].includes(e.eventType))||g.events[0];g.root=root;
  g.category=root?.eventType==='owner.changed'?'ownership':g.id.startsWith('log:')?'sales':g.id.startsWith('message:')?'message':g.id.startsWith('assessment:')?'assessment':root?.eventType==='questionnaire.submitted'?'questionnaire':['profile.fields_updated','profile.changed','stage.changed'].includes(root?.eventType)?'profile':'other';
  const originalRow=g.extractions.find(r=>!r.input?.amendment)||g.extractions[0];g.original=g.log?.summary||root?.original||originalRow?.input?.text||'';
  if(g.category==='questionnaire'&&!g.original)g.original=historyStructuredFields(root).map(v=>v.label+'：'+display(v.value)).join('\n');
  g.occurredAt=interactionInstant(g.log?.occurredAt)||root&&ledgerOccurrenceTime(scoped,root.eventId)||interactionInstant(originalRow?.input?.occurredAt)||null;
  g.recordedAt=interactionInstant(g.log?.at||g.log?.timestamp)||root?.recordedAt||interactionInstant(originalRow?.created_at)||null;
  const manual=root?.eventType==='profile.fields_updated'&&(root.payload?.sourceType==='sales_edit'||root.payload?.adoption==='explicit_sales_edit');
  g.displayAt=manual||root?.eventType==='owner.changed'?g.recordedAt:g.occurredAt;g.timeLabel=manual?'资料更新于':root?.eventType==='owner.changed'?'负责人变更于':undefined;
  g.title=historyBusinessTitle(g);
 }
 return [...groups.values()].sort((a,b)=>(Date.parse(b.displayAt||'')||0)-(Date.parse(a.displayAt||'')||0)||a.id.localeCompare(b.id));
}
export function historyGroupFor(groups:HistoryGroup[],id:string){return groups.find(g=>g.events.some(e=>e.eventId===id))||groups.find(g=>g.aliases.includes(id));}

export function historyAssessment(group:HistoryGroup,lang:any='zh'){
 let result=group.root?.payload?.result;
 if(!result&&group.original){try{const parsed=JSON.parse(group.original);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))result=parsed;}catch{/* Plain original remains available under its exact source event. */}}
 if(!result&&(group.root?.payload?.attempt||group.root?.payload?.score!==undefined))result=group.root.payload;
 return result?crmAssessmentSummary({latestAssessment:result} as any,lang):{conclusion:crmUiText('已保存真实测评记录',lang),detail:crmUiText('本条未附完整结果，请进入测评页核对。',lang)};
}

/** Effective contact correction is explicit; original log text and result remain immutable. */
export function historyContactCorrection(group:HistoryGroup,lead:any){
 return group.log?(lead.recordAmendments||[]).filter((a:any)=>a.targetLogId===group.log.id&&a.kind==='correction'&&a.contactResult).at(-1):null;
}

const historyFieldLabels:Record<string,string>={...profileFields,fullName:'姓名',name:'姓名',whatsapp:'WhatsApp',email:'电子邮件',currentStatus:'客户身份',reportedLevel:'自报水平',buyingSignal:'问卷关注内容',buyingSignals:'问卷关注内容',nextStepInterest:'希望了解的内容',currentStage:'销售阶段',owner:'负责人',tier:'客户分类',nextAction:'下一步说明'};
export function historyStructuredFields(event:any):{key:string;label:string;value:any;before:any}[]{
 const data=event?.eventType==='questionnaire.submitted'?event.payload?.answers:event?.eventType==='stage.changed'?{currentStage:event.payload.after}:event?.payload?.changes;
 if(!data||typeof data!=='object'||Array.isArray(data))return [];
 return Object.entries(data).filter(([key])=>!!historyFieldLabels[key]).map(([key,value])=>({key,label:historyFieldLabels[key],value,before:event.eventType==='stage.changed'?event.payload.before:event.payload?.before?.[key]}));
}
export function historyPreview(group:HistoryGroup,lang:any='zh'){
 if(['sales','message'].includes(group.category))return '';
 if(group.category==='questionnaire')return historyStructuredFields(group.root).filter(v=>['goal','city','mode','examTimeline','reportedLevel'].includes(v.key)).map(v=>crmUiText(v.label,lang)+(lang==='zh'?'：':': ')+(lang==='zh'?display(v.value):v.value==null?crmUiText('未填写',lang):crmValue(String(v.value),lang))).join(' · ');
 return '';
}
