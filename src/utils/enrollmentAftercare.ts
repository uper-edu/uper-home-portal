import type {PublicEnrollmentClass} from './enrollmentCatalog';

export function enrollmentRefundEstimate({ price, received, refunded, transferred, sessions, delivered }: {
  price: number; received: number; refunded: number; transferred: number; sessions: number; delivered: number;
}) {
  if (![price,received,refunded,transferred,sessions,delivered].every(Number.isSafeInteger) ||
      price<0 || received<0 || refunded<0 || transferred<0 || sessions<1 || delivered<0 || delivered>sessions) {
    throw Error('enrollment_invalid_refund_inputs');
  }
  const available=Math.max(0,received-refunded-transferred);
  if (delivered===0) return available;
  const remaining=Math.floor(price*(sessions-delivered)/sessions)-refunded-transferred;
  return Math.max(0,Math.min(available,remaining));
}

export function canSelectTransfer(order: {state:string;received:string|number;price:number}, sourceClass: {state:string}) {
  return sourceClass.state==='cancelled' && ['paid','recovered'].includes(order.state) && Number(order.received)>=order.price;
}

export type AftercareCourse = Partial<PublicEnrollmentClass> & {firstLesson:string};
type TransferTarget = AftercareCourse & {id:string};
type Invitation = AftercareCourse & {id:string;targetClassId:string;state:string;expiresAt:string};

export type EnrollmentAftercare = {
  originalClassState:string;
  currentClass:AftercareCourse;
  transfers:TransferTarget[];
  invitations:Invitation[];
  transferHistory:{source_class_id:string;target_class_id:string;created_at:string}[];
  lateProofSubmitted?:boolean;
  priorityRequested?:boolean;
  refundProgress?:{expected:number;refunded:number;returned?:number;sendBy?:string}|null;
  refund:{mode:string;maximum?:number};
};

export function readEnrollmentAftercare(value:unknown):EnrollmentAftercare|undefined {
  const details=value as Partial<EnrollmentAftercare>|null|undefined;
  const isCourse=(row:AftercareCourse|null|undefined)=>typeof row?.firstLesson==='string'&&
    [row.level,row.format,row.period,row.schedule,row.teacherType].every(item=>item==null||typeof item==='string');
  if(typeof details?.originalClassState!=='string'||!isCourse(details.currentClass)||
    typeof details.refund?.mode!=='string'||!Array.isArray(details.transfers)||
    details.transfers.some(row=>!isCourse(row)||typeof row.id!=='string')||
    !Array.isArray(details.invitations)||details.invitations.some(row=>!isCourse(row)||
      typeof row.id!=='string'||typeof row.targetClassId!=='string'||typeof row.state!=='string'||typeof row.expiresAt!=='string')||
    !Array.isArray(details.transferHistory)||details.transferHistory.some(row=>typeof row?.target_class_id!=='string'))return;
  const progress=details.refundProgress;
  if(progress!=null&&(!Number.isFinite(progress.expected)||!Number.isFinite(progress.refunded)||
    (progress.returned!=null&&!Number.isFinite(progress.returned))||
    (progress.sendBy!=null&&(typeof progress.sendBy!=='string'||!Number.isFinite(Date.parse(progress.sendBy))))))return;
  return details as EnrollmentAftercare;
}
