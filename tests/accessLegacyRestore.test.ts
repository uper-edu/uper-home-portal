import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setupNativeTest } from "./helpers/mysql.mjs";
import { disposeNativeTest } from "./helpers/disposeNativeTest.mjs";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("access_legacy_restore");
  await test("backups predating access roles still clear sessions and require authorization review", async (t) => {
    const { openTrialDatabase } = await import("../cloud/mysql/database.mjs");
    const { backup, restore } = await import("../cloud/mysql/backup.mjs");
    const source = await openTrialDatabase(process.env),
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "uper-legacy-access-"));
    t.after(async () => {
      try { await source.end(); } finally {
        await disposeNativeTest(fixture, {restore:true});
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
    // Representative pre-access fixture: remove every later table before rolling
    // migration metadata back. Keeping a v12 table while declaring v5 is invalid.
    const postV5Tables = [
      "crm_ai_extractions",
      "campaign_source_reviews",
      "crm_facts",
      "crm_operations",
      "crm_engagements",
      "access_operations",
      "access_handovers",
      "access_roles",
      "access_state",
    ];
    for (const table of postV5Tables) await source.query("DROP TABLE " + table);
    await source.query(
      "ALTER TABLE crm_users DROP COLUMN email_key, DROP COLUMN email, DROP COLUMN access_revision",
    );
    await source.query("ALTER TABLE identity_candidates DROP COLUMN decision,DROP COLUMN decided_by,DROP COLUMN reason,DROP COLUMN decided_at");
    await source.query("ALTER TABLE followup_tasks DROP INDEX task_request,DROP COLUMN revision,DROP COLUMN original_due_at,DROP COLUMN scheduled_at,DROP COLUMN timing_kind,DROP COLUMN request_key,ADD COLUMN open_kind VARCHAR(64) GENERATED ALWAYS AS (CASE WHEN status='open' THEN kind ELSE NULL END) STORED,ADD UNIQUE KEY open_task(lead_id,open_kind)");
    await source.query("DELETE FROM trial_schema_versions WHERE version>=6");
    assert.equal(Number((await source.query("SELECT MAX(version) n FROM trial_schema_versions"))[0][0].n), 5);
    for (const name of postV5Tables) {
      assert.equal((await source.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [name]))[0].length, 0, "Fixture retains a newer table: " + name);
    }

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
    const lead = {id:"TEST-restore-lead",fullName:"TEST original customer",owner:"TEST-legacy",campaignId:"TEST-original-campaign",followUpLogs:[{id:"TEST-original-record",summary:"TEST original history"}]};
    await source.execute("INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)", [lead.id,lead.id,JSON.stringify(lead)]);
    await source.execute("INSERT INTO followup_tasks(id,lead_id,kind,owner_id,status,due_at) VALUES(?,?,'consultation',?,'open',?)", ["TEST-original-task",lead.id,"TEST-legacy","2099-11-01 03:00:00"]);
    await source.execute("INSERT INTO outbox(id,type,lead_id,payload) VALUES(?,?,?,?)", ["TEST-pending-event","task.overdue",lead.id,JSON.stringify({taskId:"TEST-original-task"})]);
    for(const state of ["pending","sending","unknown","accepted"]) await source.execute("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES(?,?,?,1,'inapp',?,?,?,?)", ["TEST-job-"+state,"TEST-pending-event","TEST-rule-"+state,"TEST-legacy",state,"2099-11-01 03:00:00",JSON.stringify({payload:{taskId:"TEST-original-task"}})]);
    const target = await fixture.createRestore(),
      file = path.join(dir, "legacy.sql"),
      saved = await backup(process.env, file);
    await restore(target, file, saved.sha256);
    const db = await openTrialDatabase(target);
    try {
      assert.equal((await db.query("SELECT * FROM crm_sessions"))[0].length, 0);
      assert.deepEqual((await db.query("SELECT profile FROM portal_leads WHERE id=?", [lead.id]))[0][0].profile, lead);
      const task=(await db.query("SELECT * FROM followup_tasks WHERE id='TEST-original-task'"))[0][0];
      assert.equal(task.owner_id,"TEST-legacy");assert.match(task.due_at,/^2099-11-01 03:00:00(?:\.0{1,6})?$/);assert.equal(task.original_due_at,task.due_at);
      const holds=(await db.query("SELECT kind,id FROM notification_migration_holds WHERE reason='security_restore_review'"))[0];
      for(const state of ["pending","sending","unknown"])assert.ok(holds.some(h=>h.kind==='job'&&h.id==='TEST-job-'+state));
      assert.ok(!holds.some(h=>h.kind==='job'&&h.id==='TEST-job-accepted'));
      assert.ok(holds.some(h=>h.kind==='event'&&h.id==='TEST-pending-event'));
      assert.ok(holds.some(h=>h.kind==='task'&&h.id==='TEST-original-task'));
      assert.equal((await db.query("SELECT id FROM notification_inbox"))[0].length,0);
      await assert.rejects(restore(target,file,"0".repeat(64)),/checksum mismatch/);
      await assert.rejects(restore(target,file,saved.sha256),/target must be empty/);

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
} else {
  test('legacy backup restore requires explicitly authorized isolated MySQL', {skip:"MYSQL_NATIVE_TEST_ENV not supplied; no database verification performed"}, () => {});
}
