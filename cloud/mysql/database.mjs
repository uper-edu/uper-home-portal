import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import {mysqlTlsRequired} from './transport.mjs';

// No fallback to DATABASE_URL: this runtime must never connect to local CRM.
export function validateTrialDatabase(env) {
  const activeLocal=env.TRIAL_DATASET==='local-crm'&&env.PORTAL_LOCAL_CUTOVER==='true';
  if (!activeLocal && env.TRIAL_DATASET !== 'synthetic' && !(env.TRIAL_DATASET==='migration-copy' && env.PORTAL_MIGRATION_REHEARSAL==='true')) throw Error('Synthetic trial dataset or explicit offline migration rehearsal is required');
  const url = new URL(env.MYSQL_TRIAL_URL || '');
  if (url.protocol !== 'mysql:') throw Error('A standard MySQL URL is required');
  const name = decodeURIComponent(url.pathname.slice(1));
  const production = env.PORTAL_ENV === 'prod' && env.PORTAL_DEPLOYMENT === 'production';
  const validSyntheticName = production ? /^prod_uper_trial_[a-z0-9_]+$/.test(name) : /^uper_trial_[a-z0-9_]+$/.test(name);
  if (activeLocal ? name!=='uper_local_crm' : !validSyntheticName) throw Error('A dedicated production or uper_trial_ database is required');
  if (!url.username || !url.password) throw Error('Database credentials are required');
  if(env.TRIAL_DATASET==='migration-copy' && (!env.MYSQL_TRIAL_SOCKET || !/restore|rehearsal/.test(name)))throw Error('Migration copy requires a private local restore database');
  if(activeLocal && (url.hostname!=='localhost'||env.MYSQL_TRIAL_SOCKET!=='/private/tmp/uper-crm-mysql-local3000.sock'))throw Error('Approved private local CRM MySQL instance required');
  return { url, name };
}

export async function openTrialDatabase(env) {
  const { url, name } = validateTrialDatabase(env);
  const { default: mysql } = await import('mysql2/promise');
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (env.MYSQL_TRIAL_SOCKET && !local) throw Error('Unix socket requires a local database URL');
  const tlsRequired = mysqlTlsRequired(env);
  // mysql2 omits TLS hostname checks for numeric IP hosts; use a certificate-matching DNS name.
  if (tlsRequired && isIP(url.hostname.replace(/^\[|\]$/g,''))) throw Error('Verified MySQL TLS requires a DNS hostname, not an IP address');
  if (tlsRequired && !env.MYSQL_CA_PEM) throw Error('Remote MySQL requires a trusted CA certificate');
  if (env.PORTAL_DEPLOYMENT === 'company-trial' && env.MYSQL_TRIAL_SOCKET) throw Error('Company trial requires verified TCP TLS, not a local socket');
  return mysql.createPool({
    host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: name,
    socketPath: env.MYSQL_TRIAL_SOCKET || undefined,
    ssl: tlsRequired ? { ca: env.MYSQL_CA_PEM, rejectUnauthorized: true, verifyIdentity: true } : undefined,
    connectionLimit: 8, connectTimeout: 10000, timezone: 'Z',
    supportBigNumbers: true, bigNumberStrings: true, dateStrings: true,
    multipleStatements: false,
  });
}

export async function transaction(pool, operation) {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

// MySQL named locks are session scoped. Never return a locked session to a pool.
export async function withLock(pool, resource, operation, timeout = 5) {
  const connection = await pool.getConnection();
  const key = 'uper:' + createHash('sha256').update(resource).digest('hex').slice(0, 58);
  let acquired = false;
  let destroyed = false;
  try {
    const [rows] = await connection.execute('SELECT GET_LOCK(?, ?) AS acquired', [key, timeout]);
    if (Number(rows[0].acquired) !== 1) throw Error('Resource is busy; retry with the same request ID');
    acquired = true;
    return await operation(connection);
  } finally {
    if (acquired) {
      try {
        const [rows] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [key]);
        if (Number(rows[0].released) !== 1) { connection.destroy(); destroyed = true; }
      } catch { connection.destroy(); destroyed = true; }
    }
    if (!destroyed) connection.release();
  }
}
