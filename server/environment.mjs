import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export const environments = ['dev', 'test', 'prod'];
export function environmentName(value = 'dev') {
  if (!environments.includes(value)) throw Error('Environment must be dev, test or prod');
  return value;
}

/** Public configuration uses UPER_PORTAL_; existing runtime consumers use PORTAL_. */
export function portalEnvironmentKey(key) {
  return key.startsWith('UPER_PORTAL_') ? key.slice(5) : key;
}

function normalizePortalEnvironment(values) {
  const normalized = {...values};
  for (const [key, value] of Object.entries(values)) {
    const runtimeKey = portalEnvironmentKey(key);
    if (runtimeKey === key) continue;
    if (Object.hasOwn(values, runtimeKey) && values[runtimeKey] !== value)
      throw Error('Conflicting environment settings: ' + key + ' and ' + runtimeKey);
    normalized[runtimeKey] = value;
    delete normalized[key];
  }
  return normalized;
}

function mysqlEnvironment(values) {
  if (values.PORTAL_DATABASE_DRIVER !== undefined && values.PORTAL_DATABASE_DRIVER !== 'mysql')
    throw Error('Only MySQL is supported');
  return {...values, PORTAL_DATABASE_DRIVER: 'mysql'};
}

export function portalWorkerEnabled(env = process.env) {
  env = normalizePortalEnvironment(env);
  const setting = env.PORTAL_WORKER_ENABLED;
  if (setting !== undefined && setting !== 'true' && setting !== 'false') {
    throw Error('PORTAL_WORKER_ENABLED must be true or false when set');
  }
  if (env.PORTAL_DEPLOYMENT === 'remote-dev') {
    if (setting === 'true') throw Error('Remote development requires port 3000 and no notification worker');
    return false;
  }
  if (setting !== undefined) return setting === 'true';
  // Standalone synthetic fixtures still require explicit opt-in.
  return (env.TRIAL_DATASET === 'local-crm' && env.PORTAL_LOCAL_CUTOVER === 'true') ||
    env.PORTAL_DEPLOYMENT === 'company-trial' ||
    (env.PORTAL_DEPLOYMENT === 'production' && env.PORTAL_ENV === 'prod');
}
/** Exact environment only. Never merge .env or another environment's secrets. */
export function readEnvironment(target, directory = process.cwd()) {
  const name = environmentName(target);
  const file = path.resolve(directory, '.env.' + name);
  if (!fs.existsSync(file)) throw Error('Missing .env.' + name + '; prepare it from the corresponding example');
  const values = normalizePortalEnvironment(dotenv.parse(fs.readFileSync(file)));
  if (values.PORTAL_ENV && values.PORTAL_ENV !== name) throw Error('Environment file target mismatch');
  for (const key of Object.keys(values)) {
    if (key.startsWith('VITE_') && /KEY|SECRET|TOKEN|PASSWORD|MYSQL|WEBHOOK/i.test(key))
      throw Error('Server credentials must not use a frontend VITE_ variable');
  }
  return { file, values: mysqlEnvironment({ ...values, PORTAL_ENV: name }) };
}
export function frontendEnvironment(target, directory = process.cwd()) {
  const { values } = readEnvironment(target, directory);
  return Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('VITE_')));
}
const bootstrapKeys = new Set(['MYSQL_TRIAL_URL','ACCESS_INITIAL_PASSWORD','ACCESS_INITIAL_PASSWORDS_FILE']);

export function readBootstrapSecrets(file){
  if(!path.isAbsolute(file))throw Error('Bootstrap secret file must have an absolute path');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size>65536||(stat.mode&0o177))throw Error('Bootstrap secret file requires private owner permissions');
    const values=dotenv.parse(fs.readFileSync(fd));
    if(Object.keys(values).some(key=>!bootstrapKeys.has(key)))throw Error('Unexpected bootstrap secret name');
    return values;
  }finally{fs.closeSync(fd);}
}
/** @param {{env?: NodeJS.ProcessEnv, directory?: string, target?: string, file?: string}} [options] */
export function loadPortalEnvironment({ env = process.env, directory = process.cwd(), target, file } = {}) {
  const incoming = normalizePortalEnvironment(env);
  const selected = target || incoming.PORTAL_ENV;
  const explicitFile = file || incoming.PORTAL_ENV_FILE;
  // Container env_file and isolated test fixtures already provide a complete runtime environment.
  const injected = incoming.PORTAL_ENV_SOURCE === 'injected' || (!selected && !explicitFile && !!(incoming.MYSQL_TRIAL_URL || incoming.PORTAL_BOOTSTRAP_SECRET_FILE));
  let name = selected ? environmentName(selected) : undefined;
  if (!injected || explicitFile) {
    let values;
    if (explicitFile) {
      const resolved = path.resolve(directory, explicitFile);
      if (!fs.existsSync(resolved)) throw Error('Explicit environment file does not exist');
      values = normalizePortalEnvironment(dotenv.parse(fs.readFileSync(resolved)));
      if (name && values.PORTAL_ENV && values.PORTAL_ENV !== name) throw Error('Environment file target mismatch');
      name = name || (values.PORTAL_ENV && environmentName(values.PORTAL_ENV));
      file = resolved;
    } else {
      name = name || 'dev';
      const loaded = readEnvironment(name, directory);
      values = loaded.values;
      file = loaded.file;
    }
    // Selection is explicit: stale variables inherited from another local environment must not win.
    for (const key of Object.keys(env)) {
      if (portalEnvironmentKey(key) !== 'PORTAL_PACKAGE_ENV' && /^(PORTAL_|MYSQL_|ACCESS_|TRIAL_|LARK_|OPENAI_|DEEPSEEK_|APP_ENV$|APP_URL$|PLATFORM_MODE$|NODE_ENV$|PORT$|MOCK_EMPLOYEE_ID$|DEFAULT_AI_PROVIDER$)/.test(portalEnvironmentKey(key))) delete env[key];
    }
    Object.assign(env, values);
    env.PORTAL_ENV_FILE = file;
  } else {
    Object.assign(env, incoming);
  }
  Object.assign(env, mysqlEnvironment(normalizePortalEnvironment(env)));
  for (const key of Object.keys(env)) if (portalEnvironmentKey(key) !== key) delete env[key];
  if (name) env.PORTAL_ENV = name;
  if(env.PORTAL_BOOTSTRAP_SECRET_FILE)Object.assign(env,readBootstrapSecrets(env.PORTAL_BOOTSTRAP_SECRET_FILE));
  if (env.PORTAL_PACKAGE_ENV && name && env.PORTAL_PACKAGE_ENV !== name) throw Error('Package and runtime environment mismatch');
  if (name === 'prod' && env.PORTAL_PRODUCTION_READY !== 'true') throw Error('Production environment has not been provisioned');
  return { target: name, injected };
}
