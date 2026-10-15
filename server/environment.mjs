import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export const environments = ['dev', 'test', 'prod'];
export function environmentName(value = 'dev') {
  if (!environments.includes(value)) throw Error('Environment must be dev, test or prod');
  return value;
}
/** Exact environment only. Never merge .env or another environment's secrets. */
export function readEnvironment(target, directory = process.cwd()) {
  const name = environmentName(target);
  const file = path.resolve(directory, '.env.' + name);
  if (!fs.existsSync(file)) throw Error('Missing .env.' + name + '; prepare it from the corresponding example');
  const values = dotenv.parse(fs.readFileSync(file));
  if (values.PORTAL_ENV && values.PORTAL_ENV !== name) throw Error('Environment file target mismatch');
  for (const key of Object.keys(values)) {
    if (key.startsWith('VITE_') && /KEY|SECRET|TOKEN|PASSWORD|MYSQL|WEBHOOK/i.test(key))
      throw Error('Server credentials must not use a frontend VITE_ variable');
  }
  return { file, values: { ...values, PORTAL_ENV: name } };
}
export function frontendEnvironment(target, directory = process.cwd()) {
  const { values } = readEnvironment(target, directory);
  return Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith('VITE_')));
}
export function loadPortalEnvironment({ env = process.env, directory = process.cwd(), target, file } = {}) {
  const selected = target || env.PORTAL_ENV;
  const explicitFile = file || env.PORTAL_ENV_FILE;
  // Container env_file and isolated test fixtures already provide a complete runtime environment.
  const injected = env.PORTAL_ENV_SOURCE === 'injected' || (!selected && !explicitFile && !!env.MYSQL_TRIAL_URL);
  let name = selected ? environmentName(selected) : undefined;
  if (!injected || explicitFile) {
    let values;
    if (explicitFile) {
      const resolved = path.resolve(directory, explicitFile);
      if (!fs.existsSync(resolved)) throw Error('Explicit environment file does not exist');
      values = dotenv.parse(fs.readFileSync(resolved));
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
      if (key !== 'PORTAL_PACKAGE_ENV' && /^(PORTAL_|MYSQL_|ACCESS_|TRIAL_|LARK_|OPENAI_|DEEPSEEK_|APP_ENV$|APP_URL$|PLATFORM_MODE$|NODE_ENV$|PORT$|MOCK_EMPLOYEE_ID$|DEFAULT_AI_PROVIDER$)/.test(key)) delete env[key];
    }
    Object.assign(env, values);
    env.PORTAL_ENV_FILE = file;
  }
  if (name) env.PORTAL_ENV = name;
  if (env.PORTAL_PACKAGE_ENV && name && env.PORTAL_PACKAGE_ENV !== name) throw Error('Package and runtime environment mismatch');
  if (name === 'prod' && env.PORTAL_PRODUCTION_READY !== 'true') throw Error('Production environment has not been provisioned');
  return { target: name, injected };
}
