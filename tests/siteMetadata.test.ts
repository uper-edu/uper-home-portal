import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import express from "express";
import {
  publicPages,
  moduleNames,
  resolveMetadata,
  robotsFor,
  isPrivatePath,
  publicContentMetadata,
  validMetadataDate,
} from "../src/utils/siteMetadata.ts";
import {
  injectMetadata,
  mountMetadataHeaders,
  mountMetadataHtml,
} from "../server/siteMetadata.ts";
import { siteMap } from "../scripts/site-map.ts";
for (const lang of ["en", "id", "zh"] as const) {
  test(`Public route metadata has one accurate canonical and complete language links in ${lang}`, () => {
    const titles = new Set();
    for (const path of Object.keys(publicPages)) {
      const m = resolveMetadata(path, lang);
      assert.equal(m.indexable, true);
      assert.equal(m.alternates.length, 4);
      const u = new URL(m.canonical!);
      assert.equal(u.pathname, path);
      assert.equal(u.searchParams.get("lang"), lang === "id" ? null : lang);
      assert.ok(!titles.has(m.title));
      titles.add(m.title);
      assert.ok(m.description.length > 20);
      assert.ok(m.title.endsWith(" | UPER"));
      assert.equal(
        m.schema.some((x: any) => x.dateModified),
        false,
      );
      if (lang === "zh") assert.match(m.description, /\p{Script=Han}/u);
      else assert.doesNotMatch(m.description, /\p{Script=Han}/u);
    }
  });
  test(`Every private module, login and denial stays noindex with neutral metadata in ${lang}`, () => {
    for (const [workspace, modules] of Object.entries(moduleNames)) {
      const titles = new Set();
      for (const module of Object.keys(modules)) {
        const m = resolveMetadata("/" + workspace, lang, { module });
        assert.ok(!titles.has(m.title));
        titles.add(m.title);
        assert.match(robotsFor(m), /noindex/);
        assert.equal(m.canonical, undefined);
        assert.deepEqual(m.alternates, []);
        assert.deepEqual(m.schema, []);
      }
      for (const state of ["login", "checking", "denied"] as const) {
        const m = resolveMetadata("/" + workspace, lang, { state });
        assert.equal(m.indexable, false);
        assert.ok(m.title.endsWith(" | UPER"));
      }
    }
    for (const p of [
      "/CMS",
      "/crm/",
      "/studio",
      "/chat",
      "/consult",
      "/style-guide",
    ])
      assert.equal(resolveMetadata(p, lang).indexable, false);
  });
}
test("Tracking IDs, customer queries, request host and API prefixes cannot become public metadata", () => {
  assert.equal(isPrivatePath("/api/crm/leads"), true);
  assert.equal(isPrivatePath("/crm-article"), false);
  assert.equal(resolveMetadata("/unknown", "en").status, 404);
  assert.equal(resolveMetadata("/crm/absent", "en").status, 404);
  assert.equal(
    resolveMetadata("/ABOUT", "en").canonical,
    "https://uperedu.com/about?lang=en",
  );
  assert.equal(
    resolveMetadata("//about/", "en").canonical,
    "https://uperedu.com/about?lang=en",
  );
});
test("Dynamic source preserves original title; private fields, invented dates and false language variants are excluded", () => {
  const source = publicContentMetadata({
    title: "原文 tetap unchanged",
    summary: "<b>Actual content</b>",
    password: "SECRET",
    _updatedAt: "unknown",
    profile: { fullName: "PRIVATE" },
  });
  const m = resolveMetadata("/news/source", "en", {
    ...source,
    type: "article",
  });
  assert.equal(m.title, "原文 tetap unchanged | UPER");
  assert.equal(m.description, "Actual content");
  assert.equal(m.canonical, "https://uperedu.com/news/source");
  assert.equal(m.alternates.length, 0);
  assert.doesNotMatch(JSON.stringify(m), /SECRET|PRIVATE|dateModified/);
  assert.equal(validMetadataDate("1970-placeholder"), undefined);
  assert.ok(validMetadataDate("2026-10-14T01:00:00Z"));
});
test("Missing and unavailable public records are noindex with correct status, not fictitious success", () => {
  for (const flags of [{ notFound: true }, { unavailable: true }]) {
    const m = resolveMetadata("/news/missing", "zh", flags);
    assert.equal(m.indexable, false);
    assert.deepEqual(m.schema, []);
    assert.equal(m.canonical, undefined);
    assert.equal(m.status, flags.notFound ? 404 : 503);
  }
});
test("Server head is safe before JavaScript runs and HTML/schema escaping prevents head injection", () => {
  const m = resolveMetadata("/news/unsafe", "en", {
    title: "</title><script>BAD</script>",
    description: 'quote " & <img>',
    image: 'https://example.invalid/a"x',
  });
  const html = injectMetadata(
    '<html lang="id"><head><!-- UPER_METADATA_START -->OLD<!-- UPER_METADATA_END --></head></html>',
    m,
  );
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.doesNotMatch(html, /<script>BAD|<img>|OLD/);
  assert.ok(html.includes('lang="en"'));
  assert.ok(html.includes("\\u003c") || !html.includes("</title><script>"));
});
test("Sitemap matches route catalogue and language detection; excludes private or campaign identifiers", async () => {
  assert.equal(await fs.readFile("public/sitemap.xml", "utf8"), siteMap());
  assert.doesNotMatch(
    siteMap(),
    /lng=|\/crm|\/cms|\/system|lastmod|campaignId/,
  );
  assert.equal(
    (siteMap().match(/<loc>/g) || []).length,
    Object.keys(publicPages).length * 3,
  );
});
test("Initial HTTP responses enforce private indexing policy, language, dynamic CMS and correct failure states", async () => {
  const dir = await fs.mkdtemp("/private/tmp/uper-metadata-test-");
  await fs.writeFile(
    dir + "/index.html",
    '<html lang="id"><head><!-- UPER_METADATA_START --><title>UPER</title><!-- UPER_METADATA_END --></head><body>APP</body></html>',
  );
  let unavailable = false;
  const db = {
    async execute(_sql: string, args: string[]) {
      if (unavailable) throw Error("TEST unavailable");
      return [
        [
          {
            items: [
              {
                slug: { current: "test" },
                title:
                  args[0] === "news"
                    ? "TEST Original Article"
                    : "TEST Campaign",
                summary: "TEST original summary",
              },
            ],
            items_text: null,
          },
        ],
      ];
    },
  };
  const app = express();
  mountMetadataHeaders(app);
  app.get("/api/test", (_q, r) =>
    r.status(401).json({ error: "Login required" }),
  );
  mountMetadataHtml(app, dir, db);
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((r) =>
      server.listening ? r() : server.once("listening", r),
    );
    const base = "http://127.0.0.1:" + (server.address() as any).port;
    for (const lang of ["en", "id", "zh"])
      for (const path of [
        "/crm",
        "/cms",
        "/CMS",
        "/system",
        "/chat",
        "/consult",
        "/studio",
        "/style-guide",
      ]) {
        const r = await fetch(base + path + "?lang=" + lang + "&lead=PRIVATE");
        const text = await r.text();
        assert.equal(r.status, 200);
        assert.match(r.headers.get("x-robots-tag")!, /noindex/);
        assert.match(text, /name="robots" content="noindex/);
        assert.doesNotMatch(
          text,
          /rel="canonical"|application\/ld\+json|PRIVATE/,
        );
      }
    for (const path of Object.keys(publicPages)) {
      const r = await fetch(base + path + "?lang=en&utm_source=TEST");
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-robots-tag"), null);
      const text = await r.text();
      assert.ok(
        text.includes(
          resolveMetadata(path, "en").title.replaceAll("&", "&amp;"),
        ),
      );
      assert.doesNotMatch(text, /utm_source/);
    }
    const preferred = await fetch(base + "/system", {
      headers: { Cookie: "uper_admin_ui_lang=zh" },
    });
    assert.match(await preferred.text(), /用户管理 \| 系统管理 \| UPER/);
    const defaultAdmin = await fetch(base + "/system");
    assert.match(
      await defaultAdmin.text(),
      /Users \| System Management \| UPER/,
    );
    const news = await fetch(base + "/news/test?lang=zh");
    assert.equal(news.status, 200);
    assert.match(await news.text(), /TEST Original Article/);
    const missing = await fetch(base + "/news/missing");
    assert.equal(missing.status, 404);
    unavailable = true;
    assert.equal((await fetch(base + "/news/test")).status, 503);
    assert.equal(
      (await fetch(base + "/api/test")).headers.get("x-robots-tag"),
      "noindex, nofollow, noarchive",
    );
    assert.equal((await fetch(base + "/absent")).status, 404);
    assert.equal((await fetch(base + "/missing.js")).status, 404);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await fs.rm(dir, { recursive: true });
  }
});
