import { isIP } from 'node:net';
import {internalMysqlDirect} from '../cloud/mysql/transport.mjs';

export const companyOrigin = 'https://home.prototype.uperedu.com';
export const isCompanyTrial = (env = process.env) => env.PORTAL_DEPLOYMENT === 'company-trial';
export const productionOrigin = 'https://home.uperedu.com';
export const isProductionDeployment = (env = process.env) => env.PORTAL_ENV === 'prod' && env.PORTAL_DEPLOYMENT === 'production';
/** Parse the explicit public-origin allowlist used by the HTTPS transport gate. */
export function publicOrigins(env = process.env) {
  const raw = env.ACCESS_ALLOWED_ORIGINS || env.ACCESS_PUBLIC_ORIGIN || '';
  const values = raw.split(',').map(value => value.trim()).filter(Boolean);
  const origins = new Set<string>();
  for (const value of values) {
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw Error('Public origins must be explicit HTTPS origins'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
      throw Error('Public origins must be explicit HTTPS origins');
    origins.add(parsed.origin);
  }
  return [...origins];
}
/** Explicit deployment gate. Local cutover and test-fault switches never grant server access. */
export function companyConfiguration(env = process.env) {
  if (!isCompanyTrial(env)) return null;
  if (env.NODE_ENV !== 'production' || env.APP_ENV !== 'production' ||
      env.TRIAL_DATASET !== 'synthetic' || env.PLATFORM_MODE !== 'local' ||
      env.PORTAL_DATABASE_DRIVER !== 'mysql' || env.PORTAL_LOCAL_CUTOVER === 'true' ||
      env.ACCESS_RECOVERY_MAINTENANCE === 'true' ||
      env.PORTAL_MIGRATION_REHEARSAL === 'true' || env.ACCESS_ALLOW_TEST_PASSWORDS === 'true')
    throw Error('Company trial requires production transport, database accounts and an isolated synthetic dataset');
  if (['PORTAL_FAULT_TEST','TRIAL_MODEL_STUB','TRIAL_PRIMARY_FAILURE','TRIAL_CONTENT_FAILURE_ONCE','TRIAL_FOLLOWUP_FAILURE_ONCE'].some(k => env[k] === 'true'))
    throw Error('Local fault injection is forbidden in company deployment');
  if (env.APP_URL !== companyOrigin || env.ACCESS_PUBLIC_ORIGIN !== companyOrigin)
    throw Error('Company trial requires the approved canonical HTTPS origin');
  const direct=internalMysqlDirect(env);
  if (!env.ACCESS_TRUSTED_PROXIES || (env.ACCESS_OPERATION_KEY || '').length < 32 ||
      !env.TRIAL_FRONTEND_DIRECTORY || env.MYSQL_TRIAL_SOCKET || (!direct && !env.MYSQL_CA_PEM))
    throw Error('Company trial requires explicit proxy peers, stable private key, frontend directory and an approved MySQL transport');
  const peers=env.ACCESS_TRUSTED_PROXIES.split(',').map(p=>p.trim()).filter(Boolean);
  if(!peers.length || peers.some(p=>!exactPrivateProxy(p)))throw Error('Company trial requires exact private proxy peers, never wildcard networks');
  if(!['true','false'].includes(env.PORTAL_WORKER_ENABLED || ''))throw Error('Company trial worker must be explicitly enabled or paused');
  if (!['simulation','configured'].includes(env.PORTAL_NOTIFICATION_MODE || ''))
    throw Error('Explicit company notification mode required');
  if (env.PORTAL_NOTIFICATION_MODE === 'configured' && env.LARK_TEST_GROUP !== 'CRM_Leads_Update')
    throw Error('Company trial live notifications are restricted to the designated CRM Bot channel');
  const port = Number(env.PORT || '8080');
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3000)
    throw Error('Company trial requires a distinct unprivileged container port');
  return { port, host: '0.0.0.0' };
}
export function productionConfiguration(env = process.env) {
  if (!isProductionDeployment(env)) return null;
  if (env.NODE_ENV !== 'production' || env.APP_ENV !== 'production' ||
      env.TRIAL_DATASET !== 'synthetic' || env.PLATFORM_MODE !== 'local' ||
      env.PORTAL_DATABASE_DRIVER !== 'mysql' || env.PORTAL_PRODUCTION_READY !== 'true' ||
      env.ACCESS_ALLOW_TEST_PASSWORDS === 'true' || env.PORTAL_LOCAL_CUTOVER === 'true' ||
      env.PORTAL_MIGRATION_REHEARSAL === 'true')
    throw Error('Production deployment requires the production transport, database and release gates');
  if (env.APP_URL !== productionOrigin || env.ACCESS_PUBLIC_ORIGIN !== productionOrigin)
    throw Error('Production deployment requires the approved canonical HTTPS origin');
  if (!env.ACCESS_ALLOWED_ORIGINS || !publicOrigins(env).includes(productionOrigin))
    throw Error('Production deployment requires an explicit public-origin allowlist containing the canonical origin');
  if (env.MYSQL_TLS_MODE !== 'disabled')
    throw Error('Production deployment requires the explicitly approved internal MySQL direct mode');
  if (!env.ACCESS_TRUSTED_PROXIES || (env.ACCESS_OPERATION_KEY || '').length < 32)
    throw Error('Production deployment requires explicit proxy peers and a stable private operation key');
  const peers=env.ACCESS_TRUSTED_PROXIES.split(',').map(p=>p.trim()).filter(Boolean);
  if(!peers.length || peers.some(p=>!exactPrivateProxy(p)))throw Error('Production deployment requires exact private proxy peers');
  if(!['true','false'].includes(env.PORTAL_WORKER_ENABLED || ''))throw Error('Production worker must be explicitly enabled or paused');
  if (!['simulation','configured'].includes(env.PORTAL_NOTIFICATION_MODE || ''))
    throw Error('Explicit production notification mode required');
  const port = Number(env.PORT || '8080');
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3000)
    throw Error('Production deployment requires a distinct unprivileged container port');
  return { port, host: '0.0.0.0' };
}
export function exactPrivateProxy(value: string) {
  const ip = value.startsWith('::ffff:') ? value.slice(7) : value;
  if (!isIP(ip)) return false;
  if (ip === '::1') return true;
  if (isIP(ip) !== 4) return false;
  const [a,b] = ip.split('.').map(Number);
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
