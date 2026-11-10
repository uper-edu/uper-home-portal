import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { planGroupChannelTest, sendGroupChannelTest } from "../server/portal/larkGroupChannelTest.ts";

const url = "https://open.larksuite.com/open-apis/bot/v2/hook/fixture";
const id = "ops-group";
const code = "a7b465db-9fa4-41e4-b871-752ebd7b6b17";
const secret = "fixture-signing-key";
const env = {
  NODE_ENV: "production", APP_ENV: "production", PORTAL_DEPLOYMENT: "company-trial",
  LARK_TEST_GROUP: id,
  LARK_FIXTURE_GROUP: url,
  LARK_FIXTURE_SIGNING: secret,
};
const config = {
  mode: "live", groupName: "A label that must not be in the test message",
  secretRef: "LARK_FIXTURE_GROUP",
  signingEnabled: true, signingSecretRef: "LARK_FIXTURE_SIGNING",
};

test("simulation requires a saved destination and signing config and skips the transport", async () => {
  const transport = async () => { assert.fail("Simulation must not call the transport"); };
  const local = { ...env, TRIAL_DATASET: "local-crm" };
  const simulated = {...config, mode: "simulation"};
  assert.equal(await sendGroupChannelTest(planGroupChannelTest(id, simulated, local), code, transport), "accepted");
  const replacement = {...local, LARK_FIXTURE_GROUP: url + "-replacement"};
  assert.equal(planGroupChannelTest(id, simulated, replacement).url, url + "-replacement");
  assert.equal(await sendGroupChannelTest(planGroupChannelTest(id, simulated, replacement), code, transport), "accepted");
  assert.equal(planGroupChannelTest(id, config, {...local, LARK_FIXTURE_SIGNING: ""}).blocked, "missing_signing_secret");
});

test("live transport receives only signed TEST text and maps acceptance, rejection and uncertainty", async () => {
  const plan = planGroupChannelTest(id, config, env);
  assert.equal(plan.simulated, false);
  assert.equal(await sendGroupChannelTest(plan, code, async (target, options) => {
    assert.equal(target, url);
    assert.equal(options?.redirect, "error");
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.msg_type, "text");
    assert.equal(payload.content.text, `[TEST] UPER CRM · Group notification check\nVerification code: ${code}`);
    assert.equal(payload.sign, createHmac("sha256", payload.timestamp + "\n" + secret).update("").digest("base64"));
    return new Response('{"code":0}');
  }), "accepted");
  assert.equal(await sendGroupChannelTest(plan, code, async () => new Response('{"code":19001}')), "rejected");
  assert.equal(await sendGroupChannelTest(plan, code, async () => { throw Error("timeout"); }), "unknown");
});

test("live group tests keep the existing destination and company simulation restrictions", async () => {
  const forbidden = async () => assert.fail("Blocked attempts must not call Lark");
  for (const [overrides, reason] of [
    [{ LARK_TEST_GROUP: "other" }, "test_group_blocked"],
    [{ PORTAL_NOTIFICATION_MODE: "simulation" }, "live_unavailable"],
    [{ PLATFORM_MODE: "mock" }, "live_unavailable"],
    [{ LARK_FIXTURE_GROUP: "https://example.invalid" }, "missing_webhook"],
  ] as const) {
    const plan = planGroupChannelTest(id, config, { ...env, ...overrides });
    assert.equal(plan.blocked, reason);
    assert.equal(plan.simulated, false);
    assert.equal(await sendGroupChannelTest(plan, code, forbidden), "rejected");
  }
  const plan = planGroupChannelTest(id, config, env);
  assert.notEqual(plan.version, planGroupChannelTest(id, config, {...env, LARK_FIXTURE_GROUP: url + "-new"}).version);
  assert.notEqual(plan.version, planGroupChannelTest(id, config, {...env, LARK_FIXTURE_SIGNING: "new-signature"}).version);
});
