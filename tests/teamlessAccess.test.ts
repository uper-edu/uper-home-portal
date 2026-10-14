import test from "node:test";
import assert from "node:assert/strict";
import {
  retireTeamGrants,
  builtInRoles,
  projectEmployee,
  permittedRecord,
  canClaimRecord,
  validateRole,
} from "../src/utils/accessControl.ts";
import { resolveRecipients } from "../server/portal/notificationDelivery.ts";
import { defaults } from "../server/portal/policy.ts";
test("Retired team grants cannot expand access; shared claiming is a separate explicit capability", () => {
  const old = {
    ...builtInRoles.sales,
    grants: { "crm.read": "team", "crm.write": "team", "crm.export": "team" },
  } as any;
  const next = retireTeamGrants(old);
  assert.deepEqual(next.grants, {});
  assert.equal(old.grants["crm.read"], "team");
  const sales = projectEmployee(
    { id: "TEST-sales", roles: ["sales"], teams: [], active: true },
    [{ id: "sales", config: builtInRoles.sales, enabled: true }],
  );
  assert.equal(
    canClaimRecord(sales, { owner: null, team: "arbitrary-retired-label" }),
    true,
  );
  assert.equal(canClaimRecord(sales, { owner: "OTHER" }), false);
  assert.equal(permittedRecord(sales, { owner: "OTHER" }, "crm.write"), false);
  assert.equal(permittedRecord(sales, { owner: "OTHER" }, "crm.export"), false);
  assert.throws(() => validateRole(old), /invalid_permission/);
  const manager = projectEmployee(
    { id: "TEST-manager", roles: ["crm_leader"], teams: [], active: true },
    [{ id: "crm_leader", config: builtInRoles.crm_leader, enabled: true }],
  );
  assert.deepEqual(
    resolveRecipients(
      defaults,
      { owner: null, team: "no-members" },
      [manager, sales],
      "TEST",
    ).ids,
    [manager.id],
  );
  assert.deepEqual(
    resolveRecipients(
      defaults,
      { owner: sales.id, team: "no-members" },
      [manager, sales],
      "TEST",
    ).ids,
    [sales.id],
  );
  assert.deepEqual(
    resolveRecipients({ ...defaults, event: "daily.digest" }, {}, [
      manager,
      {
        ...sales,
        permissions: [...sales.permissions, "crm.leader", "notifications.read"],
      },
    ]).ids,
    [manager.id],
  );
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  await setupNativeTest("teamless_migration");
  const { pool } = await import("../server/portal/store.ts");
  const { initializeLocalAccounts } =
    await import("../server/portal/localAuth.ts");
  const { initializeTeamlessAccess } =
    await import("../server/portal/teamlessAccess.ts");
  test("Independent MySQL teamless migration preserves users, ownership, deadlines, policies and history; retries are idempotent", async (t) => {
    t.after(() => pool.end());
    process.env.PLATFORM_MODE = "local";
    await initializeLocalAccounts();
    await pool.query("UPDATE access_roles SET config=:p2 WHERE id=:p1", [
      "sales",
      {
        ...builtInRoles.sales,
        grants: { ...builtInRoles.sales.grants, "crm.claim": "team" },
      },
    ]);
    await pool.query("INSERT INTO access_roles(id,config) VALUES(:p1,:p2)", [
      "test_legacy",
      {
        names: ["Legacy", "Lama", "历史"],
        description: ["", "", ""],
        grants: { "crm.read": "team", "crm.write": "team" },
      },
    ]);
    await pool.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [
      "TEST-preserved",
      {
        id: "TEST-preserved",
        owner: "Fadhil",
        tier: "Hot",
        team: "old",
        original: "原始备注",
        hskScore: 88,
      },
    ]);
    await pool.query(
      "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES('TEST-task','TEST-preserved','followup','Fadhil','2030-01-01 00:00:00')",
    );
    const old = {
      ...defaults,
      teams: ["old"],
      team: "old",
      recipient: "team",
      dedupeMinutes: 47,
      template: "TEST original",
    };
    await pool.query(
      "INSERT INTO notification_rules(id,version,config,enabled) VALUES(:p1,1,:p2,true)",
      ["TEST-filtered", old],
    );
    const simple = { ...defaults, recipient: "supervisor", team: "old" };
    await pool.query(
      "INSERT INTO notification_rules(id,version,config,enabled) VALUES(:p1,1,:p2,true)",
      ["TEST-simple", simple],
    );
    const users = (await pool.query("SELECT * FROM crm_users ORDER BY id"))
      .rows;
    const leads = (await pool.query("SELECT * FROM portal_leads")).rows;
    const tasks = (await pool.query("SELECT * FROM followup_tasks")).rows;
    await initializeTeamlessAccess();
    await initializeTeamlessAccess();
    assert.deepEqual(
      (await pool.query("SELECT * FROM crm_users ORDER BY id")).rows,
      users,
    );
    assert.deepEqual(
      (await pool.query("SELECT * FROM portal_leads")).rows,
      leads,
    );
    assert.deepEqual(
      (await pool.query("SELECT * FROM followup_tasks")).rows,
      tasks,
    );
    const filtered = (
      await pool.query(
        "SELECT * FROM notification_rules WHERE id='TEST-filtered'",
      )
    ).rows[0];
    assert.equal(filtered.version, 2);
    assert.equal(!!filtered.enabled, false);
    assert.equal(filtered.config.requiresRoutingReview, true);
    assert.equal(filtered.config.dedupeMinutes, 47);
    assert.equal(filtered.config.template, "TEST original");
    assert.equal(filtered.config.team, undefined);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT config FROM rule_versions WHERE id='TEST-filtered' AND version=1",
        )
      ).rows[0].config,
      old,
    );
    const current = (
      await pool.query(
        "SELECT * FROM notification_rules WHERE id='TEST-simple'",
      )
    ).rows[0];
    assert.equal(current.config.recipient, "owner");
    assert.equal(!!current.enabled, true);
    assert.equal(current.config.team, undefined);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT config FROM access_roles WHERE id='test_legacy'",
        )
      ).rows[0].config.grants,
      {},
    );
    assert.equal(
      (await pool.query("SELECT config FROM access_roles WHERE id='sales'"))
        .rows[0].config.grants["crm.claim"],
      "all",
    );
    assert.equal(
      (await pool.query("SELECT * FROM notification_jobs")).rows.length,
      0,
    );

    await pool.query(
      "INSERT INTO outbox(id,type,payload,processed_at) VALUES('TEST-old-event','lead.created',:p1,UTC_TIMESTAMP(6))",
      [{}],
    );
    for (const [job, state] of [
      ["TEST-pending", "pending"],
      ["TEST-accepted", "accepted"],
    ])
      await pool.query(
        "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES(:p1,'TEST-old-event',:p1,1,'inapp','Robert',:p2,'2000-01-01',:p3)",
        [job, state, { rule: old, leadId: "TEST-preserved", payload: {} }],
      );
    const accepted = (
      await pool.query(
        "SELECT * FROM notification_jobs WHERE id='TEST-accepted'",
      )
    ).rows[0];
    const { tick } = await import("../server/portal/worker.ts");
    await tick();
    assert.equal(
      (
        await pool.query(
          "SELECT state FROM notification_jobs WHERE id='TEST-pending'",
        )
      ).rows[0].state,
      "cancelled",
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT * FROM notification_jobs WHERE id='TEST-accepted'",
        )
      ).rows[0],
      accepted,
    );
    assert.equal(
      (await pool.query("SELECT * FROM notification_jobs")).rows.length,
      2,
    );
  });
}
