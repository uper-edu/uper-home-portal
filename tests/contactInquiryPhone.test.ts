import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {CONTACT_PHONE_ERROR} from "../src/utils/contactPhone";

if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const {setupNativeTest}=await import("./helpers/mysql.mjs");
  await setupNativeTest("inquiry_phone");
  const {pool,tx}=await import("../server/portal/store.ts");
  const {nativePool}=await import("../cloud/mysql/runtime.mjs");
  const {mountPortal,visitor}=await import("../server/portal/runtime.ts");
  const {mountSite}=await import("../cloud/mysql/site.mjs");
  const {platform}=await import("../server/portal/identity.ts");
  const {leadTier,taskDeadline}=await import("../server/portal/followup.ts");
  const {default:express}=await import("express");
  const app=express();app.use(express.json());await mountPortal(app);
  await mountSite(app,{db:nativePool,platform,visitor,portalTx:tx,leadTier,taskDeadline});
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.on("listening",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  let cookie="";
  async function request(body:any,fresh=false){
    const response=await fetch(base+"/api/inquiry",{method:"POST",headers:{"Content-Type":"application/json",cookie:fresh?"":cookie},body:JSON.stringify(body)});
    const set=response.headers.get("set-cookie");if(set&&!fresh)cookie=set.split(";")[0];
    return {status:response.status,data:await response.json()};
  }
  const tables=["portal_leads","site_submissions","followup_tasks","outbox","conversations","messages","crm_facts"];
  async function snapshot(){const data:Record<string,any>={};for(const table of tables)data[table]=(await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;return data;}
  const input=(phone:unknown)=>({requestId:randomUUID(),fullName:"TEST Inquiry 556",email:"test-inquiry556@example.invalid",phone,interest:"TEST Mandarin inquiry",message:"  TEST exact message\n"});

  await test("Contact Us rejects invalid phones before writes; valid retries preserve customer ownership and attribution",async t=>{
    t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();});
    const before=await snapshot();
    for(const phone of ["abcdefgh","12345678abc","1234+567890","0812_34567890","0812=34567890","++6281234567890","-- --","0812","+9991234567890","+861381234567890","0".repeat(41),"",null,123,{},["081234567890"]]){
      const r=await request(input(phone),true);assert.equal(r.status,400,JSON.stringify(phone));assert.equal(r.data.error,CONTACT_PHONE_ERROR);assert.notEqual(r.data.saved,true);
    }
    assert.deepEqual(await snapshot(),before);
    const body=input("+62 812-3456-7890");const saved=await request(body);
    assert.equal(saved.status,200);assert.equal(saved.data.saved,true);assert.equal(saved.data.emailSent,false);
    const first=await snapshot();assert.equal(first.portal_leads.length,1);assert.equal(first.site_submissions.length,1);assert.equal(first.followup_tasks.length,1);assert.equal(first.outbox.length,1);
    assert.equal(first.portal_leads[0].profile.whatsapp,body.phone);assert.equal(first.site_submissions[0].payload.message,body.message);assert.equal(first.messages[0].content,body.message);
    const repeated=await Promise.all(Array.from({length:10},()=>request(body)));
    assert.ok(repeated.every(r=>r.status===200&&r.data.id===saved.data.id));assert.deepEqual(await snapshot(),first);
    const blocked=await request({...body,phone:"abcdefgh"});assert.equal(blocked.status,400);assert.deepEqual(await snapshot(),first);
    const original={...first.portal_leads[0].profile,owner:"TEST Owner",campaignId:"TEST first campaign",attributionCampaignId:"TEST attributed campaign"};
    await pool.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1",[saved.data.leadId,original]);
    const deadlines=first.followup_tasks;
    const conflictBefore=await snapshot();
    for(const changed of [{phone:'+8613812345678'},{email:'test-other677@example.invalid'},{fullName:'TEST Other 677',email:'test-other677@example.invalid',phone:'+8613812345678'}]) {
      const conflict=await request({...body,...changed,requestId:randomUUID()});assert.equal(conflict.status,409);assert.match(conflict.data.error,/Contact identity changed/);assert.deepEqual(await snapshot(),conflictBefore);
    }
    const second=await request({...body,requestId:randomUUID(),fullName:'TEST Name Corrected',phone:"0062 812-3456-7890",email:' TEST-INQUIRY556@EXAMPLE.INVALID ',message:"TEST second inquiry"});assert.equal(second.status,200);assert.equal(second.data.leadId,saved.data.leadId);
    const after=await snapshot();assert.deepEqual(after.portal_leads[0].profile,original);assert.deepEqual(after.followup_tasks,deadlines);assert.equal(after.site_submissions.length,2);
    // Failed transactions must not leave a partial inquiry, task, message or event.
    const faultKey="TEST_556_FAIL_"+randomUUID().replaceAll("-","");const constraint="test_556_"+randomUUID().replaceAll("-","");
    await nativePool.query(`ALTER TABLE site_submissions ADD CONSTRAINT ${constraint} CHECK (request_id <> '${faultKey}')`);
    try{
      const result=await request({...input("+44 7911 123456"),requestId:faultKey},true);assert.equal(result.status,503);assert.notEqual(result.data.saved,true);assert.deepEqual(await snapshot(),after);
    }finally{await nativePool.query(`ALTER TABLE site_submissions DROP CHECK ${constraint}`);}
    assert.equal((await request(input("0086 138-1234-5678"),true)).status,200);
    assert.equal((await request(input("081234567890"),true)).status,200);
    // Explicitly choosing another person isolates the new inquiry from A and preserves A's task.
    const reset=await fetch(base+'/api/portal/new-person',{method:'POST',headers:{cookie}});assert.equal(reset.status,200);
    cookie='';
    const other={...body,requestId:randomUUID(),fullName:'TEST Other 677',phone:'+8613812345678',email:'test-other677@example.invalid',message:'TEST new visitor inquiry'};
    const newPerson=await request(other);assert.equal(newPerson.status,200);assert.notEqual(newPerson.data.leadId,saved.data.leadId);
    const repeats=await Promise.all(Array.from({length:10},()=>request(other)));assert.ok(repeats.every(r=>r.data.id===newPerson.data.id));
    const final=await snapshot();assert.deepEqual(final.portal_leads.find(l=>l.id===saved.data.leadId)?.profile,original);assert.deepEqual(final.followup_tasks.filter(t=>t.lead_id===saved.data.leadId),deadlines);
    assert.equal(final.site_submissions.filter(s=>s.lead_id===newPerson.data.leadId).length,1);assert.equal(final.followup_tasks.filter(t=>t.lead_id===newPerson.data.leadId).length,1);
    assert.equal(final.portal_leads.find(l=>l.id===newPerson.data.leadId)?.profile.email,other.email);
  });
}
