import fs from "node:fs/promises";
import {
  publicPages,
  languageCodes,
  publicUrl,
} from "../src/utils/siteMetadata.ts";
export function siteMap() {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    Object.keys(publicPages)
      .flatMap((path) =>
        languageCodes.map(
          (lang) =>
            "  <url><loc>" +
            publicUrl(path, lang) +
            "</loc>" +
            languageCodes
              .map(
                (l) =>
                  '<xhtml:link rel="alternate" hreflang="' +
                  l +
                  '" href="' +
                  publicUrl(path, l) +
                  '"/>',
              )
              .join("") +
            '<xhtml:link rel="alternate" hreflang="x-default" href="' +
            publicUrl(path, "id") +
            '"/></url>',
        ),
      )
      .join("\n") +
    "\n</urlset>\n"
  );
}
if (process.argv[1]?.endsWith("scripts/site-map.ts"))
  await fs.writeFile("public/sitemap.xml", siteMap());
