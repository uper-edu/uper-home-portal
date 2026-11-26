import assert from "node:assert/strict";
import test from "node:test";
import { planPersonalChannelTest, sendPersonalChannelTest } from "../server/portal/larkPersonalChannelTest.ts";

const env = { PORTAL_ENV: "test", LARK_APP_ID: "cli_test", LARK_APP_SECRET: "fixture" };
const channel = { mode: "live", revision: 1 };
const binding = { appId: "cli_test", openId: "ou_self", revision: 1, updatedAt: "" };
const requestId = "c76ee590-2965-41cc-bd88-d16bda8b11f6";

test("personal test requires the current app and binding, and detects changes before confirmation", () => {
  const plan = planPersonalChannelTest(channel, binding, env);
  assert.equal(plan.blocked, null);
  assert.equal(planPersonalChannelTest(channel, binding, { ...env, LARK_APP_SECRET: "" }).blocked, "missing_app");
  for (const unavailable of [undefined, { ...binding, appId: "cli_old" }, { ...binding, openId: "" }]) {
    assert.equal(planPersonalChannelTest(channel, unavailable, env).blocked, "missing_binding");
  }
  assert.notEqual(planPersonalChannelTest(channel, { ...binding, revision: 2 }, env).version, plan.version);
  assert.notEqual(planPersonalChannelTest({ ...channel, mode: "simulation" }, binding, env).version, plan.version);
});

test("simulated personal tests skip the transport and isolated live tests are blocked", async () => {
  const client = { send: async () => assert.fail("unexpected external send") };
  assert.equal(await sendPersonalChannelTest(planPersonalChannelTest({ ...channel, mode: "simulation" }, binding, env), requestId, client), "accepted");
  assert.equal(await sendPersonalChannelTest(planPersonalChannelTest(channel, undefined, env), requestId, client), "rejected");
  for (const isolated of [{ ...env, TRIAL_DATASET: "synthetic" }, { ...env, PLATFORM_MODE: "mock" }]) {
    const plan = planPersonalChannelTest(channel, binding, isolated);
    assert.equal(plan.simulated, false);
    assert.equal(plan.blocked, "live_unavailable");
    assert.equal(await sendPersonalChannelTest(plan, requestId, client), "rejected");
  }
});

test("a local live personal TEST uses the linked recipient and keeps acceptance distinct from unknown", async () => {
  const plan = planPersonalChannelTest(channel, binding, {...env, PORTAL_ENV: "dev", APP_ENV: "local", TRIAL_DATASET: "local-crm"});
  assert.equal(plan.simulated, false);
  assert.equal(await sendPersonalChannelTest(plan, requestId, {
    send: async (recipient, message, uuid, mode) => {
      assert.equal(recipient, binding.openId);
      assert.equal(uuid, requestId);
      assert.equal(mode, "live");
      assert.deepEqual(message, {
        msg_type: "text",
        content: { text: `[TEST] UPER CRM · Personal notification check\nVerification code: ${requestId}` },
      });
      return new Response('{"code":0}');
    },
  }), "accepted");
  assert.equal(await sendPersonalChannelTest(plan, requestId, { send: async () => new Response('{"code":230013}') }), "rejected");
  assert.equal(await sendPersonalChannelTest(plan, requestId, { send: async () => { throw Error("timeout"); } }), "unknown");
});
