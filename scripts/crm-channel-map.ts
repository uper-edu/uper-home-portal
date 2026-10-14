export async function mapCrmChannels(db: any, apply = false) {
  const channel = (
    await db.query(
      "SELECT id FROM notification_channels WHERE id='CRM_Leads_Update'",
    )
  ).rows[0];
  if (!channel) throw Error("CRM Bot channel required");
  const rules = (
    await db.query(
      "SELECT * FROM notification_rules WHERE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(config,'$.group')),'null') IN ('sales','ops') AND JSON_CONTAINS(JSON_EXTRACT(config,'$.channels'),JSON_QUOTE('lark')) ORDER BY id FOR UPDATE",
    )
  ).rows;
  if (apply)
    for (const r of rules) {
      const config = { ...r.config, group: channel.id };
      const version = r.version + 1;
      await db.query(
        "UPDATE notification_rules SET config=:p2,version=:p3,effective_at=UTC_TIMESTAMP(6) WHERE id=:p1",
        [r.id, config, version],
      );
      await db.query("INSERT INTO rule_versions VALUES(:p1,:p2,:p3)", [
        r.id,
        version,
        config,
      ]);
      await db.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES('migration','channel.mapping',:p1)",
        [{ ruleId: r.id, from: r.config.group, to: channel.id, version }],
      );
    }
  return rules.map((r: any) => ({
    id: r.id,
    from: r.config.group,
    to: channel.id,
    version: r.version + 1,
    applied: apply,
  }));
}
if (process.argv[1]?.endsWith("crm-channel-map.ts")) {
  const { connection, pool } = await import("../server/portal/store.ts");
  const lease = await connection(),
    db = lease.client;
  try {
    await db.query("BEGIN");
    console.log(
      JSON.stringify(
        await mapCrmChannels(db, process.argv.includes("--apply")),
      ),
    );
    await db.query(process.argv.includes("--apply") ? "COMMIT" : "ROLLBACK");
  } finally {
    await lease.release();
    await pool.end();
  }
}
