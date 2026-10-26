import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkflow } from "../server/portal/salesWorkflow.ts";
import {
  appendBuyingSignals,
  observedBuyingSignals,
} from "../src/utils/crmBuyingSignals.ts";
import { projectBuyingEvidence } from "../src/utils/crmBuyingEvidence.ts";
import { needsTaskPlanning, needsHandling } from "../src/utils/crmContact.ts";
import { prepareTaskInput } from "../src/utils/crmTaskInput.ts";
const base = {
  requestId: "test",
  recordKind: "closure",
  summary: "TEST real work",
  disposition: "independent",
  processingTaskId: null,
  completeTaskIds: [],
};
test("progress and final task closure do not require next arrangements; invalid combinations are rejected", () => {
  assert.doesNotThrow(() => validateWorkflow(base));
  for (const taskOutcome of ["complete", "cancel"])
    assert.doesNotThrow(() =>
      validateWorkflow({
        ...base,
        processingTaskId: "a",
        taskOutcome,
        completeTaskIds: taskOutcome === "complete" ? ["a"] : [],
      }),
    );
  assert.throws(
    () =>
      validateWorkflow({
        ...base,
        processingTaskId: "a",
        taskOutcome: "cancel",
        recordKind: "contact",
        channel: "WhatsApp",
        connectStatus: "Connected",
      }),
    /Invalid task selection/,
  );
  assert.throws(
    () => validateWorkflow({ ...base, nextFollowUpAt: "2099-01-01T00:00:00Z" }),
    /Invalid task action/,
  );
  assert.throws(
    () => validateWorkflow({ ...base, buyingSignalsDetected: "Asked price" }),
    /Invalid buying signal/,
  );
  assert.throws(
    () => validateWorkflow({ ...base, buyingSignalsDetected: ["Not real"] }),
    /Invalid buying signal/,
  );
});
test("multiple new signals accumulate with both scalar and array history, evidence retains every observation", () => {
  const observed = observedBuyingSignals({
    buyingSignalsDetected: ["Asked price", "Asked payment", "Asked price"],
  });
  const profile = {
    buyingSignal: "Asked schedule",
    buyingSignals: ["Ready to enroll"],
  };
  const result = appendBuyingSignals(profile, observed);
  assert.deepEqual(result.buyingSignals, [
    "Ready to enroll",
    "Asked schedule",
    "Asked price",
    "Asked payment",
  ]);
  assert.deepEqual(appendBuyingSignals(profile, []), {});
  const ev = projectBuyingEvidence(
    [
      {
        id: "f",
        kind: "followup.recorded",
        created_at: "2026-10-23",
        data: { buyingSignalsDetected: observed, summary: "Original note" },
      },
    ],
    {},
  );
  assert.equal(ev.length, 2);
  assert.ok(ev.every((e) => e.original === "Original note"));
});
test("taskless active customers await planning, closed or restricted customers and missing task data do not become an empty queue",async()=>{const l={currentStage:'Contacted',attention:{tasks:[]}};assert.equal(needsTaskPlanning(l),false);assert.equal(needsHandling(l,Date.now(),()=>''),false);assert.equal(needsHandling({...l,attention:{error:true,tasks:[]}},Date.now(),()=>''),true);assert.equal(needsHandling({...l,attention:{tasks:[],requestCount:1}},Date.now(),()=>''),false);});
test("editing content accepts existing past time unchanged; changed execution time requires future time and cause", () => {
  const v = {
    command: "edit",
    action: "New action",
    purpose: "",
    reason: "",
    timing: "",
    date: "2020-01-01T10:00",
    originalDate: "2020-01-01T10:00",
  };
  assert.equal(prepareTaskInput(v, "Asia/Jakarta").error, undefined);
  assert.equal(
    prepareTaskInput({ ...v, date: "2099-01-01T10:00" }, "Asia/Jakarta").field,
    "reason",
  );
  assert.ok(
    prepareTaskInput(
      { ...v, date: "2099-01-01T10:00", reason: "Customer agreed" },
      "Asia/Jakarta",
    ).dueAt,
  );
});
