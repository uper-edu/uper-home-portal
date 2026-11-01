import {randomUUID} from 'node:crypto';
import {eligibleOwner,permittedRecord,projectEmployee} from '../../src/utils/accessControl.ts';
import {policyEqual} from '../../src/utils/crmPolicyTopics.ts';
import {fact} from './trustWorkflow.ts';
const invalid=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
export async function assignmentDirectory(c:any){
 const users=(await c.query('SELECT * FROM crm_users ORDER BY id FOR SHARE')).rows;
 const roles=(await c.query('SELECT * FROM access_roles ORDER BY id FOR SHARE')).rows.map((r:any)=>({...r,enabled:!!r.enabled,revision:Number(r.revision)}));
 return users.map((u:any)=>projectEmployee(u,roles));
}
export function assignmentCandidates(directory:any[],salesIds:string[],lead:any){
 return salesIds.map(id=>directory.find(e=>e.id===id)).filter(e=>e&&eligibleOwner(e)&&permittedRecord(e,{...lead,owner:e.id},'crm.read')&&permittedRecord(e,{...lead,owner:e.id},'crm.followup'));
}
export function roundRobinNext(ids:string[],lastId?:string){return ids.length?ids[(ids.indexOf(lastId||'')+1)%ids.length]:null;}
/** Runs inside the policy-save transaction; never assigns existing customers on activation. */
export async function prepareAssignmentPolicy(c:any,before:any,after:any,actor:any){
 if(policyEqual(before.autoAssignment,after.autoAssignment))return;
 const fresh=(await assignmentDirectory(c)).find((e:any)=>e.id===actor?.id);
 actor=fresh;
 if(!actor?.active||!actor.permissions?.includes('crm.operations.manage')||!actor.permissions?.includes('crm.assign')||!permittedRecord(actor,{owner:null,team:'sales'},'crm.assign')||!permittedRecord(actor,{owner:null,team:'sales'},'crm.read'))invalid(403,'Automatic assignment requires customer assignment access');
 const a=after.autoAssignment;
 if(a.strategy!=='round_robin')invalid(400,'Assignment strategy unavailable');
 if(a.enabled){const directory=await assignmentDirectory(c);if(a.salesIds.some((id:string)=>!assignmentCandidates(directory,[id],{team:'sales'}).length))invalid(400,'Selected salesperson is unavailable; review the participant list');}
 if(a.enabled&&!before.autoAssignment?.enabled){
  const prior=(await c.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor' FOR UPDATE")).rows[0]?.value||{};
  await c.query("INSERT INTO portal_settings(id,value) VALUES('crm_assignment_cursor',:p1) ON DUPLICATE KEY UPDATE value=:p1",[{...prior,activatedAt:new Date().toISOString()}]);
 }
}
/** Call only for a new registration or newly released identity, in its original transaction. */
export async function assignNewLead(c:any,leadId:string,trigger:'registration'|'identity_release'){
 const lead=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[leadId])).rows[0]?.profile;
 if(!lead||lead.owner||lead.identityLifecycle==='pending'||lead.identityMergedInto)return lead;
 const policy=(await c.query("SELECT value FROM portal_settings WHERE id='crm_policy' FOR SHARE")).rows[0]?.value;
 const a=policy?.autoAssignment;if(!a?.enabled||a.strategy!=='round_robin')return lead;
 const state=(await c.query("SELECT value FROM portal_settings WHERE id='crm_assignment_cursor' FOR UPDATE")).rows[0]?.value;
 if(!state?.activatedAt)return lead;
 const entered=Date.parse(trigger==='identity_release'?lead.identityReleasedAt:lead.submittedAt);
 if(!Number.isFinite(entered)||entered<Date.parse(state.activatedAt))return lead;
 const {pendingIdentity}=await import('./identityReview.ts');if((await pendingIdentity(c,leadId)).length)return lead;
 const candidates=assignmentCandidates(await assignmentDirectory(c),a.salesIds,lead);
 const nextId=roundRobinNext(candidates.map((e:any)=>e.id),state.lastEmployeeId);
 if(!nextId){await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',['system','lead.auto_assignment_skipped',{id:leadId,reason:'no_eligible_sales',strategy:'round_robin'}]);return lead;}
 const target=candidates.find((e:any)=>e.id===nextId);
 const next=await writeAssignment(c,lead,target,trigger);
 await c.query("UPDATE portal_settings SET value=:p1 WHERE id='crm_assignment_cursor'",[{...state,lastEmployeeId:nextId}]);
 return next;
}

export async function writeAssignment(c:any,lead:any,target:any,trigger:string,actor='system',requestId:string=randomUUID()){
 const leadId=lead.id,nextId=target.id,changedAt=new Date().toISOString();
 const next={...lead,owner:nextId,ownerChangedAt:changedAt};
 await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,next]);
 await c.query("UPDATE followup_tasks SET owner_id=:p2 WHERE lead_id=:p1 AND status IN ('open','overdue','migration_hold')",[leadId,nextId]);
 await fact(c,leadId,'owner.changed',actor,{before:null,after:nextId,beforeName:'未分配',afterName:target.displayName||nextId,reason:trigger==='backfill'?'历史补分：轮询':'自动分案：轮询',strategy:'round_robin',trigger,changedAt,requestId});
 await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[actor,trigger==='backfill'?'lead.backfill_assigned':'lead.auto_assigned',{id:leadId,before:null,after:nextId,strategy:'round_robin',trigger,changedAt}]);
 return next;
}
