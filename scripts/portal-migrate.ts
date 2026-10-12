import fs from "node:fs/promises";
import crypto from "node:crypto";
import { pool, tx, initialize, id } from "../server/portal/store.ts";
const file = process.argv[2];
if (!file)
  throw Error(
    "Usage: DATABASE_URL=... node --import tsx scripts/portal-migrate.ts <leads.json> [--apply]",
  );
const raw = await fs.readFile(file, "utf8"),
  leads = JSON.parse(raw);
if (!Array.isArray(leads)) throw Error("Expected lead array");
const report = {
  sha256: crypto.createHash("sha256").update(raw).digest("hex"),
  leads: leads.length,
  messages: leads.reduce((n, l) => n + (l.chatTranscript?.length || 0), 0),
  missingIds: leads.filter((l) => !l.id).length,
  duplicateIds: leads.length - new Set(leads.map((l) => l.id)).size,
  invalidDates: leads
    .flatMap((l) => l.chatTranscript || [])
    .filter((m) => !m.timestamp || !Number.isFinite(Date.parse(m.timestamp)))
    .length,
  mode: process.argv.includes("--apply") ? "apply" : "dry-run",
};
if (report.missingIds || report.duplicateIds)
  throw Error(JSON.stringify(report));
if (report.mode === "apply") {
  await initialize();
  await tx(async (c) => {
    const policyIndex = process.argv.indexOf("--policy");
    if (policyIndex >= 0) {
      const config = JSON.parse(
        await fs.readFile(process.argv[policyIndex + 1], "utf8"),
      );
      const { defaults } = await import("../server/portal/policy.ts");
      const duration = (raw: any, base: number) =>
        typeof raw === "number"
          ? raw
          : raw?.value *
              (raw?.unit === "minutes"
                ? 1 / 60
                : raw?.unit === "days"
                  ? 24
                  : 1) || base;
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
      await c.query(
        "INSERT INTO portal_settings(id,value) VALUES('sla',$1),('crm_policy',$2) ON CONFLICT DO NOTHING",
        [value, config],
      );
    }
    for (const lead of leads) {
      await c.query(
        "INSERT INTO portal_leads(id,profile) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [lead.id, lead],
      );
      const visitor = "legacy-" + lead.id,
        conversation = "legacy-" + lead.id;
      await c.query(
        "INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES($1,$2,'1970-01-01') ON CONFLICT DO NOTHING",
        [visitor, lead.id],
      );
      await c.query(
        "INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES($1,$2,$3,'legacy_unknown') ON CONFLICT DO NOTHING",
        [conversation, visitor, lead.id],
      );
      for (const [i, m] of (lead.chatTranscript || []).entries()) {
        await c.query(
          "INSERT INTO messages(id,conversation_id,request_id,role,content,status,error,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
          [
            `${conversation}-${i}`,
            conversation,
            String(i),
            m.role,
            m.content || m.text || "",
            "legacy",
            JSON.stringify({
              originalId: m.id,
              originalTimestamp: m.timestamp,
              index: i,
            }),
            m.timestamp && Number.isFinite(Date.parse(m.timestamp))
              ? m.timestamp
              : lead.submittedAt || "1970-01-01",
          ],
        );
      }
      if (lead.slaDueTime)
        await c.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,status) VALUES($1,$2,'legacy',$3,$4,'migration_hold') ON CONFLICT DO NOTHING",
          ["legacy-" + lead.id, lead.id, lead.owner, lead.slaDueTime],
        );
    }
  });
}
console.log(JSON.stringify(report, null, 2));
await pool.end();
