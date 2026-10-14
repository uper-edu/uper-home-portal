import { retireTeamGrants } from "../../src/utils/accessControl.ts";
import { tx } from "./store.ts";

/** Preserve historical team values as inert evidence; never widen legacy record grants. */
export async function initializeTeamlessAccess() {
  await tx(async (c) => {
    await c.query(
      "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
    );
    if (
      (await c.query("SELECT value FROM access_state WHERE id='teamless'")).rows
        .length
    )
      return;
    const roles = (await c.query("SELECT * FROM access_roles")).rows;
    for (const role of roles) {
      const config = retireTeamGrants(role.config);
      const changed = JSON.stringify(config) !== JSON.stringify(role.config);
      if (!changed) continue;
      await c.query(
        "UPDATE access_roles SET config=:p2,revision=revision+1 WHERE id=:p1",
        [role.id, config],
      );
      for (const user of (await c.query("SELECT * FROM crm_users")).rows)
        if (user.roles.includes(role.id))
          await c.query("DELETE FROM crm_sessions WHERE user_id=:p1", [
            user.id,
          ]);
      await c.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES('system','access.teamless.role',:p1)",
        [{ id: role.id, before: role.config, after: config }],
      );
    }
    for (const rule of (await c.query("SELECT * FROM notification_rules"))
      .rows) {
      const previous = rule.config,
        config = structuredClone(previous);
      const review =
        !!previous.teams?.length ||
        (previous.event === "daily.digest" && !!previous.team);
      config.recipient =
        previous.event.includes("failed") || previous.event === "daily.digest"
          ? "managers"
          : "owner";
      delete config.team;
      delete config.teams;
      if (review) config.requiresRoutingReview = true;
      if (JSON.stringify(config) === JSON.stringify(previous)) continue;
      // Keep the complete previous snapshot, conditions, channel and send-time configuration.
      await c.query(
        "INSERT INTO rule_versions VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE id=id",
        [rule.id, rule.version, previous],
      );
      await c.query("INSERT INTO rule_versions VALUES(:p1,:p2,:p3)", [
        rule.id,
        Number(rule.version) + 1,
        config,
      ]);
      await c.query(
        "UPDATE notification_rules SET version=:p2,config=:p3,enabled=:p4,effective_at=UTC_TIMESTAMP(6) WHERE id=:p1",
        [rule.id, Number(rule.version) + 1, config, !!rule.enabled && !review],
      );
      await c.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES('system','notification.teamless.policy',:p1)",
        [
          {
            id: rule.id,
            version: Number(rule.version) + 1,
            reviewRequired: review,
            previousEnabled: !!rule.enabled,
          },
        ],
      );
    }
    await c.query("INSERT INTO access_state(id,value) VALUES('teamless',:p1)", [
      { version: 1 },
    ]);
  });
}
