import fs from "node:fs";
import { createRequire } from "node:module";
import { validateSql } from "../cloud/mysql/sql.mjs";
import {classFirstLessonLocal,classOpeningMidnight} from '../server/portal/enrollmentClassTimeSql.ts';
const require = createRequire(import.meta.url);
const ts = require("typescript");
const sources = fs
  .readdirSync("server/portal")
  .filter((n) => n.endsWith(".ts"))
  .map((n) => "server/portal/" + n)
  .concat([
    "server/mysqlApplication.ts",
    "server/siteMetadata.ts",
    "cloud/mysql/campaign-context.mjs",
    "cloud/mysql/site.mjs",
    "cloud/mysql/cms-media-upload.mjs",
    "cloud/mysql/cms-seed.mjs",
    "cloud/mysql/runtime.mjs",
    "cloud/mysql/startup-database.mjs",
    "scripts/portal-migrate.ts",
    "scripts/crm-channel-map.ts",
  ]);
const catalog = {};
const classTimeSql = {classFirstLessonLocal,classOpeningMidnight};
function staticSql(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return;
  let sql = node.head.text;
  for (const {expression, literal} of node.templateSpans) {
    if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) return;
    const name = expression.expression.text;
    if (!Object.hasOwn(classTimeSql,name) || expression.arguments.length > 1) return;
    const [alias] = expression.arguments;
    if (alias && (!ts.isStringLiteral(alias) || !/^\w+\.$/.test(alias.text))) return;
    sql += classTimeSql[name](alias?.text) + literal.text;
  }
  return sql;
}
for (const name of sources) {
  const source = ts.createSourceFile(
    name,
    fs.readFileSync(name, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const visit = (node) => {
    const sql = staticSql(node)?.trim();
    if (sql && /^(SELECT|UPDATE|INSERT|DELETE)\s/.test(sql)) {
      validateSql(sql);
      (catalog[sql] ??= { sql, sources: [] }).sources.push(name);
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
