import type {CrmLanguage} from './crmLanguage';

const paymentWorkspaceLabels={
  enrollment:['报名订单核款','Enrollment order verification','Verifikasi pembayaran pesanan pendaftaran'],
  historical:['历史客户款项','Historical customer payments','Riwayat pembayaran pelanggan'],
} as const;

export function paymentWorkspaceLabel(view:keyof typeof paymentWorkspaceLabels,lang:CrmLanguage){
  return paymentWorkspaceLabels[view][lang==='zh'?0:lang==='id'?2:1];
}

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
