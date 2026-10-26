import fs from "node:fs";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { migrate } from "../../cloud/mysql/migrate.mjs";
import { after } from "node:test";
export async function setupNativeTest(label) {
  if (
    process.env.MYSQL_NATIVE_TEST_ENV !==
    "/private/tmp/uper-mysql-native-cleanup.sock"
  )
    throw Error("Explicit independent native cleanup socket required");
  const socket = process.env.MYSQL_NATIVE_TEST_ENV,
    name =
      "uper_trial_native_" +
      label.replace(/[^a-z0-9]/gi, "_").toLowerCase() +
      "_" +
      randomBytes(4).toString("hex"),
    user = "native_" + randomBytes(6).toString("hex"),
    password = randomBytes(24).toString("hex");
  const admin = await mysql.createConnection({
    user: "root",
    socketPath: socket,
  });
  await admin.query(
    "CREATE DATABASE `" +
      name +
      "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin",
  );
  await admin.query(
    "CREATE USER " +
      mysql.escape(user) +
      "@localhost IDENTIFIED BY " +
      mysql.escape(password),
  );
  await admin.query(
    "GRANT ALL ON `" + name + "`.* TO " + mysql.escape(user) + "@localhost",
  );
  await admin.query(
    "GRANT SELECT ON performance_schema.* TO " +
      mysql.escape(user) +
      "@localhost",
  );
  await admin.query(
    "GRANT PROCESS ON *.* TO " + mysql.escape(user) + "@localhost",
  );
  await admin.end();
  Object.assign(process.env, {
    MYSQL_TRIAL_URL: "mysql://" + user + ":" + password + "@localhost/" + name,
    MYSQL_TRIAL_SOCKET: socket,
    TRIAL_DATASET: "synthetic",
    PORTAL_DATABASE_DRIVER: "mysql",
    APP_ENV: "test",
    ACCESS_ALLOW_TEST_PASSWORDS: "true",
    ACCESS_OPERATION_KEY: randomBytes(32).toString("hex"),
    PORTAL_NOTIFICATION_MODE: "simulation",
    PORTAL_WORKER_ENABLED: "false",
  });
  for (const key of [
    "DATABASE_URL",
    "LARK_GROUP_CRM",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
  ])
    delete process.env[key];
  const raw = await mysql.createPool({
    user,
    password,
    database: name,
    socketPath: socket,
    timezone: "Z",
    dateStrings: true,
  });
  await migrate(raw, name);
  await raw.end();
  const fixture = {
    name,
    socket,
    async connect() {
      const { connection } = await import("../../server/portal/store.ts");
      const lease = await connection();
      return {
        ...lease.client,
        connect: async () => {},
        end: () => lease.release(),
        release: () => lease.release(),
      };
    },
    async reset(tables) {
      const c = await mysql.createConnection({
        user,
        password,
        database: name,
        socketPath: socket,
      });
      try {
        await c.query("SET FOREIGN_KEY_CHECKS=0");
        for (const table of tables.split(",").map((s) => s.trim())) {
          if (!/^[a-z_]+$/.test(table)) throw Error("Unsafe test table");
          await c.query("TRUNCATE TABLE `" + table + "`");
        }
      } finally {
        await c.end();
      }
    },
    async createRestore() {
      const target = name + "_restore",
        c = await mysql.createConnection({ user: "root", socketPath: socket });
      try {
        await c.query(
          "CREATE DATABASE `" +
            target +
            "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin",
        );
        await c.query(
          "GRANT ALL ON `" +
            target +
            "`.* TO " +
            mysql.escape(user) +
            "@localhost",
        );
      } finally {
        await c.end();
      }
      return {
        ...process.env,
        MYSQL_TRIAL_URL:
          "mysql://" + user + ":" + password + "@localhost/" + target,
      };
    },
  };

  return fixture;
}
