import crypto from "node:crypto";
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
