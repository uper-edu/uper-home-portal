import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
if (process.env.CRM_FILTER_TEST_DATABASE_URL) {
  const u = new URL(process.env.CRM_FILTER_TEST_DATABASE_URL);
  if (
    u.hostname !== "127.0.0.1" ||
    u.port !== "5448" ||
    !/^\/uper_filters_test_[a-z0-9_]+$/.test(u.pathname)
  )
    throw Error("Isolated filters test database required");
  process.env.DATABASE_URL = u.toString();
  process.env.PLATFORM_MODE = "local";
  process.env.APP_ENV = "test";
  process.env.PORT = "4376";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  async function request(path: string, cookie = "", body?: any) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { cookie, Origin: base, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  await test("isolated filters: six roles, scoped queries, task completion and data preservation", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    const cookies: Record<string, string> = {};
    for (const name of [
      "Suki",
      "Robert",
      "Tester",
      "Fadhil",
      "Zainul",
      "Wigar",
    ]) {
      const r = await request("/api/crm/auth/login", "", {
        loginId: name,
        password: name,
      });
      assert.equal(r.status, 200);
      cookies[name] = r.cookie;
    }
    const data = [
      ["filter-own", "Fadhil", "Hot"],
      ["filter-other", "Wigar", "Cold-Nurture"],
      ["filter-unassigned", null, "Warm-Online"],
      ["filter-none", "Fadhil", "Hot"],
      ["filter-historical", null, "Unqualified"],
    ];
    for (const [id, owner, tier] of data)
      await pool.query("INSERT INTO portal_leads(id,profile) VALUES($1,$2)", [
        id,
        {
          id,
          fullName: "TEST " + id,
          owner,
          tier,
          team: "sales",
          currentStage: "New",
          mode: "Online",
          email: id + "@example.invalid",
          submittedAt: new Date().toISOString(),
        },
      ]);
    for (const [id, lid, status, offset] of [
      ["filter-task", "filter-own", "open", -1],
      ["filter-task-other", "filter-other", "open", 24],
      ["filter-task-review", "filter-historical", "migration_hold", -500000],
    ])
      await pool.query(
        "INSERT INTO followup_tasks(id,lead_id,kind,status,due_at) VALUES($1,$2,'consultation',$3,now()+($4 * interval '1 hour'))",
        [id, lid, status, offset],
      );
    const snapshot = async () =>
      JSON.stringify(
        (await pool.query("SELECT id,profile FROM portal_leads ORDER BY id"))
          .rows,
      );
    const before = await snapshot();
    await t.test(
      "leader sees all; sales only own and unassigned even with forged owner",
      async () => {
        assert.equal((await request("/api/crm/leads")).status, 401);
        for (const name of ["Suki", "Robert", "Tester"])
          assert.equal(
            (await request("/api/crm/leads", cookies[name])).data.total,
            5,
          );
        assert.equal(
          (await request("/api/crm/leads?ownership=mine", cookies.Fadhil)).data
            .total,
          2,
        );
        assert.equal(
          (await request("/api/crm/leads?ownership=all", cookies.Fadhil)).data
            .total,
          4,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads?ownership=person&owner=Wigar",
              cookies.Fadhil,
            )
          ).data.total,
          0,
        );
        assert.equal(
          (await request("/api/crm/leads?ownership=mine", cookies.Wigar)).data
            .total,
          1,
        );
        assert.equal(
          (await request("/api/crm/leads?ownership=mine", cookies.Zainul)).data
            .total,
          0,
        );
      },
    );
    await t.test(
      "unassigned is explicit; summaries match multi-select result; invalid query rejected",
      async () => {
        assert.equal(
          (await request("/api/crm/leads?ownership=unassigned", cookies.Robert))
            .data.total,
          2,
        );
        assert.equal(
          (await request("/api/crm/leads?owner=", cookies.Robert)).data.total,
          2,
        );
        const r = (
          await request(
            "/api/crm/leads?tier=Hot&tier=Cold-Nurture&mode=Online",
            cookies.Robert,
          )
        ).data;
        assert.equal(r.total, 3);
        assert.equal(r.stats.total, 3);
        assert.equal(r.stats.hot, 2);
        assert.equal(r.stats.overdueSla, 1);
        assert.equal(
          (await request("/api/crm/leads?task=bad", cookies.Robert)).status,
          400,
        );
      },
    );
    await t.test(
      "overdue and today query database deadlines, completion removes task from results",
      async () => {
        const overdue = (
          await request("/api/crm/leads?task=overdue", cookies.Robert)
        ).data;
        assert.equal(overdue.total, 1);
        assert.equal(overdue.leads[0].id, "filter-own");
        await pool.query(
          "UPDATE followup_tasks SET due_at=now() WHERE id='filter-task'",
        );
        assert.equal(
          (await request("/api/crm/leads?task=today", cookies.Robert)).data
            .total,
          1,
        );
        assert.equal(
          (
            await request(
              "/api/crm/tasks/filter-task/complete",
              cookies.Fadhil,
              {},
            )
          ).status,
          200,
        );
        assert.equal(
          (await request("/api/crm/leads?task=overdue", cookies.Robert)).data
            .total,
          0,
        );
        assert.equal(
          (await request("/api/crm/leads?task=today", cookies.Robert)).data
            .total,
          0,
        );
        const historic = (
          await request("/api/crm/leads?situation=historical", cookies.Robert)
        ).data;
        assert.equal(historic.total, 1);
        assert.equal(historic.stats.overdueSla, 0);
      },
    );
    await t.test(
      "unread is employee specific and combines with ownership; query does not change customer records",
      async () => {
        await pool.query(
          "INSERT INTO outbox(id,type,lead_id,payload) VALUES('filter-event','conversation.updated','filter-unassigned','{}')",
        );
        await pool.query(
          "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES('filter-job','filter-event','test',1,'inapp','Robert','accepted',now(),'{}')",
        );
        await pool.query(
          "INSERT INTO notification_inbox(id,employee_id,content) VALUES('filter-job','Robert','{}')",
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads?unread=true&ownership=unassigned",
              cookies.Robert,
            )
          ).data.total,
          1,
        );
        assert.equal(
          (await request("/api/crm/leads?unread=true", cookies.Suki)).data
            .total,
          0,
        );
        assert.equal(await snapshot(), before);
      },
    );
  });
}
