import type {PaymentEntry} from './crmPayments';

export function paymentStateTone(state:string){
 return state==='paid'||state==='verified'||state==='settlement_settled'?'success':state==='partial'?'info':['pending','unpriced','settlement_pending','settlement_collect','settlement_refund'].includes(state)?'warning':'neutral';
}
export function paymentRemainingTone(summary:{state:string;remaining:number|null;overpaid:number}){
 return summary.overpaid>0?'warning':summary.state==='paid'?'success':summary.remaining!==null&&summary.remaining>0?'info':'neutral';
}
/** Voiding excludes a fact from totals; it never reverts its previously verified amount/time. */
export function paymentEntryFact(entry:PaymentEntry){
 const verified=(entry.state==='verified'||entry.state==='void')&&entry.verifiedAmount!==undefined;
 return {amount:verified?entry.verifiedAmount!:entry.amount,at:verified?entry.receivedAt:entry.reportedAt,verified};
}
