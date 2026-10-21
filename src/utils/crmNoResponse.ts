import {nextWork,type WorkCalendar} from './workCalendar';
export interface NoResponsePolicy {threshold:number;intervalMs:number;calendar:WorkCalendar;}
export interface NoResponseSequence {
 schema:1; revision:number; count:number; status:'counting'|'waiting'|'nurtured'|'protected'|'replied'|'review';
 startedAt:string; lastAttemptAt?:string; nextEligibleAt?:string; waitUntil?:string;
 policy?:NoResponsePolicy; lastOutcome?:'counted'|'too_soon'|'wrong_number'|'replied';
 resetAt?:string; resetSource?:string; needsGroupReview?:boolean;
 beforeTier?:{tier:any;tierSource:any;flag:any;tierUpdatedAt:any}; appliedAt?:string;
}
export const confirmedTier=(p:any)=>!!p.tierConfirmed||p.tierSource==='sales_confirmed';
export const completeQuestionnaire=(p:any)=>[p.currentStatus,p.goal,p.levelState,p.city,p.mode].every(Boolean);
export function noResponseAttempt(previous:NoResponseSequence|undefined,result:string,policy:NoResponsePolicy,clock:Date):NoResponseSequence {
 const at=clock.toISOString();
 const active=previous && previous.status!=='replied';
 const old=active ? previous : undefined;
 const p=old?.policy||policy;
 const s:NoResponseSequence={...old,schema:1,revision:(previous?.revision||0)+1,count:old?.count||0,status:old?.status||'counting',startedAt:old?.startedAt||at,policy:p,lastAttemptAt:at,nextEligibleAt:nextWork(new Date(clock.getTime()+p.intervalMs),p.calendar).toISOString()};
 if(result==='Wrong Number'){s.lastOutcome='wrong_number'; if(s.status==='waiting')s.waitUntil=s.nextEligibleAt;return s;}
 const lastAttempt=previous?.lastAttemptAt;
 const eligible=lastAttempt ? nextWork(new Date(Date.parse(lastAttempt)+p.intervalMs),p.calendar).getTime() : 0;
 const spaced=!lastAttempt || clock.getTime()>=eligible;
 if(spaced){s.count++;s.lastOutcome='counted';}else s.lastOutcome='too_soon';
 if(s.status!=='nurtured'&&p.threshold>0&&s.count>=p.threshold){s.status='waiting';s.waitUntil=s.nextEligibleAt;}
 return s;
}
