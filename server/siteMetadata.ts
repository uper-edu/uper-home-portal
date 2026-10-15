import fs from "node:fs/promises";
import path from "node:path";
import type { Express } from "express";
import {
  cleanPath,
  isPrivatePath,
  normalizeSiteLanguage,
  resolveMetadata,
  robotsFor,
  publicContentMetadata,
  type Metadata,
} from "../src/utils/siteMetadata.ts";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function renderMetadataHead(m: Metadata) {
  const meta = (key: string, value: string, property = false) =>
    `<meta data-rh="true" ${property ? "property" : "name"}="${key}" content="${esc(value)}"/>`;
  return (
    `<title>${esc(m.title)}</title>` +
    meta("description", m.description) +
    meta("robots", robotsFor(m)) +
    meta("og:title", m.title, true) +
    meta("og:description", m.description, true) +
    meta("og:type", m.type, true) +
    meta("og:site_name", "UPER", true) +
    meta(
      "og:locale",
      m.lang === "zh" ? "zh_CN" : m.lang === "en" ? "en_US" : "id_ID",
      true,
    ) +
    meta("twitter:title", m.title) +
    meta("twitter:description", m.description) +
    meta("twitter:card", m.image ? "summary_large_image" : "summary") +
    (m.canonical
      ? `<link data-rh="true" rel="canonical" href="${esc(m.canonical)}"/>` +
        meta("og:url", m.canonical, true)
      : "") +
    m.alternates
      .map(
        (a) =>
          `<link data-rh="true" rel="alternate" hreflang="${a.lang}" href="${esc(a.href)}"/>`,
      )
      .join("") +
    (m.image
      ? meta("og:image", m.image, true) + meta("twitter:image", m.image)
      : "") +
    (m.schema.length
      ? `<script data-rh="true" type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": m.schema }).replace(/</g, "\\u003c")}</script>`
      : "")
  );
}
export function injectMetadata(html: string, meta: Metadata) {
  return html
    .replace(
      /<html\s+lang="[^"]*"/,
      `<html lang="${meta.lang === "zh" ? "zh-CN" : meta.lang}"`,
    )
    .replace(
      /<!-- UPER_METADATA_START -->[\s\S]*?<!-- UPER_METADATA_END -->/,
      `<!-- UPER_METADATA_START -->${renderMetadataHead(meta)}<!-- UPER_METADATA_END -->`,
    );
}
export function mountMetadataHeaders(app: Express) {
  app.use((q, r, next) => {
    if (isPrivatePath(q.path)) {
      r.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      if (!q.path.startsWith("/api/"))
        r.setHeader("Cache-Control", "private, no-store");
    }
    next();
  });
}
export function mountMetadataHtml(app: Express, directory: string, db: any) {
  app.get("/{*path}", async (q, r, next) => {
    try {
      // Asset misses must never masquerade as HTML pages.
      if (/\.[a-z0-9]{1,6}$/i.test(q.path)) return r.status(404).end();
      const route = cleanPath(q.path);
      const admin = /^\/(crm|cms|system)(\/|$)/i.test(route);
      const cookieName = admin ? "uper_admin_ui_lang=" : "uper_public_ui_lang=";
      const preference = (q.headers.cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(cookieName))
        ?.slice(cookieName.length);
      const lang = normalizeSiteLanguage(
        typeof q.query.lang === "string"
          ? q.query.lang
          : ["en", "id", "zh"].includes(preference || "")
            ? preference
            : admin
              ? "en"
              : "id",
      );
      let options: Parameters<typeof resolveMetadata>[2] =
        route.toLowerCase() === "/crm" &&
        typeof q.query.tab === "string" &&
        ["leads", "campaigns", "policy", "docs"].includes(q.query.tab)
          ? { module: q.query.tab }
          : {};
      const dynamic = route.match(/^\/(news|campaign)\/([^/]+)$/);
      if (dynamic) {
        try {
          const [rows] = await db.execute(
            "SELECT items,items_text FROM cms_collections WHERE name=?",
            [dynamic[1] === "news" ? "news" : "campaigns"],
          );
          const items =
            rows[0]?.items_text !== null && rows[0]?.items_text !== undefined
              ? JSON.parse(rows[0].items_text)
              : rows[0]?.items || [];
          const item = items.find(
            (x: any) =>
              (x.slug?.current || x.slug) === decodeURIComponent(dynamic[2]),
          );
          options = item
            ? {
                ...publicContentMetadata(item),
                type: dynamic[1] === "news" ? "article" : "website",
              }
            : { notFound: true };
        } catch {
          options = { unavailable: true };
        }
      }
      const meta = resolveMetadata(route, lang, options);
      r.setHeader("Cache-Control", "private, no-store");
      if (!meta.indexable) r.setHeader("X-Robots-Tag", robotsFor(meta));
      const template = await fs.readFile(
        path.join(directory, "index.html"),
        "utf8",
      );
      r.status(meta.status || 200)
        .type("html")
        .send(injectMetadata(template, meta));
    } catch (e) {
      next(e);
    }
  });
}
