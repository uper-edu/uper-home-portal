import {isDeepStrictEqual} from 'node:util';
import {resolveMailPassword, type StoredMailAccount} from './enrollmentMailCredentials.ts';
import {groupWebhookUsesEnvironment} from './larkGroupWebhook.ts';
import {
  credentialVersionValues, credentialSlot, credentialState, makeCredentialVersion, storeCredentialState,
  type CredentialClient, type CredentialValues, type Slot,
} from './integrationCredentials.ts';
import {
  groupCredentialTarget, legacyGroupCredential, smtpCredentialTarget, smtpTransportOptions, validGroupCredential,
} from './integrationCredentialTargets.ts';

export async function migrateLegacyCredentials(db: CredentialClient, environment: string, apply: boolean) {
  if (process.env.PORTAL_ENV !== environment) throw Error('Credential environment mismatch');
  // Serialize writes with credential management and hold the source configuration stable through commit.
  if (apply) await db.query("SELECT value FROM access_state WHERE id='policy' FOR UPDATE");
  const lock = apply ? ' FOR UPDATE' : '';
  const {rows: [mail]} = await db.query(
    'SELECT revision,config FROM enrollment_mail_configuration WHERE environment=:p1' + lock, [environment],
  );
  const {rows: groups} = await db.query(
    "SELECT id,config FROM notification_channels WHERE JSON_TYPE(JSON_EXTRACT(config,'$.encryptedWebhook'))='STRING'" + lock,
  );

  const counts = () => ({found: 0, eligible: 0, migrated: 0, retainedManaged: 0, retainedInactive: 0, blocked: 0});
  const result = {smtp: counts(), larkGroup: counts()};
  async function migrate(slot: Slot, target: string, resolve: () => CredentialValues | undefined, count: ReturnType<typeof counts>) {
    const state = await credentialState(db, slot);
    if (state.managed || state.active || state.candidate || state.setup || state.smtpSetup) {
      count.retainedManaged++;
      return;
    }
    const values = resolve();
    if (!values) {
      count.blocked++;
      return;
    }
    const active = makeCredentialVersion(slot, target, values);
    if (!isDeepStrictEqual(credentialVersionValues(slot, active), values)) throw Error('Credential round trip failed');
    count.eligible++;
    if (!apply) return;

    const current = await credentialState(db, slot, true);
    if (current.revision !== state.revision || current.managed || current.active || current.candidate || current.setup || current.smtpSetup)
      throw Error('Credential changed during migration');
    await storeCredentialState(db, slot, {
      revision: current.revision + 1, managed: true, active, updatedAt: active.createdAt,
    });
    await db.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)', [
      'system', 'access.integration.migrate_legacy', {kind: slot.type, resource: slot.resource, version: active.id},
    ]);
    count.migrated++;
  }

  const accounts: StoredMailAccount[] = mail?.config?.accounts ?? [];
  for (const account of accounts) {
    if (account.encryptedPassword === undefined) continue;
    result.smtp.found++;
    if (!Number(mail.revision)) {
      result.smtp.retainedInactive++;
      continue;
    }
    if (!smtpTransportOptions(account)) {
      result.smtp.blocked++;
      continue;
    }
    await migrate(credentialSlot('smtp', account.address, environment), smtpCredentialTarget(account), () => {
      const password = resolveMailPassword(environment, account);
      return password ? {password} : undefined;
    }, result.smtp);
  }
  for (const {id, config} of groups) {
    result.larkGroup.found++;
    // Some environments use a different destination. Migrating their unused ciphertext would switch it.
    if (config.deleted || groupWebhookUsesEnvironment()) {
      result.larkGroup.retainedInactive++;
      continue;
    }
    await migrate(credentialSlot('lark-group', id, environment), groupCredentialTarget(config), () => {
      const values = legacyGroupCredential(id, config);
      return values && validGroupCredential(values, config.signingEnabled ?? !!config.signingSecretRef) ? values : undefined;
    }, result.larkGroup);
  }
  return result;
}
