import pg from "pg";
import fs from "node:fs/promises";
import crypto from "node:crypto";
export const id = () => crypto.randomUUID();
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
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
  await pool.query(
    await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
}
