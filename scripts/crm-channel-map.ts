import pg from "pg";
export async function mapCrmChannels(db: any, apply = false) {
  const channel = (
    await db.query(
      "SELECT id FROM notification_channels WHERE id='CRM_Leads_Update'",
    )
  ).rows[0];
  if (!channel) throw Error("CRM Bot channel required");
  const rules = (
    await db.query(
      "SELECT * FROM notification_rules WHERE config->>'group' IN ('sales','ops') AND config->'channels' ? 'lark' ORDER BY id FOR UPDATE",
    )
  ).rows;
  if (apply)
    for (const r of rules) {
      const config = { ...r.config, group: channel.id };
      const version = r.version + 1;
      await db.query(
        "UPDATE notification_rules SET config=$2,version=$3,effective_at=clock_timestamp() WHERE id=$1",
        [r.id, config, version],
      );
      await db.query("INSERT INTO rule_versions VALUES($1,$2,$3)", [
        r.id,
        version,
        config,
      ]);
      await db.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES('migration','channel.mapping',$1)",
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
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("BEGIN");
    console.log(
      JSON.stringify(
        await mapCrmChannels(db, process.argv.includes("--apply")),
      ),
    );
    await db.query(process.argv.includes("--apply") ? "COMMIT" : "ROLLBACK");
  } finally {
    await db.end();
  }
}
