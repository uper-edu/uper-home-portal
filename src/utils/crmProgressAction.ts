import {permittedRecord} from './accessControl';
import {canClaimForContact} from './crmOutreach';
export type ProgressActionState='enabled'|'claim'|'hidden';
/** Presentation only. Never grants access or overrides server contact policy. */
export function progressActionState(employee:any,lead:any):ProgressActionState{
 if(lead?.identityReview?.pending)return 'hidden';
 if(!employee||employee.active===false||!employee.permissions?.includes('crm.followup'))return 'hidden';
 if(permittedRecord(employee,lead,'crm.followup'))return 'enabled';
 return canClaimForContact(employee,lead)?'claim':'hidden';
}
