import {identityProjectionRows} from './identityConsolidation.ts';
import { projectBuyingEvidence } from "../../src/utils/crmBuyingEvidence.ts";
/** Only authorized profiles are passed in; message joins are restricted to each fact's lead. */
export async function attachBuyingEvidence(db: any, profiles: any[]) {
  if (!profiles.length) return;
  const ids = JSON.stringify(profiles.map((p) => p.id));
  const rows = (await identityProjectionRows(db,profiles,"SELECT f.*,EXISTS(SELECT 1 FROM crm_facts x WHERE x.lead_id=f.lead_id AND x.kind='fact.corrected' AND JSON_UNQUOTE(JSON_EXTRACT(x.data,'$.correctionOf'))=f.id) AS withdrawn,m.id AS message_id,m.content AS message_content,m.created_at AS message_at FROM crm_facts f LEFT JOIN conversations c ON c.lead_id=f.lead_id AND c.id=JSON_UNQUOTE(JSON_EXTRACT(f.data,'$.conversationId')) LEFT JOIN messages m ON m.conversation_id=c.id AND m.role='user' AND (m.request_id=JSON_UNQUOTE(JSON_EXTRACT(f.data,'$.messageId')) OR m.id=JSON_UNQUOTE(JSON_EXTRACT(f.data,'$.messageId'))) WHERE JSON_CONTAINS(:p1,JSON_QUOTE(f.lead_id)) AND f.kind IN ('questionnaire.submitted','followup.recorded','task.request_evidence','information.extracted') ORDER BY f.created_at DESC,f.id"));
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const group = grouped.get(row.lead_id) || [];
    group.push(row);
    grouped.set(row.lead_id, group);
  }
  for (const profile of profiles)
    profile.buyingEvidence = projectBuyingEvidence(
      grouped.get(profile.id) || [],
      profile,
    );
}
