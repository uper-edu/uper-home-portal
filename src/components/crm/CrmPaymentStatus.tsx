import {paymentStateTone} from '../../utils/crmPaymentPresentation';
export function paymentDetailStateLabel(state:string,lang:string){
 const labels:Record<string,readonly[string,string,string]>={terminated:['已终止','Terminated','Dihentikan'],settlement_pending:['待结算','Awaiting settlement','Menunggu penyelesaian'],settlement_collect:['待追收','To collect','Perlu ditagih'],settlement_refund:['待退款','To refund','Perlu dikembalikan'],settlement_settled:['已结清','Settled','Lunas'],pending:['待核验','Pending verification','Menunggu verifikasi'],verified:['已核实','Verified','Terverifikasi'],rejected:['已退回','Returned','Dikembalikan'],void:['已作废','Voided','Dibatalkan'],unpriced:['应收未确定','Receivable not agreed','Tagihan belum ditetapkan'],unpaid:['未收款','Unpaid','Belum dibayar'],partial:['部分收款','Partially paid','Dibayar sebagian'],paid:['已收齐','Paid in full','Lunas'],nocharge:['无需收款','No payment due','Tidak ada tagihan']};
 return labels[state]?.[lang==='zh'?0:lang==='id'?2:1]||state;
}
export function CrmPaymentStatus({state,lang}:{state:string;lang:string}){
 return <span className="crm-payment-status" data-tone={paymentStateTone(state)}>{paymentDetailStateLabel(state,lang)}</span>;
}
