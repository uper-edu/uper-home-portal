import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactStatistics,
  needsHandling,
  greeting,
} from "../src/utils/crmContact.ts";
import { defaultLeadFilters } from "../src/utils/crmLeadFilters.ts";
import { validateWorkflow } from "../server/portal/salesWorkflow.ts";
test("contact evidence separates attempts from responses and excludes unknown times and admin records", () => {
  const lead = {
    followUpLogs: [
      {
        id: "connected",
        timestamp: "2026-10-01T10:00Z",
        connectStatus: "Connected",
        summary: "原文",
      },
      {
        id: "retry",
        timestamp: "2026-10-02T10:00Z",
        connectStatus: "No Response",
      },
      { timestamp: "1970-01-01T00:00Z", connectStatus: "Connected" },
      {
        timestamp: "2026-10-03T10:00Z",
        recordKind: "closure",
        connectStatus: "Connected",
      },
      { timestamp: "2026-10-04T10:00Z", connectStatus: "Interested" },
    ],
  };
  const stats = contactStatistics(lead);
  assert.equal(stats.attemptCount, 2);
  assert.equal(stats.connectedCount, 1);
  assert.equal(stats.lastConnected.id, "connected");
  assert.equal(stats.lastAttempt.id, "retry");
  assert.equal(stats.lastConnected.summary, "原文");
});
test("facts do not turn into work obligations; only first requirement and real agreements do",async()=>{const now=Date.parse('2026-11-01T10:00:00Z'),day=n=>new Date(n).toISOString().slice(0,10);const p={attention:{tasks:[]},currentStage:'Contacted'};assert.equal(needsHandling(p,now,day),false);assert.equal(needsHandling({...p,attention:{tasks:[],requestCount:1}},now,day),false);assert.equal(needsHandling({...p,commitments:[{status:'active',date:'2026-11-01'}]},now,day),true);assert.equal(needsHandling({...p,commitments:[{status:'active',date:'2026-11-02'}]},now,day),false);assert.equal(needsHandling({},now,day),true);});
test("language unknown cannot produce an interface-driven greeting and ambiguous contact is rejected", () => {
  assert.equal(greeting("unknown", "原名", "Robert"), "");
  assert.match(greeting("id", "原名", "Robert"), /Halo 原名/);
  assert.throws(
    () =>
      validateWorkflow({
        requestId: "a",
        summary: "note",
        completeTaskIds: [],
        channel: "WhatsApp",
        connectStatus: "",
        disposition: "keep",
      }),
    /contact result/,
  );
  assert.throws(
    () =>
      validateWorkflow({
        requestId: "a",
        summary: "note",
        recordKind: "closure",
        completeTaskIds: [],
        disposition: "none",
        noNextReason: "old",
      }),
    /contact arrangement/,
  );
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  const fixture = await setupNativeTest("crmEfficiency");
  await test("MySQL: stopped/nurture/recovery, foreign task rejection and transaction rollback", async () => {
    const { saveSalesWorkflow } =
      await import("../server/portal/salesWorkflow.ts");

    const db = await fixture.connect();
    await db.connect();
    await db.query("BEGIN");
    try {
      const id = "test-rollback-" + Date.now();
      await db.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [
        id,
        {
          id,
          owner: "Fadhil",
          tier: "Hot",
          currentStage: "Contacted",
          quizScore: 8,
          followUpLogs: [],
        },
      ]);
      const task = id + "-task";
      await db.query(
        "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,'follow_up','Fadhil','2030-01-01')",
        [task, id],
      );
      const due = (
        await db.query("SELECT due_at FROM followup_tasks WHERE id=:p1", [task])
      ).rows[0].due_at;
      const body: any = {
        requestId: "stop",
        recordKind: "closure",
        summary: "TEST stop",
        completeTaskIds: [],
        disposition: "none",
        contactArrangement: {
          state: "stopped",
          reason: "TEST customer request",
          version: 0,
        },
      };
      const stop = await saveSalesWorkflow(db, id, "Fadhil", body, () => true);
      assert.equal(stop.lead.contactArrangement.state, "stopped");
      assert.equal(stop.lead.touchCount, 0);
      assert.equal(stop.lead.tier, "Hot");
      assert.equal(stop.lead.quizScore, 8);
      const recover = await saveSalesWorkflow(
        db,
        id,
        "Fadhil",
        {
          ...body,
          requestId: "recover",
          disposition: "keep",
          contactArrangement: {
            state: "active",
            reason: "TEST owner review",
            version: 1,
          },
        },
        () => true,
      );
      assert.equal(recover.lead.contactArrangement.state, "active");
      assert.deepEqual(
        (
          await db.query("SELECT due_at FROM followup_tasks WHERE id=:p1", [
            task,
          ])
        ).rows[0].due_at,
        due,
      );
      await db.query("SAVEPOINT denied");
      await assert.rejects(
        saveSalesWorkflow(
          db,
          id,
          "Wigar",
          { ...body, requestId: "deny" },
          () => false,
        ),
        /not found/,
      );
      await db.query("ROLLBACK TO denied");
      await db.query("SAVEPOINT foreign_task");
      await assert.rejects(
        saveSalesWorkflow(
          db,
          id,
          "Fadhil",
          {
            ...body,
            requestId: "foreign",
            contactArrangement: {
              state: "stopped",
              reason: "TEST foreign task",
              version: 2,
            },
            completeTaskIds: ["other-lead-task"],
          },
          () => true,
        ),
        /changed|reason/,
      );
      await db.query("ROLLBACK TO foreign_task");
      await db.query("SAVEPOINT fail");
      await db.query(
        "CREATE TEMPORARY TABLE efficiency_failure(flag int CHECK(flag=1))",
      );
      await assert.rejects(
        (async () => {
          await saveSalesWorkflow(
            db,
            id,
            "Fadhil",
            {
              requestId: "rollback",
              recordKind: "closure",
              summary: "TEST administrative completion",
              completeTaskIds: [task],
              disposition: "none",
              contactArrangement: {
                state: "nurture",
                reason: "TEST pause",
                reviewAt: "2030-03-01T09:00Z",
                version: 2,
              },
            },
            () => true,
          );
          await db.query("INSERT INTO efficiency_failure VALUES(2)");
        })(),
      );
      await db.query("ROLLBACK TO fail");
      assert.equal(
        (
          await db.query("SELECT status FROM followup_tasks WHERE id=:p1", [
            task,
          ])
        ).rows[0].status,
        "open",
      );
      assert.equal(
        (await db.query("SELECT profile FROM portal_leads WHERE id=:p1", [id]))
          .rows[0].profile.contactArrangement.state,
        "active",
      );
    } finally {
      await db.query("ROLLBACK");
      await db.end();
      await (await import("../server/portal/store.ts")).pool.end();
    }
  });
}

test("staff page-memory drafts survive same-account remount and are isolated and removed at sign out", async () => {
  const { draftsFor, clearStaffDrafts } =
    await import("../src/utils/crmDrafts.ts");
  const first = draftsFor("TEST-sales-a");
  first.customer = { summary: "private staff draft", requestId: "retry-key" };
  assert.equal(draftsFor("TEST-sales-a").customer.requestId, "retry-key");
  assert.equal(draftsFor("TEST-sales-b").customer, undefined);
  clearStaffDrafts("TEST-sales-a");
  assert.equal(draftsFor("TEST-sales-a").customer, undefined);
  clearStaffDrafts("TEST-sales-b");
});
