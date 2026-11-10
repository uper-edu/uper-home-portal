export const PERSONAL_CHANNEL_SETTING = "lark_personal_channel";
type Db = { query: Function };
export type LarkChannelMode = "simulation" | "live";
type PersonalChannel = { mode: LarkChannelMode; revision: number };

export function isolatedLarkRuntime(env = process.env) {
  return env.TRIAL_DATASET === "synthetic" && !["company-trial", "production"].includes(env.PORTAL_DEPLOYMENT || "");
}

export function larkTestDeliveryMode(mode: string | undefined, env = process.env) {
  return {
    simulated: mode !== "live",
    liveUnavailable: mode === "live" && (env.PLATFORM_MODE === "mock" || isolatedLarkRuntime(env)),
  };
}

export function legacyLarkChannelModes(env: NodeJS.ProcessEnv) {
  const groupLive = env.PORTAL_NOTIFICATION_MODE === "configured" && !isolatedLarkRuntime(env);
  return { groupLive, personalMode: groupLive && env.LARK_PERSONAL_DELIVERY_ENABLED === "true"
    ? "live" as const : "simulation" as const };
}

export async function personalLarkChannel(db: Db, lock = false): Promise<PersonalChannel> {
  const { rows } = await db.query(
    lock
      ? "SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE"
      : "SELECT value FROM portal_settings WHERE id=:p1",
    [PERSONAL_CHANNEL_SETTING],
  );
  const value = rows[0]?.value;
  return { mode: value?.mode === "live" && !isolatedLarkRuntime() ? "live" : "simulation", revision: value?.revision ?? 0 };
}

/** Call inside a transaction. Retired variables are read only on the first migration. */
export async function migrateLarkChannelModes(db: Db, env = process.env) {
  await db.query(
    "INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE id=id",
    [PERSONAL_CHANNEL_SETTING, { revision: 0 }],
  );
  if ((await personalLarkChannel(db, true)).revision > 0) return;
  const { groupLive, personalMode } = legacyLarkChannelModes(env);
  const changedGroups: string[] = [];
  if (!groupLive) {
    const { rows } = await db.query("SELECT * FROM notification_channels ORDER BY id FOR UPDATE");
    for (const { id, config } of rows) {
      if (config.deleted || config.mode !== "live") continue;
      await db.query("UPDATE notification_channels SET config=:p2 WHERE id=:p1", [id, { ...config, mode: "simulation" }]);
      changedGroups.push(id);
    }
  }
  await db.query("UPDATE portal_settings SET value=:p2 WHERE id=:p1", [PERSONAL_CHANNEL_SETTING, { mode: personalMode, revision: 1 }]);
  await db.query("INSERT INTO portal_audit(actor,action,data) VALUES('system','channel.mode.migrate',:p1)", [
    { simulatedGroups: changedGroups, personalMode },
  ]);
}
