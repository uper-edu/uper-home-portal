/** A receipt's registration role never changes when its Lead is later consolidated. */
export function isFollowupInquiry(row:any):boolean {
 const marker=row.metadata?.customerActivity;
 if(marker==='initial_registration')return false;
 if(marker==='followup_inquiry')return true;
 // Historical receipts need explicit prior registration/submission evidence, not timestamp drift.
 return Number(row.prior_inquiry)>0||Number(row.prior_questionnaire)>0;
}
