import {isDeepStrictEqual, parseArgs} from 'node:util';
import {validateTrialDatabase} from '../../cloud/mysql/database.mjs';
import {loadPortalEnvironment} from '../../server/environment.mjs';
import {openCredential, readCredentialKeyring, sealCredential, type CredentialKeyring} from '../../server/portal/integrationCredentialCrypto.ts';
import {credentialSlot, storeCredentialState, type CredentialClient, type CredentialKind} from '../../server/portal/integrationCredentials.ts';
import {migrateLegacyCredentials} from '../../server/portal/legacyCredentialMigration.ts';

type Maintenance = 'migrate' | 'rotate';
type Store = {pool: {end: () => Promise<unknown>}; tx: <T>(work: (db: CredentialClient) => Promise<T>) => Promise<T>};

async function rotateCredentials(db: CredentialClient, environment: string, keyring: CredentialKeyring, apply: boolean) {
  const {rows} = await db.query(
    `SELECT kind,resource,state FROM integration_credentials WHERE environment=:p1 ORDER BY kind,resource${apply?' FOR UPDATE':''}`,
    [environment],
  );
  const count = {verified: 0, pending: 0, rewrapped: 0};
  for (const row of rows) {
    const slot = credentialSlot(row.kind as CredentialKind, row.resource, environment);
    const next = {...row.state};
    let changed = false;
    for (const field of ['active', 'candidate'] as const) {
      const version = row.state[field];
      if (!version) continue;
      const clear = openCredential(keyring, slot, version.id, version.target, version.sealed);
      count.verified++;
      if (version.sealed.split('.')[0] === keyring.active) continue;
      count.pending++;
      if (!apply) continue;
      const sealed = sealCredential(keyring, slot, version.id, version.target, clear);
      if (!isDeepStrictEqual(openCredential(keyring, slot, version.id, version.target, sealed), clear))
        throw Error('Credential round trip failed');
      next[field] = {...version, sealed};
      count.rewrapped++;
      changed = true;
    }
    if (changed) await storeCredentialState(db, slot, next);
  }
  return count;
}

export async function runCredentialMaintenance(
  command: Maintenance,
  args: string[],
  loadStore: () => Promise<Store> = () => import('../../server/portal/store.ts'),
) {
  const {values} = parseArgs({args, options: {environment: {type: 'string'}, apply: {type: 'boolean'}}});
  const environment = values.environment;
  if (environment !== 'dev' && environment !== 'test' && environment !== 'prod')
    throw Error('Specify --environment dev, test or prod');
  if (process.env.PORTAL_ENV && process.env.PORTAL_ENV !== environment)
    throw Error('Configured environment does not match the requested target');
  loadPortalEnvironment({target: environment});
  validateTrialDatabase(process.env);
  const keyring = readCredentialKeyring(undefined, environment);
  const {pool, tx} = await loadStore();
  const apply = values.apply === true;
  const mode = apply ? 'apply' : 'preview';
  try {
    if (command === 'migrate') {
      const result = await tx(db => migrateLegacyCredentials(db, environment, apply));
      return {report: {environment, mode, ...result}, blocked: Boolean(result.smtp.blocked || result.larkGroup.blocked)};
    }
    const result = await tx(db => rotateCredentials(db, environment, keyring, apply));
    return {report: {environment, mode, ...result}, blocked: false};
  } finally {
    await pool.end();
  }
}
