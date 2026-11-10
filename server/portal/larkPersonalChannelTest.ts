import { createHash } from "node:crypto";
import { larkApp, type LarkBinding } from "./larkApp.ts";
import { liveTestUnavailable, type LarkChannelTestReceipt } from "./larkGroupChannelTest.ts";

export function planPersonalChannelTest(
  binding: LarkBinding | undefined,
  env = process.env,
) {
  const appConfigured = Boolean(env.LARK_APP_ID && env.LARK_APP_SECRET);
  const openId = binding && binding.appId === env.LARK_APP_ID && /^ou_[\w-]+$/.test(binding.openId)
    ? binding.openId : undefined;
  const enabled = env.LARK_PERSONAL_DELIVERY_ENABLED === "true";
  const blocked = !enabled ? "personal_disabled" : liveTestUnavailable(env) ? "live_unavailable"
    : !appConfigured ? "missing_app" : !openId ? "missing_binding" : null;
  const version = createHash("sha256").update(JSON.stringify([
    enabled, env.LARK_APP_ID, openId, binding?.revision, blocked,
  ])).digest("hex");
  return { appConfigured, enabled, openId, blocked, simulated: false, version };
}

export async function sendPersonalChannelTest(
  plan: ReturnType<typeof planPersonalChannelTest>,
  requestId: string,
  client: Pick<typeof larkApp, "send"> = larkApp,
): Promise<LarkChannelTestReceipt["state"]> {
  if (plan.blocked || !plan.openId) return "rejected";
  try {
    const response = await client.send(plan.openId, {
      msg_type: "text",
      content: { text: `[TEST] UPER CRM · Personal notification check\nVerification code: ${requestId}` },
    }, requestId);
    if (!response.ok) return response.status >= 500 ? "unknown" : "rejected";
    const body = await response.json();
    if (body?.code === 0) return "accepted";
    return typeof body?.code === "number" ? "rejected" : "unknown";
  } catch {
    return "unknown";
  }
}
