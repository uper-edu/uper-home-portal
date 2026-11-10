import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteNotificationPolicy } from "../server/portal/notificationPolicyDeletion.ts";
import { notificationGroupPolicyReferences } from "../server/portal/notificationGroupChannels.ts";

test("policy deletion disables future use, keeps the prior version and records the actor once", async () => {
  const id = "daily.digest";
  const previous = { event: id, channels: ["inapp", "lark"], group: "example", digestTime: "18:00" };
  const tombstone = { event: id, deleted: true };
  let row = { version: 4, enabled: true, config: previous as object };
  const savedVersions = new Map();
  const audits: unknown[] = [];
  const db = {
    async query(sql: string, params: any[] = []) {
      if (sql.startsWith("SELECT version")) {
        assert.match(sql, /FOR UPDATE/);
        return { rows: [row] };
      }
      if (sql.startsWith("UPDATE notification_rules")) {
        assert.match(sql, /enabled=false/);
        row = { version: params[1], enabled: false, config: params[2] };
      } else if (sql.startsWith("INSERT INTO rule_versions")) {
        savedVersions.set(params[1], params[2]);
      } else if (sql.startsWith("INSERT INTO portal_audit")) {
        audits.push(params);
      } else {
        assert.fail("Unexpected write to another resource");
      }
      return { rows: [] };
    },
  };

  await assert.rejects(deleteNotificationPolicy(db, id, 3, "admin"), { status: 409 });
  assert.equal(row.enabled, true);
  assert.equal(savedVersions.size, 0);
  assert.deepEqual(audits, []);
  assert.equal(await deleteNotificationPolicy(db, id, 4, "admin"), true);
  assert.deepEqual(row, { version: 5, enabled: false, config: tombstone });
  assert.deepEqual([...savedVersions], [[4, previous], [5, tombstone]]);
  assert.equal(await deleteNotificationPolicy(db, id, 4, "admin"), false);
  assert.deepEqual(audits, [["admin", "rule.delete", { id, version: 5, event: id }]]);
});

test("a deleted policy no longer blocks deletion of its former group channel", async () => {
  const rows = [
    { id: "old", enabled: false, config: { event: "daily.digest", deleted: true } },
    { id: "current", enabled: true, config: { event: "lead.created", channels: ["lark"], group: "sales" } },
  ];
  assert.deepEqual(await notificationGroupPolicyReferences({ query: async () => ({ rows }) }), [
    { channel: "sales", id: "current", enabled: true },
  ]);
});
