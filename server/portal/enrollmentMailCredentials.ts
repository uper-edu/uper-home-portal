import {createCipheriv, createDecipheriv, createHmac, randomBytes} from 'node:crypto';
import {mailSecretReferencePattern,type MailAccount} from '../../src/utils/enrollmentMailConfig.ts';

export type StoredMailAccount = MailAccount & {encryptedPassword?: string};

function credentialKey() {
  const key = process.env.PORTAL_ENROLLMENT_MAIL_CREDENTIAL_KEY;
  return key && /^[a-f0-9]{64}$/i.test(key) ? Buffer.from(key, 'hex') : undefined;
}

export function mailCredentialKeyConfigured() {
  return Boolean(credentialKey());
}

function accountContext(environment: string, address: string) {
  return Buffer.from(JSON.stringify(['enrollment-smtp-v1', environment, address]));
}

export function sealMailPassword(environment: string, address: string, password: string) {
  const key = credentialKey();
  if (!key) throw new Error('enrollment_mail_credential_key_missing');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(accountContext(environment, address));
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
}

export function mailPasswordFingerprint(environment: string, address: string, password: string) {
  const key = credentialKey();
  if (!key) throw new Error('enrollment_mail_credential_key_missing');
  return createHmac('sha256', key).update(JSON.stringify(['enrollment-smtp-operation-v1', environment, address, password])).digest('hex');
}

export function resolveMailPassword(environment: string, account: StoredMailAccount) {
  if (account.encryptedPassword === undefined) return account.secret && new RegExp('^'+mailSecretReferencePattern+'$').test(account.secret)
    ? process.env[account.secret] : undefined;
  const key = credentialKey();
  if (!key) return undefined;
  try {
    const [iv, tag, ciphertext] = account.encryptedPassword.split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(accountContext(environment, account.address));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}
