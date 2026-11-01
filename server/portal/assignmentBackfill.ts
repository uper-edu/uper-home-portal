import crypto from 'node:crypto';
import {lockIdentityRegistry} from './identityConsolidation.ts';
import {assignmentDirectory,assignmentCandidates,roundRobinNext,writeAssignment} from './autoAssignment.ts';
import {permittedRecord} from '../../src/utils/accessControl.ts';
import {policyEqual} from '../../src/utils/crmPolicyTopics.ts';
import {effectivePolicy,mergePolicyConfig} from '../../src/utils/crmPolicyConfigValidation.ts';
import {pendingIdentity} from './identityReview.ts';
const key=crypto.randomBytes(32),hash=(v:any)=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=(status:number,code:string):never=>{throw Object.assign(Error(code),{status})};
async function actorDirectory(c:any,actor:any){const directory=await assignmentDirectory(c);const fresh=directory.find((e:any)=>e.id===actor.id);if(!fresh?.active||!fresh.permissions.includes('crm.operations.manage')||!fresh.permissions.includes('crm.assign')||!permittedRecord(fresh,{team:'sales',owner:null},'crm.assign')||!permittedRecord(fresh,{team:'sales',owner:null},'crm.read'))fail(403,'backfill_forbidden');return {actor:fresh,directory};}
async function policy(c:any,lock=false){const rows=(await c.query("SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy') ORDER BY id"+(lock?' FOR UPDATE':' FOR SHARE'))).rows;return effectivePolicy(rows.find((r:any)=>r.id==='crm_policy')?.value,rows.find((r:any)=>r.id==='sla')?.value||{timezone:'Asia/Jakarta',start:'09:00',end:'20:00',days:[1,2,3,4,5],hotHours:3,warmHours:24,coldHours:48});}
const sign=(v:any)=>{const body=Buffer.from(JSON.stringify(v)).toString('base64url');return body+'.'+crypto.createHmac('sha256',key).update(body).digest('base64url')};
function verify(token:any){if(typeof token!=='string'||token.length>100000)fail(400,'backfill_preview_invalid');const [body,signature,...extra]=token.split('.');const expected=crypto.createHmac('sha256',key).update(body||'').digest('base64url');if(extra.length||!signature||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))fail(400,'backfill_preview_invalid');try{return JSON.parse(Buffer.from(body,'base64url').toString())}catch{return fail(400,'backfill_preview_invalid')}}
async function eligible(c:any,actor:any,lead:any){return lead&&!lead.owner&&lead.identityLifecycle!=='pending'&&!lead.identityMergedInto&&permittedRecord(actor,lead,'crm.read')&&permittedRecord(actor,lead,'crm.assign')&&!(await pendingIdentity(c,lead.id)).length;}
/** Read-only preview; a signed, short-lived snapshot creates no database records. */
export async function previewBackfill(c:any,originalActor:any,input:any){
 const current=await policy(c),{actor,directory}=await actorDirectory(c,originalActor);
 const proposed=input?.configuration;if(!proposed||Object.keys(input).some(k=>k!=='configuration'))fail(400,'backfill_preview_invalid');
 const merged=mergePolicyConfig(current,{autoAssignment:proposed});if(Object.keys(merged.errors).length||!proposed.salesIds?.length)fail(400,'backfill_participants_required');
 const state=(await c.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor' FOR SHARE")).rows[0]?.value||{};
 const leads=(await c.query("SELECT profile FROM portal_leads WHERE NULLIF(profile->>'$.owner','null') IS NULL OR profile->>'$.owner'='' ORDER BY created_at,id")).rows;
 let cursor=state.lastEmployeeId,total=0;const rows:any[]=[],signed:any[]=[];
 for(const {profile:lead} of leads){if(!await eligible(c,actor,lead))continue;const candidates=assignmentCandidates(directory,proposed.salesIds,lead),owner=roundRobinNext(candidates.map((e:any)=>e.id),cursor);if(!owner)continue;total++;if(rows.length>=100)continue;cursor=owner;const target=candidates.find((e:any)=>e.id===owner);rows.push({id:lead.id,name:lead.fullName||lead.name||lead.businessNumber||lead.id,ownerId:owner,ownerName:target.displayName||owner});signed.push({id:lead.id,ownerChangedAt:lead.ownerChangedAt||null,ownerId:owner});}
 const id=crypto.randomUUID(),expiresAt=Date.now()+10*60*1000;
 return {id,expiresAt,total,rows,confirmable:policyEqual(current.autoAssignment,proposed),token:sign({id,actor:actor.id,expiresAt,configuration:proposed,cursorHash:hash(state),rows:signed})};
}
const receiptKey=(id:string)=>'assignment-backfill:'+id;
export async function backfillResult(c:any,originalActor:any,id:string){await actorDirectory(c,originalActor);if(!/^[a-f0-9-]{36}$/.test(id))fail(400,'backfill_preview_invalid');const receipt=(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',[originalActor.id,receiptKey(id)])).rows[0]?.result;if(receipt?.operationKind!=='assignment.backfill')fail(404,'backfill_result_missing');return receipt;}
/** One transaction: exact preview destinations, receipt, ownership history and cursor. */
export async function confirmBackfill(c:any,originalActor:any,token:string){
 await lockIdentityRegistry(c);
 const snapshot=verify(token);if(snapshot.actor!==originalActor.id)fail(403,'backfill_forbidden');
 // Lock customer rows before policy/cursor, matching normal registration's lock order.
 const ids=snapshot.rows.map((r:any)=>r.id).sort();const locked=ids.length?(await c.query('SELECT id,profile FROM portal_leads WHERE id IN (:p1) ORDER BY id FOR UPDATE',[ids])).rows:[];
 const current=await policy(c,true),{actor,directory}=await actorDirectory(c,originalActor);
 const prior=(await c.query('SELECT fingerprint,result FROM crm_operations WHERE actor=:p1 AND request_id=:p2 FOR UPDATE',[actor.id,receiptKey(snapshot.id)])).rows[0];
 if(prior){if(prior.fingerprint!==hash(token))fail(409,'backfill_preview_invalid');return prior.result;}
 if(snapshot.expiresAt<Date.now())fail(409,'backfill_preview_expired');
 if(!policyEqual(current.autoAssignment,snapshot.configuration))fail(409,'backfill_settings_changed');
 const state=(await c.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor' FOR UPDATE")).rows[0]?.value||{};
 if(hash(state)!==snapshot.cursorHash)fail(409,'backfill_rotation_changed');
 const entries:any[]=[];let assigned=0,skipped=0,lastId=state.lastEmployeeId;
 for(const row of snapshot.rows){const lead=locked.find((l:any)=>l.id===row.id)?.profile;
  if(!await eligible(c,actor,lead)||(lead.ownerChangedAt||null)!==row.ownerChangedAt){skipped++;entries.push({id:row.id,status:'skipped'});continue;}
  const target=assignmentCandidates(directory,[row.ownerId],lead)[0];if(!target){skipped++;entries.push({id:row.id,status:'skipped'});continue;}
  await writeAssignment(c,lead,target,'backfill',actor.id,snapshot.id+':'+lead.id);assigned++;entries.push({id:row.id,status:'assigned',ownerId:target.id});lastId=target.id;
 }
 if(assigned)await c.query("INSERT INTO portal_settings(id,value) VALUES('crm_assignment_cursor',:p1) ON DUPLICATE KEY UPDATE value=:p1",[{...state,lastEmployeeId:lastId}]);
 const result={operationKind:'assignment.backfill',id:snapshot.id,assigned,skipped,total:snapshot.rows.length,entries,completedAt:new Date().toISOString()};
 await c.query('INSERT INTO crm_operations(actor,request_id,fingerprint,result) VALUES(:p1,:p2,:p3,:p4)',[actor.id,receiptKey(snapshot.id),hash(token),result]);
 await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[actor.id,'lead.backfill_completed',result]);return result;
}
