export const enrollmentBankFields = {name:120,accountName:160,accountNumber:64} as const;
export type EnrollmentBank = Record<keyof typeof enrollmentBankFields,string>;
export const enrollmentBankPlaceholder:EnrollmentBank={name:'TEST BANK',accountName:'UPER TEST ONLY',accountNumber:'TEST-0000000000'};

export function hasConfiguredEnrollmentBank({bank,revision}:{bank:EnrollmentBank;revision:number}){
  return revision>0&&(Object.keys(enrollmentBankPlaceholder) as (keyof EnrollmentBank)[])
    .every(key=>bank[key]!==enrollmentBankPlaceholder[key]);
}
