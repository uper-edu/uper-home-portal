import {ownerManagerOnly} from '../../src/utils/crmAccessPolicy.ts';
import {isCrmManager} from '../../src/utils/crmOutreach.ts';
export async function loadCrmAccessControls(c:any){
 const config=(await c.query("SELECT value FROM portal_settings WHERE id='crm_policy' FOR SHARE")).rows[0]?.value;
 return {identityReviewManagerOnly:config?.identityReviewManagerOnly!==false,ownerAssignmentManagerOnly:ownerManagerOnly(config),sourceAttributionManagerOnly:config?.sourceAttributionManagerOnly!==false};
}
export async function canReviewSourceAttribution(c:any,employee:any){
 const controls=await loadCrmAccessControls(c);
 return Boolean(employee?.active!==false&&employee?.permissions?.includes('campaigns.manage')&&(!controls.sourceAttributionManagerOnly||isCrmManager(employee)));
}
export async function assertSourceAttributionReviewer(c:any,employee:any){
 if(!await canReviewSourceAttribution(c,employee))throw Object.assign(Error('Only an authorized CRM Manager can review source attribution under the current policy.'),{status:403});
}
