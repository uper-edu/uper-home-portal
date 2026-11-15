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
