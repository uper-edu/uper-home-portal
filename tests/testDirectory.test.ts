import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  canReadTestDirectory,
  testDirectoryEnabled,
  testDirectoryOrigin,
  testDirectoryUsers,
} from "../server/portal/testDirectory.ts";
import { testDirectoryText } from "../src/utils/testDirectory.ts";
function hash(p: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(p, salt, 64).toString("hex");
}
test("Test directory requires explicit synthetic test scope, canonical origin and full system authority", () => {
  const env = {
    PORTAL_TEST_DIRECTORY_ENABLED: "true",
    TRIAL_DATASET: "synthetic",
    PORTAL_ENV: "test",
    APP_URL: testDirectoryOrigin,
  };
  assert.equal(testDirectoryEnabled(env), true);
  for (const [key, value] of Object.entries({
    PORTAL_TEST_DIRECTORY_ENABLED: "false",
    TRIAL_DATASET: "local-crm",
    PORTAL_ENV: "prod",
    APP_URL: "https://other.example",
  }))
    assert.equal(testDirectoryEnabled({ ...env, [key]: value }), false);
  const permissions = [
    "access.read",
    "access.users",
    "access.roles",
    "access.sessions",
    "access.audit",
  ];
  assert.equal(canReadTestDirectory({ permissions }), true);
  for (const p of permissions)
    assert.equal(
      canReadTestDirectory({ permissions: permissions.filter((v) => v !== p) }),
      false,
    );
});
test("Directory uses preset IDs, current roles and verified initial credentials; never recovers changed passwords", async () => {
  const old = "TEST-fixture-initial",
    changed = "TEST-fixture-changed";
  const rows = [
    {
      id: "Robert",
      login_id: "Robert",
      display_name: "Robert",
      active: 1,
      roles: ["access_admin", "crm_leader"],
      password_hash: hash(old),
    },
    {
      id: "Ethan",
      login_id: "ethan@example.invalid",
      display_name: "Ethan",
      active: 0,
      roles: ["cms_admin"],
      password_hash: hash(changed),
    },
    {
      id: "added-later",
      login_id: "New",
      display_name: "New",
      active: 1,
      roles: ["access_admin"],
      password_hash: hash(old),
    },
  ];
  const roles = [
    {
      id: "access_admin",
      enabled: true,
      config: {
        names: ["System Administrator", "Administrator Sistem", "系统管理员"],
      },
    },
    {
      id: "crm_leader",
      enabled: true,
      config: { names: ["CRM Manager", "Manajer CRM", "CRM 管理者"] },
    },
    {
      id: "cms_admin",
      enabled: true,
      config: { names: ["CMS Operator", "Operator CMS", "CMS 操作员"] },
    },
  ];
  const users = await testDirectoryUsers(rows, roles, old);
  assert.deepEqual(
    users.map((u) => u.id),
    ["Robert", "Ethan"],
  );
  assert.equal(users[0].initialPassword, old);
  assert.equal(users[1].initialPassword, null);
  assert.equal(users[1].active, false);
  assert.equal(users[0].roles[1].names[0], "CRM Manager");
  assert.ok(!JSON.stringify(users).includes("password_hash"));
  assert.ok(!JSON.stringify(users).includes(changed));
  assert.ok(
    (await testDirectoryUsers(rows, roles, undefined)).every(
      (u) => u.initialPassword === null,
    ),
  );
  for (const lang of ["en", "id", "zh"] as const) {
    const text = testDirectoryText(
      { origin: testDirectoryOrigin, generatedAt: "TEST", users },
      lang,
    );
    assert.ok(text.includes(testDirectoryOrigin + "/chat?c=campaignID"));
    assert.ok(text.includes(testDirectoryOrigin + "/crm?tab=docs"));
    assert.ok(text.includes(old));
    assert.ok(!text.includes(changed));
    assert.ok(!text.includes("added-later"));
    assert.ok(!text.includes("]("));
  }
});
