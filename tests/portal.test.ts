import { setupNativeTest } from "./helpers/mysql.mjs";
import { test, after } from "node:test";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import { defaults, schedule, sla, validate } from "../server/portal/policy.ts";
test("policy schedules inapp immediately, lark at next working time and validates disconnected channels", () => {
  const date = new Date("2026-10-11T01:00:00Z");
  assert.equal(
    schedule(date, defaults, "inapp").toISOString(),
    date.toISOString(),
  );
  assert.equal(
    schedule(date, defaults, "lark").toISOString(),
    "2026-10-12T02:00:00.000Z",
  );
  assert.equal(
    sla(date, 3, defaults).toISOString(),
    "2026-10-12T05:00:00.000Z",
  );
  assert.throws(() => validate({ ...defaults, channels: ["sms"] }));
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("portal");
  process.env.PLATFORM_MODE = "mock";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const { mountChat } = await import("../server/portal/chat.ts");
  const { tick } = await import("../server/portal/worker.ts");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  mountChat(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  let cookie = "";
  async function request(path: string, body?: any, customCookie?: string) {
    const r = await fetch(base + path, {
      headers: {
        cookie: customCookie ?? cookie,
        "Content-Type": "application/json",
      },
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get("set-cookie");
    if (set && customCookie === undefined) cookie = set.split(";")[0];
    return { status: r.status, data: await r.json() };
  }
  await test("MySQL portal suite", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    await t.test(
      "stable message sequence and retry failed assistant without duplicating user",
      async () => {
        const native = globalThis.fetch;
        let failure = true;
        globalThis.fetch = async (url, options) =>
          String(url).includes("api.openai.com") ||
          String(url).includes("api.deepseek.com")
            ? new Response(
                failure
                  ? "{}"
                  : JSON.stringify({
                      choices: [
                        {
                          message: { content: "Recovered" },
                          finish_reason: "stop",
                        },
                      ],
                    }),
                {
                  status: failure ? 503 : 200,
                  headers: { "content-type": "application/json" },
                },
              )
            : native(url, options);
        process.env.OPENAI_API_KEY = "fixture";
        process.env.DEEPSEEK_API_KEY = "fixture";
        try {
          const conv = (
            await request("/api/portal/conversations", {
              source: "standalone_chat",
              newSession: true,
            })
          ).data.conversationId;
          const body = {
            conversationId: conv,
            messageId: "retry-failed",
            content: "Retry original message",
            stream: false,
          };
          assert.equal(
            (await request("/api/chat", body)).data.error,
            "all_providers_failed",
          );
          failure = false;
          assert.equal(
            (await request("/api/chat", body)).data.reply,
            "Recovered",
          );
          const rows = (await request("/api/portal/conversations/" + conv)).data
            .messages;
          assert.deepEqual(
            rows.map((m: any) => m.role),
            ["user", "assistant"],
          );
          assert.equal(rows.length, 2);
          assert.ok(Number(rows[0].sequence) < Number(rows[1].sequence));
          assert.equal(rows[1].status, "completed");
        } finally {
          globalThis.fetch = native;
        }
      },
    );
    await t.test(
      "anonymous registration preserves conversations, idempotent contact and candidate identity do not expose history",
      async () => {
        const conv = (
          await request("/api/portal/conversations", {
            source: "standalone_chat",
          })
        ).data.conversationId;
        const lead = (
          await request("/api/portal/register", {
            fullName: "Test",
            phone: "+6281234567890",
            email: "test@example.invalid",
          })
        ).data.lead;
        const again = (
          await request("/api/portal/register", {
            fullName: "Test",
            phone: "+6281234567890",
            email: "test@example.invalid",
          })
        ).data.lead;
        assert.equal(lead.id, again.id);
        const c2 = (
          await request("/api/portal/conversations", {
            source: "homepage_widget",
          })
        ).data.conversationId;
        assert.notEqual(conv, c2);
        assert.equal(
          (
            await pool.query("SELECT lead_id FROM conversations WHERE id=:p1", [
              conv,
            ])
          ).rows[0].lead_id,
          lead.id,
        );
        assert.equal(
          (
            await request(
              "/api/portal/conversations/" + conv,
              undefined,
              "other=1",
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request("/api/crm/leads/sync-chat", {
              email: lead.email,
              messages: [],
            })
          ).status,
          410,
        );
      },
    );
    await t.test(
      "AI fallback stores user before provider call and preserves repeated text; replay stays idempotent",
      async () => {
        const native = globalThis.fetch;
        process.env.OPENAI_API_KEY = "fake";
        process.env.DEEPSEEK_API_KEY = "fake";
        let calls = 0;
        globalThis.fetch = async (url, opts) => {
          if (String(url).includes("api.openai.com")) {
            calls++;
            const count = (
              await pool.query(
                "SELECT count(*) FROM messages WHERE role='user'",
              )
            ).rows[0].count;
            assert.ok(Number(count) > 0);
            return new Response("{}", { status: 503 });
          }
          if (String(url).includes("api.deepseek.com"))
            return Response.json({
              choices: [
                { message: { content: "Backup reply" }, finish_reason: "stop" },
              ],
            });
          return native(url, opts);
        };
        try {
          const conv = (
            await request("/api/portal/conversations", {
              source: "standalone_chat",
              newSession: true,
            })
          ).data.conversationId;
          const first = await request("/api/chat", {
            conversationId: conv,
            messageId: "repeat-1",
            content: "Same text",
          });
          assert.equal(first.data.modelUsed, "deepseek-chat");
          for (let i = 0; i < 10; i++)
            await request("/api/chat", {
              conversationId: conv,
              messageId: "repeat-1",
              content: "Same text",
            });
          await request("/api/chat", {
            conversationId: conv,
            messageId: "repeat-2",
            content: "Same text",
          });
          assert.equal(calls, 2);
          assert.equal(
            Number(
              (
                await pool.query(
                  "SELECT COUNT(*) AS count FROM messages WHERE conversation_id=:p1 AND role='user'",
                  [conv],
                )
              ).rows[0].count,
            ),
            2,
          );
          assert.equal(
            (
              await request("/api/chat", {
                conversationId: conv,
                messageId: "repeat-1",
                content: "Different",
              })
            ).status,
            409,
          );
        } finally {
          globalThis.fetch = native;
        }
      },
    );
    await t.test(
      "outbox workers do not duplicate inbox and reading does not complete follow-up",
      async () => {
        for (let i = 0; i < 10; i++) await tick();
        const inbox = (await request("/api/crm/notifications")).data;
        assert.ok(inbox.length > 0);
        await request("/api/crm/notifications/" + inbox[0].id + "/read", {});
        const tasks = (await request("/api/crm/tasks")).data;
        assert.ok(tasks.some((t) => t.status === "open"));
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) n,count(distinct id) d FROM notification_inbox",
            )
          ).rows[0].n,
          (
            await pool.query(
              "SELECT count(*) n,count(distinct id) d FROM notification_inbox",
            )
          ).rows[0].d,
        );
      },
    );
    await t.test(
      "mock authentication rejects proxy/public host and spoofed permissions",
      async () => {
        const r = await fetch(base + "/api/crm/leads", {
          headers: {
            "x-forwarded-for": "8.8.8.8",
            "x-employee-id": "test-admin",
          },
        });
        assert.equal(r.status, 401);
      },
    );
    await t.test(
      "partial stream failure falls back without mixing final answer",
      async () => {
        const native = globalThis.fetch;
        globalThis.fetch = async (url, opts) => {
          if (String(url).includes("api.openai.com"))
            return new Response(
              "data: " +
                JSON.stringify({
                  choices: [{ delta: { content: "PARTIAL" } }],
                }) +
                "\n\n",
              { headers: { "content-type": "text/event-stream" } },
            );
          if (String(url).includes("api.deepseek.com"))
            return new Response(
              "data: " +
                JSON.stringify({
                  choices: [{ delta: { content: "COMPLETE" } }],
                }) +
                "\n\ndata: [DONE]\n\n",
              { headers: { "content-type": "text/event-stream" } },
            );
          return native(url, opts);
        };
        try {
          const conv = (
            await request("/api/portal/conversations", {
              source: "standalone_chat",
              newSession: true,
            })
          ).data.conversationId;
          const r = await native(base + "/api/chat", {
            method: "POST",
            headers: { cookie, "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: conv,
              messageId: "stream",
              content: "Question",
              stream: true,
            }),
          });
          const text = await r.text();
          assert.ok(text.includes('"reset":true'));
          const answer = (
            await pool.query(
              "SELECT * FROM messages WHERE conversation_id=:p1 AND role='assistant'",
              [conv],
            )
          ).rows[0];
          assert.equal(answer.content, "COMPLETE");
          assert.equal(answer.status, "completed");
          assert.ok(
            (
              await pool.query(
                "SELECT * FROM ai_attempts WHERE message_id=:p1 AND error IS NOT NULL",
                [answer.id],
              )
            ).rows.length > 0,
          );
        } finally {
          globalThis.fetch = native;
        }
      },
    );
    await t.test(
      "Lark HTTP success with business error is failed, timeout is unknown",
      async () => {
        const native = globalThis.fetch;
        process.env.TEST_LARK =
          "https://open.larksuite.com/open-apis/bot/v2/hook/test";
        process.env.LARK_TEST_GROUP = "verification";
        await pool.query(
          "INSERT INTO notification_channels(id,config) VALUES('verification',:p1) ON DUPLICATE KEY UPDATE config=:p1",
          [{ mode: "live", secretRef: "TEST_LARK" }],
        );
        for (const scenario of ["business", "timeout"]) {
          const eventId = crypto.randomUUID(),
            jobId = crypto.randomUUID();
          await pool.query(
            "INSERT INTO outbox(id,type,payload,processed_at) VALUES(:p1,'test','{}',UTC_TIMESTAMP(6))",
            [eventId],
          );
          await pool.query(
            "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,:p3,1,:p4,:p5,UTC_TIMESTAMP(6)-INTERVAL 10 day,:p6)",
            [
              jobId,
              eventId,
              "test",
              "lark",
              "verification",
              {
                rule: { ...defaults, businessOnly: false, dedupeMinutes: 0 },
                event: "test",
                payload: {},
              },
            ],
          );
          globalThis.fetch = async (url, opts) => {
            if (String(url).includes("/bot/v2/hook/test")) {
              if (scenario === "timeout") throw Error("Timeout");
              return Response.json({ code: 19001 });
            }
            return native(url, opts);
          };
          await tick();
          assert.equal(
            (
              await pool.query(
                "SELECT state FROM notification_jobs WHERE id=:p1",
                [jobId],
              )
            ).rows[0].state,
            scenario === "timeout" ? "unknown" : "failed",
          );
        }
        globalThis.fetch = native;
      },
    );
    await t.test(
      "storage failure never acknowledges save; abandoned generation recovers as interrupted",
      async () => {
        const query = pool.query.bind(pool);
        const before = (await query("SELECT count(*) FROM outbox")).rows[0]
          .count;
        pool.query = ((...args: any[]) =>
          Promise.reject(Error("Injected storage failure"))) as any;
        try {
          const r = await request("/api/portal/register", {
            fullName: "Fail",
            phone: "+6281234567891",
            email: "fail@example.invalid",
          });
          assert.equal(r.status, 503);
          assert.equal(r.data.success, undefined);
        } finally {
          pool.query = query as any;
        }
        assert.equal(
          (await query("SELECT count(*) FROM outbox")).rows[0].count,
          before,
        );
        const conv = (
          await request("/api/portal/conversations", {
            source: "standalone_chat",
            newSession: true,
          })
        ).data.conversationId;
        const orphan = crypto.randomUUID();
        await query(
          "INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES(:p1,:p2,'orphan','assistant','','generating')",
          [orphan, conv],
        );
        await tick();
        assert.equal(
          (await query("SELECT status FROM messages WHERE id=:p1", [orphan]))
            .rows[0].status,
          "interrupted",
        );
      },
    );
    await t.test(
      "lead activity read watermark preserves later events and never completes tasks",
      async () => {
        const lead = (
          await request("/api/portal/register", {
            fullName: "Activity QA",
            phone: "+6281234567890",
            email: "test@example.invalid",
          })
        ).data.lead;
        await tick();
        const listed = (await request("/api/crm/leads")).data.leads.find(
          (l: any) => l.id === lead.id,
        );
        assert.ok(listed.attention.unreadCount > 0);
        const taskBefore = (
          await request("/api/crm/leads/" + lead.id + "/tasks")
        ).data.find((t: any) => t.status === "open");
        assert.ok(taskBefore);
        await request("/api/crm/leads/" + lead.id + "/read", {
          readThrough: listed.attention.observedAt,
        });
        assert.equal(
          (await request("/api/crm/leads")).data.leads.find(
            (l: any) => l.id === lead.id,
          ).attention.unreadCount,
          0,
        );
        assert.equal(
          (await request("/api/crm/leads/" + lead.id + "/tasks")).data.find(
            (t: any) => t.id === taskBefore.id,
          ).status,
          "open",
        );
        const eventId = crypto.randomUUID(),
          jobId = crypto.randomUUID();
        await pool.query(
          "INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES(:p1,'assessment.completed',:p2,'{}',UTC_TIMESTAMP(6))",
          [eventId, lead.id],
        );
        await pool.query(
          "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot,state) VALUES(:p1,:p2,'test',1,'inapp','test-admin',UTC_TIMESTAMP(6),'{}','accepted')",
          [jobId, eventId],
        );
        await pool.query(
          "INSERT INTO notification_inbox(id,employee_id,content) VALUES(:p1,'test-admin',:p2)",
          [jobId, { leadId: lead.id, event: "conversation.updated" }],
        );
        await request("/api/crm/leads/" + lead.id + "/read", {
          readThrough: listed.attention.observedAt,
        });
        assert.equal(
          (await request("/api/crm/leads")).data.leads.find(
            (l: any) => l.id === lead.id,
          ).attention.unreadCount,
          1,
        );
      },
    );
    await t.test(
      "sales sees own and unassigned leads; manager sees all; reassignment immediately revokes access",
      async () => {
        const mine = crypto.randomUUID(),
          other = crypto.randomUUID();
        await pool.query(
          "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
          [mine, { id: mine, fullName: "Assigned QA", owner: "test-sales" }],
        );
        await pool.query(
          "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
          [other, { id: other, fullName: "Manager QA", owner: "test-admin" }],
        );
        const taskId = crypto.randomUUID();
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,'consultation','test-admin',UTC_TIMESTAMP(6)+INTERVAL 1 day)",
          [taskId, other],
        );
        const manager = (await request("/api/crm/leads")).data;
        assert.ok(manager.leads.some((l: any) => l.id === other));
        assert.ok(manager.leads.some((l: any) => l.id === mine));
        process.env.MOCK_EMPLOYEE_ID = "test-sales";
        try {
          const sales = (await request("/api/crm/leads")).data;
          assert.equal(sales.dataScope, "own");
          assert.ok(
            sales.leads.every((l: any) => l.owner === "test-sales" || !l.owner),
          );
          assert.ok(!sales.leads.some((l: any) => l.id === other));
          assert.equal(sales.stats.total, sales.leads.length);
          for (const path of [
            "/api/crm/leads/" + other,
            "/api/crm/leads/" + other + "/conversations",
            "/api/crm/leads/" + other + "/tasks",
          ])
            assert.equal((await request(path)).status, 404);
          assert.equal(
            (
              await request("/api/crm/leads/" + other + "/read", {
                readThrough: new Date().toISOString(),
              })
            ).status,
            404,
          );
          assert.equal(
            (await request("/api/crm/tasks/" + taskId + "/complete", {}))
              .status,
            404,
          );
          assert.equal((await request("/api/crm/export")).status, 403);
          const assignment = await fetch(base + "/api/crm/leads/" + mine, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ owner: "test-admin" }),
          });
          assert.equal(assignment.status, 403);
          assert.ok(
            !(await request("/api/crm/tasks")).data.some(
              (t: any) => t.lead_id === other,
            ),
          );
          await pool.query(
            "UPDATE portal_leads SET profile=JSON_SET(profile,'$.owner',CAST(:p2 AS JSON)) WHERE id=:p1",
            [mine, JSON.stringify("test-admin")],
          );
          assert.equal((await request("/api/crm/leads/" + mine)).status, 404);
        } finally {
          delete process.env.MOCK_EMPLOYEE_ID;
        }
      },
    );
    await t.test(
      "20 parallel sessions, 100 messages have no lost accepted writes",
      async () => {
        const native = globalThis.fetch;
        globalThis.fetch = async (url, opts) =>
          String(url).includes("api.openai.com")
            ? Response.json({
                choices: [
                  { message: { content: "OK" }, finish_reason: "stop" },
                ],
              })
            : native(url, opts);
        try {
          const results = await Promise.all(
            Array.from({ length: 20 }, async (_, i) => {
              const c = (
                await request("/api/portal/conversations", {
                  source: "standalone_chat",
                  newSession: true,
                })
              ).data.conversationId;
              for (let j = 0; j < 5; j++) {
                const r = await request("/api/chat", {
                  conversationId: c,
                  messageId: `load-${i}-${j}`,
                  content: "Load",
                });
                assert.equal(r.status, 200);
              }
              return c;
            }),
          );
          const rows = (
            await pool.query(
              "SELECT COUNT(*) AS count FROM messages WHERE conversation_id IN (:p1) AND role='user'",
              [results],
            )
          ).rows;
          assert.equal(Number(rows[0].count), 100);
        } finally {
          globalThis.fetch = native;
        }
      },
    );
  });
}
