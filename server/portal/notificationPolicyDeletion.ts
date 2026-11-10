import { isRetiredNotificationEvent } from "./policy.ts";

type PolicyDeletionDb = { query: (sql: string, args?: any[]) => Promise<{ rows: any[] }> };

/** Runs inside the caller's transaction. The reserved ID keeps defaults from restoring the rule. */
export async function deleteNotificationPolicy(db: PolicyDeletionDb, id: string, expectedVersion: number, actor: string) {
  const { rows: [row] } = await db.query(
    "SELECT version,config FROM notification_rules WHERE id=:p1 FOR UPDATE",
    [id],
  );
  if (!row || row.config.deleted || isRetiredNotificationEvent(row.config.event)) return false;
  if (Number(row.version) !== expectedVersion)
    throw Object.assign(Error("Policy changed. Refresh before deleting."), { status: 409 });

  const version = expectedVersion + 1;
  const config = { event: row.config.event, deleted: true };
  await db.query(
    "INSERT INTO rule_versions(id,version,config) VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE id=id",
    [id, expectedVersion, row.config],
  );
  await db.query(
    "UPDATE notification_rules SET version=:p2,config=:p3,enabled=false,effective_at=UTC_TIMESTAMP(6) WHERE id=:p1",
    [id, version, config],
  );
  await db.query("INSERT INTO rule_versions(id,version,config) VALUES(:p1,:p2,:p3)", [id, version, config]);
  await db.query(
    "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
    [actor, "rule.delete", { id, version, event: config.event }],
  );
  return true;
}
