import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { defaults } from "../server/portal/policy.ts";
import { resolveRecipients } from "../server/portal/notificationDelivery.ts";
import type { Employee } from "../server/portal/identity.ts";
const leader: Employee = {
  id: "leader-sales",
  roles: ["crm_leader"],
  active: true,
  teams: ["sales"],
  permissions: ["crm.read", "crm.assign"],
  scope: "team",
};
const owner: Employee = {
  id: "owner-sales",
  roles: ["sales"],
  active: true,
  teams: ["sales"],
  permissions: ["crm.read"],
  scope: "own",
};
const admin: Employee = {
  id: "admin-not-leader",
  active: true,
  teams: ["sales"],
  permissions: ["crm.read", "crm.assign"],
  scope: "all",
};
const ops: Employee = {
  id: "leader-ops",
  active: true,
  roles: ["crm_leader"],
  teams: ["ops"],
  permissions: ["crm.read", "crm.assign"],
  scope: "all",
};
const config = { ...defaults, channels: ["inapp"] as typeof defaults.channels };
test("global Owner→CRM Leader routing uses explicit roles, activity, permissions and team data scope", () => {
  const people = [leader, owner, admin, ops];
  const lead = { owner: owner.id, team: "sales" };
  assert.deepEqual(resolveRecipients(config, lead, people, "lead").ids, [
    owner.id,
  ]);
  for (const invalid of [null, "missing", "Sales A"])
    assert.deepEqual(
      resolveRecipients(config, { ...lead, owner: invalid }, people, "lead")
        .ids,
      [leader.id],
    );
  assert.deepEqual(
    resolveRecipients(
      config,
      lead,
      [leader, { ...owner, active: false }],
      "lead",
    ).ids,
    [leader.id],
  );
  assert.deepEqual(
    resolveRecipients(
      config,
      lead,
      [leader, { ...owner, permissions: [] }],
      "lead",
    ).ids,
    [leader.id],
  );
  assert.deepEqual(
    resolveRecipients(config, { team: "sales" }, [admin, ops], "lead"),
    { ids: [], reason: "no_authorized_crm_leader" },
  );
  assert.deepEqual(
    resolveRecipients(
      config,
      { team: "sales" },
      [{ ...leader, scope: "own" }],
      "lead",
    ).ids,
    [],
  );
  assert.deepEqual(
    resolveRecipients(
      config,
      { team: "sales" },
      [{ ...leader, permissions: ["crm.read"] }],
      "lead",
    ).ids,
    [],
  );
  assert.deepEqual(
    resolveRecipients({ ...config, recipient: "team", team: "ops" }, {}, people)
      .ids,
    [ops.id],
  );
  assert.deepEqual(
    resolveRecipients({ ...config, event: "daily.digest" }, {}, people).ids,
    [leader.id, admin.id],
  );
  assert.deepEqual(lead, { owner: owner.id, team: "sales" });
});
if (process.env.NOTIFICATION_ROUTING_TEST_DATABASE_URL) {
  const u = new URL(process.env.NOTIFICATION_ROUTING_TEST_DATABASE_URL);
  if (
    u.hostname !== "127.0.0.1" ||
    u.port !== "5448" ||
    !/^\/uper_calendar_routing_[a-z0-9_]+$/.test(u.pathname)
  )
    throw Error("Isolated routing database required");
  process.env.DATABASE_URL = u.toString();
  process.env.PLATFORM_MODE = "mock";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const { tick } = await import("../server/portal/worker.ts");
  const { platform } = await import("../server/portal/identity.ts");
  const original = platform.employees;
  let people = [leader, owner, admin, ops];
  platform.employees = async () => people;
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  async function api(path: string, body?: any, headers: any = {}) {
    const r = await fetch(base + "/api/crm/" + path, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  }
  await test("PostgreSQL notification routing acceptance", async (t) => {
    t.after(async () => {
      platform.employees = original;
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    async function reset(profile: any = { team: "sales", owner: null }) {
      await pool.query(
        "TRUNCATE notification_rules,rule_versions,notification_jobs,notification_inbox,outbox,portal_leads,portal_audit CASCADE",
      );
      people = [leader, owner, admin, ops];
      await pool.query(
        "INSERT INTO portal_leads(id,profile) VALUES('routing-fixture',$1)",
        [{ fullName: "TEST Routing", ...profile }],
      );
      await pool.query(
        "INSERT INTO notification_rules(id,version,config,enabled) VALUES('routing-policy',1,$1,true)",
        [config],
      );
    }
    async function emit(id: string) {
      await pool.query(
        "INSERT INTO outbox(id,type,lead_id,payload) VALUES($1,'lead.created','routing-fixture','{}')",
        [id],
      );
      await tick();
    }
    await t.test(
      "unassigned/invalid Owner is delivered to leader without modifying profile or policy",
      async () => {
        for (const value of [null, "unknown-owner", owner.id]) {
          await reset({ team: "sales", owner: value });
          const before = (await pool.query("SELECT profile FROM portal_leads"))
            .rows[0].profile;
          await emit("routing-event");
          const row = (
            await pool.query("SELECT employee_id FROM notification_inbox")
          ).rows[0];
          assert.equal(
            row.employee_id,
            value === owner.id ? owner.id : leader.id,
          );
          assert.deepEqual(
            (await pool.query("SELECT profile FROM portal_leads")).rows[0]
              .profile,
            before,
          );
          assert.deepEqual(
            (await pool.query("SELECT config FROM notification_rules")).rows[0]
              .config,
            config,
          );
        }
      },
    );
    await t.test(
      "queued jobs reroute when Owner becomes invalid before sending",
      async () => {
        await reset({ team: "sales", owner: owner.id });
        await pool.query(
          "INSERT INTO outbox(id,type,payload,processed_at) VALUES('routing-queued-event','qa','{}',now())",
        );
        await pool.query(
          "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES('routing-queued','routing-queued-event','routing-policy',1,'inapp',$1,now()-interval '1 day',$2)",
          [
            owner.id,
            {
              rule: config,
              event: "lead.created",
              leadId: "routing-fixture",
              payload: {},
            },
          ],
        );
        people = [leader, { ...owner, active: false }, admin, ops];
        await tick();
        await tick();
        assert.deepEqual(
          (
            await pool.query("SELECT employee_id FROM notification_inbox")
          ).rows.map((r) => r.employee_id),
          [leader.id],
        );
        assert.equal(
          (
            await pool.query(
              "SELECT state FROM notification_jobs WHERE id='routing-queued'",
            )
          ).rows[0].state,
          "cancelled",
        );
      },
    );
    await t.test(
      "missing authorized leader creates audit and operations event; no false delivery",
      async () => {
        await reset();
        people = [admin, ops];
        await emit("routing-unresolved");
        assert.equal(
          (await pool.query("SELECT count(*) n FROM notification_inbox"))
            .rows[0].n,
          "0",
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) n FROM portal_audit WHERE action='notification.routing_unresolved'",
            )
          ).rows[0].n,
          "1",
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) n FROM outbox WHERE type='notification.failed'",
            )
          ).rows[0].n,
          "1",
        );
        await tick();
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) n FROM outbox WHERE type='notification.failed'",
            )
          ).rows[0].n,
          "1",
        );
      },
    );
    await t.test(
      "options preserve legacy filters; global route directory is permission checked and not browser-authored",
      async () => {
        await reset();
        await pool.query(
          "UPDATE notification_rules SET config=jsonb_set(config,'{tiers}','[\"Warm\",\"Hot\"]')",
        );
        const old = (await pool.query("SELECT config FROM notification_rules"))
          .rows[0].config;
        const options = await api("notification-options");
        assert.ok(options.data.tiers.includes("Warm"));
        assert.ok(options.data.tiers.includes("Warm-Offline"));
        assert.ok(options.data.states.includes("Contacted"));
        assert.ok(options.data.sources.includes("homepage_widget"));
        const route = await api("notification-routing");
        assert.deepEqual(
          route.data.leaders.map((x: any) => x.id),
          [leader.id, ops.id],
        );
        assert.deepEqual(
          (await pool.query("SELECT config FROM notification_rules")).rows[0]
            .config,
          old,
        );
        process.env.MOCK_EMPLOYEE_ID = "test-sales";
        try {
          assert.equal((await api("notification-routing")).status, 403);
          assert.equal((await api("notification-options")).status, 403);
        } finally {
          delete process.env.MOCK_EMPLOYEE_ID;
        }
        assert.equal(
          (
            await api("notification-routing", undefined, {
              "x-forwarded-for": "1.2.3.4",
              "x-employee-role": "crm_leader",
            })
          ).status,
          401,
        );
      },
    );
  });
}
