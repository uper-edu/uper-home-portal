import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { adminRoleLabel, availableWorkspaces } from "../src/utils/adminWorkspace";
import { cmsIndonesian, cmsText } from "../src/utils/cmsLanguage";
import ContentManagementPanel from "../src/components/crm/ContentManagementPanel";
test("Workspace navigation respects independent CRM and CMS permissions", () => {
  assert.deepEqual(
    availableWorkspaces({ permissions: ["crm.read", "cms.manage"] }),
    ["crm", "cms"],
  );
  assert.deepEqual(availableWorkspaces({ permissions: ["cms.manage"] }), [
    "cms",
  ]);
  assert.deepEqual(
    availableWorkspaces({ permissions: ["crm.read", "crm.assign"] }),
    ["crm"],
  );
  assert.deepEqual(availableWorkspaces({ permissions: [] }), []);
});
test("CMS static interface and collection metadata have Indonesian translations", () => {
  const source = ts.createSourceFile(
    "CMS.tsx",
    fs.readFileSync("src/components/crm/ContentManagementPanel.tsx", "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const labels = new Set<string>();
  function visit(n: ts.Node) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(source) === "t" &&
      n.arguments[0] &&
      (ts.isStringLiteral(n.arguments[0]) ||
        ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))
    )
      labels.add(n.arguments[0].text);
    if (
      ts.isPropertyAssignment(n) &&
      /^(titleEn|descEn|groupEn)$/.test(n.name.getText(source)) &&
      ts.isStringLiteral(n.initializer)
    )
      labels.add(n.initializer.text);
    ts.forEachChild(n, visit);
  }
  visit(source);
  for (const label of labels)
    assert.ok(cmsIndonesian[label], "Missing Indonesian CMS text: " + label);
});
for (const lang of ["en", "id", "zh"] as const)
  test(`CMS initial interface and guide render in ${lang}`, () => {
    const html = renderToStaticMarkup(
      React.createElement(ContentManagementPanel, { lang, isLight: true }),
    );
    const visible = html.replace(/<[^>]+>/g, " ");
    if (lang !== "zh") assert.ok(!/[\u4e00-\u9fff]/.test(visible));
    assert.ok(!visible.includes("CMS Engine"));
    assert.ok(
      visible.includes(cmsText("CMS operating guide", "CMS 操作指南", lang)),
    );
    if (lang === "id")
      assert.ok(
        visible.includes("Mitra dan universitas") &&
          visible.includes("Manajemen penjualan") === false,
      );
  });

test("Renamed role labels are consistent in three languages without changing identifiers", () => {
  assert.equal(adminRoleLabel('crm_leader','en'),'CRM Manager');
  assert.equal(adminRoleLabel('cms_admin','en'),'CMS Operator');
  assert.equal(adminRoleLabel('crm_leader','id'),'Manajer CRM');
  assert.equal(adminRoleLabel('cms_admin','id'),'Operator CMS');
  assert.equal(adminRoleLabel('crm_leader','zh'),'CRM 管理者');
  assert.equal(adminRoleLabel('cms_admin','zh'),'CMS 操作员');
  assert.equal(adminRoleLabel('sales','en'),'Sales');
});
