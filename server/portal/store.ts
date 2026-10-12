import pg from "pg";
import fs from "node:fs/promises";
import crypto from "node:crypto";
export const id = () => crypto.randomUUID();
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 3000,
});
// Idle connections emit errors outside a query promise. Keep the process alive;
// pg removes the broken connection and subsequent requests can reconnect.
pool.on("error", (e) => console.error("[DATABASE]", e.message));
export async function connection() {
  const client = await pool.connect();
  let broken = false;
  const onError = () => { broken = true; };
  client.on("error", onError);
  return { client, release() { client.removeListener("error", onError); client.release(broken); } };
}
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const lease = await connection();
  const c = lease.client;
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    lease.release();
  }
}
export async function event(
  c: pg.PoolClient,
  type: string,
  leadId: string | null,
  payload: object,
) {
  await c.query(
    "INSERT INTO outbox(id,type,lead_id,payload) VALUES($1,$2,$3,$4)",
    [id(), type, leadId, payload],
  );
}
export async function initialize() {
  pool.options.connectionString = process.env.DATABASE_URL;
  await tx(async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext('portal-schema'))");
    await c.query(await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  });
}
