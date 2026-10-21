import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationHealth } from "../src/utils/crmNotificationHealth";
test("migration-frozen failures stay auditable without impersonating current channel outages", () => {
  const ready = {
    channels: [
      {
        mode: "live",
        webhookConfigured: true,
        designatedTestGroup: true,
        signingSecretConfigured: true,
      },
    ],
  };
  const jobs = [
    { state: "failed", historicalHold: true },
    { state: "unknown", historicalHold: true },
  ];
  assert.deepEqual(notificationHealth(ready, jobs), { failed: 0, review: 0 });
  assert.equal(jobs[0].state, "failed");
  assert.deepEqual(
    notificationHealth(ready, [
      ...jobs,
      { state: "failed" },
      { state: "unknown" },
    ]),
    { failed: 1, review: 1 },
  );
  assert.deepEqual(
    notificationHealth(
      {
        missingReferences: [{ channel: "missing" }],
        channels: [{ mode: "live", webhookConfigured: false }],
      },
      jobs,
    ),
    { failed: 2, review: 0 },
  );
});
test('disabled missing references are maintenance warnings, not delivery failures',()=>{
 assert.deepEqual(notificationHealth({missingReferences:[{enabled:0},{enabled:false},{enabled:1}]},[{state:'failed'},{state:'unknown'}]),{failed:2,review:1});
});
