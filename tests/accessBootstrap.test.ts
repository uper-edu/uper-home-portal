import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setupNativeTest } from "./helpers/mysql.mjs";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  await setupNativeTest("access_bootstrap");
  process.env.PLATFORM_MODE = "local";
  const { pool } = await import("../server/portal/store.ts");
  const { initializeAccessAccounts } =
    await import("../server/portal/accessManagement.ts");
  await test("initial credentials fail closed; existing accounts stay unchanged; interrupted restore blocks startup", async (t) => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "uper-access-bootstrap-"),
    );
    t.after(async () => {
      await pool.end();
      await fs.rm(dir, { recursive: true, force: true });
    });
    process.env.ACCESS_ALLOW_TEST_PASSWORDS = "false";
    delete process.env.ACCESS_INITIAL_PASSWORDS_FILE;
    await assert.rejects(initializeAccessAccounts(), /initial-password/);
    assert.equal((await pool.query("SELECT * FROM crm_users")).rows.length, 0);
    process.env.ACCESS_ALLOW_TEST_PASSWORDS = "true";
    process.env.APP_ENV = "production";
    await assert.rejects(initializeAccessAccounts(), /isolated synthetic/);
    process.env.ACCESS_ALLOW_TEST_PASSWORDS = "false";
    const { accountSeeds } = await import("../server/portal/localAuth.ts");
    const file = path.join(dir, "initial.json");
    await fs.writeFile(
      file,
      JSON.stringify(
        Object.fromEntries(
          accountSeeds.map(([id]) => [id, "TEST-bootstrap-" + id + "-2026"]),
        ),
      ),
      { mode: 0o600 },
    );
    process.env.ACCESS_INITIAL_PASSWORDS_FILE = file;
    await fs.chmod(file, 0o644);
    await assert.rejects(initializeAccessAccounts(), /0600/);
    await fs.chmod(file, 0o600);
    await initializeAccessAccounts();
    const before = (await pool.query("SELECT * FROM crm_users ORDER BY id"))
      .rows;
    assert.equal(before.length, 9);
    assert.ok(
      before.every((u: any) => !u.password_hash.includes("TEST-bootstrap-")),
    );
    delete process.env.ACCESS_INITIAL_PASSWORDS_FILE;
    await initializeAccessAccounts();
    assert.deepEqual(
      (await pool.query("SELECT * FROM crm_users ORDER BY id")).rows,
      before,
    );
    const { openTrialDatabase } = await import("../cloud/mysql/database.mjs");
    const raw = await openTrialDatabase(process.env);
    try {
      await raw.query(
        "CREATE TABLE access_restore_guard_test(id INT PRIMARY KEY)",
      );
      const { migrate } = await import("../cloud/mysql/migrate.mjs");
      await assert.rejects(
        migrate(raw, new URL(process.env.MYSQL_TRIAL_URL!).pathname.slice(1)),
        /Interrupted restore/,
      );
    } finally {
      await raw.end();
    }
  });
}
