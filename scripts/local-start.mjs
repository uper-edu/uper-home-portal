import fs from "node:fs";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { prepareLocalMysql } from "./local-mysql.mjs";
if (process.env.PORTAL_ENV_FILE)
  dotenv.config({ path: process.env.PORTAL_ENV_FILE, quiet: true });
else if (!process.env.MYSQL_TRIAL_URL && fs.existsSync(".env"))
  dotenv.config({ path: ".env", quiet: true });
if (process.env.PORTAL_DATABASE_DRIVER !== "mysql")
  throw Error("Explicit MySQL configuration required");
await prepareLocalMysql();
const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  stdio: "inherit",
  env: process.env,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
