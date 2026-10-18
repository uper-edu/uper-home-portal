import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  projectBuyingEvidence,
  actualSignalValues,
  worklistSignal,
  buyingEvidenceLabel,
} from "../src/utils/crmBuyingEvidence.ts";
import { CrmBuyingEvidence } from "../src/components/crm/CrmBuyingEvidence.tsx";

const facts = [
  {
    id: "q",
    kind: "questionnaire.submitted",
    created_at: "2026-10-17T01:02:03Z",
    data: { answers: { buyingSignals: ["Asked schedule"] } },
  },
  {
    id: "s",
    kind: "followup.recorded",
    actor: "Fadhil",
    created_at: "2026-10-17T02:03:04Z",
    data: {
      buyingSignalDetected: "Asked price",
      summary: "客户原文 <script>TEST</script>",
      processingTaskId: "t1",
      result: { logId: "l1" },
    },
  },
  {
    id: "r",
    kind: "task.request_evidence",
    created_at: "2026-10-17T03:04:06Z",
    message_at: "2026-10-17T03:04:05Z",
    message_id: "m1",
    message_content: "我要报名",
    data: {
      action: "enrollment",
      taskId: "t2",
      conversationId: "c1",
      taskOperation: "created",
    },
  },
  {
    id: "r2",
    kind: "task.request_evidence",
    message_at: "2026-10-17T03:04:07Z",
    message_id: "m2",
    message_content: "我要报名",
    data: {
      action: "enrollment",
      taskId: "t2",
      conversationId: "c1",
      taskOperation: "supplemented",
    },
  },
];
test("Projection separates questionnaire interests and actual signals, preserves same-text distinct requests and never changes Tier or inputs", () => {
  const profile = {
    tier: "Warm-Online",
    buyingSignal: "Asked schedule",
    buyingSignals: ["Asked schedule", "Asked payment"],
    followUpLogs: [
      {
        id: "l1",
        buyingSignalDetected: "Asked price",
        summary: "must not duplicate",
      },
    ],
  };
  const before = JSON.stringify({ facts, profile });
  const result = projectBuyingEvidence(facts, profile);
  assert.equal(result.length, 5);
  assert.equal(result.filter((e) => e.kind === "sales").length, 1);
  assert.deepEqual(actualSignalValues({ buyingEvidence: result }), [
    "Ready to enroll",
    "Asked price",
  ]);
  assert.equal(
    result.find((e) => e.id === "r:enrollment")?.at,
    "2026-10-17T03:04:05Z",
  );
  assert.equal(result.filter((e) => e.taskId === "t2").length, 2);
  assert.equal(result.find((e) => e.kind === "legacy")?.at, null);
  assert.equal(
    worklistSignal({ buyingEvidence: result })?.evidence.messageId,
    "m2",
  );
  assert.equal(JSON.stringify({ facts, profile }), before);
});
test("Questionnaire-only and unsupported labels cannot become actual inquiry filters; missing message/time stays missing", () => {
  assert.deepEqual(
    actualSignalValues({
      buyingEvidence: projectBuyingEvidence([facts[0]], {}),
    }),
    [],
  );
  assert.equal(
    worklistSignal({ buyingEvidence: projectBuyingEvidence([facts[0]], {}) })
      ?.evidence.kind,
    "questionnaire",
  );
  const rows = projectBuyingEvidence(
    [
      {
        id: "b",
        kind: "task.request_evidence",
        created_at: "2026-01-01",
        data: { action: "booking", taskId: "task" },
      },
    ],
    {},
  );
  assert.equal(rows[0].at, null);
  assert.equal(rows[0].original, "");
  assert.equal(rows[0].value, "Booking requested");
  assert.equal(
    projectBuyingEvidence(
      [
        {
          kind: "task.request_evidence",
          data: { action: "handoff", taskId: "t" },
        },
      ],
      {},
    ).length,
    0,
  );
});
test("Three-language evidence contains originals, exact seconds and distinct source groups with linked task actions", () => {
  const buyingEvidence = projectBuyingEvidence(facts, {});
  for (const lang of ["en", "id", "zh"]) {
    const html = renderToStaticMarkup(
      React.createElement(CrmBuyingEvidence, {
        lead: { buyingEvidence },
        lang,
        timezone: "Asia/Jakarta",
        onTask: () => {},
        onSource: () => {},
      }),
    );
    assert.ok(html.includes(buyingEvidenceLabel(buyingEvidence[0], lang)));
    assert.match(html, /我要报名/);
    assert.match(html, /客户原文 &lt;script&gt;TEST&lt;\/script&gt;/);
    assert.match(html, /10:04:07/);
    assert.match(html, /09:03:04/);
    assert.equal((html.match(/data-signal-id=/g) || []).length, 4);
    assert.match(html, /tabindex="-1"/);
  }
});

test("SQL UTC message aliases and ISO fact times sort on the same clock", () => {
  const rows = projectBuyingEvidence(
    [facts[1], { ...facts[2], message_at: "2026-10-17 01:04:05.123456" }],
    {},
  );
  assert.equal(rows[0].kind, "sales");
  assert.equal(rows[1].at, "2026-10-17T01:04:05.123456Z");
});
