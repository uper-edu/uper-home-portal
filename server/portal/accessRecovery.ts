import crypto from "node:crypto";
import { pool, tx } from "./store.ts";
import { platform } from "./identity.ts";
import { accessDirectory } from "./accessHandovers.ts";
import { validMutationOrigin } from "./accessTransport.ts";
import {
  recoveryMac,
  recoveryTarget,
  sealRecoveryAuthorization,
} from "./recoveryAuthorization.ts";
import {
  fullAdministrator,
  restoreState,
  saveRestoreState,
} from "./accessRecoveryState.ts";
const fail = (status: number, message: string): never => {
  throw Object.assign(Error(message), { status });
};
export const authorizationStamp = (u: any) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify([u.id, u.active, u.roles, u.grants]))
    .digest("hex");
export function mountAccessRecovery(app: any) {
  const wrap = (fn: any) => (q: any, r: any) =>
    Promise.resolve(fn(q, r)).catch((e: any) =>
      r
        .status(e.status || 503)
        .json({ error: e.status ? e.message : "access_unavailable" }),
    );
  app.get(
    "/api/admin/access/recovery",
    wrap(async (q: any, r: any) => {
      const actor = await platform.authenticate(q);
      if (!fullAdministrator(actor))
        fail(actor ? 403 : 401, "Permission denied");
      const directory = await accessDirectory(pool);
      r.setHeader("Cache-Control", "no-store");
      r.json({
        target: recoveryTarget(process.env),
        administrators: directory
          .filter(fullAdministrator)
          .map((u: any) => ({ id: u.id, name: u.displayName })),
        users: directory.map((u: any) => ({
          id: u.id,
          name: u.displayName,
          active: u.active,
          administrator: fullAdministrator(u),
        })),
      });
    }),
  );
  app.post(
    "/api/admin/access/recovery/authorize",
    wrap(async (q: any, r: any) => {
      if (!validMutationOrigin(q)) fail(403, "access_origin_rejected");
      const b = q.body;
      if (
        !/^[a-f0-9-]{36}$/.test(b.operationId || "") ||
        typeof b.reason !== "string" ||
        !b.reason.trim() ||
        b.reason.length > 500 ||
        typeof b.enableAccount !== "boolean" ||
        typeof b.restoreSystemAccess !== "boolean" ||
        (b.backupSha256 && !/^[a-f0-9]{64}$/.test(b.backupSha256)) ||
        (b.targetDatabase &&
          !/^(uper_trial_[a-z0-9_]+|uper_local_crm)$/.test(b.targetDatabase))
      )
        fail(400, "access_recovery_authorization_invalid");
      const actor = await platform.authenticate(q);
      if (!fullAdministrator(actor))
        fail(actor ? 403 : 401, "Permission denied");
      const payload = await tx(async (c: any) => {
        await c.query(
          "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
        );
        if (!fullAdministrator(await platform.authenticate(q)))
          fail(403, "Permission denied");
        const fingerprint = recoveryMac(process.env, b);
        const existing = (
          await c.query(
            "SELECT * FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2",
            [actor.id, b.operationId],
          )
        ).rows[0];
        if (existing) {
          if (
            existing.action !== "recovery.authorize" ||
            existing.fingerprint !== fingerprint
          )
            fail(409, "access_operation_conflict");
          return existing.result.body.authorizationPayload;
        }
        const user = (
          await c.query("SELECT * FROM crm_users WHERE id=:p1 FOR UPDATE", [
            b.userId,
          ])
        ).rows[0];
        if (!user) fail(404, "access_user_missing");
        const target = recoveryTarget(process.env, b.targetDatabase);
        if (
          target.database !== recoveryTarget(process.env).database &&
          !b.backupSha256
        )
          fail(400, "access_recovery_backup_required");
        const p = {
          purpose: "administrator-recovery-v1",
          approvalMode: "authenticated-administrator",
          id: b.operationId,
          target,
          userId: user.id,
          loginId: user.login_id,
          enableAccount: b.enableAccount,
          restoreSystemAccess: b.restoreSystemAccess,
          approvedBy: actor.id,
          reason: b.reason.trim(),
          backupSha256: b.backupSha256 || null,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
        await c.query(
          "INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES(:p1,:p2,:p3,:p4,:p5)",
          [
            actor.id,
            b.operationId,
            "recovery.authorize",
            fingerprint,
            JSON.stringify({ status: 200, body: { authorizationPayload: p } }),
          ],
        );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.recovery.authorize',:p2)",
          [
            actor.id,
            {
              authorizationId: p.id,
              userId: p.userId,
              target: p.target,
              enableAccount: p.enableAccount,
              restoreSystemAccess: p.restoreSystemAccess,
              reason: p.reason,
              expiresAt: p.expiresAt,
            },
          ],
        );
        return p;
      });
      r.setHeader("Cache-Control", "no-store");
      r.json({
        authorization: sealRecoveryAuthorization(process.env, payload),
        operationId: b.operationId,
      });
    }),
  );
  app.get(
    "/api/admin/access/restore",
    wrap(async (q: any, r: any) => {
      const e = await platform.authenticate(q);
      if (!e) fail(401, "Login required");
      if (!fullAdministrator(e)) fail(403, "Permission denied");
      const state = await restoreState(),
        directory = await accessDirectory(pool);
      r.setHeader("Cache-Control", "no-store");
      r.json({
        required: !!state?.required,
        restoreId: state?.restoreId,
        users: directory.map((u: any) => ({
          id: u.id,
          name: u.displayName,
          active: u.active,
          roles: u.roles,
          roleLabels: u.roleLabels,
          authorizationStamp: authorizationStamp(u),
          reset: state?.reset?.includes(u.id) || false,
          reviewed:
            state?.reviewed?.some(
              (v: any) => v.id === u.id && v.stamp === authorizationStamp(u),
            ) || false,
        })),
        administratorCount: directory.filter(fullAdministrator).length,
        historicalNotificationHolds: (
          await pool.query(
            "SELECT kind,COUNT(*) AS count FROM notification_migration_holds GROUP BY kind",
          )
        ).rows,
      });
    }),
  );
  for (const action of ["review", "release"])
    app.post(
      "/api/admin/access/restore/" + action,
      wrap(async (q: any, r: any) => {
        const result = await tx(async (c: any) => {
          const e = await platform.authenticate(q);
          if (!e) fail(401, "Login required");
          if (!fullAdministrator(e)) fail(403, "Permission denied");
          if (
            typeof q.body.reason !== "string" ||
            !q.body.reason.trim() ||
            q.body.reason.length > 500
          )
            fail(400, "access_reason_required");
          const state = await restoreState(c);
          if (!state?.required || state.restoreId !== q.body.restoreId)
            fail(409, "access_conflict");
          const directory = await accessDirectory(c);
          if (action === "review") {
            if (q.body.confirmAuthorization !== true)
              fail(400, "access_restore_confirm");
            const user = directory.find((u: any) => u.id === q.body.userId);
            if (!user) fail(404, "access_user_missing");
            if (q.body.authorizationStamp !== authorizationStamp(user))
              fail(409, "access_restore_stale");
            if (user.active && !state.reset?.includes(user.id))
              fail(409, "access_restore_password");
            state.reviewed = [
              ...(state.reviewed || []).filter((x: any) => x.id !== user.id),
              {
                id: user.id,
                stamp: authorizationStamp(user),
                actor: e.id,
                reason: q.body.reason,
              },
            ];
          } else {
            if (
              directory.some(
                (u: any) =>
                  !state.reviewed?.some(
                    (x: any) =>
                      x.id === u.id && x.stamp === authorizationStamp(u),
                  ),
              )
            )
              fail(409, "access_restore_remaining");
            if (directory.filter(fullAdministrator).length < 2)
              fail(409, "access_restore_two_administrators");
            state.required = false;
            state.releasedBy = e.id;
            state.releasedAt = new Date().toISOString();
            await c.query("DELETE FROM crm_sessions");
          }
          await saveRestoreState(c, state);
          await c.query(
            "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
            [
              e.id,
              "access.restore." + action,
              JSON.stringify({
                restoreId: state.restoreId,
                userId: q.body.userId,
                reason: q.body.reason,
              }),
            ],
          );
          return { reviewed: state.reviewed.length, released: !state.required };
        });
        r.json(result);
      }),
    );
}
