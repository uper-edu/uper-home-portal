import {LARK_PERSONAL, notificationGroupIds} from "../../src/utils/notificationGroupTargets.ts";
import {isRetiredNotificationEvent} from "./policy.ts";
import type {Rule} from "./policy.ts";
import {LEAD_ASSIGNED_EVENT} from "../../src/utils/leadAssignmentNotification.ts";
import {personalLarkChannel} from "./larkChannelModes.ts";
import {findLarkChannelTest, planGroupChannelTest} from "./larkGroupChannelTest.ts";
import {isSystemLarkGroup} from "./larkSystemChannels.ts";

type Db = {query: Function};
type ChannelRow = {id: string; config: {deleted?: boolean} & Record<string, any>};

/** Rule saves and planning share channel locks with deletion. */
export async function lockNotificationGroupChannels(db: Db, ids: string[]): Promise<ChannelRow[]> {
  if (!ids.length) return [];
  const {rows} = await db.query(
    "SELECT id,config FROM notification_channels WHERE id IN (:p1) ORDER BY id FOR SHARE",
    [ids],
  );
  return rows;
}

export async function groupDeliveryTargets(db: Db, groupIds: string[], personalOwner?: string) {
  const locked = await lockNotificationGroupChannels(db, groupIds);
  const deleted = new Set(locked.filter(row => row.config.deleted).map(row => row.id));
  const targets = groupIds.filter(id => !deleted.has(id));
  if (personalOwner && groupIds.length && !deleted.has(groupIds[0])) targets.push("personal:" + personalOwner);
  return targets;
}

export async function policyLarkRecipients(
  db: Db, rule: Parameters<typeof notificationGroupIds>[0], option: string, personalOwner?: string,
) {
  if (option === LARK_PERSONAL) return personalOwner ? ["personal:" + personalOwner] : [];
  return groupDeliveryTargets(db, notificationGroupIds(rule), option === "lark" ? personalOwner : undefined);
}

export async function policyLarkChannelConfig(db: Db, rule: Rule, recipient: string, personal: boolean) {
  if (rule.event === LEAD_ASSIGNED_EVENT || (personal && rule.channels.includes(LARK_PERSONAL)))
    return { mode: (await personalLarkChannel(db)).mode, maxPerHour: rule.maxPerHour };
  // The older combined rules retain their original simulation and limit restrictions.
  const channel = personal ? notificationGroupIds(rule)[0] ?? "" : recipient;
  const config = (await db.query("SELECT config FROM notification_channels WHERE id=:p1", [channel])).rows[0]?.config;
  if (config && personal && (await personalLarkChannel(db)).mode === "simulation")
    return { ...config, mode: "simulation" };
  return config;
}

export async function notificationGroupPolicyReferences(db: Db) {
  const {rows} = await db.query("SELECT id,config,enabled FROM notification_rules");
  return rows.filter((row: any) => !row.config.deleted && !isRetiredNotificationEvent(row.config.event)).flatMap((row: any) =>
    notificationGroupIds(row.config).map(channel => ({channel, id: row.id as string, enabled: Boolean(row.enabled)})),
  ) as {channel: string; id: string; enabled: boolean}[];
}

const blocked = (message: string) => { throw Object.assign(Error(message), {status: 409}); };

/** Keep the reserved ID so defaults cannot recreate it and history can still identify it. */
export async function deleteNotificationGroupChannel(db: Db, id: string, version: string, actor: string) {
  const channel = (await db.query("SELECT config FROM notification_channels WHERE id=:p1 FOR UPDATE", [id])).rows[0]?.config;
  if (!channel || channel.deleted) return false;
  if (isSystemLarkGroup(id, channel)) blocked("System channels cannot be deleted.");
  if (planGroupChannelTest(id, channel).version !== version)
    blocked("Channel settings changed. Refresh before deleting.");
  if ((await notificationGroupPolicyReferences(db)).some(ref => ref.channel === id))
    blocked("Remove this channel from its notification policies before deleting it.");
  const pending = (await db.query(
    "SELECT id FROM notification_jobs WHERE channel='lark' AND state IN ('pending','sending') AND (recipient=:p1 OR (LEFT(recipient,9)='personal:' AND COALESCE(JSON_CONTAINS(snapshot->'$.rule.channels',JSON_QUOTE('lark_personal')),0)=0 AND COALESCE(snapshot->>'$.rule.groupIds[0]',snapshot->>'$.rule.group')=:p1)) LIMIT 1",
    [id],
  )).rows[0];
  const test = await findLarkChannelTest(db, id, null);
  if (pending || (test?.data.state === "pending" && Date.now() - new Date(test.created_at).getTime() < 60000))
    blocked("This channel has notifications still being sent or waiting to send.");
  await db.query("UPDATE notification_channels SET config=:p2 WHERE id=:p1", [id, {deleted: true}]);
  await db.query(
    "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
    [actor, "channel.delete", {id}],
  );
  return true;
}
