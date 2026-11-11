import assert from "node:assert/strict";
import test from "node:test";
import { legacyLarkChannelModes, migrateLarkChannelModes, personalLarkChannel } from "../server/portal/larkChannelModes.ts";
import defaults from "../src/data/system-defaults/index.ts";

test("existing simulation settings never become live when migrating channel modes", () => {
  const flags = { PORTAL_NOTIFICATION_MODE: "configured", LARK_PERSONAL_DELIVERY_ENABLED: "true" };
  assert.deepEqual(legacyLarkChannelModes(flags), { groupLive: true, personalMode: "live" });
  assert.deepEqual(legacyLarkChannelModes({ ...flags, LARK_PERSONAL_DELIVERY_ENABLED: "false" }), { groupLive: true, personalMode: "simulation" });
  assert.deepEqual(legacyLarkChannelModes({ ...flags, PORTAL_NOTIFICATION_MODE: "simulation" }), { groupLive: false, personalMode: "simulation" });
  assert.deepEqual(legacyLarkChannelModes({ ...flags, TRIAL_DATASET: "synthetic" }), { groupLive: false, personalMode: "simulation" });
  assert.deepEqual(legacyLarkChannelModes({}), { groupLive: false, personalMode: "simulation" });
});

test("migration downgrades only affected live groups, keeps credentials and cannot rerun after settings change", async () => {
  const groups = [
    { id: "group-a", config: { mode: "live", encryptedWebhook: "synthetic", signingEnabled: true } },
    { id: "group-b", config: { mode: "simulation", groupName: "Existing label" } },
  ];
  let value: any;
  let audits = 0;
  const db = {query: async (sql: string, values: any[]) => {
    if (sql.startsWith("INSERT INTO portal_settings")) value ??= values[1];
    else if (sql.startsWith("SELECT value")) return {rows: [{value}]};
    else if (sql.startsWith("SELECT * FROM notification_channels")) return {rows: groups};
    else if (sql.startsWith("UPDATE notification_channels")) groups.find(group => group.id === values[0])!.config = values[1];
    else if (sql.startsWith("UPDATE portal_settings")) value = values[1];
    else if (sql.startsWith("INSERT INTO portal_audit")) audits++;
    else assert.fail("Unexpected database mutation");
    return {rows: []};
  }};
  await migrateLarkChannelModes(db, {PORTAL_NOTIFICATION_MODE: "simulation", LARK_PERSONAL_DELIVERY_ENABLED: "true"});
  assert.deepEqual(value, {mode: "simulation", revision: 1});
  assert.deepEqual(groups[0].config, {mode: "simulation", encryptedWebhook: "synthetic", signingEnabled: true});
  assert.deepEqual(groups[1].config, {mode: "simulation", groupName: "Existing label"});
  value = {mode: "live", revision: 2};
  await migrateLarkChannelModes(db, {});
  assert.deepEqual(value, {mode: "live", revision: 2});
  assert.equal(audits, 1);
});

test("fresh personal defaults survive startup and repeated migration with retired flags absent or disabled", async () => {
  const value = structuredClone(defaults.larkPersonalChannel);
  let writes = 0;
  const db = {query: async (sql: string) => {
    if (sql.startsWith("INSERT INTO portal_settings")) return {rows: []};
    if (sql.startsWith("SELECT value")) return {rows: [{value}]};
    writes++;
    assert.fail("Initialized channel configuration must be preserved");
  }};
  await migrateLarkChannelModes(db, {});
  await migrateLarkChannelModes(db, {PORTAL_NOTIFICATION_MODE:"simulation", LARK_PERSONAL_DELIVERY_ENABLED:"false"});
  assert.deepEqual(await personalLarkChannel(db), {mode:"live", revision:1});
  assert.equal(writes, 0);
});

for (const mode of ["simulation", "live"] as const) {
  test("existing personal " + mode + " mode is preserved on restart", async () => {
    const value = {mode, revision:4};
    const db = {query: async (sql: string) => {
      if (sql.startsWith("INSERT INTO portal_settings")) return {rows: []};
      if (sql.startsWith("SELECT value")) return {rows: [{value}]};
      assert.fail("Existing settings must not be rewritten");
    }};
    await migrateLarkChannelModes(db, {PORTAL_NOTIFICATION_MODE:"configured", LARK_PERSONAL_DELIVERY_ENABLED:"true"});
    assert.deepEqual(await personalLarkChannel(db), value);
  });
}
