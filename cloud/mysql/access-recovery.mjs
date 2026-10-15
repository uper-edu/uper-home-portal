import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import readline from "node:readline/promises";
import { openTrialDatabase } from "./database.mjs";
import {
  builtInRoles,
  projectEmployee,
} from "../../src/utils/accessControl.ts";
const required = [
  "access.read",
  "access.users",
  "access.roles",
  "access.sessions",
  "access.audit",
];
const sha = (v) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(v) ?? "undefined")
    .digest("hex");
export async function securityCheckpoint(env, file) {
  const db = await openTrialDatabase(env);
  try {
    const c = await db.getConnection();
    try {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await c.beginTransaction();
      const [users] = await c.query(
        "SELECT id,active,roles,access_revision FROM crm_users ORDER BY id",
      );
      const [roles] = await c.query(
        "SELECT id,config,enabled,revision FROM access_roles ORDER BY id",
      );
      const [audit] = await c.query(
        "SELECT MAX(id) AS watermark FROM portal_audit WHERE action LIKE 'access.%'",
      );
      const payload = {
        database: new URL(env.MYSQL_TRIAL_URL).pathname.slice(1),
        createdAt: new Date().toISOString(),
        users,
        roles,
        auditWatermark: audit[0].watermark,
      };
      await fs.writeFile(
        file,
        JSON.stringify({ payload, sha256: sha(payload) }, null, 2),
        { flag: "wx", mode: 0o600 },
      );
      await c.commit();
      return { sha256: sha(payload), users: users.length };
    } finally {
      c.release();
    }
  } finally {
    await db.end();
  }
}
export async function compareCheckpoint(env, file) {
  const saved = JSON.parse(await fs.readFile(file, "utf8"));
  if (!saved.payload || saved.sha256 !== sha(saved.payload))
    throw Error("Authorization checkpoint checksum mismatch");
  const db = await openTrialDatabase(env),
    c = await db.getConnection();
  try {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await c.beginTransaction();
    const [users] = await c.query(
      "SELECT id,active,roles,access_revision FROM crm_users ORDER BY id",
    );
    const [roles] = await c.query(
      "SELECT id,config,enabled,revision FROM access_roles ORDER BY id",
    );
    const changes = (oldRows, newRows) =>
      [...new Set([...oldRows, ...newRows].map((x) => x.id))]
        .sort()
        .filter(
          (id) =>
            sha(oldRows.find((x) => x.id === id)) !==
            sha(newRows.find((x) => x.id === id)),
        );
    const result = {
      sourceDatabase: saved.payload.database,
      targetDatabase: new URL(env.MYSQL_TRIAL_URL).pathname.slice(1),
      checkpointAt: saved.payload.createdAt,
      auditWatermark: saved.payload.auditWatermark,
      changedUsers: changes(saved.payload.users, users),
      changedRoles: changes(saved.payload.roles, roles),
    };
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
    await db.end();
  }
}
export async function recoveryPreview(env, { userId, reason, enable = false }) {
  if (
    env.TRIAL_DATASET !== "synthetic" ||
    env.APP_ENV !== "test" ||
    env.PORT === "3000"
  )
    throw Error(
      "Recovery execution is restricted to the independent synthetic environment",
    );
  if (typeof reason !== "string" || !reason.trim() || reason.length > 500)
    throw Error("Recovery reason required");
  const db = await openTrialDatabase(env);
  try {
    const [rows] = await db.execute(
      "SELECT id,login_id,display_name,active,roles,access_revision FROM crm_users WHERE id=?",
      [userId],
    );
    const [roles] = await db.query(
      "SELECT id,config,enabled,revision FROM access_roles ORDER BY id",
    );
    if (!rows[0])
      throw Error("Recovery requires an existing stable account ID");
    if (!rows[0].active && !enable)
      throw Error("Disabled account requires an explicit enable approval");
    const preview = {
      database: new URL(env.MYSQL_TRIAL_URL).pathname.slice(1),
      user: rows[0],
      roles,
      reason,
      enable,
    };
    return { preview, confirmation: sha(preview) };
  } finally {
    await db.end();
  }
}
export async function recoverAdministrator(env, input, password) {
  const { preview, confirmation } = await recoveryPreview(env, input);
  if (input.confirmation !== confirmation)
    throw Error("Recovery confirmation stale or missing");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200 ||
    [input.userId, preview.user.login_id, preview.user.display_name].some(
      (value) => password.toLowerCase() === String(value || "").toLowerCase(),
    )
  )
    throw Error("A strong new password is required");
  const db = await openTrialDatabase(env),
    c = await db.getConnection();
  try {
    await c.beginTransaction();
    await c.query(
      "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
    );
    const [rows] = await c.execute(
      "SELECT * FROM crm_users WHERE id=? FOR UPDATE",
      [input.userId],
    );
    const [roles] = await c.query(
      "SELECT id,config,enabled,revision FROM access_roles ORDER BY id",
    );
    if (
      !rows[0] ||
      Number(rows[0].access_revision) !==
        Number(preview.user.access_revision) ||
      sha(roles) !== sha(preview.roles)
    )
      throw Error("Recovery state changed; preview again");
    const existing = projectEmployee(
        rows[0],
        roles.map((r) => ({ ...r, enabled: !!r.enabled })),
      ),
      assigned = [...rows[0].roles];
    if (!required.every((p) => existing.permissions.includes(p))) {
      const roleId = "recovery_" + crypto.randomBytes(8).toString("hex");
      await c.execute(
        "INSERT INTO access_roles(id,config,enabled) VALUES(?,?,true)",
        [roleId, JSON.stringify(builtInRoles.access_admin)],
      );
      assigned.push(roleId);
    }
    const salt = crypto.randomBytes(16).toString("hex"),
      hash = salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex");
    await c.execute(
      "UPDATE crm_users SET password_hash=?,roles=?,active=true,access_revision=access_revision+1 WHERE id=?",
      [hash, JSON.stringify(assigned), input.userId],
    );
    await c.execute("DELETE FROM crm_sessions WHERE user_id=?", [input.userId]);
    await c.execute("DELETE FROM crm_login_limits WHERE `key`=?", [
      crypto
        .createHash("sha256")
        .update("account:" + input.userId)
        .digest("hex"),
    ]);
    const [stateRows] = await c.query(
      "SELECT value FROM access_state WHERE id='restore_review' FOR UPDATE",
    );
    if (stateRows[0]?.value.required) {
      const state = stateRows[0].value;
      state.recoveryAdmins = [
        ...new Set([...(state.recoveryAdmins || []), input.userId]),
      ];
      state.reset = [...new Set([...(state.reset || []), input.userId])];
      state.reviewed = (state.reviewed || []).filter(
        (x) => x.id !== input.userId,
      );
      await c.execute(
        "UPDATE access_state SET value=? WHERE id='restore_review'",
        [JSON.stringify(state)],
      );
    }
    const receipt = {
      id: crypto.randomUUID(),
      userId: input.userId,
      reason: input.reason,
      confirmation,
      at: new Date().toISOString(),
      addedRole: assigned.find((x) => !rows[0].roles.includes(x)) || null,
    };
    if (!input.recordFile)
      throw Error("A private independent recovery record is required");
    // Write intent before commit. Uncertain outcomes must be reconciled using the database audit ID.
    await fs.writeFile(
      input.recordFile,
      JSON.stringify({ ...receipt, state: "prepared" }, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    await c.execute(
      "INSERT INTO portal_audit(actor,action,data) VALUES('offline-recovery','access.recovery',?)",
      [JSON.stringify(receipt)],
    );
    await c.commit();
    await fs.writeFile(
      input.recordFile,
      JSON.stringify({ ...receipt, state: "committed" }, null, 2),
      { mode: 0o600 },
    );
    return receipt;
  } catch (e) {
    await c.rollback().catch(() => {});
    throw e;
  } finally {
    c.release();
    await db.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2),
    value = (k) => args[args.indexOf(k) + 1];
  if (!args.includes("--env"))
    throw Error("Explicit independent --env file required");
  const dotenv = await import("dotenv");
  const env = dotenv.parse(await fs.readFile(value("--env")));
  if (args.includes("--compare-checkpoint"))
    console.log(await compareCheckpoint(env, value("--compare-checkpoint")));
  else if (args.includes("--checkpoint"))
    console.log(await securityCheckpoint(env, value("--checkpoint")));
  else {
    const input = {
      userId: value("--user"),
      reason: value("--reason"),
      enable: args.includes("--enable"),
      confirmation: args.includes("--apply") ? value("--apply") : undefined,
      recordFile: args.includes("--record") ? value("--record") : undefined,
    };
    if (!args.includes("--apply"))
      console.log(await recoveryPreview(env, input));
    else {
      process.stderr.write("New password (hidden): ");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: !!process.stdin.isTTY,
      });
      rl._writeToOutput = () => {};
      const password = await rl.question("");
      rl.close();
      console.log(await recoverAdministrator(env, input, password));
    }
  }
}
