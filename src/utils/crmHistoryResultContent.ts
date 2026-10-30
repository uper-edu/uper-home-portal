import {manualProfileFields} from './crmDynamicProfile';
import {historyAssessment,historyAssessmentResult,historyChanges,historyStructuredFields,type HistoryGroup} from './crmHistoryTimeline';

export type HistoryResultRow={field:string;label:string;value:any;before?:any;showBefore:boolean;note?:string};
const own=(value:any,key:string)=>!!value&&Object.hasOwn(value,key);
const empty=(value:any)=>value==null||value===''||Array.isArray(value)&&!value.length;
const labels:Record<string,string>={...manualProfileFields,phone:'电话',whatsapp:'WhatsApp',email:'电子邮件',name:'姓名',reportedLevel:'自报水平',buyingSignal:'问卷关注内容',buyingSignals:'问卷关注内容',nextStepInterest:'希望了解的内容',currentStage:'销售阶段',tier:'客户分类',nextAction:'下一步说明'};
export function historyResultKind(group:HistoryGroup){
 if(group.category==='assessment')return 'assessment';
 if(group.root?.eventType==='stage.changed')return 'stage';
 if(group.root?.eventType==='owner.changed')return 'ownership';
 if(['profile.fields_updated','profile.changed'].includes(group.root?.eventType))return 'profile';
 return null;
}
/** Only this event's saved changes. Today's profile and other events cannot fill missing history. */
export function historyResultRows(group:HistoryGroup):HistoryResultRow[]{
 if(historyResultKind(group)!=='profile')return [];
 const root=group.root,changes=historyChanges(root);
 if(changes.length)return changes.filter(c=>own(labels,c.field)).map(c=>{
  const applied=c.applied===true,known=own(c,'before');
  return {field:c.field,label:labels[c.field],value:c.applied===false?c.observation:c.after,before:c.before,
   showBefore:applied&&known&&!empty(c.before),
   note:c.applied===false?'未采用，保留不同记录':!applied?'采用结果未注明':!known?'原值未记录':empty(c.before)?'本次新增':undefined};
 });
 return historyStructuredFields(root).filter(c=>c.key!=='owner').map(c=>({field:c.key,label:c.label,value:c.value,before:c.before,showBefore:own(root?.payload?.before,c.key)&&!empty(c.before),note:!own(root?.payload?.before,c.key)?'原值未记录':empty(c.before)?'本次新增':undefined}));
}
/** Never present an opaque account id as a person's name, or a missing snapshot as unassigned. */
export function historyOwnerNames(group:HistoryGroup){
 const p=group.root?.payload||{};
 return (['before','after']as const).map(side=>{
  if(own(p,side)&&p[side]==null)return {text:'未分配',translate:true};
  const name=p[side+'Name'];
  if(typeof name==='string'&&name.trim()&&!(name===p[side]&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name)))return {text:name,translate:name==='未分配'};
  return {text:side==='before'?'原负责人姓名未记录':'新负责人姓名未记录',translate:true};
 });
}
/** Reasons and originals are immutable evidence, not generated summaries. Exact duplicates display once. */
export function historyResultReasons(group:HistoryGroup){
 return [...new Set([group.original,group.root?.payload?.reason,group.root?.payload?.changes?.stageReason].filter((v):v is string=>typeof v==='string'&&!!v.trim()))];
}
export function historyResultTitle(group:HistoryGroup){return ({assessment:'测评结果',profile:'资料变更',stage:'销售阶段变更',ownership:'负责人变更'}as Record<string,string>)[historyResultKind(group)||'']||'';}
export const historyResultAssessment=(group:HistoryGroup,lang:any)=>historyAssessment(group,lang);
/** Saved counts only; absent counts are not reconstructed from the customer's latest attempt. */
export function historyAssessmentCounts(group:HistoryGroup){
 const result=historyAssessmentResult(group)||{},labels:Record<string,string>={questionCount:'题目数',correctCount:'答对题数',skippedCount:'跳过题数',unansweredCount:'未答题数'};
 return Object.entries(labels).filter(([key])=>Number.isInteger(result[key])&&result[key]>=0).map(([key,label])=>({key,label,value:result[key]}));
}
