import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmFollowUp } from "../src/components/crm/CrmFollowUp.tsx";
import {
  describeFollowUpTask,
  leadFollowUp,
  pendingFollowUps,
  type FollowUpTask,
} from "../src/utils/crmFollowUp.ts";
import type { CrmLeadRecord } from "../src/types/crmLead.ts";

const now = Date.parse("2026-10-13T17:30:00Z"); // Oct 14, 00:30 Jakarta.
const task = (
  id: string,
  kind: string,
  dueAt: string,
  status = "open",
): FollowUpTask => ({ id, kind, dueAt, status, ownerId: "Fadhil" });
const lead = (tasks: FollowUpTask[], extra = {}) =>
  ({
    id: "synthetic",
    owner: "Fadhil",
    attention: { tasks },
    ...extra,
  }) as CrmLeadRecord;
const render = (value: CrmLeadRecord, lang: "zh" | "en" = "en") =>
  renderToStaticMarkup(
    React.createElement(CrmFollowUp, {
      lead: value,
      lang,
      timezone: "Asia/Jakarta",
      now,
      isLight: true,
      employees: [{ id: "Wigar", displayName: "Wigar" }],
      onOpen() {},
    }),
  );

test("one selected real task supplies action, state and deadline despite historical placeholders and stale notes", () => {
  const tasks = [
    task("historic", "handoff", "1970-01-01", "migration_hold"),
    task("later", "enrollment", "2026-10-15"),
    task("earliest", "booking", "2026-10-13T17:00:00Z"),
  ];
  const original = JSON.stringify(tasks);
  const summary = leadFollowUp(
    lead(tasks, { nextAction: "Send brochure" }),
    "en",
    "Asia/Jakarta",
    now,
  );
  assert.equal(summary.next?.task.id, "earliest");
  assert.equal(summary.next?.action, "Confirm booking");
  assert.equal(summary.next?.tone, "overdue");
  assert.equal(summary.next?.timing, "Overdue · Due 2026-10-14 00:00");
  assert.equal(summary.additionalCount, 2);
  assert.equal(summary.note, "Send brochure");
  assert.equal(JSON.stringify(tasks), original);
});

test("completed/cancelled tasks and stale lead-level SLA dates cannot create pending work", () => {
  const value = lead(
    [
      task("done", "booking", "2020-01-01", "completed"),
      task("cancelled", "handoff", "2020-01-01", "cancelled"),
    ],
    { slaDueTime: "2020-01-01", nextFollowUpAt: "2020-01-01" },
  );
  assert.equal(leadFollowUp(value, "en", "Asia/Jakarta", now).next, null);
  const html = render(value);
  assert.equal((html.match(/Next step not scheduled/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<time|Overdue|👉/);
  assert.equal((render(value, "zh").match(/未安排下一步/g) ?? []).length, 1);
});

test("manual notes survive without tasks and never become a fabricated scheduled action", () => {
  const value = lead([], { nextAction: "Call Robert\nDiscuss <plan> & fees" });
  const html = render(value);
  assert.match(html, /Next step not scheduled/);
  assert.match(html, /Note: /);
  assert.match(html, /Call Robert\nDiscuss &lt;plan&gt; &amp; fees/);
  assert.doesNotMatch(html, /<time/);
  assert.match(render(value, "zh"), /跟进备注：/);
});

test("historical placeholders, epoch and malformed deadlines stay unverified in both languages", () => {
  for (const value of [
    task("h", "handoff", "1970-01-01", "migration_hold"),
    task("hf", "booking", "2099-01-01", "migration_hold"),
    task("e", "consultation", "1970-01-01"),
    task("bad", "follow_up", "not-a-date"),
  ]) {
    for (const lang of ["zh", "en"] as const) {
      const description = describeFollowUpTask(
        value,
        lang,
        "Asia/Jakarta",
        now,
      );
      assert.equal(description.deadline, null);
      assert.equal(description.tone, "review");
      assert.doesNotMatch(
        render(lead([value]), lang),
        /1970|2099|Invalid Date|已逾期|Overdue|<time/,
      );
    }
  }
});

test("due today follows the configured timezone; current time wins over stale status", () => {
  const value = task("today", "booking", "2026-10-14T01:00:00Z", "overdue");
  assert.equal(
    describeFollowUpTask(value, "en", "Asia/Jakarta", now).timing,
    "Due today 08:00",
  );
  assert.equal(
    describeFollowUpTask(value, "zh", "Asia/Jakarta", now).timing,
    "今天 08:00 到期",
  );
  assert.equal(describeFollowUpTask(value, "en", "UTC", now).tone, "normal");
  assert.equal(
    describeFollowUpTask(value, "en", "Asia/Jakarta", Date.parse(value.dueAt))
      .tone,
    "today",
  );
});

test("additional tasks include historical work, exclude completed work and use stable ordering", () => {
  const tasks = [
    task("z", "follow_up", "2026-10-15"),
    task("a", "booking", "2026-10-15"),
    task("u", "enrollment", "unknown"),
    task("h", "handoff", "1970-01-01", "migration_hold"),
    task("d", "consultation", "2020-01-01", "completed"),
  ];
  assert.deepEqual(
    pendingFollowUps(tasks).map((t) => t.id),
    ["a", "z", "u", "h"],
  );
  const html = render(lead(tasks));
  assert.match(html, /\+3 more tasks/);
  assert.match(html, /Confirm booking/);
  assert.doesNotMatch(html, /Arrange advisor contact/);
});

test("task owner is shown only when different, keeping the original name", () => {
  const value = task("b", "booking", "2026-10-15");
  assert.doesNotMatch(render(lead([value])), /Task owner/);
  assert.match(
    render(lead([{ ...value, ownerId: "Wigar" }])),
    /Task owner: Wigar/,
  );
  assert.match(
    render(lead([{ ...value, ownerId: "Wigar" }]), "zh"),
    /任务负责人：Wigar/,
  );
  assert.match(
    render(lead([{ ...value, ownerId: null }])),
    /Task owner: Unassigned/,
  );
});

test("missing task data is not reported as no pending work", () => {
  assert.match(
    render({ owner: "Fadhil", nextAction: "Keep this note" } as CrmLeadRecord),
    /Follow-up information unavailable/,
  );
  assert.doesNotMatch(
    render({ owner: "Fadhil" } as CrmLeadRecord),
    /Next step not scheduled/,
  );
});
