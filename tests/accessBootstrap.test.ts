import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setupNativeTest } from "./helpers/mysql.mjs";
if (!process.env.MYSQL_NATIVE_TEST_ENV) {
  test("company test bootstrap uses the private env password only for new accounts", async (t) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "uper-company-test-bootstrap-"));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, ".env.test");
    const { loadPortalEnvironment } = await import("../server/environment.mjs");
    const fakePassword = "MockAa123";
    await fs.writeFile(file, "ACCESS_INITIAL_PASSWORD=" + fakePassword + "\n", { mode: 0o600 });
    const env: NodeJS.ProcessEnv = {};
    loadPortalEnvironment({ target: "test", directory: dir, env });
    assert.equal(env.ACCESS_INITIAL_PASSWORD, fakePassword);
    assert.equal(env.ACCESS_INITIAL_PASSWORDS_FILE, undefined);

    await import("./helpers/mockPortalDatabase.mjs");
    const { operationContext } = await import("../server/portal/operationContext.ts");
    const { initializeAccessAccounts } = await import("../server/portal/accessManagement.ts");
    const { accountSeeds } = await import("../server/portal/localAuth.ts");
    const { passwordChangeKey, scrypt } = await import("../server/portal/staffCredentials.ts");
    const { pool } = await import("../server/portal/store.ts");
    t.after(() => pool.end());

    const keys = ["ACCESS_INITIAL_PASSWORD", "ACCESS_INITIAL_PASSWORDS_FILE", "ACCESS_ALLOW_TEST_PASSWORDS"] as const;
    const previous = keys.map(k => process.env[k]);
    t.after(() => keys.forEach((k, index) => {
      const value = previous[index];
      if (value === undefined) delete process.env[k];
      else process.env[k] = value;
    }));
    process.env.ACCESS_INITIAL_PASSWORD = env.ACCESS_INITIAL_PASSWORD!;
    process.env.ACCESS_ALLOW_TEST_PASSWORDS = "false";
    delete process.env.ACCESS_INITIAL_PASSWORDS_FILE;

    const users = new Map<string, { id: string; password_hash: string; roles: string[]; active: boolean }>();
    const existing = { id: "Fadhil", password_hash: "existing-hash", roles: ["sales"], active: false };
    users.set(existing.id, existing);
    const passwordFlags = new Map<string, { required: boolean }>();
    let initialized = false;
    let userWriteAttempts = 0;
    const storage = {
      async query(sql: string, params: any[] = []) {
        if (sql.includes("id='restore_review'")) return { rows: [] };
        if (sql.startsWith("SELECT value FROM access_state")) return { rows: [{value:{initialized}}] };
        if (sql.startsWith("SELECT id FROM crm_users")) return { rows: users.has(params[0]) ? [users.get(params[0])] : [] };
        if (sql.startsWith("INSERT INTO crm_users")) {
          userWriteAttempts++;
          const [id, hash, roles] = params;
          assert.match(sql, /ON DUPLICATE KEY UPDATE id=id$/);
          if (!users.has(id)) users.set(id, { id, password_hash: hash, roles: JSON.parse(roles), active: true });
        } else if (sql.startsWith("INSERT INTO access_state(id,value) VALUES(:p1,:p2)")) {
          passwordFlags.set(params[0],params[1]);
        } else if (sql.startsWith("SELECT * FROM crm_users WHERE id='Robert'")) {
          return { rows: [users.get("Robert")] };
        } else if (sql.startsWith("UPDATE crm_users SET roles=")) {
          users.get("Robert")!.roles=JSON.parse(params[0]);
        } else if (sql.startsWith("UPDATE access_state SET value=")) {
          initialized=JSON.parse(params[0]).initialized;
        } else {
          assert.match(sql, /^(INSERT INTO (access_roles|access_state|portal_audit)|DELETE FROM crm_sessions)/);
        }
        return { rows: [] };
      },
    };
    await operationContext.run(storage, initializeAccessAccounts);
    assert.equal(initialized,true);
    assert.deepEqual(users.get(existing.id),existing);
    assert.equal(passwordFlags.has(passwordChangeKey(existing.id)), false);
    assert.equal(passwordFlags.size, accountSeeds.length-1);
    for (const [id] of accountSeeds) {
      if (id===existing.id) continue;
      const user=users.get(id)!;
      const [salt, hash]=user.password_hash.split(":");
      assert.notEqual(user.password_hash,fakePassword);
      assert.deepEqual(await scrypt(fakePassword,salt,64),Buffer.from(hash,"hex"));
      assert.deepEqual(passwordFlags.get(passwordChangeKey(id)),{required:true});
    }

    const snapshot=JSON.stringify([...users]);
    const writes=userWriteAttempts;
    await fs.writeFile(file, "ACCESS_INITIAL_PASSWORD=DifferentMock456\n");
    const changedEnv: NodeJS.ProcessEnv = {};
    loadPortalEnvironment({ target:"test",directory:dir,env:changedEnv });
    process.env.ACCESS_INITIAL_PASSWORD=changedEnv.ACCESS_INITIAL_PASSWORD!;
    await operationContext.run(storage, initializeAccessAccounts);
    assert.equal(userWriteAttempts,writes);
    assert.equal(JSON.stringify([...users]),snapshot);
  });
}
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
