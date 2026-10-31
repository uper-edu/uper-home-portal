import {questionnaireOptions} from '../../src/utils/crmQuestionnaire.ts';
import {safeNotificationExcerpt} from '../../src/utils/larkNotificationContent.ts';
import {local, schedule, type Rule, type Channel} from './policy.ts';

/** New-event scheduling. Legacy jobs keep their original policy and snapshots. */
export function scheduleLarkV2(date:Date, rule:Rule):Date {
  let d=new Date(date.getTime()+(rule.timing==='delay'?rule.delayMinutes*60000:0));
  if(rule.timing==='digest'){
    for(let i=0;i<1440*3;i++){
      const t=local(d,rule).time;
      if(t===rule.digestTime && d.getUTCSeconds()===0 && d.getUTCMilliseconds()===0)break;
      d=new Date(Math.floor(d.getTime()/60000)*60000+60000);
    }
  }
  for(let i=0;i<1440*3;i++){
    const t=local(d,rule).time, q=rule.quiet;
    const quiet=q && (q.start<q.end?t>=q.start&&t<q.end:t>=q.start||t<q.end);
    if(!quiet)return d;
    d=new Date(Math.floor(d.getTime()/60000)*60000+60000);
  }
  throw Error('No permitted send time');
}

export {larkNotificationPreview} from '../../src/utils/larkNotificationPresentation.ts';

/** Query only the exact event source belonging to this customer. Never use latest profile facts. */
export async function larkEventSource(db:any,event:string,leadId:string,payload:any){
  if(event==='lead.created' && payload.questionnaireFactId){
    const row=(await db.query("SELECT id,data,created_at FROM crm_facts WHERE id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2)) AND kind='questionnaire.submitted'",[payload.questionnaireFactId,leadId])).rows[0];
    const answers=row?.data?.answers||{};
    const pick=(key:'reportedLevel'|'mode'|'city')=>(questionnaireOptions[key] as readonly string[]).includes(answers[key])?answers[key]:undefined;
    return row?{reportedLevel:pick('reportedLevel'),mode:pick('mode'),city:pick('city'),source:'questionnaire',recordedAt:row.created_at,goals:[...new Set([answers.goal,...(answers.goals||[])].filter((v:any)=>(questionnaireOptions.goal as readonly string[]).includes(v)))]}:null;
  }
  if(event==='lead.created' && payload.submissionId){
    const row=(await db.query("SELECT id,payload,created_at FROM site_submissions WHERE id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2)) AND kind='inquiry'",[payload.submissionId,leadId])).rows[0];
    const raw=row?.payload?.message;const excerpt=safeNotificationExcerpt(raw);
    return row?{source:'contact_form',recordedAt:row.created_at,excerpt,excerptRestricted:!!raw&&!excerpt}:null;
  }
  if(['handoff.requested','booking.requested','enrollment.requested'].includes(event) && payload.requestEvidenceId){
    const row=(await db.query("SELECT id,data,created_at FROM crm_engagements WHERE id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2)) AND kind='task_request'",[payload.requestEvidenceId,leadId])).rows[0];
    if(!row)return null;
    const expected=event==='handoff.requested'?'handoff':event==='booking.requested'?'booking':'enrollment';
    if(row.data.action&&row.data.action!==expected)return null;
    const sales=row.data.sourceType==='sales_record';
    const original=!sales&&row.data.conversationId&&row.data.messageId?(await db.query("SELECT m.content,m.created_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.conversation_id=:p1 AND (m.id=:p2 OR m.request_id=:p2) AND m.role='user' AND (c.lead_id=:p3 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p3)) ORDER BY m.created_at LIMIT 1",[row.data.conversationId,row.data.messageId,leadId])).rows[0]:null;
    const raw=sales?row.data.text:original?.content;
    const excerpt=safeNotificationExcerpt(raw);
    return {source:sales?'sales_record':'customer_message',occurredAt:row.data.occurredAt||null,recordedAt:row.created_at,excerpt,excerptRestricted:!!raw&&!excerpt};
  }
  if(['conversation.reactivated','ai.failed'].includes(event)&&payload.conversationId){
    const row=(await db.query("SELECT id,source FROM conversations WHERE id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2))",[payload.conversationId,leadId])).rows[0];
    if(!row)return null;
    if(event==='ai.failed'){
      if(!payload.messageId)return null;
      const failed=(await db.query("SELECT id,created_at FROM messages WHERE id=:p1 AND conversation_id=:p2 AND role='assistant' AND status='failed'",[payload.messageId,row.id])).rows[0];
      return failed?{source:row.source,recordedAt:failed.created_at,failure:'ai_unavailable' as const}:null;
    }
    return {source:row.source};
  }
  return null;
}

/** Only expose structured delivery metadata; never transmit raw errors, endpoints or payloads. */
export async function larkFailureSource(db:any,payload:any){
 if(!payload.jobId)return null;
 const row=(await db.query("SELECT state,channel,attempts,snapshot,completed_at FROM notification_jobs WHERE id=:p1",[payload.jobId])).rows[0];
 if(!row||!['failed','unknown'].includes(row.state))return null;
 return {failedEvent:row.snapshot?.event,failedChannel:row.channel,attempts:row.attempts,recordedAt:row.completed_at,failure:row.state==='unknown'?'delivery_unknown' as const:'delivery_failed' as const};
}

export function scheduleNotification(date:Date, rule:Rule, channel:Channel, payload:any){
  return channel==='lark' && payload?.notificationPolicyVersion===2 ? scheduleLarkV2(date,rule) : schedule(date,rule,channel);
}
export function digestChannelAllowed(channel:Channel,payload:any){
  return channel!=='inapp' || payload?.inappDigestAllowed!==false;
}
