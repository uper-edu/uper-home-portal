import fs from "node:fs/promises";
import crypto from "node:crypto";
import pg from "pg";
import { pool, tx, initialize } from "./store.ts";
export const backupTables = [
  "portal_settings",
  "lead_daily_counters",
  "portal_leads",
  "visitor_sessions",
  "conversations",
  "messages",
  "hsk_attempts",
  "ai_attempts",
  "followup_tasks",
  "outbox",
  "notification_rules",
  "rule_versions",
  "notification_channels",
  "notification_jobs",
  "notification_inbox",
  "portal_audit",
  "identity_candidates",
  "lead_read_marks",
  "crm_users",
  "crm_sessions",
  "crm_login_limits",
] as const;
const optionalTables = ["lead_daily_counters","hsk_attempts","crm_users","crm_sessions","crm_login_limits"];
const covered = (tables:string[]) => Array.isArray(tables) && new Set(tables).size===tables.length && tables.every(t=>(backupTables as readonly string[]).includes(t)) && backupTables.filter(t=>!optionalTables.includes(t)).every(t=>tables.includes(t));
const digest = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sequenceTables = {
  ai_attempts: "id",
  portal_audit: "id",
  messages: "sequence",
};
// Keep PostgreSQL timestamp microseconds; the default Date parser drops them.
const types = {
  getTypeParser: (oid: number, format?: any) =>
    [1114, 1184].includes(oid)
      ? (value: string) => value
      : pg.types.getTypeParser(oid, format),
};
export async function backupPortal(file: string) {
  const snapshot = await tx(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const actual = (
      await c.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map((r) => r.tablename);
    if (!covered(actual))
      throw Error(
        "Portal table coverage mismatch; review schema before backup",
      );
    const data: Record<string, any[]> = {},
      columns: Record<string, string[]> = {};
    for (const table of backupTables) {
      if (!actual.includes(table)) {
        columns[table] = [];
        data[table] = [];
        continue;
      }
      columns[table] = (
        await c.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [table],
        )
      ).rows.map((r) => r.column_name);
      data[table] = (
        await c.query({
          text: `SELECT * FROM ${table} ORDER BY row_to_json(${table})::text`,
          types,
        })
      ).rows;
    }
    const sequences: Record<
      string,
      { last_value: string; is_called: boolean }
    > = {};
    for (const [table, column] of Object.entries(sequenceTables)) {
      const name =
        (
          await c.query("SELECT pg_get_serial_sequence($1,$2) name", [
            table,
            column,
          ])
        ).rows[0].name ||
        (table === "messages" ? "public.message_sequence" : null);
      if (!name || !/^public\.[a-z_]+$/.test(name))
        throw Error("Unexpected sequence");
      sequences[table] = (
        await c.query(`SELECT last_value::text,is_called FROM ${name}`)
      ).rows[0];
    }
    return {
      version: 2,
      createdAt: new Date().toISOString(),
      tables: [...backupTables],
      sourceTables: actual,
      columns,
      sequences,
      data,
    };
  });
  const sha256 = digest(snapshot),
    temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    await fs.writeFile(temporary, JSON.stringify({ ...snapshot, sha256 }), {
      mode: 0o600,
      flag: "wx",
    });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return {
    sha256,
    version: 2,
    rows: Object.fromEntries(
      backupTables.map((t) => [t, snapshot.data[t].length]),
    ),
  };
}
export async function restorePortal(file: string) {
  const snapshot = JSON.parse(await fs.readFile(file, "utf8"));
  const { sha256, ...payload } = snapshot;
  if (snapshot.version === 2) {
    if (
      digest(payload) !== sha256 ||
      !covered(snapshot.tables)
    )
      throw Error("Backup integrity or table coverage check failed");
  } else if (snapshot.version === 1) {
    if (digest(snapshot.data) !== sha256)
      throw Error("Backup integrity check failed");
    // Old snapshots predate the independent HSK table. Explicitly report that limit.
    const legacy = Object.keys(snapshot.data);
    if (
      !covered(legacy) || legacy.includes("hsk_attempts")
    )
      throw Error("Legacy backup table coverage mismatch");
    snapshot.data.hsk_attempts = [];
  } else throw Error("Unsupported backup version");
  // One local prerelease used the old date-column name. Verify the snapshot first,
  // then translate that known rename without changing numbers or counter values.
  if(snapshot.columns?.lead_daily_counters?.includes('jakarta_date')){
    snapshot.columns.lead_daily_counters=snapshot.columns.lead_daily_counters.map((c:string)=>c==='jakarta_date'?'business_date':c);
    snapshot.data.lead_daily_counters=snapshot.data.lead_daily_counters.map(({jakarta_date,...r}:any)=>({...r,business_date:jakarta_date}));
  }
  for(const table of optionalTables)if(snapshot.data[table]===undefined && (snapshot.version===1 || !snapshot.tables?.includes(table)))snapshot.data[table]=[];
  for (const table of backupTables)
    if (!Array.isArray(snapshot.data?.[table]))
      throw Error("Missing backup table");
  // Reject occupied destinations before schema initialization can change old rows.
  await tx(async (c) => {
    const existing = (
      await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")
    ).rows.map((r) => r.tablename);
    if (existing.some((t) => !(backupTables as readonly string[]).includes(t)))
      throw Error("Unexpected destination tables");
    if (existing.length)
      await c.query(
        "LOCK TABLE " +
          existing.map((t) => '"' + t + '"').join(",") +
          " IN ACCESS EXCLUSIVE MODE",
      );
    for (const table of existing)
      if (
        (await c.query(`SELECT count(*) n FROM "${table}"`)).rows[0].n !== "0"
      )
        throw Error("Restore requires empty destination");
  });
  await initialize();
  await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('portal-restore'))");
    await c.query(
      "LOCK TABLE " + backupTables.join(",") + " IN ACCESS EXCLUSIVE MODE",
    );
    for (const table of backupTables) {
      if ((await c.query(`SELECT count(*) n FROM ${table}`)).rows[0].n !== "0")
        throw Error("Restore requires empty destination");
      const columns = (
        await c.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [table],
        )
      ).rows.map((r) => r.column_name);
      if (
        snapshot.version === 2 &&
        !(
          optionalTables.includes(table) &&
          !snapshot.sourceTables?.includes(table) &&
          snapshot.data[table].length === 0
        ) &&
        JSON.stringify(columns) !== JSON.stringify(snapshot.columns?.[table]) &&
        !(['portal_leads','messages'].includes(table) &&
          JSON.stringify(columns.filter(c=>!((table==='portal_leads' && c==='business_number' || table==='messages' && c==='metadata') && !snapshot.columns?.[table]?.includes(c)))) === JSON.stringify(snapshot.columns?.[table]))
      )
        throw Error("Backup schema columns mismatch: " + table);
      const jsonColumns=new Set((await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND data_type IN ('json','jsonb')",[table])).rows.map(r=>r.column_name));
      const rows = table === 'portal_leads' && !snapshot.columns?.[table]?.includes('business_number')
        ? [...snapshot.data[table]].sort((a,b)=>{
          const stamp=(r:any)=>{const submitted=Date.parse(r.profile?.submittedAt);return Number.isFinite(submitted)?submitted:Date.parse(r.created_at);};
          return stamp(a)-stamp(b) || String(a.id).localeCompare(String(b.id));
        }) : snapshot.data[table];
      for (const row of rows) {
        if (!row || typeof row !== "object" || Array.isArray(row))
          throw Error("Invalid backup row");
        const keys = Object.keys(row);
        if (!keys.length || keys.some((k) => !columns.includes(k)))
          throw Error("Unknown backup column");
        await c.query(
          `INSERT INTO ${table} (${keys.map((k) => '"' + k + '"').join(",")}) VALUES(${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
          keys.map((k) => jsonColumns.has(k) && row[k]!==null ? JSON.stringify(row[k]) : row[k]),
        );
      }
    }
    for (const [table, column] of Object.entries(sequenceTables)) {
      const name =
        (
          await c.query("SELECT pg_get_serial_sequence($1,$2) name", [
            table,
            column,
          ])
        ).rows[0].name ||
        (table === "messages" ? "public.message_sequence" : null);
      const maximum = (
        await c.query(`SELECT max(${column})::text maximum FROM ${table}`)
      ).rows[0].maximum;
      const old = snapshot.sequences?.[table];
      const high =
        BigInt(old?.last_value || "1") > BigInt(maximum || "1")
          ? String(old.last_value)
          : maximum || "1";
      await c.query("SELECT setval($1::regclass,$2::bigint,$3)", [
        name,
        high,
        !!maximum || old?.is_called === true,
      ]);
    }
  });
  return {
    restored: true,
    sha256,
    version: snapshot.version,
    legacyHskCoverage:
      snapshot.version === 1 ? "not present in original backup" : undefined,
    businessNumberUpgrade: !snapshot.columns?.portal_leads?.includes('business_number')
      ? 'Assigned daily business numbers using Operating Timezone; original internal IDs retained' : undefined,
    rows: Object.fromEntries(
      backupTables.map((t) => [t, snapshot.data[t].length]),
    ),
  };
}
