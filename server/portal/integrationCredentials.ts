import {createHash, randomUUID} from 'node:crypto';
import type {SmtpVerificationFailure} from './integrationCredentialTargets.ts';
import {openCredential, readCredentialKeyring, sealCredential, type CredentialScope} from './integrationCredentialCrypto.ts';

export const credentialKinds = ['ai', 'smtp', 'lark-group', 'lark-app', 'ga', 'cos'] as const;
export type CredentialKind = typeof credentialKinds[number];
export type CredentialValues = Record<string, string>;
export type CredentialClient = {query: (sql: string, params?: any[]) => Promise<{rows: any[]}>};
export type Slot = CredentialScope & {type: CredentialKind};
export type CredentialVerificationFailure = SmtpVerificationFailure|{kind:
  'ai_auth_rejected'|'ai_rate_limited'|'ai_response_invalid'|'ai_check_failed'};
export {usesDirectCredentialSetup} from '../../src/utils/integrationCredentialPolicy.ts';
type CredentialSetup={id:string;target:string;until:number};
type Version = {id: string; target: string; sealed: string; createdAt: string; validation?: {requestId:string; until:number}; receipt?: {outcome: 'verified'|'failed'; at: number; scope:string;diagnostic?:CredentialVerificationFailure}};
type State = {revision: number; active?: Version; candidate?: Version; setup?:CredentialSetup; smtpSetup?:CredentialSetup; managed?: boolean; updatedAt?: string};
export const emptyCredentialState = (): State => ({revision: 0});
export const credentialError = (status: number, message: string): never => { throw Object.assign(Error(message), {status}); };
const keys = (slot: Slot) => [slot.environment, slot.type, slot.resource];

export function credentialSlot(type: CredentialKind, resource: string, env = process.env.PORTAL_ENV): Slot {
  if (env !== 'dev' && env !== 'test' && env !== 'prod') credentialError(503, 'credential_environment_missing');
  return {environment: env!, type, resource};
}

export function credentialTarget(parts: string[]) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export async function credentialState(db: CredentialClient, slot: Slot, lock = false): Promise<State> {
  if (lock) await db.query(`INSERT INTO integration_credentials(environment,kind,resource,state)
    VALUES(:p1,:p2,:p3,:p4) ON DUPLICATE KEY UPDATE resource=resource`, [...keys(slot), emptyCredentialState()]);
  const {rows} = await db.query(`SELECT state FROM integration_credentials WHERE environment=:p1 AND kind=:p2 AND resource=:p3${lock?' FOR UPDATE':''}`, keys(slot));
  return rows[0]?.state ?? emptyCredentialState();
}

export async function storeCredentialState(db: CredentialClient, slot: Slot, state: State) {
  await db.query('UPDATE integration_credentials SET state=:p4 WHERE environment=:p1 AND kind=:p2 AND resource=:p3', [...keys(slot), state]);
}

export function credentialSource(state: State, slot: Slot, target: string, legacy: () => CredentialValues|undefined) {
  if (!state.managed) {
    const value = legacy();
    return {source: value ? 'legacy' as const : 'missing' as const, value};
  }
  if (!state.active) return {source: 'revoked' as const, value: undefined};
  if (state.active.target !== target) return {source: 'target_changed' as const, value: undefined};
  try {
    return {source: 'managed' as const, value: openCredential(readCredentialKeyring(undefined,slot.environment), slot, state.active.id, target, state.active.sealed)};
  } catch {
    return {source: 'unavailable' as const, value: undefined};
  }
}

export async function integrationCredential(
  type: CredentialKind, resource: string, target: string, legacy: () => CredentialValues|undefined,
  db?: CredentialClient,
) {
  if (!db && !process.env.MYSQL_TRIAL_URL) return legacy();
  // Pre-existing injected fixtures have no environment. They cannot address managed slots.
  if (!process.env.PORTAL_ENV && !process.env.PORTAL_CREDENTIAL_KEYRING_FILE) return legacy();
  const slot = credentialSlot(type, resource);
  const client = db ?? (await import('./store.ts')).pool;
  return credentialSource(await credentialState(client, slot), slot, target, legacy).value;
}

export const safeCredentialState = (state: State, showCandidate=true) => ({
  revision: state.revision,
  updatedAt: state.updatedAt,
  activeVersion: state.active?.id,
  candidate: showCandidate&&state.candidate ? {
    version: state.candidate.id, createdAt: state.candidate.createdAt,
    validating: Boolean(state.candidate.validation && state.candidate.validation.until > Date.now()),
    outcome: state.candidate.receipt?.outcome,
    diagnostic: state.candidate.receipt?.diagnostic,
  }:undefined,
});

export function makeCredentialVersion(slot: Slot, target: string, values: CredentialValues) {
  const id = randomUUID();
  return {id, target, sealed: sealCredential(readCredentialKeyring(undefined,slot.environment), slot, id, target, values), createdAt: new Date().toISOString()};
}

export function candidateValues(slot: Slot, version: Version) {
  return openCredential(readCredentialKeyring(undefined,slot.environment), slot, version.id, version.target, version.sealed);
}

export function verifiedCandidate(state: State, target: string, now = Date.now()) {
  const candidate = state.candidate;
  if (!candidate || candidate.target !== target || candidate.receipt?.outcome !== 'verified' ||
    now - candidate.receipt.at > 15 * 60_000) return credentialError(409, 'credential_validation_required');
  return candidate;
}
