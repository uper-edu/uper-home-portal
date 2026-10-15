import crypto from "node:crypto";
import { pool, tx } from "./store.ts";
import { platform } from "./identity.ts";
import { accessDirectory } from "./accessHandovers.ts";
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
          reset: state?.reset?.includes(u.id) || false,
          reviewed:
            state?.reviewed?.some(
              (v: any) => v.id === u.id && v.stamp === authorizationStamp(u),
            ) || false,
        })),
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
            if (!directory.some(fullAdministrator))
              fail(409, "access_last_administrator");
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
