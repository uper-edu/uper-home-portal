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
  panoramaData,
  panoramaStates,
  panoramaCases,
} from "../src/components/crm/CrmPanoramaContent.ts";
test("Panorama is first; existing deep links retain their meaning", () => {
  assert.equal(systemChapters[0].key, "panorama");
  assert.deepEqual(resolveGuideAnchor("#crm-guide-panorama"), {
    part: "system",
    key: "panorama",
  });
  assert.equal(resolveGuideAnchor("#chapter-1")?.key, "architecture");
  for (const key of [
    "architecture",
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
    panoramaData,
    panoramaStates,
    panoramaCases,
  ]);
  assert.equal(panoramaStates.length, 6);
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
