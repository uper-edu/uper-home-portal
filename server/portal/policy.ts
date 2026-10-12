export type Channel = "inapp" | "lark" | "email" | "sms";
export interface Rule {
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
export function local(date: Date, r: Rule) {
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
export function working(date: Date, r: Rule) {
  const l = local(date, r);
  return r.days.includes(l.day) && l.time >= r.start && l.time < r.end;
}
export function nextWork(date: Date, r: Rule) {
  let d = new Date(date);
  for (let i = 0; i < 1440 * 15; i++) {
    if (working(d, r)) return d;
    d = new Date(d.getTime() + 60000);
  }
  throw Error("No working time");
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
      d = new Date(d.getTime() + 60000);
    }
  }
  return r.businessOnly ? nextWork(d, r) : d;
}
export function sla(date: Date, hours: number, r: Rule) {
  return nextWork(new Date(nextWork(date, r).getTime() + hours * 3600000), r);
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
