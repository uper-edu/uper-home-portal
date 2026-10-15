import { projectEmployee } from "../../src/utils/accessControl.ts";
import crypto from "node:crypto";
import { validMutationOrigin } from "./accessTransport.ts";
import { restoreState } from "./accessRecoveryState.ts";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import { pool, tx } from "./store.ts";
import type { Employee } from "./identity.ts";
const scrypt = promisify(crypto.scrypt);
const cookie = () => `uper_crm_session_${process.env.PORT || "3000"}`;
export const accountSeeds = [
  ["Suki", ["crm_leader"]],
  ["Robert", ["crm_leader", "cms_admin"]],
  ["Fadhil", ["sales"]],
  ["Zainul", ["sales"]],
  ["Wigar", ["sales"]],
  ["Tester", ["crm_leader", "sales"]],
  ["Fenny", ["cms_admin"]],
  ["Ethan", ["crm_leader", "cms_admin"]],
  ["Monite", ["crm_leader", "cms_admin"]],
] as const;
export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ":" + key.toString("hex");
}
async function matches(password: string, encoded: string) {
  const [salt, key] = encoded.split(":");
  if (!salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}
async function employee(row: any): Promise<Employee> {
  const { roleRows } = await import("./accessManagement.ts");
  return projectEmployee(row, await roleRows());
}
const token = (req: Request) =>
  (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookie() + "="))
    ?.slice(cookie().length + 1);
const digest = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
export async function localEmployee(req: Request) {
  const t = token(req);
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
  const row = (
    await pool.query(
      "SELECT u.* FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id WHERE s.token_hash=:p1 AND s.expires_at>UTC_TIMESTAMP(6) AND u.active=true",
      [digest(t)],
    )
  ).rows[0];
  if (!row) return null;
  const restore = await restoreState();
  if (restore?.required && !restore.recoveryAdmins?.includes(row.id))
    return null;
  return employee(row);
}
export async function localDirectory() {
  const rows = (
    await pool.query("SELECT * FROM crm_users ORDER BY display_name")
  ).rows;
  const { roleRows } = await import("./accessManagement.ts");
  const roles = await roleRows();
  return rows.map((row: any) => projectEmployee(row, roles));
}
export async function initializeLocalAccounts() {
  if (process.env.PLATFORM_MODE !== "local") return;
  const { initializeAccessAccounts } = await import("./accessManagement.ts");
  await initializeAccessAccounts();
}
function setCookie(res: Response, value: string, maxAge: number) {
  res.cookie(cookie(), value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.APP_ENV === "production",
    path: "/",
    maxAge,
  });
}
export function mountLocalAuth(
  app: Express,
  authenticate: (req: Request) => Promise<Employee | null>,
) {
  const wrap =
    (fn: (q: Request, r: Response) => Promise<void>) =>
    (q: Request, r: Response) => {
      fn(q, r).catch(() =>
        r.status(503).json({ error: "Authentication service unavailable" }),
      );
    };
  app.get(
    "/api/crm/auth/me",
    wrap(async (q, r) => {
      r.setHeader("Cache-Control", "no-store");
      const e = await authenticate(q);
      if (!e) {
        r.status(401).json({ error: "Login required" });
        return;
      }
      r.json({ employee: e });
    }),
  );
  const mutation = (q: Request, r: Response) => {
    if (process.env.PLATFORM_MODE !== "local") {
      r.status(403).json({ error: "Local login unavailable" });
      return false;
    }
    if (!validMutationOrigin(q)) {
      r.status(403).json({ error: "Origin or content type rejected" });
      return false;
    }
    return true;
  };
  app.post(
    "/api/crm/auth/login",
    wrap(async (q, r) => {
      if (!mutation(q, r)) return;
      const name =
        typeof q.body.loginId === "string" ? q.body.loginId.trim() : "";
      const password =
        typeof q.body.password === "string" ? q.body.password : "";
      if (!name || name.length > 254 || !password || password.length > 200) {
        r.status(400).json({ error: "Invalid login input" });
        return;
      }
      const ip = digest(q.ip || q.socket.remoteAddress || "unknown");
      const result = await tx(async (c) => {
        // Serialize attempts per source IP, so concurrent requests cannot bypass limits.
        await c.query("SELECT GET_LOCK(:p1,5) AS acquired", [
          "crm-login:" + ip,
        ]);
        let row = (
          await c.query(
            "SELECT * FROM crm_users WHERE (login_key=lower(:p1) OR email_key=lower(:p1))",
            [name],
          )
        ).rows[0];
        await c.query("SELECT GET_LOCK(:p1,5) AS acquired", [
          "crm-account-login:" + (row?.id || name.toLowerCase()),
        ]);
        // A lookup can precede a concurrent reset or disable. Re-read the locked
        // account after serializing aliases; do not authenticate a stale snapshot.
        if (row) {
          row = (
            await c.query("SELECT * FROM crm_users WHERE id=:p1 FOR UPDATE", [
              row.id,
            ])
          ).rows[0];
          if (
            row &&
            row.login_key !== name.toLowerCase() &&
            row.email_key !== name.toLowerCase()
          )
            row = undefined;
        }
        const key = digest("account:" + (row?.id || name.toLowerCase()));
        for (const k of [ip, key])
          await c.query(
            "INSERT INTO crm_login_limits(`key`) VALUES(:p1) ON DUPLICATE KEY UPDATE failures=CASE WHEN crm_login_limits.window_start<UTC_TIMESTAMP(6)-INTERVAL 15 minute THEN 0 ELSE crm_login_limits.failures END,window_start=CASE WHEN crm_login_limits.window_start<UTC_TIMESTAMP(6)-INTERVAL 15 minute THEN UTC_TIMESTAMP(6) ELSE crm_login_limits.window_start END",
            [k],
          );
        const limits = (
          await c.query(
            "SELECT `key`,failures FROM crm_login_limits WHERE `key` IN (:p1) FOR UPDATE",
            [[ip, key]],
          )
        ).rows;
        if (limits.some((v) => v.failures >= (v.key === ip ? 30 : 5)))
          return { status: 429 };
        const valid = await matches(
          password,
          row?.password_hash ||
            "00000000000000000000000000000000:" + "0".repeat(128),
        );
        if (!row || !row.active || !valid) {
          await c.query(
            "UPDATE crm_login_limits SET failures=failures+1 WHERE `key` IN (:p1)",
            [[ip, key]],
          );
          return { status: 401 };
        }
        const restore = await restoreState(c);
        if (restore?.required && !restore.recoveryAdmins?.includes(row.id))
          return { status: 423 };
        const t = crypto.randomBytes(32).toString("hex");
        await c.query(
          "DELETE FROM crm_sessions WHERE expires_at<=UTC_TIMESTAMP(6)",
        );
        await c.query(
          "INSERT INTO crm_sessions VALUES(:p1,:p2,UTC_TIMESTAMP(6)+INTERVAL 8 hour)",
          [digest(t), row.id],
        );
        await c.query(
          "UPDATE crm_login_limits SET failures=0 WHERE `key`=:p1",
          [key],
        );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'auth.login','{}')",
          [row.id],
        );
        return {
          status: 200,
          t,
          user: projectEmployee(
            row,
            (await c.query("SELECT * FROM access_roles ORDER BY id")).rows,
          ),
        };
      });
      if (result.status === 423) {
        r.status(423).json({ error: "access_restore_required" });
        return;
      }
      if (result.status === 429) {
        r.setHeader("Retry-After", "900");
        r.status(429).json({ error: "Too many failed attempts; retry later" });
        return;
      }
      if (result.status === 401) {
        r.status(401).json({ error: "Invalid login ID, email or password" });
        return;
      }
      setCookie(r, result.t!, 8 * 3600000);
      r.setHeader("Cache-Control", "no-store");
      r.json({ employee: result.user });
    }),
  );
  app.post(
    "/api/crm/auth/logout",
    wrap(async (q, r) => {
      if (!mutation(q, r)) return;
      const t = token(q);
      if (t)
        await pool.query("DELETE FROM crm_sessions WHERE token_hash=:p1", [
          digest(t),
        ]);
      setCookie(r, "", 0);
      r.json({ success: true });
    }),
  );
  app.post(
    "/api/crm/auth/password",
    wrap(async (q, r) => {
      if (!mutation(q, r)) return;
      const e = await authenticate(q);
      if (!e) {
        r.status(401).json({ error: "Login required" });
        return;
      }
      const { currentPassword, newPassword } = q.body;
      if (
        typeof currentPassword !== "string" ||
        currentPassword.length > 200 ||
        typeof newPassword !== "string" ||
        newPassword.length < 8 ||
        newPassword.length > 200
      ) {
        r.status(400).json({
          error: "New password must contain 8–200 characters",
        });
        return;
      }
      const row = (
        await pool.query("SELECT password_hash FROM crm_users WHERE id=:p1", [
          e.id,
        ])
      ).rows[0];
      if (!(await matches(currentPassword, row.password_hash))) {
        r.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      const hash = await hashPassword(newPassword);
      const t = token(q)!;
      await tx(async (c) => {
        const updated = await c.query(
          "UPDATE crm_users SET password_hash=:p1 WHERE id=:p2 AND password_hash=:p3",
          [hash, e.id, row.password_hash],
        );
        if (!updated.rowCount) throw Error("Password changed concurrently");
        await c.query(
          "DELETE FROM crm_sessions WHERE user_id=:p1 AND token_hash<>:p2",
          [e.id, digest(t)],
        );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'auth.password_changed','{}')",
          [e.id],
        );
      });
      r.json({ success: true });
    }),
  );
}
