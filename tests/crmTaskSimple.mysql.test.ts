import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
if (process.env.MYSQL_NATIVE_TEST_ENV)
  await test("native MySQL: independent progress, complete/terminate, original deadlines, request confirmation, retry and authority", async () => {
    const { setupNativeTest } = await import("./helpers/mysql.mjs");
    await setupNativeTest("task_simple");
    const { pool, tx } = await import("../server/portal/store.ts");
    const { saveSalesWorkflow } =
      await import("../server/portal/salesWorkflow.ts");
    const { taskCommand } = await import("../server/portal/trustWorkflow.ts");
    try {
      const lead = "TEST-SIMPLE",
        owner = "test-sales";
      await pool.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [
        lead,
        {
          id: lead,
          owner,
          fullName: lead,
          currentStage: "Contacted",
          tierConfirmed: true,
          tier: "Warm-Online",
          buyingSignal: "Asked schedule",
          followUpLogs: [],
        },
      ]);
      for (const id of ["a", "b"])
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,original_due_at,timing_kind,details) VALUES(:p1,:p2,'follow_up',:p3,'2099-10-01','2099-10-01','response',:p4)",
          [id, lead, owner, { action: "TEST " + id }],
        );
      await pool.query(
        "INSERT INTO crm_engagements(id,lead_id,source_id,kind,state,task_id,data) VALUES('req',:p1,'TEST-source','task_request','linked','b',:p2)",
        [
          lead,
          { text: "TEST customer request", dueAt: "2099-10-01T00:00:00Z" },
        ],
      );
      for (const [id, taskId, state] of [
        ["notice-a", "a", "pending"],
        ["notice-b", "b", "pending"],
        ["notice-other", "other", "pending"],
        ["notice-accepted", "a", "accepted"],
      ]) {
        await pool.query(
          "INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES(:p1,'task.overdue',:p2,:p3,UTC_TIMESTAMP(6))",
          [id + "-event", lead, {}],
        );
        await pool.query(
          "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES(:p1,:p2,'TEST-rule',1,'lark','test-sales',:p3,'2099-10-01',:p4)",
          [id, id + "-event", state, { payload: { taskId } }],
        );
      }
      const base = {
        recordKind: "closure",
        summary: "TEST progress",
        completeTaskIds: [],
        processingTaskId: null,
        disposition: "independent",
      };
      const save = (b: any, allowed = true) =>
        tx((c) =>
          saveSalesWorkflow(c, lead, owner, { ...base, ...b }, () => allowed),
        );
      const req = {
        requestId: randomUUID(),
        processingTaskId: "a",
        taskOutcome: "keep",
        expectedTaskRevision: 0,
        buyingSignalsDetected: ["Asked price", "Asked payment"],
      };
      const one = await save(req);
      for (let i = 0; i < 10; i++)
        assert.equal((await save(req)).logId, one.logId);
      assert.equal(one.lead.touchCount, 0);
      assert.deepEqual(one.lead.buyingSignals, [
        "Asked schedule",
        "Asked price",
        "Asked payment",
      ]);
      await assert.rejects(
        () => save({ requestId: randomUUID() }, false),
        /Lead not found/,
      );
      await assert.rejects(
        () =>
          tx((c) =>
            taskCommand(
              c,
              lead,
              owner,
              {
                requestId: randomUUID(),
                command: "edit",
                taskId: "a",
                revision: 0,
                action: "Denied",
              },
              () => false,
            ),
          ),
        /Lead not found/,
      );
      const reply = await save({
        requestId: randomUUID(),
        customerReplied: true,
        customerReplySequenceRevision: 0,
        channel: "WhatsApp",
        summary: "TEST customer replied outside CRM",
      });
      assert.equal(reply.lead.touchCount, 0);
      assert.equal(reply.lead.noResponseSequence.status, "replied");
      await taskCommandForEdit();
      async function taskCommandForEdit() {
        await tx((c) =>
          taskCommand(
            c,
            lead,
            owner,
            {
              requestId: randomUUID(),
              command: "edit",
              taskId: "a",
              revision: 0,
              action: "TEST edited",
              reason: "Agreed change",
              scheduledAt: "2099-10-03T00:00:00Z",
            },
            () => true,
          ),
        );
        const task = (
          await pool.query("SELECT * FROM followup_tasks WHERE id='a'")
        ).rows[0];
        assert.equal(
          new Date(task.due_at).toISOString(),
          "2099-10-01T00:00:00.000Z",
        );
        assert.equal(+new Date(task.original_due_at), +new Date(task.due_at));
        assert.equal(
          new Date(task.scheduled_at).toISOString(),
          "2099-10-03T00:00:00.000Z",
        );
      }
      await assert.rejects(
        () =>
          save({
            requestId: randomUUID(),
            processingTaskId: "a",
            taskOutcome: "complete",
            expectedTaskRevision: 0,
            completeTaskIds: ["a"],
          }),
        /Selected task changed/,
      );
      const completed = await save({
        requestId: randomUUID(),
        processingTaskId: "a",
        taskOutcome: "complete",
        expectedTaskRevision: 1,
        completeTaskIds: ["a"],
      });
      assert.deepEqual(completed.completedTaskIds, ["a"]);
      const cancel = {
        requestId: randomUUID(),
        processingTaskId: "b",
        taskOutcome: "cancel",
        expectedTaskRevision: 0,
      };
      await assert.rejects(() => save(cancel), /Choose the requests/);
      assert.equal(
        (await pool.query("SELECT status FROM followup_tasks WHERE id='b'"))
          .rows[0].status,
        "open",
      );
      const r = (
        await pool.query("SELECT * FROM crm_engagements WHERE id='req'")
      ).rows[0];
      const cancelBody = {
        ...cancel,
        handledRequests: [{ id: r.id, version: r.version }],
      };
      const closed = await save(cancelBody);
      assert.equal((await save(cancelBody)).logId, closed.logId);
      assert.deepEqual(closed.cancelledTaskIds, ["b"]);
      assert.deepEqual(closed.handledRequestIds, []);
      assert.equal(closed.createdTaskId, null);
      assert.equal(
        (await pool.query("SELECT state FROM crm_engagements WHERE id='req'"))
          .rows[0].state,
        "dismissed",
      );
      assert.equal(
        Number(
          (
            await pool.query(
              "SELECT COUNT(*) n FROM followup_tasks WHERE status IN ('open','overdue')",
            )
          ).rows[0].n,
        ),
        0,
      );
      const notices = (
        await pool.query("SELECT id,state FROM notification_jobs ORDER BY id")
      ).rows;
      assert.equal(
        notices.find((n: any) => n.id === "notice-a").state,
        "cancelled",
      );
      assert.equal(
        notices.find((n: any) => n.id === "notice-b").state,
        "cancelled",
      );
      assert.equal(
        notices.find((n: any) => n.id === "notice-other").state,
        "pending",
      );
      assert.equal(
        notices.find((n: any) => n.id === "notice-accepted").state,
        "accepted",
      );
    } finally {
      await pool.end();
    }
  });
