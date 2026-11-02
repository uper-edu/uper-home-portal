import {canVerifyPayments} from './crmPaymentWorklist';
import type {AccessEmployee} from './accessControl';
/** Default only: explicit records, filters and module links are never overridden. */
export function defaultCrmModule(employee:AccessEmployee):'payments'|'leads'{
 const hasOtherCrmWork=employee.permissions.some(p=>p.startsWith('crm.')&&!['crm.read','crm.payments.verify'].includes(p)||p==='notifications.read'||p==='notifications.manage');
 return canVerifyPayments(employee)&&!hasOtherCrmWork?'payments':'leads';
}
