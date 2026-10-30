import {interactionInstant} from './crmInteractionTimeline.ts';
import {enrollmentVoids} from './crmEnrollment.ts';
import {withdrawnFactIds} from './crmFactWithdrawal.ts';
const dbInstant=(v:any)=>interactionInstant(v instanceof Date&&Number.isFinite(v.getTime())?v.toISOString():v);
export type LedgerEvent={eventId:string;leadId:string;eventType:string;occurredAt:string|null;recordedAt:string|null;timeBasis:string;sourceChannel:string;sourceRecordType:string;sourceRecordId:string;actor:string;assertionType:string;verificationStatus:string;dedupKey:string;original:string;payload:any;correctionOf?:string;effective:boolean};
const business=new Set(['questionnaire.submitted','assessment.submitted','followup.recorded','task.request_evidence','profile.changed','stage.changed','profile.fields_updated','record.amended','information.extracted','sales.stage_observed','owner.changed','enrollment.confirmation_voided']);
/** Immutable evidence metadata. Absence of occurrence is never replaced with ingestion time. */
export function ledgerMetadata(leadId:string,kind:string,actor:string,d:any,recordedAt=new Date().toISOString()){
 const contact=kind==='followup.recorded'&&d.recordKind==='contact';
 const sourceId=kind==='owner.changed'?actor+':'+d.requestId:d.sourceLogId||d.result?.logId||d.attemptId||d.requestEvidenceId||d.messageId||d.requestId;
 const assertion=kind==='information.extracted'?'ai_interpretation':['followup.recorded','record.amended','sales.stage_observed'].includes(kind)?'sales_report':['questionnaire.submitted','task.request_evidence'].includes(kind)?'customer_statement':'system_event';
 return {schema:1,occurredAt:contact?interactionInstant(d.occurredAt)||null:kind==='questionnaire.submitted'?dbInstant(recordedAt)||null:kind==='stage.changed'?interactionInstant(d.effectiveAt)||null:kind==='profile.fields_updated'?interactionInstant(d.occurredAt)||null:null,recordedAt,timeBasis:kind==='stage.changed'?(interactionInstant(d.effectiveAt)?'staff_reported':'unknown'):contact?(interactionInstant(d.occurredAt)?'staff_reported':'unknown'):'recorded',sourceChannel:contact?d.channel:kind.startsWith('questionnaire')?'questionnaire':kind.startsWith('assessment')?'assessment':kind==='task.request_evidence'?'AI chat':'CRM',sourceRecordType:kind==='followup.recorded'?'sales_activity':kind==='assessment.submitted'?'assessment':kind==='task.request_evidence'?'request':'fact',sourceRecordId:sourceId||null,actor,assertionType:assertion,verificationStatus:assertion==='sales_report'||assertion==='customer_statement'?'unverified':'recorded',dedupKey:sourceId?[leadId,kind,sourceId,...(kind==='sales.stage_observed'?[d.stage]:[])].join(':'):null,method:'direct_record',version:1};
}
export function projectFactLedger(leadId:string,facts:any[],messages:any[]=[],attempts:any[]=[],profile:any={}):LedgerEvent[]{
 const result:LedgerEvent[]=[],seen=new Set<string>();
 const corrections=new Map(facts.filter(f=>f.kind==='fact.corrected').map(f=>[f.data.correctionOf,f]));
 const withdrawn=withdrawnFactIds(facts),voids=enrollmentVoids(facts);
 for(const f of facts){
  if(!business.has(f.kind)&&f.kind!=='fact.corrected')continue;
  const d=f.data||{},m=d.ledger||ledgerMetadata(leadId,f.kind,f.actor,d,f.created_at);
  const record=m.sourceRecordId||f.id,key=f.kind==='sales.stage_observed'?[leadId,f.kind,d.sourceLogId||f.id,d.stage].join(':'):m.dedupKey||f.id;if(seen.has(key))continue;seen.add(key);
  const source=f.kind==='task.request_evidence'?messages.find(v=>v.conversation_id===d.conversationId&&(v.id===d.messageId||v.request_id===d.messageId)&&v.role==='user'):null;
  const assessment=f.kind==='assessment.submitted'?attempts.find(v=>v.id===d.attemptId):null;
  const linkedLog=f.kind==='followup.recorded'?(profile.followUpLogs||[]).find((v:any)=>v.id===d.result?.logId):null;
  const actual=source?dbInstant(source.created_at):assessment?dbInstant(assessment.created_at):interactionInstant(m.occurredAt)||interactionInstant(linkedLog?.occurredAt);
  result.push({eventId:f.id,leadId,eventType:f.kind,occurredAt:actual||null,recordedAt:dbInstant(f.created_at)||null,timeBasis:source||assessment?'server_received':actual?m.timeBasis:'unknown',sourceChannel:m.sourceChannel,sourceRecordType:m.sourceRecordType,sourceRecordId:record,actor:f.actor,assertionType:m.assertionType,verificationStatus:withdrawn.has(f.id)?'corrected':m.verificationStatus,dedupKey:key,original:source?.content||d.originalText||d.summary||(f.kind==='stage.changed'?d.reason:'')||(f.kind==='record.amended'?d.text:'')||(f.kind==='owner.changed'?d.reason:'')||'',payload:voids.has(f.id)?{...d,enrollmentVoid:{...voids.get(f.id).data,actor:voids.get(f.id).actor}}:d,correctionOf:d.correctionOf,effective:!withdrawn.has(f.id)});
 }
 for(const m of messages){if(m.role!=='user')continue;const key='message:'+m.id;if(seen.has(key))continue;seen.add(key);result.push({eventId:key,leadId,eventType:'customer.message',occurredAt:dbInstant(m.created_at)||null,recordedAt:dbInstant(m.created_at)||null,timeBasis:'server_received',sourceChannel:'AI chat',sourceRecordType:'message',sourceRecordId:m.id,actor:'visitor',assertionType:'customer_statement',verificationStatus:'unverified',dedupKey:key,original:m.content,payload:{conversationId:m.conversation_id},effective:true});}
 for(const a of attempts){if(result.some(e=>e.sourceRecordType==='assessment'&&e.sourceRecordId===a.id))continue;const at=dbInstant(a.created_at)||null;result.push({eventId:'assessment:'+a.id,leadId,eventType:'assessment.submitted',occurredAt:at,recordedAt:at,timeBasis:'server_received',sourceChannel:'assessment',sourceRecordType:'assessment',sourceRecordId:a.id,actor:'visitor',assertionType:'system_event',verificationStatus:'recorded',dedupKey:'assessment:'+a.id,original:JSON.stringify(a.result||{}),payload:a.result||{},effective:true});}
 const orderingTime=(e:LedgerEvent)=>Date.parse(e.eventType==='record.amended'?e.recordedAt||'':e.occurredAt||'')||0;
 return result.sort((a,b)=>orderingTime(b)-orderingTime(a)||a.eventId.localeCompare(b.eventId));
}
