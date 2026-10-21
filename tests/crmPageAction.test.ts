import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Download, RefreshCw } from "lucide-react";
import { CrmPageAction } from "../src/components/crm/CrmPageAction.tsx";

test("page actions retain native link behavior and accessible icon-only busy state", () => {
  const refresh = renderToStaticMarkup(
    React.createElement(CrmPageAction, {
      icon: RefreshCw,
      label: "刷新活动",
      iconOnly: true,
      loading: true,
    }),
  );
  assert.match(refresh, /aria-label="刷新活动"/);
  assert.match(refresh, /title="刷新活动"/);
  assert.match(refresh, /aria-busy="true"/);
  assert.match(refresh, /disabled=""/);
  const link = renderToStaticMarkup(
    React.createElement(CrmPageAction, {
      icon: Download,
      label: "Export",
      href: "/api/crm/export?owner=me",
    }),
  );
  assert.match(link, /^<a /);
  assert.match(link, /href="\/api\/crm\/export\?owner=me"/);
  assert.match(link, /<span>Export<\/span>/);
  const disabledLink = renderToStaticMarkup(
    React.createElement(CrmPageAction, {
      icon: Download,
      label: "Export",
      href: "/api/crm/export",
      disabled: true,
    }),
  );
  assert.doesNotMatch(disabledLink, /href=/);
  assert.match(disabledLink, /disabled=""/);
});
