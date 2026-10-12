import { test } from "node:test";
import assert from "node:assert/strict";
import {
  crmMessageTimestamp,
  normalizeCrmMessage,
  crmMessageTimeLabel,
  compareCrmEventTimes,
} from "../src/utils/crmMessageTime";
const epoch = "1970-01-01T00:00:00.000Z",
  submitted = "2026-09-01T00:00:00Z";
test("legacy missing/invalid time never displays epoch, ingestion date or an invented time", () => {
  for (const originalTimestamp of [undefined, "invalid-time", ""]) {
    const m = {
      status: "legacy",
      created_at: epoch,
      timestamp: submitted,
      error: JSON.stringify({ originalTimestamp, index: 2 }),
    };
    assert.equal(crmMessageTimestamp(m), null);
    const normalized = normalizeCrmMessage(m);
    assert.equal(normalized.timestampKnown, false);
    assert.equal(normalized.timestamp, "");
    assert.equal(
      crmMessageTimeLabel(normalized, "zh", () => {
        throw Error("Formatter must not receive placeholder");
      }),
      "未知时间",
    );
    assert.equal(
      crmMessageTimeLabel(normalized, "en", () => ""),
      "Unknown time",
    );
  }
  assert.equal(
    crmMessageTimestamp({ status: "legacy", created_at: submitted }),
    null,
  );
  assert.equal(
    crmMessageTimestamp({
      status: "legacy",
      created_at: submitted,
      error: "malformed metadata",
    }),
    null,
  );
});
test("known original time is preserved; actual epoch timestamps are not blanket-filtered", () => {
  for (const stamp of [epoch, submitted]) {
    const m = {
      status: "legacy",
      created_at: epoch,
      error: JSON.stringify({ originalTimestamp: stamp, timestampKnown: true }),
    };
    assert.equal(crmMessageTimestamp(m), stamp);
    assert.equal(normalizeCrmMessage(m).timestampKnown, true);
  }
  assert.equal(
    crmMessageTimestamp({ created_at: epoch, status: "completed" }),
    epoch,
  );
  assert.equal(
    crmMessageTimestamp({ timestampKnown: false, timestamp: submitted }),
    null,
  );
  assert.equal(crmMessageTimestamp({ timestamp: "invalid-date" }), null);
});
test("normalization is idempotent and never changes raw content, source dates or original metadata", () => {
  const m = {
    id: "m",
    content: "same text",
    status: "legacy",
    created_at: epoch,
    error: JSON.stringify({ originalTimestamp: "bad", index: 1 }),
  };
  const normalized = normalizeCrmMessage(m);
  assert.deepEqual(normalizeCrmMessage(normalized), normalized);
  assert.equal(normalized.content, m.content);
  assert.equal(normalized.created_at, m.created_at);
  assert.equal(normalized.error, m.error);
  assert.equal(normalized.originalTimestamp, "bad");
});
test("timeline keeps unknown messages in original order after dated events", () => {
  const items = [
    { id: "unknown-1", timestamp: "" },
    { id: "known-old", timestamp: "2026-01-01T00:00:00Z" },
    { id: "unknown-2", timestamp: "" },
    { id: "known-new", timestamp: "2026-10-01T00:00:00Z" },
  ];
  assert.deepEqual(
    items.sort(compareCrmEventTimes).map((x) => x.id),
    ["known-new", "known-old", "unknown-1", "unknown-2"],
  );
});
