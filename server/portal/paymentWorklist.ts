import {assignmentDirectory} from './autoAssignment.ts';
import {canVerifyPayments,paymentListFilters,paymentWorklist} from '../../src/utils/crmPaymentWorklist.ts';
import {invalid} from './trustWorkflow.ts';
export async function listPaymentVerification(c:any,actorId:string,query:any){
 const directory=await assignmentDirectory(c),actor=directory.find((e:any)=>e.id===actorId);
 if(!actor||!canVerifyPayments(actor))invalid('payment_forbidden',403);
 const filters=paymentListFilters(query);
 const profiles=(await c.query('SELECT profile FROM portal_leads')).rows.map((r:any)=>r.profile);
 const ledgers=(await c.query('SELECT lead_id,value FROM crm_payment_ledgers ORDER BY lead_id')).rows;
 return paymentWorklist(actor,profiles,ledgers,directory,filters);
}
