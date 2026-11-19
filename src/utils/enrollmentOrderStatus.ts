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
