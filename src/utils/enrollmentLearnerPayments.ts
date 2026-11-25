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
