import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { planGroupChannelTest, sendGroupChannelTest } from "../server/portal/larkGroupChannelTest.ts";
import { encryptGroupWebhook, publicGroupChannelConfig, resolveGroupWebhook } from "../server/portal/larkGroupWebhook.ts";
import { channelConnection } from "../server/portal/notificationDelivery.ts";

const url = "https://open.larksuite.com/open-apis/bot/v2/hook/fixture";
const id = "ops-group";
const code = "a7b465db-9fa4-41e4-b871-752ebd7b6b17";
const secret = "fixture-signing-key";
const env = {
  NODE_ENV: "production", APP_ENV: "production", PORTAL_DEPLOYMENT: "company-trial",
  LARK_WEBHOOK_ENCRYPTION_KEY: "a1".repeat(32),
  LARK_FIXTURE_SIGNING: secret,
};
const config = {
  mode: "live", groupName: "A label that must not be in the test message",
  encryptedWebhook: encryptGroupWebhook(id, url, env),
  signingEnabled: true, signingSecretRef: "LARK_FIXTURE_SIGNING",
};

test("simulation requires a saved destination and signing config and skips the transport", async () => {
  const transport = async () => { assert.fail("Simulation must not call the transport"); };
  const local = { ...env, TRIAL_DATASET: "local-crm" };
  const simulated = {...config, mode: "simulation"};
  assert.equal(await sendGroupChannelTest(planGroupChannelTest(id, simulated, local), code, transport), "accepted");
  const replaced = {...simulated, encryptedWebhook: encryptGroupWebhook(id, url + "-replacement", local)};
  assert.equal(planGroupChannelTest(id, replaced, local).url, url + "-replacement");
  assert.equal(await sendGroupChannelTest(planGroupChannelTest(id, replaced, local), code, transport), "accepted");
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

test("local CRM and company test use only the saved LARK_GROUP_CRM reference", async t => {
  const target = "https://open.larksuite.com/open-apis/bot/v2/hook/company-fixture";
  const companyTest = {...env, PORTAL_ENV: "test", LARK_GROUP_CRM: target};
  const legacy = {groupName: "Lark 群通知", mode: "live", secretRef: "LARK_GROUP_CRM"};
  assert.equal(resolveGroupWebhook(id, legacy, companyTest), target);
  assert.equal(resolveGroupWebhook(id, legacy, {...companyTest, PORTAL_ENV: "dev"}), undefined);
  assert.equal(resolveGroupWebhook(id, legacy, {...companyTest, PORTAL_DEPLOYMENT: "production"}), undefined);
  assert.equal(resolveGroupWebhook(id, {...legacy, secretRef: "OTHER_WEBHOOK"}, {...companyTest, OTHER_WEBHOOK: target}), undefined);
  assert.equal(resolveGroupWebhook(id, {...legacy, secretRef: undefined}, companyTest), undefined);
  assert.equal(resolveGroupWebhook(id, legacy, {...companyTest, LARK_GROUP_CRM: "https://example.invalid/"}), undefined);
  assert.equal(resolveGroupWebhook(id, legacy, {...companyTest, LARK_GROUP_CRM: undefined}), undefined);
  assert.equal(resolveGroupWebhook(id, {...legacy, encryptedWebhook: config.encryptedWebhook}, companyTest), target);
  assert.equal(resolveGroupWebhook(id, config, companyTest), undefined);
  assert.equal(encryptGroupWebhook(id, url, companyTest), undefined);

  const local = {PORTAL_ENV: "dev", TRIAL_DATASET: "local-crm", PORTAL_LOCAL_CUTOVER: "true", LARK_GROUP_CRM: target};
  assert.equal(resolveGroupWebhook(id, legacy, local), target);
  assert.equal(resolveGroupWebhook(id, config, {...local, LARK_WEBHOOK_ENCRYPTION_KEY: env.LARK_WEBHOOK_ENCRYPTION_KEY}), undefined);
  assert.equal(encryptGroupWebhook(id, url, {...local, LARK_WEBHOOK_ENCRYPTION_KEY: env.LARK_WEBHOOK_ENCRYPTION_KEY}), undefined);
  assert.equal(resolveGroupWebhook(id, legacy, {...local, PORTAL_DEPLOYMENT: "remote-dev"}), undefined);
  assert.equal(resolveGroupWebhook(id, legacy, {...local, TRIAL_DATASET: "synthetic"}), undefined);
  assert.equal(await sendGroupChannelTest(planGroupChannelTest(id, legacy, local), code, async destination => {
    assert.equal(destination, target);
    return Response.json({code: 0});
  }), "accepted");
  const blocked = planGroupChannelTest(id, legacy, {...local, PLATFORM_MODE: "mock"});
  assert.equal(blocked.blocked, "live_unavailable");
  assert.equal(blocked.simulated, false);

  const plan = planGroupChannelTest(id, legacy, companyTest);
  assert.equal(plan.simulated, false);
  assert.equal(plan.blocked, null);
  assert.equal(await sendGroupChannelTest(plan, code, async destination => {
    assert.equal(destination, target);
    return Response.json({code: 0});
  }), "accepted");
  assert.notEqual(plan.version, planGroupChannelTest(id, legacy, {...companyTest, LARK_GROUP_CRM: target + "-rotated"}).version);
  assert.equal(planGroupChannelTest(id, legacy, {...companyTest, LARK_GROUP_CRM: undefined}).blocked, "missing_webhook");

  const keys = ["PORTAL_ENV", "PORTAL_DEPLOYMENT", "LARK_GROUP_CRM"] as const;
  const previous = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  }));
  for (const key of keys) process.env[key] = companyTest[key];
  const state = channelConnection(id, legacy);
  assert.equal(state.status, "configured");
  assert.equal(state.webhookStored, true);
  assert.doesNotMatch(JSON.stringify({state, config: publicGroupChannelConfig(legacy)}), /LARK_GROUP_CRM|company-fixture/);
});
