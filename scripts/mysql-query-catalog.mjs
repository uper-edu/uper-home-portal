import fs from "node:fs";
import ts from "/Users/commando/projects/Uper/uper-home-portal/node_modules/typescript/lib/typescript.js";
import { validateSql } from "../cloud/mysql/sql.mjs";
const sources = fs
  .readdirSync("server/portal")
  .filter((n) => n.endsWith(".ts"))
  .map((n) => "server/portal/" + n)
  .concat([
    "server/mysqlApplication.ts",
    "server/siteMetadata.ts",
    "cloud/mysql/site.mjs",
    "cloud/mysql/runtime.mjs",
    "scripts/portal-migrate.ts",
    "scripts/crm-channel-map.ts",
  ]);
const catalog = {};
for (const name of sources) {
  const source = ts.createSourceFile(
    name,
    fs.readFileSync(name, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const sql = node.text.trim();
      if (/^(SELECT|UPDATE|INSERT|DELETE)\s/.test(sql)) {
        validateSql(sql);
        (catalog[sql] ??= { sql, sources: [] }).sources.push(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
for (const entry of Object.values(catalog))
  entry.sources = [...new Set(entry.sources)];
const output =
  JSON.stringify(
    Object.fromEntries(
      Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)),
    ),
    null,
    2,
  ) + "\n";
const path = "cloud/mysql/query-catalog.json";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(path, "utf8") !== output)
    throw Error("Native SQL inventory stale");
} else fs.writeFileSync(path, output);
console.log({ nativeStatements: Object.keys(catalog).length });
