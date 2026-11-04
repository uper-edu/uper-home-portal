import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CrmUserGuide,
  resolveGuideAnchor,
} from "../src/components/crm/CrmUserGuide";
import {
  analyticsGuideSections,
  analyticsGuideTitle,
  analyticsEnvironmentTable,
} from "../src/components/crm/CrmAnalyticsGuide";
import mapping from "../src/data/analyticsEnvironments.json";

test("GA is the fifth documentation part with stable deep links and no duplicate section IDs", () => {
  const html = renderToStaticMarkup(
    React.createElement(CrmUserGuide, {
      lang: "zh",
      isLight: true,
      initialChapter: "ga-sources",
    }),
  );
  assert.ok(
    html.indexOf('id="crm-doc-nav-marketing"') <
      html.indexOf('id="crm-doc-nav-analytics"'),
  );
  assert.equal(analyticsGuideSections.length, 9);
  for (const section of analyticsGuideSections) {
    assert.deepEqual(resolveGuideAnchor("#crm-guide-" + section.key), {
      part: "analytics",
      key: section.key,
    });
    assert.equal(
      html.split('id="crm-guide-' + section.key + '"').length - 1,
      1,
    );
    assert.ok(html.includes('href="#crm-guide-' + section.key + '"'));
  }
  assert.match(html, /href="#crm-guide-ga-sources"[^>]*aria-current="page"/);
  assert.ok(html.includes("<h3>" + analyticsGuideTitle[2] + "</h3>"));
  assert.match(html, /5\.9/);
  assert.doesNotMatch(html, /<script|<iframe|<form/);
});

test("published environment reference remains aligned with the build mapping and has complete localized content", () => {
  const table = analyticsEnvironmentTable(2);
  for (const environment of Object.values(mapping.environments)) {
    for (const value of [
      environment.measurementId,
      environment.streamId,
      environment.propertyId,
      environment.streamName,
    ])
      assert.ok(table.includes(value), value);
  }
  for (const section of analyticsGuideSections) {
    assert.equal(section.title.length, 3);
    assert.equal(section.body.length, 3);
    for (const [col, body] of section.body.entries()) {
      assert.ok(body.trim().length > 100);
      assert.ok(section.title[col].trim());
      assert.ok(!body.includes("{{ENVIRONMENTS}}"));
    }
  }
  const text = analyticsGuideSections.map((s) => s.body[2]).join("\n");
  for (const fact of [
    "internal_employee",
    "internal_test",
    "analytics_test=1",
    "analytics_test=0",
    "verified_promotion",
    "untagged",
    "questionnaire_complete",
    "course_enrollment_confirmed",
    "DebugView",
    "24–48",
    "生产配置已准备但未部署",
    "不设置默认货币金额",
  ]) {
    assert.ok(text.includes(fact), fact);
  }
});
