import crypto from "node:crypto";
import { tx, pool } from "./store.ts";
import { operationContext } from "./operationContext.ts";
import { platform } from "./identity.ts";
import { recoveryReceiptState } from "./recoveryAuthorization.ts";
import { validMutationOrigin } from "./accessTransport.ts";
import { accessDirectory, reconcileHandovers } from "./accessHandovers.ts";
import {
  fullAdministrator,
  restoreState,
  saveRestoreState,
} from "./accessRecoveryState.ts";
const fail = (status: number, message: string): never => {
  throw Object.assign(Error(message), { status });
};
const canonical = (v: any): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
function actionFor(path: string) {
  if (path === "/api/crm/auth/password")
    return { action: "password.self", permission: null };
  if (/^\/api\/crm\/access-handovers\/[^/]+$/.test(path))
    return { action: "handover.update", permission: "crm.assign" };
  if (!path.startsWith("/api/admin/access/") || path.endsWith("/preview"))
    return null;
  const suffix = path.slice("/api/admin/access/".length);
  if (suffix === "users")
    return { action: "user.create", permission: "access.users" };
  if (/^users\/[^/]+\/password$/.test(suffix))
    return { action: "password.reset", permission: "access.sessions" };
  if (/^users\/[^/]+\/sessions$/.test(suffix))
    return { action: "sessions.revoke", permission: "access.sessions" };
  if (/^users\/[^/]+$/.test(suffix))
    return { action: "user.update", permission: "access.users" };
  if (/^roles\/[^/]+$/.test(suffix))
    return { action: "role.update", permission: "access.roles" };
  if (/^restore\/(review|release)$/.test(suffix))
    return { action: suffix.replace("/", "."), permission: "access.roles" };
  return null;
}
export function mountAccessOperations(app: any) {
  let failBeforeOnce =
    process.env.TRIAL_DATASET === "synthetic" &&
    process.env.PORTAL_FAULT_TEST === "true" &&
    process.env.ACCESS_FAULT_BEFORE_COMMIT_ONCE === "true";
  let dropOnce =
    process.env.TRIAL_DATASET === "synthetic" &&
    process.env.PORTAL_FAULT_TEST === "true" &&
    (process.env.ACCESS_FAULT_AFTER_COMMIT_ONCE === "true" ||
      process.env.ACCESS_FAULT_AFTER_COMMIT_HTTP_ONCE === "true");
  app.get("/api/crm/auth/operations/:operationId", async (q: any, r: any) => {
    try {
      const actor = await platform.authenticate(q);
      if (!actor) fail(401, "Login required");
      const target =
        typeof q.query.actor === "string" ? q.query.actor : actor.id;
      if (target !== actor.id && !fullAdministrator(actor))
        fail(403, "Permission denied");
      const row = (
        await pool.query(
          "SELECT * FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2",
          [target, q.params.operationId],
        )
      ).rows[0];
      r.setHeader("Cache-Control", "no-store");
      if (!row) return r.json({ state: "unconfirmed" });
      const required = actionFor(row.action)?.permission;
      if (
        required &&
        !actor.permissions.includes(required) &&
        !fullAdministrator(actor)
      )
        fail(403, "Permission denied");
      r.json({
        state:
          row.actor_id === "offline-recovery"
            ? recoveryReceiptState(
                row.result,
                process.env,
                (await restoreState())?.restoreId || null,
              )
            : row.result.cancelled
              ? "cancelled"
              : "committed",
        operationId: row.operation_id,
        result: row.result,
      });
    } catch (e: any) {
      r.status(e.status || 503).json({
        error: e.status ? e.message : "access_outcome_unknown",
      });
    }
  });
  // Serialize closing an unresolved operation with the original write. If the
  // original already committed, return that fact; otherwise a tombstone prevents
  // a delayed request from committing after the operator starts a new draft.
  app.post(
    "/api/crm/auth/operations/:operationId/close",
    async (q: any, r: any) => {
      try {
        if (!validMutationOrigin(q)) fail(403, "access_origin_rejected");
        const actor = await platform.authenticate(q);
        if (!actor) fail(401, "Login required");
        const operationId = q.params.operationId,
          originalPath = q.body.url,
          action = typeof originalPath === "string" && actionFor(originalPath);
        if (!/^[a-zA-Z0-9_-]{16,100}$/.test(operationId) || !action)
          fail(400, "access_operation_required");
        if (
          typeof q.body.reason !== "string" ||
          !q.body.reason.trim() ||
          q.body.reason.length > 500
        )
          fail(400, "access_reason_required");
        const outcome = await tx(async (c: any) =>
          operationContext.run(c, async () => {
            await c.query("SELECT GET_LOCK(:p1,5) AS acquired", [
              "access-operation:" + actor.id + ":" + operationId,
            ]);
            await c.query(
              "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
            );
            const fresh = await platform.authenticate(q);
            if (!fresh) fail(401, "Login required");
            if (
              action.permission &&
              !fresh.permissions.includes(action.permission)
            )
              fail(403, "Permission denied");
            const row = (
              await c.query(
                "SELECT * FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2",
                [actor.id, operationId],
              )
            ).rows[0];
            if (row) {
              if (row.action !== originalPath)
                fail(409, "access_operation_conflict");
              return {
                state: row.result.cancelled ? "cancelled" : "committed",
                result: row.result,
              };
            }
            const result = {
              cancelled: true,
              status: 409,
              body: { error: "access_operation_cancelled" },
            };
            await c.query(
              "INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES(:p1,:p2,:p3,:p4,:p5)",
              [
                actor.id,
                operationId,
                originalPath,
                "closed",
                JSON.stringify(result),
              ],
            );
            await c.query(
              "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.operation.closed',:p2)",
              [
                actor.id,
                JSON.stringify({
                  operationId,
                  path: originalPath,
                  reason: q.body.reason,
                }),
              ],
            );
            return { state: "cancelled", result };
          }),
        );
        r.setHeader("Cache-Control", "no-store");
        r.json({ ...outcome, operationId });
      } catch (e: any) {
        r.status(e.status || 503).json({
          error: e.status ? e.message : "access_outcome_unknown",
        });
      }
    },
  );
  app.use(async (q: any, r: any, next: any) => {
    const action = q.method === "POST" && actionFor(q.path);
    if (!action) return next();
    const originalJson = r.json,
      initialStatus = r.statusCode;
    try {
      if (!validMutationOrigin(q)) fail(403, "access_origin_rejected");
      const actor = await platform.authenticate(q);
      if (!actor) fail(401, "Login required");
      if (action.permission && !actor.permissions.includes(action.permission))
        fail(403, "Permission denied");
      if (
        typeof q.body?.operationId !== "string" ||
        !/^[a-zA-Z0-9_-]{16,100}$/.test(q.body.operationId)
      )
        fail(400, "access_operation_required");
      if ((process.env.ACCESS_OPERATION_KEY || "").length < 32)
        fail(503, "access_operation_key_missing");
      const operationId = q.body.operationId;
      const fingerprint = crypto
        .createHmac("sha256", process.env.ACCESS_OPERATION_KEY!)
        .update(canonical({ path: q.path, body: q.body }))
        .digest("hex");
      let replayed = false;
      const result = await tx(async (c: any) =>
        operationContext.run(c, async () => {
          await c.query("SELECT GET_LOCK(:p1,5) AS acquired", [
            "access-operation:" + actor.id + ":" + operationId,
          ]);
          await c.query(
            "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
          );
          const fresh = await platform.authenticate(q);
          if (!fresh) fail(401, "Login required");
          if (
            action.permission &&
            !fresh.permissions.includes(action.permission)
          )
            fail(403, "Permission denied");
          const receipt = (
            await c.query(
              "SELECT * FROM access_operations WHERE actor_id=:p1 AND operation_id=:p2",
              [actor.id, operationId],
            )
          ).rows[0];
          if (receipt) {
            if (receipt.result.cancelled)
              fail(409, "access_operation_cancelled");
            if (receipt.fingerprint !== fingerprint)
              fail(409, "access_operation_conflict");
            replayed = true;
            return receipt.result;
          }
          const before = await accessDirectory(c);
          const response = await operationContext.run(
            c,
            () =>
              new Promise<any>((resolve, reject) => {
                r.json = function (body: any) {
                  if (r.statusCode >= 400)
                    reject(
                      Object.assign(Error(body.error || "access_unavailable"), {
                        status: r.statusCode,
                      }),
                    );
                  else resolve({ status: r.statusCode, body });
                  return r;
                };
                try {
                  next();
                } catch (e) {
                  reject(e);
                }
              }),
          );
          await reconcileHandovers(c, before, {
            actor: actor.id,
            operationId,
            action: action.action,
          });
          const restore = await restoreState(c);
          if (restore?.required) {
            if (action.action === "password.reset") {
              const userId = q.path.split("/")[5];
              restore.reset = [...new Set([...(restore.reset || []), userId])];
              restore.reviewed = (restore.reviewed || []).filter(
                (x: any) => x.id !== userId,
              );
              await saveRestoreState(c, restore);
            }
          }
          if (
            process.env.TRIAL_DATASET === "synthetic" &&
            process.env.PORTAL_FAULT_TEST === "true" &&
            (q.headers["x-test-access-fault"] === "before-commit" ||
              failBeforeOnce)
          ) {
            failBeforeOnce = false;
            fail(503, "access_unavailable");
          }
          await c.query(
            "INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES(:p1,:p2,:p3,:p4,:p5)",
            [
              actor.id,
              operationId,
              q.path,
              fingerprint,
              JSON.stringify(response),
            ],
          );
          return response;
        }),
      );
      r.json = originalJson;
      r.statusCode = result.status;
      if (
        !replayed &&
        process.env.TRIAL_DATASET === "synthetic" &&
        process.env.PORTAL_FAULT_TEST === "true" &&
        (["after-commit", "after-commit-http"].includes(
          q.headers["x-test-access-fault"],
        ) ||
          dropOnce)
      ) {
        dropOnce = false;
        if (
          q.headers["x-test-access-fault"] === "after-commit-http" ||
          process.env.ACCESS_FAULT_AFTER_COMMIT_HTTP_ONCE === "true"
        )
          return originalJson.call(r.status(503), {
            error: "access_outcome_unknown",
            operationId,
          });
        return q.socket.destroy();
      }
      originalJson.call(r, { ...result.body, operationId, replayed });
    } catch (e: any) {
      r.json = originalJson;
      r.statusCode = initialStatus;
      originalJson.call(r.status(e.status || 503), {
        error: e.status ? e.message : "access_outcome_unknown",
        operationId: q.body?.operationId,
      });
    }
  });
}
