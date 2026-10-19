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
  assert.match(search, /aria-haspopup="dialog"/);
  assert.doesNotMatch(search, /<details|<select/);
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmUserGuide, { lang, isLight: true }),
    );
    assert.ok(
      html.includes(
        {
          en: "CRM documentation",
          id: "Dokumentasi CRM",
          zh: "CRM 系统文档",
        }[lang],
      ),
    );
    assert.ok(
      html.includes(
        {
          en: "Notification routing, delivery and audit",
          id: "Perutean, pengiriman, dan audit notifikasi",
          zh: "通知路由、发送与审计",
        }[lang],
      ),
    );
  }
});

test("work-calendar weekdays, durations and guidance render without language leakage", async () => {
  const { CrmPolicySettings } =
    await import("../src/components/crm/CrmPolicySettings.tsx");
  const { DEFAULT_CRM_POLICY_CONFIG } =
    await import("../src/types/crmPolicyConfig.ts");
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmPolicySettings, {
        lang,
        isLight: true,
        policyConfig: DEFAULT_CRM_POLICY_CONFIG,
        onSavePolicy: async () => true,
        onResetPolicy: async () => true,
      }),
    );
    if (lang !== "zh") assert.doesNotMatch(html, /[\u4e00-\u9fff]/);
    if (lang === "id") {
      assert.match(html, />Sen</);
      assert.match(html, />Kam</);
      assert.doesNotMatch(
        html,
        />Mon<|>Tue<|>Wed<|>Thu<|>Fri<|>Sat<|>Sun<|>h<|Prospek Panas|Pemeliharaan Dingin/,
      );
    }
    assert.doesNotMatch(html, /Ch\. 6|第6章|10 道题|官方推荐/);
  }
});
test("provider receipt stays separate from all three localized delivery summaries", async () => {
  const { crmDeliveryResult } = await import("../src/utils/crmLanguage.ts");
  for (const lang of ["en", "id", "zh"] as const) {
    for (const state of [
      "failed",
      "unknown",
      "accepted",
      "simulated",
      "cancelled",
      "pending",
      "sending",
    ]) {
      const label = crmDeliveryResult(
        "UNTRANSLATED VENDOR 保留的供应商原始内容",
        state,
        lang,
      );
      assert.ok(!label.includes("UNTRANSLATED"));
      assert.ok(!label.includes("保留的供应商原始内容"));
      if (lang !== "zh") assert.doesNotMatch(label, /[\u4e00-\u9fff]/);
    }
  }
  assert.equal(crmValue("inapp", "zh"), "站内通知");
  assert.equal(crmValue("inapp", "id"), "Notifikasi dalam aplikasi");
});
test("static bilingual labels have Indonesian entries and templates have no extra tokens", async () => {
  const fs = await import("node:fs");
  const ts = await import("typescript");
  const files = [
    "src/components/crm/CrmPolicySettings.tsx",
    "src/components/crm/CrmCampaignHub.tsx",
    "src/components/crm/CrmLeadFilters.tsx",
    "src/components/crm/CrmLeadWorkspace.tsx",
    "src/components/crm/CrmCustomerDetails.tsx",
    "src/pages/CrmWorkbench.tsx",
    "src/components/CrmAccess.tsx",
    "src/utils/crmLanguage.ts",
    "src/components/NotificationCenter.tsx",
  ];
  for (const file of files) {
    const ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: import("typescript").Node) => {
      const parent = node.parent;
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "t") {
        const argument =
          node.arguments[file.endsWith("NotificationCenter.tsx") ? 1 : 0];
        const checkBranch = (branch: import("typescript").Node) => {
          if (ts.isConditionalExpression(branch)) {
            checkBranch(branch.whenTrue);
            checkBranch(branch.whenFalse);
          } else if (
            ts.isStringLiteralLike(branch) &&
            /[A-Za-z]/.test(branch.text) &&
            !/[\u4e00-\u9fff]/.test(branch.text)
          )
            assert.ok(
              Object.hasOwn(dictionary, branch.text),
              `${file}: ${branch.text}`,
            );
        };
        if (argument) checkBranch(argument);
      }
      if (ts.isStringLiteralLike(node)) {
        const relevant =
          (ts.isCallExpression(parent) &&
            parent.expression.getText(ast) === "t" &&
            parent.arguments[
              file.endsWith("NotificationCenter.tsx") ? 1 : 0
            ] === node) ||
          (ts.isJsxAttribute(parent) && /En$/.test(parent.name.getText(ast))) ||
          (ts.isArrayLiteralExpression(parent) &&
            parent.elements.some((x) =>
              /[\u4e00-\u9fff]/.test(x.getText(ast)),
            ));
        if (
          relevant &&
          /[A-Za-z]/.test(node.text) &&
          !/[\u4e00-\u9fff]/.test(node.text)
        )
          assert.ok(
            Object.hasOwn(dictionary, node.text),
            `${file}: ${node.text}`,
          );
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  for (const [en, id] of Object.entries(dictionary)) {
    const tokens = (text: string) =>
      [...new Set(text.match(/\{\d+\}/g) || [])].sort();
    assert.deepEqual(tokens(id), tokens(en), en);
    assert.doesNotMatch(id, /[\u4e00-\u9fff]/, en);
  }
});

test("language preference presents three visible exclusive choices without a filter popup", async () => {
  const { CrmLanguageSelect } =
    await import("../src/components/crm/CrmLanguageSelect.tsx");
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmLanguageSelect, {
        lang,
        onChange() {},
        isLight: false,
      }),
    );
    assert.match(html, /role="radiogroup"/);
    assert.equal((html.match(/role="radio"/g) || []).length, 3);
    assert.equal((html.match(/aria-checked="true"/g) || []).length, 1);
    assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
    assert.match(html, /data-theme="dark"/);
    assert.ok(
      html.includes(
        `aria-label="${{ en: "English", id: "Bahasa Indonesia", zh: "中文" }[lang]}" title=`,
      ),
    );
    assert.doesNotMatch(html, /<select|listbox|aria-expanded|crm-filter/);
  }
});

test("customer edit choices preserve owner labels, stale values and disabled stage permissions", async () => {
  const { CrmSingleSelect } =
    await import("../src/components/crm/CrmSingleSelect.tsx");
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmSingleSelect, {
        label: "TEST Owner",
        value: "old-owner",
        options: [
          { value: "", label: "Unassigned" },
          { value: "old-owner", label: "Robert 原名" },
        ],
        onChange() {
          throw new Error("Rendering must not write data");
        },
        lang,
        isLight: false,
        searchable: true,
      }),
    );
    assert.match(html, /Robert 原名/);
    assert.match(html, /crm-filter-dimension-button/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.doesNotMatch(html, /<select/);
    const disabled = renderToStaticMarkup(
      React.createElement(CrmSingleSelect, {
        label: "TEST Stage",
        value: "Historical stage",
        options: [],
        onChange() {},
        lang,
        isLight: true,
        disabled: true,
      }),
    );
    assert.match(disabled, /disabled=""/);
    assert.match(disabled, /Historical stage/);
    assert.match(disabled, /aria-expanded="false"/);
  }
});

test("standard option declarations retain disabled prompts, dynamic options and original names", async () => {
  const { crmSelectChoices, CrmSelect } =
    await import("../src/components/crm/CrmSelect.tsx");
  const children = [
    React.createElement(
      "option",
      { value: "", disabled: true, key: "prompt" },
      "Choose a type",
    ),
    React.createElement(React.Fragment, { key: "fragment" }, [
      React.createElement(
        "option",
        { value: "active", key: "active" },
        "Robert 原名",
      ),
      React.createElement(
        "option",
        { value: "archived", key: "archived" },
        "Archived",
      ),
    ]),
  ];
  assert.deepEqual(crmSelectChoices(children), [
    { value: "", label: "Choose a type", disabled: true },
    { value: "active", label: "Robert 原名", disabled: undefined },
    { value: "archived", label: "Archived", disabled: undefined },
  ]);
  const html = renderToStaticMarkup(
    React.createElement(
      CrmSelect,
      {
        label: "TEST",
        value: "active",
        onChange() {
          throw Error("Render cannot save");
        },
        lang: "id",
        isLight: true,
      },
      children,
    ),
  );
  assert.match(html, /Robert 原名/);
  assert.doesNotMatch(html, /<select/);
});
test("CRM module entry points contain no native selectors or independent notification dropdown skin", async () => {
  const fs = await import("node:fs");
  for (const file of [
    "src/pages/CrmWorkbench.tsx",
    "src/components/crm/CrmCampaignHub.tsx",
    "src/components/crm/CrmPolicySettings.tsx",
    "src/components/NotificationCenter.tsx",
    "src/components/SearchableChoices.tsx",
  ])
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /<select\b/, file);
  assert.doesNotMatch(
    fs.readFileSync("src/components/SearchableChoices.tsx", "utf8"),
    /<details\b/,
  );
});
