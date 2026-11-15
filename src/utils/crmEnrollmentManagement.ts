import type { EnrollmentClosureReason } from './enrollmentOrderStatus';
import { permittedRecord, type AccessEmployee } from './accessControl';

export const enrollmentManagementScopes = (actor:AccessEmployee) => ({
  followup: actor.active!==false && actor.permissions.includes('crm.read') && actor.permissions.includes('crm.followup'),
  operations: permittedRecord(actor,{},'crm.read') && permittedRecord(actor,{},'crm.operations.manage'),
  finance: permittedRecord(actor,{},'crm.read') && permittedRecord(actor,{},'crm.payments.verify'),
});

export const canViewEnrollmentManagement = (actor:AccessEmployee) =>
  Object.values(enrollmentManagementScopes(actor)).some(Boolean);

export const enrollmentRosterStates=['awaiting_payment','proof_review','partial','paid','held','waiting','history'] as const;
export type EnrollmentRosterState=typeof enrollmentRosterStates[number];
export type EnrollmentClassSummary={
  id:string; level:string; format:'standard'|'small'; period:'weekday-evening'|'weekend'; schedule:string;
  firstLessonAt:string; capacity:number; minimumPaid:number;
  status:'recruiting'|'opened'|'cancelled'|'closed'; accepting:boolean;
  counts:Record<EnrollmentRosterState,number>; occupied:number; available:number;
};
export type EnrollmentRosterEntry={
  id:string; status:EnrollmentRosterState; actualStatus:string; name:string;
  customerId:string|null; opportunityId:string|null; owner:string|null; email?:string; phone?:string;
  closureReason?:EnrollmentClosureReason; dueAt:string|null; price?:number; received?:number; canVerify:boolean;
};
export const enrollmentClassManagementPath=(id:string)=>'/crm?tab=enrollment-management&classId='+encodeURIComponent(id);

export function enrollmentRosterReturnPath(value:string|null,orderId:string|null){
  if(!value?.startsWith('/crm?')||value.length>1000||!orderId)return;
  try{
    const url=new URL(value,'http://localhost:3000');
    const filters=url.searchParams,classId=filters.get('classId');
    if(url.origin!=='http://localhost:3000'||url.pathname!=='/crm'||filters.get('tab')!=='enrollment-management'||
        !classId||!/^[a-z0-9-]{1,64}$/i.test(classId)||filters.get('rosterOrder')!==orderId)return;
    const safe=new URLSearchParams({tab:'enrollment-management',classId,rosterOrder:orderId});
    for(const key of ['classSearch','classLevel','classFormat','classPeriod','classStatus','classSeats','classDate','classSort','classPage']){
      const value=filters.get(key);
      if(value&&value.length<=120)safe.set(key,value);
    }
    const state=enrollmentRosterStates.find(state=>state===filters.get('rosterStatus'));
    if(state)safe.set('rosterStatus',state);
    const closure=filters.get('rosterClosure');
    if(state==='history'&&closure&&['learner_cancelled','payment_timeout','staff_ended'].includes(closure))safe.set('rosterClosure',closure);
    return '/crm?'+safe;
  }catch{return;}
}
