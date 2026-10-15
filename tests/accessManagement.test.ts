import crypto from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  builtInRoles,
  canDelegate,
  canClaimRecord,
  projectEmployee,
  permittedRecord,
  validateRole,
} from "../src/utils/accessControl.ts";
import { resolveRecipients } from "../server/portal/notificationDelivery.ts";
import { availableWorkspaces } from "../src/utils/adminWorkspace.ts";
import { accessGuide, accessError } from "../src/utils/accessLanguage.ts";
test("All built-in templates validate; owner eligibility does not grant cross-customer access", () => {
  for (const role of Object.values(builtInRoles))
    assert.doesNotThrow(() => validateRole(role));
  const e = projectEmployee(
    {
      id: "TEST-sales",
      display_name: "TEST",
      roles: ["sales"],
      teams: ["sales"],
      active: true,
    },
    [{ id: "sales", config: builtInRoles.sales, enabled: true }],
  );
  assert.deepEqual(e.grants["crm.own"], ["own"]);
  assert.equal(canClaimRecord(e, { owner: null, team: "sales" }), true);
  assert.equal(canClaimRecord(e, { owner: null, team: "other" }), true);
  assert.equal(
    canClaimRecord(
      { ...e, permissions: e.permissions.filter((p) => p !== "crm.followup") },
      { owner: null, team: "sales" },
    ),
    false,
  );
  for (const permission of ["crm.read", "crm.write", "crm.export"])
    assert.equal(
      permittedRecord(e, { owner: "OTHER", team: "sales" }, permission),
      false,
    );
});
test("Action scopes remain separate across multiple roles; administrator does not acquire business access", () => {
  const roles = Object.entries(builtInRoles).map(([id, config]) => ({
    id,
    config,
    enabled: true,
  }));
  const admin = projectEmployee(
    {
      id: "A",
      display_name: "A",
      roles: ["access_admin"],
      teams: ["sales"],
      active: true,
    },
    roles,
  );
  assert.deepEqual(availableWorkspaces(admin), ["system"]);
  assert.equal(canDelegate(admin, builtInRoles.crm_leader.grants), true);
  const limited = projectEmployee(
    { id: "L", display_name: "L", roles: ["limited"], teams: [], active: true },
    [
      {
        id: "limited",
        enabled: true,
        config: {
          names: ["Limited", "Terbatas", "有限"],
          description: ["", "", ""],
          grants: {
            "access.read": "all",
            "access.users": "all",
            "access.sessions": "all",
          },
        },
      },
    ],
  );
  assert.equal(canDelegate(limited, builtInRoles.access_admin.grants), false);

  assert.equal(permittedRecord(admin, { owner: "A", team: "sales" }), false);
  const scoped = projectEmployee(
    {
      id: "A",
      display_name: "A",
      roles: ["sales", "custom"],
      teams: ["sales"],
      active: true,
    },
    [
      ...roles,
      {
        id: "custom",
        enabled: true,
        config: {
          names: ["Custom", "Khusus", "自定义"],
          description: ["", "", ""],
          grants: {
            "crm.read": "all",
            "crm.export": "own",
            "cms.manage": "all",
          },
        },
      },
    ],
  );
  assert.equal(permittedRecord(scoped, { owner: "B" }, "crm.read"), true);
  assert.equal(permittedRecord(scoped, { owner: "B" }, "crm.write"), false);
  assert.equal(permittedRecord(scoped, { owner: "B" }, "crm.export"), false);
  assert.equal(permittedRecord(scoped, { owner: "A" }, "crm.export"), true);
  assert.throws(
    () =>
      validateRole({
        ...builtInRoles.sales,
        grants: { "crm.claim": "all", "crm.read": "own" },
      }),
    /owner/,
  );
  assert.throws(
    () =>
      validateRole({
        ...builtInRoles.sales,
        grants: { "unknown.execute": "all" },
      }),
    /invalid_permission/,
  );
});
test("Custom manager capability drives fallback notifications without a hard-coded role name", () => {
  const manager = projectEmployee(
    {
      id: "custom-manager",
      display_name: "TEST Manager",
      roles: ["manager_custom"],
      teams: ["sales"],
      active: true,
    },
    [
      {
        id: "manager_custom",
        enabled: true,
        config: {
          names: ["Manager", "Manajer", "管理者"],
          description: ["", "", ""],
          grants: {
            "crm.read": "all",
            "crm.assign": "all",
            "crm.leader": "all",
            "notifications.read": "all",
          },
        },
      },
    ],
  );
  const fallback = resolveRecipients(
    { event: "lead.created", recipient: "owner" } as any,
    { owner: "inactive", team: "sales" },
    [manager] as any,
    "TEST-lead",
  );
  assert.deepEqual(fallback.ids, ["custom-manager"]);
  const limitedManager = {
    ...manager,
    grants: { ...manager.grants, "crm.assign": ["own"] },
  };
  assert.deepEqual(
    resolveRecipients(
      { event: "lead.created", recipient: "owner" } as any,
      { owner: "inactive", team: "sales" },
      [limitedManager] as any,
      "TEST-lead",
    ).ids,
    [],
  );
  const owner = projectEmployee(
    {
      id: "TEST-owner",
      display_name: "TEST Owner",
      roles: ["sales"],
      teams: ["sales"],
      active: true,
    },
    [{ id: "sales", config: builtInRoles.sales, enabled: true }],
  );
  const invalidOwner = {
    ...owner,
    permissions: owner.permissions.filter((p) => p !== "crm.followup"),
  };
  assert.deepEqual(
    resolveRecipients(
      { event: "lead.created", recipient: "owner" } as any,
      { owner: owner.id, team: "sales" },
      [invalidOwner, manager] as any,
      "TEST-lead",
    ).ids,
    [manager.id],
  );

  const incident = resolveRecipients(
    { event: "notification.failed" } as any,
    {},
    [manager] as any,
  );
  assert.deepEqual(incident.ids, ["custom-manager"]);
});
for (const lang of ["en", "id", "zh"] as const)
  test(`System workspace and online guide render in ${lang}`, () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "ol",
        null,
        accessGuide.map((words, i) =>
          React.createElement(
            "li",
            { key: i },
            words[lang === "zh" ? 2 : lang === "id" ? 1 : 0],
          ),
        ),
      ),
    );
    if (lang !== "zh")
      assert.doesNotMatch(html.replace(/<[^>]+>/g, ""), /[\u4e00-\u9fff]/);
    assert.equal(accessGuide.length, 11);
    assert.ok(accessError("access_last_administrator", lang));
    assert.doesNotMatch(html, /<select/);
  });
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  await setupNativeTest("access_management");
  process.env.PLATFORM_MODE = "local";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const {
    initializeLocalAccounts,
    localDirectory,
    hashPassword,
    accountSeeds,
  } = await import("../server/portal/localAuth.ts");
  // Existing accounts simulate an upgrade: preserve hashes, IDs and their original business roles.
  const oldHashes: Record<string, string> = {};
  for (const [name, roles] of accountSeeds) {
    oldHashes[name] = await hashPassword(name);
    await pool.query(
      "INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(:p1,:p1,:p1,:p2,:p3,:p4)",
      [
        name,
        oldHashes[name],
        JSON.stringify(roles),
        JSON.stringify(
          roles.includes("crm_leader" as never)
            ? ["sales", "ops", "supervisors"]
            : roles.includes("sales" as never)
              ? ["sales"]
              : ["cms"],
        ),
      ],
    );
  }
  await pool.query("INSERT INTO crm_sessions VALUES(:p1,'Robert',UTC_TIMESTAMP(6)+INTERVAL 8 hour)",['0'.repeat(64)]);
  const express = (await import("express")).default,
    app = express();
  app.use(express.json());
  await mountPortal(app);
  const { mountSite } = await import("../cloud/mysql/site.mjs");
  const { nativePool } = await import("../cloud/mysql/runtime.mjs");
  const { platform } = await import("../server/portal/identity.ts");
  await mountSite(app, {
    db: nativePool,
    platform,
    visitor: () => {},
    portalTx: () => {},
    leadTier: () => {},
    taskDeadline: () => {},
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  async function request(
    path: string,
    cookie = "",
    body?: any,
    method = body ? "POST" : "GET",
    origin = base,
  ) {
    const r = await fetch(base + path, {
      method,
      headers: { cookie, Origin: origin, "Content-Type": "application/json" },
      body: body ? JSON.stringify({ ...body, ...((path.startsWith("/api/admin/access/") && !path.endsWith("/preview") || path === "/api/crm/auth/password") ? { operationId: body.operationId || crypto.randomUUID() } : {}) }) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  async function login(name: string, password = name) {
    return request("/api/crm/auth/login", "", { loginId: name, password });
  }
  let admin = (await login("Robert")).cookie;
  const sales = (await login("Fadhil")).cookie,
    manager = (await login("Suki")).cookie;
  await test("Independent MySQL access administration closed loop", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    await t.test(
      "Upgrade preserves credentials and business roles; only Robert becomes access administrator",
      async () => {
        assert.equal((await pool.query("SELECT * FROM crm_sessions WHERE token_hash=:p1",['0'.repeat(64)])).rows.length,0);
        const rows = (await pool.query("SELECT * FROM crm_users")).rows;
        assert.equal(rows.length, 9);
        for (const row of rows) {
          assert.equal(row.password_hash, oldHashes[row.id]);
          assert.equal(row.roles.includes("access_admin"), row.id === "Robert");
        }
        const robert = (await localDirectory()).find((e) => e.id === "Robert")!;
        assert.equal(robert.permissions.includes("cms.manage"), true);
        assert.equal(robert.scope, "all");
      },
    );
    await t.test(
      "Anonymous, Sales and CRM Manager cannot access administration or self-escalate",
      async () => {
        assert.equal((await request("/api/admin/access")).status, 401);
        assert.equal((await request("/api/admin/access", sales)).status, 403);
        assert.equal((await request("/api/admin/access", manager)).status, 403);
        assert.equal(
          (
            await request("/api/admin/access/roles/sales", sales, {
              config: builtInRoles.crm_leader,
              revision: 1,
              enabled: true,
              reason: "TEST escalation",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/api/admin/access/users/Robert",
              admin,
              { reason: "TEST" },
              "POST",
              "https://invalid.example",
            )
          ).status,
          403,
        );
        const d = (await request("/api/admin/access", admin)).data;
        assert.doesNotMatch(JSON.stringify(d), /password_hash|token_hash/);
        const directory = (await request("/api/portal/employees", sales)).data;
        assert.ok(
          directory.every((u: any) =>
            u.permissions.every((p: string) =>
              ["crm.read", "crm.own", "crm.followup"].includes(p),
            ),
          ),
        );
        assert.ok(
          directory.every(
            (u: any) =>
              !u.rolePermissions && Object.keys(u.grants || {}).length === 0,
          ),
        );
        const businessAudit = (
          await request("/api/crm/notification-audit", manager)
        ).data;
        assert.ok(
          businessAudit.every((row: any) => !row.action.startsWith("access.")),
        );
      },
    );
    await t.test(
      "Delegated account operator cannot assign an administrator role or reset an administrator credential",
      async () => {
        const config = {
          names: ["TEST delegated", "TEST delegasi", "测试委托"] as [
            string,
            string,
            string,
          ],
          description: ["", "", ""] as [string, string, string],
          grants: {
            "access.read": "all",
            "access.users": "all",
            "access.sessions": "all",
          } as any,
        };
        assert.equal(
          (
            await request("/api/admin/access/roles/test_delegated", admin, {
              revision: 0,
              config,
              enabled: true,
              reason: "TEST delegated boundary",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("/api/admin/access/users", admin, {
              loginId: "TESTDelegated",
              displayName: "TEST delegated",
              roles: ["test_delegated"],
              teams: [],
              temporaryPassword: "TEST-delegated-password",
              reason: "TEST delegated account",
            })
          ).status,
          200,
        );
        const cookie = (await login("TESTDelegated", "TEST-delegated-password"))
          .cookie;
        assert.equal(
          (
            await request("/api/admin/access/users", cookie, {
              loginId: "TESTEscalated",
              displayName: "TEST forbidden",
              roles: ["access_admin"],
              teams: [],
              temporaryPassword: "TEST-delegated-password",
              reason: "TEST indirect escalation",
            })
          ).status,
          403,
        );
        const me = (await request("/api/admin/access", cookie)).data.users.find(
          (u: any) => u.id === "Robert",
        );
        assert.equal(
          (
            await request("/api/admin/access/users/Robert/password", cookie, {
              revision: me.revision,
              temporaryPassword: "TEST-blocked-reset",
              reason: "TEST administrator reset",
            })
          ).status,
          403,
        );
        assert.equal((await login("Robert")).status, 200);
      },
    );
    await t.test(
      "CMS permission and inquiry receipt scopes remain independent of global customer viewing",
      async () => {
        assert.equal(
          (await request("/api/cms/content/news", sales)).status,
          403,
        );
        assert.equal(
          (await request("/api/cms/content/news", admin)).status,
          200,
        );
        const config = {
          names: ["TEST inquiry", "TEST formulir", "测试表单"] as [
            string,
            string,
            string,
          ],
          description: ["", "", ""] as [string, string, string],
          grants: { "crm.read": "all", "crm.assign": "own" } as any,
        };
        assert.equal(
          (
            await request("/api/admin/access/roles/test_inquiry_scope", admin, {
              revision: 0,
              config,
              enabled: true,
              reason: "TEST inquiry boundary",
            })
          ).status,
          200,
        );
        const disabled = await request("/api/admin/access/users", admin, {
          loginId: "TESTDisabledNew",
          displayName: "TEST Disabled New",
          roles: ["sales"],
          teams: ["sales"],
          active: false,
          temporaryPassword: "TEST-disabled-password",
          reason: "TEST create disabled account",
        });
        assert.equal(disabled.status, 200);
        assert.equal(disabled.data.user.active, false);
        assert.equal(
          (await login("TESTDisabledNew", "TEST-disabled-password")).status,
          401,
        );
        const created = await request("/api/admin/access/users", admin, {
          loginId: "TESTInquiry",
          displayName: "TEST inquiry",
          roles: ["test_inquiry_scope"],
          teams: ["sales"],
          temporaryPassword: "TEST-inquiry-password",
          reason: "TEST scoped account",
        });
        const id = created.data.user.id;
        assert.equal(created.status, 200);
        for (const [lead, owner] of [
          ["test-inquiry-owned", id],
          ["test-inquiry-foreign", "Wigar"],
        ]) {
          await pool.query(
            "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
            [
              lead,
              { id: lead, fullName: "TEST inquiry", owner, team: "sales" },
            ],
          );
          await nativePool.execute(
            "INSERT INTO site_submissions(id,kind,payload,lead_id,request_id,input_hash) VALUES(?,?,?,?,?,?)",
            [
              lead,
              "inquiry",
              JSON.stringify({ message: "TEST inquiry receipt" }),
              lead,
              lead,
              "0".repeat(64),
            ],
          );
        }
        const cookie = (await login("TESTInquiry", "TEST-inquiry-password"))
          .cookie;
        const result = await request("/api/staff/submissions", cookie);
        assert.equal(result.status, 200);
        assert.deepEqual(
          result.data.items.map((item: any) => item.lead_id),
          ["test-inquiry-owned"],
        );
        assert.equal(
          (await request("/api/cms/content/news", cookie)).status,
          403,
        );
      },
    );
    const teamRole = {
      names: ["TEST scoped", "TEST terbatas", "测试范围"] as [
        string,
        string,
        string,
      ],
      description: ["", "", ""] as [string, string, string],
      grants: {
        "crm.read": "all",
        "crm.write": "own",
        "crm.export": "own",
        "crm.own": "own",
        "crm.claim": "all",
        "crm.followup": "own",
        "crm.attendance": "own",
        "cms.manage": "all",
      } as any,
    };
    let userId = "",
      userCookie = "";
    await t.test(
      "Create a custom role and user, then authenticate with effective action scopes",
      async () => {
        assert.equal(
          (
            await request("/api/admin/access/roles/test_scoped", admin, {
              revision: 0,
              config: teamRole,
              enabled: true,
              reason: "TEST custom role",
            })
          ).status,
          200,
        );
        const create = await request("/api/admin/access/users", admin, {
          loginId: "TESTScoped",
          displayName: "TEST original 名字",
          roles: ["test_scoped"],
          teams: ["sales"],
          temporaryPassword: "TEST-password-2026",
          reason: "TEST new user",
        });
        assert.equal(create.status, 200);
        userId = create.data.user.id;
        const auth = await login("testscoped", "TEST-password-2026");
        assert.equal(auth.status, 200);
        userCookie = auth.cookie;
        assert.equal(auth.data.employee.roles.includes("sales"), false);
        assert.deepEqual(auth.data.employee.grants["crm.export"], ["own"]);
        assert.equal(
          (
            await request("/api/admin/access/users", admin, {
              loginId: "testscoped",
              displayName: "TEST",
              roles: [],
              teams: [],
              temporaryPassword: "TEST-password",
              reason: "TEST duplicate",
            })
          ).status,
          409,
        );
      },
    );
    const leadIds = [
      "test-access-owned",
      "test-access-other",
      "test-access-unassigned",
    ];
    await t.test(
      "Custom ownership capability drives claim; permissions protect customer edits and exports",
      async () => {
        for (const [index, id] of leadIds.entries())
          await pool.query(
            "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
            [
              id,
              {
                id,
                fullName: "TEST Access " + index,
                owner: index === 0 ? userId : index === 1 ? "Wigar" : null,
                team: "sales",
                tier: "Hot",
                currentStage: "New",
                submittedAt: "2026-10-14T10:00:00Z",
              },
            ],
          );
        assert.equal(
          (
            await request(
              "/api/crm/leads/test-access-other",
              userCookie,
              { currentStage: "Contacted" },
              "PATCH",
            )
          ).status,
          404,
        );
        const exported = (await request("/api/crm/export", userCookie)).data;
        assert.equal(exported.length, 1);
        assert.equal(exported[0].id, "test-access-owned");
        assert.equal(
          (
            await request(
              "/api/crm/leads/test-access-unassigned/claim",
              userCookie,
              {},
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              "/api/crm/leads/test-access-unassigned",
              userCookie,
              { owner: "Wigar" },
              "PATCH",
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "Role preview predicts changes; revision conflicts and invalid permissions are rejected",
      async () => {
        const preview = await request(
          "/api/admin/access/roles/preview",
          admin,
          {
            id: "test_scoped",
            config: { ...teamRole, grants: { "cms.manage": "all" } },
            enabled: true,
          },
        );
        assert.equal(preview.status, 200);
        assert.equal(preview.data.affected.length, 1);
        assert.deepEqual(preview.data.affected[0].after.permissions, [
          "cms.manage",
        ]);
        assert.equal(
          (
            await request("/api/admin/access/roles/test_scoped", admin, {
              revision: 0,
              config: teamRole,
              enabled: true,
              reason: "TEST stale",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/api/admin/access/roles/test_scoped", admin, {
              revision: 1,
              config: { ...teamRole, grants: { "execute.script": "all" } },
              enabled: true,
              reason: "TEST invalid",
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "Revocation invalidates existing sessions, preserves ownership and survives reinitialization",
      async () => {
        const before = (
          await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [
            "test-access-owned",
          ])
        ).rows[0].profile;
        assert.equal(
          (
            await request("/api/admin/access/roles/test_scoped", admin, {
              revision: 1,
              config: teamRole,
              enabled: false,
              reason: "TEST revoke",
            })
          ).status,
          200,
        );
        assert.equal(
          (await request("/api/crm/auth/me", userCookie)).status,
          401,
        );
        await initializeLocalAccounts();
        const updated = (await login("TESTScoped", "TEST-password-2026")).data
          .employee;
        assert.deepEqual(updated.permissions, []);
        assert.deepEqual(
          (
            await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [
              "test-access-owned",
            ])
          ).rows[0].profile,
          before,
        );
      },
    );
    await t.test(
      "Disable user retains ownership; reset password never appears in audit",
      async () => {
        const impact = await request(
          "/api/admin/access/users/" + userId + "/impact",
          admin,
        );
        assert.equal(impact.data.customerCount, 2);
        assert.equal(
          (
            await request("/api/admin/access/users/" + userId, admin, {
              revision: 1,
              displayName: "TEST original 名字",
              roles: ["test_scoped"],
              teams: ["sales"],
              active: false,
              reason: "TEST disable",
            })
          ).status,
          200,
        );
        assert.equal(
          (await login("TESTScoped", "TEST-password-2026")).status,
          401,
        );
        assert.equal(
          (
            await request(
              "/api/admin/access/users/" + userId + "/password",
              admin,
              {
                revision: 2,
                temporaryPassword: "TEST-new-password",
                reason: "TEST reset",
              },
            )
          ).status,
          200,
        );
        const audit = await request("/api/admin/access/audit", admin);
        assert.doesNotMatch(
          JSON.stringify(audit.data),
          /TEST-new-password|TEST-password-2026|password_hash/,
        );
      },
    );
    await t.test(
      "Last administrator protection rolls back user and role changes",
      async () => {
        const self = (
          await request("/api/admin/access", admin)
        ).data.users.find((u: any) => u.id === "Robert");
        assert.equal(
          (
            await request("/api/admin/access/users/Robert", admin, {
              ...self,
              active: false,
              reason: "TEST last admin",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/api/admin/access/roles/access_admin", admin, {
              revision: 1,
              config: builtInRoles.access_admin,
              enabled: false,
              reason: "TEST last admin role",
            })
          ).status,
          409,
        );
        assert.equal((await request("/api/crm/auth/me", admin)).status, 200);
      },
    );

    await t.test(
      "Email and Login ID authenticate the same account; aliases cannot bypass limits or overlap",
      async () => {
        await pool.query("TRUNCATE crm_login_limits");
        const created = await request("/api/admin/access/users", admin, {
          loginId: "TESTEmailAlias",
          displayName: "TEST Email Alias",
          roles: ["sales"],
          email: " TEST.Alias@Example.Invalid ",
          temporaryPassword: "TEST-email-password",
          reason: "TEST email login",
        });
        assert.equal(created.status, 200);
        const u = created.data.user;
        assert.equal(u.email, "test.alias@example.invalid");
        const original = (
          await pool.query("SELECT * FROM crm_users WHERE id=:p1", [u.id])
        ).rows[0];
        const byId = await login("TESTEmailAlias", "TEST-email-password");
        const byEmail = await login(
          "TEST.ALIAS@EXAMPLE.INVALID",
          "TEST-email-password",
        );
        assert.equal(byId.status, 200);
        assert.equal(byEmail.status, 200);
        assert.equal(byId.data.employee.id, byEmail.data.employee.id);
        assert.deepEqual(
          byId.data.employee.permissions,
          byEmail.data.employee.permissions,
        );
        assert.equal(
          (
            await request("/api/admin/access/users", admin, {
              loginId: "TESTDuplicateAlias",
              displayName: "TEST Duplicate",
              roles: [],
              email: "TEST.ALIAS@example.invalid",
              temporaryPassword: "TEST-email-password",
              reason: "TEST duplicate alias",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/api/admin/access/users/" + u.id, admin, {
              ...u,
              email: "not an email",
              reason: "TEST invalid alias",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("/api/admin/access/users/" + u.id, byId.cookie, {
              ...u,
              email: "other@example.invalid",
              reason: "TEST forbidden",
            })
          ).status,
          403,
        );
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await login(
                i % 2 ? "TESTEmailAlias" : "test.alias@example.invalid",
                "wrong",
              )
            ).status,
            401,
          );
        assert.equal(
          (await login("TESTEmailAlias", "TEST-email-password")).status,
          429,
        );
        await pool.query("TRUNCATE crm_login_limits");
        assert.equal(
          (
            await request("/api/admin/access/users/" + u.id, admin, {
              ...u,
              email: "replacement@example.invalid",
              reason: "TEST change alias",
            })
          ).status,
          200,
        );
        assert.equal(
          (await request("/api/crm/auth/me", byEmail.cookie)).status,
          401,
        );
        assert.equal(
          (await login("test.alias@example.invalid", "TEST-email-password"))
            .status,
          401,
        );
        assert.equal(
          (await login("replacement@example.invalid", "TEST-email-password"))
            .status,
          200,
        );
        const current = (
          await request("/api/admin/access", admin)
        ).data.users.find((v: any) => v.id === u.id);
        assert.equal(
          (
            await request("/api/admin/access/users/" + u.id, admin, {
              ...current,
              active: false,
              reason: "TEST disable alias",
            })
          ).status,
          200,
        );
        assert.equal(
          (await login("replacement@example.invalid", "TEST-email-password"))
            .status,
          401,
        );
        assert.equal(
          (await login("TESTEmailAlias", "TEST-email-password")).status,
          401,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT password_hash FROM crm_users WHERE id=:p1",
              [u.id],
            )
          ).rows[0].password_hash,
          original.password_hash,
        );
      },
    );

    await t.test(
      "Retired notification scopes require explicit review; no silent broadening or historical replay",
      async () => {
        const { defaults } = await import("../server/portal/policy.ts");
        const config = { ...defaults, requiresRoutingReview: true };
        await pool.query(
          "INSERT INTO notification_rules(id,version,config,enabled) VALUES(:p1,1,:p2,false)",
          ["TEST-review", config],
        );
        const before = (await pool.query("SELECT * FROM notification_jobs"))
          .rows;
        assert.equal((await request('/api/crm/notification-rules/TEST-review',admin,{config:{...config,requiresRoutingReview:false},enabled:false})).status,200);
        assert.equal((await pool.query("SELECT config FROM notification_rules WHERE id='TEST-review'")).rows[0].config.requiresRoutingReview,true);

        assert.equal(
          (
            await request("/api/crm/notification-rules/TEST-review", admin, {
              config: { ...config, requiresRoutingReview: false },
              enabled: true,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/api/crm/notification-rules/TEST-review", admin, {
              config: { ...config, teams: ["old"] },
              enabled: true,
              confirmRoutingReset: true,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("/api/crm/notification-rules/TEST-review", admin, {
              config,
              enabled: true,
              confirmRoutingReset: true,
            })
          ).status,
          200,
        );
        const saved = (
          await pool.query(
            "SELECT * FROM notification_rules WHERE id='TEST-review'",
          )
        ).rows[0];
        assert.equal(!!saved.enabled, true);
        assert.equal(saved.config.requiresRoutingReview, undefined);
        assert.equal(saved.config.team, undefined);
        assert.deepEqual(
          (await pool.query("SELECT * FROM notification_jobs")).rows,
          before,
        );
      },
    );
    await t.test(
      "Removing CMS role does not recreate the permission on startup",
      async () => {
        const self = (
          await request("/api/admin/access", admin)
        ).data.users.find((u: any) => u.id === "Robert");
        assert.equal(
          (
            await request("/api/admin/access/users/Robert", admin, {
              ...self,
              roles: self.roles.filter((r: string) => r !== "cms_admin"),
              reason: "TEST remove CMS",
            })
          ).status,
          200,
        );
        await initializeLocalAccounts();
        admin = (await login("Robert")).cookie;
        const me = (await request("/api/crm/auth/me", admin)).data.employee;
        assert.equal(me.permissions.includes("cms.manage"), false);
        assert.equal(me.permissions.includes("access.roles"), true);
      },
    );
  });
}
