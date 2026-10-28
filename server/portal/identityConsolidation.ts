import {randomUUID} from 'node:crypto';
import {taskDeadline,leadTier} from './followup.ts';
import {initialTierProvenance} from './tierProvenance.ts';

const fail=(message:string,status=409):never=>{throw Object.assign(Error(message),{status});};
/** Original visitor records are never reassigned: CRM alone reads the consolidated group. */
export async function canonicalIdentity(db:any,leadId:string){
 const row=(await db.query('SELECT id,profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0];
 if(!row)return null;
 if(!row.profile.identityMergedInto)return row;
 const root=(await db.query('SELECT id,profile FROM portal_leads WHERE id=:p1',[row.profile.identityMergedInto])).rows[0];
 if(!root||root.profile.identityMergedInto)fail('IDENTITY_TARGET_CHANGED');
 return root;
}
export async function assertIdentitySalesAllowed(db:any,leadId:string){
 const row=(await db.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0];
 if(row?.profile.identityMergedInto)fail('IDENTITY_RECORD_MERGED');
 if(row?.profile.identityLifecycle==='pending')fail('IDENTITY_REVIEW_REQUIRED');
 const {pendingIdentity}=await import('./identityReview.ts');
 if((await pendingIdentity(db,leadId)).length)fail('IDENTITY_REVIEW_REQUIRED');
}
/** One transaction-owned lock covers registration and decisions, including concurrent contacts. */
export async function lockIdentityRegistry(db:any){
 await db.query('SELECT GET_LOCK(:p1,5)', ['crm-identity-registry-v1']);
}
export async function activateIdentityLead(db:any,profile:any,actor:string){
 const tasks=(await db.query("SELECT id FROM followup_tasks WHERE lead_id=:p1 AND kind='consultation'",[profile.id])).rows;
 if(tasks.length)return profile;
 const settings=(await db.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0]?.value;
 const registered=new Date(profile.submittedAt);
 if(!Number.isFinite(registered.getTime()))fail('IDENTITY_REGISTRATION_TIME_REQUIRED');
 const {due,snapshot}=taskDeadline(profile,'consultation',settings,registered);
 const taskId=randomUUID();
 await db.query('INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,:p3,:p4,:p5)',[taskId,profile.id,'consultation',profile.owner||null,due]);
 const next:any={...profile,currentStage:profile.currentStage||'progress:unreached',tier:leadTier(profile),stageUpdatedAt:profile.stageUpdatedAt||profile.submittedAt,slaDueTime:due.toISOString(),identityLifecycle:'independent',identityReleasedAt:new Date().toISOString()};
 if(!profile.initialTierDecision){
  const original=(await db.query("SELECT id FROM crm_facts WHERE lead_id=:p1 AND kind='questionnaire.submitted' ORDER BY created_at,id LIMIT 1",[profile.id])).rows[0];
  if(original)Object.assign(next,initialTierProvenance(next,original.id,next.identityReleasedAt));
 }
 await db.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[profile.id,next]);
 const {event}=await import('./store.ts');
 await event(db,'lead.created',profile.id,{taskId,sla:snapshot,source:profile.entryPoint||'standalone_chat',identityReleased:true,actor});
 return next;
}
const supplementFields=['fullName','name','whatsapp','email','currentStatus','goal','goals','reportedLevel','levelState','city','cityDetail','mode','hskExamPlan','communicationLanguage'];
const empty=(v:any)=>v===null||v===undefined||v===''||Array.isArray(v)&&!v.length;
export function consolidatedProfile(primary:any,sources:any[]){
 const result={...primary};
 result.identitySources=sources.map(p=>({id:p.id,businessNumber:p.businessNumber,fullName:p.fullName,whatsapp:p.whatsapp,email:p.email,campaignId:p.campaignId,campaign:p.campaign,submittedAt:p.submittedAt,entryPoint:p.entryPoint,promotionLinkId:p.promotionLinkId,attributionCampaignId:p.attributionCampaignId,campaignSourceStatus:p.campaignSourceStatus,assessmentProvenance:p.assessmentProvenance,assessed:Boolean(p.latestAssessment)}));
 // No sales state, first-touch source, score or manual decision is silently overwritten.
 for(const source of sources)for(const field of supplementFields)if(empty(result[field])&&!empty(source[field]))result[field]=source[field];
 result.identitySearchTerms=sources.flatMap(p=>[p.id,p.businessNumber,p.fullName,p.email,p.whatsapp]).filter(Boolean).join(' ');
 return result;
}
export async function projectIdentityProfiles(db:any,profiles:any[]){
 if(!profiles.length)return profiles;
 const all=(await db.query("SELECT id,profile FROM portal_leads WHERE NULLIF(profile->>'$.identityMergedInto','null') IS NOT NULL")).rows;
 return profiles.filter(p=>!p.identityMergedInto).map(p=>consolidatedProfile(p,all.filter((r:any)=>r.profile.identityMergedInto===p.id).map((r:any)=>r.profile)));
}
/** Batch project immutable source rows into an already-authorized primary's CRM view. */
export async function identityProjectionRows(db:any,profiles:any[],sql:string){
 const owners=new Map<string,string>();
 for(const p of profiles){owners.set(p.id,p.id);for(const s of p.identitySources||[])owners.set(s.id,p.id);}
 const rows=(await db.query(sql,[JSON.stringify([...owners.keys()])])).rows;
 return rows.map((r:any)=>({...r,originLeadId:r.lead_id,lead_id:owners.get(r.lead_id)||r.lead_id}));
}
export function explicitIdentityRefusal(text:string){
 // Full, direct requests only. Quoted examples, questions and conditional statements are not decisions.
 return /^(?:请)?(?:不要再联系我|别再联系我|不要再给我打电话)[。！!\s]*$|^(?:please\s+)?(?:do not contact me(?: again)?|stop contacting me)[.!\s]*$|^(?:tolong\s+)?jangan hubungi saya lagi[.!\s]*$/iu.test(text.trim());
}
export async function recordIdentityRefusal(db:any,leadId:string,text:string,sourceId:string){
 if(!explicitIdentityRefusal(text))return;
 const source=(await db.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[leadId])).rows[0]?.profile;
 if(!source||source.identityLifecycle!=='pending'&&!source.identityMergedInto)return;
 const request={text,sourceId,at:new Date().toISOString()};
 await db.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,{...source,identityStopRequest:request}]);
 if(source.identityMergedInto){
  const root=await canonicalIdentity(db,leadId);
  if(root){
   const current=(await db.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[root.id])).rows[0].profile;
   await db.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[root.id,{...current,contactArrangement:{state:'stopped',reason:text,actor:'visitor',at:request.at,version:(current.contactArrangement?.version||0)+1}}]);
  }
 }
 const {fact}=await import('./trustWorkflow.ts');
 await fact(db,leadId,'identity.contact_refused','visitor',request);
}
export async function attachIdentityContactHolds(db:any,profiles:any[]){
 if(!profiles.length)return;
 const {pendingIdentity,identityMatch}=await import('./identityReview.ts');
 const pending=await pendingIdentity(db);
 for(const p of profiles){
  p.identityContactHold=pending.filter((r:any)=>r.candidate_id===p.id&&r.source_profile.identityStopRequest).flatMap((r:any)=>identityMatch(r.source_profile,p));
 }
}
/** This operation is a logical association; source rows and visitor credentials stay intact. */
export async function mergeIdentityLead(db:any,subject:any,primary:any,actor:string,reason:string){
 if(subject.identityMergedInto||primary.identityMergedInto||primary.identityLifecycle==='pending')fail('IDENTITY_TARGET_CHANGED');
 const tasks=(await db.query('SELECT id FROM followup_tasks WHERE lead_id=:p1',[subject.id])).rows;
 if(subject.owner||tasks.length||(subject.followUpLogs||[]).length||(subject.commitments||[]).length||subject.contactArrangement||subject.currentStage&&!['New','progress:unreached'].includes(subject.currentStage))fail('IDENTITY_LEGACY_BUSINESS_REVIEW_REQUIRED');
 const other=(await db.query("SELECT candidate_id FROM identity_candidates WHERE lead_id=:p1 AND candidate_id<>:p2 AND decision='pending'",[subject.id,primary.id])).rows;
 if(other.length)fail('IDENTITY_CROSS_CONFLICT_REQUIRED');
 const at=new Date().toISOString();
 const merged={...subject,identityMergedInto:primary.id,identityLifecycle:'merged',identityMergedAt:at,identityMergedBy:actor,identityMergeReason:reason};
 await db.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[subject.id,merged]);
 if(subject.identityStopRequest&&primary.contactArrangement?.state!=='stopped'){
  await db.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[primary.id,{...primary,contactArrangement:{state:'stopped',reason:subject.identityStopRequest.text,actor,at,version:(primary.contactArrangement?.version||0)+1}}]);
 }
 // Originals retain their Lead IDs. New staff work uses only the primary record.
 const {fact}=await import('./trustWorkflow.ts');
 await fact(db,primary.id,'identity.merged',actor,{sourceLeadId:subject.id,targetLeadId:primary.id,reason,at,scope:'logical_association_originals_preserved'});
 await db.query("UPDATE notification_jobs SET state='cancelled',result='Identity record consolidated; historical event not replayed',completed_at=UTC_TIMESTAMP(6) WHERE snapshot->>'$.leadId'=:p1 AND state='pending'",[subject.id]);
 return {canonicalLeadId:primary.id,sourceLeadId:subject.id,merged:true};
}
