import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(".env"), quiet: true });
const cluster = path.resolve("data/postgres-local");
if (
  process.env.DATABASE_URL &&
  fs.existsSync(path.join(cluster, "PG_VERSION"))
) {
  const url = new URL(process.env.DATABASE_URL);
  if (
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.port === "5449"
  ) {
    const binary = path.resolve(
      "node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl",
    );
    if (!fs.existsSync(binary))
      throw Error(
        "Local PostgreSQL binary missing. Run npm ci on this macOS arm64 machine.",
      );
    if (
      spawnSync(binary, ["-D", cluster, "status"], { stdio: "ignore" })
        .status !== 0
    ) {
      const started = spawnSync(
        binary,
        [
          "-D",
          cluster,
          "-l",
          path.resolve("data/postgres-local.log"),
          "-o",
          "-h 127.0.0.1 -p 5449",
          "start",
        ],
        { stdio: "inherit" },
      );
      if (started.status !== 0) process.exit(started.status || 1);
    }
  }
}
const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  stdio: "inherit",
  env: process.env,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
