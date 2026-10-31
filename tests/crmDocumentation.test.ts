import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import React from "react";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CrmUserGuide,
  resolveGuideAnchor,
  operationGroups,
  crmDocumentationFields,
} from "../src/components/crm/CrmUserGuide.tsx";
import { systemChapters } from "../src/components/crm/CrmSystemGuide.ts";
import { guideSections } from "../src/components/crm/CrmGuideContent.ts";
import dictionary from "../src/components/crm/crmDictionary.json";
import snapshot from "../docs/reference/crm-implementation-snapshot-20261017.json";
const documentedSource = (source: string) =>
  fs.existsSync(source) ||
  snapshot.references.some(
    (reference) =>
      reference.path === source && /^[a-f0-9]{64}$/.test(reference.sha256),
  );
import {
  dictionaryMeaning,
  dictionaryWriter,
} from "../src/components/crm/CrmDictionaryMeaning.ts";
import { evaluateFullLeadTier } from "../src/types/crmLead.ts";
import { calculateLeadTier } from "../src/types/leadSystem.ts";
import { sla } from "../src/utils/workCalendar.ts";
test("Ten system chapters and operating groups stay separate from the third WhatsApp part", () => {
  assert.equal(systemChapters.length, 10);
  assert.equal(operationGroups.length, 10);
  assert.deepEqual(
    operationGroups.flat().sort(),
    guideSections.map((s) => s.key).sort(),
  );
  for (const s of systemChapters) {
    assert.ok(
      guideSections.some((g) => g.key === s.related),
      s.key,
    );
    for (const source of s.sources) assert.ok(documentedSource(source), source);
  }
  for (let i = 1; i <= 10; i++) assert.ok(resolveGuideAnchor("#chapter-" + i));
  for (const section of [...systemChapters, ...guideSections])
    assert.ok(resolveGuideAnchor("#crm-guide-" + section.key));
  assert.deepEqual(resolveGuideAnchor("#crm-guide-fields"), {
    part: "system",
    key: "data-implementation",
  });
  assert.equal(resolveGuideAnchor("#chapter-55"), null);
});
test("Dictionary includes all 36 tables, nested properties, expanded enum values and latest schema fields", () => {
  execFileSync(process.execPath, [
    "scripts/crm-documentation-dictionary.mjs",
    "--check",
  ]);
  assert.equal(
    new Set(
      dictionary.filter((r) => r.layer === "storage").map((r) => r.object),
    ).size,
    36,
  );
  assert.equal(
    dictionary.filter(
      (r) => r.object === "crm_users" && r.key === "password_hash",
    ).length,
    1,
  );
  assert.ok(dictionary.some((r) => r.key === "contactArrangement.reviewAt"));
  assert.match(
    dictionary.find(
      (r) => r.object === "CrmLeadRecord" && r.key === "currentStage",
    )!.type,
    /Assessment Booked/,
  );
  assert.ok(
    dictionary.some((r) => r.object === "notification_migration_holds"),
  );
  assert.ok(
    dictionary.some(
      (r) => r.object === "cms_collections" && r.key === "items_text",
    ),
  );
  for (const r of dictionary) {
    assert.equal(dictionaryMeaning(r).length, 3);
    assert.equal(dictionaryWriter(r).length, 3);
    assert.ok(documentedSource(r.source));
  }
});
for (const lang of ["en", "id", "zh"] as const)
  test(`Concepts, diagrams, captions and dictionary render in ${lang} without other-language copy`, () => {
    const html = renderToStaticMarkup(
      React.createElement(CrmUserGuide, {
        lang,
        isLight: true,
        initialChapter: "entities",
      }),
    );
    const text = html.replace(/<[^>]+>/g, " ");
    if (lang !== "zh") assert.doesNotMatch(text, /[\u4e00-\u9fff]/);
    assert.equal((html.match(/id="crm-guide-/g) || []).length, 1);
    assert.ok(
      html.includes("crm-doc-nav-system") &&
        html.includes("crm-doc-nav-operations"),
    );
    assert.match(html, /<ol class="crm-doc-flow"/);
    assert.match(html, /<caption/);
    assert.match(html, /aria-expanded="true"/);
    assert.doesNotMatch(html, /<details open=""/);
    assert.ok(
      text.includes(
        { en: "System explanation", id: "Penjelasan sistem", zh: "系统说明" }[
          lang
        ],
      ),
    );
    assert.doesNotMatch(text, /100%|3倍|3x|fully automated closed/);
  });
test("Published R6 requires server sequence authorization; cumulative touches do not trigger it", () => {
  const base: any = {
    buyingSignal: "Asked price",
    currentStatus: "Working professional",
    goal: "Prepare for HSK certification",
    levelState: "PARTIAL",
    city: "Jakarta",
    mode: "Online",
    connectStatus: "No Response",
    touchCount: 3,
  };
  assert.equal(evaluateFullLeadTier(base).tier, "Hot");
  assert.equal(evaluateFullLeadTier({...base,noResponseReady:true}).tier,"Hot");
  assert.equal(calculateLeadTier(base).tier, "Hot");
  assert.equal(evaluateFullLeadTier({ ...base, touchCount: 2 }).tier, "Hot");
  assert.equal(
    evaluateFullLeadTier({
      ...base,
      buyingSignal: "None yet",
      connectStatus: "Connected",
      currentStatus: "Teacher or school staff",
    }).tier,
    "School",
  );
  assert.equal(
    evaluateFullLeadTier({
      ...base,
      buyingSignal: "None yet",
      connectStatus: "Connected",
      city: "Jakarta",
      mode: "Offline",
    }).tier,
    "Warm-Offline",
  );
  assert.equal(
    evaluateFullLeadTier({
      ...base,
      buyingSignal: "None yet",
      connectStatus: "Connected",
      city: "Jakarta",
      mode: "Offline",
      assessmentDone: true,
    }).tier,
    "Hot",
  );
});
test("Four published natural-duration calendar examples execute correctly", () => {
  const calendar = {
    timezone: "Asia/Jakarta",
    days: [1, 2, 3, 4, 5, 6],
    start: "09:00",
    end: "20:00",
  };
  for (const [input, expected] of [
    ["2026-10-12T10:00:00+07:00", "2026-10-12T13:00:00+07:00"],
    ["2026-10-12T23:00:00+07:00", "2026-10-13T12:00:00+07:00"],
    ["2026-10-17T19:00:00+07:00", "2026-10-19T09:00:00+07:00"],
    ["2026-10-18T10:00:00+07:00", "2026-10-19T12:00:00+07:00"],
  ])
    assert.equal(
      sla(new Date(input), 3, calendar).toISOString(),
      new Date(expected).toISOString(),
    );
});

import {
  CrmGuideDiagram,
  executionRules,
  ruleDefinitions,
  slaSamples,
} from "../src/components/crm/CrmGuideDiagrams.tsx";
test("CRM display dictionary excludes CMS and public submission objects without modifying the full source index", () => {
  assert.ok(crmDocumentationFields.length < dictionary.length);
  assert.equal(
    new Set(
      crmDocumentationFields
        .filter((r) => r.layer === "storage")
        .map((r) => r.object),
    ).size,
    33,
  );
  for (const row of crmDocumentationFields)
    assert.ok(
      !["cms_collections", "cms_media", "site_submissions"].includes(
        row.object,
      ),
    );
  assert.ok(dictionary.some((r) => r.object === "cms_media"));
});
test("Published classification explains decision boundaries instead of retired automatic upgrades", () => {
  assert.deepEqual(executionRules, ['B1','B2','B3','B4']);
  const html=renderToStaticMarkup(React.createElement(CrmGuideDiagram,{kind:'classification',col:2}));
  assert.match(html,/仅首次登记/);
  assert.match(html,/不自动重算Tier/);
  assert.match(html,/AI描述不能证明事件成立/);
  assert.doesNotMatch(html,/提升中意向|达到阈值.*转培育/);
});
for (const lang of ["en", "id", "zh"] as const)
  for (const kind of [
    "classification",
    "acquisition",
    "sla",
    "notification",
  ] as const)
    test(`${kind} diagram uses accessible structure and ${lang} text`, () => {
      const html = renderToStaticMarkup(
        React.createElement(CrmGuideDiagram, {
          kind,
          col: lang === "zh" ? 2 : lang === "id" ? 1 : 0,
        }),
      );
      assert.match(html, /<figure/);
      assert.match(html, /<figcaption/);
      assert.match(html, /<ol|<table/);
      const text = html.replace(/<[^>]*>/g, " ");
      if (lang !== "zh") assert.doesNotMatch(text, /[\u4e00-\u9fff]/);
      assert.doesNotMatch(text, /100%|3倍|3x/);
      if (kind === "sla") {
        assert.equal((html.match(/aria-pressed=/g) || []).length, 4);
        assert.match(html, /data-sla-sample="night"/);
      }
      if (kind === "acquisition")
        assert.ok(
          text.includes(
            {
              en: "not a strict conversion funnel",
              id: "bukan corong konversi ketat",
              zh: "不是严格转化漏斗",
            }[lang],
          ),
        );
      if (kind === "notification")
        assert.ok(
          text.includes(
            { en: "API accepted", id: "Diterima API", zh: "接口接受" }[lang],
          ),
        );
    });
test("Every plotted SLA sample is validated by the unchanged server calendar function", () => {
  const calendar = {
    timezone: "Asia/Jakarta",
    days: [1, 2, 3, 4, 5, 6],
    start: "09:00",
    end: "20:00",
  };
  for (const sample of slaSamples)
    assert.equal(
      sla(new Date(sample.input), 3, calendar).toISOString(),
      new Date(sample.expected).toISOString(),
    );
});

test("Unique architecture material moves to the appropriate operating and data chapters in every language", () => {
  const account = guideSections.find((s) => s.key === "access")!;
  const data = systemChapters.find((s) => s.key === "data-implementation")!;
  for (const col of [0, 1, 2]) {
    const accountText = account.body.map((row) => row[col]).join(" ");
    const dataText = data.blocks
      .flatMap((b) => b.items.map((row) => row[col]))
      .join(" ");
    assert.match(accountText, /Build/);
    assert.match(accountText, /UTC/);
    assert.match(accountText, /GitHub/);
    assert.match(accountText, /Git/);
    assert.match(dataText, /MySQL/);
    assert.match(dataText, /JSON/);
    assert.ok(
      accountText.includes(
        [
          "external education-platform",
          "platform pendidikan eksternal",
          "外部教育平台",
        ][col],
      ),
    );
  }
});

for (const [col, lang] of (["en", "id", "zh"] as const).entries()) {
  test(`Every chapter keeps the same navigation, breadcrumb and primary title in ${lang}`, () => {
    const escaped = (text: string) =>
      renderToStaticMarkup(React.createElement("span", null, text)).slice(
        6,
        -7,
      );
    for (const section of [...systemChapters, ...guideSections]) {
      const html = renderToStaticMarkup(
        React.createElement(CrmUserGuide, {
          lang,
          isLight: true,
          initialChapter: section.key,
        }),
      );
      const title = escaped(section.title[col]);
      assert.ok(html.includes(`<h3>${title}</h3>`), section.key);
      const breadcrumb = html.match(
        /<p class="crm-doc-breadcrumb">([\s\S]*?)<\/p>/,
      )![1];
      assert.ok(breadcrumb.endsWith(title), section.key);
      assert.ok(
        html.includes(`aria-current="page"`) && html.includes(`>${title}</a>`),
        section.key,
      );
    }
  });
}

test("Metrics has a direct chapter entry; keyboard help remains under troubleshooting", () => {
  assert.deepEqual(
    operationGroups.find((g) => g.includes("process-and-marketing-metrics")),
    ["process-and-marketing-metrics"],
  );
  assert.deepEqual(
    operationGroups.find((g) => g.includes("failure-and-accessibility")),
    ["support", "failure-and-accessibility"],
  );
});

test("Operational details remain available in their destination chapters in all languages", () => {
  const rows = (key: string, col: number) =>
    guideSections
      .find((s) => s.key === key)!
      .body.map((r) => r[col])
      .join(" ");
  for (const col of [0, 1, 2]) {
    assert.ok(
      rows("followup", col).includes(
        ["In Prepare contact", "Di Siapkan kontak", "准备联系提供"][col],
      ),
    );
    assert.ok(
      rows("workspace", col).includes(
        [
          "Customer owner and Sales stage",
          "Penanggung jawab pelanggan dan Tahap penjualan",
          "客户资料中的负责人和销售阶段",
        ][col],
      ) ||
        rows("workspace", col).includes(
          [
            "owner and sales stage",
            "penanggung jawab dan tahap penjualan",
            "客户资料中的负责人和销售阶段",
          ][col],
        ),
    );
    assert.ok(
      rows("support", col).includes(
        [
          "Temporary connection failure",
          "Gangguan koneksi sementara",
          "临时断线",
        ][col],
      ),
    );
  }
});

for (const lang of ["en", "id", "zh"] as const) {
  test(`WhatsApp continuous guide preserves all section anchors in ${lang}`, async () => {
    const { whatsAppSections } = await import("../src/components/crm/CrmWhatsAppGuide.tsx");
    assert.equal(whatsAppSections.length, 10);
    assert.equal(new Set(whatsAppSections.map(s => s.key)).size, 10);
    let allHtml = "";
    for (const chapter of whatsAppSections) {
      assert.deepEqual(resolveGuideAnchor("#crm-guide-" + chapter.key), { part: "whatsapp", key: chapter.key });
      const html = renderToStaticMarkup(React.createElement(CrmUserGuide, { lang, isLight: true, initialChapter: chapter.key }));
      const text = html.replace(/<[^>]+>/g, " ");
      assert.ok(text.includes(chapter.title[lang === "zh" ? 2 : lang === "id" ? 1 : 0]));
      assert.match(html, /id="crm-doc-nav-whatsapp"/);
      assert.doesNotMatch(html, /Search both parts|Cari kedua bagian|搜索两部分/);
      const systemNav = html.match(/<ol id="crm-doc-nav-system"[\s\S]*?<\/ol>/)?.[0] || "";
      assert.ok(!systemNav.includes("whatsapp-hybrid"));
      assert.ok(html.indexOf("crm-doc-nav-operations") < html.indexOf("crm-doc-nav-whatsapp"));
      assert.equal((html.match(/id="crm-guide-/g) || []).length, 10);
      // Every anchor renders the same continuous document with one shared image.
      const body = html.slice(html.indexOf('class="crm-doc-whatsapp"'));
      assert.ok(!body.includes("<details"));
      assert.equal((body.match(/<img /g) || []).length, 1);
      assert.match(body, /<figcaption/);
      for (const target of whatsAppSections) assert.ok(body.includes('id="crm-guide-' + target.key + '"'));
      if (lang !== "zh") assert.doesNotMatch(text, /[\u4e00-\u9fff]/);
      allHtml += body;
    }
    assert.ok(allHtml.includes('https://whatsappbusiness.com/resources/faq/'));
    assert.ok(allHtml.includes('rel="noopener noreferrer"'));
    assert.match(allHtml, /ctwa_clid/);
    assert.match(allHtml, /Rp356.65/);
    assert.match(allHtml, /scope="col"/);
  });
}
test("Chinese WhatsApp reference matches the online content", () => {
  const content = JSON.parse(fs.readFileSync("src/components/crm/whatsappGuide.json", "utf8"));
  const reference = fs.readFileSync("docs/crm/whatsapp-hybrid.md", "utf8");
  assert.ok(reference.endsWith(content.zh));
  const urls = (value: string) => [...value.matchAll(/\]\((https:[^)]+)\)/g)].map(m => m[1]).sort();
  assert.deepEqual(urls(content.en), urls(content.zh));
  assert.deepEqual(urls(content.id), urls(content.zh));
});

test("Fourth part preserves the reviewed playbook, all diagrams, tables and resolvable references", async () => {
  const content = JSON.parse(fs.readFileSync("src/components/crm/marketingPlaybook.json", "utf8"));
  const source = fs.readFileSync("docs/reference/UPER_Marketing_CRM_Playbook_v2.0.html");
  assert.equal(createHash("sha256").update(source).digest("hex"), content.sourceSha256);
  const { marketingPlaybookSections } = await import("../src/components/crm/CrmMarketingPlaybook.tsx");
  assert.equal(marketingPlaybookSections.length, 13);
  assert.match(marketingPlaybookSections[0].searchText, /核心原则/);
  assert.deepEqual(resolveGuideAnchor("#crm-guide-marketing-playbook"), { part: "marketing", key: "marketing-playbook" });
  for (const section of marketingPlaybookSections) {
    assert.deepEqual(resolveGuideAnchor("#crm-guide-" + section.key), { part: "marketing", key: section.key });
  }
  const html = renderToStaticMarkup(React.createElement(CrmUserGuide, {lang: "zh", isLight: true, initialChapter: "marketing-playbook-sec-10"}));
  const body = html.slice(html.indexOf('class="crm-doc-playbook"'));
  assert.equal((body.match(/<table /g) || []).length, 52);
  assert.equal((body.match(/<svg /g) || []).length, 4);
  assert.equal((body.match(/<h4>/g) || []).length, 13);
  assert.ok(html.indexOf('id="crm-doc-nav-whatsapp"') < html.indexOf('id="crm-doc-nav-marketing"'));
  const ids = [...body.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, "All diagram, reference and section IDs must be unique");
  for (const [, key] of body.matchAll(/href="#crm-guide-([^"]+)"/g)) {
    assert.ok(ids.includes("crm-guide-" + key), key);
    assert.deepEqual(resolveGuideAnchor("#crm-guide-" + key), { part: "marketing", key });
  }
  assert.doesNotMatch(body, /<script|<style|<iframe|<form|<object|<embed|<img|\son\w+=|javascript:|file:\/\/|url\(/i);
  for (const [, attributes] of body.matchAll(/<a ([^>]*href="https:[^>]*)>/g)) {
    assert.match(attributes, /rel="noopener noreferrer"/);
  }
  assert.match(body, /46 行 CSV 被接收/);
  assert.match(body, /不代表独立验证/);
  assert.match(body, /建议设计/);
});

test("Playbook import keeps original article text while removing duplicate navigation and standalone scripts", () => {
  const content = JSON.parse(fs.readFileSync("src/components/crm/marketingPlaybook.json", "utf8"));
  const source = fs.readFileSync("docs/reference/UPER_Marketing_CRM_Playbook_v2.0.html", "utf8");
  const text = (value: string) => value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#x27|#39|nbsp);/g, v => ({"&amp;":"&", "&lt;":"<", "&gt;":">", "&quot;":'"', "&#x27;":"'", "&#39;":"'", "&nbsp;":" "}[v]!))
    .replace(/\s/g, "");
  const article = source.slice(source.indexOf('<div class="article">'), source.indexOf('<footer class="footer">'))
    .replace(/<details class="mobile-nav">[\s\S]*?<\/details>/, "")
    .replace(/<h2>[\s\S]*?<\/h2>/g, "");
  const imported = content.preamble + content.sections.map((s: {html: string}) => s.html).join("");
  assert.equal(text(imported), text(article));
});

test("Playbook has a distinct document-start link, separate from its first section", () => {
  const start = renderToStaticMarkup(React.createElement(CrmUserGuide, {lang: "zh", isLight: true, initialChapter: "marketing-playbook"}));
  assert.match(start, /href="#crm-guide-marketing-playbook" aria-label="文档开头" aria-current="page"/);
  assert.match(start, /id="crm-guide-marketing-playbook" tabindex="-1"/);
  assert.match(start, /href="#crm-guide-marketing-playbook-sec-1"/);
  const section = renderToStaticMarkup(React.createElement(CrmUserGuide, {lang: "zh", isLight: true, initialChapter: "marketing-playbook-sec-9"}));
  assert.match(section, /href="#crm-guide-marketing-playbook" aria-label="文档开头" title=/);
});

for (const lang of ["en", "id", "zh"] as const) test(`Playbook opens every anchor as a continuous source document in ${lang}`, async () => {
  const { marketingPlaybookSections } = await import("../src/components/crm/CrmMarketingPlaybook.tsx");
  for (const section of marketingPlaybookSections) {
    const html = renderToStaticMarkup(React.createElement(CrmUserGuide, {lang, isLight: true, initialChapter: section.key}));
    assert.equal((html.match(/<h4>/g) || []).length, 13);
    assert.match(html, /lang="zh-CN"/);
    for (const target of marketingPlaybookSections) assert.ok(html.includes('id="crm-guide-' + target.key + '"'));
    if (lang !== "zh") assert.match(html, /crm-doc-source-language/);
  }
});
