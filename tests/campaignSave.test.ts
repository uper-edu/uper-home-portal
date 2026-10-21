import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  campaignCodeBase,
  resolveCampaignLinks,
} from "../src/utils/campaignCode.ts";
const instant = Date.parse("2026-10-20T10:30:45Z");

test("campaign code contract: neutral prefix across all types and formats, Jakarta date rollover and seconds", () => {
  const types = [
    "campus_seminar",
    "enterprise_roadshow",
    "webinar_class",
    "social_paid_ad",
    "community_referral",
    "education_fair",
    "other",
  ];
  for (let i = 0; i < types.length; i++)
    for (const [medium, letter] of [
      ["offline", "l"],
      ["online", "o"],
      ["hybrid", "h"],
    ])
      assert.equal(
        campaignCodeBase(types[i], medium, new Date(instant)),
        "camp-261020173045",
      );
  assert.equal(
    campaignCodeBase(
      "enterprise_roadshow",
      "online",
      new Date("2026-12-31T17:00:00Z"),
    ),
    "camp-270101000000",
  );
  assert.equal(campaignCodeBase("", "", new Date(instant)), "camp-261020173045");
  assert.deepEqual(
    resolveCampaignLinks(
      { text: "Human notes", nested: ["{{campaign_link}}"] },
      "TEST_LINK",
    ),
    { text: "Human notes", nested: ["TEST_LINK"] },
  );
});

if (!process.env.MYSQL_NATIVE_TEST_ENV) {
  test(
    "campaign save MySQL acceptance requires explicit native socket",
    { skip: "Set MYSQL_NATIVE_TEST_ENV" },
    () => {},
  );
} else {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  await setupNativeTest("campaign_auto");
  process.env.APP_URL = "http://localhost:3000";
  const { pool } = await import("../server/portal/store.ts");
  const { nativePool } = await import("../cloud/mysql/runtime.mjs");
  const { saveCampaign, synthesizeCampaignAiAssets } =
    await import("../server/portal/mysqlCampaignStorage.ts");
  const create = { kind: "create" } as const;
  const update = (id: string) => ({ kind: "update", id }) as const;
  const input = (extra: any = {}) => ({
    name: "TEST campaign",
    type: "campus_seminar",
    locationType: "offline",
    requestId: randomUUID(),
    __actor: "TEST Manager",
    ...extra,
  });
  const read = async (id: string) =>
    (await pool.query("SELECT config FROM trial_campaigns WHERE id=:p1", [id]))
      .rows[0]?.config;
  const rows = async () =>
    (await pool.query("SELECT * FROM trial_campaigns")).rows;
  const saves = async () =>
    (
      await pool.query(
        "SELECT * FROM portal_audit WHERE action='campaign.save'",
      )
    ).rows;
  const error = (status: number, message: string) => (e: any) =>
    e.status === status && e.message === message;
  await test("independent MySQL automatic campaign codes and legacy preservation", async (t) => {
    t.after(() => pool.end());
    t.mock.timers.enable({ apis: ["Date"], now: instant });
    const legacy = {
      id: "legacy-id",
      code: "legacy_original",
      name: "TEST legacy",
      type: "other",
      locationType: "offline",
      createdAt: "2026-01-01T00:00:00.000Z",
      stats: { impressions: 7, budgetCost: 1200, externalMetric: 13 },
      boundUtm: { utm_campaign: "legacy_utm" },
      aiAssets: { socialCopy: "TEST original human text" },
    };
    await pool.query(
      "INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)",
      [legacy.id, legacy.code, legacy],
    );
    let original: any;
    await t.test(
      "server generates the code and binds UTM and draft material links to the committed value",
      async () => {
        const assets = synthesizeCampaignAiAssets({ name: "TEST asset" });
        assert.ok(assets.socialCopy.includes("{{campaign_link}}"));
        assert.ok(!assets.socialCopy.includes("c=undefined"));
        original = await saveCampaign(
          input({
            aiAssets: assets,
            boundUtm: { utm_source: "test", utm_campaign: "untrusted" },
          }),
          create,
        );
        assert.equal(original.code, "camp-261020173045");
        assert.equal(original.boundUtm.utm_campaign, original.code);
        for (const copy of [
          original.aiAssets.socialCopy,
          original.aiAssets.enAssets.whatsappInvitation,
        ]) {
          assert.ok(
            copy.includes("http://localhost:3000/chat?c=" + original.code),
          );
          assert.ok(!copy.includes("{{campaign_link}}"));
        }
      },
    );
    await t.test(
      "manual codes cannot overwrite old activities and are rejected without a success audit",
      async () => {
        const count = (await saves()).length;
        await assert.rejects(
          saveCampaign(
            input({ code: legacy.code, name: "TEST overwrite" }),
            create,
          ),
          error(400, "campaign_code_generated"),
        );
        assert.deepEqual(await read(legacy.id), legacy);
        assert.equal((await saves()).length, count);
      },
    );
    await t.test(
      "legacy edits keep codes, links, creation time, statistics and raw customer attribution",
      async () => {
        const profile = {
          id: "test_campaign_lead",
          fullName: "TEST learner",
          campaignId: legacy.code,
          owner: "TEST Owner",
          quizScore: 28,
          currentStage: "Enrolled",
        };
        await pool.query(
          "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
          [profile.id, profile],
        );
        const saved = (
          await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [
            profile.id,
          ])
        ).rows[0].profile;
        const edited = await saveCampaign(
          {
            ...legacy,
            id: "forged",
            name: "TEST edited",
            type: "enterprise_roadshow",
            locationType: "online",
            boundUtm: { utm_campaign: "attempted_rewrite" },
          },
          update(legacy.id),
        );
        assert.equal(edited.id, legacy.id);
        assert.equal(edited.code, legacy.code);
        assert.equal(edited.createdAt, legacy.createdAt);
        assert.deepEqual(edited.stats, legacy.stats);
        assert.equal(
          edited.boundUtm.utm_campaign,
          legacy.boundUtm.utm_campaign,
        );
        assert.equal(edited.aiAssets.socialCopy, legacy.aiAssets.socialCopy);
        assert.deepEqual(
          (
            await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [
              profile.id,
            ])
          ).rows[0].profile,
          saved,
        );
        assert.equal(await read("forged"), undefined);
      },
    );
    await t.test(
      "missing update target and attempts to change an existing code never select another campaign",
      async () => {
        const before = await read(legacy.id),
          count = (await saves()).length;
        await assert.rejects(
          saveCampaign(
            { name: "TEST wrong", code: legacy.code },
            update("missing"),
          ),
          error(404, "campaign_not_found"),
        );
        await assert.rejects(
          saveCampaign(
            { name: "TEST wrong", code: original.code },
            update(legacy.id),
          ),
          error(400, "campaign_code_readonly"),
        );
        assert.deepEqual(await read(legacy.id), before);
        assert.equal((await saves()).length, count);
      },
    );
    await t.test(
      "same-second creation appends sequential suffixes and preserves previous records",
      async () => {
        const second = await saveCampaign(input(), create);
        assert.equal(second.code, "camp-261020173045-2");
        const count = (await saves()).length;
        const concurrent = await Promise.all(
          Array.from({ length: 5 }, () => saveCampaign(input(), create)),
        );
        assert.deepEqual(
          concurrent.map((c) => c.code).sort(),
          [3, 4, 5, 6, 7].map((n) => "camp-261020173045-" + n),
        );
        assert.deepEqual(await read(original.id), original);
        assert.equal((await saves()).length, count + 5);
        await assert.rejects(
          pool.query(
            "INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)",
            ["different_id", original.code, {}],
          ),
          (e: any) => e.code === "ER_DUP_ENTRY",
        );
      },
    );
    await t.test(
      "concurrent retries of one request return one campaign and one audit",
      async () => {
        const b = input(),
          count = (await saves()).length,
          existing = (await rows()).length;
        const result = await Promise.all(
          Array.from({ length: 10 }, () => saveCampaign({ ...b }, create)),
        );
        for (const c of result) assert.deepEqual(c, result[0]);
        assert.equal((await rows()).length, existing + 1);
        assert.equal((await saves()).length, count + 1);
        await assert.rejects(
          saveCampaign({ ...b, name: "TEST changed retry" }, create),
          error(409, "campaign_request_conflict"),
        );
        assert.deepEqual(await read(result[0].id), result[0]);
      },
    );
    await t.test(
      "creation ignores a forged body ID, and validates request, type and delivery medium",
      async () => {
        const before = await read(legacy.id);
        const c = await saveCampaign(
          input({
            id: legacy.id,
            type: "webinar_class",
            locationType: "hybrid",
          }),
          create,
        );
        assert.match(c.code, /^camp-261020173045-\d+$/);
        assert.notEqual(c.id, legacy.id);
        assert.deepEqual(await read(legacy.id), before);
        assert.ok(!("requestId" in c) && !("__actor" in c));
        await assert.rejects(
          saveCampaign(input({ requestId: undefined }), create),
          error(400, "campaign_request_required"),
        );
        await assert.rejects(
          saveCampaign(input({ type: "" }), create),
          error(400, "campaign_type_required"),
        );
        await assert.rejects(
          saveCampaign(input({ locationType: "" }), create),
          error(400, "campaign_medium_required"),
        );
        await assert.rejects(
          saveCampaign(input(), undefined as any),
          error(400, "Explicit campaign operation required"),
        );
      },
    );
    await t.test(
      "audit failure rolls back the new code; retry creates exactly one record without a notification",
      async () => {
        const b = input({
          name: "TEST rollback",
          requestId: "test-rollback-request",
        });
        const count = (await rows()).length,
          audits = (await saves()).length;
        await nativePool.query(
          "ALTER TABLE portal_audit ADD CONSTRAINT test_campaign_save_rollback CHECK (NOT (action='campaign.save' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))='test-rollback-request'))",
        );
        try {
          await assert.rejects(saveCampaign(b, create));
          assert.equal((await rows()).length, count);
          assert.equal((await saves()).length, audits);
        } finally {
          await nativePool.query(
            "ALTER TABLE portal_audit DROP CHECK test_campaign_save_rollback",
          );
        }
        const c = await saveCampaign(b, create);
        assert.deepEqual(await saveCampaign(b, create), c);
        assert.equal((await rows()).length, count + 1);
        assert.equal(
          (await pool.query("SELECT * FROM notification_jobs")).rows.length,
          0,
        );
      },
    );
    await t.test("saving basics fixes the code on one planning campaign; continuing does not create another or rewrite attribution", async () => {
      const b = input({ type: "social_paid_ad", locationType: "online", savePhase: "basics", status: "active", aiAssets: { socialCopy: "", whatsappInvitation: "" } });
      const count = (await rows()).length;
      const saved = await saveCampaign(b, create);
      assert.match(saved.code, /^camp-261020173045-\d+$/);
      assert.equal(saved.status, "planning");
      for (const key of ["startDate", "endDate", "startTime", "endTime"]) assert.equal(saved[key], "");
      assert.equal(saved.aiAssets.socialCopy, "");
      assert.ok(!("savePhase" in saved));
      for (let n = 0; n < 10; n++) assert.deepEqual(await saveCampaign(b, create), saved);
      assert.equal((await rows()).length, count + 1);
      const assetsOnly = await saveCampaign({ ...saved, aiAssets: { ...saved.aiAssets, socialCopy: "TEST draft material" } }, update(saved.id));
      for (const key of ["startDate", "endDate", "startTime", "endTime"]) assert.equal(assetsOnly[key], "");
      const lead = { id: "TEST-basics-lead", campaignId: saved.code, owner: "TEST Owner", tier: "Hot", quizScore: 28 };
      await pool.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [lead.id, lead]);
      const leadBefore = (await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [lead.id])).rows[0].profile;
      const resumed = await saveCampaign({ ...saved, name: "TEST resumed", type: "education_fair", locationType: "hybrid", startDate: "2026-11-01", endDate: "2026-11-01", startTime: "14:00", endTime: "16:00", boundUtm: { ...saved.boundUtm, utm_source: "test_resumed" }, aiAssets: { ...saved.aiAssets, socialCopy: "TEST saved link " + saved.code } }, update(saved.id));
      assert.equal(resumed.id, saved.id);
      assert.equal(resumed.code, saved.code);
      assert.equal(resumed.createdAt, saved.createdAt);
      assert.deepEqual(resumed.stats, saved.stats);
      assert.equal(resumed.boundUtm.utm_campaign, saved.code);
      assert.equal(resumed.startTime, "14:00");
      assert.equal((await rows()).length, count + 1);
      assert.deepEqual((await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [lead.id])).rows[0].profile, leadBefore);
    });
    await t.test("organic campaign stays read-only", async () => {
      const c = {
        id: "organic",
        code: "organic",
        name: "Organic traffic",
        systemManaged: true,
      };
      await pool.query(
        "INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)",
        [c.id, c.code, c],
      );
      await assert.rejects(
        saveCampaign({ name: "TEST rename", code: "new_code" }, update(c.id)),
        (e: any) => e.status === 403,
      );
      assert.deepEqual(await read(c.id), c);
    });
  });
}
