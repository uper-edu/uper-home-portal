import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import dictionary from "../src/utils/crm-id.json";
import { crmId } from "../src/utils/crmIndonesian.ts";
import { crmValue, crmLocale, crmError } from "../src/utils/crmLanguage.ts";
import { CrmUserGuide } from "../src/components/crm/CrmUserGuide.tsx";
import { CrmLeadWorkspace } from "../src/components/crm/CrmLeadWorkspace.tsx";
import SearchableChoices from "../src/components/SearchableChoices.tsx";

test("Indonesian catalog preserves every interpolation token", () => {
  for (const [en, id] of Object.entries(dictionary)) {
    assert.equal(typeof id, "string");
    for (const token of en.match(/\{\d+\}/g) || [])
      assert.ok(id.includes(token), en);
  }
});
test("dynamic translations preserve customer text and numbers verbatim", () => {
  const name = "Robert 原输入";
  const text = crmId(`Student asked: "${name}"`);
  assert.ok(text.includes(name));
  assert.notEqual(text, `Student asked: "${name}"`);
  assert.ok(crmId("Due 2026-10-14 12:00").includes("2026-10-14 12:00"));
  assert.equal(
    crmId("TEST unknown original note"),
    "TEST unknown original note",
  );
});
test("system enum localization leaves values and original English/Chinese contracts intact", () => {
  assert.equal(crmValue("Hot", "en"), "Hot");
  assert.equal(crmValue("Hot", "zh"), "高意向");
  assert.equal(crmValue("Hot", "id"), "Minat tinggi");
  assert.equal(crmLocale("id"), "id-ID");
  assert.equal(crmValue("Robert", "id"), "Robert");
  assert.equal(crmError("Login required", "id"), crmId("Please sign in."));
});
test("worklist translates labels without translating names or mutating records", () => {
  const lead: any = {
    id: "test",
    fullName: "Hot 中文姓名",
    owner: "Robert",
    goal: "Work in China",
    city: "Jakarta",
    mode: "Online",
    tier: "Hot",
    currentStage: "New",
    attention: { unreadCount: 0, tasks: [] },
  };
  const before = JSON.stringify(lead);
  const html = renderToStaticMarkup(
    React.createElement(CrmLeadWorkspace, {
      leads: [lead],
      view: "worklist",
      lang: "id",
      isLight: true,
      timezone: "Asia/Jakarta",
      loading: false,
      employeeId: "Robert",
      employees: [{ id: "Robert", displayName: "Robert" }],
      onOpen() {},
      onReset() {},
    }),
  );
  assert.match(html, /Hot 中文姓名/);
  assert.ok(html.includes(crmId("Learning needs")));
  assert.ok(html.includes("Minat tinggi"));
  assert.doesNotMatch(html, /学习需求|暂无待办/);
  assert.equal(JSON.stringify(lead), before);
});
test("notification search control and guide render all three languages", () => {
  const search = renderToStaticMarkup(
    React.createElement(SearchableChoices, {
      title: "TEST",
      values: [],
      choices: [],
      onChange() {},
      zh: false,
      lang: "id",
      isLight: true,
    }),
  );
  assert.ok(search.includes(crmId("Search options")));
  assert.ok(!search.includes('placeholder="Search options"'));
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmUserGuide, { lang, isLight: true }),
    );
    assert.ok(
      html.includes(
        {
          en: "CRM operating guide",
          id: "Panduan operasional CRM",
          zh: "CRM 操作指南",
        }[lang],
      ),
    );
    assert.ok(
      html.includes(
        {
          en: "Notification rules, channels and delivery audit",
          id: "Aturan notifikasi, kanal, dan audit pengiriman",
          zh: "通知策略、渠道与发送审计",
        }[lang],
      ),
    );
  }
});
