import fs from "node:fs/promises";
import crypto from "node:crypto";
import { pool, tx, initialize } from "../server/portal/store.ts";
const tables = [
  "portal_leads",
  "visitor_sessions",
  "conversations",
  "messages",
  "ai_attempts",
  "followup_tasks",
  "outbox",
  "notification_rules",
  "rule_versions",
  "notification_channels",
  "notification_jobs",
  "notification_inbox",
  "portal_audit",
  "portal_settings",
  "identity_candidates",
  "lead_read_marks",
];
const [mode, file] = process.argv.slice(2);
if (!["backup", "restore"].includes(mode) || !file)
  throw Error(
    "Usage: DATABASE_URL=... node --import tsx scripts/portal-backup.ts backup|restore /absolute/path.json",
  );
await initialize();
if (mode === "backup") {
  const data = await tx(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const rows: any = {};
    for (const table of tables)
      rows[table] = (await c.query(`SELECT * FROM ${table}`)).rows;
    return rows;
  });
  const json = JSON.stringify(data);
  const sha256 = crypto.createHash("sha256").update(json).digest("hex");
  await fs.writeFile(file, JSON.stringify({ version: 1, sha256, data }), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      sha256,
      rows: Object.fromEntries(tables.map((t) => [t, data[t].length])),
    }),
  );
} else {
  const backup = JSON.parse(await fs.readFile(file, "utf8"));
  if (
    backup.version !== 1 ||
    crypto
      .createHash("sha256")
      .update(JSON.stringify(backup.data))
      .digest("hex") !== backup.sha256
  )
    throw Error("Backup integrity check failed");
  await tx(async (c) => {
    for (const table of tables) {
      if ((await c.query(`SELECT count(*) n FROM ${table}`)).rows[0].n !== "0")
        throw Error("Restore requires empty destination");
    }
    for (const table of tables) {
      const permitted = new Set(
        (
          await c.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",
            [table],
          )
        ).rows.map((r) => r.column_name),
      );
      for (const row of backup.data[table]) {
        const cols = Object.keys(row);
        if (cols.some((col) => !permitted.has(col)))
          throw Error("Unknown backup column");
        await c.query(
          `INSERT INTO ${table} (${cols.map((k) => '"' + k + '"').join(",")}) VALUES(${cols.map((_, i) => "$" + (i + 1)).join(",")})`,
          cols.map((k) => row[k]),
        );
      }
    }
    for (const table of ["ai_attempts", "portal_audit"])
      await c.query(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),coalesce((SELECT max(id) FROM ${table}),1),EXISTS(SELECT 1 FROM ${table}))`,
      );
  });
  await pool.query("SELECT setval('message_sequence',coalesce((SELECT max(sequence) FROM messages),1),EXISTS(SELECT 1 FROM messages))");
  console.log(JSON.stringify({ restored: true, sha256: backup.sha256 }));
}
await pool.end();
