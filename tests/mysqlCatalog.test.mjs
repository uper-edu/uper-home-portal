import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
test("native MySQL catalog is synchronized with source and rejects unported SQL at build time", () => {
  execFileSync(
    process.execPath,
    ["scripts/mysql-query-catalog.mjs", "--check"],
    { stdio: "pipe" },
  );
  const catalog = JSON.parse(
    fs.readFileSync("cloud/mysql/query-catalog.json", "utf8"),
  );
  assert.ok(Object.keys(catalog).length > 100);
  for (const entry of Object.values(catalog))
    if (entry.sql)
      assert.doesNotMatch(
        entry.sql,
        /\bpg_|jsonb_agg|jsonb_build_object|AT TIME ZONE|ON CONFLICT|::jsonb/,
      );
});
