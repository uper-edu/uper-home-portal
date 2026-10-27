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
