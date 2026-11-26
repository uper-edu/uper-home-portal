import {LEAD_ASSIGNED_EVENT} from "./leadAssignmentNotification.ts";

export const MAX_NOTIFICATION_GROUPS = 20;
export const LARK_GROUP = "lark_group";
export const LARK_PERSONAL = "lark_personal";
export const DAILY_SUMMARY_EVENT = "daily.digest";

export function allowsLarkGroup(event: string) {
  return event !== LEAD_ASSIGNED_EVENT;
}

export function allowsLarkPersonal(event: string) {
  return event !== DAILY_SUMMARY_EVENT && event !== "notification.failed";
}

export function policyDeliveryChannels<T extends string>(rule: {event: string; channels: readonly T[]}) {
  const legacyLark = rule.channels.some(channel => channel === "lark");
  return [...new Set([
    ...rule.channels.filter(channel => channel !== "lark"),
    ...(legacyLark && allowsLarkGroup(rule.event) ? [LARK_GROUP] : []),
    ...(legacyLark && allowsLarkPersonal(rule.event) ? [LARK_PERSONAL] : []),
  ])];
}

export function notificationGroupIds(rule: {
  event: string;
  channels: readonly string[];
  group?: string;
  groupIds?: readonly string[];
}): string[] {
  if (!allowsLarkGroup(rule.event) || !rule.channels.some(channel => channel === "lark" || channel === LARK_GROUP)) return [];
  return [...new Set(rule.groupIds ?? (rule.group ? [rule.group] : []))];
}
