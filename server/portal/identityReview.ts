import {identityCrossConflict} from '../../src/utils/crmIdentityCandidates.ts';
import {canonicalIdentity} from './identityConsolidation.ts';
import {loadCrmAccessControls as identityControls} from './crmAccessControls.ts';
import { normalizeContactPhone } from './trustWorkflow.ts';
import { validContactPhone } from '../../src/utils/contactPhone.ts';
import { validContactEmail } from '../../src/utils/contactEmail.ts';
import { canReviewIdentityRole } from '../../src/utils/crmOutreach.ts';
export function identityMatch(a: any, b: any) {
  const email = (p: any) => typeof p.email === 'string' && p.email.trim() && validContactEmail(p.email) ? p.email.trim().toLowerCase() : '';
  const phone = (p: any) => validContactPhone(p.whatsapp) ? normalizeContactPhone(p.whatsapp) : '';
  return [email(a) && email(a)===email(b) ? 'email' : '', phone(a) && phone(a)===phone(b) ? 'phone' : ''].filter(Boolean);
}
export {loadCrmAccessControls as identityControls} from './crmAccessControls.ts';
export async function pendingIdentity(c: any, leadId?: string, lock=false) {
  const rows = (await (lock&&leadId?c.query("SELECT i.*,a.profile AS source_profile,b.profile AS candidate_profile FROM identity_candidates i JOIN portal_leads a ON a.id=i.lead_id JOIN portal_leads b ON b.id=i.candidate_id WHERE i.decision='pending' AND i.lead_id=:p1 FOR UPDATE",[leadId]):c.query("SELECT i.*,a.profile AS source_profile,b.profile AS candidate_profile FROM identity_candidates i JOIN portal_leads a ON a.id=i.lead_id JOIN portal_leads b ON b.id=i.candidate_id WHERE i.decision='pending'"))).rows;
  const aliases=rows.length?(await c.query("SELECT id,profile FROM portal_leads WHERE NULLIF(profile->>'$.identityMergedInto','null') IS NOT NULL")).rows:[];
  return rows.map((r:any)=>({...r,aliasMatches:aliases.filter((a:any)=>a.profile.identityMergedInto===r.candidate_id&&identityMatch(r.source_profile,a.profile).length).map((a:any)=>({id:a.id,name:a.profile.fullName,basis:identityMatch(r.source_profile,a.profile)}))})).filter((r:any)=>(!leadId||r.lead_id===leadId)&&!r.source_profile.identityMergedInto&&(identityMatch(r.source_profile,r.candidate_profile).length||r.aliasMatches.length));
}
export async function attachIdentity(c: any, employee: any, leads: any[], lock=false) {
  const rows = lock&&leads.length===1?await pendingIdentity(c,leads[0].id,true):await pendingIdentity(c);
  const controls=await identityControls(c);
  const {permittedRecord}=await import("../../src/utils/accessControl.ts");
  for (const lead of leads) {
    const matches = rows.filter((r: any)=>r.lead_id===lead.id);
    lead.identityReview = {pending:matches.length>0,count:new Set(matches.map((r: any)=>r.lead_id===lead.id?r.candidate_id:r.lead_id)).size,canReview:Boolean(canReviewIdentityRole(employee,controls)&&matches.some((r:any)=>permittedRecord(employee,r.source_profile,"crm.followup")&&permittedRecord(employee,r.candidate_profile,"crm.followup"))),blocked:matches.length>0,crossConflict:identityCrossConflict(matches.map((r:any)=>({id:r.candidate_id,basis:identityMatch(r.source_profile,r.candidate_profile)}))),...controls};
  }
}
export async function discoverIdentity(c:any,visitorId:string,leadId:string,profile:any){
  const email=typeof profile.email==='string'&&validContactEmail(profile.email)?profile.email.trim().toLowerCase():'';
  const phone=validContactPhone(profile.whatsapp)?normalizeContactPhone(profile.whatsapp):'';
  if(!email&&!phone)return;
  const rows=(await c.query("SELECT id,profile FROM portal_leads WHERE id<>:p1 AND ((:p2<>'' AND lower(TRIM(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.email')),'null')))=:p2) OR (:p3<>'' AND REGEXP_REPLACE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.whatsapp')),'null'),'[^0-9]','') IN (:p3,:p4,:p5))) FOR UPDATE",[leadId,email,phone,phone.startsWith('62')?'0'+phone.slice(2):phone,phone?'00'+phone:''])).rows;
  const candidates=new Map<string,any>();
  for(const row of rows){
    if(!identityMatch(profile,row.profile).length)continue;
    const root=await canonicalIdentity(c,row.id);
    if(!root||root.id===leadId)continue;
    const decided=(await c.query("SELECT decision FROM identity_candidates WHERE lead_id=:p1 AND candidate_id=:p2 AND decision IN ('different','shared')",[leadId,root.id])).rows;
    if(decided.length)continue;
    if(root.profile.identityLifecycle==='pending'){
      // A pending submission is evidence, never a confirmed identity anchor.
      const parents=(await pendingIdentity(c,root.id)).map((r:any)=>({id:r.candidate_id,profile:r.candidate_profile}));
      for(const parent of parents)if(identityMatch(profile,parent.profile).length)candidates.set(parent.id,parent);
      if(!parents.some((parent:any)=>identityMatch(profile,parent.profile).length))candidates.set(root.id,root);
    }else candidates.set(root.id,root);
  }
  for(const row of candidates.values())await c.query("INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id) VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE visitor_id=visitor_id",[visitorId,leadId,row.id]);
  return candidates.size;

}

/** A stored candidate direction is provenance, never a verified-person assertion. */
export function identityComparisonSubject(relations:any[]){
 const pending=relations.filter(r=>r.decision==='pending');
 const subjects=[...new Set((pending.length?pending:relations).map(r=>r.lead_id))];
 return subjects.length===1?subjects[0]:null;
}
/** Two-record evidence view. Authorization is applied before either record is returned. */
export async function identityComparison(c:any,leadId:string,candidateId:string|undefined,canRead:(profile:any)=>boolean){
  const {invalid}=await import('./trustWorkflow.ts');
  const {createHash}=await import('node:crypto');
  if(!candidateId){
    const pending=(await pendingIdentity(c)).filter((r:any)=>r.lead_id===leadId||r.candidate_id===leadId).filter((r:any)=>canRead(r.source_profile)&&canRead(r.candidate_profile));
    const first=pending.sort((a:any,b:any)=>String(a.candidate_id).localeCompare(String(b.candidate_id)))[0];
    candidateId=first&&(first.lead_id===leadId?first.candidate_id:first.lead_id);
  }
  if(!candidateId||candidateId===leadId)invalid('Identity candidate changed; refresh and review',409);
  const leads=(await c.query('SELECT id,profile FROM portal_leads WHERE id IN (:p1,:p2) ORDER BY id',[leadId,candidateId])).rows;
  const left=leads.find((r:any)=>r.id===leadId),right=leads.find((r:any)=>r.id===candidateId);
  if(!left||!right||!canRead(left.profile)||!canRead(right.profile))invalid('Lead not found',404);
  const relations=(await c.query('SELECT * FROM identity_candidates WHERE (lead_id=:p1 AND candidate_id=:p2) OR (lead_id=:p2 AND candidate_id=:p1) ORDER BY visitor_id,candidate_id',[leadId,candidateId])).rows;
  if(!relations.length)invalid('Identity candidate changed; refresh and review',409);
  const tasks=(await c.query('SELECT * FROM followup_tasks WHERE lead_id IN (:p1,:p2) ORDER BY lead_id,due_at,id',[leadId,candidateId])).rows;
  const facts=(await c.query('SELECT id,lead_id,kind,actor,data,created_at FROM crm_facts WHERE lead_id IN (:p1,:p2) ORDER BY created_at DESC,id DESC LIMIT 100',[leadId,candidateId])).rows;
  const evidence=[];
  for(const id of [leadId,candidateId])evidence.push(...(await c.query("SELECT m.id,m.role,m.content,m.status,m.created_at,c.source,c.lead_id,c.id AS conversation_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.lead_id=:p1 ORDER BY m.created_at DESC,m.id DESC LIMIT 50",[id])).rows);
  const basis=identityMatch(left.profile,right.profile);
  const validPending=(await pendingIdentity(c)).filter((r:any)=>(r.lead_id===leadId&&r.candidate_id===candidateId)||(r.lead_id===candidateId&&r.candidate_id===leadId));
  const pending=validPending.length>0;
  const decided=relations.filter((r:any)=>r.decision!=='pending').sort((a:any,b:any)=>String(b.decided_at||'').localeCompare(String(a.decided_at||'')))[0];
  const subjectForGroup=identityComparisonSubject(relations);
  const group=subjectForGroup?await pendingIdentity(c,subjectForGroup):[];
  if(group.some((r:any)=>!canRead(r.source_profile)||!canRead(r.candidate_profile)))invalid('Lead not found',404);
  const candidates=group.map((r:any)=>({id:r.candidate_id,name:r.candidate_profile.fullName,businessNumber:r.candidate_profile.businessNumber,owner:r.candidate_profile.owner,basis:identityMatch(r.source_profile,r.candidate_profile)}));
  const knownRelations=[];
  for(const candidate of candidates.filter((r:any)=>r.id!==candidateId)){
    const known=(await c.query("SELECT lead_id,candidate_id,decision,reason,decided_by FROM identity_candidates WHERE ((lead_id=:p1 AND candidate_id=:p2) OR (lead_id=:p2 AND candidate_id=:p1)) AND decision IN ('shared','different')",[candidateId,candidate.id])).rows;
    knownRelations.push(...known);
  }
  const revision=createHash('sha256').update(JSON.stringify({leads,relations,tasks,facts,evidence,group,knownRelations})).digest('hex');
  const subjectId=identityComparisonSubject(relations);
  const side=(row:any)=>({recordRole:subjectId?(row.id===subjectId?"review_subject":"existing_match"):"undetermined",profile:row.profile,normalizedContact:{email:validContactEmail(row.profile.email)?row.profile.email.trim().toLowerCase():null,phone:validContactPhone(row.profile.whatsapp)?normalizeContactPhone(row.profile.whatsapp):null},tasks:tasks.filter((t:any)=>t.lead_id===row.id),facts:facts.filter((f:any)=>f.lead_id===row.id),messages:evidence.filter((m:any)=>m.lead_id===row.id)});
  return {leadId,candidateId,aliasMatches:validPending.flatMap((r:any)=>r.aliasMatches||[]),left:side(left),right:side(right),basis,pending,subjectId,candidates,knownRelations,crossConflict:identityCrossConflict(candidates),decision:pending?'pending':decided?.decision||'unavailable',reason:decided?.reason||'',decidedBy:decided?.decided_by||null,decidedAt:decided?.decided_at?(String(decided.decided_at).includes('T')?decided.decided_at:String(decided.decided_at).replace(' ','T')+'Z'):null,revision};
}
