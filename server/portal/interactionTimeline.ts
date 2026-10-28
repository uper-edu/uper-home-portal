import {isFollowupInquiry} from '../../src/utils/crmInquiryActivity.ts';
import {identityProjectionRows} from './identityConsolidation.ts';
import {projectInteractionTimeline,interactionInstant,type InteractionEvent} from '../../src/utils/crmInteractionTimeline.ts';
/** Only already-authorized Lead IDs are joined. Recorded customer messages, never assistant/system output. */
export async function attachInteractionTimelines(db:any,leads:any[]){
 if(!leads.length)return;
 const rows=(await identityProjectionRows(db,leads,"SELECT e.*,m.id AS message_id,m.content AS original_text,m.created_at AS message_at,a.result AS assessment_result,a.created_at AS assessment_at FROM crm_engagements e LEFT JOIN conversations c ON c.lead_id=e.lead_id AND c.id=JSON_UNQUOTE(JSON_EXTRACT(e.data,'$.conversationId')) LEFT JOIN messages m ON m.conversation_id=c.id AND m.role='user' AND (m.id=JSON_UNQUOTE(JSON_EXTRACT(e.data,'$.messageId')) OR m.request_id=JSON_UNQUOTE(JSON_EXTRACT(e.data,'$.messageId')) OR m.request_id=JSON_UNQUOTE(JSON_EXTRACT(e.data,'$.requestId'))) LEFT JOIN hsk_attempts a ON a.lead_id=e.lead_id AND a.id=JSON_UNQUOTE(JSON_EXTRACT(e.data,'$.attemptId')) WHERE JSON_CONTAINS(:p1,JSON_QUOTE(e.lead_id)) AND e.kind IN ('message','task_request','assessment')"));
 const inquiries=await identityProjectionRows(db,leads,"SELECT c.lead_id,m.id AS message_id,m.content AS original_text,m.created_at AS message_at,m.metadata,c.id AS conversation_id,EXISTS(SELECT 1 FROM site_submissions prev WHERE prev.lead_id=s.lead_id AND prev.kind='inquiry' AND prev.created_at<s.created_at) AS prior_inquiry,EXISTS(SELECT 1 FROM crm_facts f WHERE f.lead_id=s.lead_id AND f.kind='questionnaire.submitted' AND f.created_at<=s.created_at) AS prior_questionnaire FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN site_submissions s ON s.id=JSON_UNQUOTE(JSON_EXTRACT(m.metadata,'$.submissionId')) AND s.lead_id=c.lead_id AND s.kind='inquiry' WHERE c.source='contact_form' AND m.role='user' AND m.status='saved' AND JSON_CONTAINS(:p1,JSON_QUOTE(c.lead_id))");
 const grouped=new Map<string,InteractionEvent[]>();
 for(const r of rows){let e:InteractionEvent|undefined;
 if(r.kind==='assessment'&&r.assessment_result)e={id:r.id,at:interactionInstant(r.assessment_at),timeBasis:'received',channel:'Assessment',source:'assessment',text:r.assessment_result.summary||'',assessment:r.assessment_result};
 else if(r.message_id&&typeof r.original_text==='string'&&r.original_text.trim())e={id:r.id,at:interactionInstant(r.message_at),timeBasis:'received',channel:'AI chat',source:r.kind==='task_request'?'request':'chat',text:r.original_text,conversationId:r.data.conversationId,messageId:r.message_id};
 if(e?.at){const list=grouped.get(r.lead_id)||[];list.push(e);grouped.set(r.lead_id,list);}}
 for(const r of inquiries){
  const at=interactionInstant(r.message_at);
  if(!at||!isFollowupInquiry(r)||typeof r.original_text!=='string'||!r.original_text.trim())continue;
  const list=grouped.get(r.lead_id)||[];
  // Same message can already be referenced by an engagement; count it only once.
  const unique=list.filter(e=>e.messageId!==r.message_id);
  unique.push({id:'inquiry:'+r.message_id,at,timeBasis:'received',channel:'contact_form',source:'inquiry',text:r.original_text,conversationId:r.conversation_id,messageId:r.message_id});
  grouped.set(r.lead_id,unique);
 }
 for(const lead of leads)lead.interactionTimeline=projectInteractionTimeline(lead,grouped.get(lead.id)||[]);
}
