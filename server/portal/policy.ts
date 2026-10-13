import {local,working,nextWork,sla} from '../../src/utils/workCalendar.ts';
export {local,working,nextWork,sla} from '../../src/utils/workCalendar.ts';
export type Channel = "inapp" | "lark" | "email" | "sms";
export interface Rule {
  calendarMode?: "inherit" | "custom";
  quiet?: { start:string; end:string };
  teams?: string[];
  event: string;
  channels: Channel[];
  recipient: "owner" | "team" | "supervisor";
  team: string;
  group: string;
  sources: string[];
  tiers: string[];
  states: string[];
  timing: "immediate" | "delay" | "digest";
  delayMinutes: number;
  digestTime: string;
  businessOnly: boolean;
  timezone: string;
  days: number[];
  start: string;
  end: string;
  dedupeMinutes: number;
  maxPerHour: number;
  retries: number[];
  template: string;
  language: "zh" | "en" | "id";
}
export const defaults: Rule = {
  calendarMode: "inherit",
  event: "lead.created",
  channels: ["inapp", "lark"],
  recipient: "owner",
  team: "sales",
  group: "sales",
  sources: [],
  tiers: [],
  states: [],
  timing: "immediate",
  delayMinutes: 0,
  digestTime: "18:00",
  businessOnly: true,
  timezone: "Asia/Jakarta",
  days: [1, 2, 3, 4, 5, 6],
  start: "09:00",
  end: "20:00",
  dedupeMinutes: 15,
  maxPerHour: 20,
  retries: [1, 5, 15],
  template: "{{event}} · {{name}} · {{owner}} · {{due}}",
  language: "zh",
};
const events = [
  "conversation.updated",
  "lead.created",
  "conversation.reactivated",
  "handoff.requested",
  "booking.requested",
  "enrollment.requested",
  "assessment.completed",
  "task.overdue",
  "ai.failed",
  "notification.failed",
  "daily.digest",
];
export function validate(r: Rule) {
  if(r.calendarMode!==undefined && !["inherit","custom"].includes(r.calendarMode))throw Error("Invalid calendar mode");
  if (
    !events.includes(r.event) ||
    !Array.isArray(r.channels) ||
    !r.channels.length ||
    r.channels.some((c) => !["inapp", "lark"].includes(c))
  )
    throw Error("Only inapp and lark are connected");
  if (
    !["owner", "team", "supervisor"].includes(r.recipient) ||
    !["immediate", "delay", "digest"].includes(r.timing)
  )
    throw Error("Invalid policy");
  for(const values of [r.sources,r.tiers,r.states,r.teams || []])if(!Array.isArray(values)||values.length>30||values.some(v=>typeof v!=='string'||v.length>100))throw Error('Invalid filters');
  if(r.quiet && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.quiet.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.quiet.end)||r.quiet.start===r.quiet.end))throw Error('Invalid quiet hours');
  for(const value of [r.team,r.group])if(typeof value!=='string'||!value.trim()||value.length>100)throw Error('Invalid team/group');
  new Intl.DateTimeFormat("en", { timeZone: r.timezone });
  for (const t of [r.start, r.end, r.digestTime])
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw Error("Invalid time");
  if (
    r.start >= r.end ||
    !r.days.length ||
    r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw Error("Invalid business hours");
  for (const n of [r.delayMinutes, r.dedupeMinutes, r.maxPerHour, ...r.retries])
    if (!Number.isFinite(n) || n < 0 || n > 10080)
      throw Error("Invalid duration");
  if (
    r.retries.length > 5 ||
    r.template.length > 2000 ||
    !["zh", "en", "id"].includes(r.language)
  )
    throw Error("Invalid template/retries");
}
export function schedule(date: Date, r: Rule, channel: Channel) {
  if (channel === "inapp") return date;
  let d = new Date(
    date.getTime() + (r.timing === "delay" ? r.delayMinutes * 60000 : 0),
  );
  if (r.timing === "digest") {
    for (let i = 0; i < 1440 * 15; i++) {
      const l = local(d, r);
      if (r.days.includes(l.day) && l.time === r.digestTime) break;
      d = new Date(Math.floor(d.getTime()/60000)*60000 + 60000);
    }
  }
  for(let i=0;i<1440*15;i++){
    const time=local(d,r).time;
    const quiet=r.quiet && (r.quiet.start<r.quiet.end ? time>=r.quiet.start&&time<r.quiet.end : time>=r.quiet.start||time<r.quiet.end);
    if((!r.businessOnly || working(d,r)) && !quiet)return d;
    d=new Date(Math.floor(d.getTime()/60000)*60000+60000);
  }
  throw Error('No permitted send time');
}
export const defaultRules = events.map(
  (event) =>
    ({
      ...defaults,
      event,
      channels:
        event === "conversation.updated" ? ["inapp"] : defaults.channels,
      recipient:
        event === "task.overdue"
          ? "supervisor"
          : event.includes("failed")
            ? "team"
            : "owner",
      team: event.includes("failed") ? "ops" : "sales",
      group: event.includes("failed") ? "ops" : "sales",
      timing:
        event === "assessment.completed" || event === "daily.digest"
          ? "digest"
          : "immediate",
    }) as Rule,
);

export function withCalendarMode(r:Rule):Rule {
  const same=r.timezone===defaults.timezone && r.start===defaults.start && r.end===defaults.end && JSON.stringify([...(Array.isArray(r.days)?r.days:[])].sort())===JSON.stringify([...defaults.days].sort());
  return {...r,calendarMode:r.calendarMode ?? (same?'inherit':'custom')};
}
export function globalWorkCalendar(value:any){
  const fallback={timezone:defaults.timezone,start:defaults.start,end:defaults.end,days:defaults.days};
  try{const calendar={timezone:value.timezone,start:value.start,end:value.end,days:value.days};validate({...defaults,...calendar,calendarMode:'custom'});return {...calendar,source:'sla' as const};}catch{return {...fallback,source:'fallback' as const};}
}
export function resolveCalendar(r:Rule,global:any):Rule {
  const normalized=withCalendarMode(r);
  return normalized.calendarMode==='inherit'?{...normalized,...globalWorkCalendar(global)}:normalized;
}
