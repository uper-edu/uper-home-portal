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

test("All languages show undecided new fields while retaining fixed context, saved stage and explicit drafts",async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {CrmWorkflowForm}=await import('../src/components/crm/CrmWorkflowForm.tsx');const render=(lang,extra={})=>renderToStaticMarkup(React.createElement(CrmWorkflowForm,{lead:{id:'TEST',fullName:'Original customer',currentStage:'Contacted'},employee:{id:'Fadhil'},lang,isLight:true,timezone:'Asia/Jakarta',...extra}));for(const lang of ['en','id','zh']){const h=render(lang);assert.doesNotMatch(h,/Fadhil/);assert.match(h,/Select the actual result|Pilih hasil nyata|选择实际结果/);assert.match(h,/type="submit" disabled/);const d=render(lang,{initialDraft:{simple:{recordKind:'contact',summary:'Retained original draft',channel:'WhatsApp',connectStatus:'No Response'}}});assert.match(d,/Retained original draft/);assert.doesNotMatch(render(lang,{initialDraft:{summary:'Wrong old task draft'}}),/Wrong old task draft/);}});
