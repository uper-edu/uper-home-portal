import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmDisclosure } from "../src/components/crm/CrmDisclosure.tsx";
import { CrmCustomerProfile } from "../src/components/crm/CrmCustomerDetails.tsx";
import { CrmCustomerAssessment } from "../src/components/crm/CrmAssessmentDetails.tsx";
import { CrmAttendanceEditor } from "../src/components/crm/CrmAttendanceEditor.tsx";
import type { CrmLeadRecord } from "../src/types/crmLead.ts";

function assertSingleDisclosureDepth(html: string) {
  let depth = 0;
  for (const tag of html.match(/<\/?details\b[^>]*>/g) || []) {
    if (tag.startsWith("</")) depth--;
    else depth++;
    assert.ok(
      depth <= 1,
      "A customer must never have to open a second disclosure inside the first",
    );
  }
  assert.equal(depth, 0);
}

test("Disclosure retains native keyboard semantics, accessible text and decorative icon; siblings can remain open", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      "div",
      null,
      React.createElement(
        CrmDisclosure,
        { heading: "Evidence", open: true },
        React.createElement("p", null, "First original record"),
      ),
      React.createElement(
        CrmDisclosure,
        { heading: "History", open: true },
        React.createElement("p", null, "Second original record"),
      ),
    ),
  );
  assert.equal((html.match(/<details[^>]*open=""/g) || []).length, 2);
  assert.equal((html.match(/<summary\b/g) || []).length, 2);
  assert.match(html, /Evidence/);
  assert.match(html, /History/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /role="button"|tabindex="-1"|name="/);
  assertSingleDisclosureDepth(html);
});

test("Profile and assessment preserve original facts and evidence without nested disclosure in all three languages", () => {
  const value = {
    id: "TEST-disclosure",
    fullName: "原名 Alice",
    tier: "Hot",
    campaignId: "TEST-event",
    tierConfirmed: "Hot",
    tierPredicted: "Warm-Online",
    reportedLevel: "Beginner",
    quizResultSummary: "ORIGINAL 原文 catatan",
    attendanceRecords: [
      {
        campaignId: "TEST-event",
        confirmed: true,
        mode: "online",
        reason: "TEST original evidence",
        actor: "Fadhil",
      },
    ],
  } as CrmLeadRecord;
  const original = JSON.stringify(value);
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmCustomerProfile, {
        lead: value,
        lang,
        timezone: "Asia/Jakarta",
        ownership: React.createElement("span", null, "OWNER"),
        participation: React.createElement(CrmAttendanceEditor, {
          lead: value,
          lang,
          isLight: true,
          timezone: "Asia/Jakarta",
          staffId: "TEST",
          onUpdated: () => {},
        }),
      }),
    );
    assertSingleDisclosureDepth(html);
    assert.match(html, /TEST original evidence/);
    assert.match(html, /原名 Alice/);
    const assessment = renderToStaticMarkup(
      React.createElement(CrmCustomerAssessment, {
        lead: value,
        lang,
        timezone: "Asia/Jakarta",
      }),
    );
    assertSingleDisclosureDepth(assessment);
    assert.match(assessment, /ORIGINAL 原文 catatan/);
  }
  assert.equal(JSON.stringify(value), original);
});
