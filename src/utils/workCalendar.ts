export interface WorkCalendar {timezone:string;days:number[];start:string;end:string;}
export function local(date: Date, r: WorkCalendar) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: r.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      get("weekday"),
    ),
    time: `${get("hour")}:${get("minute")}`,
  };
}
export function working(date: Date, r: WorkCalendar) {
  const l = local(date, r);
  return r.days.includes(l.day) && l.time >= r.start && l.time < r.end;
}
export function nextWork(date: Date, r: WorkCalendar) {
  let d = new Date(date);
  for (let i = 0; i < 1440 * 15; i++) {
    if (working(d, r)) return d;
    d = new Date(Math.floor(d.getTime()/60000)*60000 + 60000);
  }
  throw Error("No working time");
}
export function sla(date: Date, hours: number, r: WorkCalendar) {
  return nextWork(new Date(nextWork(date, r).getTime() + hours * 3600000), r);
}
// Convert a named local wall-clock sample to UTC without assuming a fixed offset.
export function calendarSample(date:string,time:string,timezone:string){
 const target=Date.parse(date+'T'+time+':00Z');let value=target;
 for(let i=0;i<4;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const get=(key:string)=>parts.find(p=>p.type===key)!.value;const shown=Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00Z`);const difference=target-shown;if(!difference)break;value+=difference;}return new Date(value);
}

/** Count full working days after the local start date and use the final day's closing time. */
export function workingDayDeadline(start:Date,days:number,calendar:{timezone:string;workDays:readonly number[];endTime:string}) {
  if(!calendar.workDays.some(day=>Number.isInteger(day)&&day>=0&&day<=6))throw Error('No working days configured');
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:calendar.timezone,year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(start);
  const part=(type:string)=>parts.find(entry=>entry.type===type)?.value;
  const day=new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  for(let remaining=days;remaining>0;){
    day.setUTCDate(day.getUTCDate()+1);
    if(calendar.workDays.includes(day.getUTCDay()))remaining--;
  }
  return calendarSample(day.toISOString().slice(0,10),calendar.endTime,calendar.timezone).toISOString();
}
