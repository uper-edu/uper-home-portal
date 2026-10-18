import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { completionForEntry } from "../src/utils/crmSalesInput.ts";
import { CrmWorkflowForm } from "../src/components/crm/CrmWorkflowForm.tsx";
import { validateWorkflow } from "../server/portal/salesWorkflow.ts";
test("Sales editor cannot restore other tasks from a stale draft", () => {
  assert.deepEqual(completionForEntry("a", ["b", "a", "c"]), ["a"]);
  assert.deepEqual(completionForEntry(undefined, ["a"]), []);
  assert.deepEqual(completionForEntry("a", []), []);
});
test("Explicit task entry rejects widening or completing from an ordinary record", () => {
  const body = {
    requestId: "test",
    summary: "Original",
    channel: "WhatsApp",
    connectStatus: "Connected",
    disposition: "record_only",
    completeTaskIds: [],
  };
  assert.doesNotThrow(() =>
    validateWorkflow({ ...body, processingTaskId: null }),
  );
  assert.doesNotThrow(() =>
    validateWorkflow({
      ...body,
      disposition: "keep",
      processingTaskId: "a",
      taskOutcome: "complete",
      completeTaskIds: ["a"],
    }),
  );
  for (const extra of [
    { processingTaskId: null, completeTaskIds: ["a"] },
    { processingTaskId: "a", completeTaskIds: ["b"] },
    { processingTaskId: "a", completeTaskIds: ["a", "b"] },
  ])
    assert.throws(
      () => validateWorkflow({ ...body, ...extra, disposition: "keep" }),
      /Invalid task selection/,
    );
});
test("Three-language task form shows fixed context and outcomes, never task multi-selection", () => {
  const lead = {
    id: "l",
    fullName: "Original name",
    owner: "Fadhil",
    currentStage: "Contacted",
    attention: {
      tasks: [
        {
          id: "a",
          kind: "booking",
          status: "open",
          due_at: "2026-10-25T09:00:00Z",
          revision: 0,
          details: { action: "Original action" },
        },
        {
          id: "b",
          kind: "consultation",
          status: "open",
          due_at: "2026-10-26T09:00:00Z",
          details: { action: "Other action" },
        },
      ],
    },
  };
  for (const lang of ["en", "id", "zh"]) {
    const html = renderToStaticMarkup(
      React.createElement(CrmWorkflowForm, {
        lead,
        employee: { id: "Fadhil" },
        selectedTask: "a",
        lang,
        timezone: "Asia/Jakarta",
        initialDraft: { completed: ["a", "b"] },
        workCalendar: {},
      }),
    );
    assert.match(html, /Original action/);
    assert.match(html, /Other action/);
    assert.match(html, /crm-sales-editor-layout/);
    assert.doesNotMatch(html, /type="checkbox"/);
    assert.doesNotMatch(
      html,
      /Complete only selected tasks|仅完成以下勾选任务/,
    );
    assert.match(html, /Keep task open|Biarkan tugas terbuka|保持待处理/);
  }
});
