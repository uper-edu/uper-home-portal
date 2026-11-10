import { createHash } from "node:crypto";
import { larkWebhookSignature, resolveGroupWebhook } from "./larkGroupWebhook.ts";
import { larkTestDeliveryMode } from "./larkChannelModes.ts";

export type LarkChannelTestReceipt = {
  requestId: string;
  channelId: string;
  version: string;
  simulated: boolean;
  state: "pending" | "accepted" | "rejected" | "unknown";
  received: boolean;
};

type GroupTestConfig = {
  groupName?: string;
  mode?: string;
  encryptedWebhook?: string;
  secretRef?: string;
  webhookRevision?: string;
  signingSecretRef?: string;
  signingEnabled?: boolean;
};

export function planGroupChannelTest(id: string, config: GroupTestConfig, env = process.env) {
  const url = resolveGroupWebhook(id, config, env);
  const signingEnabled = config.signingEnabled ?? Boolean(config.signingSecretRef);
  const signingSecret = signingEnabled && config.signingSecretRef ? env[config.signingSecretRef] : undefined;
  const { simulated, liveUnavailable } = larkTestDeliveryMode(config.mode, env);
  const blocked = liveUnavailable ? "live_unavailable"
    : !url ? "missing_webhook"
    : signingEnabled && !signingSecret ? "missing_signing_secret"
    : null;
  const version = createHash("sha256").update(JSON.stringify([
    id, config.groupName, config.mode, config.webhookRevision, config.encryptedWebhook,
    url, signingEnabled, signingSecret, simulated, blocked,
  ])).digest("hex");
  return { url, signingSecret, simulated, blocked, version };
}

export async function sendGroupChannelTest(
  plan: ReturnType<typeof planGroupChannelTest>,
  requestId: string,
  transport: typeof fetch = fetch,
): Promise<LarkChannelTestReceipt["state"]> {
  if (plan.blocked || !plan.url) return "rejected";
  const payload = {
    ...larkWebhookSignature(plan.signingSecret, new Date()),
    msg_type: "text",
    content: { text: `[TEST] UPER CRM · Group notification check\nVerification code: ${requestId}` },
  };
  try {
    const response = plan.simulated
      ? new Response('{"code":0}')
      : await transport(plan.url, {
        method: "POST", redirect: "error", headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
      });
    if (!response.ok) return response.status >= 500 ? "unknown" : "rejected";
    const body = await response.json();
    const code = body?.code ?? body?.StatusCode;
    if (code === 0 || code === "0") return "accepted";
    return typeof code === "number" || typeof code === "string" ? "rejected" : "unknown";
  } catch {
    return "unknown";
  }
}

type Queryable = { query: Function };

export async function findLarkChannelTest(db: Queryable, channelId: string, requestId: string | null) {
  const { rows } = await db.query(
    "SELECT data,created_at FROM portal_audit WHERE action IN ('channel.test.start','channel.test.result','channel.test.received') AND data->>'$.channelId'=:p1 AND (:p2 IS NULL OR data->>'$.requestId'=:p2) ORDER BY id DESC LIMIT 1",
    [channelId, requestId],
  );
  return rows[0] as { data: LarkChannelTestReceipt; created_at: Date } | undefined;
}

export async function recordLarkChannelTest(
  db: Queryable, actor: string, action: "start" | "result" | "received", result: LarkChannelTestReceipt,
) {
  await db.query(
    "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
    [actor, "channel.test." + action, result],
  );
}
