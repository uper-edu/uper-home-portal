import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  followupHistory,
  historyBuyingEvidence,
  historyBuyingLabel,
  followupHistorySource,
} from "../src/utils/crmFollowupHistory.ts";
import { CrmFollowupHistory } from "../src/components/crm/CrmFollowupHistory.tsx";
const questionnaire = (id: string, at: string) => ({
  id,
  kind: "questionnaire.submitted",
  actor: "visitor",
  created_at: at,
  data: {
    answers: {
      buyingSignal: "Asked schedule",
      buyingSignals: ["Asked schedule", "Asked price", "None yet"],
    },
  },
});
const contact = {
  id: "sales-fact",
  kind: "followup.recorded",
  actor: "Fadhil",
  created_at: "2026-10-17T10:11:12Z",
  data: {
    summary: "原文：Customer asked for Saturday.",
    buyingSignalDetected: "Asked schedule",
    result: { logId: "sales-log" },
  },
};
test("Buying evidence belongs to each saved questionnaire or contact; profile-only events are removed, originals retained", () => {
  const facts = [
    questionnaire("first", "2026-10-15T08:09:10Z"),
    questionnaire("returning", "2026-10-16T08:09:10Z"),
    contact,
  ];
  const journey = [
    {
      id: "intake-projection",
      timestamp: "2020-01-01",
      content: "Current profile projection",
    },
    { id: "signal-old", timestamp: "2020-01-01", actorType: "client" },
    {
      id: "log-sales-log",
      timestamp: contact.created_at,
      buyingSignalDetected: "Asked schedule",
    },
    {
      id: "log-legacy",
      category: "follow_up",
      actorType: "consultant",
      timestamp: "",
      buyingSignalDetected: "Asked price",
    },
    {
      id: "chat-original",
      actorType: "client",
      timestamp: "2026-10-17T09:00:00Z",
      content: "When does class start?",
    },
  ];
  const before = JSON.stringify({ facts, journey });
  const rows = followupHistory(facts, journey);
  assert.equal(rows.length, 5);
  assert.ok(
    !rows.some(
      (r) => r.id.includes("signal-old") || r.id === "journey-log-sales-log",
    ),
  );
  assert.deepEqual(
    historyBuyingEvidence(rows.find((r) => r.id === "fact-first")),
    { kind: "questionnaire", values: ["Asked schedule", "Asked price"] },
  );
  assert.equal(
    rows.filter((r) => historyBuyingEvidence(r)?.kind === "questionnaire")
      .length,
    2,
  );
  assert.equal(
    historyBuyingEvidence(rows.find((r) => r.id === "journey-chat-original")),
    null,
  );
  const legacy = rows.find((r) => r.id === "journey-log-legacy");
  assert.equal(legacy?.at, "");
  assert.equal(followupHistorySource(legacy), "sales");
  assert.deepEqual(historyBuyingEvidence(legacy), {
    kind: "sales",
    values: ["Asked price"],
  });
  assert.equal(JSON.stringify({ facts, journey }), before);
});
test("Three languages show interests vs staff-recorded inquiry in original event, exact time to seconds, without standalone duplicates", () => {
  for (const lang of ["en", "id", "zh"]) {
    const html = renderToStaticMarkup(
      React.createElement(CrmFollowupHistory, {
        facts: [questionnaire("q", "2026-10-15T08:09:10Z"), contact],
        journey: [
          { id: "log-sales-log", content: "DUPLICATE" },
          { id: "signal-old", timestamp: "2020-01-01", content: "UNSUPPORTED" },
        ],
        tasks: [],
        lang,
        timezone: "Asia/Jakarta",
        kindLabel: (s: string) => s,
        onClearTask: () => {},
      }),
    );
    assert.equal((html.match(/data-history-id=/g) || []).length, 2);
    assert.match(html, /15:09:10/);
    assert.match(html, /17:11:12/);
    assert.match(html, /data-evidence-kind="questionnaire"/);
    assert.match(html, /data-evidence-kind="sales"/);
    assert.ok(
      html.includes(
        historyBuyingLabel("Asked schedule", "questionnaire", lang).replaceAll(
          "&",
          "&amp;",
        ),
      ),
    );
    assert.ok(
      html.includes(historyBuyingLabel("Asked schedule", "sales", lang)),
    );
    assert.match(html, /原文：Customer asked for Saturday./);
    assert.doesNotMatch(
      html,
      /DUPLICATE|UNSUPPORTED|Source not recorded|来源未记录|Sumber tidak tercatat/,
    );
  }
});
test("Missing provenance or no-new-signal does not fabricate interest or time; unknown stored text stays literal", () => {
  assert.equal(
    historyBuyingEvidence({
      fact: { kind: "questionnaire.submitted", data: {} },
    }),
    null,
  );
  assert.equal(
    historyBuyingEvidence({
      fact: {
        kind: "followup.recorded",
        data: { buyingSignalDetected: "None yet" },
      },
    }),
    null,
  );
  assert.equal(
    historyBuyingEvidence({ event: { content: "Asked schedule" } }),
    null,
  );
  assert.equal(historyBuyingLabel("原文 custom", "sales", "en"), "原文 custom");
  const rows = followupHistory([questionnaire("unknown", "")], []);
  assert.equal(rows[0].at, "");
});
