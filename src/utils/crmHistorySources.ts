import {historyStructuredFields,type HistoryGroup} from './crmHistoryTimeline';
export type HistoryBusinessSource={event:any;title:string;original:string;reason:string;fields:{key?:string;label:string;before?:any;value:any}[]};
const requestNames:Record<string,string>={handoff:'请求顾问联系',booking:'请求预约安排',enrollment:'请求报名协助'};
/** Only additional business content. Audit events remain intact; no text/time based merging. */
export function historyAdditionalSources(group:HistoryGroup):HistoryBusinessSource[]{
 const seen=new Set<string>();const result:HistoryBusinessSource[]=[];
 for(const event of group.events){
  if(seen.has(event.eventId))continue;seen.add(event.eventId);
  const p=event.payload||{},root=event.eventId===group.root?.eventId;
  let title='',original='',reason='',fields:HistoryBusinessSource['fields']=[];
  if(event.eventType==='task.request_evidence'){
   title='客户明确请求';const action=requestNames[p.action];if(action)fields=[{label:'请求内容',value:action}];
   if(event.original&&event.original!==group.original)original=event.original;
  }else if(['profile.changed','stage.changed'].includes(event.eventType)){
   title=event.eventType==='stage.changed'?'销售阶段调整':'客户资料编辑';
   // Root fields are already visible alongside their original. Only an additional reason is needed.
   if(!root)fields=historyStructuredFields(event);
   reason=typeof p.reason==='string'?p.reason:typeof p.changes?.stageReason==='string'?p.changes.stageReason:'';
   if(event.original&&event.original!==group.original)original=event.original;
  }else if(event.eventType==='fact.corrected'){
   title='历史依据调整';reason=typeof p.reason==='string'?p.reason:'';
   if(event.original&&event.original!==group.original)original=event.original;
  }else if(!['customer.message','questionnaire.submitted','assessment.submitted','followup.recorded','profile.fields_updated','record.amended','information.extracted','sales.stage_observed'].includes(event.eventType)){
   title='其他来源记录';if(event.original&&event.original!==group.original)original=event.original;
  }
  if(original||reason||fields.length)result.push({event,title,original,reason,fields});
 }
 return result;
}
