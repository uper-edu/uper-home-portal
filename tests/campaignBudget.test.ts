import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {validCampaignBudget, campaignBudgetFromInput, CAMPAIGN_BUDGET_ERROR} from "../src/utils/campaignBudget.ts";

test("budget accepts finite nonnegative amounts without silently coercing empty or malformed values",()=>{
  for(const amount of [null, 0, 0.5, 1200, 3000000]) assert.equal(validCampaignBudget(amount),true);
  for(const amount of [-100,-0.01,NaN,Infinity,-Infinity,"1200","",undefined,true,[],{}]) assert.equal(validCampaignBudget(amount),false);
  for(const value of [""," "]) assert.equal(campaignBudgetFromInput(value),null);
  for(const value of ["-100","-0.01","not a budget","1e999"]) assert.equal(campaignBudgetFromInput(value),undefined);
  for(const [value,expected] of [["0",0],["1250.5",1250.5],["3000000",3000000]] as const) assert.equal(campaignBudgetFromInput(value),expected);
});

if(process.env.MYSQL_NATIVE_TEST_ENV){
  const {setupNativeTest}=await import("./helpers/mysql.mjs");await setupNativeTest("campaign_budget");
  const {createServer}=await import("node:net");
  const lease=createServer();lease.listen(0,"127.0.0.1");await new Promise<void>(r=>lease.on("listening",r));
  const port=(lease.address() as any).port;await new Promise<void>(r=>lease.close(()=>r()));
  Object.assign(process.env,{PORT:String(port),PLATFORM_MODE:"local",APP_URL:`http://127.0.0.1:${port}`});
  const {startMysqlApplication}=await import("../server/mysqlApplication.ts");
  const {pool}=await import("../server/portal/store.ts");
  const {saveCampaign}=await import("../server/portal/mysqlCampaignStorage.ts");
  const {server}=await startMysqlApplication();
  if(!server.listening)await new Promise<void>(r=>server.on("listening",r));
  const base=process.env.APP_URL;let cookie="";
  async function request(path:string,body?:any,method=body===undefined?"GET":"POST",asCookie=cookie){
    const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:base,cookie:asCookie},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const set=r.headers.get("set-cookie");if(set)cookie=set.split(";")[0];
    return {status:r.status,data:await r.json()};
  }
  const input=(stats?:any)=>({name:"TEST Budget campaign",type:"campus_seminar",locationType:"online",requestId:randomUUID(),...(stats===undefined?{}:{stats})});
  async function snapshot(){const data:Record<string,any>={};for(const table of ["trial_campaigns","portal_leads","campaign_source_reviews","followup_tasks","outbox","notification_jobs"])data[table]=(await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;data.saves=(await pool.query("SELECT * FROM portal_audit WHERE action='campaign.save' ORDER BY id")).rows;return data;}

  await test("real campaign HTTP endpoints validate budget and preserve attribution, legacy values and save semantics",async t=>{
    t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
    assert.equal((await request("/api/crm/auth/login",{loginId:"Robert",password:"Robert"})).status,200);
    let created:any;
    await t.test("invalid creates and updates leave campaigns, audits, customers, tasks and notifications unchanged",async()=>{
      const before=await snapshot();
      for(const stats of [{budgetCost:-100},{budgetCost:-0.01},{budgetCost:"123"},{budgetCost:""},{budgetCost:{}},{budgetCost:[]},null,[],"invalid"]){
        const r=await request("/api/crm/campaigns",input(stats));assert.equal(r.status,400,JSON.stringify(stats));assert.equal(r.data.error,CAMPAIGN_BUDGET_ERROR);
      }
      assert.deepEqual(await snapshot(),before);
      created=(await request("/api/crm/campaigns",input({budgetCost:1200}))).data.campaign;
      assert.equal(created.stats.budgetCost,1200);
      const profile={id:"TEST Budget Learner",fullName:"TEST Budget Learner",owner:"Fadhil",campaignId:created.code,attributionCampaignId:created.id,tier:"Hot",quizScore:28};
      await pool.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",[profile.id,profile]);
      const saved=await snapshot();
      for(const value of [-100,-0.01,"2000",{},[]]){
        const r=await request("/api/crm/campaigns/"+created.id,{...created,name:"TEST changed invalid",stats:{budgetCost:value}},"PUT");assert.equal(r.status,400);assert.equal(r.data.error,CAMPAIGN_BUDGET_ERROR);
      }
      assert.deepEqual(await snapshot(),saved);
      for(const value of [NaN,Infinity,-Infinity,undefined]) await assert.rejects(saveCampaign({...created,stats:{budgetCost:value}},{kind:"update",id:created.id}),(e:any)=>e.status===400&&e.message===CAMPAIGN_BUDGET_ERROR);
      assert.deepEqual(await snapshot(),saved);
    });
    await t.test("zero and positive decimals persist; omitted budget and materials saves preserve the saved value",async()=>{
      const before=await snapshot();
      for(const value of [0,1750.5]){
        const saved=await request("/api/crm/campaigns/"+created.id,{...created,stats:{budgetCost:value}},"PUT");assert.equal(saved.status,200);
        const read=await request("/api/crm/campaigns/"+created.id);assert.equal(read.data.campaign.stats.budgetCost,value);assert.equal(read.data.campaign.code,created.code);
      }
      const {stats,...fields}=created;
      for(const data of [{...fields,aiAssets:{socialCopy:"TEST unchanged budget material"}},{...fields,stats:{}}]){
        const r=await request("/api/crm/campaigns/"+created.id,data,"PUT");assert.equal(r.status,200);assert.equal(r.data.campaign.stats.budgetCost,1750.5);
      }
      assert.deepEqual((await snapshot()).portal_leads,before.portal_leads);
      assert.deepEqual((await snapshot()).outbox,before.outbox);
      const b=input();const first=await request("/api/crm/campaigns",b);assert.equal(first.data.campaign.stats.budgetCost,null);
      const count=(await snapshot()).saves.length;
      for(let n=0;n<10;n++)assert.equal((await request("/api/crm/campaigns",b)).data.campaign.id,first.data.campaign.id);
      assert.equal((await snapshot()).saves.length,count);
    });
    await t.test("legacy negative values are not rewritten implicitly; explicit correction is allowed",async()=>{
      const legacy={...created,id:"TEST-legacy-negative",code:"TEST-legacy-negative",stats:{budgetCost:-80,impressions:5,externalMetric:9}};
      await pool.query("INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)",[legacy.id,legacy.code,legacy]);
      const saved=await request("/api/crm/campaigns/"+legacy.id,{name:legacy.name,aiAssets:{socialCopy:"TEST legacy material"}},"PUT");assert.equal(saved.status,200);assert.deepEqual(saved.data.campaign.stats,legacy.stats);
      const fixed=await request("/api/crm/campaigns/"+legacy.id,{name:legacy.name,stats:{budgetCost:0}},"PUT");assert.equal(fixed.status,200);assert.deepEqual(fixed.data.campaign.stats,{...legacy.stats,budgetCost:0});
    });
    await t.test("ordinary sales cannot use campaign mutation permissions",async()=>{
      const managerCookie=cookie;
      assert.equal((await request("/api/crm/auth/login",{loginId:"Fadhil",password:"Fadhil"})).status,200);
      const before=await snapshot();assert.equal((await request("/api/crm/campaigns",input({budgetCost:0}))).status,403);assert.deepEqual(await snapshot(),before);cookie=managerCookie;
    });
  });
}else test("campaign budget API acceptance requires independent MySQL",{skip:"Set MYSQL_NATIVE_TEST_ENV"},()=>{});
