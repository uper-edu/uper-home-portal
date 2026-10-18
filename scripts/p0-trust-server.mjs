// Explicit independent fixture only. Never loads .env.dev or connects to port 3000.
import fs from "node:fs";
import { setupNativeTest } from "../tests/helpers/mysql.mjs";
if (
  process.env.MYSQL_NATIVE_TEST_ENV !==
  "/private/tmp/uper-mysql-native-cleanup.sock"
)
  throw Error("Independent socket required");
let fixture;
if (process.env.P0_TRUST_REUSE === "true") {
  const saved = JSON.parse(
    fs.readFileSync("/private/tmp/uper-p0-trust-env.json", "utf8"),
  );
  if (
    saved.MYSQL_TRIAL_SOCKET !==
      "/private/tmp/uper-mysql-native-cleanup.sock" ||
    !/^\/uper_trial_native_facts_tasks_browser_/.test(
      new URL(saved.MYSQL_TRIAL_URL).pathname,
    )
  )
    throw Error("Wrong fixture");
  Object.assign(process.env, saved);
  fixture = { name: new URL(saved.MYSQL_TRIAL_URL).pathname.slice(1) };
} else fixture = await setupNativeTest("facts_tasks_browser");
Object.assign(process.env, {
  PORT: "4426",
  PLATFORM_MODE: "local",
  PORTAL_WORKER_ENABLED: "false",
  PORTAL_NOTIFICATION_MODE: "simulation",
  PORTAL_FAULT_TEST: "true",
  TRIAL_MODEL_STUB: "true",
  TRIAL_FRONTEND_DIRECTORY: new URL("../build/p0-trust/web", import.meta.url)
    .pathname,
});
fs.writeFileSync(
  "/private/tmp/uper-p0-trust-env.json",
  JSON.stringify(
    Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        /^(MYSQL_|PORTAL_|ACCESS_|TRIAL_|PLATFORM_MODE|APP_ENV|PORT$)/.test(
          key,
        ),
      ),
    ),
  ),
  { mode: 0o600 },
);
await (await import("../server/mysqlApplication.ts")).startMysqlApplication();
console.log(
  JSON.stringify({
    independentDatabase: fixture.name,
    port: 4426,
    notifications: "simulation",
  }),
);
