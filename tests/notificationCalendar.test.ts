import { setupNativeTest } from "./helpers/mysql.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  defaults,
  withCalendarMode,
  resolveCalendar,
  globalWorkCalendar,
  schedule,
  validate,
} from "../server/portal/policy.ts";
import { channelConnection } from "../server/portal/notificationDelivery.ts";
const globalCalendar = {
  timezone: "Asia/Shanghai",
  days: [1, 2, 3, 4, 5],
  start: "10:00",
  end: "17:00",
};
test("calendar inheritance and legacy custom compatibility", () => {
  assert.equal(defaults.calendarMode, "inherit");
  assert.equal(
    withCalendarMode({ ...defaults, calendarMode: undefined }).calendarMode,
    "inherit",
  );
  assert.equal(
    withCalendarMode({ ...defaults, calendarMode: undefined, start: "08:00" })
      .calendarMode,
    "custom",
  );
  const inherited = resolveCalendar(defaults, globalCalendar);
  assert.equal(
    schedule(new Date("2026-10-11T01:00:00Z"), inherited, "lark").toISOString(),
    "2026-10-12T02:00:00.000Z",
  );
  assert.equal(
    schedule(new Date("2026-10-12T09:00:00Z"), inherited, "lark").toISOString(),
    "2026-10-13T02:00:00.000Z",
  );
  assert.equal(
    schedule(
      new Date("2026-10-11T01:00:00Z"),
      inherited,
      "inapp",
    ).toISOString(),
    "2026-10-11T01:00:00.000Z",
  );
  assert.equal(
    resolveCalendar({ ...defaults, calendarMode: "custom" }, globalCalendar)
      .timezone,
    "Asia/Jakarta",
  );
  assert.equal(globalWorkCalendar({ timezone: "invalid" }).source, "fallback");
  assert.throws(() => validate({ ...defaults, calendarMode: "bad" as any }));
});
test("connection labels distinguish simulation, credential absence, test restrictions and configured status without secrets", () => {
  process.env.PLATFORM_MODE = "mock";
  delete process.env.CALENDAR_FIXTURE_WEBHOOK;
  delete process.env.LARK_TEST_GROUP;
  const config = { mode: "live", secretRef: "CALENDAR_FIXTURE_WEBHOOK" };
  assert.equal(
    channelConnection("qa", { ...config, mode: "simulation" }).status,
    "simulation",
  );
  assert.equal(channelConnection("qa", config).status, "missing_webhook");
  process.env.CALENDAR_FIXTURE_WEBHOOK =
    "https://open.larksuite.com/open-apis/bot/v2/hook/never-send-calendar-fixture";
  try {
    assert.equal(
      channelConnection("qa", {
        ...config,
        signingSecretRef: "CALENDAR_MISSING_SIGN",
      }).status,
      "missing_signing_secret",
    );
    assert.equal(channelConnection("qa", config).status, "test_group_blocked");
    process.env.LARK_TEST_GROUP = "qa";
    const state = channelConnection("qa", config);
    assert.equal(state.status, "configured");
    assert.equal(state.realReceiptVerified, false);
    assert.ok(!JSON.stringify(state).includes("never-send-calendar-fixture"));
  } finally {
    delete process.env.CALENDAR_FIXTURE_WEBHOOK;
    delete process.env.LARK_TEST_GROUP;
  }
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("notificationCalendar");
  process.env.PLATFORM_MODE = "mock";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const { tick } = await import("../server/portal/worker.ts");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  async function api(path: string, body?: any) {
    const res = await fetch(base + "/api/crm/" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  }
  await test("MySQL calendar and channel acceptance", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    await t.test(
      "global calendar changes preview and new jobs, custom policies and task deadlines remain unchanged",
      async () => {
        await fixture.reset(
          "notification_channels,rule_versions,notification_rules,notification_jobs,notification_inbox,outbox,portal_leads,followup_tasks",
        );
        await pool.query(
          "INSERT INTO notification_channels(id,config) VALUES(:p1,:p2)",
          [defaults.group, { mode: "simulation", groupName: "TEST calendar" }],
        );
        await pool.query(
          "INSERT INTO portal_leads(id,profile) VALUES('calendar-test-lead',:p1)",
          [
            {
              fullName: "TEST 工作日历客户",
              owner: "test-admin",
              team: "sales",
            },
          ],
        );
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES('calendar-test-task','calendar-test-lead','consultation','2030-01-01 00:00:00')",
        );
        assert.equal(
          (
            await api("policy-config", {
              businessHours: {
                timezone: "Asia/Shanghai",
                startTime: "10:00",
                endTime: "17:00",
                workDays: [1, 2, 3, 4, 5],
              },
            })
          ).status,
          200,
        );
        assert.equal(
          (await api("notification-calendar")).data.timezone,
          "Asia/Shanghai",
        );
        const config = { ...defaults, dedupeMinutes: 0 };
        const preview = await api("notification-simulate", {
          config,
          at: "2026-10-12T09:00:00Z",
        });
        assert.equal(
          preview.data.sendAt.find((x: any) => x.channel === "lark").at,
          "2026-10-13T02:00:00.000Z",
        );
        const custom = await api("notification-simulate", {
          config: { ...config, calendarMode: "custom" },
          at: "2026-10-12T09:00:00Z",
        });
        assert.equal(
          custom.data.sendAt.find((x: any) => x.channel === "lark").at,
          "2026-10-12T09:00:00.000Z",
        );
        await api("notification-rules/calendar-inherit", {
          config,
          enabled: true,
        });
        await pool.query(
          "UPDATE notification_rules SET effective_at='2026-01-01' WHERE id='calendar-inherit'",
        );
        await pool.query(
          "INSERT INTO outbox(id,type,lead_id,payload,created_at) VALUES('calendar-new','lead.created','calendar-test-lead','{}','2026-10-12 09:00:00')",
        );
        await tick(new Date("2026-10-12T09:00:00Z"));
        const job = (
          await pool.query(
            "SELECT * FROM notification_jobs WHERE channel='lark'",
          )
        ).rows[0];
        assert.equal(job.due_at.toISOString(), "2026-10-13T02:00:00.000Z");
        assert.equal(job.snapshot.rule.calendarMode, "inherit");
        assert.equal(
          (
            await pool.query(
              "SELECT due_at FROM followup_tasks WHERE id='calendar-test-task'",
            )
          ).rows[0].due_at.toISOString(),
          "2030-01-01T00:00:00.000Z",
        );
      },
    );
    await t.test(
      "pending inherited jobs recheck updated global hours, old snapshots keep their calendar",
      async () => {
        await api("policy-config", {
          businessHours: {
            timezone: "Asia/Shanghai",
            startTime: "11:00",
            endTime: "17:00",
            workDays: [1, 2, 3, 4, 5],
          },
        });
        await tick(new Date("2026-10-13T02:00:00Z"));
        const job = (
          await pool.query(
            "SELECT * FROM notification_jobs WHERE channel='lark'",
          )
        ).rows[0];
        assert.equal(job.state, "pending");
        assert.equal(job.due_at.toISOString(), "2026-10-13T03:00:00.000Z");
        const old = { ...defaults, calendarMode: undefined, dedupeMinutes: 0 };
        await pool.query(
          "UPDATE notification_jobs SET snapshot=JSON_SET(snapshot,'$.rule',CAST(:p1 AS JSON)),due_at='2026-10-13 02:00:00' WHERE id=:p2",
          [old, job.id],
        );
        await tick(new Date("2026-10-13T02:00:00Z"));
        assert.equal(
          (
            await pool.query(
              "SELECT state FROM notification_jobs WHERE id=:p1",
              [job.id],
            )
          ).rows[0].state,
          "simulated",
        );
      },
    );
    await t.test(
      "daily summary uses global work days and timezone, inapp summary is scheduled by event generation",
      async () => {
        await fixture.reset(
          "notification_channels,rule_versions,notification_rules,notification_jobs,notification_inbox,outbox",
        );
        await api("notification-rules/calendar-digest", {
          config: {
            ...defaults,
            event: "daily.digest",
            channels: ["inapp"],
            timing: "digest",
            digestTime: "18:00",
          },
          enabled: true,
        });
        const preview = await api("notification-simulate", {
          config: {
            ...defaults,
            event: "daily.digest",
            channels: ["inapp"],
            digestTime: "18:00",
          },
          at: "2026-10-12T09:00:00Z",
        });
        assert.equal(preview.data.sendAt[0].at, "2026-10-12T10:00:00.000Z");
        await pool.query(
          "UPDATE notification_rules SET effective_at='2026-01-01'",
        );
        await tick(new Date("2026-10-11T10:00:00Z"));
        assert.equal(
          Number((await pool.query("SELECT count(*) n FROM outbox")).rows[0].n),
          0,
        );
        await tick(new Date("2026-10-12T09:59:00Z"));
        assert.equal(
          Number((await pool.query("SELECT count(*) n FROM outbox")).rows[0].n),
          0,
        );
        await tick(new Date("2026-10-12T10:00:00Z"));
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM outbox WHERE type='daily.digest'",
              )
            ).rows[0].n,
          ),
          1,
        );
      },
    );
    await t.test(
      "channel names and teams persist, state is sanitized, permission and malformed configs rejected",
      async () => {
        const payload = {
          groupName: "CRM Bot（模拟）",
          teamName: "销售团队",
          team: "sales",
          secretRef: "CALENDAR_MISSING_WEBHOOK",
          mode: "simulation",
        };
        assert.equal(
          (await api("notification-channels/calendar-group", payload)).status,
          200,
        );
        const row = (await api("notification-channels")).data.channels.find(
          (x: any) => x.id === "calendar-group",
        );
        assert.equal(row.config.groupName, payload.groupName);
        assert.equal(row.config.teamName, payload.teamName);
        assert.equal(row.connection.status, "simulation");
        assert.equal(
          (
            await api("notification-channels/calendar-bad", {
              ...payload,
              groupName: "",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await api("notification-rules/calendar-bad", {
              config: { ...defaults, calendarMode: "bad" },
            })
          ).status,
          400,
        );
        process.env.MOCK_EMPLOYEE_ID = "test-sales";
        try {
          assert.equal((await api("notification-calendar")).status, 403);
          assert.equal((await api("notification-channels")).status, 403);
        } finally {
          delete process.env.MOCK_EMPLOYEE_ID;
        }
      },
    );
    await t.test(
      "group limit overrides conflicting policy values, legacy minimum is stable, policies retained",
      async () => {
        const { groupRateLimit } =
          await import("../server/portal/notificationDelivery.ts");
        await fixture.reset(
          "notification_channels,rule_versions,notification_rules,notification_jobs,notification_inbox,outbox,portal_leads",
        );
        const configs = [
          {
            ...defaults,
            channels: ["lark"],
            group: "limit-qa",
            businessOnly: false,
            dedupeMinutes: 0,
            maxPerHour: 1,
          },
          {
            ...defaults,
            channels: ["lark"],
            group: "limit-qa",
            businessOnly: false,
            dedupeMinutes: 0,
            maxPerHour: 99,
          },
        ];
        for (let i = 0; i < 2; i++)
          await pool.query(
            "INSERT INTO notification_rules(id,version,config,enabled) VALUES(:p1,1,:p2,false)",
            ["limit-" + i, configs[i]],
          );
        assert.deepEqual(await groupRateLimit(pool, "limit-qa", {}), {
          maxPerHour: 1,
          source: "legacy_strictest",
        });
        assert.equal(
          (
            await api("notification-channels/limit-qa", {
              team: "sales",
              groupName: "TEST 限流群",
              secretRef: "LIMIT_QA_MISSING",
              mode: "simulation",
            })
          ).status,
          200,
        );
        assert.equal(
          (await api("notification-channels")).data.channels.find(
            (r: any) => r.id === "limit-qa",
          ).rateLimit.maxPerHour,
          1,
        );
        const clock = new Date();
        for (let i = 0; i < 2; i++) {
          await pool.query(
            "INSERT INTO outbox(id,type,payload,processed_at) VALUES(:p1,'qa','{}',UTC_TIMESTAMP(6))",
            ["limit-event-" + i],
          );
          await pool.query(
            "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,:p3,1,'lark','limit-qa',:p4,:p5)",
            [
              "limit-job-" + i,
              "limit-event-" + i,
              "limit-" + i,
              new Date(clock.getTime() - 2000 + i),
              {
                rule: configs[i],
                event: "lead.created",
                leadId: "test-" + i,
                payload: {},
              },
            ],
          );
        }
        await tick(clock);
        await tick(clock);
        assert.equal(
          (
            await pool.query(
              "SELECT state FROM notification_jobs WHERE id='limit-job-0'",
            )
          ).rows[0].state,
          "simulated",
        );
        assert.equal(
          (
            await pool.query(
              "SELECT state FROM notification_jobs WHERE id='limit-job-1'",
            )
          ).rows[0].state,
          "pending",
        );
        assert.equal(
          (
            await api("notification-channels/limit-qa", {
              team: "sales",
              groupName: "TEST 限流群",
              secretRef: "LIMIT_QA_MISSING",
              mode: "simulation",
              maxPerHour: 2,
            })
          ).status,
          200,
        );
        await pool.query(
          "UPDATE notification_jobs SET due_at=:p1 WHERE id='limit-job-1'",
          [clock],
        );
        await tick(clock);
        assert.equal(
          (
            await pool.query(
              "SELECT state FROM notification_jobs WHERE id='limit-job-1'",
            )
          ).rows[0].state,
          "simulated",
        );
        assert.deepEqual(
          (
            await pool.query(
              "SELECT config FROM notification_rules ORDER BY id",
            )
          ).rows.map((r: any) => r.config),
          configs,
        );
        assert.equal(
          (
            await api("notification-channels/limit-qa", {
              team: "sales",
              secretRef: "LIMIT_QA_MISSING",
              mode: "simulation",
              maxPerHour: -1,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await api("notification-channels/limit-qa", {
              team: "sales",
              secretRef: "LIMIT_QA_MISSING",
              mode: "simulation",
              maxPerHour: 0,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await groupRateLimit(
              pool,
              "limit-qa",
              (
                await pool.query(
                  "SELECT config FROM notification_channels WHERE id='limit-qa'",
                )
              ).rows[0].config,
            )
          ).maxPerHour,
          0,
        );
      },
    );
    await t.test(
      "simulation needs no connection or team; live/signing validation and legacy links survive renames and mode changes",
      async () => {
        await pool.query(
          "DELETE FROM notification_channels WHERE id IN ('mode-qa','mode-legacy')",
        );
        assert.equal(
          (
            await api("notification-channels/mode-qa", {
              groupName: "TEST Simulation",
              mode: "simulation",
              maxPerHour: 20,
            })
          ).status,
          200,
        );
        let row = (await api("notification-channels")).data.channels.find(
          (r: any) => r.id === "mode-qa",
        );
        assert.equal(row.connection.status, "simulation");
        assert.equal(row.config.secretRef, undefined);
        assert.equal(row.config.team, undefined);
        assert.equal(
          (await api("notification-channels/mode-qa", { mode: "live" })).status,
          400,
        );
        assert.equal(
          (
            await api("notification-channels/mode-qa", {
              mode: "live",
              secretRef: "MODE_QA_MISSING",
              signingEnabled: true,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await api("notification-channels/mode-qa", {
              mode: "live",
              secretRef: "MODE_QA_MISSING",
              signingEnabled: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await api("notification-channels/mode-qa", {
              mode: "simulation",
              secretRef: "https://example.invalid/secret",
            })
          ).status,
          400,
        );
        const legacy = {
          groupName: "Legacy group",
          team: "sales",
          teamName: "Sales legacy",
          mode: "live",
          secretRef: "MODE_QA_WEBHOOK",
          signingSecretRef: "MODE_QA_SIGN",
          maxPerHour: 20,
        };
        await pool.query("INSERT INTO notification_channels VALUES(:p1,:p2)", [
          "mode-legacy",
          legacy,
        ]);
        const rule = { ...defaults, group: "mode-legacy" };
        await pool.query(
          "INSERT INTO notification_rules(id,version,config,enabled) VALUES('mode-linked',1,:p1,false) ON DUPLICATE KEY UPDATE config=:p1",
          [rule],
        );
        assert.equal(
          (
            await api("notification-channels/mode-legacy", {
              groupName: "Renamed label",
              mode: "simulation",
              maxPerHour: 7,
            })
          ).status,
          200,
        );
        row = (await api("notification-channels")).data.channels.find(
          (r: any) => r.id === "mode-legacy",
        );
        assert.equal(row.config.secretRef, legacy.secretRef);
        assert.equal(row.config.signingSecretRef, legacy.signingSecretRef);
        assert.equal(row.config.team, legacy.team);
        assert.equal(row.config.teamName, legacy.teamName);
        assert.equal(Number(row.usage.total), 1);
        assert.deepEqual(
          (
            await pool.query(
              "SELECT config FROM notification_rules WHERE id='mode-linked'",
            )
          ).rows[0].config,
          rule,
        );
        assert.equal(
          (
            await api("notification-channels/mode-legacy", {
              mode: "live",
              signingEnabled: false,
            })
          ).status,
          200,
        );
        const config = (
          await pool.query(
            "SELECT config FROM notification_channels WHERE id='mode-legacy'",
          )
        ).rows[0].config;
        assert.equal(config.signingSecretRef, legacy.signingSecretRef);
        assert.equal(config.signingEnabled, false);
        process.env.MODE_QA_WEBHOOK =
          "https://open.larksuite.com/open-apis/bot/v2/hook/mode-qa-never-send";
        process.env.LARK_TEST_GROUP = "mode-legacy";
        try {
          assert.equal(
            channelConnection("mode-legacy", config).status,
            "configured",
          );
          assert.equal(
            channelConnection("mode-legacy", {
              ...config,
              signingEnabled: true,
            }).status,
            "missing_signing_secret",
          );
        } finally {
          delete process.env.MODE_QA_WEBHOOK;
          delete process.env.LARK_TEST_GROUP;
        }
      },
    );
  });
}
