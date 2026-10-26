import {projectInteractionTimeline,interactionInstant} from './crmInteractionTimeline';
import {contactPaused} from './crmContact';
import {DEFAULT_CRM_POLICY_CONFIG,durationToMs} from '../types/crmPolicyConfig';
/** One read-only rule for list filters, server projection and the sales summary. */
export function inactivityThresholdMs(tier:string,policy:any=DEFAULT_CRM_POLICY_CONFIG){
 const key=tier==='Hot'?'hotInactivity':tier==='Cold-Nurture'?'coldInactivity':'warmInactivity';
 return durationToMs(policy?.inactivityWatchdog?.[key]);
}
export function contactOverview(lead:any,policy?:any,now=Date.now()){
 const timeline=lead.interactionTimeline||projectInteractionTimeline(lead);
 const sales=timeline.sales,communication=timeline.communication,customer=timeline.customer;
 const salesAt=interactionInstant(sales?.at),communicationAt=interactionInstant(communication?.at),customerAt=interactionInstant(customer?.at);
 const thresholdMs=policy?inactivityThresholdMs(lead.tier,policy):(lead.contactOverview?.thresholdMs??inactivityThresholdMs(lead.tier));
 const elapsedMs=salesAt?Math.max(0,now-Date.parse(salesAt)):null;
 const eligible=!['Enrolled','Lost'].includes(lead.currentStage)&&!contactPaused(lead,now);
 const replyAfterContact=Boolean(salesAt&&communicationAt&&Date.parse(communicationAt)>Date.parse(salesAt));
 const unanswered=Boolean(sales?.result==='No Response'&&(!salesAt||!communicationAt||Date.parse(communicationAt)<Date.parse(salesAt)));
 return {hasSales:Boolean(sales),thresholdMs,elapsedMs,salesAt:salesAt||null,unanswered,hasCommunication:Boolean(communication),replyAfterContact,customerAfterContact:Boolean(salesAt&&customerAt&&Date.parse(customerAt)>Date.parse(salesAt)),stale:eligible&&elapsedMs!==null&&thresholdMs>0&&elapsedMs>=thresholdMs};
}
