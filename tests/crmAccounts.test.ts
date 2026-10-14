import { setupNativeTest } from "./helpers/mysql.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("crmAccounts");
  process.env.PLATFORM_MODE = "local";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const { tick } = await import("../server/portal/worker.ts");
  const { defaults } = await import("../server/portal/policy.ts");
  const { initializeLocalAccounts, localDirectory } =
    await import("../server/portal/localAuth.ts");
  const { resolveRecipients } =
    await import("../server/portal/notificationDelivery.ts");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  async function request(
    path: string,
    cookie = "",
    method = "GET",
    body?: any,
    origin: string | null = base,
  ) {
    const r = await fetch(base + path, {
      method,
      headers: {
        cookie,
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
      headers: r.headers,
    };
  }
  async function login(name: string, password = name) {
    return request("/api/crm/auth/login", "", "POST", {
      loginId: name,
      password,
    });
  }
  const cookies: Record<string, string> = {};
  await test("Isolated nine-account authentication, permissions and routing acceptance", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    await t.test(
      "nine accounts persist hashed credentials, exact roles, case-insensitive IDs and safe directory",
      async () => {
        for (const name of [
          "Suki",
          "Robert",
          "Fadhil",
          "Zainul",
          "Wigar",
          "Tester",
          "Fenny",
          "Ethan",
          "Monite",
        ]) {
          const r = await login(name.toLowerCase(), name);
          assert.equal(r.status, 200);
          cookies[name] = r.cookie;
          assert.equal(r.data.employee.id, name);
          assert.equal(
            r.data.employee.scope,
            ["Suki", "Robert", "Tester", "Ethan", "Monite"].includes(name)
              ? "all"
              : "own",
          );
          assert.equal(
            r.data.employee.roles.includes("sales"),
            ["Fadhil", "Zainul", "Wigar", "Tester"].includes(name),
          );
          assert.match(r.headers.get("set-cookie")!, /HttpOnly/);
          assert.match(r.headers.get("set-cookie")!, /SameSite=Strict/);
          assert.ok(!JSON.stringify(r.data).includes("password_hash"));
          assert.equal(
            (await request("/api/crm/auth/me", r.cookie)).status,
            200,
          );
        }
        const rows = (await pool.query("SELECT * FROM crm_users")).rows;
        assert.equal(rows.length, 9);
        assert.ok(
          rows.every(
            (r) =>
              r.password_hash !== r.login_id && r.password_hash.length > 128,
          ),
        );
        const d = await request("/api/portal/employees", cookies.Suki);
        assert.equal(d.data.length, 9);
        assert.equal(
          d.data.filter((e: any) => e.roles.includes("sales")).length,
          4,
        );
        assert.ok(!JSON.stringify(d.data).includes("password"));
      },
    );
    await t.test(
      "different local ports use distinct staff cookies and do not overwrite login sessions",
      async () => {
        const previous = process.env.PORT;
        try {
          process.env.PORT = "4365";
          assert.equal(
            (await request("/api/crm/auth/me", cookies.Suki)).status,
            401,
          );
          const preview = await login("Suki");
          assert.equal(preview.status, 200);
          assert.ok(preview.cookie.startsWith("uper_crm_session_4365="));
          if (previous === undefined) delete process.env.PORT;
          else process.env.PORT = previous;
          assert.equal(
            (await request("/api/crm/auth/me", preview.cookie)).status,
            401,
          );
          assert.equal(
            (await request("/api/crm/auth/me", cookies.Suki)).status,
            200,
          );
        } finally {
          if (previous === undefined) delete process.env.PORT;
          else process.env.PORT = previous;
        }
      },
    );
    await t.test(
      "anonymous, header spoofing and missing/cross-site Origin cannot bypass authentication",
      async () => {
        assert.equal((await request("/api/crm/leads")).status, 401);
        assert.equal(
          (
            await request(
              "/api/crm/auth/login",
              "",
              "POST",
              { loginId: "Suki", password: "Suki" },
              null,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/api/crm/auth/login",
              "",
              "POST",
              { loginId: "Suki", password: "Suki" },
              "https://evil.invalid",
            )
          ).status,
          403,
        );
        const r = await fetch(base + "/api/crm/leads", {
          headers: { "x-employee-id": "Suki", "x-role": "crm_leader" },
        });
        assert.equal(r.status, 401);
      },
    );
    const due = "2030-10-12T02:00:00.000Z";
    await t.test(
      "seed only simulated leads, preserve legacy ownership and initialize without resetting accounts",
      async () => {
        for (const [id, owner] of [
          ["account-a", "Fadhil"],
          ["account-b", "Zainul"],
          ["account-unassigned", null],
          ["account-legacy", "Old Sales"],
        ]) {
          await pool.query(
            "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
            [
              id,
              {
                id,
                fullName: "TEST " + id,
                owner,
                team: "sales",
                tier: "Hot",
                currentStage: "New",
                phone: "00000000",
                entryPoint: "standalone_chat",
                slaDueTime: due,
                followUpLogs: [],
              },
            ],
          );
          await pool.query(
            "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,'new_lead',:p3,:p4)",
            ["task-" + id, id, owner, due],
          );
        }
        await initializeLocalAccounts();
        assert.equal(
          (
            await pool.query(
              "SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.owner')),'null') owner FROM portal_leads WHERE id='account-legacy'",
            )
          ).rows[0].owner,
          "Old Sales",
        );
      },
    );
    await t.test(
      "all CRM Leaders including dual-role Tester see every owner and team",
      async () => {
        await pool.query(
          "UPDATE portal_leads SET profile=JSON_SET(profile,'$.team',CAST('\"other-team\"' AS JSON)) WHERE id='account-legacy'",
        );
        try {
          for (const name of ["Suki", "Robert", "Tester", "Ethan", "Monite"]) {
            const r = await request("/api/crm/leads", cookies[name]);
            assert.equal(r.status, 200);
            assert.equal(r.data.dataScope, "all");
            assert.deepEqual(r.data.leads.map((l: any) => l.id).sort(), [
              "account-a",
              "account-b",
              "account-legacy",
              "account-unassigned",
            ]);
            for (const id of [
              "account-a",
              "account-b",
              "account-legacy",
              "account-unassigned",
            ])
              assert.equal(
                (await request("/api/crm/leads/" + id, cookies[name])).status,
                200,
              );
          }
        } finally {
          await pool.query(
            "UPDATE portal_leads SET profile=JSON_SET(profile,'$.team',CAST('\"sales\"' AS JSON)) WHERE id='account-legacy'",
          );
        }
      },
    );
    await t.test(
      "Sales sees own and unassigned leads; foreign access, export and settings are denied",
      async () => {
        const r = await request("/api/crm/leads", cookies.Fadhil);
        assert.deepEqual(r.data.leads.map((l: any) => l.id).sort(), [
          "account-a",
          "account-unassigned",
        ]);
        assert.equal(
          Number((await request("/api/crm/leads", cookies.Suki)).data.total),
          4,
        );
        for (const suffix of ["", "/conversations", "/tasks"])
          assert.equal(
            (await request("/api/crm/leads/account-b" + suffix, cookies.Fadhil))
              .status,
            404,
          );
        assert.equal(
          (await request("/api/crm/leads/account-unassigned", cookies.Fadhil))
            .status,
          200,
        );
        assert.equal(
          (await request("/api/crm/export", cookies.Fadhil)).status,
          403,
        );
        for (const path of [
          "/api/crm/notification-routing",
          "/api/crm/notification-options",
          "/api/crm/notification-rules",
          "/api/crm/notification-channels",
        ])
          assert.equal((await request(path, cookies.Fadhil)).status, 403);
        assert.equal(
          (await request("/api/crm/policy-config", cookies.Fadhil, "POST", {}))
            .status,
          403,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-a",
              cookies.Fadhil,
              "PATCH",
              { owner: "Fadhil" },
              null,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "assignment restricted to Leader and active Sales; legacy unchanged owner allowed; due dates retained",
      async () => {
        assert.equal(
          (
            await request("/api/crm/leads/account-a", cookies.Fadhil, "PATCH", {
              owner: "Wigar",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request("/api/crm/leads/account-a", cookies.Suki, "PATCH", {
              owner: "Suki",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-legacy",
              cookies.Suki,
              "PATCH",
              { currentStage: "Contacted" },
            )
          ).status,
          200,
        );
        const r = await request(
          "/api/crm/leads/account-b",
          cookies.Robert,
          "PATCH",
          { owner: "Tester" },
        );
        assert.equal(r.status, 200);
        assert.equal(r.data.lead.owner, "Tester");
        assert.equal(r.data.lead.slaDueTime, due);
        const task = (
          await pool.query(
            "SELECT * FROM followup_tasks WHERE lead_id='account-b'",
          )
        ).rows[0];
        assert.equal(task.owner_id, "Tester");
        assert.equal(task.due_at.toISOString(), due);
        assert.equal(
          (await request("/api/crm/leads/account-b", cookies.Zainul)).status,
          404,
        );
        assert.equal(
          (await request("/api/crm/leads/account-b", cookies.Tester)).status,
          200,
        );
      },
    );
    await t.test(
      "follow-up actor cannot impersonate another employee; Lead and task permission match",
      async () => {
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-b/logs",
              cookies.Fadhil,
              "POST",
              { summary: "TEST denied" },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              "/api/crm/tasks/task-account-b/complete",
              cookies.Fadhil,
              "POST",
              {},
            )
          ).status,
          404,
        );
        const r = await request(
          "/api/crm/leads/account-a/logs",
          cookies.Fadhil,
          "POST",
          {
            requestId: "TEST-actor",
            recordKind: "contact",
            connectStatus: "Connected",
            channel: "WhatsApp",
            disposition: "keep",
            completeTaskIds: [],
            summary: "TEST follow-up evidence",
            staffName: "Robert",
          },
        );
        assert.equal(r.status, 200);
        const p = (
          await pool.query(
            "SELECT profile FROM portal_leads WHERE id='account-a'",
          )
        ).rows[0].profile;
        assert.equal(p.followUpLogs.at(-1).staffName, "Fadhil");
      },
    );
    await t.test(
      "global Owner routing and inbox delivery fall back to five Managers; dual-role Tester is not duplicated",
      async () => {
        const directory = await localDirectory();
        const config = {
          ...defaults,
          channels: ["inapp"] as typeof defaults.channels,
        };
        assert.deepEqual(
          resolveRecipients(
            config,
            { team: "sales", owner: "Fadhil" },
            directory,
            "account-a",
          ).ids,
          ["Fadhil"],
        );
        for (const owner of [null, "missing", "Old Sales"])
          assert.deepEqual(
            resolveRecipients(
              config,
              { team: "sales", owner },
              directory,
              "lead",
            ).ids.sort(),
            ["Ethan", "Monite", "Robert", "Suki", "Tester"],
          );
        assert.deepEqual(
          resolveRecipients(
            config,
            { team: "sales", owner: "Tester" },
            directory,
            "lead",
          ).ids,
          ["Tester"],
        );
        await pool.query("UPDATE notification_rules SET enabled=false");
        await pool.query(
          "INSERT INTO notification_rules(id,version,config,enabled) VALUES(:p1,1,:p2,true)",
          ["account-rule", { ...config, event: "conversation.updated" }],
        );
        await pool.query("UPDATE outbox SET processed_at=UTC_TIMESTAMP(6)");
        for (const lead of [
          "account-a",
          "account-unassigned",
          "account-legacy",
          "account-b",
        ])
          await pool.query(
            "INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,'conversation.updated',:p2,'{}')",
            ["event-" + lead, lead],
          );
        for (let i = 0; i < 20; i++) await tick();
        const rows = (
          await pool.query(
            "SELECT o.lead_id,i.employee_id FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id JOIN outbox o ON o.id=j.event_id",
          )
        ).rows;
        for (const [lead, expected] of [
          ["account-a", ["Fadhil"]],
          ["account-b", ["Tester"]],
          [
            "account-unassigned",
            ["Ethan", "Monite", "Robert", "Suki", "Tester"],
          ],
          ["account-legacy", ["Ethan", "Monite", "Robert", "Suki", "Tester"]],
        ] as const)
          assert.deepEqual(
            rows
              .filter((r) => r.lead_id === lead)
              .map((r) => r.employee_id)
              .sort(),
            [...expected],
          );
        assert.ok(
          (await request("/api/crm/leads", cookies.Fadhil)).data.leads.find(
            (l: any) => l.id === "account-a",
          ).attention.unreadCount > 0,
        );
        assert.equal(
          (
            await request(
              "/api/crm/notification-rules/account-rule",
              cookies.Fadhil,
              "POST",
              { config, enabled: false },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/api/crm/notification-rules/account-rule",
              cookies.Suki,
              "POST",
              {
                config: { ...config, event: "conversation.updated" },
                enabled: true,
              },
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "Sales reads unassigned chat/tasks but cannot edit, follow up or finish tasks before claiming",
      async () => {
        for (const suffix of ["/conversations", "/tasks"])
          assert.equal(
            (
              await request(
                "/api/crm/leads/account-unassigned" + suffix,
                cookies.Fadhil,
              )
            ).status,
            200,
          );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-unassigned",
              cookies.Fadhil,
              "PATCH",
              { currentStage: "Contacted" },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-unassigned",
              cookies.Fadhil,
              "PATCH",
              { owner: "Fadhil" },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-unassigned/logs",
              cookies.Fadhil,
              "POST",
              { summary: "TEST cannot follow before claim" },
            )
          ).status,
          404,
        );
        for (const action of ["complete", "activate"])
          assert.equal(
            (
              await request(
                "/api/crm/tasks/task-account-unassigned/" + action,
                cookies.Fadhil,
                "POST",
                {},
              )
            ).status,
            404,
          );
      },
    );
    await t.test(
      "self claim ignores requested target, preserves due dates, routes to claimant; transfer and release denied",
      async () => {
        const r = await request(
          "/api/crm/leads/account-unassigned/claim",
          cookies.Fadhil,
          "POST",
          { owner: "Zainul" },
        );
        assert.equal(r.status, 200);
        assert.equal(r.data.lead.owner, "Fadhil");
        assert.equal(r.data.lead.slaDueTime, due);
        const task = (
          await pool.query(
            "SELECT * FROM followup_tasks WHERE lead_id='account-unassigned'",
          )
        ).rows[0];
        assert.equal(task.owner_id, "Fadhil");
        assert.equal(task.due_at.toISOString(), due);
        for (const owner of ["Zainul", null, ""])
          assert.equal(
            (
              await request(
                "/api/crm/leads/account-unassigned",
                cookies.Fadhil,
                "PATCH",
                { owner },
              )
            ).status,
            403,
          );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-unassigned/claim",
              cookies.Zainul,
              "POST",
              {},
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-unassigned/claim",
              cookies.Fadhil,
              "POST",
              {},
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-unassigned/logs",
              cookies.Fadhil,
              "POST",
              {
                requestId: "TEST-claimed",
                recordKind: "contact",
                connectStatus: "Connected",
                channel: "WhatsApp",
                disposition: "keep",
                completeTaskIds: [],
                summary: "TEST claimed lead follow-up",
              },
            )
          ).status,
          200,
        );
        for (let i = 0; i < 5; i++) await tick();
        assert.equal(
          (await request("/api/crm/leads", cookies.Fadhil)).data.leads.find(
            (l: any) => l.id === "account-unassigned",
          ).attention.latest.source,
          "crm_assignment",
        );
        const event = (
          await pool.query(
            "SELECT id FROM outbox WHERE lead_id='account-unassigned' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.assignmentChanged')),'null')='true' ORDER BY created_at DESC LIMIT 1",
          )
        ).rows[0];
        assert.deepEqual(
          (
            await pool.query(
              "SELECT employee_id FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id WHERE j.event_id=:p1",
              [event.id],
            )
          ).rows.map((r) => r.employee_id),
          ["Fadhil"],
        );
      },
    );
    await t.test(
      "two simultaneous Sales claims produce one owner and one audited claim; shared pool ignores retired team labels",
      async () => {
        for (const [id, team] of [
          ["account-race", "sales"],
          ["account-otherteam", "other-team"],
        ])
          await pool.query(
            "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
            [
              id,
              {
                id,
                fullName: "TEST " + id,
                owner: null,
                team,
                currentStage: "New",
              },
            ],
          );
        assert.equal(
          (await request("/api/crm/leads/account-otherteam", cookies.Fadhil))
            .status,
          200,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-otherteam/claim",
              cookies.Fadhil,
              "POST",
              {},
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/account-race/claim",
              cookies.Suki,
              "POST",
              {},
            )
          ).status,
          403,
        );
        const responses = await Promise.all(
          [cookies.Fadhil, cookies.Zainul].map((cookie) =>
            request("/api/crm/leads/account-race/claim", cookie, "POST", {}),
          ),
        );
        assert.equal(responses.filter((r) => r.status === 200).length, 1);
        assert.ok(
          responses
            .filter((r) => r.status !== 200)
            .every((r) => [404, 409].includes(r.status)),
        );
        const audits = (
          await pool.query(
            "SELECT actor FROM portal_audit WHERE action='lead.claim' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data,'$.id')),'null')='account-race'",
          )
        ).rows;
        assert.equal(audits.length, 1);
        assert.equal(
          (
            await pool.query(
              "SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.owner')),'null') owner FROM portal_leads WHERE id='account-race'",
            )
          ).rows[0].owner,
          audits[0].actor,
        );
      },
    );
    await t.test(
      "inactive Owner falls back; suspended account and changed role take effect on existing sessions",
      async () => {
        await pool.query("UPDATE crm_users SET active=false WHERE id='Wigar'");
        assert.equal(
          (await request("/api/crm/auth/me", cookies.Wigar)).status,
          401,
        );
        assert.equal((await login("Wigar")).status, 401);
        assert.deepEqual(
          resolveRecipients(
            defaults,
            { team: "sales", owner: "Wigar" },
            await localDirectory(),
            "lead",
          ).ids.sort(),
          ["Ethan", "Monite", "Robert", "Suki", "Tester"],
        );
        await pool.query(
          "UPDATE crm_users SET roles='[\"sales\"]' WHERE id='Robert'",
        );
        assert.equal(
          (await request("/api/crm/notification-routing", cookies.Robert))
            .status,
          403,
        );
        await pool.query(
          "UPDATE crm_users SET roles='[\"crm_leader\"]' WHERE id='Robert'",
        );
        await pool.query("UPDATE crm_users SET active=true WHERE id='Wigar'");
      },
    );
    await t.test(
      "self password change verifies current password, invalidates other sessions and survives initialization",
      async () => {
        const other = await login("Fadhil");
        assert.equal(
          (
            await request("/api/crm/auth/password", cookies.Fadhil, "POST", {
              currentPassword: "wrong",
              newPassword: "TestOnlyPassword1",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/api/crm/auth/password", cookies.Fadhil, "POST", {
              currentPassword: "Fadhil",
              newPassword: "TestOnlyPassword1",
            })
          ).status,
          200,
        );
        assert.equal(
          (await request("/api/crm/auth/me", other.cookie)).status,
          401,
        );
        assert.equal(
          (await request("/api/crm/auth/me", cookies.Fadhil)).status,
          200,
        );
        await initializeLocalAccounts();
        assert.equal((await login("Fadhil")).status, 401);
        assert.equal((await login("Fadhil", "TestOnlyPassword1")).status, 200);
        assert.equal(
          (await request("/api/crm/auth/logout", cookies.Fadhil, "POST", {}))
            .status,
          200,
        );
        assert.equal(
          (await request("/api/crm/auth/me", cookies.Fadhil)).status,
          401,
        );
      },
    );
    await t.test(
      "parallel bad logins are capped atomically, reset after window; expired sessions rejected",
      async () => {
        await pool.query("TRUNCATE crm_login_limits");
        const responses = await Promise.all(
          Array.from({ length: 10 }, () => login("unknown", "wrong")),
        );
        assert.equal(responses.filter((r) => r.status === 401).length, 5);
        assert.equal(responses.filter((r) => r.status === 429).length, 5);
        await pool.query(
          "UPDATE crm_login_limits SET window_start=UTC_TIMESTAMP(6)-INTERVAL 16 minute",
        );
        assert.equal((await login("unknown", "wrong")).status, 401);
        await pool.query(
          "UPDATE crm_sessions SET expires_at=UTC_TIMESTAMP(6)-INTERVAL 1 minute WHERE user_id='Wigar'",
        );
        assert.equal(
          (await request("/api/crm/auth/me", cookies.Wigar)).status,
          401,
        );
      },
    );
    await t.test(
      "backup preserves nine accounts, password hashes and legacy ownership",
      async () => {
        const { backup, fingerprints, restore } =
          await import("../cloud/mysql/backup.mjs");
        const target = await fixture.createRestore();
        const file = "/private/tmp/" + fixture.name + ".sql";
        const before = await fingerprints(process.env);
        const saved = await backup(process.env, file);
        await restore(target, file, saved.sha256);
        assert.deepEqual(await fingerprints(target), before);
        await fs.unlink(file);
      },
    );
  });
}
