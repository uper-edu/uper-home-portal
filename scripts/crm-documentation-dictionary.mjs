// Generate static metadata only; never connect to a database or read runtime records.
import fs from "node:fs";
import ts from "typescript";
const files = [
  "src/types/crmLead.ts",
  "src/types/leadSystem.ts",
  "src/types/crmCampaign.ts",
  "src/types/crmPolicyConfig.ts",
  "server/portal/policy.ts",
  "server/portal/identity.ts",
];
const aliases = new Map();
const records = new Map();
const printer = ts.createPrinter({ removeComments: true });
const sources = files.map((file) => ({
  file,
  ast: ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  ),
}));
for (const { ast } of sources)
  for (const item of ast.statements)
    if (ts.isTypeAliasDeclaration(item))
      aliases.set(item.name.text, { node: item.type, ast });
function clean(node, ast) {
  return printer
    .printNode(ts.EmitHint.Unspecified, node, ast)
    .replace(/\s+/g, " ")
    .trim();
}
function resolved(node, ast, seen = new Set()) {
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText(ast),
      alias = aliases.get(name);
    if (alias && !seen.has(name)) {
      const next = new Set(seen);
      next.add(name);
      return resolved(alias.node, alias.ast, next);
    }
  }
  if (ts.isUnionTypeNode(node))
    return node.types.map((n) => resolved(n, ast, seen)).join(" | ");
  return clean(node, ast);
}
function put(record) {
  records.set(`${record.layer}:${record.object}:${record.key}`, record);
}
for (const { file, ast } of sources)
  for (const item of ast.statements)
    if (ts.isInterfaceDeclaration(item)) {
      function members(nodes, prefix = "") {
        for (const f of nodes)
          if (ts.isPropertySignature(f) && f.type) {
            const key = prefix + f.name.getText(ast);
            put({
              layer: "contract",
              object: item.name.text,
              key,
              type: resolved(f.type, ast),
              optional: !!f.questionToken,
              source: file,
            });
            let n = f.type;
            if (ts.isArrayTypeNode(n)) n = n.elementType;
            if (
              ts.isTypeReferenceNode(n) &&
              n.typeName.getText(ast) === "Array"
            )
              n = n.typeArguments?.[0];
            if (n && ts.isTypeLiteralNode(n)) members(n.members, key + ".");
          }
      }
      members(item.members);
    }
function sqlFields(file, sql) {
  for (const match of sql.matchAll(
    /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\) ENGINE/g,
  )) {
    // Split only top-level commas; generated columns and compound keys contain commas.
    let depth = 0,
      quote = "",
      start = 0;
    const clauses = [];
    for (let i = 0; i < match[2].length; i++) {
      const ch = match[2][i];
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === "'" || ch === '"' || ch === "`") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        clauses.push(match[2].slice(start, i));
        start = i + 1;
      }
    }
    clauses.push(match[2].slice(start));
    for (const c of clauses) {
      const m = c.trim().match(/^(`?\w+`?)\s+([A-Z]+(?:\(\d+\))?)([\s\S]*)/);
      if (m && !/^(FOREIGN|PRIMARY|UNIQUE|INDEX|CHECK)$/.test(m[1]))
        put({
          layer: "storage",
          object: match[1],
          key: m[1].replaceAll("`", ""),
          type: m[2] + (m[3].includes("UNSIGNED") ? " UNSIGNED" : ""),
          optional: !m[3].includes("NOT NULL") && !m[3].includes("PRIMARY KEY"),
          source: file,
        });
    }
  }
}
const snapshotPath = "docs/reference/crm-implementation-snapshot-20261014.json";
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
// A documentation-only checkout need not contain the separately approved MySQL runtime.
// The default is always the dated declaration snapshot, never a database or backup.
if (
  process.argv.includes("--refresh-storage") ||
  process.argv.includes("--verify-live-storage")
) {
  for (const file of [
    "cloud/mysql/schema.sql",
    "cloud/mysql/schema-v2.sql",
    "cloud/mysql/migrate.mjs",
  ])
    sqlFields(file, fs.readFileSync(file, "utf8"));
  for (const m of fs
    .readFileSync("cloud/mysql/migrate.mjs", "utf8")
    .matchAll(
      /ALTER TABLE (\w+) ADD COLUMN (\w+) ([A-Z]+(?:\(\d+\))?)([^'\"]*)/g,
    ))
    put({
      layer: "storage",
      object: m[1],
      key: m[2],
      type: m[3],
      optional: !m[4].includes("NOT NULL"),
      source: "cloud/mysql/migrate.mjs",
    });
  const storageFields = [...records.values()].filter(
    (row) => row.layer === "storage",
  );
  if (
    process.argv.includes("--verify-live-storage") &&
    JSON.stringify(storageFields) !== JSON.stringify(snapshot.storageFields)
  )
    throw Error("Live SQL declarations differ from the documentation snapshot");
  if (process.argv.includes("--refresh-storage")) {
    if (process.argv.includes("--check"))
      throw Error("Refresh and check are separate operations");
    const { createHash } = await import("node:crypto");
    snapshot.storageFields = storageFields;
    snapshot.references = snapshot.references.map((row) => ({
      path: row.path,
      sha256: createHash("sha256")
        .update(fs.readFileSync(row.path))
        .digest("hex"),
    }));
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
  }
} else {
  for (const row of snapshot.storageFields) {
    if (
      row.layer !== "storage" ||
      !row.object ||
      !row.key ||
      !snapshot.references.some((reference) => reference.path === row.source)
    )
      throw Error("Invalid static schema declaration");
    put(row);
  }
}
const output = JSON.stringify([...records.values()], null, 2) + "\n",
  file = "src/components/crm/crmDictionary.json";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(file, "utf8") !== output)
    throw Error("Dictionary is stale");
} else fs.writeFileSync(file, output);
console.log({
  fields: records.size,
  tables: new Set(
    [...records.values()]
      .filter((r) => r.layer === "storage")
      .map((r) => r.object),
  ).size,
});
