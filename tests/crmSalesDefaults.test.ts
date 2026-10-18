import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmWorkflowForm } from "../src/components/crm/CrmWorkflowForm.tsx";
import { validateWorkflow } from "../server/portal/salesWorkflow.ts";
import { crmError } from "../src/utils/crmLanguage.ts";

const input = {
  requestId: "defaults",
  summary: "Original note",
  channel: "Email",
  connectStatus: "No Response",
  completeTaskIds: [],
  disposition: "record_only",
};
test("Saving requires explicit contact, task outcome and next arrangement; internal records remain non-contact", () => {
  for (const [field, message] of [
    ["channel", "Choose a contact channel"],
    ["connectStatus", "Choose a contact result"],
    ["disposition", "Choose the next arrangement"],
  ]) {
    assert.throws(
      () => validateWorkflow({ ...input, [field]: "" }),
      new RegExp(message),
    );
  }
  assert.throws(
    () => validateWorkflow({ ...input, processingTaskId: "task" }),
    /Choose a task outcome/,
  );
  assert.throws(
    () =>
      validateWorkflow({
        ...input,
        processingTaskId: "task",
        taskOutcome: "complete",
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      validateWorkflow({
        ...input,
        processingTaskId: "task",
        taskOutcome: "keep",
        completeTaskIds: ["task"],
      }),
    /does not match/,
  );
  assert.doesNotThrow(() =>
    validateWorkflow({
      ...input,
      processingTaskId: "task",
      taskOutcome: "keep",
    }),
  );
  assert.doesNotThrow(() =>
    validateWorkflow({
      ...input,
      recordKind: "closure",
      channel: undefined,
      connectStatus: undefined,
    }),
  );
  for (const lang of ["zh", "id"] as const) {
    for (const message of [
      "Choose a contact channel",
      "Choose a task outcome",
      "Task outcome does not match completion",
    ])
      assert.notEqual(crmError(message, lang), message);
  }
});

test("All languages show undecided new fields while retaining fixed context, saved stage and explicit drafts", () => {
  const lead = {
    id: "l",
    fullName: "Original customer",
    currentStage: "Contacted",
    attention: {
      tasks: [
        {
          id: "task",
          kind: "booking",
          status: "open",
          due_at: "2026-12-01T00:00:00Z",
          details: { action: "Original task" },
        },
      ],
    },
  };
  for (const lang of ["en", "id", "zh"]) {
    const render = (initialDraft?: any) =>
      renderToStaticMarkup(
        React.createElement(CrmWorkflowForm, {
          lead,
          lang,
          employee: { id: "Fadhil" },
          timezone: "Asia/Jakarta",
          selectedTask: "task",
          initialDraft,
        }),
      );
    const fresh = render();
    assert.match(fresh, /Original customer/);
    assert.match(fresh, /Original task/);
    assert.match(fresh, /Choose a channel|Pilih kanal|请选择沟通方式/);
    assert.match(
      fresh,
      /Choose the next arrangement|Pilih pengaturan berikutnya|请选择后续安排/,
    );
    assert.match(
      fresh,
      /Task outcome not selected|Hasil tugas belum dipilih|尚未选择任务结果/,
    );
    const outcomes = fresh.match(
      /aria-label="(?:Outcome for this task|Hasil untuk tugas ini|此任务处理结果)"[^]*?<\/div>/,
    )?.[0];
    assert.ok(outcomes);
    assert.doesNotMatch(outcomes, /aria-pressed="true"/);
    const draft = render({
      channel: "Email",
      contact: "No Response",
      taskOutcome: "keep",
      completed: [],
      disposition: "record_only",
      summary: "User draft text",
    });
    assert.match(draft, /User draft text/);
    assert.match(draft, /Email|电子邮件/);
    assert.match(draft, /aria-pressed="true"/);
    assert.doesNotMatch(
      draft,
      /Task outcome not selected|Hasil tugas belum dipilih|尚未选择任务结果/,
    );
  }
});
