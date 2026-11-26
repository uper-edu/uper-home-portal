import type {DashboardTeachingFormat} from './crmOperationsDashboard';
import type {FacultyCurrency} from './crmFaculty';

export type TeacherSettlementKind='class'|'appointment';
export type TeacherSettlementTarget={
  kind:TeacherSettlementKind;referenceId:string;level:string;format:DashboardTeachingFormat;
  teacher:string;firstLesson:string;batchNumber:number;period?:string;minutes:number;teacherId?:string;
};
export type TeacherRateQuote=
  | {kind:'lesson';currency:FacultyCurrency;amountMinor:number;effective:string;revision:number}
  | {kind:'monthly';effective:string;revision:number}
  | {kind:'missing'|'split'};
export type TeacherRateSnapshot=Extract<TeacherRateQuote,{kind:'lesson'|'monthly'}>;
export type TeacherServicePeriod={from:string;to:string;rateRevision:number;convertedIDR?:number;basis?:string};
export type TeacherSettlementLine={
  target:TeacherSettlementTarget;lessons:number;lessonFee:number;service?:TeacherServicePeriod;rate?:TeacherRateSnapshot;
};
export type TeacherSettlement={
  number:string;month:string;lines:TeacherSettlementLine[];revision:string;updatedAt:string;reason:string;
};
export type TeacherSettlementDraft={
  number:string;month:string;revision:string|null;reason:string;
  lines:(Pick<TeacherSettlementTarget,'kind'|'referenceId'>&Omit<TeacherSettlementLine,'target'|'rate'>)[];
};
export const teacherSettlementMonth=/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
export const teacherSettlementCost=(lessons:number,lessonFee:number)=>lessons*lessonFee;
export function teacherSettlementLineAmount(line:TeacherSettlementLine){
  if(line.rate?.kind==='monthly')return null;
  if(line.rate?.kind==='lesson')return line.rate.currency==='CNY'?line.service?.convertedIDR??null:
    teacherSettlementCost(line.lessons,line.rate.amountMinor);
  return teacherSettlementCost(line.lessons,line.lessonFee);
}

export function summarizeTeacherSettlements(records:readonly TeacherSettlement[]){
  const totals={IDR:0,class:0,appointment:0,lessons:0,pending:0};
  for(const {lines} of records){
    for(const line of lines){
      const amount=teacherSettlementLineAmount(line);
      if(amount===null){totals.pending++;continue;}
      totals[line.target.kind]+=amount;
      totals.IDR+=amount;
      totals.lessons+=line.lessons;
    }
  }
  return totals;
}
