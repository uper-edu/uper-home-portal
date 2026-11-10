import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export function validWebhook(value: string | undefined) {
  try {
    const u = new URL(value || "");
    return (
      u.protocol === "https:" &&
      u.hostname === "open.larksuite.com" &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^\/open-apis\/bot\/v2\/hook\/[a-zA-Z0-9_-]+$/.test(u.pathname) &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
}

type WebhookConfig = { encryptedWebhook?: string; secretRef?: string };
export const GROUP_WEBHOOK_ENV_KEY = "LARK_GROUP_CRM";

export function groupWebhookUsesEnvironment(env = process.env) {
  return (env.PORTAL_ENV === "test" && env.PORTAL_DEPLOYMENT === "company-trial") ||
    (env.PORTAL_ENV === "dev" && env.TRIAL_DATASET === "local-crm" &&
      env.PORTAL_LOCAL_CUTOVER === "true" && env.PORTAL_DEPLOYMENT !== "remote-dev");
}

export function usesEnvironmentGroupWebhook(config: WebhookConfig, env = process.env) {
  return groupWebhookUsesEnvironment(env) && config.secretRef === GROUP_WEBHOOK_ENV_KEY;
}

export function usesLegacyProductionGroupWebhook(config: WebhookConfig, env = process.env) {
  return env.PORTAL_ENV === "prod" && env.PORTAL_DEPLOYMENT === "production" &&
    config.encryptedWebhook === undefined && typeof config.secretRef === "string" &&
    /^[A-Z0-9_]{1,80}$/.test(config.secretRef);
}

export function larkWebhookSignature(secret: string | undefined, now: Date) {
  if (!secret) return {};
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const sign = createHmac("sha256", timestamp + "\n" + secret).update("").digest("base64");
  return { timestamp, sign };
}

function encryptionKey(env: NodeJS.ProcessEnv) {
  const value = env.LARK_WEBHOOK_ENCRYPTION_KEY;
  return value && /^[a-fA-F0-9]{64}$/.test(value) ? Buffer.from(value, "hex") : undefined;
}

export function encryptGroupWebhook(id: string, value: string, env = process.env) {
  if (groupWebhookUsesEnvironment(env)) return undefined;
  const key = encryptionKey(env);
  if (!key) return undefined;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(id));
  const ciphertext = Buffer.concat([cipher.update(new URL(value).href, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function resolveGroupWebhook(id: string, config: WebhookConfig, env = process.env) {
  if (groupWebhookUsesEnvironment(env)) {
    if (!usesEnvironmentGroupWebhook(config, env)) return undefined;
    const address = env[GROUP_WEBHOOK_ENV_KEY];
    return address && validWebhook(address) ? new URL(address).href : undefined;
  }

  if (config.encryptedWebhook === undefined) {
    const address = usesLegacyProductionGroupWebhook(config, env) ? env[config.secretRef!] : undefined;
    return address && validWebhook(address) ? new URL(address).href : undefined;
  }
  const key = encryptionKey(env);
  if (!key) return undefined;
  try {
    const [version, iv, tag, ciphertext, extra] = config.encryptedWebhook.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) return undefined;
    const nonce = Buffer.from(iv, "base64url");
    const authTag = Buffer.from(tag, "base64url");
    if (nonce.length !== 12 || authTag.length !== 16) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(authTag);
    const value = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    return validWebhook(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function publicGroupChannelConfig(config: {
  team?: string; teamName?: string; groupName?: string; mode?: string;
  maxPerHour?: number; signingSecretRef?: string; signingEnabled?: boolean; webhookRevision?: string;
}) {
  return {
    team: config.team, teamName: config.teamName, groupName: config.groupName,
    mode: config.mode, maxPerHour: config.maxPerHour,
    signingSecretRef: config.signingSecretRef, signingEnabled: config.signingEnabled,
    webhookRevision: config.webhookRevision ?? null,
  };
}
