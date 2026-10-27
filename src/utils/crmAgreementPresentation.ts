import {calendarSample} from './workCalendar';
import {formatCrmOperatingTime} from './crmOperatingTime';
export type AgreementTiming='overdue'|'soon'|'today'|'scheduled'|'undated'|'invalid';
/** Read-only cues. No task, notification, deadline or agreement mutation. */
export function presentAgreement(agreement:any,timezone:string,now=Date.now()){
 let zone=agreement.timezone||timezone;try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{return {agreement,status:'invalid' as AgreementTiming,sortAt:Infinity};}
 let status:AgreementTiming='undated',sortAt=Infinity;
 if(agreement.at){
  const at=Date.parse(agreement.at);
  if(!/(Z|[+-]\d\d:\d\d)$/.test(agreement.at)||!Number.isFinite(at))status='invalid';
  else{sortAt=at;status=at<now?'overdue':at-now<=86400000?'soon':'scheduled';}
 }else if(agreement.date){
  const date=agreement.date;
  if(!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)status='invalid';
  else{
   const today=formatCrmOperatingTime(new Date(now).toISOString(),zone).slice(0,10);
   status=date<today?'overdue':date===today?'today':'scheduled';
   // Date-only sort key is its calendar date, not a claimed execution timestamp.
   sortAt=calendarSample(date,'00:00',zone).getTime();
  }
 }
 return {agreement,status,sortAt};
}
export function priorityAgreements(lead:any,timezone:string,now=Date.now()){
 const rank=(s:AgreementTiming)=>s==='overdue'?0:s==='soon'||s==='today'?1:s==='scheduled'?2:3;
 return (Array.isArray(lead.commitments)?lead.commitments:[]).filter((v:any)=>v?.status==='active').map((v:any)=>presentAgreement(v,timezone,now)).sort((a:any,b:any)=>rank(a.status)-rank(b.status)||a.sortAt-b.sortAt||String(a.agreement.id).localeCompare(String(b.agreement.id)));
}
