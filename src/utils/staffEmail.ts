/** Optional, administrator-managed login alias; never infer it from a staff name. */
export function normalizeStaffEmail(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw Error("access_invalid_email");
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      email,
    ) ||
    email.split("@")[0].length > 64 ||
    email.startsWith(".") ||
    email.includes("..") ||
    email.includes(".@")
  )
    throw Error("access_invalid_email");
  return email;
}
