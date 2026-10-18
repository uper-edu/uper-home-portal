import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CrmUserGuide,
  resolveGuideAnchor,
  operationGroups,
  crmDocumentationFields,
} from "../src/components/crm/CrmUserGuide.tsx";
import { systemChapters } from "../src/components/crm/CrmSystemGuide.ts";
import { guideSections } from "../src/components/crm/CrmGuideContent.ts";
import dictionary from "../src/components/crm/crmDictionary.json";
import snapshot from "../docs/reference/crm-implementation-snapshot-20261017.json";
const documentedSource = (source: string) =>
  fs.existsSync(source) ||
  snapshot.references.some(
    (reference) =>
      reference.path === source && /^[a-f0-9]{64}$/.test(reference.sha256),
  );
import {
  dictionaryMeaning,
  dictionaryWriter,
} from "../src/components/crm/CrmDictionaryMeaning.ts";
import { evaluateFullLeadTier } from "../src/types/crmLead.ts";
import { calculateLeadTier } from "../src/types/leadSystem.ts";
import { sla } from "../src/utils/workCalendar.ts";
test("Ten system chapters restore concepts; nine operating groups preserve every existing section", () => {
  assert.equal(systemChapters.length, 10);
  assert.equal(operationGroups.length, 9);
  assert.deepEqual(
    operationGroups.flat().sort(),
    guideSections.map((s) => s.key).sort(),
  );
  for (const s of systemChapters) {
    assert.ok(
      guideSections.some((g) => g.key === s.related),
      s.key,
    );
    for (const source of s.sources) assert.ok(documentedSource(source), source);
  }
  for (let i = 1; i <= 10; i++) assert.ok(resolveGuideAnchor("#chapter-" + i));
  for (const section of [...systemChapters, ...guideSections])
    assert.ok(resolveGuideAnchor("#crm-guide-" + section.key));
  assert.deepEqual(resolveGuideAnchor("#crm-guide-fields"), {
    part: "system",
    key: "data-implementation",
  });
  assert.equal(resolveGuideAnchor("#chapter-55"), null);
});
test("Dictionary includes all 35 tables, nested properties, expanded enum values and latest schema fields", () => {
  execFileSync(process.execPath, [
    "scripts/crm-documentation-dictionary.mjs",
    "--check",
  ]);
  assert.equal(
    new Set(
      dictionary.filter((r) => r.layer === "storage").map((r) => r.object),
    ).size,
    35,
  );
  assert.equal(
    dictionary.filter(
      (r) => r.object === "crm_users" && r.key === "password_hash",
    ).length,
    1,
  );
  assert.ok(dictionary.some((r) => r.key === "contactArrangement.reviewAt"));
  assert.match(
    dictionary.find(
      (r) => r.object === "CrmLeadRecord" && r.key === "currentStage",
    )!.type,
    /Assessment Booked/,
  );
  assert.ok(
    dictionary.some((r) => r.object === "notification_migration_holds"),
  );
  assert.ok(
    dictionary.some(
      (r) => r.object === "cms_collections" && r.key === "items_text",
    ),
  );
  for (const r of dictionary) {
    assert.equal(dictionaryMeaning(r).length, 3);
    assert.equal(dictionaryWriter(r).length, 3);
    assert.ok(documentedSource(r.source));
  }
});
for (const lang of ["en", "id", "zh"] as const)
  test(`Concepts, diagrams, captions and dictionary render in ${lang} without other-language copy`, () => {
    const html = renderToStaticMarkup(
      React.createElement(CrmUserGuide, { lang, isLight: true }),
    );
    const text = html.replace(/<[^>]+>/g, " ");
    if (lang !== "zh") assert.doesNotMatch(text, /[\u4e00-\u9fff]/);
    assert.equal((html.match(/id="crm-guide-/g) || []).length, 1);
    assert.ok(
      html.includes("crm-doc-nav-system") &&
        html.includes("crm-doc-nav-operations"),
    );
    assert.match(html, /<ol class="crm-doc-flow"/);
    assert.match(html, /<caption/);
    assert.match(html, /aria-expanded="true"/);
    assert.doesNotMatch(html, /<details open=""/);
    assert.ok(
      text.includes(
        { en: "System explanation", id: "Penjelasan sistem", zh: "系统说明" }[
          lang
        ],
      ),
    );
    assert.doesNotMatch(text, /100%|3倍|3x|fully automated closed/);
  });
test("Published R6 priority and baseline distinction match the unchanged engines", () => {
  const base: any = {
    buyingSignal: "Asked price",
    currentStatus: "Working professional",
    goal: "Prepare for HSK certification",
    levelState: "PARTIAL",
    city: "Jakarta",
    mode: "Online",
    connectStatus: "No Response",
    touchCount: 3,
  };
  assert.equal(evaluateFullLeadTier(base).tier, "Cold-Nurture");
  assert.equal(calculateLeadTier(base).tier, "Hot");
  assert.equal(evaluateFullLeadTier({ ...base, touchCount: 2 }).tier, "Hot");
  assert.equal(
    evaluateFullLeadTier({
      ...base,
      buyingSignal: "None yet",
      connectStatus: "Connected",
      currentStatus: "Teacher or school staff",
    }).tier,
    "School",
  );
  assert.equal(
    evaluateFullLeadTier({
      ...base,
      buyingSignal: "None yet",
      connectStatus: "Connected",
      city: "Jakarta",
      mode: "Offline",
    }).tier,
    "Warm-Offline",
  );
  assert.equal(
    evaluateFullLeadTier({
      ...base,
      buyingSignal: "None yet",
      connectStatus: "Connected",
      city: "Jakarta",
      mode: "Offline",
      assessmentDone: true,
    }).tier,
    "Hot",
  );
});
test("Four published natural-duration calendar examples execute correctly", () => {
  const calendar = {
    timezone: "Asia/Jakarta",
    days: [1, 2, 3, 4, 5, 6],
    start: "09:00",
    end: "20:00",
  };
  for (const [input, expected] of [
    ["2026-10-12T10:00:00+07:00", "2026-10-12T13:00:00+07:00"],
    ["2026-10-12T23:00:00+07:00", "2026-10-13T12:00:00+07:00"],
    ["2026-10-17T19:00:00+07:00", "2026-10-19T09:00:00+07:00"],
    ["2026-10-18T10:00:00+07:00", "2026-10-19T12:00:00+07:00"],
  ])
    assert.equal(
      sla(new Date(input), 3, calendar).toISOString(),
      new Date(expected).toISOString(),
    );
});

import {
  CrmGuideDiagram,
  executionRules,
  ruleDefinitions,
  slaSamples,
} from "../src/components/crm/CrmGuideDiagrams.tsx";
test("CRM display dictionary excludes CMS and public submission objects without modifying the full source index", () => {
  assert.ok(crmDocumentationFields.length < dictionary.length);
  assert.equal(
    new Set(
      crmDocumentationFields
        .filter((r) => r.layer === "storage")
        .map((r) => r.object),
    ).size,
    32,
  );
  for (const row of crmDocumentationFields)
    assert.ok(
      !["cms_collections", "cms_media", "site_submissions"].includes(
        row.object,
      ),
    );
  assert.ok(dictionary.some((r) => r.object === "cms_media"));
});
test("Rule definition numbering and actual execution remain distinct", () => {
  assert.deepEqual(
    ruleDefinitions.map((r) => r.id),
    ["R1", "R2", "R3", "R4", "R5", "R6"],
  );
  assert.deepEqual(executionRules, ["R6", "R1", "R2", "R3", "R4", "R5"]);
  const html = renderToStaticMarkup(
    React.createElement(CrmGuideDiagram, { kind: "classification", col: 0 }),
  );
  assert.deepEqual(
    [...html.matchAll(/data-rule="(R\d)"/g)].map((match) => match[1]),
    executionRules,
  );
  assert.match(html, /Stop this prediction/);
  assert.match(html, /No → continue checking/);
});
for (const lang of ["en", "id", "zh"] as const)
  for (const kind of [
    "classification",
    "acquisition",
    "sla",
    "notification",
  ] as const)
    test(`${kind} diagram uses accessible structure and ${lang} text`, () => {
      const html = renderToStaticMarkup(
        React.createElement(CrmGuideDiagram, {
          kind,
          col: lang === "zh" ? 2 : lang === "id" ? 1 : 0,
        }),
      );
      assert.match(html, /<figure/);
      assert.match(html, /<figcaption/);
      assert.match(html, /<ol|<table/);
      const text = html.replace(/<[^>]*>/g, " ");
      if (lang !== "zh") assert.doesNotMatch(text, /[\u4e00-\u9fff]/);
      assert.doesNotMatch(text, /100%|3倍|3x/);
      if (kind === "sla") {
        assert.equal((html.match(/aria-pressed=/g) || []).length, 4);
        assert.match(html, /data-sla-sample="night"/);
      }
      if (kind === "acquisition")
        assert.ok(
          text.includes(
            {
              en: "not a strict conversion funnel",
              id: "bukan corong konversi ketat",
              zh: "不是严格转化漏斗",
            }[lang],
          ),
        );
      if (kind === "notification")
        assert.ok(
          text.includes(
            { en: "API accepted", id: "Diterima API", zh: "接口接受" }[lang],
          ),
        );
    });
test("Every plotted SLA sample is validated by the unchanged server calendar function", () => {
  const calendar = {
    timezone: "Asia/Jakarta",
    days: [1, 2, 3, 4, 5, 6],
    start: "09:00",
    end: "20:00",
  };
  for (const sample of slaSamples)
    assert.equal(
      sla(new Date(sample.input), 3, calendar).toISOString(),
      new Date(sample.expected).toISOString(),
    );
});
