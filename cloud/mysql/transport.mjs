/** Explicit user-approved direct connection, confined to the company test Docker network. */
export function internalMysqlDirect(env) {
  if (env.MYSQL_TLS_MODE !== 'disabled') return false;
  let url;
  try { url = new URL(env.MYSQL_TRIAL_URL); } catch { throw Error('Invalid internal MySQL target'); }
  if (env.PORTAL_DEPLOYMENT !== 'company-trial' || env.PORTAL_ENV !== 'test' ||
      env.TRIAL_DATASET !== 'synthetic' || env.NODE_ENV !== 'production' || env.APP_ENV !== 'production' ||
      url.protocol !== 'mysql:' || url.hostname !== 'mysql' || (url.port || '3306') !== '3306' || env.MYSQL_TRIAL_SOCKET)
    throw Error('Direct MySQL is allowed only for the explicitly configured company test mysql:3306 network');
  return true;
}
export function mysqlTlsRequired(env) {
  if (env.MYSQL_TLS_MODE && !['required','disabled'].includes(env.MYSQL_TLS_MODE)) throw Error('Invalid MySQL TLS mode');
  if (internalMysqlDirect(env)) return false;
  const url = new URL(env.MYSQL_TRIAL_URL);
  return !['localhost','127.0.0.1','::1'].includes(url.hostname) || env.PORTAL_DEPLOYMENT === 'company-trial';
}
