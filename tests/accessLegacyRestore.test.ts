import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setupNativeTest } from "./helpers/mysql.mjs";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("access_legacy_restore");
  await test("backups predating access roles still clear sessions and require authorization review", async (t) => {
    const { openTrialDatabase } = await import("../cloud/mysql/database.mjs");
    const { backup, restore } = await import("../cloud/mysql/backup.mjs");
    const source = await openTrialDatabase(process.env),
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "uper-legacy-access-"));
    t.after(async () => {
      await source.end();
      await fs.rm(dir, { recursive: true, force: true });
    });
    for (const table of [
      "crm_facts",
      "crm_operations",
      "crm_engagements",
      "access_operations",
      "access_handovers",
      "access_roles",
      "access_state",
    ])
      await source.query("DROP TABLE " + table);
    await source.query(
      "ALTER TABLE crm_users DROP COLUMN email_key, DROP COLUMN email, DROP COLUMN access_revision",
    );
    await source.query("ALTER TABLE identity_candidates DROP COLUMN decision,DROP COLUMN decided_by,DROP COLUMN reason,DROP COLUMN decided_at");
    await source.query("ALTER TABLE followup_tasks DROP INDEX task_request,DROP COLUMN revision,DROP COLUMN original_due_at,DROP COLUMN scheduled_at,DROP COLUMN timing_kind,DROP COLUMN request_key,ADD COLUMN open_kind VARCHAR(64) GENERATED ALWAYS AS (CASE WHEN status='open' THEN kind ELSE NULL END) STORED,ADD UNIQUE KEY open_task(lead_id,open_kind)");
    await source.query("DELETE FROM trial_schema_versions WHERE version>=6");
    await source.execute(
      "INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(?,?,?,?,?,?)",
      [
        "TEST-legacy",
        "TEST-legacy",
        "TEST legacy user",
        "TEST-invalid-hash",
        '["sales"]',
        "[]",
      ],
    );
    await source.execute("INSERT INTO crm_sessions VALUES(?,?,?)", [
      "f".repeat(64),
      "TEST-legacy",
      new Date(Date.now() + 3600000),
    ]);
    const target = await fixture.createRestore(),
      file = path.join(dir, "legacy.sql"),
      saved = await backup(process.env, file);
    await restore(target, file, saved.sha256);
    const db = await openTrialDatabase(target);
    try {
      assert.equal((await db.query("SELECT * FROM crm_sessions"))[0].length, 0);
      assert.equal(
        (
          await db.query(
            "SELECT value FROM access_state WHERE id='restore_review'",
          )
        )[0][0].value.required,
        true,
      );
      assert.equal((await db.query("SELECT * FROM access_roles"))[0].length, 0);
      assert.equal(
        (
          await db.query("SELECT value FROM access_state WHERE id='policy'")
        )[0][0].value.initialized,
        true,
      );
      const u = (await db.query("SELECT * FROM crm_users"))[0][0];
      assert.equal(u.id, "TEST-legacy");
      assert.deepEqual(u.roles, ["sales"]);
      assert.equal(
        (await db.query("SHOW TABLES LIKE 'access_restore_guard_%'"))[0].length,
        0,
      );
    } finally {
      await db.end();
    }
  });
}
