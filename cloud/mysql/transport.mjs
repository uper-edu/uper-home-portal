/** A separate, explicitly approved development target; never a production fallback. */
export function approvedRemoteDevelopment(env) {
  if (env.PORTAL_DEPLOYMENT !== 'remote-dev' || env.PORTAL_ENV !== 'dev' ||
      env.PORTAL_REMOTE_DEV_APPROVED !== 'true' || env.TRIAL_DATASET !== 'synthetic' || env.MYSQL_TRIAL_SOCKET) return false;
  let url;
  try { url = new URL(env.MYSQL_TRIAL_URL); } catch { return false; }
  return url.protocol === 'mysql:' && url.hostname === 'cn60.monite.cn' &&
    (url.port || '3306') === '3306' && decodeURIComponent(url.pathname) === '/uper_trial_home';
}

/** Explicit user-approved direct connection, confined to approved MySQL endpoints. */
export function internalMysqlDirect(env) {
  if (env.MYSQL_TLS_MODE !== 'disabled') return false;
  if (approvedRemoteDevelopment(env)) return true;
  let url;
  try { url = new URL(env.MYSQL_TRIAL_URL); } catch { throw Error('Invalid internal MySQL target'); }
  const companyTest = env.PORTAL_DEPLOYMENT === 'company-trial' && env.PORTAL_ENV === 'test' && url.hostname === 'mysql';
  const productionInternal = env.PORTAL_DEPLOYMENT === 'production' && env.PORTAL_ENV === 'prod' && /^10\./.test(url.hostname);
  if ((!companyTest && !productionInternal) || env.TRIAL_DATASET !== 'synthetic' ||
      env.NODE_ENV !== 'production' || env.APP_ENV !== 'production' ||
      url.protocol !== 'mysql:' || (url.port || '3306') !== '3306' || env.MYSQL_TRIAL_SOCKET)
    throw Error('Direct MySQL is allowed only for an explicitly configured internal endpoint');
  return true;
}
export function mysqlTlsRequired(env) {
  if (env.MYSQL_TLS_MODE && !['required','disabled'].includes(env.MYSQL_TLS_MODE)) throw Error('Invalid MySQL TLS mode');
  if (internalMysqlDirect(env)) return false;
  const url = new URL(env.MYSQL_TRIAL_URL);
  return !['localhost','127.0.0.1','::1'].includes(url.hostname) || env.PORTAL_DEPLOYMENT === 'company-trial';
}
