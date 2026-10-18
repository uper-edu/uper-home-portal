import test from "node:test";
import assert from "node:assert/strict";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  await setupNativeTest("trust_notifications");
  process.env.PLATFORM_MODE = "local";
  const { pool, tx } = await import("../server/portal/store.ts");
  const { initializeLocalAccounts } =
    await import("../server/portal/localAuth.ts");
  await initializeLocalAccounts();
  const { defaults } = await import("../server/portal/policy.ts");
  const { tick } = await import("../server/portal/worker.ts");
  const { taskCommand } = await import("../server/portal/trustWorkflow.ts");
  await test("P0 notifications: reschedule cancels stale version, preserves accepted and held history, and simulates only fresh configured policy", async () => {
    await pool.query(
      "INSERT INTO portal_settings(id,value) VALUES('sla',:p1)",
      [{ ...defaults, hotHours: 3, warmHours: 24, coldHours: 48 }],
    );
    await pool.query(
      "INSERT INTO portal_leads(id,profile) VALUES('trust-worker',:p1)",
      [
        {
          id: "trust-worker",
          fullName: "TEST notification learner",
          owner: "Fadhil",
          tier: "Hot",
          currentStage: "Contacted",
        },
      ],
    );
    await pool.query(
      "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,original_due_at) VALUES('trust-task','trust-worker','follow_up','Fadhil','2099-01-01','2099-01-01')",
    );
    const rule = {
      ...defaults,
      event: "task.rescheduled",
      recipient: "owner",
      group: "TEST_TRUST",
      sources: [],
      tiers: [],
      states: [],
      channels: ["lark"],
      calendarMode: "custom",
      businessOnly: false,
      workHours: false,
      days: [0, 1, 2, 3, 4, 5, 6],
      timezone: "UTC",
      start: "00:00",
      end: "23:59",
      timing: "immediate",
      dedupeMinutes: 0,
      retries: [],
      language: "en",
    };
    await pool.query(
      "INSERT INTO notification_channels(id,config) VALUES('TEST_TRUST',:p1)",
      [
        {
          mode: "simulation",
          groupName: "TEST trust notifications",
          maxPerHour: 1000,
        },
      ],
    );
    await pool.query(
      "INSERT INTO notification_rules(id,version,config,enabled) VALUES('TEST_TRUST',1,:p1,true)",
      [rule],
    );
    await pool.query(
      "INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES('old-trust-event','TEST.old','trust-worker',:p1,UTC_TIMESTAMP(6))",
      [{}],
    );
    for (const state of ["pending", "accepted", "unknown"])
      await pool.query(
        "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES(:p1,'old-trust-event',:p1,1,'lark','TEST_TRUST',:p2,'2000-01-01',:p3)",
        [
          "trust-" + state,
          state,
          {
            rule,
            event: "TEST.old",
            leadId: "trust-worker",
            payload: { taskId: "trust-task" },
          },
        ],
      );
    await pool.query(
      "INSERT INTO notification_migration_holds(kind,id,reason) VALUES('job','trust-unknown','TEST history')",
    );
    const result = await tx((c: any) =>
      taskCommand(
        c,
        "trust-worker",
        "Fadhil",
        {
          requestId: "reschedule-worker",
          command: "reschedule",
          taskId: "trust-task",
          revision: 0,
          reason: "TEST client requested another time",
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        },
        () => true,
      ),
    );
    assert.equal(result.saved, true);
    // Simulate a worker queue snapshot captured before the committed reschedule.
    await pool.query(
      "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES('trust-stale','old-trust-event','stale',1,'lark','TEST_TRUST','pending','1999-01-01',:p1)",
      [
        {
          rule,
          event: "TEST.old",
          leadId: "trust-worker",
          payload: { taskId: "trust-task", taskNoticeVersion: 0 },
        },
      ],
    );
    for (let i = 0; i < 4; i++) await tick();
    const jobs = (
      await pool.query("SELECT id,state,attempts FROM notification_jobs")
    ).rows;
    assert.equal(
      jobs.find((j: any) => j.id === "trust-pending").state,
      "cancelled",
    );
    assert.equal(
      jobs.find((j: any) => j.id === "trust-stale").state,
      "cancelled",
    );
    assert.equal(
      jobs.find((j: any) => j.id === "trust-accepted").state,
      "accepted",
    );
    assert.equal(
      jobs.find((j: any) => j.id === "trust-unknown").state,
      "unknown",
    );
    assert.equal(
      Number(jobs.find((j: any) => j.id === "trust-unknown").attempts),
      0,
    );
    assert.equal(jobs.filter((j: any) => j.state === "simulated").length, 1);
    const t = (
      await pool.query("SELECT * FROM followup_tasks WHERE id='trust-task'")
    ).rows[0];
    assert.equal(t.due_at.toISOString(), "2099-01-01T00:00:00.000Z");
    assert.equal(t.original_due_at.toISOString(), t.due_at.toISOString());
  });
  await pool.end();
}
