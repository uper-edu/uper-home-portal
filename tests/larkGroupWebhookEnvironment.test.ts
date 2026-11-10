import assert from "node:assert/strict";
import test from "node:test";
import { GROUP_WEBHOOK_ENV_KEY, groupWebhookUsesEnvironment, resolveGroupWebhook } from "../server/portal/larkGroupWebhook.ts";

const group = { secretRef: GROUP_WEBHOOK_ENV_KEY };
const fixtureAddress = new URL("/open-apis/bot/v2/hook/fixture-only", "https://open.larksuite.com").href;
const dev = { PORTAL_ENV: "dev", TRIAL_DATASET: "local-crm", PORTAL_LOCAL_CUTOVER: "true" };
const company = { PORTAL_ENV: "test", PORTAL_DEPLOYMENT: "company-trial" };

test("local and company CRM use only the approved environment reference", () => {
  for (const environment of [dev, company]) {
    const configured = { ...environment, [GROUP_WEBHOOK_ENV_KEY]: fixtureAddress, OTHER_WEBHOOK: fixtureAddress };
    assert.equal(resolveGroupWebhook("fixture", group, configured), fixtureAddress);
    assert.equal(resolveGroupWebhook("fixture", { secretRef: "OTHER_WEBHOOK" }, configured), undefined);
    assert.equal(resolveGroupWebhook("fixture", {}, configured), undefined);
    assert.equal(resolveGroupWebhook("fixture", group, environment), undefined);
    assert.equal(resolveGroupWebhook("fixture", group, { ...configured, [GROUP_WEBHOOK_ENV_KEY]: "https://example.invalid" }), undefined);
  }
});

test("remote development, other test installations and production stay outside the environment-only policy", () => {
  assert.equal(groupWebhookUsesEnvironment({ ...dev, PORTAL_DEPLOYMENT: "remote-dev" }), false);
  assert.equal(groupWebhookUsesEnvironment({ ...dev, PORTAL_LOCAL_CUTOVER: "false" }), false);
  assert.equal(groupWebhookUsesEnvironment({ PORTAL_ENV: "test" }), false);
  assert.equal(groupWebhookUsesEnvironment({ PORTAL_ENV: "prod", PORTAL_DEPLOYMENT: "production" }), false);
});

test("production can still read existing Webhook references before a separate migration", () => {
  const env = { PORTAL_ENV: "prod", PORTAL_DEPLOYMENT: "production", OTHER_WEBHOOK: fixtureAddress };
  const legacy = { secretRef: "OTHER_WEBHOOK" };
  assert.equal(resolveGroupWebhook("fixture", legacy, env), fixtureAddress);
  assert.equal(resolveGroupWebhook("fixture", { ...legacy, encryptedWebhook: "invalid" }, env), undefined);
});
