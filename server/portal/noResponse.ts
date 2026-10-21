import {noResponseAttempt,confirmedTier,completeQuestionnaire,type NoResponsePolicy,type NoResponseSequence} from '../../src/utils/crmNoResponse.ts';
import {evaluateFullLeadTier} from '../../src/types/crmLead.ts';
import {effectivePolicy,policyConfigErrors} from '../../src/utils/crmPolicyConfigValidation.ts';
import {randomUUID} from 'node:crypto';
async function record(c:any,id:string,actor:string,data:any){await c.query("INSERT INTO crm_facts(id,lead_id,kind,actor,data) VALUES(:p1,:p2,'contact.sequence',:p3,:p4)",[randomUUID(),id,actor,data]);}
export async function sequencePolicy(c:any):Promise<NoResponsePolicy>{
 const rows=(await c.query("SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy')")).rows;
 const value=effectivePolicy(rows.find((r:any)=>r.id==='crm_policy')?.value,rows.find((r:any)=>r.id==='sla')?.value);
 const errors=policyConfigErrors(value);
 if(Object.keys(errors).some(k=>k.startsWith('noResponseCadence.')||k.startsWith('businessHours.')))throw Error('Contact sequence configuration requires review');
 const d=value.noResponseCadence.retryInterval;
 return {threshold:value.noResponseCadence.maxRetriesBeforeNurture,intervalMs:d.value*({minutes:60000,hours:3600000,days:86400000}[d.unit]),calendar:{timezone:value.businessHours.timezone,start:value.businessHours.startTime,end:value.businessHours.endTime,days:value.businessHours.workDays}};
}
function restore(p:any,s:NoResponseSequence,at:string){
 if(confirmedTier(p))return;
 if(s.appliedAt && (p.tier!=='Cold-Nurture'||p.tierSource!=='behaviour_override'||p.tierUpdatedAt!==s.appliedAt)){s.needsGroupReview=true;return;}
 if(s.appliedAt){
  if(completeQuestionnaire(p)) {const evaluated=evaluateFullLeadTier({...p,noResponseReady:false,assessmentDone:typeof p.quizScore==='number'});Object.assign(p,{tier:evaluated.tier,tierSource:evaluated.source,flag:evaluated.flag,tierUpdatedAt:at});}
  else if(s.beforeTier)for(const key of ['tier','tierSource','flag','tierUpdatedAt']){const value=(s.beforeTier as any)[key];if(value===null)delete p[key];else p[key]=value;}
  else s.needsGroupReview=true;
 }else if(p.tier==='Cold-Nurture'&&p.tierSource==='behaviour_override'){if(completeQuestionnaire(p)){const evaluated=evaluateFullLeadTier({...p,noResponseReady:false,assessmentDone:typeof p.quizScore==='number'});Object.assign(p,{tier:evaluated.tier,tierSource:evaluated.source,flag:evaluated.flag,tierUpdatedAt:at});}else s.needsGroupReview=true;}
}
export function clearSequence(profile:any,source:string,clock:Date){
 const p={...profile};const old=profile.noResponseSequence as NoResponseSequence|undefined;
 const s:NoResponseSequence={...old,schema:1,revision:(old?.revision||0)+1,count:0,status:'replied',startedAt:clock.toISOString(),resetAt:clock.toISOString(),resetSource:source,lastOutcome:'replied',waitUntil:undefined,policy:undefined,nextEligibleAt:undefined};
 if(source==='human_connected')s.lastAttemptAt=clock.toISOString();
 restore(p,s,clock.toISOString());p.noResponseSequence=s;return p;
}
export async function applyContactSequence(c:any,profile:any,body:any,actor:string,clock:Date){
 if(body.customerReplied || (body.recordKind!=='closure'&&body.connectStatus==='Connected')){
  const p=clearSequence(profile,body.customerReplied?'staff_reply_confirmation':'human_connected',clock);
  await record(c,p.id,actor,{...p.noResponseSequence,channel:body.channel});
  if(body.customerReplied)await c.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data) VALUES(:p1,:p2,'reply_confirmation',:p3,:p4)",['reply:'+actor+':'+body.requestId,p.id,body.requestId,{channel:body.channel,text:body.summary}]);
  return p;
 }
 if(body.recordKind==='closure')return profile;
 const policy=profile.noResponseSequence?.status!=='replied'&&profile.noResponseSequence?.policy || await sequencePolicy(c);
 const p={...profile,noResponseSequence:noResponseAttempt(profile.noResponseSequence,body.connectStatus,policy,clock)};
 await record(c,p.id,actor,p.noResponseSequence);return p;
}
/** Only a newly persisted, trusted customer event can clear the sequence. Never replay old attachments. */
export async function customerReplied(c:any,leadId:string,key:string,recordedAt?:any,clock=new Date()){
 const p=(await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",[leadId])).rows[0]?.profile;
 if(!p)return;
 const s=p.noResponseSequence as NoResponseSequence|undefined;
 if(!s && !(p.tier==='Cold-Nurture'&&p.tierSource==='behaviour_override'))return;
 if(!s && recordedAt)return;
 if(s && !s.count&&s.status==='replied')return;
 const occurred=recordedAt?new Date(recordedAt).getTime():clock.getTime();
 if(!Number.isFinite(occurred)||(s && (occurred<Date.parse(s.startedAt)||occurred<Date.parse(s.resetAt||s.startedAt)||(recordedAt&&occurred===Date.parse(s.startedAt)))))return;
 const next=clearSequence(p,key,clock);
 await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1",[leadId,next]);await record(c,leadId,'customer',next.noResponseSequence);
}
export async function settleNoResponse(c:any,clock:Date){
 const rows=(await c.query("SELECT id,profile FROM portal_leads WHERE JSON_UNQUOTE(JSON_EXTRACT(profile,'$.noResponseSequence.status'))='waiting' AND JSON_UNQUOTE(JSON_EXTRACT(profile,'$.noResponseSequence.waitUntil'))<=:p1 ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED",[clock.toISOString()])).rows;
 for(const row of rows){
  const p=row.profile,s=p.noResponseSequence as NoResponseSequence;
  if(!s.policy||!s.waitUntil||!Number.isFinite(Date.parse(s.waitUntil))||Date.parse(s.waitUntil)>clock.getTime()||s.count<s.policy.threshold||s.policy.threshold===0)continue;
  if(confirmedTier(p)){s.status='protected';}
  else if(['Enrolled','Lost'].includes(p.currentStage)){s.status='review';s.needsGroupReview=true;}
  else {s.beforeTier={tier:p.tier??null,tierSource:p.tierSource??null,flag:p.flag??null,tierUpdatedAt:p.tierUpdatedAt??null};s.status='nurtured';s.appliedAt=clock.toISOString();p.tier='Cold-Nurture';p.tierSource='behaviour_override';p.tierUpdatedAt=s.appliedAt;}
  s.revision++;await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1",[row.id,p]);await record(c,row.id,'system',s);
 }
}
