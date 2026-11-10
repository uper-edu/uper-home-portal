export const GROUP_WEBHOOK_ENV_KEY = "LARK_GROUP_CRM";

type WebhookConfig = { secretRef?: string };

export function groupWebhookUsesEnvironment(env = process.env) {
  return (env.PORTAL_ENV === "test" && env.PORTAL_DEPLOYMENT === "company-trial") ||
    (env.PORTAL_ENV === "dev" && env.TRIAL_DATASET === "local-crm" &&
      env.PORTAL_LOCAL_CUTOVER === "true" && env.PORTAL_DEPLOYMENT !== "remote-dev");
}

export function usesEnvironmentGroupWebhook(config: WebhookConfig, env = process.env) {
  return groupWebhookUsesEnvironment(env) && config.secretRef === GROUP_WEBHOOK_ENV_KEY;
}

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

export function resolveGroupWebhook(_channelId: string, config: WebhookConfig, env = process.env) {
  if (groupWebhookUsesEnvironment(env) && !usesEnvironmentGroupWebhook(config, env)) return undefined;
  const address = config.secretRef ? env[config.secretRef] : undefined;
  return validWebhook(address) ? address : undefined;
}
