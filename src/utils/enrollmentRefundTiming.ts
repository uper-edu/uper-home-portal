import {calendarSample} from './workCalendar';

/** Count full working days after the local request date and use the final day's closing time. */
export function enrollmentRefundDeadline(
  requested:Date,days:number,calendar:{timezone:string;workDays:readonly number[];endTime:string},
) {
  if(!calendar.workDays.some(day=>Number.isInteger(day)&&day>=0&&day<=6))throw Error('No working days configured');
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:calendar.timezone,year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(requested);
  const part=(type:string)=>parts.find(entry=>entry.type===type)?.value;
  const localDate=`${part('year')}-${part('month')}-${part('day')}`;
  const day=new Date(localDate+'T00:00:00Z');
  let remaining=days;
  while(remaining>0){
    day.setUTCDate(day.getUTCDate()+1);
    if(calendar.workDays.includes(day.getUTCDay()))remaining--;
  }
  return calendarSample(day.toISOString().slice(0,10),calendar.endTime,calendar.timezone).toISOString();
}
