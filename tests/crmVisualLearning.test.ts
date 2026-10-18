import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { guideLessons } from "../src/components/crm/CrmGuideLearning.ts";
import {
  LessonOpening,
  taskStorySnapshot,
  validateGuidePractice,
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
test("Teaching story keeps three independent tasks, supplements T1 without duplicating it, and completes only T1", () => {
  assert.equal(taskStorySnapshot(0).filter((t) => t.present).length, 1);
  assert.equal(taskStorySnapshot(1).filter((t) => t.present).length, 2);
  assert.equal(taskStorySnapshot(2).filter((t) => t.present).length, 3);
  assert.equal(taskStorySnapshot(3).filter((t) => t.present).length, 3);
  assert.deepEqual(
    taskStorySnapshot(3)
      .filter((t) => t.supplemented)
      .map((t) => t.id),
    ["T1"],
  );
  assert.deepEqual(
    taskStorySnapshot(4)
      .filter((t) => t.completed)
      .map((t) => t.id),
    ["T1"],
  );
  assert.deepEqual(
    taskStorySnapshot(4)
      .filter((t) => t.present && !t.completed)
      .map((t) => t.id),
    ["T2", "T3"],
  );
});
const filled = {
  channel: "phone",
  result: true,
  keep: true,
  plan: "keep",
  note: "Telepon tidak dijawab.",
  action: "",
  purpose: "",
  date: "",
};
test("No-response exercise requires facts, an explicit task outcome and an arrangement", () => {
  assert.equal(validateGuidePractice({ ...filled, channel: "" }), "errChannel");
  assert.equal(
    validateGuidePractice({ ...filled, result: false }),
    "errResult",
  );
  assert.equal(validateGuidePractice({ ...filled, note: " " }), "errNote");
  assert.equal(validateGuidePractice({ ...filled, keep: false }), "errOutcome");
  assert.equal(validateGuidePractice({ ...filled, plan: "" }), "errPlan");
  assert.equal(validateGuidePractice(filled), "");
  assert.equal(validateGuidePractice({ ...filled, plan: "record_only" }), "");
});
test("New arrangement needs a specific action, purpose and future Jakarta time; past/equal times cannot pass", () => {
  const planned = {
    ...filled,
    plan: "schedule",
    action: "Verify alternative number",
    purpose: "Do not repeat invalid contact",
    date: "2026-10-20T10:00",
  };
  assert.equal(validateGuidePractice(planned), "");
  for (const patch of [
    { action: "" },
    { purpose: "" },
    { date: "" },
    { date: "2026-10-19T09:59" },
    { date: "2026-10-19T10:00" },
  ])
    assert.equal(
      validateGuidePractice({ ...planned, ...patch }),
      "errSchedule",
    );
});
