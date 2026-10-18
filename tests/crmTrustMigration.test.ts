import test from "node:test";
import assert from "node:assert/strict";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  const fixture = await setupNativeTest("trust_upgrade");
  const { openTrialDatabase } = await import("../cloud/mysql/database.mjs");
  const { migrate } = await import("../cloud/mysql/migrate.mjs");
  const db = await openTrialDatabase(process.env);
  await test("P0 MySQL v8→v9: exact business evidence and deadlines retained, no outbox replay, repeatable and interrupted migration fails closed", async () => {
    for (const table of ["crm_facts", "crm_operations", "crm_engagements"])
      await db.query("DROP TABLE " + table);
    await db.query(
      "ALTER TABLE identity_candidates DROP COLUMN decision,DROP COLUMN decided_by,DROP COLUMN reason,DROP COLUMN decided_at",
    );
    await db.query(
      "ALTER TABLE followup_tasks DROP INDEX task_request,DROP COLUMN revision,DROP COLUMN original_due_at,DROP COLUMN scheduled_at,DROP COLUMN timing_kind,DROP COLUMN request_key,ADD COLUMN open_kind VARCHAR(64) GENERATED ALWAYS AS (CASE WHEN status='open' THEN kind ELSE NULL END) STORED,ADD UNIQUE KEY open_task(lead_id,open_kind)",
    );
    await db.query("DELETE FROM trial_schema_versions WHERE version=9");
    const profile = {
      id: "TEST-upgrade",
      owner: "Fadhil",
      tier: "Hot",
      currentStage: "Trial Booked",
      quizScore: 28,
      quizMaxScore: 30,
      followUpLogs: [
        {
          summary: "TEST 人工原文 Catatan original",
          timestamp: "2026-01-01T01:00:00Z",
        },
      ],
    };
    await db.execute(
      "INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)",
      ["TEST-upgrade", "20991231-001", JSON.stringify(profile)],
    );
    await db.execute(
      "INSERT INTO followup_tasks(id,lead_id,kind,status,due_at,details) VALUES('TEST-old-task','TEST-upgrade','follow_up','overdue','2026-01-01 09:10:11.123456','{}')",
    );
    await db.execute(
      "INSERT INTO outbox(id,type,lead_id,payload) VALUES('TEST-history','TEST.old','TEST-upgrade','{}')",
    );
    await db.execute(
      "INSERT INTO portal_settings(id,value) VALUES('TEST-config','{\"keep\":true}')",
    );
    const beforeLead = (await db.query("SELECT * FROM portal_leads"))[0];
    const beforeTask = (
      await db.query(
        "SELECT id,lead_id,kind,status,due_at,details FROM followup_tasks",
      )
    )[0];
    const beforeEvents = (await db.query("SELECT * FROM outbox"))[0];
    assert.equal((await migrate(db, fixture.name)).version, 10);
    assert.deepEqual(
      (await db.query("SELECT * FROM portal_leads"))[0],
      beforeLead,
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT id,lead_id,kind,status,due_at,details FROM followup_tasks",
        )
      )[0],
      beforeTask,
    );
    assert.deepEqual((await db.query("SELECT * FROM outbox"))[0], beforeEvents);
    const task = (
      await db.query("SELECT due_at,original_due_at FROM followup_tasks")
    )[0][0];
    assert.equal(task.due_at, task.original_due_at);
    for (const table of ["crm_facts", "crm_operations", "crm_engagements"])
      assert.equal(
        Number((await db.query("SELECT COUNT(*) n FROM " + table))[0][0].n),
        0,
      );
    assert.equal((await migrate(db, fixture.name)).alreadyApplied, true);
    await db.query(
      "UPDATE trial_schema_versions SET state='applying' WHERE version=9",
    );
    await assert.rejects(migrate(db, fixture.name), /Incomplete CRM/);
    await db.query(
      "UPDATE trial_schema_versions SET state='ready' WHERE version=9",
    );
  });
  await db.end();
}
