import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import readline from "node:readline/promises";
import net from "node:net";
import { openTrialDatabase, withLock } from "./database.mjs";
import {
  builtInRoles,
  projectEmployee,
} from "../../src/utils/accessControl.ts";
import {
  recoveryMac,
  recoveryTarget,
  verifyRecoveryAuthorization,
  recoveryReceiptState,
  sealRecoveryAuthorization,
} from "../../server/portal/recoveryAuthorization.ts";
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
async function emergencyPlan(env, input, c) {
  assertRecoveryMode(env);
  for (const key of [
    "userId",
    "approvedBy",
    "approvalReference",
    "reason",
    "authorizationId",
  ])
    if (
      typeof input[key] !== "string" ||
      !input[key].trim() ||
      input[key].length > 500
    )
      throw Error(
        "Explicit emergency identity, approval reference, reason and authorization ID required",
      );
  if (!/^[a-f0-9-]{36}$/.test(input.authorizationId))
    throw Error("Valid emergency authorization ID required");
  const stat = await fs.lstat(input.checkpointFile);
  if (
    !stat.isFile() ||
    stat.mode & 0o077 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw Error("Private trusted checkpoint required");
  const checkpoint = JSON.parse(
    await fs.readFile(input.checkpointFile, "utf8"),
  );
  if (
    !/^[a-f0-9]{64}$/.test(input.checkpointSha256 || "") ||
    checkpoint.sha256 !== input.checkpointSha256 ||
    sha(checkpoint.payload) !== input.checkpointSha256
  )
    throw Error("Independent trusted checkpoint checksum mismatch");
  const prior = checkpoint.payload.users.find((u) => u.id === input.userId),
    priorEmployee =
      prior &&
      projectEmployee(
        prior,
        checkpoint.payload.roles.map((r) => ({ ...r, enabled: !!r.enabled })),
      );
  if (
    !prior?.active ||
    !required.every((p) => priorEmployee.permissions.includes(p))
  )
    throw Error(
      "Emergency recovery requires a complete administrator in the independently trusted checkpoint",
    );
  const [users] = await c.execute(
    "SELECT id,login_id,display_name,active,roles,access_revision FROM crm_users WHERE id=? FOR UPDATE",
    [input.userId],
  );
  if (!users[0])
    throw Error("Emergency recovery requires an existing stable identity");
  if (!users[0].active && !input.enable)
    throw Error("Explicit re-enable approval required");
  const [roles] = await c.query(
      "SELECT id,config,enabled,revision FROM access_roles ORDER BY id",
    ),
    [states] = await c.query(
      "SELECT value FROM access_state WHERE id='restore_review'",
    );
  const current = projectEmployee(
    { ...users[0], active: true },
    roles.map((r) => ({ ...r, enabled: !!r.enabled })),
  );
  if (
    !required.every((p) => current.permissions.includes(p)) &&
    !input.restoreSystemAccess
  )
    throw Error("Explicit system access restoration approval required");
  return {
    id: input.authorizationId,
    target: recoveryTarget(env),
    user: users[0],
    roles,
    checkpointSha256: input.checkpointSha256,
    approvedBy: input.approvedBy.trim(),
    approvalReference: input.approvalReference.trim(),
    reason: input.reason.trim(),
    enableAccount: !!input.enable,
    restoreSystemAccess: !!input.restoreSystemAccess,
    restoreId: states[0]?.value.restoreId || null,
    backupSha256: states[0]?.value.required
      ? states[0].value.backupSha256
      : null,
  };
}
export async function emergencyAuthorizationPreview(env, input) {
  assertRecoveryMode(env);
  const db = await openTrialDatabase(env);
  try {
    return await withLock(
      db,
      "emergency-approval:" + input.authorizationId,
      async (c) => {
        await c.beginTransaction();
        try {
          await c.query(
            "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
          );
          const preview = await emergencyPlan(env, input, c);
          await c.commit();
          return { preview, confirmation: sha(preview) };
        } catch (e) {
          await c.rollback();
          throw e;
        }
      },
    );
  } finally {
    await db.end();
  }
}
export async function prepareEmergencyAuthorization(env, input) {
  assertRecoveryMode(env);
  await assertMaintenanceOffline(env, input);
  if (!input.authorizationFile)
    throw Error("Private authorization output file required");
  const db = await openTrialDatabase(env);
  try {
    return await withLock(
      db,
      "emergency-approval:" + input.authorizationId,
      async (c) => {
        await c.beginTransaction();
        let committed = false;
        try {
          await c.query(
            "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
          );
          const plan = await emergencyPlan(env, input, c),
            fingerprint = sha(plan);
          if (input.confirmation !== fingerprint)
            throw Error("Emergency approval confirmation stale or missing");
          const [rows] = await c.execute(
            "SELECT fingerprint,result FROM access_operations WHERE actor_id='offline-approval' AND operation_id=?",
            [plan.id],
          );
          let payload;
          if (rows[0]) {
            if (rows[0].fingerprint !== fingerprint)
              throw Error("Emergency approval content conflict");
            payload = rows[0].result.body.authorizationPayload;
          } else {
            payload = {
              purpose: "administrator-recovery-v1",
              approvalMode: "external-host-approval",
              id: plan.id,
              target: plan.target,
              userId: plan.user.id,
              loginId: plan.user.login_id,
              enableAccount: plan.enableAccount,
              restoreSystemAccess: plan.restoreSystemAccess,
              approvedBy: plan.approvedBy,
              approvalReference: plan.approvalReference,
              checkpointSha256: plan.checkpointSha256,
              reason: plan.reason,
              restoreId: plan.restoreId,
              backupSha256: plan.backupSha256,
              issuedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            };
            await c.execute(
              "INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES('offline-approval',?,'recovery.emergency-authorize',?,?)",
              [
                plan.id,
                fingerprint,
                JSON.stringify({
                  status: 200,
                  body: { authorizationPayload: payload },
                }),
              ],
            );
            await c.execute(
              "INSERT INTO portal_audit(actor,action,data) VALUES('offline-approval','access.recovery.emergency_authorize',?)",
              [
                JSON.stringify({
                  authorizationId: plan.id,
                  userId: plan.user.id,
                  approvedBy: plan.approvedBy,
                  approvalReference: plan.approvalReference,
                  checkpointSha256: plan.checkpointSha256,
                  target: plan.target,
                  restoreId: plan.restoreId,
                  reason: plan.reason,
                }),
              ],
            );
          }
          if (Date.now() >= Date.parse(payload.expiresAt))
            throw Error(
              "Emergency authorization expired; new approval required",
            );
          await c.commit();
          committed = true;
          const envelope = sealRecoveryAuthorization(env, payload);
          try {
            await fs.writeFile(
              input.authorizationFile,
              JSON.stringify(envelope, null, 2),
              { flag: "wx", mode: 0o600 },
            );
          } catch (e) {
            if (e.code !== "EEXIST") throw e;
            const stat = await fs.lstat(input.authorizationFile);
            if (
              !stat.isFile() ||
              stat.mode & 0o077 ||
              (process.getuid && stat.uid !== process.getuid()) ||
              recoveryMac(
                env,
                JSON.parse(await fs.readFile(input.authorizationFile, "utf8")),
              ) !== recoveryMac(env, envelope)
            )
              throw Error(
                "Authorization output already exists with different content",
              );
          }
          return {
            authorizationId: plan.id,
            state: "authorized",
            approvedBy: plan.approvedBy,
            approvalReference: plan.approvalReference,
            expiresAt: payload.expiresAt,
          };
        } catch (e) {
          if (!committed) await c.rollback();
          throw e;
        }
      },
    );
  } finally {
    await db.end();
  }
}

export async function queryEmergencyAuthorization(env, operationId) {
  assertRecoveryMode(env);
  if (!/^[a-f0-9-]{36}$/.test(operationId || ""))
    throw Error("Valid authorization ID required");
  const db = await openTrialDatabase(env);
  try {
    const [rows] = await db.execute(
      "SELECT result FROM access_operations WHERE actor_id='offline-approval' AND operation_id=?",
      [operationId],
    );
    if (!rows[0]) return { state: "unconfirmed", authorizationId: operationId };
    const payload = rows[0].result.body.authorizationPayload,
      [states] = await db.query(
        "SELECT value FROM access_state WHERE id='restore_review'",
      );
    const state = recoveryReceiptState(
      { body: { target: payload.target, restoreId: payload.restoreId } },
      env,
      states[0]?.value.restoreId || null,
    );
    return {
      state: state === "historical" ? "historical" : "authorized",
      authorizationId: operationId,
      payload,
    };
  } finally {
    await db.end();
  }
}
function assertRecoveryMode(env) {
  const synthetic =
    env.TRIAL_DATASET === "synthetic" &&
    env.APP_ENV === "test" &&
    env.PORT !== "3000";
  const maintenance =
    env.TRIAL_DATASET === "local-crm" &&
    env.PORTAL_LOCAL_CUTOVER === "true" &&
    env.ACCESS_RECOVERY_MAINTENANCE === "true";
  if (!synthetic && !maintenance)
    throw Error(
      "Recovery execution is restricted: explicit maintenance configuration required",
    );
}
async function assertMaintenanceOffline(env, input) {
  if (env.TRIAL_DATASET === "synthetic" && env.APP_ENV === "test") return;
  if (input.servicesStopped !== true)
    throw Error(
      "Explicit confirmation that application and workers are stopped is required",
    );
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Explicit application port required");
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.destroy();
      reject(Error("Application is still listening; recovery refused"));
    });
    socket.once("error", (e) => {
      socket.destroy();
      e.code === "ECONNREFUSED"
        ? resolve(undefined)
        : reject(Error("Unable to verify maintenance isolation"));
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(Error("Unable to verify maintenance isolation"));
    });
  });
}
async function authorization(env, input, expiry = true) {
  assertRecoveryMode(env);
  if (!input.authorizationFile)
    throw Error("Signed recovery authorization file required");
  const stat = await fs.lstat(input.authorizationFile);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.mode & 0o077 ||
    (process.getuid && stat.uid !== process.getuid()) ||
    stat.size > 65536
  )
    throw Error("Private 0600 authorization file required");
  const grant = verifyRecoveryAuthorization(
    env,
    JSON.parse(await fs.readFile(input.authorizationFile, "utf8")),
    expiry,
  );
  if (grant.userId !== input.userId || !!input.enable !== grant.enableAccount)
    throw Error("Recovery authorization scope mismatch");
  return grant;
}
async function previewOn(c, env, input, grant) {
  if (
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 500
  )
    throw Error("Recovery reason required");
  const [users] = await c.execute(
    "SELECT id,login_id,display_name,active,roles,access_revision FROM crm_users WHERE id=? FOR UPDATE",
    [input.userId],
  );
  const [roles] = await c.query(
    "SELECT id,config,enabled,revision FROM access_roles ORDER BY id",
  );
  const user = users[0];
  if (!user || user.login_id !== grant.loginId)
    throw Error("Recovery requires the authorized existing identity");
  if (!user.active && !grant.enableAccount)
    throw Error("Disabled account requires explicit enable approval");
  const employee = projectEmployee(
    user,
    roles.map((r) => ({ ...r, enabled: !!r.enabled })),
  );
  const addsSystemAccess = !required.every((p) =>
    employee.permissions.includes(p),
  );
  if (addsSystemAccess && !grant.restoreSystemAccess)
    throw Error("System access restoration was not authorized");
  const [states] = await c.query(
    "SELECT value FROM access_state WHERE id='restore_review'",
  );
  const state = states[0]?.value;
  if (grant.restoreId && grant.restoreId !== state?.restoreId)
    throw Error("Emergency authorization belongs to another restore instance");
  if (
    (state?.required && state.backupSha256 !== grant.backupSha256) ||
    (!state?.required && grant.backupSha256)
  )
    throw Error("Recovery backup context mismatch");
  return {
    database: recoveryTarget(env),
    authorizationId: grant.id,
    approvedBy: grant.approvedBy,
    approvalMode: grant.approvalMode || "authenticated-administrator",
    approvalReference: grant.approvalReference || null,
    checkpointSha256: grant.checkpointSha256 || null,
    authorizedReason: grant.reason,
    expiresAt: grant.expiresAt,
    user,
    roles,
    reason: input.reason,
    enable: !!input.enable,
    addsSystemAccess,
    restoreId: state?.restoreId || null,
  };
}
export async function recoveryPreview(env, input) {
  const grant = await authorization(env, input),
    db = await openTrialDatabase(env);
  try {
    return await withLock(db, "recovery:" + grant.id, async (c) => {
      await c.beginTransaction();
      try {
        await c.query(
          "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
        );
        const preview = await previewOn(c, env, input, grant);
        await c.commit();
        return { preview, confirmation: sha(preview), operationId: grant.id };
      } catch (e) {
        await c.rollback();
        throw e;
      }
    });
  } finally {
    await db.end();
  }
}
export async function queryRecoveryResult(env, operationId) {
  assertRecoveryMode(env);
  if (!/^[a-f0-9-]{36}$/.test(operationId || ""))
    throw Error("Valid recovery operation ID required");
  const db = await openTrialDatabase(env);
  try {
    const [rows] = await db.execute(
      "SELECT result FROM access_operations WHERE actor_id='offline-recovery' AND operation_id=?",
      [operationId],
    );
    const [states] = await db.query(
      "SELECT value FROM access_state WHERE id='restore_review'",
    );
    return rows[0]
      ? {
          state: recoveryReceiptState(
            rows[0].result,
            env,
            states[0]?.value.restoreId || null,
          ),
          operationId,
          result: rows[0].result.body,
        }
      : { state: "unconfirmed", operationId };
  } finally {
    await db.end();
  }
}
export async function reconcileRecoveryRecord(env, operationId, file) {
  const result = await queryRecoveryResult(env, operationId);
  if (!["committed", "cancelled"].includes(result.state))
    throw Error("Recovery result is not confirmed for this environment");
  const stat = await fs.lstat(file);
  if (
    !stat.isFile() ||
    stat.mode & 0o077 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw Error("Private recovery record required");
  const prior = JSON.parse(await fs.readFile(file, "utf8"));
  if (prior.id !== operationId)
    throw Error("Recovery record belongs to another operation");
  await fs.writeFile(
    file,
    JSON.stringify({ ...result.result, state: result.state }, null, 2),
    { mode: 0o600 },
  );
  return result;
}
export async function closeRecoveryOperation(env, input) {
  const grant = await authorization(env, input, false),
    db = await openTrialDatabase(env);
  if (!input.reason?.trim()) throw Error("Recovery reason required");
  try {
    return await withLock(db, "recovery:" + grant.id, async (c) => {
      await c.beginTransaction();
      try {
        await c.query(
          "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
        );
        const [rows] = await c.execute(
          "SELECT result FROM access_operations WHERE actor_id='offline-recovery' AND operation_id=?",
          [grant.id],
        );
        if (rows[0]) {
          const [states] = await c.query(
            "SELECT value FROM access_state WHERE id='restore_review'",
          );
          await c.commit();
          return {
            state: recoveryReceiptState(
              rows[0].result,
              env,
              states[0]?.value.restoreId || null,
            ),
            operationId: grant.id,
            result: rows[0].result.body,
          };
        }
        await c.execute(
          "INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES('offline-recovery',?,'offline-recovery/v1','closed',?)",
          [
            grant.id,
            JSON.stringify({
              cancelled: true,
              status: 409,
              body: {
                id: grant.id,
                target: recoveryTarget(env),
                restoreId:
                  (
                    await c.query(
                      "SELECT value FROM access_state WHERE id='restore_review'",
                    )
                  )[0][0]?.value.restoreId || null,
                userId: input.userId,
                reason: input.reason,
              },
            }),
          ],
        );
        await c.execute(
          "INSERT INTO portal_audit(actor,action,data) VALUES('offline-recovery','access.recovery.closed',?)",
          [
            JSON.stringify({
              id: grant.id,
              userId: input.userId,
              reason: input.reason,
            }),
          ],
        );
        await c.commit();
        return { state: "cancelled", operationId: grant.id };
      } catch (e) {
        await c.rollback();
        throw e;
      }
    });
  } finally {
    await db.end();
  }
}
export async function recoverAdministrator(env, input, password) {
  const grant = await authorization(env, input, false);
  await assertMaintenanceOffline(env, input);
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200 ||
    [input.userId, grant.loginId].some(
      (x) => password.toLowerCase() === String(x).toLowerCase(),
    )
  )
    throw Error("A strong new password is required");
  if (!input.recordFile)
    throw Error("A private independent recovery record is required");
  const fingerprint = recoveryMac(env, {
      authorizationId: grant.id,
      confirmation: input.confirmation,
      reason: input.reason,
      password,
    }),
    db = await openTrialDatabase(env);
  try {
    return await withLock(db, "recovery:" + grant.id, async (c) => {
      await c.beginTransaction();
      let committed = false;
      try {
        await c.query(
          "SELECT value FROM access_state WHERE id='policy' FOR UPDATE",
        );
        const [existing] = await c.execute(
          "SELECT fingerprint,result FROM access_operations WHERE actor_id='offline-recovery' AND operation_id=?",
          [grant.id],
        );
        if (existing[0]) {
          const [context] = await c.query(
            "SELECT value FROM access_state WHERE id='restore_review'",
          );
          if (
            recoveryReceiptState(
              existing[0].result,
              env,
              context[0]?.value.restoreId || null,
            ) === "historical"
          )
            throw Error(
              "Historical recovery receipt; request new authorization",
            );
          if (existing[0].result.cancelled)
            throw Error("Recovery operation cancelled");
          if (existing[0].fingerprint !== fingerprint)
            throw Error(
              "Recovery operation content conflict; query result first",
            );
          await c.commit();
          committed = true;
          return { ...existing[0].result.body, replayed: true };
        }
        if (Date.now() >= Date.parse(grant.expiresAt))
          throw Error("access_recovery_authorization_expired");
        const preview = await previewOn(c, env, input, grant);
        if (sha(preview) !== input.confirmation)
          throw Error("Recovery confirmation stale or missing");
        if (password.toLowerCase() === preview.user.display_name.toLowerCase())
          throw Error("A strong new password is required");
        const [users] = await c.execute(
            "SELECT * FROM crm_users WHERE id=? FOR UPDATE",
            [input.userId],
          ),
          assigned = [...users[0].roles];
        let addedRole = null;
        if (preview.addsSystemAccess) {
          addedRole = "recovery_" + crypto.randomBytes(8).toString("hex");
          await c.execute(
            "INSERT INTO access_roles(id,config,enabled) VALUES(?,?,true)",
            [addedRole, JSON.stringify(builtInRoles.access_admin)],
          );
          assigned.push(addedRole);
        }
        const salt = crypto.randomBytes(16).toString("hex"),
          hash =
            salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex");
        await c.execute(
          "UPDATE crm_users SET password_hash=?,roles=?,active=true,access_revision=access_revision+1 WHERE id=?",
          [hash, JSON.stringify(assigned), input.userId],
        );
        await c.execute("DELETE FROM crm_sessions WHERE user_id=?", [
          input.userId,
        ]);
        await c.execute("DELETE FROM crm_login_limits WHERE `key`=?", [
          crypto
            .createHash("sha256")
            .update("account:" + input.userId)
            .digest("hex"),
        ]);
        const [states] = await c.query(
          "SELECT value FROM access_state WHERE id='restore_review' FOR UPDATE",
        );
        if (states[0]?.value.required) {
          const state = states[0].value;
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
          id: grant.id,
          target: recoveryTarget(env),
          userId: input.userId,
          approvedBy: grant.approvedBy,
          approvalMode: grant.approvalMode || "authenticated-administrator",
          approvalReference: grant.approvalReference || null,
          reason: input.reason,
          confirmation: input.confirmation,
          restoreId: preview.restoreId,
          at: new Date().toISOString(),
          addedRole,
        };
        try {
          const stat = await fs.lstat(input.recordFile);
          if (
            !stat.isFile() ||
            stat.mode & 0o077 ||
            (process.getuid && stat.uid !== process.getuid())
          )
            throw Error("Private recovery record required");
          const saved = JSON.parse(await fs.readFile(input.recordFile, "utf8"));
          if (saved.id !== grant.id)
            throw Error("Recovery record belongs to another operation");
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
          await fs.writeFile(
            input.recordFile,
            JSON.stringify({ ...receipt, state: "prepared" }, null, 2),
            { flag: "wx", mode: 0o600 },
          );
        }
        await c.execute(
          "INSERT INTO portal_audit(actor,action,data) VALUES('offline-recovery','access.recovery',?)",
          [JSON.stringify(receipt)],
        );
        await c.execute(
          "INSERT INTO access_operations(actor_id,operation_id,action,fingerprint,result) VALUES('offline-recovery',?,'offline-recovery/v1',?,?)",
          [
            grant.id,
            fingerprint,
            JSON.stringify({ status: 200, body: receipt }),
          ],
        );
        await c.commit();
        committed = true;
        if (
          env.TRIAL_DATASET === "synthetic" &&
          env.PORTAL_FAULT_TEST === "true" &&
          env.ACCESS_RECOVERY_FAULT_AFTER_COMMIT === "true"
        )
          throw Error(
            "TEST result unavailable after commit; query operation ID",
          );
        await fs.writeFile(
          input.recordFile,
          JSON.stringify({ ...receipt, state: "committed" }, null, 2),
          { mode: 0o600 },
        );
        return receipt;
      } catch (e) {
        if (!committed) await c.rollback();
        throw e;
      }
    });
  } finally {
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
  const envFile = value("--env"),
    stat = await fs.stat(envFile);
  if (stat.mode & 0o077) throw Error("Private 0600 environment file required");
  const env = dotenv.parse(await fs.readFile(envFile));
  if (args.includes("--emergency")) {
    const input = {
      userId: value("--user"),
      approvedBy: value("--approved-by"),
      approvalReference: value("--approval-reference"),
      reason: value("--reason"),
      authorizationId: value("--authorization-id"),
      checkpointFile: value("--checkpoint-file"),
      checkpointSha256: value("--checkpoint-sha256"),
      authorizationFile: value("--authorization"),
      enable: args.includes("--enable"),
      restoreSystemAccess: args.includes("--restore-system-access"),
      servicesStopped: args.includes("--services-stopped"),
      confirmation: args.includes("--apply") ? value("--apply") : undefined,
    };
    console.log(
      args.includes("--apply")
        ? await prepareEmergencyAuthorization(env, input)
        : await emergencyAuthorizationPreview(env, input),
    );
  } else if (args.includes("--authorization-result"))
    console.log(
      await queryEmergencyAuthorization(env, value("--authorization-result")),
    );
  else if (args.includes("--result"))
    console.log(
      args.includes("--reconcile-record")
        ? await reconcileRecoveryRecord(
            env,
            value("--result"),
            value("--reconcile-record"),
          )
        : await queryRecoveryResult(env, value("--result")),
    );
  else if (args.includes("--compare-checkpoint"))
    console.log(await compareCheckpoint(env, value("--compare-checkpoint")));
  else if (args.includes("--checkpoint"))
    console.log(await securityCheckpoint(env, value("--checkpoint")));
  else {
    const input = {
      userId: value("--user"),
      authorizationFile: value("--authorization"),
      servicesStopped: args.includes("--services-stopped"),
      reason: value("--reason"),
      enable: args.includes("--enable"),
      confirmation: args.includes("--apply") ? value("--apply") : undefined,
      recordFile: args.includes("--record") ? value("--record") : undefined,
    };
    if (args.includes("--close"))
      console.log(await closeRecoveryOperation(env, input));
    else if (!args.includes("--apply"))
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
