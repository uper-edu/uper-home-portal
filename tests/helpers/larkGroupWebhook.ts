import { encryptGroupWebhook } from "../../server/portal/larkGroupWebhook.ts";

export function syntheticGroupWebhook(id: string, address: string, env = process.env) {
  env.LARK_WEBHOOK_ENCRYPTION_KEY = "a1".repeat(32);
  return encryptGroupWebhook(id, address, env)!;
}
