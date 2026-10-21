import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test(
  "native campaign storage remains empty without seeding legacy examples",
  { skip: !process.env.MYSQL_NATIVE_TEST_ENV },
  async () => {
    const { setupNativeTest } = await import("./helpers/mysql.mjs");
    await setupNativeTest("campaignEmpty");
    const { pool } = await import("../server/portal/store.ts");
    const { loadCampaigns, saveCampaign, deleteCampaign } =
      await import("../server/campaignStorage.ts");
    try {
      assert.deepEqual(loadCampaigns(), []);
      assert.equal(
        (await pool.query("SELECT id FROM trial_campaigns")).rows.length,
        0,
      );
      const created = await saveCampaign({name: "TEST empty", savePhase: "basics", requestId: "TEST-empty-create"}, {kind: "create"});
      await deleteCampaign(created.id);
      assert.equal(
        (await pool.query("SELECT id FROM trial_campaigns")).rows.length,
        0,
      );
      assert.deepEqual(loadCampaigns(), []);
    } finally {
      await pool.end();
    }
  },
);

test("campaign links preserve local environment and safely encode the campaign ID", async () => {
  const { campaignChatLink } = await import("../src/utils/crmCampaignLink.ts");
  assert.equal(
    campaignChatLink("test_new", "http://127.0.0.1:4392"),
    "http://127.0.0.1:4392/chat?c=test_new",
  );
  const link = new URL(campaignChatLink("a & b", "https://example.invalid"));
  assert.equal(link.searchParams.get("c"), "a & b");
  assert.equal([...link.searchParams].length, 1);
});

test("registration keeps first marketing attribution and does not grant caller-supplied ownership", async () => {
  const { firstTouchAttribution } =
    await import("../server/portal/attribution.ts");
  assert.deepEqual(
    firstTouchAttribution(
      {},
      {
        campaign: "TEST campaign",
        campaignId: "test-new",
        placement: "qr",
        owner: "Robert",
      },
    ),
    { campaign: "TEST campaign", campaignId: "test-new", placement: "qr" },
  );
  assert.deepEqual(
    firstTouchAttribution(
      { campaign: "first", campaignId: "first-id" },
      { campaign: "later", campaignId: "later-id" },
    ),
    { campaign: "first", campaignId: "first-id" },
  );
});

test("campaign ID wins over a similar campaign name", async () => {
  const { matchesCampaign } = await import("../src/utils/crmCampaignLink.ts");
  const campaign = {
    id: "a",
    code: "test-a",
    name: "TEST Campaign",
    nameEn: "Test Campaign",
  };
  assert.equal(matchesCampaign({ campaignId: "test-a" }, campaign), true);
  assert.equal(
    matchesCampaign(
      { campaignId: "other", campaign: "TEST Campaign" },
      campaign,
    ),
    false,
  );
  assert.equal(matchesCampaign({ campaign: "a" }, campaign), true);
});

test("campaign statistics use saved assessment evidence and recorded revenue only", async () => {
  const { campaignMetrics } =
    await import("../src/utils/crmCampaignMetrics.ts");
  const stats = campaignMetrics(
    [
      {
        campaignId: "test-a",
        tier: "Hot",
        currentStage: "Enrolled",
        assessmentProvenance: "server_recomputed_adapted_paper",
        latestAssessment: { score: 30 },
      },
      { campaignId: "test-a", currentStage: "Trial Booked" },
      {
        campaignId: "test-a",
        currentStage: "Trial Attended",
        attendanceConfirmed: true,
      },
      { campaignId: "unrelated", campaign: "TEST", revenue: 100 },
    ],
    { id: "test-a", code: "test-a", name: "TEST", nameEn: "TEST" },
  );
  assert.equal(stats.leadsCount, 3);
  assert.equal(stats.assessedCount, 1);
  assert.equal(stats.enrolledCount, 1);
  assert.equal(stats.totalRevenue, 0);
});
