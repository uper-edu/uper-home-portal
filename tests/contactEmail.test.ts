import {test} from "node:test";
import assert from "node:assert/strict";
import {validContactEmail, contactEmailText, CONTACT_EMAIL_ERROR} from "../src/utils/contactEmail";

const valid = ["qa@example.invalid", "first.last+trial@sub.example-domain.com", "  QA+Trial@Example.INVALID  ", "o'hara@example.com", "a_b@example.co.id", "test@xn--fsqu00a.xn--0zwm56d"];
const invalid: unknown[] = ["@example.invalid", "qa@@example.invalid", "qa test@example.invalid", "qa.example.invalid", "qa@", "qa@example", "qa@.example.com", "qa@example..com", ".qa@example.com", "qa.@example.com", "q..a@example.com", "qa@-example.com", "qa@example-.com", "qa@exam_ple.com", "qa@example.com\r\nBcc:other@example.com", "qa\n@example.com", "Name <qa@example.com>", "qa@example.com,other@example.com", "a".repeat(65)+"@example.com", "qa@"+"a".repeat(64)+".com", "a@"+"a".repeat(63)+"."+"b".repeat(63)+"."+"c".repeat(63)+"."+"d".repeat(63)+".com", 123, {}, ["qa@example.com"], false, null];

test("shared email validation accepts normal addresses and rejects malformed complete input", () => {
  for (const value of valid) assert.equal(validContactEmail(value), true, value);
  for (const value of invalid) assert.equal(validContactEmail(value), false, JSON.stringify(value));
  assert.equal(validContactEmail(""), false);
  assert.equal(validContactEmail("", false), true);
  assert.equal(validContactEmail("   ", false), true);
  // Exact 254-character boundary, with a 64-character local part and valid labels.
  const boundary = "a".repeat(64)+"@"+"b".repeat(63)+"."+"c".repeat(63)+"."+"d".repeat(57)+".com";
  assert.equal(boundary.length, 254);
  assert.equal(validContactEmail(boundary), true);
  assert.equal(validContactEmail(boundary.replace(".com", "d.com")), false);
  for (const lang of ["en", "id", "zh"]) {assert.ok(contactEmailText(lang).help); assert.ok(contactEmailText(lang).error);}
});

if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const {setupNativeTest} = await import("./helpers/mysql.mjs");
  await setupNativeTest("contact_email");
  const {pool} = await import("../server/portal/store.ts");
  const {mountPortal} = await import("../server/portal/runtime.ts");
  const {default: express} = await import("express");
  const app = express(); app.use(express.json()); await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = "";
  async function request(path: string, body: any, fresh = false) {
    const response = await fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json",cookie:fresh?"":cookie},body:JSON.stringify(body)});
    const set = response.headers.get("set-cookie"); if(set&&!fresh)cookie=set.split(";")[0];
    return {status:response.status,data:await response.json()};
  }
  async function snapshot() {
    const state: Record<string, unknown> = {};
    for(const table of ["portal_leads","identity_candidates","followup_tasks","outbox","crm_facts"])state[table]=(await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
    return state;
  }
  await test("all registration aliases reject invalid email before writes and retain valid attribution", async t => {
    t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();});
    const before=await snapshot();
    for(const path of ["/api/portal/register","/api/chatbot-inquiry","/api/standalone-chat-lead"]){
      for(const email of invalid){
        const result=await request(path,{fullName:"TEST invalid email",whatsapp:"+6281234567890",email},true);
        assert.equal(result.status,400,path+" "+JSON.stringify(email)); assert.equal(result.data.error,CONTACT_EMAIL_ERROR);
      }
    }
    assert.deepEqual(await snapshot(),before);
    const campaign={id:"TEST-email-campaign",code:"TEST-email-campaign",name:"TEST Email Validation",stats:{}};
    await pool.query("INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)",[campaign.id,campaign.code,campaign]);
    const created=await request("/api/portal/register",{fullName:"TEST Email Learner",whatsapp:"+6281234567890",email:"  QA+Trial@Sub.Example-Domain.INVALID  ",campaignId:campaign.code});
    assert.equal(created.status,200);const lead=created.data.lead;
    assert.equal(lead.email,"qa+trial@sub.example-domain.invalid");assert.equal(lead.campaignId,campaign.code);
    const stored=await snapshot();
    const blocked=await request("/api/portal/register",{fullName:"MUST NOT OVERWRITE",whatsapp:lead.whatsapp,email:"qa@@example.invalid"});
    assert.equal(blocked.status,400);assert.deepEqual(await snapshot(),stored);
    const retry=await request("/api/portal/register",{fullName:lead.fullName,whatsapp:lead.whatsapp,email:lead.email,campaignId:"different-campaign"});
    assert.equal(retry.status,200);assert.equal(retry.data.lead.id,lead.id);assert.equal(retry.data.lead.campaignId,campaign.code);
    const retried=await snapshot();assert.deepEqual(retried.followup_tasks,stored.followup_tasks);assert.deepEqual(retried.outbox,stored.outbox);
    assert.equal((await request("/api/portal/register",{fullName:"TEST Phone Only",phone:"+6281234567891"},true)).status,200);
    assert.equal((await request("/api/portal/register",{fullName:"TEST Email Only",email:"test-email-only@example.invalid"},true)).status,200);
  });
}
