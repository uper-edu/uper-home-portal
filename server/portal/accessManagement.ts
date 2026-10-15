import { normalizeStaffEmail } from "../../src/utils/staffEmail.ts";
import crypto from "node:crypto";
import fs from "node:fs";
import { validMutationOrigin } from "./accessTransport.ts";
import {canReadTestDirectory,testDirectoryEnabled,testDirectoryOrigin,testDirectoryUsers} from './testDirectory.ts';
import type { Express, Request } from "express";
import { pool, tx } from "./store.ts";
import { platform } from "./identity.ts";
import { accountSeeds, hashPassword } from "./localAuth.ts";
import {
  builtInRoles,
  canDelegate,
  permissionCatalog,
  projectEmployee,
  validateRole,
  type RoleConfig,
} from "../../src/utils/accessControl.ts";
const error = (status: number, message: string): never => {
  throw Object.assign(Error(message), { status });
};
const safeUser = (row: any) => ({
  id: row.id,
  loginId: row.login_id,
  email: row.email || null,
  displayName: row.display_name,
  roles: row.roles,
  active: !!row.active,
  revision: Number(row.access_revision),
});
export async function roleRows(db: any = pool) {
  return (await db.query("SELECT * FROM access_roles ORDER BY id")).rows.map(
    (r: any) => ({ ...r, enabled: !!r.enabled, revision: Number(r.revision) }),
  );
}
function initialPassword(name: string) {
  if(process.env.ACCESS_ALLOW_TEST_PASSWORDS==='true'){
    if(process.env.TRIAL_DATASET!=='synthetic'||process.env.APP_ENV!=='test')throw Error('Test credentials require isolated synthetic test mode');
    return name;
  }
  const file=process.env.ACCESS_INITIAL_PASSWORDS_FILE;
  if(!file||fs.statSync(file).mode&0o077)throw Error('Private 0600 initial-password file required for first initialization');
  const password=JSON.parse(fs.readFileSync(file,'utf8'))[name];
  if(typeof password!=='string'||password.length<12||password.length>200||password.toLowerCase()===name.toLowerCase())throw Error('Strong initial credential required');
  return password;
}
export async function initializeAccessAccounts() {
  await tx(async (c) => {
    const restored=(await c.query("SELECT value FROM access_state WHERE id='restore_review'")).rows[0]?.value;
    if(restored?.required)return;
    await c.query(
      "INSERT INTO access_state(id,value) VALUES('policy',:p1) ON DUPLICATE KEY UPDATE id=id",
      [JSON.stringify({ initialized: false })],
    );
    const state = (
      await c.query(
        "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
      )
    ).rows[0].value;
    if (state.initialized) return;
    for (const [role, config] of Object.entries(builtInRoles))
      await c.query(
        "INSERT INTO access_roles(id,config) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE id=id",
        [role, JSON.stringify(config)],
      );
    for (const [name, roles] of accountSeeds)
      await c.query(
        "INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,:p2,:p3,:p4) ON DUPLICATE KEY UPDATE id=id",
        [
          name,
          await hashPassword(initialPassword(name)),
          JSON.stringify(roles),
          JSON.stringify([]),
        ],
      );
    const robert = (
      await c.query("SELECT * FROM crm_users WHERE id='Robert' FOR UPDATE")
    ).rows[0];
    if (!robert?.active) error(409, "access_bootstrap_robert_inactive");
    if (!robert.roles.includes("access_admin")) {
      await c.query(
        "UPDATE crm_users SET roles=:p1,access_revision=access_revision+1 WHERE id='Robert'",
        [JSON.stringify([...robert.roles, "access_admin"])],
      );
      await c.query("DELETE FROM crm_sessions WHERE user_id=:p1",[robert.id]);
    }
    await c.query("UPDATE access_state SET value=:p1 WHERE id='policy'", [
      JSON.stringify({ initialized: true, bootstrap: "Robert" }),
    ]);
    await c.query(
      "INSERT INTO portal_audit(actor,action,data) VALUES('system','access.bootstrap',:p1)",
      [
        JSON.stringify({
          administrator: "Robert",
          businessPermissionsPreserved: true,
        }),
      ],
    );
  });
}
async function ensureAdministrator(c: any) {
  const roles = await roleRows(c),
    users = (await c.query("SELECT * FROM crm_users WHERE active=true")).rows;
  if (
    !users.some((u: any) => {
      const e = projectEmployee(u, roles);
      return [
        "access.read",
        "access.users",
        "access.roles",
        "access.sessions",
        "access.audit",
      ].every((p) => e.permissions.includes(p));
    })
  )
    error(409, "access_last_administrator");
}
async function guard(req: Request, permission: string, mutation = false) {
  const e = await platform.authenticate(req);
  if (!e) error(401, "Login required");
  if (!e.permissions.includes(permission)) error(403, "Permission denied");
  if (
    mutation &&
    !validMutationOrigin(req)
  )
    error(403, "access_origin_rejected");
  return e;
}
function delegation(e: any, roleConfigs: RoleConfig[]) {
  for (const config of roleConfigs)
    if (!canDelegate(e, config.grants)) error(403, "access_delegation_denied");
}
async function lockedActor(c: any, q: Request, permission: string) {
  await c.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");
  return guard(q, permission, true);
}
const reason = (b: any) => {
  if (typeof b.reason !== "string" || !b.reason.trim() || b.reason.length > 500)
    error(400, "access_reason_required");
  return b.reason.trim();
};
const list = (v: any) =>
  Array.isArray(v) &&
  v.length <= 30 &&
  v.every(
    (x: any) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(x),
  ) &&
  new Set(v).size === v.length;
async function audit(c: any, actor: string, action: string, data: any) {
  await c.query(
    "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
    [actor, "access." + action, JSON.stringify(data)],
  );
}
export function mountAccessManagement(app: Express) {
  let failureOnce =
    process.env.PORTAL_FAULT_TEST === "true" &&
    process.env.TRIAL_DATASET === "synthetic" &&
    process.env.ACCESS_FAILURE_ONCE === "true";
  app.use("/api/admin/access", (q, r, next) => {
    if (failureOnce && q.method === "POST" && !q.path.endsWith("/preview")) {
      failureOnce = false;
      r.status(503).json({ error: "access_unavailable", saved: false });
      return;
    }
    next();
  });
  const wrap = (fn: any) => (q: any, r: any) =>
    Promise.resolve(fn(q, r)).catch((e: any) =>
      r
        .status(e.status || 503)
        .json({ error: e.status ? e.message : "access_unavailable" }),
    );
  app.get(
    "/api/admin/access",
    wrap(async (q: any, r: any) => {
      const employee=await guard(q, "access.read");
      r.setHeader("Cache-Control", "no-store");
      const roles = await roleRows();
      r.json({
        users: (
          await pool.query("SELECT * FROM crm_users ORDER BY display_name")
        ).rows.map((u: any) => ({
          ...safeUser(u),
          effective: projectEmployee(u, roles),
        })),
        roles,
        catalog: permissionCatalog,
        testDirectoryAvailable:testDirectoryEnabled() && canReadTestDirectory(employee),
      });
    }),
  );
  app.get('/api/admin/access/test-directory',wrap(async(q:any,r:any)=>{
    const employee=await guard(q,'access.read');
    if(!canReadTestDirectory(employee))error(403,'Permission denied');
    if(!testDirectoryEnabled())error(404,'Not found');
    r.setHeader('Cache-Control','no-store, private');
    r.setHeader('Pragma','no-cache');
    const rows=(await pool.query('SELECT * FROM crm_users ORDER BY id')).rows;
    r.json({origin:testDirectoryOrigin,generatedAt:new Date().toISOString(),
      users:await testDirectoryUsers(rows,await roleRows(),process.env.PORTAL_TEST_DIRECTORY_INITIAL_PASSWORD)});
  }));
  app.get(
    "/api/admin/access/audit",
    wrap(async (q: any, r: any) => {
      await guard(q, "access.audit");
      r.setHeader("Cache-Control", "no-store");
      r.json(
        (
          await pool.query(
            "SELECT id,actor,action,data,created_at FROM portal_audit WHERE action LIKE 'access.%' ORDER BY id DESC LIMIT 200",
          )
        ).rows,
      );
    }),
  );
  app.post(
    "/api/admin/access/users",
    wrap(async (q: any, r: any) => {
      const e = await guard(q, "access.users", true),
        b = q.body,
        why = reason(b);
      let email: string | null;
      try {
        email = normalizeStaffEmail(b.email);
      } catch (e) {
        error(400, (e as Error).message);
      }
      if (
        !/^[a-zA-Z0-9_.-]{1,64}$/.test(b.loginId) ||
        typeof b.displayName !== "string" ||
        !b.displayName.trim() ||
        b.displayName.length > 191 ||
        !list(b.roles) ||
        typeof b.temporaryPassword !== "string" ||
        b.temporaryPassword.length < 8 ||
        b.temporaryPassword.length > 200 ||
        (b.active !== undefined && typeof b.active !== "boolean")
      )
        error(400, "access_invalid_user");
      const user = await tx(async (c) => {
        await c.query(
          "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
        );
        const actor = await guard(q, "access.users", true);
        const roles = await roleRows(c);
        if (
          b.roles.some(
            (id: string) =>
              !roles.some((role: any) => role.id === id && role.enabled),
          )
        )
          error(400, "access_invalid_role");
        if (
          (
            await c.query(
              "SELECT id FROM crm_users WHERE lower(login_id)=lower(:p1)",
              [b.loginId],
            )
          ).rows.length
        )
          error(409, "access_login_exists");
        delegation(
          actor,
          roles
            .filter((role: any) => b.roles.includes(role.id))
            .map((role: any) => role.config),
        );
        if (
          email &&
          (
            await c.query("SELECT id FROM crm_users WHERE email_key=:p1", [
              email,
            ])
          ).rows.length
        )
          error(409, "access_email_exists");
        const id = crypto.randomUUID();
        await c.query(
          "INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams,active,email) VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8)",
          [
            id,
            b.loginId,
            b.displayName.trim(),
            await hashPassword(b.temporaryPassword),
            JSON.stringify(b.roles),
            JSON.stringify([]),
            b.active !== false,
            email,
          ],
        );
        await audit(c, e.id, "user.create", {
          id,
          loginId: b.loginId,
          email,
          active: b.active !== false,
          roles: b.roles,
          reason: why,
        });
        return safeUser(
          (await c.query("SELECT * FROM crm_users WHERE id=:p1", [id])).rows[0],
        );
      });
      r.json({ user });
    }),
  );
  app.post(
    "/api/admin/access/users/:id",
    wrap(async (q: any, r: any) => {
      const e = await guard(q, "access.users", true),
        b = q.body,
        why = reason(b);
      if (
        typeof b.active !== "boolean" ||
        typeof b.displayName !== "string" ||
        !b.displayName.trim() ||
        b.displayName.length > 191 ||
        !list(b.roles)
      )
        error(400, "access_invalid_user");
      const result = await tx(async (c) => {
        await c.query(
          "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
        );
        const actor = await guard(q, "access.users", true);
        const old = (
          await c.query("SELECT * FROM crm_users WHERE id=:p1 FOR UPDATE", [
            q.params.id,
          ])
        ).rows[0];
        if (!old) error(404, "access_user_missing");
        let email: string | null;
        try {
          email =
            b.email === undefined ? old.email : normalizeStaffEmail(b.email);
        } catch (e) {
          error(400, (e as Error).message);
        }
        if (
          email &&
          (
            await c.query(
              "SELECT id FROM crm_users WHERE email_key=:p1 AND id<>:p2",
              [email, old.id],
            )
          ).rows.length
        )
          error(409, "access_email_exists");
        if (Number(old.access_revision) !== b.revision)
          error(409, "access_conflict");
        const roles = await roleRows(c);
        if (
          b.roles.some(
            (id: string) =>
              !roles.some(
                (role: any) =>
                  role.id === id && (role.enabled || old.roles.includes(id)),
              ),
          )
        )
          error(400, "access_invalid_role");
        delegation(
          actor,
          roles
            .filter(
              (role: any) =>
                role.enabled &&
                (old.roles.includes(role.id) || b.roles.includes(role.id)),
            )
            .map((role: any) => role.config),
        );
        await c.query(
          "UPDATE crm_users SET display_name=:p2,roles=:p3,teams=:p4,active=:p5,email=:p6,access_revision=access_revision+1 WHERE id=:p1",
          [
            old.id,
            b.displayName.trim(),
            JSON.stringify(b.roles),
            JSON.stringify(old.teams),
            b.active,
            email,
          ],
        );
        await ensureAdministrator(c);
        await c.query("DELETE FROM crm_sessions WHERE user_id=:p1", [old.id]);
        const next = {
          ...old,
          display_name: b.displayName.trim(),
          roles: b.roles,
          teams: old.teams,
          active: b.active,
          email,
          access_revision: Number(old.access_revision) + 1,
        };
        await audit(c, e.id, "user.update", {
          before: safeUser(old),
          after: safeUser(next),
          reason: why,
        });
        return {
          user: safeUser(next),
          sessionsRevoked: true,
          ownershipUnchanged: true,
        };
      });
      r.json(result);
    }),
  );
  app.post(
    "/api/admin/access/roles/preview",
    wrap(async (q: any, r: any) => {
      await guard(q, "access.roles", true);
      try {
        validateRole(q.body.config);
      } catch (e) {
        error(400, (e as Error).message);
      }
      const roles = await roleRows(),
        replacement = {
          id: q.body.id,
          config: q.body.config,
          enabled: q.body.enabled === true,
        };
      r.json({
        affected: (await pool.query("SELECT * FROM crm_users")).rows
          .filter((u: any) => u.roles.includes(q.body.id))
          .map((u: any) => ({
            user: safeUser(u),
            before: projectEmployee(u, roles),
            after: projectEmployee(u, [
              ...roles.filter((r: any) => r.id !== q.body.id),
              replacement,
            ]),
          })),
      });
    }),
  );
  app.post(
    "/api/admin/access/roles/:id",
    wrap(async (q: any, r: any) => {
      const e = await guard(q, "access.roles", true),
        b = q.body,
        why = reason(b);
      if (
        !/^[a-z][a-z0-9_-]{1,79}$/.test(q.params.id) ||
        typeof b.enabled !== "boolean"
      )
        error(400, "access_invalid_role");
      try {
        validateRole(b.config);
      } catch (e) {
        error(400, (e as Error).message);
      }
      const result = await tx(async (c) => {
        await c.query(
          "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
        );
        const actor = await guard(q, "access.roles", true);
        const old = (
          await c.query("SELECT * FROM access_roles WHERE id=:p1 FOR UPDATE", [
            q.params.id,
          ])
        ).rows[0];
        if ((old ? Number(old.revision) : 0) !== b.revision)
          error(409, "access_conflict");
        delegation(actor, [...(old ? [old.config] : []), b.config]);
        const members = (await c.query("SELECT * FROM crm_users")).rows.filter(
          (u: any) => u.roles.includes(q.params.id),
        );
        if (old)
          await c.query(
            "UPDATE access_roles SET config=:p2,enabled=:p3,revision=revision+1 WHERE id=:p1",
            [q.params.id, JSON.stringify(b.config), b.enabled],
          );
        else
          await c.query(
            "INSERT INTO access_roles(id,config,enabled) VALUES(:p1,:p2,:p3)",
            [q.params.id, JSON.stringify(b.config), b.enabled],
          );
        await ensureAdministrator(c);
        for (const member of members)
          await c.query("DELETE FROM crm_sessions WHERE user_id=:p1", [
            member.id,
          ]);
        await audit(c, e.id, "role.update", {
          id: q.params.id,
          before: old
            ? {
                config: old.config,
                enabled: !!old.enabled,
                revision: Number(old.revision),
              }
            : null,
          after: { config: b.config, enabled: b.enabled },
          reason: why,
          affectedUsers: members.map((u: any) => u.id),
        });
        return {
          revision: b.revision + 1,
          affectedUsers: members.length,
          sessionsRevoked: true,
        };
      });
      r.json(result);
    }),
  );
  app.post(
    "/api/admin/access/users/:id/sessions",
    wrap(async (q: any, r: any) => {
      const e = await guard(q, "access.sessions", true),
        why = reason(q.body);
      await tx(async (c) => {
        const actor = await lockedActor(c, q, "access.sessions");
        const user = (
          await c.query("SELECT * FROM crm_users WHERE id=:p1", [q.params.id])
        ).rows[0];
        if (!user) error(404, "access_user_missing");
        const roles = await roleRows(c);
        delegation(
          actor,
          roles
            .filter((role: any) => role.enabled && user.roles.includes(role.id))
            .map((role: any) => role.config),
        );
        await c.query("DELETE FROM crm_sessions WHERE user_id=:p1", [user.id]);
        await audit(c, e.id, "sessions.revoke", { id: user.id, reason: why });
      });
      r.json({ sessionsRevoked: true });
    }),
  );
  app.post(
    "/api/admin/access/users/:id/password",
    wrap(async (q: any, r: any) => {
      const e = await guard(q, "access.sessions", true),
        b = q.body,
        why = reason(b);
      if (
        typeof b.temporaryPassword !== "string" ||
        b.temporaryPassword.length < 8 ||
        b.temporaryPassword.length > 200
      )
        error(400, "access_invalid_password");
      await tx(async (c) => {
        const actor = await lockedActor(c, q, "access.sessions");
        const user = (
          await c.query("SELECT * FROM crm_users WHERE id=:p1 FOR UPDATE", [
            q.params.id,
          ])
        ).rows[0];
        if (!user) error(404, "access_user_missing");
        const roles = await roleRows(c);
        delegation(
          actor,
          roles
            .filter((role: any) => role.enabled && user.roles.includes(role.id))
            .map((role: any) => role.config),
        );
        if (Number(user.access_revision) !== b.revision)
          error(409, "access_conflict");
        await c.query(
          "UPDATE crm_users SET password_hash=:p2,access_revision=access_revision+1 WHERE id=:p1",
          [user.id, await hashPassword(b.temporaryPassword)],
        );
        await c.query("DELETE FROM crm_sessions WHERE user_id=:p1", [user.id]);
        await audit(c, e.id, "password.reset", { id: user.id, reason: why });
      });
      r.json({ sessionsRevoked: true });
    }),
  );
  app.get(
    "/api/admin/access/users/:id/impact",
    wrap(async (q: any, r: any) => {
      await guard(q, "access.read");
      r.json({
        customerCount: (await pool.exportLeads([])).rows.filter(
          (r: any) => r.profile.owner === q.params.id,
        ).length,
        taskCount: (
          await pool.query(
            "SELECT id,kind,status,due_at FROM followup_tasks WHERE owner_id=:p1 AND status IN ('open','overdue','migration_hold')",
            [q.params.id],
          )
        ).rows.length,
      });
    }),
  );
}
