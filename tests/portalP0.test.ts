import { setupNativeTest } from "./helpers/mysql.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { taskDeadline } from "../server/portal/followup.ts";
import { defaults } from "../server/portal/policy.ts";
import {
  calendarSample,
  sla as previewDeadline,
} from "../src/utils/workCalendar.ts";
const settings = { ...defaults, hotHours: 1.5, warmHours: 24, coldHours: 48 };
test("task deadlines use saved tier durations and natural hours with calendar rollover", () => {
  const at = new Date("2026-10-09T12:30:00Z"); // Friday 19:30 Jakarta
  assert.equal(
    taskDeadline(
      { tier: "Hot" },
      "consultation",
      settings,
      at,
    ).due.toISOString(),
    "2026-10-10T02:00:00.000Z",
  );
  assert.equal(
    taskDeadline(
      { tier: "Cold-Nurture" },
      "handoff",
      settings,
      at,
    ).due.toISOString(),
    "2026-10-10T02:00:00.000Z",
  );
  const day = new Date("2026-10-05T02:00:00Z");
  for (const [tier, hours] of [
    ["Hot", 1.5],
    ["Warm-Online", 24],
    ["School", 48],
    ["Cold-Nurture", 48],
    ["Unqualified", 24],
  ] as const)
    assert.equal(
      taskDeadline({ tier }, "consultation", settings, day).due.getTime(),
      day.getTime() + hours * 3600000,
    );
  assert.equal(
    taskDeadline(
      { tier: "Hot" },
      "booking",
      { ...settings, timezone: "Asia/Shanghai" },
      new Date("2026-10-11T15:00:00Z"),
    ).due.toISOString(),
    "2026-10-12T02:30:00.000Z",
  );
});
test("calendar samples and preview honor timezone and configured duration rather than canned deadlines", () => {
  assert.equal(
    calendarSample("2026-10-09", "19:30", "Asia/Jakarta").toISOString(),
    "2026-10-09T12:30:00.000Z",
  );
  assert.equal(
    calendarSample("2026-10-09", "19:30", "Asia/Shanghai").toISOString(),
    "2026-10-09T11:30:00.000Z",
  );
  assert.equal(
    calendarSample("2026-11-02", "09:00", "America/New_York").toISOString(),
    "2026-11-02T14:00:00.000Z",
  );
  const at = calendarSample("2026-10-09", "19:30", "Asia/Jakarta");
  assert.equal(
    previewDeadline(at, 0.25, settings).toISOString(),
    "2026-10-09T12:45:00.000Z",
  );
  assert.equal(
    previewDeadline(at, 0.75, settings).toISOString(),
    "2026-10-10T02:00:00.000Z",
  );
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("portalP0");
  process.env.PLATFORM_MODE = "local";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const { tick } = await import("../server/portal/worker.ts");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  async function request(
    path: string,
    cookie = "",
    body?: any,
    method?: string,
  ) {
    const r = await fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  async function visitor(source = "homepage_widget") {
    const s = await request("/api/portal/session");
    const c = await request("/api/portal/conversations", s.cookie, { source });
    return { cookie: s.cookie, conversationId: c.data.conversationId };
  }
  async function contact(
    v: any,
    goal = "Prepare for HSK certification",
    reportedLevel = "HSK 2",
  ) {
    return request("/api/portal/register", v.cookie, {
      fullName: "TEST P0 client",
      whatsapp: "00000000",
      email: "test-p0@example.invalid",
      goal,
      reportedLevel,
      currentStatus: "University student",
      mode: "Online",
      city: "Other",
    });
  }
  const action = (
    v: any,
    messageId: string,
    content: string,
    kind = "handoff",
  ) =>
    request("/api/portal/actions", v.cookie, {
      conversationId: v.conversationId,
      messageId,
      content,
      action: kind,
      language: "en",
    });
  await test("isolated P0 message, SLA, task and notification lifecycle", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    const login = await request("/api/crm/auth/login", "", {
      loginId: "Robert",
      password: "Robert",
    });
    assert.equal(login.status, 200);
    const staff = login.cookie;
    const config = {
      ...(await request("/api/crm/policy-config", staff)).data,
      businessHours: {
        timezone: "Asia/Jakarta",
        startTime: "00:00",
        endTime: "23:59",
        workDays: [0, 1, 2, 3, 4, 5, 6],
        nextDayGraceTime: "10:00",
      },
      firstResponseSla: {
        hot: { value: 90, unit: "minutes" },
        warm: { value: 1, unit: "days" },
        cold: { value: 48, unit: "hours" },
      },
    };
    await t.test(
      "settings save is atomic and new deadlines follow saved durations; old deadlines are retained",
      async () => {
        assert.equal(
          (await request("/api/crm/policy-config", staff, config)).status,
          200,
        );
        assert.deepEqual(
          (await request("/api/crm/policy-config", staff)).data
            .firstResponseSla,
          config.firstResponseSla,
        );
        for (const [goal, level, tier, hours] of [
          ["Prepare for HSK certification", "HSK 2", "Hot", 1.5],
          ["Prepare for HSK certification", "Not sure", "Warm-Online", 24],
          ["Improve my Mandarin skills", "Not sure", "Cold-Nurture", 48],
        ]) {
          const v = await visitor();
          const before = Date.now();
          const r = await contact(v, goal, level);
          assert.equal(r.status, 200);
          const task = (
            await pool.query(
              "SELECT * FROM followup_tasks WHERE lead_id=:p1 AND kind='consultation'",
              [r.data.lead.id],
            )
          ).rows[0];
          const lead = (
            await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [
              r.data.lead.id,
            ])
          ).rows[0].profile;
          assert.equal(lead.tier, tier);
          assert.ok(
            Math.abs(task.due_at.getTime() - before - Number(hours) * 3600000) <
              5000,
          );
          assert.equal(Date.parse(lead.slaDueTime), task.due_at.getTime());
        }
        const old = (
          await pool.query("SELECT id,due_at FROM followup_tasks ORDER BY id")
        ).rows;
        const newer = {
          ...config,
          firstResponseSla: {
            ...config.firstResponseSla,
            hot: { value: 30, unit: "minutes" },
          },
        };
        assert.equal(
          (await request("/api/crm/policy-config", staff, newer)).status,
          200,
        );
        assert.deepEqual(
          (await pool.query("SELECT id,due_at FROM followup_tasks ORDER BY id"))
            .rows,
          old,
        );
        const v = await visitor();
        const r = await contact(v);
        const due = (
          await pool.query(
            "SELECT due_at FROM followup_tasks WHERE lead_id=:p1",
            [r.data.lead.id],
          )
        ).rows[0].due_at;
        assert.ok(Math.abs(Date.parse(due) - Date.now() - 1800000) < 5000);
        const saved = (
          await pool.query("SELECT id,value FROM portal_settings ORDER BY id")
        ).rows;
        await pool.query(
          "CREATE TRIGGER p0_fail_settings BEFORE INSERT ON portal_audit FOR EACH ROW BEGIN IF NEW.action='sla.save' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST audit failure'; END IF; END",
        );
        try {
          assert.equal(
            (await request("/api/crm/policy-config", staff, config)).status,
            503,
          );
          assert.deepEqual(
            (
              await pool.query(
                "SELECT id,value FROM portal_settings ORDER BY id",
              )
            ).rows,
            saved,
          );
        } finally {
          await pool.query("DROP TRIGGER p0_fail_settings");
        }
      },
    );
    let anon: any, leadId: string, taskId: string;
    await t.test(
      "anonymous human request saves messages; contact registration links and creates one task",
      async () => {
        anon = await visitor();
        const r = await action(
          anon,
          "anon-request",
          "TEST please ask an advisor to contact me",
        );
        assert.equal(r.status, 200);
        assert.equal(r.data.saved, true);
        assert.equal(r.data.status, "contact_required");
        assert.equal(r.data.taskId, null);
        assert.ok(
          !r.data.reply.includes("has joined") ||
            r.data.reply.includes("No live agent has joined"),
        );
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM messages WHERE conversation_id=:p1",
                [anon.conversationId],
              )
            ).rows[0].n,
          ),
          2,
        );
        const registered = await contact(anon);
        leadId = registered.data.lead.id;
        const retry = await action(
          anon,
          "anon-request",
          "TEST please ask an advisor to contact me",
        );
        assert.equal(retry.data.status, "awaiting_advisor");
        taskId = retry.data.taskId;
        assert.ok(taskId);
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM followup_tasks WHERE lead_id=:p1 AND kind='handoff'",
                [leadId],
              )
            ).rows[0].n,
          ),
          1,
        );
        const e = (
          await pool.query(
            "SELECT payload FROM outbox WHERE lead_id=:p1 AND type='handoff.requested'",
            [leadId],
          )
        ).rows[0].payload;
        assert.equal(e.taskId, taskId);
        assert.equal(e.messageId, "anon-request");
        assert.equal(e.sla.hours, 0.5);
      },
    );
    await t.test(
      "ten concurrent retries save once; repeated text with different IDs is retained and shares active task",
      async () => {
        const v = await visitor("standalone_chat");
        await contact(v);
        const all = await Promise.all(
          Array.from({ length: 10 }, () =>
            action(v, "same-key", "TEST repeated text"),
          ),
        );
        assert.ok(all.every((r) => r.status === 200 && r.data.saved));
        assert.equal(new Set(all.map((r) => r.data.taskId)).size, 1);
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM messages WHERE conversation_id=:p1",
                [v.conversationId],
              )
            ).rows[0].n,
          ),
          2,
        );
        await action(v, "second-key", "TEST repeated text");
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM messages WHERE conversation_id=:p1 AND role='user'",
                [v.conversationId],
              )
            ).rows[0].n,
          ),
          2,
        );
        assert.equal(
          (await action(v, "same-key", "TEST different content")).status,
          409,
        );
        assert.equal(
          (await action(v, "same-key", "TEST repeated text", "booking")).status,
          409,
        );
        const foreign = await visitor();
        assert.equal(
          (
            await request("/api/portal/actions", foreign.cookie, {
              conversationId: v.conversationId,
              messageId: "fake",
              content: "TEST forbidden",
              action: "handoff",
            })
          ).status,
          404,
        );
      },
    );
    await t.test(
      "Repeated explicit booking/enrollment requests reuse one active task without moving its deadline",
      async () => {
        for (const kind of ["booking", "enrollment"] as const) {
          const v = await visitor();
          const registered = await contact(v);
          const lid = registered.data.lead.id;
          const first = await action(
            v,
            "first-" + kind,
            "TEST explicit " + kind,
            kind,
          );
          assert.equal(first.status, 200);
          assert.equal(first.data.taskOperation, "created");
          const original = (
            await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
              first.data.taskId,
            ])
          ).rows[0];
          const second = await action(
            v,
            "second-" + kind,
            "TEST supplementary " + kind,
            kind,
          );
          assert.equal(second.status, 200);
          assert.equal(second.data.taskId, first.data.taskId);
          assert.equal(second.data.taskOperation, "supplemented");
          const after = (
            await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
              first.data.taskId,
            ])
          ).rows[0];
          assert.equal(String(after.due_at), String(original.due_at));
          assert.equal(
            String(after.original_due_at),
            String(original.original_due_at),
          );
          assert.equal(
            Number(
              (
                await pool.query(
                  "SELECT count(*) n FROM followup_tasks WHERE lead_id=:p1 AND kind=:p2",
                  [lid, kind],
                )
              ).rows[0].n,
            ),
            1,
          );
          const replay = await action(
            v,
            "first-" + kind,
            "TEST explicit " + kind,
            kind,
          );
          assert.equal(replay.status, 200);
          assert.equal(replay.data.taskId, first.data.taskId);
          assert.equal(replay.data.taskOperation, "created");
          assert.equal(
            Number(
              (
                await pool.query(
                  "SELECT count(*) n FROM messages WHERE conversation_id=:p1",
                  [v.conversationId],
                )
              ).rows[0].n,
            ),
            4,
          );
          const another = await request("/api/portal/conversations", v.cookie, {
            source: "standalone_chat",
          });
          const cross = await action(
            { ...v, conversationId: another.data.conversationId },
            "cross-session-" + kind,
            "TEST repeated across sessions " + kind,
            kind,
          );
          assert.equal(cross.status, 200);
          assert.equal(cross.data.taskId, first.data.taskId);
          assert.equal(cross.data.taskOperation, "supplemented");
          const preserved = (
            await pool.query(
              "SELECT due_at,original_due_at FROM followup_tasks WHERE id=:p1",
              [first.data.taskId],
            )
          ).rows[0];
          assert.equal(String(preserved.due_at), String(original.due_at));
          assert.equal(
            String(preserved.original_due_at),
            String(original.original_due_at),
          );
        }
      },
    );
    await t.test(
      "handoff, booking and enrollment all retain task links and cancel queued notifications on completion",
      async () => {
        const v = await visitor();
        const registered = await contact(v);
        const lid = registered.data.lead.id;
        for (const kind of ["handoff", "booking", "enrollment"]) {
          const before = Date.now(),
            r = await action(
              v,
              "structured-" + kind,
              "TEST structured " + kind,
              kind,
            );
          assert.equal(r.status, 200);
          const task = (
            await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
              r.data.taskId,
            ])
          ).rows[0];
          assert.equal(task.kind, kind);
          assert.ok(Math.abs(task.due_at.getTime() - before - 1800000) < 5000);
          const name =
            kind === "handoff"
              ? "handoff.requested"
              : kind === "booking"
                ? "booking.requested"
                : "enrollment.requested";
          const e = (
            await pool.query(
              "SELECT * FROM outbox WHERE lead_id=:p1 AND type=:p2",
              [lid, name],
            )
          ).rows[0];
          assert.equal(e.payload.taskId, task.id);
          const jid = crypto.randomUUID();
          await pool.query(
            "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,:p3,1,'lark','TEST-group',UTC_TIMESTAMP(6)+INTERVAL 1 hour,:p4)",
            [
              jid,
              e.id,
              name,
              { rule: defaults, event: name, leadId: lid, payload: e.payload },
            ],
          );
          assert.equal(
            (
              await request("/api/crm/leads/" + lid + "/logs", staff, {
                requestId: "TEST-complete-" + kind,
                recordKind: "closure",
                summary: "TEST completed " + kind,
                completeTaskIds: [task.id],
                disposition: "keep",
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT state FROM notification_jobs WHERE id=:p1",
                [jid],
              )
            ).rows[0].state,
            "cancelled",
          );
        }
      },
    );
    await t.test(
      "task insertion failure rolls back the message and event with saved=false",
      async () => {
        const v = await visitor();
        await contact(v);
        await pool.query(
          "CREATE TRIGGER p0_fail_task BEFORE INSERT ON followup_tasks FOR EACH ROW BEGIN IF NEW.kind='booking' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST task failure'; END IF; END",
        );
        try {
          const r = await action(
            v,
            "failed-request",
            "TEST booking failure",
            "booking",
          );
          assert.equal(r.status, 503);
          assert.equal(r.data.saved, false);
          assert.equal(
            Number(
              (
                await pool.query(
                  "SELECT count(*) n FROM messages WHERE conversation_id=:p1",
                  [v.conversationId],
                )
              ).rows[0].n,
            ),
            0,
          );
        } finally {
          await pool.query("DROP TRIGGER p0_fail_task");
        }
        assert.equal(
          (await action(v, "failed-request", "TEST booking failure", "booking"))
            .status,
          200,
        );
      },
    );
    await t.test(
      "notify leaders, keep Lark pending, completion cancels linked jobs; later request opens a new task",
      async () => {
        await pool.query("UPDATE notification_rules SET enabled=false");
        await pool.query(
          "UPDATE outbox SET processed_at=UTC_TIMESTAMP(6) WHERE lead_id<>:p1",
          [leadId],
        );
        await pool.query(
          "INSERT INTO notification_channels VALUES('p0-test',:p1)",
          [{ mode: "simulation", name: "TEST CRM group", maxPerHour: 20 }],
        );
        const rule = {
          ...defaults,
          event: "handoff.requested",
          channels: ["inapp", "lark"],
          group: "p0-test",
          timing: "delay",
          delayMinutes: 60,
          businessOnly: false,
        };
        await pool.query(
          "UPDATE notification_rules SET enabled=true,config=:p1 WHERE id='handoff.requested'",
          [rule],
        );
        for (let i = 0; i < 8; i++) await tick();
        const inbox = (
          await pool.query(
            "SELECT i.employee_id FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id WHERE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.snapshot,'$.payload.taskId')),'null')=:p1",
            [taskId],
          )
        ).rows;
        assert.deepEqual(inbox.map((r) => r.employee_id).sort(), [
          "Ethan",
          "Monite",
          "Robert",
          "Suki",
          "Tester",
        ]);
        const jobs = (
          await pool.query(
            "SELECT * FROM notification_jobs WHERE channel='lark' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1",
            [taskId],
          )
        ).rows;
        assert.equal(jobs.length, 1);
        assert.equal(jobs[0].state, "pending");
        assert.equal(
          (
            await request("/api/crm/leads/" + leadId + "/logs", staff, {
              requestId: "TEST-finish-original",
              recordKind: "closure",
              summary: "TEST completed request",
              completeTaskIds: [taskId],
              disposition: "keep",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT state FROM notification_jobs WHERE id=:p1",
              [jobs[0].id],
            )
          ).rows[0].state,
          "cancelled",
        );
        const replay = await action(
          anon,
          "anon-request",
          "TEST please ask an advisor to contact me",
        );
        assert.equal(replay.data.status, "completed");
        assert.equal(replay.data.taskId, taskId);
        const next = await action(
          anon,
          "new-request",
          "TEST need another follow-up",
        );
        assert.equal(next.status, 200);
        assert.notEqual(next.data.taskId, taskId);
        assert.equal(
          (
            await request("/api/crm/leads/" + leadId + "/logs", staff, {
              requestId: "TEST-finish-next",
              recordKind: "closure",
              summary: "TEST completed next request",
              completeTaskIds: [next.data.taskId],
              disposition: "keep",
            })
          ).status,
          200,
        );
        for (let i = 0; i < 5; i++) await tick();
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM notification_jobs WHERE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId')),'null')=:p1",
                [next.data.taskId],
              )
            ).rows[0].n,
          ),
          0,
        );
        const transcript = (await request("/api/crm/leads/" + leadId, staff))
          .data;
        assert.ok(
          JSON.stringify(transcript).includes("TEST need another follow-up"),
        );
      },
    );
    await t.test(
      "contact resubmission cannot undo concurrent assignment; task and notification use the current owner",
      async () => {
        const v = await visitor();
        const r = await contact(v);
        const lid = r.data.lead.id;
        assert.equal(
          (
            await request(
              "/api/crm/leads/" + lid,
              staff,
              { owner: "Fadhil" },
              "PATCH",
            )
          ).status,
          200,
        );
        const locker = await fixture.connect();
        await locker.query("BEGIN");
        await locker.query(
          "SELECT id FROM portal_leads WHERE id=:p1 FOR UPDATE",
          [lid],
        );
        const pending = contact(v);
        try {
          let waiting = false;
          for (let i = 0; i < 100; i++) {
            waiting =
              Number(
                (
                  await locker.query(
                    "SELECT COUNT(*) n FROM performance_schema.data_lock_waits",
                  )
                ).rows[0].n,
              ) > 0;
            if (waiting) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.equal(waiting, true);
          await locker.query(
            "UPDATE portal_leads SET profile=JSON_SET(profile,'$.owner',CAST('\"Zainul\"' AS JSON)) WHERE id=:p1",
            [lid],
          );
          await locker.query("COMMIT");
          assert.equal((await pending).status, 200);
        } finally {
          await locker.query("ROLLBACK");
          locker.release();
        }
        assert.equal(
          (
            await pool.query(
              "SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.owner')),'null') owner FROM portal_leads WHERE id=:p1",
              [lid],
            )
          ).rows[0].owner,
          "Zainul",
        );
        const result = await action(
          v,
          "owner-request",
          "TEST assigned-owner request",
        );
        assert.equal(
          (
            await pool.query(
              "SELECT owner_id FROM followup_tasks WHERE id=:p1",
              [result.data.taskId],
            )
          ).rows[0].owner_id,
          "Zainul",
        );
        for (let i = 0; i < 8; i++) await tick();
        assert.deepEqual(
          (
            await pool.query(
              "SELECT employee_id FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id WHERE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.snapshot,'$.payload.taskId')),'null')=:p1",
              [result.data.taskId],
            )
          ).rows.map((r) => r.employee_id),
          ["Zainul"],
        );
      },
    );
  });
}
