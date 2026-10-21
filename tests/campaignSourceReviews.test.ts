import test from "node:test";
import assert from "node:assert/strict";
import { matchesCampaign } from "../src/utils/crmCampaignLink.ts";
test("review status cannot turn invalid or pending attribution into organic or a later matching campaign", () => {
  const c = { id: "a", code: "a", name: "a" };
  assert.equal(
    matchesCampaign({ campaignId: "a", campaignSourceStatus: "pending" }, c),
    false,
  );
  assert.equal(
    matchesCampaign({ campaignId: "a", campaignSourceStatus: "invalid" }, c),
    false,
  );
  assert.equal(
    matchesCampaign(
      {
        campaignId: "typo",
        attributionCampaignId: "a",
        campaignSourceStatus: "linked",
      },
      c,
    ),
    true,
  );
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  const fixture = await setupNativeTest("source_reviews");
  const { pool, tx } = await import("../server/portal/store.ts");
  const {
    recordCampaignSource,
    listCampaignSources,
    reviewCampaignSource,
    sourceKey,
  } = await import("../server/portal/campaignSources.ts");
  const admin: any = {
    id: "Manager",
    active: true,
    permissions: ["crm.read", "crm.write"],
    scope: "all",
    teams: [],
  };
  const campaign = {
    id: "existing",
    code: "existing",
    name: "TEST Existing",
    stats: {},
  };
  await pool.query(
    "INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)",
    [campaign.id, campaign.code, campaign],
  );
  const profile = (id: string, code: string) => ({
    id,
    fullName: "TEST " + id,
    campaignId: code,
    campaign: code,
    owner: "Sales",
    tier: "Hot",
    submittedAt: "2026-10-18T09:00:00Z",
    currentStage: "New",
    quizScore: 28,
  });
  async function register(id: string, code: string) {
    return tx(async (c: any) => {
      const p: any = profile(id, code);
      await recordCampaignSource(c, p);
      await c.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [
        id,
        p,
      ]);
      return p;
    });
  }
  await test("independent MySQL: lead-only sources, link/create/invalid, raw facts preserved and retries atomic", async () => {
    assert.equal((await listCampaignSources(admin)).length, 0);
    await register("known", "existing");
    assert.equal((await listCampaignSources(admin)).length, 0);
    await register("one", "typo");
    await register("two", "TYPO");
    let rows = await listCampaignSources(admin);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].leadCount, 2);
    await assert.rejects(
      reviewCampaignSource(
        sourceKey("typo"),
        {
          action: "link",
          campaignId: "missing",
          reason: "TEST",
          requestId: "request-missing",
          revision: 1,
        },
        admin,
      ),
    );
    let b = {
      action: "link",
      campaignId: "existing",
      reason: "TEST verified original link",
      requestId: "request-link",
      revision: 1,
    };
    const result = await reviewCampaignSource(sourceKey("typo"), b, admin);
    assert.equal(result.affectedLeads, 2);
    for (let i = 0; i < 10; i++)
      assert.deepEqual(
        await reviewCampaignSource(sourceKey("typo"), b, admin),
        result,
      );
    await assert.rejects(
      reviewCampaignSource(
        sourceKey("typo"),
        { ...b, reason: "changed" },
        admin,
      ),
    );
    const p = (
      await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", ["one"])
    ).rows[0].profile;
    for (const k of ["campaignId", "owner", "tier", "quizScore", "submittedAt"])
      assert.equal(p[k], profile("one", "typo")[k]);
    assert.equal(p.attributionCampaignId, "existing");
    assert.equal(matchesCampaign(p, campaign), true);
    const future = await register("three", "typo");
    assert.equal(future.attributionCampaignId, "existing");
    assert.equal(future.campaignId, "typo");
    await register("invalid", "garbage");
    await reviewCampaignSource(
      sourceKey("garbage"),
      {
        action: "invalid",
        reason: "TEST invalid link",
        requestId: "request-invalid",
        revision: 1,
      },
      admin,
    );
    const inv = (
      await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [
        "invalid",
      ])
    ).rows[0].profile;
    assert.equal(inv.campaignId, "garbage");
    assert.equal(inv.campaignSourceStatus, "invalid");
    await register("new", "school-new");
    const created = await reviewCampaignSource(
      sourceKey("school-new"),
      {
        action: "create",
        name: "TEST New School",
        type: "other",
        reason: "TEST omitted activity",
        requestId: "request-create",
        revision: 1,
      },
      admin,
    );
    assert.ok(created.campaignId);
    const cfg = (
      await pool.query("SELECT config FROM trial_campaigns WHERE id=:p1", [
        created.campaignId,
      ])
    ).rows[0].config;
    assert.equal(cfg.status, "planning");
    assert.match(cfg.code, /^camp-/);
    assert.equal(cfg.boundUtm.utm_campaign, cfg.code);
    assert.equal(created.campaignCode, cfg.code);
    assert.equal(created.rawCode, "school-new");
    assert.equal(cfg.stats.impressions, 0);
    const audits = (
      await pool.query(
        "SELECT * FROM portal_audit WHERE action='campaign.source.review'",
      )
    ).rows;
    assert.equal(audits.length, 3);
    assert.equal(
      (await pool.query("SELECT * FROM notification_jobs")).rows.length,
      0,
    );
    await assert.rejects(
      tx(async (c: any) => {
        await recordCampaignSource(c, profile("rollback", "aborted"));
        throw Error("abort");
      }),
    );
    assert.equal(
      (
        await pool.query("SELECT * FROM campaign_source_reviews WHERE id=:p1", [
          sourceKey("aborted"),
        ])
      ).rows.length,
      0,
    );
  });
  await test("verified aliases resolve links, future leads and statistics without rewriting source facts", async () => {
    const { campaignsContext } = await import("../cloud/mysql/campaign-context.mjs");
    const { getCampaignByIdOrCode, trackCampaignImpression, getCurrentCampaigns } = await import("../server/portal/mysqlCampaignStorage.ts");
    const configs = (await pool.query("SELECT config FROM trial_campaigns")).rows.map((r: any) => r.config);
    await campaignsContext.run(configs, async () => {
      assert.equal((await getCampaignByIdOrCode("TYPO"))?.id, "existing");
      const resolved = await getCampaignByIdOrCode("school-new");
      assert.match(resolved?.code!, /^camp-/);
      assert.equal(await getCampaignByIdOrCode("garbage"), undefined);
      const list = await getCurrentCampaigns(admin);
      assert.equal(list.find((c: any) => c.id === "existing").stats.leadsCount, 4);
      assert.equal(list.find((c: any) => c.id === resolved?.id).stats.leadsCount, 1);
    });
    assert.equal(await trackCampaignImpression("TYPO"), true);
    assert.equal((await pool.query("SELECT config FROM trial_campaigns WHERE id='existing'")).rows[0].config.stats.impressions, 1);
    const createdFuture = await register("new-future", "school-new");
    assert.equal(createdFuture.campaignId, "school-new");
    assert.ok(createdFuture.attributionCampaignId);
  });
  await test("stale source review cannot create or redirect a code registered by another writer", async () => {
    await register("stale", "TEST-Stale-Code");
    const pendingBefore = (await pool.query("SELECT * FROM campaign_source_reviews WHERE id=:p1", [sourceKey("TEST-Stale-Code")])).rows[0];
    const known = { id: "stale-target", code: "test-stale-code", name: "TEST Concurrent Registration", stats: { impressions: 7 } };
    await pool.query("INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)", [known.id, known.code, known]);
    const body = { action: "create", name: "TEST Must Not Create", type: "other", reason: "TEST concurrent", requestId: "request-stale-create", revision: 1 };
    for (const b of [body, { ...body, action: "link", campaignId: "existing" }])
      await assert.rejects(reviewCampaignSource(sourceKey("TEST-Stale-Code"), b, admin), (e: any) => e.status === 409 && e.message === "source_code_exists");
    assert.deepEqual((await pool.query("SELECT * FROM campaign_source_reviews WHERE id=:p1", [sourceKey("TEST-Stale-Code")])).rows[0], pendingBefore);
    assert.equal((await pool.query("SELECT * FROM portal_audit WHERE action='campaign.source.review' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.sourceId'))=:p1", [sourceKey("TEST-Stale-Code")])).rows.length, 0);
    const linked = await reviewCampaignSource(sourceKey("TEST-Stale-Code"), { ...body, action: "link", campaignId: known.id, requestId: "request-stale-link" }, admin);
    assert.equal(linked.campaignId, known.id);
    assert.equal(linked.rawCode, "TEST-Stale-Code");
    assert.deepEqual((await pool.query("SELECT config FROM trial_campaigns WHERE id=:p1", [known.id])).rows[0].config, known);
  });
  await test("parallel review retries create one neutral code, preserve the original alias and one audit", async () => {
    await register("parallel", "TEST-Original-2026");
    const b = { action: "create", name: "TEST Original", type: "other", reason: "TEST parallel retry", requestId: "request-parallel-create", revision: 1 };
    const results = await Promise.all(Array.from({ length: 10 }, () => reviewCampaignSource(sourceKey("TEST-Original-2026"), b, admin)));
    results.forEach(r => assert.deepEqual(r, results[0]));
    assert.match(results[0].campaignCode!, /^camp-/);
    assert.equal(results[0].rawCode, "TEST-Original-2026");
    assert.equal((await pool.query("SELECT * FROM trial_campaigns WHERE code=:p1", [results[0].campaignCode])).rows.length, 1);
    const audits = (await pool.query("SELECT data FROM portal_audit WHERE action='campaign.source.review' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p1", [b.requestId])).rows;
    assert.equal(audits.length, 1);
    assert.equal(audits[0].data.rawCode, "TEST-Original-2026");
    const p = (await pool.query("SELECT profile FROM portal_leads WHERE id='parallel'")).rows[0].profile;
    assert.equal(p.campaignId, "TEST-Original-2026");
    for (const k of ["owner", "tier", "quizScore", "submittedAt", "currentStage"])
      assert.equal(p[k], profile("parallel", "TEST-Original-2026")[k]);
  });
  await test("unusable original code is not rewritten; unauthorized review stays pending", async () => {
    const longCode = "z".repeat(192);
    await register("long", longCode);
    const b = { action: "create", name: "TEST Long", type: "other", reason: "TEST", requestId: "request-long-code", revision: 1 };
    await assert.rejects(reviewCampaignSource(sourceKey(longCode), b, admin), (e: any) => e.message === "source_code_invalid");
    assert.equal((await pool.query("SELECT * FROM campaign_source_reviews WHERE id=:p1", [sourceKey(longCode)])).rows[0].status, "pending");
    await register("forbidden", "TEST-No-Permission");
    await assert.rejects(reviewCampaignSource(sourceKey("TEST-No-Permission"), { ...b, requestId: "request-forbidden" }, { id: "OtherSales", permissions: ["crm.read", "crm.write"], scope: "own" }), (e: any) => e.status === 403);
  });
  await test("automatic new campaign codes do not steal a verified source alias", async () => {
    const { allocateCampaignCode } = await import("../server/portal/campaignCodeAllocation.ts");
    await register("alias-reserve", "camp-261020173045");
    await reviewCampaignSource(sourceKey("camp-261020173045"), { action: "link", campaignId: "existing", reason: "TEST alias", requestId: "request-alias-reserve", revision: 1 }, admin);
    assert.equal(await tx((c: any) => allocateCampaignCode(c, "campus_seminar", "offline", new Date("2026-10-20T10:30:45Z"))), "camp-261020173045-2");
  });
  await test('v9 migration only backfills unknown lead sources and preserves original profiles',async()=>{
    const {openTrialDatabase}=await import('../cloud/mysql/database.mjs');const {migrate}=await import('../cloud/mysql/migrate.mjs');const db=await openTrialDatabase(process.env);
    try{const [before]=await db.query('SELECT id,profile FROM portal_leads ORDER BY id');await db.query('DROP TABLE campaign_source_reviews');await db.query('DELETE FROM trial_schema_versions WHERE version=10');await migrate(db,fixture.name);const [after]=await db.query('SELECT id,profile FROM portal_leads ORDER BY id');assert.deepEqual(after,before);const [reviews]=await db.query('SELECT raw_code FROM campaign_source_reviews');assert.ok(reviews.some((r:any)=>r.raw_code.toLowerCase()==='typo'));assert.ok(!reviews.some((r:any)=>r.raw_code==='existing'));assert.equal((await migrate(db,fixture.name)).version,10);}finally{await db.end();}
  });
  await test('source evidence reads only authorized customers, preserves raw parameters and performs no review writes',async()=>{
    await register('evidence-own','TEST-evidence');await register('evidence-other','TEST-evidence');
    const other=profile('evidence-other','TEST-evidence');other.owner='OtherSales';
    await pool.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',['evidence-other',other]);
    for(const [lead,source] of [['evidence-own','instagram'],['evidence-other','PRIVATE_OTHER_SOURCE']]){
      await pool.query("INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES(:p1,:p2,'2030-01-01')",['visitor-'+lead,lead]);
      await pool.query("INSERT INTO conversations(id,visitor_id,lead_id,source,attribution) VALUES(:p1,:p2,:p3,'standalone_chat',:p4)",['conversation-'+lead,'visitor-'+lead,lead,{page:'/chat?c=TEST-evidence&p=unverified-p&utm_source='+source+'&utm_medium=paid_social&token=PRIVATE_TEST_TOKEN'}]);
    }
    const before=(await pool.query('SELECT id,profile FROM portal_leads ORDER BY id')).rows;
    const audits=(await pool.query('SELECT * FROM portal_audit')).rows.length;
    const rows=await listCampaignSources({id:'Sales',active:true,scope:'own',permissions:['crm.read']});
    const row=rows.find((r:any)=>r.rawCode==='TEST-evidence');assert.equal(row.leadCount,1);assert.equal(row.leads[0].id,'evidence-own');assert.equal(row.leads[0].evidence.entries[0].parameters.find((p:any)=>p.key==='utm_source').value,'instagram');assert.doesNotMatch(JSON.stringify(row),/PRIVATE_OTHER_SOURCE|PRIVATE_TEST_TOKEN/);
    assert.deepEqual((await pool.query('SELECT id,profile FROM portal_leads ORDER BY id')).rows,before);assert.equal((await pool.query('SELECT * FROM portal_audit')).rows.length,audits);assert.equal((await pool.query('SELECT * FROM notification_jobs')).rows.length,0);
  });
  await pool.end();
} else
  test(
    "MySQL source review scenarios require independent native fixture",
    { skip: true },
    () => {},
  );
