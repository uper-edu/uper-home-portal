import crypto from 'node:crypto';
import {allowed,type Employee} from './identity.ts';
import type {Rule} from './policy.ts';
export function recipients(rule:Rule,lead:any,employees:Employee[],leadId?:string){
 return employees.filter(e=>e.permissions.includes('crm.read') && !(rule.event==='daily.digest' && e.scope==='own') && (!leadId || allowed(e,lead)) && (rule.recipient==='owner'&&lead.owner?e.id===lead.owner:e.teams.includes(rule.recipient==='supervisor'?'supervisors':rule.team))).map(e=>e.id);
}
export function priority(event:string,payload:any,lead:any){return payload.priority || (['handoff.requested','booking.requested','enrollment.requested','task.overdue','ai.failed','notification.failed'].includes(event)||lead.tier==='Hot'?'urgent':'normal');}
export function retryAfter(value:string|null,now:Date){if(!value)return 0;const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds;const time=Date.parse(value);return Number.isFinite(time)?Math.max(0,(time-now.getTime())/1000):0;}
export function validWebhook(value:string|undefined){try{const u=new URL(value || '');return u.protocol==='https:'&&u.hostname==='open.larksuite.com'&&!u.username&&!u.password&&!u.port&&/^\/open-apis\/bot\/v2\/hook\/[a-zA-Z0-9_-]+$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}}
export function larkCard(text:string,leadId:string|undefined,secret:string|undefined,now:Date){
 const url=new URL('/crm',process.env.APP_URL || 'http://localhost:3000');if(leadId)url.searchParams.set('lead',leadId);
 const body:any={msg_type:'interactive',card:{config:{wide_screen_mode:true},header:{template:'blue',title:{tag:'plain_text',content:'UPER · '+(process.env.PLATFORM_MODE==='mock'?'TEST':process.env.NODE_ENV || 'DEV')}},elements:[{tag:'div',text:{tag:'lark_md',content:text}},{tag:'action',actions:[{tag:'button',text:{tag:'plain_text',content:'CRM'},url:url.toString(),type:'primary'}]}]}};
 if(secret){body.timestamp=String(Math.floor(now.getTime()/1000));body.sign=crypto.createHmac('sha256',body.timestamp+'\n'+secret).update('').digest('base64');}
 return body;
}
