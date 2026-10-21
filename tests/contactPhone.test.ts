import {test} from "node:test";
import assert from "node:assert/strict";
import {validContactPhone, contactPhoneText, CONTACT_PHONE_ERROR} from "../src/utils/contactPhone";

const valid = ["081234567890", "6281234567890", "+62 812-3456-7890", "+8613812345678", "0086 138-1234-5678", "+44 7911 123456"];
const invalid: unknown[] = ["12345678abc", "1234+567890", "0812_34567890", "0812=34567890", "++6281234567890", "+62+81234567890", "-- --", "+", "0812", "+9991234567890", "+861381234567890", "0".repeat(41), "081234567890 ext 2", "081234567890/081234567890", "Call +6281234567890", 6281234567890, {}, ["081234567890"], false, null];

test("phone validation accepts country formats without inferring country from language", () => {
  for (const value of valid) assert.equal(validContactPhone(value), true, value);
  for (const value of invalid) assert.equal(validContactPhone(value), false, JSON.stringify(value));
  assert.equal(validContactPhone(""), false);
  assert.equal(validContactPhone("", false), true);
  assert.equal(validContactPhone("   ", false), true);
  assert.equal(validContactPhone(" ".repeat(41), false), false);
  for (const lang of ["en", "id", "zh"]) {
    assert.ok(contactPhoneText(lang).help);
    assert.ok(contactPhoneText(lang).error);
  }
});

if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const {setupNativeTest} = await import("./helpers/mysql.mjs");
  await setupNativeTest("contact_phone");
  const {pool} = await import("../server/portal/store.ts");
  const {mountPortal} = await import("../server/portal/runtime.ts");
  const {default: express} = await import("express");
  const app = express(); app.use(express.json()); await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = "";
  async function request(path: string, body: any, fresh = false) {
    const response = await fetch(base + path, {method: "POST", headers: {"Content-Type": "application/json", cookie: fresh ? "" : cookie}, body: JSON.stringify(body)});
    const set = response.headers.get("set-cookie");
    if (set && !fresh) cookie = set.split(";")[0];
    return {status: response.status, data: await response.json()};
  }
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of ["portal_leads", "identity_candidates", "followup_tasks", "outbox", "crm_facts"]) {
      result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
    }
    return result;
  }
  await test("registration rejects invalid phones before business writes across all aliases", async t => {
    t.after(async () => {await new Promise<void>(resolve => server.close(() => resolve())); await pool.end();});
    const before = await snapshot();
    for (const path of ["/api/portal/register", "/api/chatbot-inquiry", "/api/standalone-chat-lead"]) {
      for (const field of ["phone", "whatsapp"]) {
        for (const value of invalid) {
          const result = await request(path, {fullName: "TEST invalid phone", email: "test-invalid@example.invalid", [field]: value}, true);
          assert.equal(result.status, 400, path + " " + field + " " + JSON.stringify(value));
          assert.equal(result.data.error, CONTACT_PHONE_ERROR);
        }
      }
    }
    assert.deepEqual(await snapshot(), before);
    const campaign = {id: "TEST-phone-campaign", code: "TEST-phone-campaign", name: "TEST Phone Validation", stats: {}};
    await pool.query("INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)", [campaign.id,campaign.code,campaign]);
    const created = await request("/api/portal/register", {fullName: "TEST Phone Learner", whatsapp: "+62 812-3456-7890", email: "test-phone@example.invalid", campaignId: campaign.code, goal: "Work in China", city: "Jakarta", mode: "Online"});
    assert.equal(created.status, 200);
    const lead = created.data.lead;
    assert.equal(lead.whatsapp, "+62 812-3456-7890");
    assert.equal(lead.campaignId, campaign.code);
    const afterValid = await snapshot();
    assert.equal((afterValid.portal_leads as any[]).length, 1);
    assert.equal((afterValid.followup_tasks as any[]).length, 1);
    assert.ok((afterValid.outbox as any[]).length > 0);
    const blocked = await request("/api/portal/register", {fullName: "MUST NOT OVERWRITE", whatsapp: "12345678abc", email: lead.email});
    assert.equal(blocked.status, 400);
    assert.deepEqual(await snapshot(), afterValid);
    // Same visitor retries do not create another lead or replace first attribution.
    const retry = await request("/api/portal/register", {fullName: lead.fullName, whatsapp: lead.whatsapp, email: lead.email, campaignId: "different-campaign"});
    assert.equal(retry.status, 200); assert.equal(retry.data.lead.id, lead.id); assert.equal(retry.data.lead.campaignId, campaign.code);
    const retried = await snapshot();
    assert.deepEqual(retried.followup_tasks, afterValid.followup_tasks);
    assert.deepEqual(retried.outbox, afterValid.outbox);
    const emailOnly = await request("/api/portal/register", {fullName: "TEST Email Only", email: "test-email-only@example.invalid"}, true);
    assert.equal(emailOnly.status, 200);
  });
}
