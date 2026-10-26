import test from "node:test";
import {guidePracticeOutcome} from "../src/components/crm/CrmSimpleGuideExamples";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { guideLessons } from "../src/components/crm/CrmGuideLearning.ts";
import {
  LessonOpening,
} from "../src/components/crm/CrmGuideLearningVisual.tsx";
import { systemChapters } from "../src/components/crm/CrmSystemGuide.ts";
import { guideSections } from "../src/components/crm/CrmGuideContent.ts";
import {
  CrmUserGuide,
  resolveGuideAnchor,
} from "../src/components/crm/CrmUserGuide.tsx";

const chapters = [...systemChapters, ...guideSections];
test("Every existing system and operating chapter has a visual lesson and preserves its anchor", () => {
  assert.deepEqual(
    Object.keys(guideLessons).sort(),
    chapters.map((c) => c.key).sort(),
  );
  for (const c of chapters)
    assert.equal(resolveGuideAnchor("#crm-guide-" + c.key)?.key, c.key);
});
for (const [key, lesson] of Object.entries(guideLessons)) {
  for (const [col, lang] of ["en", "id", "zh"].entries())
    test(`${key}: complete ${lang} explanation and captioned figure`, () => {
      for (const value of [
        lesson.title,
        lesson.answer,
        lesson.value,
        lesson.caption,
        lesson.example,
        lesson.boundary,
        ...lesson.nodes.flatMap((n) => [n.label, n.detail]),
      ]) {
        assert.equal(value.length, 3);
        assert.ok(value[col].trim().length > 0);
        if (col < 2)
          assert.ok(
            !/[\u4e00-\u9fff]/u.test(value[col]),
            `${lang}: ${value[col]}`,
          );
      }
      const html = renderToStaticMarkup(
        React.createElement(LessonOpening, { chapterKey: key, col }),
      );
      assert.ok(html.includes("<figure"));
      assert.ok(html.includes("<figcaption>"));
      assert.equal(
        (html.match(/<figure[ >]/g) || []).length,
        (html.match(/<figcaption[ >]/g) || []).length,
      );
      assert.ok(!/undefined|NaN/.test(html));
      assert.ok(!/<iframe|<script|https?:\/\//.test(html));
      const chapterHtml = renderToStaticMarkup(
        React.createElement(CrmUserGuide, {
          lang: lang as "en" | "id" | "zh",
          isLight: true,
          initialChapter: key,
        }),
      );
      assert.ok(chapterHtml.includes(`id="crm-guide-${key}"`));
      assert.equal((chapterHtml.match(/aria-current="page"/g) || []).length, 1);
    });
}
test("Current practice cannot invent contact without an explicitly chosen result and original note",()=>{
 assert.equal(guidePracticeOutcome('', 'TEST original'), null);
 assert.equal(guidePracticeOutcome('Connected', '  '), null);
 assert.equal(guidePracticeOutcome('Strong Interest', 'TEST historical result'), null);
});
test("Unanswered contact is a real attempt but not successful communication and requires no next task",()=>{
 assert.deepEqual(guidePracticeOutcome('No Response','TEST original unanswered contact'),{successfulContacts:0,additionalTasks:0});
});
test("Connected contact is counted once by the simulated example; it does not create another task",()=>{
 assert.deepEqual(guidePracticeOutcome('Connected','TEST original actual reply'),{successfulContacts:1,additionalTasks:0});
});
