import type {DemandCriteria} from '../utils/enrollmentInterests';
import type {PrivateLessonRegistration} from '../utils/enrollmentInterestRecords';
import {readEnrollmentDraft,writeEnrollmentDraft} from './visitorContact';
import {submitEnrollmentInterest} from './enrollmentSession';
import {visitorScope} from './visitorScope';

export type DemandSubmission = {id:string;revision:number;criteria:DemandCriteria;name?:string;appointmentId?:string};
export type PendingDemand = DemandSubmission & {source:string;forAnother:boolean};
export type DemandReceipt={id:string;quote?:Pick<PrivateLessonRegistration,'lessons'|'minutes'|'total'>};

const key='demand:request';
const pendingSaves=new Map<string,{payload:string;receipt:Promise<DemandReceipt>}>();
type StoredDemands = Record<string,PendingDemand|string>;

export function readPendingDemand(owner:string,email:string) {
  return readEnrollmentDraft<StoredDemands>(owner,key)?.[email];
}

function writePendingDemand(owner:string,email:string,value?:PendingDemand) {
  const stored=readEnrollmentDraft<StoredDemands>(owner,key)??{};
  if(value)stored[email]=value;
  else delete stored[email];
  writeEnrollmentDraft(owner,key,Object.keys(stored).length?stored:undefined);
}

export function submitPendingDemand(owner:string,email:string,request:PendingDemand,recovering:boolean) {
  if(!owner||visitorScope()!==owner)return Promise.reject(Error('enrollment_verification_required'));
  const scope=JSON.stringify([owner,email]);
  const payload=JSON.stringify(request);
  const pending=pendingSaves.get(scope);
  if(pending?.payload===payload)return pending.receipt;
  const stored=readPendingDemand(owner,email);
  if(pending || (typeof stored==='string' ? stored!==request.id : stored && JSON.stringify(stored)!==payload)){
    return Promise.reject(Error('enrollment_demand_previous_unconfirmed'));
  }
  const receipt=savePendingDemand(owner,email,request,recovering||!!stored).finally(()=>pendingSaves.delete(scope));
  pendingSaves.set(scope,{payload,receipt});
  return receipt;
}

async function savePendingDemand(owner:string,email:string,request:PendingDemand,recovering:boolean) {
  const {forAnother:_,...body}=request;
  writePendingDemand(owner,email,request);
  try {
    const result=await submitEnrollmentInterest('demands',body.appointmentId?{...body,forAnother:request.forAnother}:body,email);
    const reused=body.appointmentId&&result.reused===true&&/^[a-f0-9-]{36}$/.test(result.id)&&Number.isInteger(result.revision)&&result.revision>=1;
    if(!reused&&(result.id!==body.id || result.revision!==body.revision+1))throw Error('enrollment_interest_unconfirmed');
    writePendingDemand(owner,email);
    const quote=result.quote;
    return {id:result.id as string,quote:body.appointmentId&&quote&&
      [quote.lessons,quote.minutes,quote.total].every(value=>Number.isSafeInteger(value)&&value>0)
      ? {lessons:quote.lessons,minutes:quote.minutes,total:quote.total} : undefined};
  } catch (cause) {
    const status=(cause as {status?:number}).status;
    if(!recovering && status && status>=400 && status<500 && status!==408)writePendingDemand(owner,email);
    throw cause;
  }
}

export function sameDemandDraft(pending:PendingDemand,draft:DemandSubmission,forAnother:boolean) {
  const {level,period,format,notes,phone}=draft.criteria;
  const previous=pending.criteria;
  return pending.name===draft.name && pending.forAnother===forAnother && pending.revision===draft.revision && pending.appointmentId===draft.appointmentId &&
    previous.level===level && previous.period===period && previous.format===format && previous.notes===notes && previous.phone===phone;
}
