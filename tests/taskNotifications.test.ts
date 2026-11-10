import { test } from "node:test";
import assert from "node:assert/strict";
import { CRM_BOT_CHANNEL, defaultRules, TASK_NOTICE_EVENTS } from "../server/portal/policy.ts";

test("new installations omit retired task policies and retain current reminders", () => {
  const events = defaultRules.map(rule => rule.event);
  for (const event of TASK_NOTICE_EVENTS) assert.ok(!events.includes(event), event);
  assert.ok(events.includes("task.overdue"));
  assert.ok(events.includes("commitment.due"));
});

test("the default daily summary uses the initialized CRM Lark channel", () => {
  const digest = defaultRules.find(rule => rule.event === "daily.digest");
  assert.ok(digest);
  assert.deepEqual(digest.channels, ["inapp", "lark_group"]);
  assert.equal(digest.group, CRM_BOT_CHANNEL);
  assert.equal(digest.recipient, "managers");
  assert.equal(digest.requiresRoutingReview, undefined);
});
