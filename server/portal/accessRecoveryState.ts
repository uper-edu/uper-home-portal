import { pool } from "./store.ts";
export const administratorPermissions = [
  "access.read",
  "access.users",
  "access.roles",
  "access.sessions",
  "access.audit",
];
export const fullAdministrator = (e: any) =>
  !!e?.active &&
  administratorPermissions.every((p) => e.permissions.includes(p));
export async function restoreState(c: any = pool) {
  return (
    (await c.query("SELECT value FROM access_state WHERE id='restore_review'"))
      .rows[0]?.value || null
  );
}
export async function saveRestoreState(c: any, value: any) {
  await c.query(
    "INSERT INTO access_state(id,value) VALUES('restore_review',:p1) ON DUPLICATE KEY UPDATE value=VALUES(value)",
    [JSON.stringify(value)],
  );
}
export async function accessRestoreGate(q: any, r: any, next: any) {
  if (!q.path.startsWith("/api/")) return next();
  try {
    const state = await restoreState();
    if (
      state?.required &&
      !q.path.startsWith("/api/admin/access") &&
      !/^\/api\/crm\/auth\/(login|logout|me|operations(?:\/.*)?)$/.test(q.path)
    ) {
      r.status(423).json({ error: "access_restore_required" });
      return;
    }
    next();
  } catch {
    r.status(503).json({ error: "access_unavailable" });
  }
}
