import fs from "node:fs/promises";
import { pool, tx, initialize } from "../server/portal/store.ts";
import { inspectMigration, fingerprint } from "../server/portal/migration.ts";
import { defaults, validate } from "../server/portal/policy.ts";
const file = process.argv[2];
if (!file)
  throw Error(
    "Usage: DATABASE_URL=... node --import tsx scripts/portal-migrate.ts <leads.json> [--apply] [--policy config.json]",
  );
const { leads, report } = inspectMigration(await fs.readFile(file, "utf8"));
const apply = process.argv.includes("--apply");
const result = {
  ...report,
  mode: apply ? "apply" : "dry-run",
  importedLeads: 0,
  skippedLeads: 0,
};
const policyIndex = process.argv.indexOf("--policy");
let policy: any;
if (policyIndex >= 0) {
  const config = JSON.parse(
    await fs.readFile(process.argv[policyIndex + 1], "utf8"),
  );
  const duration = (r: any, base: number) =>
    r === undefined
      ? base
      : typeof r === "number"
        ? r
        : r.value *
          (r.unit === "minutes" ? 1 / 60 : r.unit === "days" ? 24 : 1);
  const value = {
    ...defaults,
    timezone: config.businessHours?.timezone || defaults.timezone,
    start: config.businessHours?.startTime || defaults.start,
    end: config.businessHours?.endTime || defaults.end,
    days: config.businessHours?.workDays || defaults.days,
    hotHours: duration(config.firstResponseSla?.hot, 3),
    warmHours: duration(config.firstResponseSla?.warm, 24),
    coldHours: duration(config.firstResponseSla?.cold, 48),
  };
  validate(value);
  for (const n of [value.hotHours, value.warmHours, value.coldHours])
    if (!Number.isFinite(n) || n <= 0)
      throw Error("Invalid legacy SLA duration");
  policy = { config, value };
}
try {
  if (
    report.missingIds ||
    report.duplicateIds ||
    report.anomalies.some((a) => a.severity === "blocking")
  )
    throw Error("Migration blocked: " + JSON.stringify(result));
  if (apply) {
    if (!process.env.DATABASE_URL)
      throw Error("DATABASE_URL required for apply");
    await initialize();
    await tx(async (c) => {
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtext('portal-migration'))",
      );
      // Verify all IDs before inserting anything. Never append history to an unrelated existing lead.
      for (const lead of leads) {
        const old = (
          await c.query(
            "SELECT l.profile,c.attribution FROM portal_leads l LEFT JOIN conversations c ON c.id=$2 WHERE l.id=$1",
            [lead.id, "legacy-" + lead.id],
          )
        ).rows[0];
        if (old) {
          if (old.attribution?.legacyImportHash !== fingerprint(lead))
            throw Error(
              "Existing lead conflicts with legacy source: " + lead.id,
            );
          result.skippedLeads++;
        }
      }
      if (policy)
        await c.query(
          "INSERT INTO portal_settings(id,value) VALUES('sla',$1),('crm_policy',$2) ON CONFLICT DO NOTHING",
          [policy.value, policy.config],
        );
      for (const lead of leads) {
        const inserted = await c.query(
          "INSERT INTO portal_leads(id,profile) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
          [lead.id, lead],
        );
        if (!inserted.rowCount) continue;
        result.importedLeads++;
        const visitor = "legacy-" + lead.id,
          conversation = visitor;
        await c.query(
          "INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES($1,$2,'1970-01-01')",
          [visitor, lead.id],
        );
        await c.query(
          "INSERT INTO conversations(id,visitor_id,lead_id,source,attribution) VALUES($1,$2,$3,'legacy_unknown',$4)",
          [
            conversation,
            visitor,
            lead.id,
            {
              legacyImportHash: fingerprint(lead),
              sourceFileHash: report.sha256,
            },
          ],
        );
        for (const [i, m] of (lead.chatTranscript || []).entries()) {
          const known =
            !!m.timestamp && Number.isFinite(Date.parse(m.timestamp));
          await c.query(
            "INSERT INTO messages(id,conversation_id,request_id,role,content,status,error,created_at) VALUES($1,$2,$3,$4,$5,'legacy',$6,$7)",
            [
              `${conversation}-${i}`,
              conversation,
              String(i),
              m.role,
              m.content ?? m.text ?? "",
              JSON.stringify({
                originalId: m.id,
                originalTimestamp: m.timestamp,
                index: i,
                timestampKnown: known,
                ...(!known ? { placeholder: "1970-01-01T00:00:00Z" } : {}),
              }),
              known ? m.timestamp : "1970-01-01T00:00:00Z",
            ],
          );
        }
        if (lead.slaDueTime)
          await c.query(
            "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,status) VALUES($1,$2,'legacy',$3,$4,'migration_hold')",
            ["legacy-" + lead.id, lead.id, lead.owner, lead.slaDueTime],
          );
      }
    });
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
