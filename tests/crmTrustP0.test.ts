import { test } from "node:test";
import assert from "node:assert/strict";
import { contactsConflict } from "../server/portal/trustWorkflow.ts";
import { needsHandling } from "../src/utils/crmContact.ts";
test("P0 identity: known contact is normalized, conflicting contact is never overwritten", () => {
  assert.equal(
    contactsConflict({ whatsapp: "0812 345" }, { phone: "+62 812345" }),
    false,
  );
  assert.equal(
    contactsConflict(
      { email: "A@Example.Invalid", whatsapp: "+62 123" },
      { email: "a@example.invalid", phone: "62123" },
    ),
    false,
  );
  assert.equal(
    contactsConflict(
      { email: "a@example.invalid" },
      { email: "other@example.invalid" },
    ),
    true,
  );
});
test("information does not create a business obligation for an enrolled customer", () => {
  assert.equal(
    needsHandling(
      {
        currentStage: "Enrolled",
        attention: { tasks: [], requestCount: 1 },
      },
      Date.now(),
      () => "",
    ),
    false,
  );
});
if (process.env.MYSQL_P0_TRUST_TEST === "true") {
  const { readFileSync } = await import("node:fs");
  const fixture = JSON.parse(
    readFileSync("/private/tmp/uper-p0-trust-env.json", "utf8"),
  );
  assert.equal(
    fixture.MYSQL_TRIAL_SOCKET,
    "/private/tmp/uper-mysql-native-cleanup.sock",
  );
  assert.match(
    new URL(fixture.MYSQL_TRIAL_URL).pathname,
    /^\/uper_trial_native_facts_tasks_browser_/,
  );
  Object.assign(process.env, fixture);
  const { openTrialDatabase } = await import("../cloud/mysql/database.mjs");
  const db = await openTrialDatabase(fixture);
  const base = "http://127.0.0.1:4426";
  function browser() {
    const cookies = new Map<string, string>();
    return async (path: string, body?: any, method?: string) => {
      const r = await fetch(base + path, {
        method: method || (body === undefined ? "GET" : "POST"),
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          Cookie: [...cookies].map(([k, v]) => k + "=" + v).join(";"),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const h of r.headers.getSetCookie()) {
        const [k, v] = h.split(";")[0].split("=");
        cookies.set(k, v);
      }
      return { status: r.status, data: await r.json() };
    };
  }
  const sales = browser(),
    other = browser(),
    leader = browser(),
    visitor = browser(),
    returning = browser();
  await test("P0 independent MySQL: facts, notes, stages, tasks, identities, permissions and result queries", async () => {
    for (const [b, name] of [
      [sales, "Fadhil"],
      [other, "Wigar"],
      [leader, "Robert"],
    ] as const)
      assert.equal(
        (await b("/api/crm/auth/login", { loginId: name, password: name }))
          .status,
        200,
      );
    const stamp = crypto.randomUUID(),
      profile = {
        fullName: "Putri Lestari",
        email: stamp + "@example.invalid",
        whatsapp: "000" + Date.now(),
        goal: "Work in China",
        reportedLevel: "Beginner",
        city: "Jakarta",
        mode: "Online",
        currentStatus: "Working professional",
      };
    const first = await visitor("/api/portal/register", profile);
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const id = first.data.lead.id;
    assert.equal((await sales(`/api/crm/leads/${id}/claim`, {})).status, 200);
    const solo = "TEST-record-only-" + stamp;
    await db.execute(
      "INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)",
      [
        solo,
        solo,
        JSON.stringify({
          id: solo,
          fullName: "Andi Pratama",
          owner: "Fadhil",
          currentStage: "Contacted",
          tier: "Warm-Online",
        }),
      ],
    );
    const recordOnly = await sales(`/api/crm/leads/${solo}/logs`, {
      requestId: "record-only-" + stamp,
      recordKind: "contact",
      channel: "Phone Call",
      connectStatus: "No Response",
      summary: "TEST unanswered call; information only",
      completeTaskIds: [],
      disposition: "record_only", workflowVersion: 3, expectedRevision: 0, contactDirection: "sales", occurrenceMode: "unknown",
    });
    assert.equal(recordOnly.status, 200, JSON.stringify(recordOnly.data));
    assert.equal(recordOnly.data.lead.touchCount, 1);
    assert.equal((await sales(`/api/crm/leads/${solo}`)).data.tasks.length, 0);
    const before = (await sales(`/api/crm/leads/${id}`)).data;
    const note = {
      requestId: "note-" + stamp,
      summary: "TEST 原文 Catatan original: customer prefers evenings",
    };
    const notes = await Promise.all(
      Array.from({ length: 10 }, () =>
        sales(`/api/crm/leads/${id}/information`, note),
      ),
    );
    assert.ok(
      notes.every((r) => r.status === 200),
      JSON.stringify(notes),
    );
    const after = (await sales(`/api/crm/leads/${id}`)).data;
    assert.deepEqual(after.tasks, before.tasks);
    for (const k of [
      "owner",
      "tier",
      "currentStage",
      "touchCount",
      "lastContactedAt",
    ])
      assert.equal(after.lead[k], before.lead[k]);
    const queried = await sales(
      `/api/crm/leads/${id}/operations/${note.requestId}`,
    );
    assert.equal(queried.status, 200);
    assert.equal(
      (
        await other(`/api/crm/leads/${id}/information`, {
          ...note,
          requestId: "unauthorized",
        })
      ).status,
      404,
    );
    const stage = {
      requestId: "stage-" + stamp,
      newStage: "progress:discovery",
      expectedStage: first.data.lead.currentStage,
      expectedStageRevision: 0, basisRefs: [], effectiveTimeMode: "unknown",
      reason: "TEST human reply evidence",
    };
    assert.equal(
      (await sales(`/api/crm/leads/${id}/stage`, stage)).status,
      200,
    );
    assert.equal(
      (await sales(`/api/crm/leads/${id}/stage`, stage)).data.replayed,
      true,
    );
    assert.equal(
      (
        await sales(`/api/crm/leads/${id}/stage`, {
          ...stage,
          requestId: "stale",
          newStage: "progress:proposal",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await sales(
          `/api/crm/leads/${id}`,
          {
            currentStage: "Enrolled",
            expectedStage: "progress:discovery",
            expectedStageRevision: 1,
          },
          "PATCH",
        )
      ).status,
      400,
    );
    // General task creation and message processing checklists are retired.
    assert.equal((await sales(`/api/crm/leads/${id}/task-actions`, {requestId:'retired-'+stamp,command:'create'})).status,410);
    const final=(await sales(`/api/crm/leads/${id}/trust`)).data;
    assert.equal(final.facts.filter((f:any)=>f.kind==='information.recorded'&&f.data.summary===note.summary).length,1);
    assert.equal(final.facts.filter((f:any)=>f.kind==='stage.changed').length,1);
    const refresh = await visitor("/api/portal/register", {
      ...profile,
      city: "Bandung",
    });
    assert.equal(refresh.data.lead.id, id);
    assert.equal(refresh.data.lead.owner, "Fadhil");
    assert.equal(refresh.data.lead.currentStage, "progress:discovery");
    const conflict = await visitor("/api/portal/register", {
      ...profile,
      email: "another-" + stamp + "@example.invalid",
    });
    assert.equal(conflict.status, 409);
    const duplicate = await returning("/api/portal/register", profile);
    assert.equal(duplicate.status, 200);
    const second = duplicate.data.lead.id;
    assert.notEqual(second, id);
    assert.equal(
      (await sales(`/api/crm/leads/${second}/claim`, {})).status,
      409,
    );
    const identities = (await sales(`/api/crm/leads/${second}/trust`)).data;
    assert.equal(identities.candidates[0].candidate_id, id);
    assert.equal(identities.candidates[0].visitor_id, undefined);
    assert.equal(
      (
        await leader(`/api/crm/leads/${second}/identity-actions`, {
          requestId: "identity-" + stamp,
          candidateId: id,
          decision: "same",
          reason: "TEST customer confirmed returning on another device",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await other(`/api/crm/leads/${second}/identity-actions`, {
          requestId: "badidentity-" + stamp,
          candidateId: id,
          decision: "same",
          reason: "TEST unauthorized",
        })
      ).status,
      404,
    );
    assert.equal((await leader(`/api/crm/leads/${id}`)).status, 200);
    await visitor("/api/portal/new-person", {});
    const separate = await visitor("/api/portal/register", {
      ...profile,
      fullName: "TEST separate person",
      email: "separate-" + stamp + "@example.invalid",
      whatsapp: "008" + Date.now(),
    });
    assert.equal(separate.status, 200);
    assert.notEqual(separate.data.lead.id, id);
    // Failure after fact insert rolls back both fact and operation, retry uses the same ID.
    await db.query(
      "CREATE TRIGGER p0_fail_operation BEFORE INSERT ON crm_operations FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST operation failure'",
    );
    const failBody = {
      requestId: "rollback-" + stamp,
      summary: "TEST rolled back note",
    };
    try {
      assert.equal(
        (await sales(`/api/crm/leads/${id}/information`, failBody)).status,
        503,
      );
    } finally {
      await db.query("DROP TRIGGER p0_fail_operation");
    }
    assert.equal(
      (await sales(`/api/crm/leads/${id}/operations/${failBody.requestId}`))
        .status,
      404,
    );
    assert.equal(
      (await sales(`/api/crm/leads/${id}/information`, failBody)).status,
      200,
    );
  });
  await db.end();
}

else test('P0 native identity and rollback require explicit independent MySQL',{skip:'MYSQL_NATIVE_TEST_ENV not configured; destructive trigger scenario not run on3000'},()=>{});
