import type { EnrollmentClosureReason } from './enrollmentOrderStatus';
import { permittedRecord, type AccessEmployee } from './accessControl';
import { crmInstant, formatCrmEventTime } from './crmOperatingTime';

export const enrollmentManagementScopes = (actor:AccessEmployee) => ({
  followup: actor.active!==false && actor.permissions.includes('crm.read') && actor.permissions.includes('crm.followup'),
  operations: permittedRecord(actor,{},'crm.read') && permittedRecord(actor,{},'crm.operations.manage'),
  finance: permittedRecord(actor,{},'crm.read') && permittedRecord(actor,{},'crm.payments.verify'),
});

export const canViewEnrollmentManagement = (actor:AccessEmployee) =>
  Object.values(enrollmentManagementScopes(actor)).some(Boolean);

export const enrollmentRosterStates=['awaiting_payment','proof_review','partial','paid','held','waiting','history'] as const;
export type EnrollmentRosterState=typeof enrollmentRosterStates[number];
export type EnrollmentClassSummary={
  id:string; batchNumber?:number;teacherType?:'local'|'foreign'; level:string; format:'standard'|'small'; period:'weekday-evening'|'weekend'; schedule:string;
  firstLessonAt:string; capacity:number; minimumPaid:number;
  status:'recruiting'|'opened'|'cancelled'|'closed'; accepting:boolean;
  counts:Record<EnrollmentRosterState,number>; occupied:number; available:number;
};
export type EnrollmentRosterEntry={
  id:string; status:EnrollmentRosterState; actualStatus:string; name:string;
  customerId:string|null; opportunityId:string|null; owner:string|null; email?:string; phone?:string;
  closureReason?:EnrollmentClosureReason; dueAt:string|null; price?:number; received?:number; canVerify:boolean;
};
export const enrollmentClassManagementPath=(id:string)=>'/crm?tab=enrollment-management&classId='+encodeURIComponent(id);

export function enrollmentRosterReturnPath(value:string|null,orderId:string|null){
  if(!value?.startsWith('/crm?')||value.length>1000||!orderId)return;
  try{
    const url=new URL(value,'http://localhost:3000');
    const filters=url.searchParams,classId=filters.get('classId');
    if(url.origin!=='http://localhost:3000'||url.pathname!=='/crm'||filters.get('tab')!=='enrollment-management'||
        !classId||!/^[a-z0-9-]{1,64}$/i.test(classId)||filters.get('rosterOrder')!==orderId)return;
    const safe=new URLSearchParams({tab:'enrollment-management',classId,rosterOrder:orderId});
    writeEnrollmentClassFilters(safe,readEnrollmentClassFilters(filters));
    const state=enrollmentRosterStates.find(state=>state===filters.get('rosterStatus'));
    if(state)safe.set('rosterStatus',state);
    const closure=filters.get('rosterClosure');
    if(state==='history'&&closure&&['learner_cancelled','payment_timeout','staff_ended'].includes(closure))safe.set('rosterClosure',closure);
    return '/crm?'+safe;
  }catch{return;}
}


export function enrollmentSettingsReturnPath(value:string|null){
  if(!value?.startsWith('/crm?')||value.length>1000)return;
  const query=new URLSearchParams(value.slice('/crm?'.length));
  const tab=query.get('tab');
  if(tab!=='enrollment-management'&&tab!=='enrollment-aftercare')return;
  const safe=new URLSearchParams({tab});
  writeEnrollmentClassFilters(safe,readEnrollmentClassFilters(query));
  const classId=query.get('classId');
  if(tab==='enrollment-management'&&classId&&/^[a-z0-9-]{1,64}$/i.test(classId)){
    safe.set('classId',classId);
    safe.set('resumeRosterSettings','1');
    const status=enrollmentRosterStates.find(state=>state===query.get('rosterStatus'));
    if(status)safe.set('rosterStatus',status);
    const closure=query.get('rosterClosure');
    if(status==='history'&&closure&&['learner_cancelled','payment_timeout','staff_ended'].includes(closure)){
      safe.set('rosterClosure',closure);
    }
  }
  return '/crm?'+safe;
}

export const enrollmentClassPageSize=20;
export const enrollmentClassSorts=['upcoming','latest','oldest','seats','waitlist','opening'] as const;
type EnrollmentClassSort=typeof enrollmentClassSorts[number];
export type EnrollmentClassFilters={
  search:string;level:string;format:string;period:string;status:string;seats:string;date:string;sort:EnrollmentClassSort;page:number;
};
const classFilterParams={search:'classSearch',level:'classLevel',format:'classFormat',period:'classPeriod',status:'classStatus',
  seats:'classSeats',date:'classDate',sort:'classSort',page:'classPage'} as const;

export function readEnrollmentClassFilters(params:URLSearchParams):EnrollmentClassFilters {
  const text=(key:keyof typeof classFilterParams)=>params.get(classFilterParams[key])?.slice(0,120)??'';
  const sort=enrollmentClassSorts.find(value=>value===text('sort'))??'upcoming';
  return {
    search:text('search'),level:text('level'),format:text('format'),period:text('period'),
    status:['recruiting','opened','cancelled','closed'].includes(text('status'))?text('status'):'',
    seats:['available','full','closed'].includes(text('seats'))?text('seats'):'',
    date:['7','30','past'].includes(text('date'))?text('date'):'',
    sort,page:Math.max(1,Math.min(1_000_000,Math.floor(Number(text('page'))||1))),
  };
}
export function writeEnrollmentClassFilters(params:URLSearchParams,filters:EnrollmentClassFilters) {
  for(const key of Object.keys(classFilterParams) as (keyof EnrollmentClassFilters)[]){
    const isDefault=(key==='page'&&filters.page===1)||(key==='sort'&&filters.sort==='upcoming');
    const value=isDefault?'':String(filters[key]);
    if(value)params.set(classFilterParams[key],value);
    else params.delete(classFilterParams[key]);
  }
}
export function enrollmentClassShortfall(row:EnrollmentClassSummary) {
  return Math.max(0,row.minimumPaid-row.counts.paid);
}

export function enrollmentClassDateFilter(value:string,now=Date.now()){
  if(!value)return (_time:Date|null)=>true;
  const today=formatCrmEventTime(new Date(now).toISOString()).slice(0,10);
  const lastDay=value==='7'||value==='30'
    ?new Date(Date.parse(today+'T00:00:00Z')+(Number(value)-1)*86_400_000).toISOString().slice(0,10):'';
  return (time:Date|null)=>{
    if(!time)return false;
    if(value==='past')return time.getTime()<now;
    const date=formatCrmEventTime(time.toISOString()).slice(0,10);
    return time.getTime()>=now&&date>=today&&date<=lastDay;
  };
}

export function compareEnrollmentClassStarts(left:number|null,right:number|null,sort:string,now:number){
  if(left===null||right===null)return Number(left===null)-Number(right===null);
  if(sort==='latest')return right-left;
  if(sort==='oldest')return left-right;
  const leftPast=left<now,rightPast=right<now;
  return Number(leftPast)-Number(rightPast)||(leftPast?right-left:left-right);
}

export function filterEnrollmentClasses(
  rows:EnrollmentClassSummary[],filters:EnrollmentClassFilters,title:(row:EnrollmentClassSummary)=>string,now=Date.now(),
) {
  const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().trim();
  const tokens=normalize(filters.search).split(/\s+/u).filter(Boolean);
  const matchesDate=enrollmentClassDateFilter(filters.date,now);
  const matches=rows.flatMap(row=>{
    if((filters.level&&row.level!==filters.level)||(filters.format&&row.format!==filters.format)
      ||(filters.period&&row.period!==filters.period)||(filters.status&&row.status!==filters.status))return [];
    const seats=row.accepting?(row.available>0?'available':'full'):'closed';
    if(filters.seats&&seats!==filters.seats)return [];
    const instant=crmInstant(row.firstLessonAt);
    if(!matchesDate(instant))return [];
    if(tokens.length){
      const displayed=instant?formatCrmEventTime(row.firstLessonAt):'';
      const haystack=normalize([title(row),row.level.replace(/\s+/gu,''),row.id,row.schedule,displayed].join(' '));
      if(!tokens.every(token=>haystack.includes(token)))return [];
    }
    return [{row,time:instant?.getTime()??null}];
  });
  const pending=(row:EnrollmentClassSummary)=>row.status==='recruiting'||row.status==='closed';
  return matches.sort((left,right)=>{
    const a=left.row,b=right.row;
    const priority=filters.sort==='seats'?Number(b.accepting)-Number(a.accepting)||(a.accepting?b.available-a.available:0):
      filters.sort==='waitlist'?b.counts.waiting-a.counts.waiting:
      filters.sort==='opening'?Number(pending(b))-Number(pending(a))||(pending(a)&&pending(b)?enrollmentClassShortfall(a)-enrollmentClassShortfall(b):0):0;
    return priority||compareEnrollmentClassStarts(left.time,right.time,filters.sort,now)||a.id.localeCompare(b.id);
  }).map(({row})=>row);
}
