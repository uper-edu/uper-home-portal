import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsContext,
  safeAnalyticsParams,
  createAnalyticsClient,
} from "../src/utils/analyticsPolicy";
import {
  registrationAnalyticsReceipt,
  assessmentAnalyticsReceipt,
  progressAnalyticsReceipt,
  advisorAnalyticsReceipt,
  profileAnalyticsReceipt,
} from "../src/utils/analyticsReceipts";

const make = (href: string, mode = "prod") =>
  analyticsContext({
    href,
    mode,
    language: "zh",
    referrer:
      "https://www.instagram.com/uper.education/?email=private@example.test",
  });
test("bare Bio entry sets campaign source before any event without changing its visible URL", () => {
  const c = make("https://uperedu.com/link");
  assert.equal(c.campaign_source, "instagram");
  assert.equal(c.campaign_medium, "social");
  assert.equal(c.campaign_id, "instagram-bio");
  assert.equal(c.source_basis, "dedicated_entry");
  assert.equal(c.page_location, "https://uperedu.com/link");
  assert.equal(c.page_referrer, "https://www.instagram.com/");
  const chat = make("https://uperedu.com/chat");
  assert.equal(chat.campaign_source, undefined);
  assert.equal(chat.source_basis, "untagged");
});
test("traffic boundaries identify local/test and staff operations separately from public customers", () => {
  assert.equal(
    make("http://localhost:3000/chat").traffic_category,
    "internal_test",
  );
  assert.equal(
    make("https://home.prototype.uperedu.com/link").environment,
    "test",
  );
  assert.equal(
    make("https://uperedu.com/crm?tab=leads").traffic_category,
    "internal_employee",
  );
  assert.equal(make("https://uperedu.com/chat").traffic_category, "customer");
  assert.equal(make("https://uperedu.com/chat").debug_mode, undefined);
});
test("page metadata is deterministic and private query, hash, identity and arbitrary paths are excluded", () => {
  const c = make(
    "https://uperedu.com/crm?tab=docs&lead=PRIVATE-LEAD&leadView=profile&email=private@example.test#private-message",
  );
  assert.equal(c.page_location, "https://uperedu.com/crm?tab=docs");
  assert.match(String(c.page_title), /系统说明与操作指南/);
  assert.ok(
    !JSON.stringify(c).includes("PRIVATE") &&
      !JSON.stringify(c).includes("private@") &&
      !JSON.stringify(c).includes("private-message"),
  );
  assert.equal(
    make("https://uperedu.com/news/private-person").page_location,
    "https://uperedu.com/news/:item",
  );
  assert.equal(
    make("https://uperedu.com/sensitive-person").page_location,
    "https://uperedu.com/other",
  );
  assert.equal(
    make("https://uperedu.com/chat?utm_source=private@example.test")
      .campaign_source,
    undefined,
  );
});
test("only explicit safe parameters survive; no text, contact, URL, errors, answers or IDs can be uploaded", () => {
  const value = safeAnalyticsParams({
    fullName: "Maya",
    email: "private@example.test",
    message: "private",
    prompt_text: "private",
    leadId: "private",
    answers: { name: "private" },
    error: "private",
    button_label: "private",
    destination_url: "https://private.test",
    reason: "email private",
    status: "saved",
    language: "zh",
    duration_ms: 123.4,
    step: -2,
    role: "manager",
    stage_to: "progress:enrolled",
  });
  assert.deepEqual(value, {
    status: "saved",
    language: "zh",
    duration_ms: 123,
    step: 0,
    role: "manager",
    stage_to: "progress:enrolled",
  });
  assert.deepEqual(
    safeAnalyticsParams({
      duration_ms: Infinity,
      message_length: NaN,
      unknown: 4,
    }),
    {},
  );
});
function fixture() {
  const events: any[] = [];
  let href = "http://localhost:3000/link";
  const values = new Map<string, string>();
  const options = {
    id: "G-TEST",
    context: () => make(href, "dev"),
    send: (...args: any[]) => {
      events.push(args);
    },
    storage: {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    },
  };
  return {
    events,
    options,
    client: createAnalyticsClient(options),
    navigate: (v: string) => {
      href = v;
    },
  };
}
test("SPA pageviews are explicit, deduplicated by safe location, and preserve previous safe page as referrer", () => {
  const f = fixture();
  assert(f.client.page());
  assert(!f.client.page());
  f.navigate("http://localhost:3000/chat?c=instagram-bio&lead=PRIVATE");
  assert(f.client.page());
  const pages = f.events.filter(
    (e) => e[0] === "event" && e[1] === "page_view",
  );
  assert.equal(pages.length, 2);
  assert.equal(pages[1][2].page_referrer, "http://localhost:3000/link");
  assert.ok(!JSON.stringify(pages).includes("PRIVATE"));
  f.navigate("http://localhost:3000/chat?c=instagram-bio&lead=OTHER");
  assert(!f.client.page());
});
test("confirmed conversions deduplicate queries/retries across a page reload and never transmit receipt keys", () => {
  const f = fixture();
  assert(!f.client.confirmed("questionnaire_complete", "PRIVATE-OP", false));
  assert(f.client.confirmed("questionnaire_complete", "PRIVATE-OP", true));
  assert(!f.client.confirmed("questionnaire_complete", "PRIVATE-OP", true));
  assert(
    !createAnalyticsClient(f.options).confirmed(
      "questionnaire_complete",
      "PRIVATE-OP",
      true,
    ),
  );
  assert.equal(f.events.length, 1);
  assert.ok(!JSON.stringify(f.events).includes("PRIVATE-OP"));
  assert(!f.client.track("unapproved_event", { text: "private" }));
});
test("blocked storage, malformed context and analytics transport failures never throw into business operations", () => {
  const c = createAnalyticsClient({
    id: "G-TEST",
    context: () => make("https://uperedu.com/chat"),
    send: () => {
      throw Error("blocked");
    },
    storage: {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    },
  });
  assert.equal(c.track("page_view"), false);
  assert.equal(c.page(), false);
  assert.equal(c.confirmed("assessment_complete", "A", true), false);
  const invalid = createAnalyticsClient({
    id: "G-TEST",
    context: () => {
      throw Error("malformed");
    },
    send: () => assert.fail(),
  });
  assert.equal(invalid.page(), false);
});
test("registration success is a confirmed saved questionnaire, not a submit click, failed or unknown response", () => {
  for (const bad of [
    null,
    {},
    { saved: false, submissionId: "A", lead: { id: "L" } },
    { saved: true, submissionId: "A" },
    { saved: true, lead: { id: "L" } },
  ])
    assert.equal(registrationAnalyticsReceipt(bad, "standalone_chat"), null);
  assert.deepEqual(
    registrationAnalyticsReceipt(
      {
        saved: true,
        submissionId: "A",
        lead: { id: "L", fullName: "private" },
      },
      "standalone_chat",
    ),
    {
      event: "questionnaire_complete",
      key: "A",
      params: { entry_point: "standalone_chat", method: "questionnaire" },
    },
  );
  assert.equal(
    registrationAnalyticsReceipt(
      { saved: true, submissionId: "A", lead: { id: "L" } },
      "homepage_widget",
    )?.event,
    "lead_form_complete",
  );
});
test("assessment local grades and another attempt are never completed conversion evidence", () => {
  const saved = {
    saveStatus: "saved",
    attempt: {
      attemptId: "A",
      completedAt: "2026-11-02T00:00:00Z",
      mode: "express",
    },
  };
  assert.equal(
    assessmentAnalyticsReceipt({ ...saved, saveStatus: "pending" }, "A"),
    null,
  );
  assert.equal(assessmentAnalyticsReceipt(saved, "B"), null);
  assert.equal(
    assessmentAnalyticsReceipt(
      { saveStatus: "saved", attempt: { attemptId: "A" } },
      "A",
    ),
    null,
  );
  assert.equal(
    assessmentAnalyticsReceipt(saved, "A")?.event,
    "assessment_complete",
  );
});
test("progress and advisor conversions require matching real receipt relationships rather than AI prose or an open form", () => {
  assert.equal(
    progressAnalyticsReceipt(
      { lead: { id: "other", followUpLogs: [{ id: "log" }] }, logId: "log" },
      "lead",
    ),
    null,
  );
  assert.equal(
    progressAnalyticsReceipt(
      { lead: { id: "lead", followUpLogs: {} }, logId: "log" },
      "lead",
    ),
    null,
  );
  assert.equal(
    progressAnalyticsReceipt(
      { lead: { id: "lead", followUpLogs: [{ id: "log" }] }, logId: "log" },
      "lead",
    )?.event,
    "crm_progress_saved",
  );
  const answer = {
    saved: true,
    status: "awaiting_advisor",
    taskOperation: "recorded",
  };
  assert.equal(advisorAnalyticsReceipt(answer, { id: "M" }), null);
  assert.equal(
    advisorAnalyticsReceipt(
      { ...answer, status: "contact_required" },
      { id: "M", action: "handoff" },
    ),
    null,
  );
  assert.equal(
    advisorAnalyticsReceipt(answer, { id: "M", action: "handoff" })?.event,
    "advisor_request",
  );
});

test("profile analytics observes only applied fields on the expected customer, never a conflict review", () => {
  const data = {
    lead: { id: "L" },
    profileFieldResults: [
      { field: "email", status: "applied", value: "private@example.test" },
    ],
  };
  assert.equal(profileAnalyticsReceipt(data, "OTHER", "R", "basic"), null);
  assert.equal(
    profileAnalyticsReceipt(
      { ...data, profileFieldResults: [{ status: "conflict" }] },
      "L",
      "R",
      "basic",
    ),
    null,
  );
  assert.deepEqual(profileAnalyticsReceipt(data, "L", "R", "basic"), {
    event: "crm_profile_saved",
    key: "R",
    params: { operation: "profile", profile_scope: "basic" },
  });
});
