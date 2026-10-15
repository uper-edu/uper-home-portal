import { spawn } from "node:child_process";
import { loadPortalEnvironment } from '../server/environment.mjs';
import { prepareLocalMysql } from "./local-mysql.mjs";
loadPortalEnvironment({target:process.argv[2] || process.env.PORTAL_ENV || 'dev'});
if (process.env.PORTAL_DATABASE_DRIVER !== "mysql")
  throw Error("Explicit MySQL configuration required");
await prepareLocalMysql();
const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  stdio: "inherit",
  env: process.env,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
