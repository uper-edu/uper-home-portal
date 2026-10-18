import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  historyTaskReferences,
  historyTouchesTask,
} from "../src/utils/crmFollowupHistory.ts";
import { CrmFollowupHistory } from "../src/components/crm/CrmFollowupHistory.tsx";
test("Task records use exact persisted relationships, including kept-open handling and legacy logs", () => {
  const row = {
    fact: {
      kind: "followup.recorded",
      data: {
        processingTaskId: "a",
        result: { completedTaskIds: [], createdTaskId: "b" },
        nextAction: "new original",
      },
    },
  };
  assert.deepEqual(
    historyTaskReferences(row).map((r) => [r.id, r.relation]),
    [
      ["a", "handled"],
      ["b", "next"],
    ],
  );
  assert.equal(historyTouchesTask(row, "a"), true);
  assert.equal(
    historyTouchesTask({ fact: { kind: "engagement.linked", data: { taskId: "a" } } }, "a"),
    true,
  );
  assert.equal(
    historyTouchesTask({ event: { taskEvidence: row.fact.data } }, "a"),
    true,
  );
  assert.equal(
    historyTouchesTask({ fact: { data: { summary: "a" } } }, "a"),
    false,
  );
  assert.deepEqual(
    historyTaskReferences({
      fact: { kind: "information.recorded", data: { summary: "task a" } },
    }),
    [],
  );
  const done = {
    fact: { data: { processingTaskId: "a", completeTaskIds: ["a"] } },
  };
  assert.deepEqual(
    historyTaskReferences(done).map((r) => [r.id, r.relation]),
    [["a", "completed"]],
  );
});
test("Replacement preserves original snapshot and separates the replacement task", () => {
  const before = { id: "a", details: { action: "original" } };
  const refs = historyTaskReferences({
    fact: {
      kind: "task.replace",
      data: { taskId: "a", newTaskId: "b", before, action: "new" },
    },
  });
  assert.deepEqual(
    refs.map((r) => [r.id, r.relation]),
    [
      ["a", "replace"],
      ["b", "replacement"],
    ],
  );
  assert.equal(refs[0].snapshot, before);
  assert.equal(refs[1].action, "new");
});
test("Three-language timeline exposes task context, current status, event-time reschedule and unavailable references", () => {
  const facts = [
    {
      id: "one",
      kind: "followup.recorded",
      actor: "Fadhil",
      created_at: "2026-10-17T01:00:00Z",
      data: {
        summary: "original note",
        processingTaskId: "a",
        result: { completedTaskIds: [] },
      },
    },
    {
      id: "two",
      kind: "task.reschedule",
      actor: "Fadhil",
      created_at: "2026-10-17T02:00:00Z",
      data: {
        taskId: "a",
        scheduledAt: "2026-10-20T01:00:00Z",
        before: {
          id: "a",
          kind: "booking",
          status: "open",
          details: { action: "snapshot action" },
        },
      },
    },
    {
      id: "three",
      kind: "followup.recorded",
      actor: "Fadhil",
      created_at: "2026-10-17T03:00:00Z",
      data: { processingTaskId: "missing" },
    },
  ];
  for (const lang of ["en", "id", "zh"]) {
    const html = renderToStaticMarkup(
      React.createElement(CrmFollowupHistory, {
        facts,
        journey: [],
        tasks: [
          {
            id: "a",
            kind: "booking",
            status: "completed",
            due_at: "2026-10-22T01:00:00Z",
            details: { action: "current action" },
          },
        ],
        lang,
        timezone: "Asia/Jakarta",
        isLight: true,
        kindLabel: (x: string) => x,
      }),
    );
    assert.match(html, /current action/);
    assert.match(html, /snapshot action/);
    assert.match(html, /original note/);
    assert.match(html, /2026-10-20 08:00:00/);
    assert.match(html, /2026-10-22 08:00/);
    assert.match(html, /data-linked-task-id="missing"/);
    assert.match(html, /Current task|Tugas saat ini|任务当前情况/);
    assert.match(
      html,
      /Handled · kept open|Ditangani · tetap terbuka|本次处理 · 保持待处理/,
    );
  }
});
