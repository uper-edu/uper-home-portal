import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {readPrivateFile} from '../privateFile.mjs';
import {isAbsolute} from 'node:path';

const keyId = /^[a-zA-Z0-9_-]{1,40}$/;

export function readCredentialKeyring(file = process.env.PORTAL_CREDENTIAL_KEYRING_FILE, environment = process.env.PORTAL_ENV) {
  if (!file || !isAbsolute(file)) throw Error('credential_keyring_unavailable');
  const value = JSON.parse(readPrivateFile(file,'credential_keyring_permissions').toString('utf8'));
  if (!environment || value.environment !== environment) throw Error('credential_keyring_environment');
  const keys = new Map<string, Buffer>();
  for (const [id, hex] of Object.entries(value.keys ?? {})) {
    if (!keyId.test(id) || typeof hex !== 'string' || !/^[0-9a-f]{64}$/i.test(hex))
      throw Error('credential_keyring_invalid');
    keys.set(id, Buffer.from(hex, 'hex'));
  }
  if (!keys.has(value.active)) throw Error('credential_keyring_invalid');
  return {active: value.active as string, keys};
}

export type CredentialKeyring = ReturnType<typeof readCredentialKeyring>;
export type CredentialScope = {environment: string; type: string; resource: string};
type CredentialMaterial = Record<string, string>;
const context = (scope: CredentialScope, version: string, target: string, key: string) =>
  Buffer.from(JSON.stringify(['uper-integration-v1', scope.environment, scope.type, scope.resource, version, target, key]));

export function sealCredential(keyring: CredentialKeyring, scope: CredentialScope, version: string, target: string, value: CredentialMaterial) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyring.keys.get(keyring.active)!, nonce);
  cipher.setAAD(context(scope, version, target, keyring.active));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [keyring.active, ...[nonce, cipher.getAuthTag(), encrypted].map(v => v.toString('base64url'))].join('.');
}

export function openCredential(keyring: CredentialKeyring, scope: CredentialScope, version: string, target: string, sealed: string): CredentialMaterial {
  const [id, iv, tag, body, extra] = sealed.split('.');
  const key = keyring.keys.get(id);
  if (!key || !iv || !tag || !body || extra !== undefined) throw Error('credential_ciphertext_invalid');
  const nonce = Buffer.from(iv, 'base64url'), authTag = Buffer.from(tag, 'base64url');
  if (nonce.length !== 12 || authTag.length !== 16) throw Error('credential_ciphertext_invalid');
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(context(scope, version, target, id));
  decipher.setAuthTag(authTag);
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8'));
}
