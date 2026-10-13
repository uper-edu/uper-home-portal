import type { Request } from "express";
import {localEmployee,localDirectory} from "./localAuth.ts";
export interface Employee {
  id: string;
  displayName?: string;
  roles?: string[];
  active?: boolean;
  teams: string[];
  permissions: string[];
  scope: "all" | "team" | "own";
}
export interface PlatformAdapter {
  authenticate(req: Request): Promise<Employee | null>;
  employees(): Promise<Employee[]>;
}
const fixtures: Employee[] = [
  {
    id: "test-admin",
    roles: ["crm_leader", "sales"],
    active: true,
    teams: ["sales", "ops", "supervisors"],
    permissions: [
      "crm.read",
      "crm.write",
      "crm.assign",
      "crm.export",
      "notifications.manage",
    ],
    scope: "all",
  },
  {
    id: "test-sales",
    roles: ["sales"],
    active: true,
    teams: ["sales"],
    permissions: ["crm.read", "crm.write"],
    scope: "own",
  },
];
export const platform: PlatformAdapter = {
  async authenticate(req) {
    if (process.env.PLATFORM_MODE === "local") return localEmployee(req);
    if (process.env.PLATFORM_MODE !== "mock") return null;
    const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress || "",
    );
    if (
      !/^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(
        req.headers.host || "",
      ) ||
      !loopback ||
      req.headers["x-forwarded-for"] ||
      req.headers["x-forwarded-host"] ||
      req.headers["cf-connecting-ip"]
    )
      return null;
    return (
      fixtures.find(
        (e) => e.id === (process.env.MOCK_EMPLOYEE_ID || "test-admin"),
      ) || null
    );
  },
  async employees() {
    return process.env.PLATFORM_MODE === "local" ? localDirectory() : process.env.PLATFORM_MODE === "mock" ? fixtures : [];
  },
};
export function allowed(e: Employee, profile: any, access: "read" | "write" = "read") {
  return (
    e.scope === "all" ||
    (e.scope === "own"
      ? profile.owner === e.id || (access === "read" && !profile.owner && e.roles?.includes("sales") && e.teams.includes(profile.team || "sales"))
      : e.teams.includes(profile.team))
  );
}
