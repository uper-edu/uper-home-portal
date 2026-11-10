import assert from "node:assert/strict";
import test from "node:test";
import { planPersonalChannelTest, sendPersonalChannelTest } from "../server/portal/larkPersonalChannelTest.ts";

const env = { PORTAL_ENV: "test", LARK_APP_ID: "cli_test", LARK_APP_SECRET: "fixture", LARK_PERSONAL_DELIVERY_ENABLED: "true" };
const binding = { appId: "cli_test", openId: "ou_self", revision: 1, updatedAt: "" };
const requestId = "c76ee590-2965-41cc-bd88-d16bda8b11f6";

test("personal test requires the current app and binding, and detects changes before confirmation", () => {
  const plan = planPersonalChannelTest(binding, env);
  assert.equal(plan.blocked, null);
  assert.equal(planPersonalChannelTest(binding, { ...env, LARK_APP_SECRET: "" }).blocked, "missing_app");
  for (const unavailable of [undefined, { ...binding, appId: "cli_old" }, { ...binding, openId: "" }]) {
    assert.equal(planPersonalChannelTest(unavailable, env).blocked, "missing_binding");
  }
  assert.notEqual(planPersonalChannelTest({ ...binding, revision: 2 }, env).version, plan.version);
  assert.notEqual(planPersonalChannelTest(binding, {...env, LARK_PERSONAL_DELIVERY_ENABLED: "false"}).version, plan.version);
});

test("disabled personal delivery and isolated live tests never call Lark", async () => {
  const client = { send: async () => assert.fail("unexpected external send") };
  assert.equal(await sendPersonalChannelTest(planPersonalChannelTest(binding, {...env, LARK_PERSONAL_DELIVERY_ENABLED: "false"}), requestId, client), "rejected");
  assert.equal(await sendPersonalChannelTest(planPersonalChannelTest(undefined, env), requestId, client), "rejected");
  for (const isolated of [{ ...env, TRIAL_DATASET: "synthetic" }, { ...env, PLATFORM_MODE: "mock" }, { ...env, PORTAL_DEPLOYMENT: "company-trial", PORTAL_NOTIFICATION_MODE: "simulation" }]) {
    const plan = planPersonalChannelTest(binding, isolated);
    assert.equal(plan.simulated, false);
    assert.equal(plan.blocked, "live_unavailable");
    assert.equal(await sendPersonalChannelTest(plan, requestId, client), "rejected");
  }
});

test("a local live personal TEST uses the linked recipient and keeps acceptance distinct from unknown", async () => {
  const plan = planPersonalChannelTest(binding, {...env, PORTAL_ENV: "dev", APP_ENV: "local", TRIAL_DATASET: "local-crm"});
  assert.equal(plan.simulated, false);
  assert.equal(await sendPersonalChannelTest(plan, requestId, {
    send: async (recipient, message, uuid) => {
      assert.equal(recipient, binding.openId);
      assert.equal(uuid, requestId);
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
