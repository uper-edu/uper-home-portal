import crypto from "node:crypto";
export const recoveryPermissions = [
  "access.read",
  "access.users",
  "access.roles",
  "access.sessions",
  "access.audit",
];
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const recoveryHash = (value: any) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
export function recoveryTarget(env: any, database?: string) {
  const url = new URL(env.MYSQL_TRIAL_URL);
  return {
    database: database || decodeURIComponent(url.pathname.slice(1)),
    host: url.hostname,
    port: url.port || "3306",
    socket: env.MYSQL_TRIAL_SOCKET || null,
  };
}
export function recoveryMac(env: any, value: any) {
  if ((env.ACCESS_OPERATION_KEY || "").length < 32)
    throw Error("access_operation_key_missing");
  return crypto
    .createHmac("sha256", env.ACCESS_OPERATION_KEY)
    .update("uper-maintenance-recovery-v1\n" + JSON.stringify(canonical(value)))
    .digest("hex");
}
export function sealRecoveryAuthorization(env: any, payload: any) {
  return { payload, signature: recoveryMac(env, payload) };
}
export function verifyRecoveryAuthorization(
  env: any,
  envelope: any,
  checkExpiry = true,
) {
  const p = envelope?.payload;
  const expected = recoveryMac(env, p);
  if (
    !p ||
    typeof envelope.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(envelope.signature) ||
    !crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(envelope.signature, "hex"),
    ) ||
    p.purpose !== "administrator-recovery-v1" ||
    !/^[a-f0-9-]{36}$/.test(p.id) ||
    recoveryHash(p.target) !== recoveryHash(recoveryTarget(env))
  )
    throw Error("access_recovery_authorization_invalid");
  if (
    checkExpiry &&
    (!Number.isFinite(Date.parse(p.expiresAt)) ||
      Date.now() >= Date.parse(p.expiresAt))
  )
    throw Error("access_recovery_authorization_expired");
  return p;
}
export function recoveryReceiptState(
  result: any,
  env: any,
  restoreId: string | null,
) {
  if (
    !result.body?.target ||
    recoveryHash(result.body.target) !== recoveryHash(recoveryTarget(env)) ||
    (result.body?.restoreId || null) !== restoreId
  )
    return "historical";
  return result.cancelled ? "cancelled" : "committed";
}
