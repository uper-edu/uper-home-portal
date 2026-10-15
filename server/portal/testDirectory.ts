import crypto from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(crypto.scrypt);
export const testDirectoryOrigin = "https://home.prototype.uperedu.com";
export const testDirectoryIds = [
  "Robert",
  "Ethan",
  "Monite",
  "Suki",
  "Tester",
  "Fadhil",
  "Wigar",
  "Zainul",
  "Fenny",
] as const;
export function testDirectoryEnabled(env = process.env) {
  return (
    env.PORTAL_TEST_DIRECTORY_ENABLED === "true" &&
    env.TRIAL_DATASET === "synthetic" &&
    env.PORTAL_ENV === "test" &&
    env.APP_URL === testDirectoryOrigin
  );
}
export function canReadTestDirectory(employee: { permissions: string[] }) {
  return [
    "access.read",
    "access.users",
    "access.roles",
    "access.sessions",
    "access.audit",
  ].every((p) => employee.permissions.includes(p));
}
export async function testDirectoryUsers(
  rows: any[],
  roles: any[],
  initialPassword: string | undefined,
) {
  const result = [];
  for (const id of testDirectoryIds) {
    const user = rows.find((u) => u.id === id);
    if (!user) continue;
    let matchesInitial = false;
    if (
      initialPassword &&
      initialPassword.length >= 8 &&
      initialPassword.length <= 200
    ) {
      const [salt, key] = String(user.password_hash || "").split(":");
      if (salt && /^[a-f0-9]{128}$/.test(key || "")) {
        const actual = (await scrypt(initialPassword, salt, 64)) as Buffer;
        matchesInitial = crypto.timingSafeEqual(
          actual,
          Buffer.from(key, "hex"),
        );
      }
    }
    result.push({
      id: user.id,
      loginId: user.login_id,
      displayName: user.display_name,
      active: !!user.active,
      roles: user.roles.map((roleId: string) => {
        const role = roles.find((r) => r.id === roleId);
        return {
          id: roleId,
          names: role?.config?.names || [roleId, roleId, roleId],
          enabled: !!role?.enabled,
        };
      }),
      initialPassword: matchesInitial ? initialPassword : null,
      passwordState: matchesInitial ? "initial" : "unavailable",
    });
  }
  return result;
}
