import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CrmUserGuide,
  resolveGuideAnchor,
} from "../src/components/crm/CrmUserGuide.tsx";
import { systemChapters } from "../src/components/crm/CrmSystemGuide.ts";
import {
  panoramaNodes,
  panoramaRoles,
  panoramaModules,
  panoramaConcepts,
  panoramaSearchAliases,
  panoramaCases,
} from "../src/components/crm/CrmPanoramaContent.ts";
test("Panorama is first; existing deep links retain their meaning", () => {
  assert.equal(systemChapters[0].key, "panorama");
  assert.deepEqual(resolveGuideAnchor("#crm-guide-panorama"), {
    part: "system",
    key: "panorama",
  });
  assert.equal(resolveGuideAnchor("#chapter-1")?.key, "panorama");
  assert.equal(resolveGuideAnchor("#crm-guide-architecture")?.key, "panorama");
  assert.ok(!systemChapters.some((s) => s.key === "architecture"));
  for (const key of [
    "entities",
    "acquisition",
    "classification",
    "tasks-sla",
    "notification-system",
    "followup",
  ])
    assert.equal(resolveGuideAnchor("#crm-guide-" + key)?.key, key);
});
test("All expanded panorama content has three translations, not only the initial visible selection", () => {
  const visit = (x: unknown) => {
    if (Array.isArray(x)) {
      if (x.length === 3 && x.every((v) => typeof v === "string")) {
        for (const v of x) assert.ok(v.trim());
        for (const v of x.slice(0, 2))
          assert.doesNotMatch(v, /[\u4e00-\u9fff]/u);
      } else x.forEach(visit);
    } else if (x && typeof x === "object") Object.values(x).forEach(visit);
  };
  visit([
    panoramaNodes,
    panoramaRoles,
    panoramaModules,
    panoramaConcepts,
    panoramaSearchAliases,
    panoramaCases,
  ]);
  assert.equal(panoramaConcepts.length, 3);
  assert.equal(panoramaCases.length, 7);
});
for (const lang of ["en", "id", "zh"] as const)
  test(`Panorama is the default first chapter in ${lang}, with controlled disclosure and no live embed`, () => {
    const html = renderToStaticMarkup(
      React.createElement(CrmUserGuide, { lang, isLight: true }),
    );
    assert.match(html, /id="crm-guide-panorama"/);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /crm-panorama-module-detail/);
    assert.match(html, /crm-panorama-scenario/);
    assert.equal(
      (html.match(/<figure[ >]/g) || []).length,
      (html.match(/<figcaption>/g) || []).length,
    );
    assert.doesNotMatch(html, /<iframe|<script|https?:\/\//);
  });

test("Merged overview keeps one navigation entry and sends architecture and numbered bookmarks to it", () => {
  for (const hash of [
    "architecture",
    "#architecture",
    "#crm-guide-architecture",
    "#chapter-1",
  ])
    assert.deepEqual(resolveGuideAnchor(hash), {
      part: "system",
      key: "panorama",
    });
  assert.equal(resolveGuideAnchor("#chapter-2")?.key, "acquisition");
  assert.equal(
    resolveGuideAnchor("#crm-guide-fields")?.key,
    "data-implementation",
  );
});

for (const lang of ["en", "id", "zh"] as const)
  test(`Old architecture entry renders the merged overview once in ${lang}`, () => {
    const html = renderToStaticMarkup(
      React.createElement(CrmUserGuide, {
        lang,
        isLight: true,
        initialChapter: "architecture",
      }),
    );
    assert.equal((html.match(/id="crm-guide-panorama"/g) || []).length, 1);
    assert.doesNotMatch(
      html,
      /id="crm-guide-architecture"|href="#crm-guide-architecture"/,
    );
    assert.match(html, /<details class="crm-panorama-details"><summary>/);
    assert.doesNotMatch(
      html,
      /<details[^>]*class="crm-panorama-details"[^>]*open/,
    );
    assert.match(html, /href="#crm-guide-access"/);
    assert.match(html, /href="#crm-guide-data-implementation"/);
  });
