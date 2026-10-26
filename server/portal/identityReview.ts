import {loadCrmAccessControls as identityControls} from './crmAccessControls.ts';
import { normalizeContactPhone } from './trustWorkflow.ts';
import { validContactPhone } from '../../src/utils/contactPhone.ts';
import { validContactEmail } from '../../src/utils/contactEmail.ts';
import { canReviewIdentityRole,isCrmManager } from '../../src/utils/crmOutreach.ts';
export function identityMatch(a: any, b: any) {
  const email = (p: any) => typeof p.email === 'string' && p.email.trim() && validContactEmail(p.email) ? p.email.trim().toLowerCase() : '';
  const phone = (p: any) => validContactPhone(p.whatsapp) ? normalizeContactPhone(p.whatsapp) : '';
  return [email(a) && email(a)===email(b) ? 'email' : '', phone(a) && phone(a)===phone(b) ? 'phone' : ''].filter(Boolean);
}
export {loadCrmAccessControls as identityControls} from './crmAccessControls.ts';
export async function pendingIdentity(c: any, leadId?: string, lock=false) {
  const rows = (await (lock&&leadId?c.query("SELECT i.*,a.profile AS source_profile,b.profile AS candidate_profile FROM identity_candidates i JOIN portal_leads a ON a.id=i.lead_id JOIN portal_leads b ON b.id=i.candidate_id WHERE i.decision='pending' AND (i.lead_id=:p1 OR i.candidate_id=:p1) FOR UPDATE",[leadId]):c.query("SELECT i.*,a.profile AS source_profile,b.profile AS candidate_profile FROM identity_candidates i JOIN portal_leads a ON a.id=i.lead_id JOIN portal_leads b ON b.id=i.candidate_id WHERE i.decision='pending'"))).rows;
  return rows.filter((r: any) => (!leadId || r.lead_id===leadId || r.candidate_id===leadId) && identityMatch(r.source_profile,r.candidate_profile).length);
}
export async function attachIdentity(c: any, employee: any, leads: any[], lock=false) {
  const rows = lock&&leads.length===1?await pendingIdentity(c,leads[0].id,true):await pendingIdentity(c);
  const controls=await identityControls(c);
  const {permittedRecord}=await import("../../src/utils/accessControl.ts");
  for (const lead of leads) {
    const matches = rows.filter((r: any)=>r.lead_id===lead.id || r.candidate_id===lead.id);
    lead.identityReview = {pending:matches.length>0,count:new Set(matches.map((r: any)=>r.lead_id===lead.id?r.candidate_id:r.lead_id)).size,canReview:Boolean(canReviewIdentityRole(employee,controls)&&matches.some((r:any)=>permittedRecord(employee,r.source_profile,"crm.followup")&&permittedRecord(employee,r.candidate_profile,"crm.followup"))),blocked:matches.length>0&&!isCrmManager(employee),...controls};
  }
}
export async function discoverIdentity(c:any,visitorId:string,leadId:string,profile:any){
  const email=typeof profile.email==='string'&&validContactEmail(profile.email)?profile.email.trim().toLowerCase():'';
  const phone=validContactPhone(profile.whatsapp)?normalizeContactPhone(profile.whatsapp):'';
  if(!email&&!phone)return;
  const rows=(await c.query("SELECT id,profile FROM portal_leads WHERE id<>:p1 AND ((:p2<>'' AND lower(TRIM(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.email')),'null')))=:p2) OR (:p3<>'' AND REGEXP_REPLACE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.whatsapp')),'null'),'[^0-9]','') IN (:p3,:p4,:p5))) FOR UPDATE",[leadId,email,phone,phone.startsWith('62')?'0'+phone.slice(2):phone,phone?'00'+phone:''])).rows;
  for(const row of rows)if(identityMatch(profile,row.profile).length)await c.query("INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id) VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE visitor_id=visitor_id",[visitorId,leadId,row.id]);
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
    const pending=(await pendingIdentity(c,leadId)).filter((r:any)=>canRead(r.source_profile)&&canRead(r.candidate_profile));
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
  const pending=relations.some((r:any)=>r.decision==='pending')&&basis.length>0;
  const decided=relations.filter((r:any)=>r.decision!=='pending').sort((a:any,b:any)=>String(b.decided_at||'').localeCompare(String(a.decided_at||'')))[0];
  const revision=createHash('sha256').update(JSON.stringify({leads,relations,tasks,facts,evidence})).digest('hex');
  const subjectId=identityComparisonSubject(relations);
  const side=(row:any)=>({recordRole:subjectId?(row.id===subjectId?"review_subject":"existing_match"):"undetermined",profile:row.profile,normalizedContact:{email:validContactEmail(row.profile.email)?row.profile.email.trim().toLowerCase():null,phone:validContactPhone(row.profile.whatsapp)?normalizeContactPhone(row.profile.whatsapp):null},tasks:tasks.filter((t:any)=>t.lead_id===row.id),facts:facts.filter((f:any)=>f.lead_id===row.id),messages:evidence.filter((m:any)=>m.lead_id===row.id)});
  return {leadId,candidateId,left:side(left),right:side(right),basis,pending,decision:pending?'pending':decided?.decision||'unavailable',reason:decided?.reason||'',decidedBy:decided?.decided_by||null,decidedAt:decided?.decided_at?(String(decided.decided_at).includes('T')?decided.decided_at:String(decided.decided_at).replace(' ','T')+'Z'):null,revision};
}
