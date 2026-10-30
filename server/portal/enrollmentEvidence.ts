import {identityProjectionRows} from './identityConsolidation.ts';
import {confirmedEnrollmentFacts} from '../../src/utils/crmEnrollment.ts';
/** Read-only, customer-scoped projection. Does not backfill profiles or infer facts from old stages. */
export async function attachEnrollmentEvidence(db:any,leads:any[]){
 if(!leads.length)return;
 const facts=(await identityProjectionRows(db,leads,"SELECT id,lead_id,kind,data,created_at FROM crm_facts WHERE kind IN ('stage.changed','enrollment.confirmation_voided') AND JSON_CONTAINS(:p1,JSON_QUOTE(lead_id))"));
 for(const lead of leads)lead.enrollmentEvidence={confirmations:confirmedEnrollmentFacts(facts.filter((f:any)=>f.lead_id===lead.id))};
}
