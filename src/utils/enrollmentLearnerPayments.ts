export const enrollmentPaymentPausedCopy = [
  '付款已暂停。席位和剩余付款时间保留。请暂勿转账，已转账的学员仍可提交凭证。',
  'Payment is paused. Your seat and remaining payment time are reserved. Please wait to transfer funds. You can still submit proof of a transfer you already made.',
  'Pembayaran dijeda. Kursi dan sisa waktu pembayaran Anda tetap disimpan. Tunda transfer. Jika sudah transfer, Anda tetap dapat mengirim buktinya.',
] as const;

export const enrollmentExistingTransferCopy = [
  '提交已转账凭证', 'Submit proof of an existing transfer', 'Kirim bukti transfer yang sudah dilakukan',
] as const;

export type EnrollmentLearnerPayment = {
  balance: number | null;
  estimated: boolean;
  awaitingVerification: boolean;
  action: 'transfer' | 'top_up' | 'wait' | 'support' | 'none';
};

export type EnrollmentLearnerTransfer = {
  id: string;
  submittedAt: string;
  amount?: number;
  reference?: string;
  verifiedAmount?: number;
  proofCount: number;
};

export type EnrollmentFinanceTransfer = EnrollmentLearnerTransfer & {proofIds:string[];reviewDueAt?:string};

export type EnrollmentFinanceProgress = {
  reported: number;
  verified: number;
  pending: number;
  reportedTotal: number;
  missingAmounts: number;
  nextTransferId?: string;
};

export type EnrollmentProofDraft = {amount:string;reference:string;transferId?:string};
export type EnrollmentProofSubmission = {reportedAmount?:number;bankReference?:string;transferId?:string};
