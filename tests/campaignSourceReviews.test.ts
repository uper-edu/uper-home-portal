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
