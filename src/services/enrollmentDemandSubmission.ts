import type {DemandCriteria} from '../utils/enrollmentInterests';
import {readEnrollmentDraft,writeEnrollmentDraft} from './visitorContact';
import {submitEnrollmentInterest} from './enrollmentSession';
import {visitorScope} from './visitorScope';

export type DemandSubmission = {id:string;revision:number;criteria:DemandCriteria;name?:string};
export type PendingDemand = DemandSubmission & {source:string;forAnother:boolean};

const key='demand:request';
const pendingSaves=new Map<string,{payload:string;receipt:Promise<void>}>();
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
    const result=await submitEnrollmentInterest('demands',body,email);
    if(result.id!==body.id || result.revision!==body.revision+1)throw Error('enrollment_interest_unconfirmed');
  } catch (cause) {
    const status=(cause as {status?:number}).status;
    if(!recovering && status && status>=400 && status<500 && status!==408)writePendingDemand(owner,email);
    throw cause;
  }
  writePendingDemand(owner,email);
}

export function sameDemandDraft(pending:PendingDemand,draft:DemandSubmission,forAnother:boolean) {
  const {level,period,format,notes,phone}=draft.criteria;
  const previous=pending.criteria;
  return pending.name===draft.name && pending.forAnother===forAnother && pending.revision===draft.revision &&
    previous.level===level && previous.period===period && previous.format===format && previous.notes===notes && previous.phone===phone;
}
