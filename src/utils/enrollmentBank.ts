export const enrollmentBankFields = {name:120,accountName:160,accountNumber:64} as const;
export type EnrollmentBank = Record<keyof typeof enrollmentBankFields,string>;
