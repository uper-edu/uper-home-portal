import { setupNativeTest } from "./helpers/mysql.mjs";
import { disposeNativeTest } from "./helpers/disposeNativeTest.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { defaults, schedule, sla, validate } from "../server/portal/policy";
test("notification schedules: closing boundary, Sunday, timezone, delay, digest and natural-hour SLA", () => {
  const r = { ...defaults };
  assert.equal(
    schedule(new Date("2026-10-10T13:00:00Z"), r, "lark").toISOString(),
    "2026-10-12T02:00:00.000Z",
  );
  assert.equal(
    schedule(new Date("2026-10-11T01:00:00Z"), r, "inapp").toISOString(),
    "2026-10-11T01:00:00.000Z",
  );
  assert.equal(
    schedule(
      new Date("2026-10-12T10:30:00Z"),
      { ...r, timing: "delay", delayMinutes: 30 },
      "lark",
    ).toISOString(),
    "2026-10-12T11:00:00.000Z",
  );
  assert.equal(
    schedule(
      new Date("2026-10-12T10:30:00Z"),
      { ...r, timing: "digest" },
      "lark",
    ).toISOString(),
    "2026-10-12T11:00:00.000Z",
  );
  assert.equal(
    sla(new Date("2026-10-10T12:00:00Z"), 3, r).toISOString(),
    "2026-10-12T02:00:00.000Z",
  );
  assert.equal(
    schedule(
      new Date("2026-10-12T01:00:00Z"),
      { ...r, timezone: "Asia/Shanghai" },
      "lark",
    ).toISOString(),
    "2026-10-12T01:00:00.000Z",
  );
  assert.throws(() => validate({ ...r, days: [] }));
  assert.throws(() => validate({ ...r, timezone: "invalid" }));
});

test("quiet windows, DST, exact boundary rounding and card receipt helpers", async () => {
  const r = {
    ...defaults,
    businessOnly: false,
    quiet: { start: "22:00", end: "08:00" },
  };
  assert.equal(
    schedule(new Date("2026-10-12T16:30:45Z"), r, "lark").toISOString(),
    "2026-10-13T01:00:00.000Z",
  );
  assert.equal(
    schedule(
      new Date("2026-10-12T01:30:00Z"),
      { ...defaults, quiet: { start: "09:00", end: "10:00" } },
      "lark",
    ).toISOString(),
    "2026-10-12T03:00:00.000Z",
  );
  assert.equal(
    schedule(new Date("2026-10-10T13:00:59Z"), defaults, "lark").toISOString(),
    "2026-10-12T02:00:00.000Z",
  );
  assert.equal(
    schedule(
      new Date("2026-11-02T13:00:00Z"),
      { ...defaults, timezone: "America/New_York" },
      "lark",
    ).toISOString(),
    "2026-11-02T14:00:00.000Z",
  );
  const { retryAfter, validWebhook, larkCard } =
    await import("../server/portal/notificationDelivery");
  const now = new Date("2026-10-12T00:00:00Z");
  assert.equal(retryAfter("Mon, 12 Oct 2026 00:02:00 GMT", now), 120);
  assert.equal(retryAfter("invalid", now), 0);
  assert.equal(
    validWebhook(
      "https://open.larksuite.com.evil.test/open-apis/bot/v2/hook/a",
    ),
    false,
  );
  assert.equal(
    validWebhook("https://open.larksuite.com/open-apis/bot/v2/hook/test"),
    true,
  );
  const old = process.env.APP_URL;
  process.env.APP_URL = "https://portal.example.invalid";
  try {
    const card = larkCard(
      "Summary without full transcript",
      "qa-lead",
      "signing-fixture",
      now,
    );
    assert.equal(card.msg_type, "interactive");
    assert.equal(
      card.card.elements[1].actions[0].url,
      "https://portal.example.invalid/crm?lead=qa-lead",
    );
    assert.ok(card.sign);
    assert.ok(!JSON.stringify(card).includes("signing-fixture"));
  } finally {
    if (old) process.env.APP_URL = old;
    else delete process.env.APP_URL;
  }
});

if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("notificationPolicy");
  process.env.PLATFORM_MODE = "mock";
  const { pool } = await import("../server/portal/store");
  const { mountPortal } = await import("../server/portal/runtime");
  const { tick } = await import("../server/portal/worker");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  async function api(path: string, body?: any, method?: string) {
    const r = await fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  }
  const rule = (x: any = {}) => ({
    ...defaults,
    calendarMode: "custom" as const,
    businessOnly: false,
    channels: ["inapp"],
    ...x,
  });
  async function reset() {
    await fixture.reset(
      "notification_inbox,notification_jobs,outbox,followup_tasks,crm_ai_extractions,crm_facts,crm_operations,portal_leads,notification_rules,notification_channels,rule_versions,portal_audit",
    );
    delete process.env.MOCK_EMPLOYEE_ID;
    await pool.query(
      "INSERT INTO notification_channels(id,config) VALUES('qa',:p1)",
      [{ mode: "simulation", groupName: "TEST simulation" }],
    );
  }
  async function lead(owner = "test-admin") {
    const id = crypto.randomUUID();
    await pool.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [
      id,
      {
        id,
        fullName: "Policy QA",
        owner,
        team: "sales",
        tier: "Hot",
        currentStage: "New",
      },
    ]);
    return id;
  }
  // A cancellation assertion is meaningful only after the current workflow saved.
  async function completeFirstContact(lid: string, tid: string) {
    const before = (await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [lid])).rows[0].profile;
    const body = {
      workflowVersion: 3,
      requestId: "TEST-complete-" + tid,
      expectedRevision: before.simpleRevision || 0,
      recordKind: "contact",
      channel: "Phone Call",
      connectStatus: "Connected",
      contactDirection: "sales",
      occurrenceMode: "now",
      summary: "TEST actual first contact completed",
    };
    const saved = await api("/api/crm/leads/" + lid + "/logs", body);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.ok(saved.data.completedTaskIds.includes(tid), "Saved result must identify the processed first-contact task");
    assert.equal((await pool.query("SELECT status FROM followup_tasks WHERE id=:p1", [tid])).rows[0].status, "completed");
    const retried = await api("/api/crm/leads/" + lid + "/logs", body);
    assert.equal(retried.status,200,JSON.stringify(retried.data));
    assert.equal(retried.data.replayed,true);
    assert.equal(retried.data.logId,saved.data.logId);

  }
  async function event(
    id: string | null,
    type = "lead.created",
    payload: any = {},
  ) {
    const eid = crypto.randomUUID();
    await pool.query(
      "INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,:p2,:p3,:p4)",
      [eid, type, id, payload],
    );
    return eid;
  }
  async function saveRule(id: string, config: any = rule(), enabled = true) {
    await pool.query(
      "INSERT INTO notification_rules(id,version,config,enabled) VALUES(:p1,1,:p2,:p3)",
      [id, config, enabled],
    );
  }
  async function job(
    lid: string | null,
    channel = "inapp",
    recipient = "test-admin",
    payload: any = {},
    config: any = rule(),
  ) {
    const eid = crypto.randomUUID(),
      jid = crypto.randomUUID();
    await pool.query(
      "INSERT INTO outbox(id,type,payload,processed_at) VALUES(:p1,'qa','{}',UTC_TIMESTAMP(6))",
      [eid],
    );
    await pool.query(
      "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,'qa',1,:p3,:p4,UTC_TIMESTAMP(6)-INTERVAL 10 day,:p5)",
      [
        jid,
        eid,
        channel,
        recipient,
        {
          rule: config,
          event: config.event,
          leadId: lid,
          payload,
          priority: payload.priority || "normal",
        },
      ],
    );
    return jid;
  }
  async function state(jid: string) {
    return (
      await pool.query("SELECT * FROM notification_jobs WHERE id=:p1", [jid])
    ).rows[0];
  }
  // Reproducible targeted run: MYSQL_NOTIFICATION_FOCUS=task-completion.
  // Without this explicit selector the complete native suite remains unchanged.
  const focus = process.env.MYSQL_NOTIFICATION_FOCUS;
  if (focus && focus !== "task-completion") throw Error("Unknown MYSQL_NOTIFICATION_FOCUS");
  const focusCases = new Set([
    "task completion immediately cancels future jobs and suppresses unprocessed stale events",
    "overdue escalation emitted once; read does not complete, completion cancels send",
  ]);
  await test("notification MySQL acceptance", async (t) => {
    const caseTest = (name: string, body: (context: any) => any) =>
      t.test(name, {skip: focus === "task-completion" && !focusCases.has(name) ? "Outside explicit task-completion focus" : false}, body);
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      try { await pool.end(); } finally { await disposeNativeTest(fixture); }
    });
    await caseTest(
      "source/tier/status filters and unpublished drafts never send",
      async () => {
        await reset();
        const lid = await lead();
        await saveRule(
          "matching",
          rule({
            sources: ["homepage_widget"],
            tiers: ["Hot"],
            states: ["New"],
          }),
        );
        await saveRule("draft", rule(), false);
        await event(lid, "lead.created", { source: "standalone_chat" });
        await event(lid, "lead.created", { source: "homepage_widget" });
        await tick();
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM notification_jobs WHERE rule_id='matching'",
              )
            ).rows[0].n,
          ),
          1,
        );
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM notification_jobs WHERE rule_id='draft'",
              )
            ).rows[0].n,
          ),
          0,
        );
      },
    );
    await caseTest(
      "late delivery dedupes by accepted time and preserves different priorities",
      async () => {
        await reset();
        const lid = await lead();
        const config = rule({ channels: ["lark"], group: "qa" });
        const first = await job(
          lid,
          "lark",
          "qa",
          { priority: "normal" },
          config,
        );
        await tick();
        assert.equal((await state(first)).state, "simulated");
        const second = await job(
          lid,
          "lark",
          "qa",
          { priority: "normal" },
          config,
        );
        await tick();
        assert.equal((await state(second)).state, "cancelled");
        const urgent = await job(
          lid,
          "lark",
          "qa",
          { priority: "urgent" },
          config,
        );
        await tick();
        assert.equal((await state(urgent)).state, "simulated");
      },
    );
    await caseTest(
      "frequency limit counts late sends instead of old due dates",
      async () => {
        await reset();
        const lid = await lead();
        const config = rule({
          channels: ["lark"],
          dedupeMinutes: 0,
          maxPerHour: 1,
        });
        const first = await job(lid, "lark", "qa", {}, config);
        await tick();
        assert.equal((await state(first)).state, "simulated");
        const second = await job(lid, "lark", "qa", {}, config);
        await tick();
        const s = await state(second);
        assert.equal(s.state, "pending");
        assert.ok(new Date(s.due_at).getTime() > Date.now());
      },
    );
    await caseTest(
      "completed follow-up cancels queued notifications",
      async () => {
        await reset();
        const lid = await lead(),
          tid = crypto.randomUUID();
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,status,due_at) VALUES(:p1,:p2,'consultation','completed',UTC_TIMESTAMP(6))",
          [tid, lid],
        );
        const jid = await job(lid, "inapp", "test-admin", { taskId: tid });
        await tick();
        assert.equal((await state(jid)).state, "cancelled");
        assert.equal(
          Number(
            (await pool.query("select count(*) n from notification_inbox"))
              .rows[0].n,
          ),
          0,
        );
      },
    );
    await caseTest(
      "task completion immediately cancels future jobs and suppresses unprocessed stale events",
      async () => {
        await reset();
        const lid = await lead(),
          tid = crypto.randomUUID();
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES(:p1,:p2,'consultation',UTC_TIMESTAMP(6)+INTERVAL 1 day)",
          [tid, lid],
        );
        const jid = await job(lid, "inapp", "test-admin", { taskId: tid });
        await pool.query(
          "update notification_jobs set due_at=UTC_TIMESTAMP(6)+INTERVAL 1 day where id=:p1",
          [jid],
        );

        const otherLead = await lead(), otherJob = await job(otherLead);
        await pool.query("UPDATE notification_jobs SET due_at=UTC_TIMESTAMP(6)+INTERVAL 1 day WHERE id=:p1",[otherJob]);
        const otherBefore = await state(otherJob);
        const acceptedJob = await job(lid,"inapp","test-admin",{taskId:tid});
        await pool.query("UPDATE notification_jobs SET state='accepted',attempts=1,completed_at=UTC_TIMESTAMP(6) WHERE id=:p1",[acceptedJob]);
        const acceptedBefore = await state(acceptedJob);
        const note = await api("/api/crm/leads/"+lid+"/logs",{workflowVersion:3,requestId:"TEST-note-"+tid,expectedRevision:0,recordKind:"internal",summary:"TEST information only; no actual contact"});
        assert.equal(note.status,200,JSON.stringify(note.data));
        assert.equal(note.data.completedTaskIds.length,0);
        assert.equal((await pool.query("SELECT status FROM followup_tasks WHERE id=:p1",[tid])).rows[0].status,"open");
        assert.equal((await state(jid)).state,"pending");
        await saveRule("qa");
        await event(lid, "lead.created", { taskId: tid });
        await completeFirstContact(lid, tid);
        assert.equal((await state(jid)).state, "cancelled");
        assert.deepEqual(await state(otherJob),otherBefore);
        assert.deepEqual(await state(acceptedJob),acceptedBefore);
        await tick();
        assert.deepEqual(await state(otherJob),otherBefore);
        assert.deepEqual(await state(acceptedJob),acceptedBefore);
        assert.equal(
          Number(
            (await pool.query("select count(*) n from notification_jobs"))
              .rows[0].n,
          ),
          3,
        );
      },
    );
    await caseTest(
      "reassignment merges pending recipients without unique-conflict or old-owner disclosure",
      async () => {
        await reset();
        const lid = await lead("test-sales"),
          eid = crypto.randomUUID();
        await pool.query(
          "INSERT INTO outbox(id,type,payload,processed_at) VALUES(:p1,'qa','{}',UTC_TIMESTAMP(6))",
          [eid],
        );
        for (const recipient of ["test-admin", "test-sales"])
          await pool.query(
            "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,'qa',1,'inapp',:p3,UTC_TIMESTAMP(6)-INTERVAL 1 day,:p4)",
            [
              crypto.randomUUID(),
              eid,
              recipient,
              { rule: rule(), event: "lead.created", leadId: lid, payload: {} },
            ],
          );
        for (let i = 0; i < 4; i++) await tick();
        const rows = (
          await pool.query("select employee_id from notification_inbox")
        ).rows;
        assert.deepEqual(
          rows.map((x) => x.employee_id),
          ["test-sales"],
        );
      },
    );
    await caseTest(
      "unassigned sales users are not notified about leads they cannot view",
      async () => {
        await reset();
        const lid = await lead("");
        await saveRule("qa");
        await event(lid);
        for (let i = 0; i < 3; i++) await tick();
        assert.deepEqual(
          (
            await pool.query("select employee_id from notification_inbox")
          ).rows.map((x) => x.employee_id),
          ["test-admin"],
        );
      },
    );
    await caseTest(
      "same-transaction activation preserves MySQL microsecond precision",
      async () => {
        await reset();
        const lid = await lead();
        await saveRule("precision", rule());
        await pool.query(
          "UPDATE notification_rules SET effective_at='2026-10-12 17:04:50.333456' WHERE id='precision'",
        );
        const eid = await event(lid);
        await pool.query(
          "UPDATE outbox SET created_at='2026-10-12 17:04:50.333456' WHERE id=:p1",
          [eid],
        );
        await tick();
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT count(*) n FROM notification_jobs WHERE event_id=:p1",
                [eid],
              )
            ).rows[0].n,
          ),
          1,
        );
      },
    );
    await caseTest(
      "activation affects new events; old jobs retain their version after disabling",
      async () => {
        await reset();
        const lid = await lead();
        await saveRule("qa", rule(), false);
        const old = await event(lid);
        await pool.query(
          "UPDATE outbox SET created_at=UTC_TIMESTAMP(6)-INTERVAL 1 day WHERE id=:p1",
          [old],
        );
        assert.equal(
          (
            await api("/api/crm/notification-rules/qa", {
              config: rule(),
              enabled: true,
            })
          ).status,
          200,
        );
        await tick();
        assert.equal(
          Number(
            (await pool.query("select count(*) n from notification_jobs"))
              .rows[0].n,
          ),
          0,
        );
        await event(lid);
        await tick();
        const accepted = (await pool.query("select * from notification_jobs"))
          .rows[0];
        assert.equal(accepted.version, 2);
        const oldJob = await job(lid);
        await api("/api/crm/notification-rules/qa", {
          config: rule({ template: "NEW" }),
          enabled: false,
        });
        await tick();
        assert.equal(
          (await state(oldJob)).snapshot.rule.template,
          defaults.template,
        );
        assert.equal((await state(oldJob)).state, "accepted");
      },
    );
    await caseTest(
      "overdue escalation emitted once; read does not complete, completion cancels send",
      async () => {
        await reset();
        const lid = await lead(),
          tid = crypto.randomUUID();
        await saveRule(
          "overdue",
          rule({ event: "task.overdue", recipient: "supervisor" }),
        );
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,'consultation','test-admin',UTC_TIMESTAMP(6)-INTERVAL 1 day)",
          [tid, lid],
        );
        for (let i = 0; i < 3; i++) await tick();
        assert.equal(
          Number(
            (
              await pool.query(
                "select count(*) n from outbox where type='task.overdue'",
              )
            ).rows[0].n,
          ),
          1,
        );
        assert.equal(
          (
            await pool.query("select status from followup_tasks where id=:p1", [
              tid,
            ])
          ).rows[0].status,
          "overdue",
        );
        const inbox = (await pool.query("select * from notification_inbox"))
          .rows[0];
        await api("/api/crm/notifications/" + inbox.id + "/read", {});
        assert.equal(
          (
            await pool.query("select status from followup_tasks where id=:p1", [
              tid,
            ])
          ).rows[0].status,
          "overdue",
        );
        await completeFirstContact(lid, tid);
        const jid = await job(lid, "inapp", "test-admin", { taskId: tid });
        await tick();
        assert.equal((await state(jid)).state, "cancelled");
      },
    );
    await caseTest(
      "assignment updates overdue task owner while preserving deadline",
      async () => {
        await reset();
        const lid = await lead(),
          tid = crypto.randomUUID();
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,status,due_at) VALUES(:p1,:p2,'consultation','test-admin','overdue',UTC_TIMESTAMP(6)-INTERVAL 1 day)",
          [tid, lid],
        );
        const before = (
          await pool.query("select due_at from followup_tasks where id=:p1", [
            tid,
          ])
        ).rows[0].due_at;
        assert.equal(
          (await api("/api/crm/leads/" + lid, { owner: "test-sales" }, "PATCH"))
            .status,
          200,
        );
        const task = (
          await pool.query("select * from followup_tasks where id=:p1", [tid])
        ).rows[0];
        assert.equal(task.owner_id, "test-sales");
        assert.equal(task.due_at.toISOString(), before.toISOString());
      },
    );
    await caseTest(
      "explicit cancel is permission checked and audited",
      async () => {
        await reset();
        const lid = await lead(),
          jid = await job(lid);
        process.env.MOCK_EMPLOYEE_ID = "test-sales";
        assert.equal(
          (await api("/api/crm/notification-jobs/" + jid + "/cancel", {}))
            .status,
          403,
        );
        delete process.env.MOCK_EMPLOYEE_ID;
        assert.equal(
          (
            await api("/api/crm/notification-jobs/" + jid + "/cancel", {
              reason: "QA cancel",
            })
          ).status,
          200,
        );
        assert.equal((await state(jid)).state, "cancelled");
        assert.equal(
          Number(
            (
              await pool.query(
                "select count(*) n from portal_audit where action='notification.cancel'",
              )
            ).rows[0].n,
          ),
          1,
        );
      },
    );
    await caseTest("BUG604 HTTP200 business throttling retries same job; exhaustion and unknown do not replay", async () => {
      const native=globalThis.fetch;
      process.env.TEST_POLICY_LARK="https://open.larksuite.com/open-apis/bot/v2/hook/policy-test";
      process.env.LARK_TEST_GROUP="qa";
      const prepare=async()=>{
        await reset();
        const lid=await lead();
        await pool.query("INSERT INTO notification_channels VALUES('qa',:p1) ON DUPLICATE KEY UPDATE config=VALUES(config)",[{mode:'live',secretRef:'TEST_POLICY_LARK'}]);
        return job(lid,'lark','qa',{},rule({channels:['lark'],retries:[1,5,15],dedupeMinutes:0}));
      };
      const failures=async()=>Number((await pool.query("SELECT COUNT(*) AS n FROM outbox WHERE type='notification.failed'")).rows[0].n);
      const dueNow=async(jid:string)=>pool.query("UPDATE notification_jobs SET due_at=UTC_TIMESTAMP(6)-INTERVAL 1 day WHERE id=:p1",[jid]);
      let calls=0;
      const mock=(respond:()=>Promise<Response>|Response)=>{globalThis.fetch=async()=>{calls++;return respond();};};
      try {
        let jid=await prepare();
        mock(()=>new Response(JSON.stringify({code:calls===1?11232:0}),{status:200,headers:{'retry-after':'90'}}));
        const started=Date.now();await tick();let saved=await state(jid);
        assert.equal(saved.state,'pending');assert.equal(Number(saved.attempts),1);assert.equal(saved.completed_at,null);assert.equal(await failures(),0);
        assert.ok(new Date(saved.due_at).getTime()>=started+90000-500);
        await tick();assert.equal(calls,1,'backoff cannot send early');
        await dueNow(jid);await tick();saved=await state(jid);assert.equal(saved.state,'accepted');assert.equal(Number(saved.attempts),2);assert.equal(await failures(),0);
        assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM notification_jobs')).rows[0].n),1,'same job, no replacement');
        jid=await prepare();calls=0;mock(()=>new Response(JSON.stringify({code:11232}),{status:200}));
        for(const minutes of [1,5,15]){const start=Date.now();await tick();saved=await state(jid);assert.equal(saved.state,'pending');assert.equal(await failures(),0);assert.ok(new Date(saved.due_at).getTime()>=start+minutes*60000-500);await dueNow(jid);}
        await tick();saved=await state(jid);assert.equal(saved.state,'failed');assert.equal(Number(saved.attempts),4);assert.match(saved.result,/retry limit reached/);assert.equal(await failures(),1);
        const terminal=JSON.stringify(saved);await tick();assert.equal(calls,4);assert.equal(JSON.stringify(await state(jid)),terminal);assert.equal(await failures(),1);
        for(const kind of ['timeout','malformed','terminal']) {
          jid=await prepare();calls=0;
          mock(()=>{if(kind==='timeout')throw new DOMException('TEST timeout','TimeoutError');return kind==='malformed'?new Response('not JSON',{status:200}):new Response(JSON.stringify({code:19001}),{status:200});});
          await tick();saved=await state(jid);assert.equal(saved.state,kind==='terminal'?'failed':'unknown');assert.equal(Number(saved.attempts),1);await tick();await tick();assert.equal(calls,1,'unknown/terminal receipt must not replay');
        }
      } finally {globalThis.fetch=native;delete process.env.TEST_POLICY_LARK;delete process.env.LARK_TEST_GROUP;}
    });
    await caseTest(
      "Lark Retry-After, 1/5/15 backoff and terminal failure are traceable",
      async () => {
        await reset();
        const lid = await lead(),
          config = rule({
            channels: ["lark"],
            retries: [1, 5, 15],
            dedupeMinutes: 0,
          });
        process.env.TEST_POLICY_LARK =
          "https://open.larksuite.com/open-apis/bot/v2/hook/policy-test";
        process.env.LARK_TEST_GROUP = "qa";
        await pool.query(
          "INSERT INTO notification_channels VALUES('qa',:p1) ON DUPLICATE KEY UPDATE config=VALUES(config)",
          [{ mode: "live", team: "sales", secretRef: "TEST_POLICY_LARK" }],
        );
        const jid = await job(lid, "lark", "qa", {}, config);
        const native = globalThis.fetch;
        let calls = 0;
        globalThis.fetch = async (url, options) =>
          String(url).includes("policy-test")
            ? new Response("not JSON", {
                status: ++calls === 1 ? 429 : 500,
                headers: { "retry-after": calls === 1 ? "90" : "0" },
              })
            : native(url, options);
        try {
          for (const minutes of [1.5, 5, 15]) {
            const begin = Date.now();
            await tick();
            const s = await state(jid);
            assert.equal(s.state, "pending");
            assert.ok(
              new Date(s.due_at).getTime() >= begin + minutes * 60000 - 500,
            );
            await pool.query(
              "update notification_jobs set due_at=UTC_TIMESTAMP(6)-INTERVAL 1 day where id=:p1",
              [jid],
            );
          }
          await tick();
          assert.equal((await state(jid)).state, "failed");
          assert.equal(
            Number(
              (
                await pool.query(
                  "select count(*) n from outbox where type='notification.failed'",
                )
              ).rows[0].n,
            ),
            1,
          );
        } finally {
          globalThis.fetch = native;
          delete process.env.TEST_POLICY_LARK;
          delete process.env.LARK_TEST_GROUP;
        }
      },
    );
    await caseTest(
      "working hours are checked again when overdue sends are claimed",
      async () => {
        await reset();
        const lid = await lead();
        const jid = await job(
          lid,
          "lark",
          "qa",
          {},
          rule({ channels: ["lark"], businessOnly: true }),
        );
        const night = new Date("2026-10-12T14:00:00Z");
        await tick(night);
        const row = await state(jid);
        assert.equal(row.state, "pending");
        assert.equal(
          new Date(row.due_at).toISOString(),
          "2026-10-13T02:00:00.000Z",
        );
      },
    );
    await caseTest(
      "daily digests are per rule/date across the shared pool and do not run early or on disabled days",
      async () => {
        await reset();
        const lid = await lead();
        const other = await lead();
        await pool.query(
          "UPDATE portal_leads SET profile=JSON_SET(profile,'$.team',CAST('\"ops\"' AS JSON)) WHERE id=:p1",
          [other],
        );
        const now = new Date(),
          l = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Jakarta",
            weekday: "short",
          }).format(now);
        const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
          l,
        );
        await saveRule(
          "sales-digest",
          rule({
            event: "daily.digest",
            timing: "digest",
            digestTime: "00:00",
            days: [day],
          }),
        );
        await saveRule(
          "ops-digest",
          rule({
            event: "daily.digest",
            timing: "digest",
            digestTime: "00:00",
            days: [day],
          }),
        );
        await saveRule(
          "future-digest",
          rule({
            event: "daily.digest",
            timing: "digest",
            digestTime: "23:59",
            days: [day],
          }),
        );
        await saveRule(
          "disabled-day",
          rule({
            event: "daily.digest",
            timing: "digest",
            digestTime: "00:00",
            days: [(day + 1) % 7],
          }),
        );
        for (let i = 0; i < 5; i++) await tick();
        const events = (
          await pool.query(
            "SELECT payload FROM outbox WHERE type='daily.digest'",
          )
        ).rows;
        assert.equal(events.length, 2);
        for (const e of events)
          assert.equal(
            e.payload.counts.reduce(
              (n: number, x: any) => n + Number(x.count),
              0,
            ),
            2,
          );
        assert.deepEqual(
          new Set(events.map((e) => e.payload.team)),
          new Set([undefined]),
        );
        assert.equal(
          Number(
            (
              await pool.query(
                "select count(*) n from notification_inbox where employee_id='test-sales'",
              )
            ).rows[0].n,
          ),
          0,
        );
      },
    );
    await caseTest(
      "parallel workers do not duplicate internal delivery or Lark group sends",
      async () => {
        await reset();
        const lid = await lead();
        await saveRule("qa");
        await event(lid);
        await Promise.all(Array.from({ length: 8 }, () => tick()));
        assert.equal(
          Number(
            (await pool.query("select count(*) n from notification_inbox"))
              .rows[0].n,
          ),
          1,
        );
        const config = rule({ channels: ["lark"] });
        for (let i = 0; i < 4; i++) await job(lid, "lark", "qa", {}, config);
        await Promise.all(Array.from({ length: 8 }, () => tick()));
        const rows = (
          await pool.query(
            "select state,count(*) n from notification_jobs where channel='lark' group by state",
          )
        ).rows;
        assert.equal(Number(rows.find((x) => x.state === "simulated")?.n), 1);
      },
    );
    await caseTest(
      "invalid policies and sending/accepted job cancellation are rejected",
      async () => {
        await reset();
        assert.equal(
          (
            await api("/api/crm/notification-rules/bad", {
              config: rule({ channels: ["email"] }),
              enabled: true,
            })
          ).status,
          400,
        );
        const jid = await job(await lead());
        await tick();
        assert.equal(
          (await api("/api/crm/notification-jobs/" + jid + "/cancel", {}))
            .status,
          409,
        );
      },
    );
    await caseTest(
      "concurrent reassignment cannot be reverted by a formerly authorized sales patch",
      async () => {
        await reset();
        const lid = await lead("test-sales");
        const locker = await fixture.connect();
        await locker.query("BEGIN");
        await locker.query(
          "SELECT id FROM portal_leads WHERE id=:p1 FOR UPDATE",
          [lid],
        );
        process.env.MOCK_EMPLOYEE_ID = "test-sales";
        const pending = api(
          "/api/crm/leads/" + lid,
          { currentStage: "Contacted" },
          "PATCH",
        );
        try {
          let waiting = false;
          for (let i = 0; i < 500; i++) {
            waiting =
              Number(
                (
                  await locker.query(
                    "SELECT COUNT(*) n FROM performance_schema.data_lock_waits",
                  )
                ).rows[0].n,
              ) > 0;
            if (waiting) break;
            await new Promise((r) => setTimeout(r, 10));
          }
          assert.equal(waiting, true);
          await locker.query(
            "UPDATE portal_leads SET profile=JSON_SET(profile,'$.owner','test-admin') WHERE id=:p1",
            [lid],
          );
          await locker.query("COMMIT");
          assert.equal((await pending).status, 404);
          const profile = (
            await pool.query("select profile from portal_leads where id=:p1", [
              lid,
            ])
          ).rows[0].profile;
          assert.equal(profile.owner, "test-admin");
          assert.equal(profile.currentStage, "New");
        } finally {
          await locker.query("ROLLBACK");
          await pending.catch(() => {});
          locker.release();
          delete process.env.MOCK_EMPLOYEE_ID;
        }
      },
    );
    await caseTest(
      "integration readiness reports missing credentials without leaking webhook values",
      async () => {
        await reset();
        await pool.query(
          "INSERT INTO notification_channels VALUES('qa',:p1) ON DUPLICATE KEY UPDATE config=VALUES(config)",
          [
            {
              mode: "simulation",
              team: "sales",
              secretRef: "MISSING_QA_WEBHOOK",
            },
          ],
        );
        const r = await api("/api/crm/integration-readiness");
        assert.equal(r.status, 200);
        assert.equal(r.data.releaseReady, false);
        assert.equal(r.data.identity.realPlatformVerified, false);
        assert.equal(r.data.channels[0].webhookConfigured, false);
        assert.equal(r.data.channels[0].realReceiptVerified, false);
        process.env.MOCK_EMPLOYEE_ID = "test-sales";
        assert.equal((await api("/api/crm/integration-readiness")).status, 403);
        delete process.env.MOCK_EMPLOYEE_ID;
      },
    );
    await caseTest(
      "missing channels fail; only explicitly simulated channels count as simulated",
      async () => {
        await reset();
        await pool.query("DELETE FROM notification_channels WHERE id='qa'");
        const lid = await lead(),
          jid = await job(
            lid,
            "lark",
            "qa",
            {},
            rule({ channels: ["lark"], group: "qa" }),
          );
        await tick();
        assert.equal((await state(jid)).state, "failed");
        assert.equal((await state(jid)).result, "Missing notification channel");
      },
    );
    await caseTest(
      "production-built mock environment still requires designated test group",
      async () => {
        await reset();
        const lid = await lead();
        process.env.TEST_POLICY_LARK =
          "https://open.larksuite.com/open-apis/bot/v2/hook/policy-test";
        process.env.NODE_ENV = "production";
        delete process.env.LARK_TEST_GROUP;
        await pool.query(
          "INSERT INTO notification_channels VALUES('qa',:p1) ON DUPLICATE KEY UPDATE config=VALUES(config)",
          [{ mode: "live", team: "sales", secretRef: "TEST_POLICY_LARK" }],
        );
        const jid = await job(
          lid,
          "lark",
          "qa",
          {},
          rule({ channels: ["lark"] }),
        );
        const native = globalThis.fetch;
        let sent = false;
        globalThis.fetch = async (url, options) => {
          if (String(url).includes("policy-test")) {
            sent = true;
            return Response.json({ code: 0 });
          }
          return native(url, options);
        };
        try {
          await tick();
          assert.equal(sent, false);
          assert.equal((await state(jid)).state, "failed");
        } finally {
          globalThis.fetch = native;
          delete process.env.NODE_ENV;
          delete process.env.TEST_POLICY_LARK;
        }
      },
    );
  });
} else {
  test('notification MySQL cancellation requires explicitly authorized isolated MySQL', {skip:"MYSQL_NATIVE_TEST_ENV not supplied; no database verification performed"}, () => {});
}
