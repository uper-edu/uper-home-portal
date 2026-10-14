import crypto from 'node:crypto';
import {allowed,type Employee} from './identity.ts';
import type {Rule} from './policy.ts';
export const CRM_LEADER_ROLE='crm_leader';
export function resolveRecipients(rule:Rule,lead:any,employees:Employee[],leadId?:string){
 if(rule.event==='notification.failed')return {ids:employees.filter(e=>e.active && e.roles?.includes(CRM_LEADER_ROLE)&&e.permissions.includes('notifications.manage')).map(e=>e.id),reason:'operations_to_crm_leaders'};
 const profile={...lead,team:lead?.team || 'sales'};
 const visible=employees.filter(e=>e.active===true && e.permissions.includes('crm.read') && !(rule.event==='daily.digest' && e.scope==='own') && (!leadId || allowed(e,profile)));
 if(rule.recipient==='owner' && leadId){
  const owner=visible.find(e=>e.id===profile.owner);
  if(owner)return {ids:[owner.id],reason:'valid_owner'};
  const leaders=visible.filter(e=>e.roles?.includes(CRM_LEADER_ROLE) && e.permissions.includes('crm.assign') && e.teams.includes(profile.team));
  return {ids:leaders.map(e=>e.id),reason:leaders.length?(profile.owner?'invalid_owner_to_crm_leader':'unassigned_to_crm_leader'):'no_authorized_crm_leader'};
 }
 return {ids:visible.filter(e=>e.teams.includes(rule.recipient==='supervisor'?'supervisors':rule.team)).map(e=>e.id),reason:'explicit_team_or_summary'};
}
export function recipients(rule:Rule,lead:any,employees:Employee[],leadId?:string){return resolveRecipients(rule,lead,employees,leadId).ids;}
export function priority(event:string,payload:any,lead:any){return payload.priority || (['handoff.requested','booking.requested','enrollment.requested','task.overdue','ai.failed','notification.failed'].includes(event)||lead.tier==='Hot'?'urgent':'normal');}
export function retryAfter(value:string|null,now:Date){if(!value)return 0;const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds;const time=Date.parse(value);return Number.isFinite(time)?Math.max(0,(time-now.getTime())/1000):0;}
export function validWebhook(value:string|undefined){try{const u=new URL(value || '');return u.protocol==='https:'&&u.hostname==='open.larksuite.com'&&!u.username&&!u.password&&!u.port&&/^\/open-apis\/bot\/v2\/hook\/[a-zA-Z0-9_-]+$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}}
export function larkCard(text:string,leadId:string|undefined,secret:string|undefined,now:Date){
 const url=new URL('/crm',process.env.APP_URL || 'http://localhost:3000');if(leadId)url.searchParams.set('lead',leadId);
 const body:any={msg_type:'interactive',card:{config:{wide_screen_mode:true},header:{template:'blue',title:{tag:'plain_text',content:'UPER · '+((process.env.PLATFORM_MODE==='mock'||process.env.APP_ENV==='test')?'TEST':process.env.NODE_ENV || 'DEV')}},elements:[{tag:'div',text:{tag:'lark_md',content:text}},{tag:'action',actions:[{tag:'button',text:{tag:'plain_text',content:'CRM'},url:url.toString(),type:'primary'}]}]}};
 if(secret){body.timestamp=String(Math.floor(now.getTime()/1000));body.sign=crypto.createHmac('sha256',body.timestamp+'\n'+secret).update('').digest('base64');}
 return body;
}

export function channelConnection(id:string,config:any){
 const webhookConfigured=validWebhook(process.env[config.secretRef]);
 const signingSecretConfigured=!(config.signingEnabled ?? !!config.signingSecretRef) || !!process.env[config.signingSecretRef];
 const testMode=process.env.PLATFORM_MODE==='mock'||process.env.APP_ENV==='test'||process.env.NODE_ENV!=='production';
 const designatedTestGroup=process.env.LARK_TEST_GROUP===id;
 const status=config.mode!=='live'?'simulation':!webhookConfigured?'missing_webhook':!signingSecretConfigured?'missing_signing_secret':testMode&&!designatedTestGroup?'test_group_blocked':'configured';
 return {status,webhookConfigured,signingSecretConfigured,designatedTestGroup,realReceiptVerified:false};
}

// Legacy policies may disagree. Until the channel is explicitly configured,
// use the strictest historical policy/snapshot limit for this group.
export async function groupRateLimit(db:{query:Function},group:string,config:any){
 if(Number.isInteger(config?.maxPerHour) && config.maxPerHour>=0 && config.maxPerHour<=10080)return {maxPerHour:config.maxPerHour,source:'channel'};
 const rows=(await db.query("SELECT config->'maxPerHour' AS value FROM notification_rules WHERE config->>'group'=$1 AND config->'channels' ? 'lark' UNION ALL SELECT snapshot->'rule'->'maxPerHour' AS value FROM notification_jobs WHERE channel='lark' AND recipient=$1",[group])).rows;
 const limits=rows.map((r:any)=>r.value).filter((v:any)=>Number.isInteger(v)&&v>=0&&v<=10080);
 return {maxPerHour:limits.length?Math.min(...limits):20,source:limits.length?'legacy_strictest':'default'};
}
