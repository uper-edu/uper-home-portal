import test from "node:test";
import assert from "node:assert/strict";
import {
  requestEvidenceId,
  requestDeadline,
} from "../server/portal/taskManagement.ts";
import {
  projectPendingTasks,
  presentFollowUpTask,
} from "../src/utils/crmTaskPresentation.ts";
test("request identity includes customer, conversation, message and request kind; deadlines never rewrite tasks", () => {
  const key = requestEvidenceId("l", "c", "m", "booking");
  assert.equal(key, requestEvidenceId("l", "c", "m", "booking"));
  for (const args of [
    ["x", "c", "m", "booking"],
    ["l", "x", "m", "booking"],
    ["l", "c", "x", "booking"],
    ["l", "c", "m", "enrollment"],
  ])
    assert.notEqual(
      key,
      requestEvidenceId(...(args as [string, string, string, string])),
    );
  const task = { id: "t", due_at: "2099-01-01T00:00:00Z" };
  assert.equal(
    requestDeadline(task, [
      {
        task_id: "t",
        state: "linked",
        data: { dueAt: "2026-10-20T00:00:00Z" },
      },
    ]),
    "2026-10-20T00:00:00Z",
  );
  assert.equal(task.due_at, "2099-01-01T00:00:00Z");
  assert.equal(
    requestDeadline(task, [
      {
        task_id: "t",
        state: "handled",
        data: { dueAt: "2026-10-20T00:00:00Z" },
      },
    ]),
    task.due_at,
  );
});
test("source request urgency is visible while original and rescheduled times remain intact in three languages", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    const view = presentFollowUpTask(
      {
        id: "t",
        kind: "booking",
        status: "open",
        dueAt: "2099-01-01T00:00:00Z",
        requestDueAt: "2026-10-20T00:00:00Z",
        scheduledAt: "2099-02-01T00:00:00Z",
      },
      lang,
      "Asia/Jakarta",
      Date.parse("2026-10-22"),
    );
    assert.equal(view.tone, "overdue");
    assert.equal(view.times.length, 3);
    assert.equal(view.task.dueAt, "2099-01-01T00:00:00Z");
  }
  assert.equal(
    projectPendingTasks([
      { id: "future", kind: "follow_up", status: "open", dueAt: "2099-01-01" },
      {
        id: "request",
        kind: "booking",
        status: "open",
        dueAt: "2099-02-01",
        requestDueAt: "2026-01-01",
      },
    ])[0].id,
    "request",
  );
});
test('single-customer task priority uses deadline buckets, explicit requests, then ordinary tasks without changing dates',()=>{
 const now=Date.parse('2026-10-22T10:00:00Z');
 const tasks=[{id:'ordinary',kind:'follow_up',status:'open',dueAt:'2026-10-23T08:00:00Z'},{id:'booking',kind:'booking',status:'open',dueAt:'2099-01-01T00:00:00Z'},{id:'today',kind:'follow_up',status:'open',dueAt:'2026-10-22T12:00:00Z'},{id:'overdue',kind:'follow_up',status:'open',dueAt:'2026-10-21T12:00:00Z'}];
 assert.deepEqual(projectPendingTasks(tasks,undefined,now,'Asia/Jakarta').map(t=>t.id),['overdue','today','booking','ordinary']);
 assert.equal(tasks[0].dueAt,'2026-10-23T08:00:00Z');
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  await setupNativeTest("followup_multitask");
  const { pool, tx } = await import("../server/portal/store.ts");
  const { ensureFollowup } = await import("../server/portal/followup.ts");
  const { taskCommand } = await import("../server/portal/trustWorkflow.ts");
  const { saveSalesWorkflow } =
    await import("../server/portal/salesWorkflow.ts");
  test("MySQL Follow-up A: source retries, separate matters, explicit changes, selected completion and concurrency", async (t) => {
    t.after(() => pool.end());
    const { defaults } = await import("../server/portal/policy.ts");
    await pool.query(
      "INSERT INTO portal_settings(id,value) VALUES('sla',:p1)",
      [{ ...defaults, hotHours: 1, warmHours: 24, coldHours: 72 }],
    );
    const leadId = "TEST-MULTI",
      can = (p: any) => p.owner === "Fadhil";
    await pool.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)", [
      leadId,
      {
        id: leadId,
        owner: "Fadhil",
        currentStage: "Contacted",
        tier: "Hot",
        tierConfirmed: true,
        quizScore: 81,
        followUpLogs: [],
      },
    ]);
    const { randomUUID } = await import("node:crypto");
    const visitor = randomUUID();
    await pool.query(
      "INSERT INTO visitor_sessions(id,expires_at) VALUES(:p1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",
      [visitor],
    );
    await pool.query(
      "INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES('multi-conv',:p1,:p2,'TEST')",
      [visitor, leadId],
    );
    const conv = { id: "multi-conv", lead_id: leadId, source: "TEST" };
    const inbound = async (message: string, action: any = "booking") => {
      await pool.query(
        "INSERT IGNORE INTO messages(id,conversation_id,request_id,role,content,status) VALUES(:p1,'multi-conv',:p1,'user',:p2,'saved')",
        [message, "TEST " + message],
      );
      return tx((c) => ensureFollowup(c, conv, action, message, "en"));
    };
    const first = await inbound("multi-first");
    assert.equal(first.taskOperation, "created");
    assert.ok(first.taskId);
    const oldTask = (
      await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
        first.taskId,
      ])
    ).rows[0];
    await Promise.all(Array.from({ length: 10 }, () => inbound("multi-first")));
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM crm_engagements WHERE kind='task_request'",
        )
      ).rows.length,
      1,
    );
    const second = await inbound("multi-second");
    assert.equal(second.taskId, null);
    assert.equal(second.taskOperation, "review_required");
    let sources = (
      await pool.query(
        "SELECT * FROM crm_engagements WHERE kind='task_request' ORDER BY id",
      )
    ).rows;
    const secondSource = sources.find(
      (r: any) => r.data.messageId === "multi-second",
    );
    const action = async (body: any, allow = can) =>
      tx((c) =>
        taskCommand(
          c,
          leadId,
          "Fadhil",
          { requestId: randomUUID(), ...body },
          allow,
        ),
      );
    await assert.rejects(
      () =>
        action({
          command: "create",
          reason: "test",
          action: "x",
          purpose: "y",
          timingKind: "response",
          dueAt: "2099-01-01T00:00:00Z",
        }),
      /separate/,
    );
    const linked = await action({
      command: "link_request",
      reason: "TEST same appointment",
      taskId: first.taskId,
      revision: oldTask.revision,
      requestEvidenceId: secondSource.id,
      requestEvidenceVersion: secondSource.version,
    });
    assert.equal(linked.taskId, first.taskId);
    assert.equal(
      (
        await pool.query("SELECT * FROM followup_tasks WHERE lead_id=:p1", [
          leadId,
        ])
      ).rows.length,
      1,
    );
    let task = (
      await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
        first.taskId,
      ])
    ).rows[0];
    await action({
      command: "supplement",
      taskId: task.id,
      revision: task.revision,
      reason: "TEST bring a friend",
    });
    task = (
      await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [task.id])
    ).rows[0];
    assert.equal(task.details.additions[0].text, "TEST bring a friend");
    assert.equal(+task.due_at, +oldTask.due_at);
    const rev = task.revision;
    const concurrent = await Promise.allSettled(
      ["2099-02-01T00:00:00Z", "2099-03-01T00:00:00Z"].map((scheduledAt) =>
        action({
          command: "reschedule",
          taskId: task.id,
          revision: rev,
          reason: "TEST reschedule",
          scheduledAt,
        }),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((r) => r.status === "rejected").length, 1);
    task = (
      await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [task.id])
    ).rows[0];
    assert.equal(+task.due_at, +oldTask.due_at);
    await assert.rejects(
      () =>
        action({
          command: "cancel",
          reason: "TEST cancel",
          taskId: task.id,
          revision: task.revision,
        }),
      /linked requests/,
    );
    const replacement = await action({
      command: "replace",
      sameMatterConfirmed: true,
      reason: "TEST replace obsolete work",
      taskId: task.id,
      revision: task.revision,
      action: "Confirm online session",
      purpose: "Customer changed plan",
      timingKind: "appointment",
      dueAt: "2099-04-01T00:00:00Z",
    });
    assert.equal(
      (
        await pool.query("SELECT status FROM followup_tasks WHERE id=:p1", [
          task.id,
        ])
      ).rows[0].status,
      "cancelled",
    );
    sources = (
      await pool.query(
        "SELECT * FROM crm_engagements WHERE kind='task_request'",
      )
    ).rows;
    assert.ok(sources.every((r: any) => r.task_id === replacement.newTaskId));
    await inbound("multi-third");
    const thirdSource = (
      await pool.query(
        "SELECT * FROM crm_engagements WHERE kind='task_request' AND state='pending'",
      )
    ).rows[0];
    const createReqBody = {
      requestId: randomUUID(),
      command: "create_request",
      reason: "TEST a separate appointment",
      action: "Confirm another appointment",
      purpose: "Different appointment",
      requestEvidenceId: thirdSource.id,
      requestEvidenceVersion: thirdSource.version,
    };
    const created = await tx((c) =>
      taskCommand(c, leadId, "Fadhil", createReqBody, can),
    );
    // exact retry returns result even after task state changes
    assert.equal(
      (await tx((c) => taskCommand(c, leadId, "Fadhil", createReqBody, can)))
        .replayed,
      true,
    );
    await assert.rejects(
      () =>
        action(
          {
            command: "supplement",
            reason: "TEST",
            taskId: created.newTaskId,
            revision: 1,
          },
          () => false,
        ),
      /Lead not found/,
    );
    const current = (
      await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
        replacement.newTaskId,
      ])
    ).rows[0];
    sources = (
      await pool.query(
        "SELECT * FROM crm_engagements WHERE kind='task_request' AND state='linked'",
      )
    ).rows;
    const saveBody = {
      requestId: randomUUID(),
      summary: "TEST handled selected requests",
      recordKind: "closure",
      completeTaskIds: [current.id],
      processingTaskId: current.id,
      taskOutcome: "complete",
      expectedTaskRevision: current.revision,
      disposition: "keep",
    };
    await assert.rejects(
      () => tx((c) => saveSalesWorkflow(c, leadId, "Fadhil", saveBody, can)),
      /requests handled/,
    );
    const boundSources = sources.filter((r: any) => r.task_id === current.id);
    const partial = await tx((c) =>
      saveSalesWorkflow(
        c,
        leadId,
        "Fadhil",
        {
          ...saveBody,
          requestId: randomUUID(),
          completeTaskIds: [],
          taskOutcome: "keep",
          handledRequests: [
            { id: boundSources[0].id, version: boundSources[0].version },
          ],
        },
        can,
      ),
    );
    assert.equal(partial.handledRequestIds.length, 1);
    assert.equal(
      (
        await pool.query("SELECT status FROM followup_tasks WHERE id=:p1", [
          current.id,
        ])
      ).rows[0].status,
      "open",
    );
    const save = {
      ...saveBody,
      handledRequests: boundSources
        .slice(1)
        .map((r: any) => ({ id: r.id, version: r.version })),
    };
    const result = await tx((c) =>
      saveSalesWorkflow(c, leadId, "Fadhil", save, can),
    );
    assert.equal(result.handledRequestIds.length, 1);
    assert.equal(result.lead.touchCount, 0);
    assert.equal(result.lead.quizScore, 81);
    assert.equal(
      (await tx((c) => saveSalesWorkflow(c, leadId, "Fadhil", save, can)))
        .replayed,
      true,
    );
    assert.equal(
      (
        await pool.query("SELECT status FROM followup_tasks WHERE id=:p1", [
          created.newTaskId,
        ])
      ).rows[0].status,
      "open",
    );
    assert.equal((await inbound("multi-first")).taskId, first.taskId);
    assert.equal(
      (
        await pool.query("SELECT status FROM followup_tasks WHERE id=:p1", [
          first.taskId,
        ])
      ).rows[0].status,
      "cancelled",
    );
    const before = (
      await pool.query(
        "SELECT COUNT(*) n FROM followup_tasks WHERE lead_id=:p1",
        [leadId],
      )
    ).rows[0].n;
    await assert.rejects(
      () =>
        tx(async (c) => {
          await taskCommand(
            c,
            leadId,
            "Fadhil",
            {
              requestId: randomUUID(),
              command: "create",
              relationDecision: "separate",
              reason: "TEST rollback",
              action: "Test rollback",
              purpose: "TEST fault",
              timingKind: "response",
              dueAt: "2099-06-01T00:00:00Z",
            },
            can,
          );
          throw Error("TEST injected failure");
        }),
      /injected/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT COUNT(*) n FROM followup_tasks WHERE lead_id=:p1",
          [leadId],
        )
      ).rows[0].n,
      before,
    );
    const changeBody = {
      requestId: randomUUID(),
      summary: "TEST supplement in follow-up form",
      recordKind: "closure",
      completeTaskIds: [],
      disposition: "schedule",
      nextPurpose: "TEST updated arrival note",
      nextTaskChange: {
        command: "supplement",
        taskId: created.newTaskId,
        revision: (
          await pool.query("SELECT revision FROM followup_tasks WHERE id=:p1", [
            created.newTaskId,
          ])
        ).rows[0].revision,
      },
    };
    const changed = await tx((c) =>
      saveSalesWorkflow(c, leadId, "Fadhil", changeBody, can),
    );
    assert.equal(changed.taskChange.command, "supplement");
    assert.equal(changed.createdTaskId, null);
    const { leadChanges } = await import("../server/portal/leadChanges.ts");
    const employee: any = {
      id: "Fadhil",
      permissions: ["crm.read", "crm.write"],
      scope: "own",
      roles: ["sales"],
    };
    const cursor = (await leadChanges(pool, employee)).cursor;
    await pool.query(
      "UPDATE crm_engagements SET version=version+1 WHERE id=:p1",
      [thirdSource.id],
    );
    assert.notEqual(
      (await leadChanges(pool, employee)).cursor,
      cursor,
      "lightweight refresh includes request handling changes",
    );
    await pool.query(
      "INSERT INTO notification_channels(id,config) VALUES('test-multi',:p1)",
      [{ mode: "simulation", maxPerHour: 1000 }],
    );
    for (const event of ["booking.requested", "task.overdue"])
      await pool.query(
        "INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES(:p1,1,:p2,true,'2020-01-01')",
        [
          "multi-" + event,
          {
            ...defaults,
            event,
            channels: ["lark"],
            group: "test-multi",
            calendarMode: "custom",
            businessOnly: false,
            days: [0, 1, 2, 3, 4, 5, 6],
            quiet: undefined,
            dedupeMinutes: 0,
            maxPerHour: 1000,
          },
        ],
      );
    const { tick } = await import("../server/portal/worker.ts");
    const { PLATFORM_MODE: oldMode } = process.env;
    process.env.PLATFORM_MODE = "local";
    await tick(new Date("2030-01-01T12:00:00Z"));
    process.env.PLATFORM_MODE = oldMode;
    const requestJobs = (
      await pool.query(
        "SELECT * FROM notification_jobs WHERE JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.requestEvidenceId'))=:p1",
        [thirdSource.id],
      )
    ).rows;
    assert.ok(
      requestJobs.length > 0,
      "new source request produces jobs under existing event policies",
    );
    assert.ok(
      requestJobs.every((j: any) =>
        ["simulated", "cancelled", "pending"].includes(j.state),
      ),
      JSON.stringify(
        requestJobs.map((j: any) => ({ state: j.state, result: j.result })),
      ),
    );
    const n = (
      await pool.query("SELECT COUNT(*) n FROM outbox WHERE id=:p1", [
        "request-overdue:" + thirdSource.id,
      ])
    ).rows[0].n;
    assert.equal(Number(n), 1);
    await tick(new Date("2030-01-01T12:01:00Z"));
    assert.equal(
      Number(
        (
          await pool.query("SELECT COUNT(*) n FROM outbox WHERE id=:p1", [
            "request-overdue:" + thirdSource.id,
          ])
        ).rows[0].n,
      ),
      1,
    );
  });
}
