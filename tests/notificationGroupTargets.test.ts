import test from "node:test";
import assert from "node:assert/strict";
import {defaultRules, defaults, validate} from "../server/portal/policy.ts";
import {deleteNotificationGroupChannel, groupDeliveryTargets, notificationGroupPolicyReferences, policyLarkChannelConfig, policyLarkRecipients} from "../server/portal/notificationGroupChannels.ts";
import {planGroupChannelTest} from "../server/portal/larkGroupChannelTest.ts";
import {LARK_GROUP, LARK_PERSONAL, notificationGroupIds, policyDeliveryChannels} from "../src/utils/notificationGroupTargets.ts";
import type {Rule} from "../server/portal/policy.ts";
import {findSystemLarkGroup, systemLarkGroupName} from "../server/portal/larkSystemChannels.ts";

const groups = { ...defaults, group: "", groupIds: ["a", "b"] };

test("explicit Lark options route independently while retaining the old policy scope", async () => {
  const both: Rule = {...groups, channels: [LARK_GROUP, LARK_PERSONAL]};
  const personal: Rule = {...both, channels: [LARK_PERSONAL], groupIds: []};
  const withoutGroup = { query: async () => assert.fail("Private delivery must not look up a group") };
  const privateMode = (mode: string) => ({query: async (sql: string) => {
    assert.match(sql, /FROM portal_settings/);
    return {rows: [{value: {mode, revision: 1}}]};
  }});
  const db = {query: async (_sql: string, args: any[]) => ({
    rows: (Array.isArray(args[0]) ? args[0] : [args[0]]).map((id: string) => ({id, config: {mode: "simulation"}, value: {mode: "live", revision: 1}})),
  })};
  assert.doesNotThrow(() => validate(personal));
  assert.doesNotThrow(() => validate(both));
  assert.deepEqual(await policyLarkRecipients(withoutGroup, personal, LARK_PERSONAL, "owner"), ["personal:owner"]);
  assert.deepEqual(await policyLarkRecipients(withoutGroup, both, LARK_PERSONAL, undefined), []);
  assert.deepEqual(await policyLarkRecipients(db, both, LARK_GROUP, "owner"), ["a", "b"]);
  assert.deepEqual(await policyLarkRecipients(db, groups, "lark", "owner"), ["a", "b", "personal:owner"]);
  assert.deepEqual(await policyLarkChannelConfig(privateMode("live"), both, "personal:owner", true), {mode: "live", maxPerHour: both.maxPerHour});
  assert.equal((await policyLarkChannelConfig(privateMode("simulation"), personal, "personal:owner", true)).mode, "simulation");
  assert.equal((await policyLarkChannelConfig(db, groups, "personal:owner", true)).mode, "simulation");
  assert.deepEqual(policyDeliveryChannels(groups), ["inapp", LARK_GROUP, LARK_PERSONAL]);
  assert.deepEqual(policyDeliveryChannels({...groups, event: "lead.assigned"}), ["inapp", LARK_PERSONAL]);
  assert.deepEqual(policyDeliveryChannels({...groups, event: "daily.digest"}), ["inapp", LARK_GROUP]);
  assert.throws(() => validate({...both, event: "lead.assigned", groupIds: []}), /not valid for this policy/);
  assert.throws(() => validate({...personal, event: "daily.digest"}), /not valid for this policy/);
});

test("legacy and multiple group selections produce separate group deliveries and one personal copy", async () => {
  const db = { query: async (sql: string, args: string[][]) => {
    assert.match(sql, /ORDER BY id FOR SHARE/);
    return {rows: args[0].map(id => ({id, config: id === "deleted" ? {deleted:true} : {}}))};
  }};
  assert.deepEqual(notificationGroupIds({...defaults, group:"legacy"}), ["legacy"]);
  assert.deepEqual(await groupDeliveryTargets(db, notificationGroupIds(groups), "owner"), ["a", "b", "personal:owner"]);
  assert.deepEqual(await groupDeliveryTargets(db, ["a", "deleted"]), ["a"]);
  assert.deepEqual(await groupDeliveryTargets(db, ["deleted", "b"], "owner"), ["b"]);
  assert.deepEqual(notificationGroupIds({...groups, channels:["inapp"]}), []);
  assert.deepEqual(notificationGroupIds({...groups, event:"lead.assigned"}), []);
  assert.doesNotThrow(() => validate(groups));
  assert.throws(() => validate({...groups, groupIds:[]}), /at least one Lark group/);
  assert.throws(() => validate({...groups, groupIds:["a", "a"]}), /distinct/);
  assert.throws(() => validate({...groups, groupIds:["bad:route"]}), /distinct/);
  assert.throws(() => validate({...defaultRules.find(r=>r.event==="lead.assigned")!, groupIds:["a"]}), /only for the new owner/);
});

const channelId = "b";
const config = {groupName:"TEST group", mode:"simulation", encryptedWebhook:"placeholder", webhookRevision:"initial"};
function fixture(options: {linked?: boolean; pending?: boolean; pendingTest?: boolean} = {}) {
  let stored: any = config;
  const writes: {sql:string; args:any[]}[] = [];
  const db = { async query(sql: string, args: any[]) {
    if (sql.startsWith("SELECT config FROM notification_channels")) {
      assert.match(sql, /FOR UPDATE/);
      return {rows:[{config:stored}]};
    }
    if (sql.startsWith("SELECT id,config,enabled FROM notification_rules")) return {rows:[
      {id:"draft", config: options.linked ? groups : {...groups,channels:["inapp"]}, enabled:false},
      {id:"retired", config:{...groups,event:"task.created"}, enabled:false},
      {id:"private", config:{...groups,event:"lead.assigned"}, enabled:true},
    ]};
    if (sql.startsWith("SELECT id FROM notification_jobs")) {
      assert.match(sql, /state IN \('pending','sending'\)/);
      assert.match(sql, /rule\.groupIds\[0\]/);
      return {rows:options.pending ? [{id:"waiting"}] : []};
    }
    if (sql.startsWith("SELECT data,created_at FROM portal_audit"))
      return {rows:options.pendingTest ? [{data:{state:"pending"},created_at:new Date()}] : []};
    writes.push({sql,args});
    if (sql.startsWith("UPDATE notification_channels")) stored = args[1];
    return {rows:[]};
  }};
  return {db,writes,stored:()=>stored};
}

test("deletion protects editable policies, queued sends, in-flight tests and changed channel settings", async () => {
  const version = planGroupChannelTest(channelId,config).version;
  for (const [option, message] of [
    ["linked", /Remove this channel/],
    ["pending", /waiting to send/],
    ["pendingTest", /waiting to send/],
  ] as const) {
    const {db,writes} = fixture({[option]:true});
    await assert.rejects(deleteNotificationGroupChannel(db,channelId,version,"manager"), message);
    assert.deepEqual(writes,[]);
  }
  const {db,writes} = fixture();
  await assert.rejects(deleteNotificationGroupChannel(db,channelId,"old version","manager"), /settings changed/);
  assert.deepEqual(writes,[]);
});

test("successful deletion clears credentials, keeps history and is idempotent", async () => {
  const {db,writes,stored} = fixture();
  const version = planGroupChannelTest(channelId,config).version;
  assert.deepEqual(await notificationGroupPolicyReferences(db), []);
  assert.equal(await deleteNotificationGroupChannel(db,channelId,version,"manager"), true);
  assert.equal(await deleteNotificationGroupChannel(db,channelId,version,"manager"), false);
  assert.deepEqual(stored(),{deleted:true});
  assert.deepEqual(writes.map(write=>write.args),[
    [channelId,{deleted:true}],
    ["manager","channel.delete",{id:channelId}],
  ]);
  assert.ok(writes.every(write=>!write.sql.includes("notification_jobs")));
});

test("the built-in group keeps its identity and rejects renaming or deletion", async () => {
  const original = {id: "existing-system", config: {...config, groupName: "CRM Bot"}};
  const sameName = {id: "custom", config: {...config, groupName: "CRM Bot"}};
  assert.equal(findSystemLarkGroup([sameName, original], [original.id]), original);
  const stored = {...original.config, groupName: "Lark 群通知", systemManaged: true};
  assert.equal(systemLarkGroupName(original.id, stored), "Lark 群通知");
  assert.throws(() => systemLarkGroupName(original.id, stored, "Other group"), {status: 409});
  assert.equal(systemLarkGroupName(sameName.id, sameName.config, "Other group"), "Other group");
  let calls = 0;
  const db = {query: async (sql: string) => {
    assert.match(sql, /SELECT config .* FOR UPDATE/);
    calls++;
    return {rows: [{config: stored}]};
  }};
  await assert.rejects(deleteNotificationGroupChannel(db, original.id, "any", "manager"), {
    status: 409, message: "System channels cannot be deleted.",
  });
  assert.equal(calls, 1);
});
