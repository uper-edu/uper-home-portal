/** MySQL DATETIME values in this application represent UTC, never the browser wall clock. */
export function crmInstant(value:string|undefined){
 if(!value)return null;
 const text=/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(value)&&!/(Z|[+-]\d\d:\d\d)$/i.test(value)?value.replace(' ','T')+'Z':value;
 const date=new Date(text);return Number.isFinite(date.getTime())?date:null;
}
export function viewerTimeZone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
export function formatCrmOperatingTime(value: string | undefined, timezone: string): string {
  if (!value) return '';
  const date = crmInstant(value);
  if (!date) return value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
export function formatCrmEventTime(value:string|undefined){return formatCrmOperatingTime(value,viewerTimeZone());}

/** Follow-up reading format only. No occurrence is inferred from a save/receipt time. */
export function formatCrmSummaryTime(value:string|undefined,timezone=viewerTimeZone(),now:Date=new Date()):string{
 if(!crmInstant(value))return '';
 const full=formatCrmOperatingTime(value,timezone),year=formatCrmOperatingTime(now.toISOString(),timezone).slice(0,4);
 return full.slice(0,4)===year?full.slice(5):full;
}

/** Reject DST gaps/repeated local times rather than silently shifting an appointment. */
export function validateLocalInstant(local:string,instant:Date,timezone:string){
 const shown=(date:Date)=>formatCrmOperatingTime(date.toISOString(),timezone).slice(0,16).replace(' ','T');
 if(shown(instant)!==local)throw Error('Invalid local date and time');
 for(const minutes of [-120,-60,-30,30,60,120]){
  if(shown(new Date(instant.getTime()+minutes*60000))===local)throw Error('Ambiguous local date and time');
 }
 return instant;
}
