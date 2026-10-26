import {optionalOccurrence} from '../../src/utils/crmInteractionTimeline.ts';
import {profileFieldResults} from '../../src/utils/crmProfileSaveResult.ts';
import {randomUUID} from 'node:crypto';
import {applyProfileFields} from '../../src/utils/crmDynamicProfile.ts';
import {fact,invalid,lockLead,operation} from './trustWorkflow.ts';
export async function recordProfileUpdates(c:any,current:any,updates:any,versions:any,context:any){
 const eventId=randomUUID();const applied=applyProfileFields(current,updates,versions,{...context,sourceFactId:eventId});
 if(applied.changes.length)await fact(c,current.id,'profile.fields_updated',context.actor,{eventId,changes:applied.changes,sourceType:context.sourceType,sourceRecordId:context.sourceRecordId,basisFactIds:context.basisFactIds||[],summary:context.reason||'',occurredAt:context.occurredAt||null,recordedAt:context.recordedAt,correction:!!context.correction},eventId);
 return applied;
}
export async function saveProfileUpdates(c:any,leadId:string,actor:string,b:any,canWrite:(p:any)=>boolean,clock=new Date()){
 const current=await lockLead(c,leadId,canWrite);
 if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000)invalid('请记录资料变更依据');
 if(!b.versions||typeof b.versions!=='object')invalid('缺少字段版本，请刷新资料');
 let occurredAt:string|null;try{occurredAt=optionalOccurrence(b.occurredAt,clock);}catch{invalid('实际发生时间不正确');}
 return operation(c,actor,b,{leadId,kind:'profile.fields_updated'},async()=>{
  const applied=await recordProfileUpdates(c,current,b.updates,b.versions,{actor,sourceType:'sales_edit',occurredAt:occurredAt!,recordedAt:clock.toISOString(),reason:b.reason,correction:b.correction===true});
  await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,applied.profile]);return{saved:true,lead:applied.profile,changedFields:applied.changes.map((v:any)=>v.field),profileFieldResults:profileFieldResults(b.updates,applied.changes,applied.profile)};
 });
}
