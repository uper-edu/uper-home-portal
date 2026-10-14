import dotenv from "dotenv";
if (process.env.PORTAL_ENV_FILE)
  dotenv.config({ path: process.env.PORTAL_ENV_FILE, quiet: true });
else if (!process.env.MYSQL_TRIAL_URL)
  dotenv.config({ path: ".env", quiet: true });
if (process.env.PORTAL_DATABASE_DRIVER !== "mysql")
  throw Error("Explicit MySQL configuration required; no database fallback");
const { startMysqlApplication } = await import("./server/mysqlApplication.ts");
await startMysqlApplication();
