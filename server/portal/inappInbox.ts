import {projectEmployee} from '../../src/utils/accessControl.ts';
import {allowed} from './identity.ts';
import {notificationDestination,type NotificationTargetKind} from '../../src/utils/crmNotificationTarget.ts';
import {resolveNotificationTarget} from './notificationTarget.ts';
const fail=(status:number,code:string):never=>{throw Object.assign(Error(code),{status})};
async function currentEmployee(c:any,id:string){const user=(await c.query('SELECT * FROM crm_users WHERE id=:p1 FOR SHARE',[id])).rows[0];const roles=(await c.query('SELECT * FROM access_roles ORDER BY id FOR SHARE')).rows.map((r:any)=>({...r,enabled:!!r.enabled,revision:Number(r.revision)}));const employee=user&&projectEmployee(user,roles);if(!employee?.active)fail(401,'inbox_login_required');if(!employee.permissions.includes('crm.read'))fail(403,'inbox_forbidden');return employee;}
const ref=(value:any)=>typeof value==='string'&&value.length>0&&value.length<=191&&!/[\u0000-\u001f]/.test(value)?value:undefined;
export function inboxTarget(snapshot:any):{kind:NotificationTargetKind;id:string}|undefined{
 const p=snapshot?.payload||{},event=snapshot?.event;
 const target=(kind:NotificationTargetKind,id:any)=>ref(id)?{kind,id}:undefined;
 if(event==='assessment.completed')return target('assessment',p.attemptId);
 if(['handoff.requested','booking.requested','enrollment.requested'].includes(event))return target('request',p.requestEvidenceId);
 if(event==='commitment.due')return target('agreement',p.commitmentId);
 if(p.factId)return target('fact',p.factId);
 if(event==='lead.created')return target('fact',p.questionnaireFactId)||target('submission',p.submissionId);
 if(event==='task.overdue')return target('task',p.taskId);
 if(p.messageId)return target('message',p.messageId);
 if(p.conversationId)return target('conversation',p.conversationId);
 if(p.taskId)return target('task',p.taskId);
}
async function visible(c:any,employee:any,id?:string){
 const rows=(await c.query("SELECT i.id,i.content,j.snapshot,j.completed_at,j.due_at FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id WHERE i.employee_id=:p1 AND j.channel='inapp' AND j.state='accepted'"+(id?' AND i.id=:p2':''),id?[employee.id,id]:[employee.id])).rows;
 const ids=[...new Set(rows.map((r:any)=>r.snapshot?.leadId).filter(ref))];const profiles=new Map<string,any>(ids.length?(await c.query('SELECT id,profile FROM portal_leads WHERE id IN (:p1)'+(id?' FOR SHARE':''),[ids])).rows.map((r:any)=>[r.id,r.profile]):[]);
 const result:any[]=[];
 for(const row of rows){let leadId=ref(row.snapshot?.leadId),profile=leadId?profiles.get(leadId):undefined;
  if(leadId){if(!profile)continue;if(profile.identityMergedInto){const root=(await c.query('SELECT id,profile FROM portal_leads WHERE id=:p1'+(id?' FOR SHARE':''),[profile.identityMergedInto])).rows[0];if(!root||root.profile.identityMergedInto)continue;leadId=root.id;profile=root.profile;}if(!allowed(employee,profile))continue;}
  else if(!employee.permissions.includes('crm.leader')||!employee.permissions.some((p:string)=>['notifications.read','notifications.manage'].includes(p)))continue;
  const when=row.completed_at||row.due_at;const date=new Date(when);if(!Number.isFinite(date.getTime()))continue;
  result.push({...row,leadId,profile,deliveredAt:date.toISOString(),read:typeof row.content?.inboxReadAt==='string'});
 }
 return result.sort((a,b)=>b.deliveredAt.localeCompare(a.deliveredAt)||b.id.localeCompare(a.id));
}
async function destination(c:any,row:any){
 const event=row.snapshot?.event,p=row.snapshot?.payload||{};
 if(!row.leadId){const url=new URL('/crm','http://localhost');if(event==='daily.digest'){url.searchParams.set('tab','leads');url.searchParams.set('digestJob',row.id)}else if(event==='notification.failed'&&ref(p.jobId)){url.searchParams.set('tab','policy');url.searchParams.set('policyTopic','notification-jobs');url.searchParams.set('job',p.jobId)}else return null;return url.pathname+url.search;}
 const target=inboxTarget(row.snapshot);if(!target)return null;
 const resolved=await resolveNotificationTarget(c,row.leadId,target.kind,target.id);if(!resolved)return null;
 const url=notificationDestination('http://localhost',row.leadId,target);url.searchParams.set('leadView',resolved.tab);return url.pathname+url.search;
}
export async function listInbox(c:any,actor:any,cursor?:string,summary=false){
 const employee=await currentEmployee(c,actor.id),rows=await visible(c,employee),unreadCount=rows.filter(r=>!r.read).length;
 if(summary)return {unreadCount};
 let after:any;if(cursor){try{after=JSON.parse(Buffer.from(cursor,'base64url').toString());if(typeof after.at!=='string'||typeof after.id!=='string'||cursor.length>1000)throw Error()}catch{fail(400,'inbox_cursor_invalid')}}
 const filtered=after?rows.filter(r=>r.deliveredAt<after.at||r.deliveredAt===after.at&&r.id<after.id):rows;const page=filtered.slice(0,50),items=[];
 for(const r of page){const url=await destination(c,r);items.push({id:r.id,event:r.snapshot.event,name:r.profile?.fullName||r.profile?.name||'',detail:typeof r.content?.action==='string'?Array.from(r.content.action).slice(0,160).join(''):'',deliveredAt:r.deliveredAt,read:r.read,canOpen:!!url,...(url?{url}:{})});}
 const last=page.at(-1);return {items,unreadCount,nextCursor:filtered.length>page.length&&last?Buffer.from(JSON.stringify({at:last.deliveredAt,id:last.id})).toString('base64url'):null};
}
export async function readInbox(c:any,actor:any,id:string,open=false){
 if(!ref(id))fail(400,'inbox_record_invalid');const employee=await currentEmployee(c,actor.id);const row=(await visible(c,employee,id))[0];if(!row)fail(404,'inbox_record_unavailable');
 const url=open?await destination(c,row):null;if(open&&!url)fail(404,'inbox_target_unavailable');
 await c.query("UPDATE notification_inbox SET content=JSON_SET(content,'$.inboxReadAt',:p3) WHERE id=:p1 AND employee_id=:p2 AND (JSON_EXTRACT(content,'$.inboxReadAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(content,'$.inboxReadAt'))='NULL')",[id,employee.id,new Date().toISOString()]);
 return {read:true,...(url?{url}:{})};
}
