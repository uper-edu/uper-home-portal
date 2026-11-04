import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmUserGuide, resolveGuideAnchor } from "../src/components/crm/CrmUserGuide";
import { promotionAttributionGuideSections } from "../src/components/crm/CrmPromotionAttributionGuide";

test("chapter six includes the complete approved Chinese design", () => {
  const source = readFileSync("docs/analytics/promotion-attribution-design.md", "utf8");
  const [opening, ...sections] = source.split(/^## \d+\. /m);
  assert.equal(sections.length, 6);
  assert.equal(promotionAttributionGuideSections.length, sections.length);
  for (const [index, section] of promotionAttributionGuideSections.entries()) {
    const newline = sections[index].indexOf("\n");
    const intro = opening.slice(opening.indexOf("\n")).trim().replace(
      "本文定义目标行为。",
      "本文定义目标行为，待实施。",
    );
    assert.equal(section.title[2], sections[index].slice(0, newline));
    const body = sections[index].slice(newline).trim();
    assert.equal(section.body[2], index === 0 ? intro + "\n\n" + body : body);
    assert.equal(section.title.length, 3);
    assert.equal(section.body.length, 3);
    for (const localized of section.body) {
      const examples = localized.split("\n").filter((line) => line.startsWith("|"));
      if (index === 3) assert.equal(examples.length, 14);
      assert.ok(localized.trim().length > 100);
    }
  }
});

test("chapter six has six directory entries and stable deep links", () => {
  const html = renderToStaticMarkup(React.createElement(CrmUserGuide, {
    lang: "zh",
    isLight: true,
    initialChapter: "promotion-attribution-examples",
  }));
  assert.ok(html.indexOf('id="crm-doc-nav-analytics"') < html.indexOf('id="crm-doc-nav-promotion"'));
  for (const section of promotionAttributionGuideSections) {
    assert.deepEqual(resolveGuideAnchor("#crm-guide-" + section.key), {
      part: "promotion",
      key: section.key,
    });
    assert.equal(html.split('id="crm-guide-' + section.key + '"').length - 1, 1);
    assert.ok(html.includes('href="#crm-guide-' + section.key + '"'));
  }
  assert.match(html, /href="#crm-guide-promotion-attribution-examples"[^>]*aria-current="page"/);
  assert.match(html, /第六章 · 推广链接、来源归因与转化跟踪/);
  assert.match(html, /6\.6/);
  assert.match(html, /待实施/);
  assert.match(html, /https:\/\/github\.com\/uper-edu\/uper-home-portal\/blob\/main\/server\/portal\/campaignPromotion\.ts/);
});
