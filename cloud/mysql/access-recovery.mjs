import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { openTrialDatabase } from "./database.mjs";
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const [envFlag, envFile, action, file] = args;
  if (envFlag !== '--env' || !envFile || !file || args.length !== 4 ||
      !['--checkpoint', '--compare-checkpoint'].includes(action))
    throw Error('Offline administrator recovery is retired. Use --env FILE --checkpoint FILE or --compare-checkpoint FILE.');
  const {parse} = await import('dotenv');
  const stat=await fs.lstat(envFile);
  if(!stat.isFile()||(stat.mode&0o077)||(process.getuid&&stat.uid!==process.getuid()))
    throw Error('Owned private 0600 environment required');
  const env = parse(await fs.readFile(envFile, 'utf8'));
  console.log(await (action === '--checkpoint' ? securityCheckpoint : compareCheckpoint)(env, file));
}
