import {notifications as notificationDefaults, sales} from '../../src/data/system-defaults/index.ts';
import {LARK_DEFAULT_LANGUAGE,LARK_DEFAULT_MAX_PER_HOUR} from '../../src/utils/larkNotificationDefaults.ts';
import {allowsLarkGroup,allowsLarkPersonal,LARK_GROUP,LARK_PERSONAL,MAX_NOTIFICATION_GROUPS,policyDeliveryChannels} from '../../src/utils/notificationGroupTargets.ts';
import {LEAD_ASSIGNED_EVENT} from '../../src/utils/leadAssignmentNotification.ts';
import {local,working,nextWork,sla} from '../../src/utils/workCalendar.ts';
export {local,working,nextWork,sla} from '../../src/utils/workCalendar.ts';
export type Channel = "inapp" | "lark" | "email" | "sms";
export const CRM_BOT_CHANNEL = "lark-group-default";
export const TASK_NOTICE_EVENTS = ["task.created", "task.rescheduled", "task.appointment_due"] as const;
export function isRetiredNotificationEvent(event: unknown) {
  return TASK_NOTICE_EVENTS.some(retired => retired === event);
}
export interface Rule {
  calendarMode?: "inherit" | "custom";
  quiet?: { start:string; end:string };
  teams?: string[]; // historical snapshots only; never matched by the worker
  requiresRoutingReview?: boolean;
  event: string;
  channels: (Channel | typeof LARK_GROUP | typeof LARK_PERSONAL)[];
  recipient: "owner" | "managers" | "team" | "supervisor";
  team?: string;
  group: string; // Legacy single-group rules and snapshots
  groupIds?: string[];
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
  ...structuredClone(notificationDefaults.ruleDefaults),
  timezone: sales.businessHours.timezone,
  start: sales.businessHours.startTime,
  end: sales.businessHours.endTime,
  days: [...sales.businessHours.workDays],
  maxPerHour: LARK_DEFAULT_MAX_PER_HOUR,
  language: LARK_DEFAULT_LANGUAGE,
} as Rule;
const events = [
  "commitment.due",
  "task.created",
  "task.rescheduled",
  "task.appointment_due",
  "conversation.updated",
  "lead.created",
  LEAD_ASSIGNED_EVENT,
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
    r.channels.some((c) => !["inapp", "lark", LARK_GROUP, LARK_PERSONAL].includes(c))
  )
    throw Error("Only inapp and lark are connected");
  if (
    !["owner", "managers"].includes(r.recipient) ||
    !["immediate", "delay", "digest"].includes(r.timing)
  )
    throw Error("Invalid policy");
  if (r.groupIds !== undefined && (!Array.isArray(r.groupIds) ||
      r.groupIds.length > MAX_NOTIFICATION_GROUPS ||
      r.groupIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(id)) ||
      new Set(r.groupIds).size !== r.groupIds.length))
    throw Error("Select up to 20 distinct Lark group channels.");
  if (r.event === LEAD_ASSIGNED_EVENT && (r.recipient !== "owner" || r.group !== "" || r.groupIds?.length))
    throw Error("Assignment notifications are only for the new owner");
  if ((r.channels.includes(LARK_GROUP) && !allowsLarkGroup(r.event)) ||
      (r.channels.includes(LARK_PERSONAL) && !allowsLarkPersonal(r.event)) ||
      (r.channels.includes("lark") && (r.channels.includes(LARK_GROUP) || r.channels.includes(LARK_PERSONAL))))
    throw Error("The selected Lark delivery options are not valid for this policy.");
  for(const values of [r.sources,r.tiers,r.states,r.teams || []])if(!Array.isArray(values)||values.length>30||values.some(v=>typeof v!=='string'||v.length>100))throw Error('Invalid filters');
  if(r.quiet && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.quiet.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.quiet.end)||r.quiet.start===r.quiet.end))throw Error('Invalid quiet hours');
  if (allowsLarkGroup(r.event) && policyDeliveryChannels(r).includes(LARK_GROUP)) {
    if (r.groupIds === undefined && (typeof r.group !== 'string' || !r.group.trim() || r.group.length > 100))
      throw Error("Invalid team/group");
    if (r.groupIds?.length === 0) throw Error("Select at least one Lark group channel.");
  }
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
export const defaultRules: Rule[] = notificationDefaults.rules.map(
  override => ({...structuredClone(defaults), ...structuredClone(override)}) as Rule,
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
