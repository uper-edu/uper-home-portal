export const enrollmentBankFields = {name:120,accountName:160,accountNumber:64} as const;
export type EnrollmentBank = Record<keyof typeof enrollmentBankFields,string>;
export const enrollmentBankPlaceholder:EnrollmentBank={name:'TEST BANK',accountName:'UPER TEST ONLY',accountNumber:'TEST-0000000000'};
const fields=Object.keys(enrollmentBankFields) as (keyof EnrollmentBank)[];

export function parseEnrollmentBank(input:unknown):EnrollmentBank|null {
  if(!input||typeof input!=='object')return null;
  const values=input as Record<string,unknown>;
  const entries=fields.map(key=>[key,typeof values[key]==='string'?(values[key] as string).trim():null] as const);
  if(entries.some(([key,value])=>!value||value.length>enrollmentBankFields[key]||/[\x00-\x1f\x7f]/u.test(value)))return null;
  return Object.fromEntries(entries) as EnrollmentBank;
}

export function hasEnrollmentBankPlaceholder(bank:EnrollmentBank) {
  return fields.some(key=>bank[key]===enrollmentBankPlaceholder[key]);
}

export function hasConfiguredEnrollmentBank({bank,revision}:{bank:EnrollmentBank;revision:number}){
  return revision>0&&!hasEnrollmentBankPlaceholder(bank);
}
