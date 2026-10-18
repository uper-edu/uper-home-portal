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
  await test('v9 migration only backfills unknown lead sources and preserves original profiles',async()=>{
    const {openTrialDatabase}=await import('../cloud/mysql/database.mjs');const {migrate}=await import('../cloud/mysql/migrate.mjs');const db=await openTrialDatabase(process.env);
    try{const [before]=await db.query('SELECT id,profile FROM portal_leads ORDER BY id');await db.query('DROP TABLE campaign_source_reviews');await db.query('DELETE FROM trial_schema_versions WHERE version=10');await migrate(db,fixture.name);const [after]=await db.query('SELECT id,profile FROM portal_leads ORDER BY id');assert.deepEqual(after,before);const [reviews]=await db.query('SELECT raw_code FROM campaign_source_reviews');assert.ok(reviews.some((r:any)=>r.raw_code.toLowerCase()==='typo'));assert.ok(!reviews.some((r:any)=>r.raw_code==='existing'));assert.equal((await migrate(db,fixture.name)).version,10);}finally{await db.end();}
  });
  await pool.end();
} else
  test(
    "MySQL source review scenarios require independent native fixture",
    { skip: true },
    () => {},
  );
