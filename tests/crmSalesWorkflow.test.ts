import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateWorkflow,
  saveSalesWorkflow,
} from "../server/portal/salesWorkflow.ts";
test("workflow rejects old clients, ambiguous completion and naive dates", () => {
  assert.throws(() => validateWorkflow({ summary: "note" }), /Refresh/);
  assert.throws(
    () =>
      validateWorkflow({
        requestId: "a",
        summary: "note",
        completeTaskIds: ["a", "a"],
        disposition: "keep",
      }),
    /selection/,
  );
  assert.throws(
    () =>
      validateWorkflow({
        requestId: "a",
        summary: "note",
        completeTaskIds: [],
        channel: "Other",
        connectStatus: "Connected",
        disposition: "schedule",
        nextAction: "Send schedule",
        nextPurpose: "Client request",
        nextFollowUpAt: "2099-01-01T09:00",
      }),
    /timezone/,
  );
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  const fixture = await setupNativeTest("crmSalesWorkflow");
  await test("MySQL: selected completion, retry, failure rollback and permissions", async () => {
    const { readFile } = await import("node:fs/promises");
    const db = await fixture.connect();
    await db.connect();
    try {
      await db.query(
        "INSERT INTO portal_leads(id,profile) VALUES('workflow-customer',:p1)",
        [
          {
            owner: "Fadhil",
            tier: "Hot",
            currentStage: "Contacted",
            followUpLogs: [],
          },
        ],
      );
      for (const kind of ["handoff", "booking", "enrollment"])
        await db.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,:p3,:p4,:p5)",
          [kind, "workflow-customer", kind, "Fadhil", "2099-01-01"],
        );
      for (const kind of ["handoff", "booking", "enrollment"]) {
        await db.query(
          "INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,:p2,:p3,:p4)",
          ["event-" + kind, "task.overdue", "workflow-customer", {}],
        );
        await db.query(
          "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,'test',1,'lark','test',UTC_TIMESTAMP(6),:p3)",
          ["job-" + kind, "event-" + kind, { payload: { taskId: kind } }],
        );
      }
      await db.query(
        "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES('accepted-handoff','event-handoff','test',1,'lark','accepted-test','accepted',UTC_TIMESTAMP(6),:p1)",
        [{ payload: { taskId: "handoff" } }],
      );
      const due = (
        await db.query("SELECT id,due_at FROM followup_tasks ORDER BY id")
      ).rows;
      const run = async (body: any, allow = true) => {
        await db.query("BEGIN");
        try {
          const r = await saveSalesWorkflow(
            db,
            "workflow-customer",
            "Fadhil",
            body,
            () => allow,
          );
          await db.query("COMMIT");
          return r;
        } catch (e) {
          await db.query("ROLLBACK");
          throw e;
        }
      };
      const body = {
        requestId: "one",
        summary: "TEST reached customer",
        completeTaskIds: ["handoff"],
        channel: "Other",
        connectStatus: "Connected",
        disposition: "keep",
      };
      const r = await run(body);
      assert.deepEqual(r.completedTaskIds, ["handoff"]);
      assert.equal(r.cancelledNotifications, 1);
      assert.equal(
        (
          await db.query(
            "SELECT state FROM notification_jobs WHERE id='accepted-handoff'",
          )
        ).rows[0].state,
        "accepted",
      );
      assert.equal(
        (
          await db.query(
            "SELECT state FROM notification_jobs WHERE id='job-booking'",
          )
        ).rows[0].state,
        "pending",
      );
      assert.equal(
        (await db.query("SELECT status FROM followup_tasks WHERE id='booking'"))
          .rows[0].status,
        "open",
      );
      assert.equal((await run(body)).replayed, true);
      assert.equal(
        (
          await db.query(
            "SELECT profile FROM portal_leads WHERE id='workflow-customer'",
          )
        ).rows[0].profile.followUpLogs.length,
        1,
      );
      await assert.rejects(
        run(
          {
            ...body,
            requestId: "two",
            completeTaskIds: ["booking"],
            disposition: "none",
            noNextReason: "TEST reason",
          },
          false,
        ),
        /not found/,
      );
      await assert.rejects(
        run({
          ...body,
          requestId: "three",
          completeTaskIds: ["enrollment", "unknown"],
        }),
        /changed/,
      );
      assert.equal(
        (
          await db.query(
            "SELECT status FROM followup_tasks WHERE id='enrollment'",
          )
        ).rows[0].status,
        "open",
      );
      const before = (
        await db.query(
          "SELECT profile FROM portal_leads WHERE id='workflow-customer'",
        )
      ).rows[0].profile;
      await db.query(
        "CREATE TRIGGER workflow_fail BEFORE INSERT ON portal_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST database failure'",
      );
      try {
        await assert.rejects(
          run({
            ...body,
            requestId: "database-failure",
            completeTaskIds: ["booking"],
          }),
          /database failure/,
        );
      } finally {
        await db.query("DROP TRIGGER workflow_fail");
      }
      assert.deepEqual(
        (
          await db.query(
            "SELECT profile FROM portal_leads WHERE id='workflow-customer'",
          )
        ).rows[0].profile,
        before,
      );
      assert.equal(
        (await db.query("SELECT status FROM followup_tasks WHERE id='booking'"))
          .rows[0].status,
        "open",
      );
      assert.equal(
        (
          await db.query(
            "SELECT state FROM notification_jobs WHERE id='job-booking'",
          )
        ).rows[0].state,
        "pending",
      );
      await run({ ...body, requestId: "four", completeTaskIds: [] });
      assert.equal(
        (
          await db.query(
            "SELECT profile FROM portal_leads WHERE id='workflow-customer'",
          )
        ).rows[0].profile.followUpLogs.length,
        2,
      );
      const clients = [await fixture.connect(), await fixture.connect()];
      await Promise.all(clients.map((v) => v.connect()));
      try {
        const attempts = await Promise.all(
          clients.map(async (v) => {
            await v.query("BEGIN");
            try {
              const result = await saveSalesWorkflow(
                v,
                "workflow-customer",
                "Fadhil",
                { ...body, requestId: "concurrent", completeTaskIds: [] },
                () => true,
              );
              await v.query("COMMIT");
              return result;
            } catch (e) {
              await v.query("ROLLBACK");
              throw e;
            }
          }),
        );
        assert.equal(attempts.filter((v) => v.replayed).length, 1);
      } finally {
        await Promise.all(clients.map((v) => v.end()));
      }
      assert.equal(
        (
          await db.query(
            "SELECT profile FROM portal_leads WHERE id='workflow-customer'",
          )
        ).rows[0].profile.followUpLogs.filter(
          (v: any) => v.requestId === "concurrent",
        ).length,
        1,
      );
      assert.deepEqual(
        (await db.query("SELECT id,due_at FROM followup_tasks ORDER BY id"))
          .rows,
        due,
      );
    } finally {
      await db.end();
    }
  });
  await test("MySQL: preserve confirmed group and scores; accumulate new signals using existing rules", async () => {
    const db = await fixture.connect();
    await db.connect();
    try {
      const base = {
        id: "workflow-classification",
        owner: "Fadhil",
        tier: "Warm-Online",
        tierConfirmed: "Warm-Online",
        tierSource: "sales_confirmed",
        currentStage: "Contacted",
        currentStatus: "Working professional",
        goal: "Prepare for HSK certification",
        levelState: "PARTIAL",
        city: "Jakarta",
        mode: "Online",
        buyingSignal: "Asked schedule",
        buyingSignals: ["Asked schedule"],
        quizScore: 30,
        quizMaxScore: 100,
        followUpLogs: [],
      };
      await db.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [
        base.id,
        base,
      ]);
      await db.query(
        "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,'follow_up','Fadhil','2099-01-01')",
        ["classification-next-step", base.id],
      );
      const body = {
        requestId: "classification-one",
        summary: "TEST new price question",
        completeTaskIds: [],
        channel: "Other",
        connectStatus: "Connected",
        disposition: "keep",
        buyingSignalDetected: "Asked price",
      };
      await db.query("BEGIN");
      const first = await saveSalesWorkflow(
        db,
        base.id,
        "Fadhil",
        body,
        () => true,
      );
      await db.query("COMMIT");
      assert.equal(first.lead.tier, "Warm-Online");
      assert.equal(first.lead.owner, "Fadhil");
      assert.equal(first.lead.quizScore, 30);
      assert.equal(first.lead.quizMaxScore, 100);
      assert.deepEqual(first.lead.buyingSignals, [
        "Asked schedule",
        "Asked price",
      ]);
      await db.query(
        "UPDATE portal_leads SET profile=JSON_REMOVE(profile,'$.tierConfirmed','$.tierSource') WHERE id=:p1",
        [base.id],
      );
      await db.query("BEGIN");
      const second = await saveSalesWorkflow(
        db,
        base.id,
        "Fadhil",
        {
          ...body,
          requestId: "classification-two",
          buyingSignalDetected: "None yet",
        },
        () => true,
      );
      await db.query("COMMIT");
      assert.equal(second.lead.tier, "Hot");
      assert.equal(second.lead.buyingSignal, "Asked price");
      assert.deepEqual(second.lead.buyingSignals, [
        "Asked schedule",
        "Asked price",
      ]);
      assert.equal(second.lead.quizScore, 30);
      await db.query("BEGIN");
      const third = await saveSalesWorkflow(
        db,
        base.id,
        "Fadhil",
        {
          ...body,
          requestId: "classification-three",
          recordKind: "closure",
          connectStatus: undefined,
          buyingSignalDetected: "None yet",
        },
        () => true,
      );
      await db.query("COMMIT");
      assert.equal(third.lead.touchCount, second.lead.touchCount);
      assert.equal(third.lead.lastContactedAt, second.lead.lastContactedAt);
    } finally {
      await db.end();
    }
  });
  await (await import("../server/portal/store.ts")).pool.end();
}
test("priority order is explained by current tasks, not old event labels", async () => {
  const { defaultLeadFilters, filterAndSummarize } =
    await import("../src/utils/crmLeadFilters.ts");
  const now = Date.parse("2026-10-13T10:00:00Z");
  const lead = (
    id: string,
    due?: string,
    kind = "follow_up",
    stage = "New",
  ) => ({
    id,
    submittedAt: "2026-01-01",
    owner: "Fadhil",
    tier: "Hot",
    currentStage: stage,
    attention: {
      tasks: due ? [{ id, kind, status: "open", dueAt: due }] : [],
      latest: { type: "task.overdue", at: "2026-01-01" },
    },
  });
  const original = [
    lead("finished", undefined, "follow_up", "Enrolled"),
    lead("not-scheduled"),
    lead("future", "2026-10-20"),
    lead("request", "2026-10-20", "handoff"),
    lead("today", "2026-10-13T11:00:00Z"),
    lead("overdue", "2026-10-13T09:00:00Z"),
  ];
  const copy = JSON.stringify(original);
  const f = defaultLeadFilters("all");
  f.sort = "priority";
  assert.deepEqual(
    filterAndSummarize(original, f, "Fadhil", "Asia/Jakarta", now).leads.map(
      (v) => v.id,
    ),
    ["overdue", "today", "request", "future", "not-scheduled", "finished"],
  );
  assert.equal(JSON.stringify(original), copy);
});
