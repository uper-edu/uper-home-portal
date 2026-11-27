export const admissionsMailPath='/system?tab=mail&mailView=admissions';

export function systemMailView(value:string|null):'accounts'|'pool'|'admissions' {
  return value==='pool'||value==='admissions'?value:'accounts';
}
