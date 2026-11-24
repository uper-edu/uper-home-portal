/** A cleared payment can still need transfer or refund when its class was cancelled. */
export function enrollmentOrderStatus(paymentState: string, classState: string): string {
  if (classState === 'cancelled' && (paymentState === 'paid' || paymentState === 'recovered')) {
    return 'paid_cancelled';
  }
  return paymentState;
}

export function enrollmentLearnerNameKey(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export type EnrollmentClosureReason='learner_cancelled'|'payment_timeout'|'staff_ended';

export function enrollmentClosureReason(state:string,stored?:unknown):EnrollmentClosureReason|undefined {
  if(state==='expired')return 'payment_timeout';
  if(state==='ended')return stored==='learner_cancelled'?'learner_cancelled':'staff_ended';
}

export function allowsEnrollmentProof(state:string,stored?:unknown) {
  return !['paid','recovered','refunding','refunded'].includes(state) &&
    (state!=='ended'||enrollmentClosureReason(state,stored)==='learner_cancelled');
}

export const enrollmentStatuses: Record<string, readonly [string, string, string]> = {
  awaiting_payment: ['待付款', 'Awaiting payment', 'Menunggu pembayaran'],
  proof_review: ['凭证待财务核实', 'Proof awaiting verification', 'Bukti menunggu verifikasi'],
  partial: ['部分到账', 'Partially paid', 'Pembayaran sebagian'],
  paid: ['报名成功', 'Enrollment confirmed', 'Pendaftaran berhasil'],
  paid_cancelled: ['已到账 · 原班不开班', 'Paid · Original class cancelled', 'Sudah dibayar · Kelas asal dibatalkan'],
  expired: ['订单已终止 · 付款超时', 'Order expired · Payment deadline passed', 'Pesanan kedaluwarsa · Tenggat pembayaran terlewati'],
  ended: ['报名已结束', 'Enrollment ended', 'Pendaftaran telah berakhir'],
  refunding: ['退款处理中','Refund in progress','Pengembalian diproses'],
  refunded: ['退款已完成','Refund complete','Pengembalian selesai'],
};

export type EnrollmentStatusTone = 'pending'|'progress'|'confirmed'|'full'|'error';

export function enrollmentOrderTone(status:string,{restored=false,classCancelled=false,needsAction=false}:{
  restored?:boolean;classCancelled?:boolean;needsAction?:boolean;
}={}):EnrollmentStatusTone {
  if(restored)return 'confirmed';
  if(['expired','ended','refunded'].includes(status))return 'full';
  if(needsAction||status==='awaiting_payment'&&!classCancelled)return 'pending';
  if(status==='paid')return 'confirmed';
  return 'progress';
}
