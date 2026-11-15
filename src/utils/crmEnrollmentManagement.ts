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
  id:string; level:string; format:'standard'|'small'; schedule:string;
  firstLessonAt:string; capacity:number; minimumPaid:number;
  status:'recruiting'|'opened'|'cancelled'|'closed'; accepting:boolean;
  counts:Record<EnrollmentRosterState,number>; occupied:number; available:number;
};
export type EnrollmentRosterEntry={
  id:string; status:EnrollmentRosterState; actualStatus:string; name:string;
  customerId:string|null; opportunityId:string|null; owner:string|null; email?:string; phone?:string;
  dueAt:string|null; price?:number; received?:number; canVerify:boolean;
};
export const enrollmentClassManagementPath=(id:string)=>'/crm?tab=enrollment-management&classId='+encodeURIComponent(id);
