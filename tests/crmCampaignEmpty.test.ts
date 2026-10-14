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

test("campaign storage stays empty after cleanup and never reintroduces example records", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "uper-campaign-empty-"));
  try {
    const module = path.resolve("server/campaignStorage.ts");
    const tsx = path.resolve("node_modules/tsx/dist/loader.mjs");
    const run = () =>
      spawnSync(
        process.execPath,
        [
          "--import",
          tsx,
          "--input-type=module",
          "-e",
          `import {loadCampaigns} from ${JSON.stringify(module)}; console.log(JSON.stringify(loadCampaigns()));`,
        ],
        { cwd: dir, encoding: "utf8" },
      );
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "[]");
    const file = path.join(dir, "data/campaigns_db.json");
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), []);
    result = run();
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "[]");
    writeFileSync(file, "{}");
    result = run();
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes("must contain an array"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

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

test("campaign statistics use supplied canonical leads, saved assessment evidence and recorded revenue only", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "uper-campaign-stats-"));
  try {
    mkdirSync(path.join(dir, "data"));
    writeFileSync(
      path.join(dir, "data/campaigns_db.json"),
      JSON.stringify([
        {
          id: "test-a",
          code: "test-a",
          name: "TEST",
          nameEn: "TEST",
          stats: { impressions: 0, totalRevenue: 999999, budgetCost: 0 },
        },
      ]),
    );
    const module = path.resolve("server/campaignStorage.ts");
    const tsx = path.resolve("node_modules/tsx/dist/loader.mjs");
    const source = `import {getEnrichedCampaigns} from ${JSON.stringify(module)}; console.log(JSON.stringify(getEnrichedCampaigns([{campaignId:'test-a',tier:'Hot',currentStage:'Enrolled',assessmentProvenance:'server_recomputed_adapted_paper',latestAssessment:{score:30}},{campaignId:'test-a',currentStage:'Trial Booked'},{campaignId:'test-a',currentStage:'Trial Attended',attendanceConfirmed:true},{campaignId:'unrelated',campaign:'TEST',revenue:100}])[0].stats));`;
    const r = spawnSync(
      process.execPath,
      ["--import", tsx, "--input-type=module", "-e", source],
      { cwd: dir, encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
    const stats = JSON.parse(r.stdout);
    assert.equal(stats.leadsCount, 3);
    assert.equal(stats.assessedCount, 1);
    assert.equal(stats.enrolledCount, 1);
    assert.equal(stats.totalRevenue, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
