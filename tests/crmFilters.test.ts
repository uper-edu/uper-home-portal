import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLeadFilters as defaults,
  filterQuery,
  parseLeadFilters,
  filterAndSummarize,
  leadMatches,
  calendarDay,
} from "../src/utils/crmLeadFilters.ts";
const now = Date.parse("2026-10-13T17:30:00Z"); // Oct 14 00:30 Jakarta; still Oct 13 Los Angeles.
const task = (status: string, dueAt: string) => ({ id: "task", status, dueAt });
const lead = (id: string, tasks: any[] = [], extra: any = {}) => ({
  id,
  fullName: "TEST " + id,
  owner: "Fadhil",
  submittedAt: "2026-10-01",
  tier: "Hot",
  attention: { tasks },
  ...extra,
});
const matches = (l: any, patch: any, tz = "Asia/Jakarta") =>
  leadMatches(l, { ...defaults("all"), ...patch }, "Fadhil", tz, now);
test("role defaults retain owned customers without tasks; explicit unassigned and clear are independent", () => {
  assert.equal(defaults("own").ownership, "mine");
  assert.equal(defaults("all").ownership, "all");
  assert.equal(matches(lead("no-task"), defaults("own")), true);
  assert.equal(
    matches(lead("none", [], { owner: null }), { ownership: "unassigned" }),
    true,
  );
  assert.equal(
    matches(lead("empty", [], { owner: "" }), { ownership: "unassigned" }),
    true,
  );
  assert.equal(matches(lead("assigned"), { ownership: "unassigned" }), false);
  assert.equal(parseLeadFilters({ owner: "" }).ownership, "unassigned");
});
test("today follows operating calendar, includes overdue today, excludes tomorrow and previous date", () => {
  const l = lead("today", [task("open", "2026-10-13T17:00:00Z")]);
  assert.equal(matches(l, { task: "today" }), true);
  assert.equal(matches(l, { task: "today" }, "America/Los_Angeles"), true);
  assert.equal(
    matches(lead("previous", [task("open", "2026-10-13T16:59:59Z")]), {
      task: "today",
    }),
    false,
  );
  assert.equal(
    matches(lead("tomorrow", [task("open", "2026-10-14T17:00:00Z")]), {
      task: "today",
    }),
    false,
  );
  assert.notEqual(
    calendarDay(now, "Asia/Jakarta"),
    calendarDay(now, "America/Los_Angeles"),
  );
  assert.equal(
    matches(lead("tz", [task("open", "2026-10-13T10:00:00Z")]), {
      task: "today",
    }),
    false,
  );
  assert.equal(
    matches(
      lead("tz", [task("open", "2026-10-13T10:00:00Z")]),
      { task: "today" },
      "America/Los_Angeles",
    ),
    true,
  );
});
test("overdue only uses actual unfinished tasks; historical, completed and invalid dates excluded", () => {
  for (const status of ["completed", "cancelled", "migration_hold"])
    assert.equal(
      matches(lead(status, [task(status, "1970-01-01")]), { task: "overdue" }),
      false,
    );
  assert.equal(
    matches(lead("pending", [task("open", "2026-10-13T17:00:00Z")]), {
      task: "overdue",
    }),
    true,
  );
  assert.equal(
    matches(lead("future", [task("overdue", "2026-11-01")]), {
      task: "overdue",
    }),
    false,
  );
  assert.equal(
    matches(lead("bad", [task("open", "unknown")]), { task: "overdue" }),
    false,
  );
  assert.equal(
    matches(lead("historic", [task("migration_hold", "1970-01-01")]), {
      situation: ["historical"],
    }),
    true,
  );
  assert.equal(
    matches(lead("historic", [task("migration_hold", "1970-01-01")]), {
      task: "none",
    }),
    false,
  );
});
test("multi-values OR within fields, AND across fields; signals, unknowns and scoped search", () => {
  assert.equal(
    matches(lead("a", [], { mode: "Online" }), {
      tier: ["Hot", "Cold-Nurture"],
      mode: ["Online"],
    }),
    true,
  );
  assert.equal(
    matches(lead("a", [], { mode: "Offline" }), {
      tier: ["Hot"],
      mode: ["Online"],
    }),
    false,
  );
  assert.equal(
    matches(
      lead("a", [], {
        tier: "Unqualified",
        mode: null,
        buyingSignals: ["Ready to enrol"],
        buyingEvidence:[{id:"sales-1",kind:"sales",value:"Ready to enroll",at:"2026-01-01T00:00:00Z"}],
      }),
      { tier: ["__unknown"], mode: ["__unknown"], signal: ["Ready to enroll"] },
    ),
    true,
  );
  assert.equal(
    matches(
      lead("a", [], {
        email: "TEST@EXAMPLE.INVALID",
        chatTranscript: [{ content: "hidden phrase" }],
      }),
      { search: "test@example.invalid" },
    ),
    true,
  );
  assert.equal(
    matches(lead("a", [], { chatTranscript: [{ content: "hidden phrase" }] }), {
      search: "hidden phrase",
    }),
    false,
  );
  const f = {
    ...defaults("all"),
    tier: ["Hot", "Cold-Nurture"],
    ownership: "unassigned" as const,
  };
  const parsed = parseLeadFilters(
    Object.fromEntries(
      [...new URLSearchParams(filterQuery(f)).keys()].map((k) => [
        k,
        k === "tier"
          ? new URLSearchParams(filterQuery(f)).getAll(k)
          : new URLSearchParams(filterQuery(f)).get(k),
      ]),
    ),
  );
  assert.deepEqual(parsed, f);
  assert.throws(() => parseLeadFilters({ task: "unknown" }));
});
test("summary and sorting use final filtered customers, not number of tasks; unread is independent", () => {
  const rows = [
    lead("a", [task("open", "2026-10-01"), task("open", "2026-10-02")], {
      attention: {
        tasks: [task("open", "2026-10-01"), task("open", "2026-10-02")],
        unreadCount: 1,
      },
    }),
    lead("b"),
    lead("c", [], { owner: "Wigar" }),
  ];
  const result = filterAndSummarize(
    rows,
    { ...defaults("all"), ownership: "mine", unread: true, sort: "deadline" },
    "Fadhil",
    "Asia/Jakarta",
    now,
  );
  assert.equal(Number(result.total), 1);
  assert.equal(result.stats.overdueSla, 1);
  assert.equal(result.stats.hot, 1);
});

test("638 retry-due follows new sequence and calendar, never the cumulative touch total",()=>{
 const sequence={status:'counting',count:1,nextEligibleAt:new Date(now-1000).toISOString()};
 const p=lead('retry',[],{connectStatus:'No Response',touchCount:50,noResponseSequence:sequence});
 assert.equal(matches(p,{situation:['retry']}),true);
 for(const status of ['waiting','nurtured','replied','protected'])assert.equal(matches({...p,noResponseSequence:{...sequence,status}},{situation:['retry']}),false);
 assert.equal(matches({...p,noResponseSequence:undefined},{situation:['retry']}),false);
 assert.equal(matches({...p,contactArrangement:{state:'stopped'}},{situation:['retry']}),false);
 assert.equal(matches({...p,noResponseSequence:{...sequence,nextEligibleAt:new Date(now+1000).toISOString()}},{situation:['retry']}),false);
});
