import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import express from "express";
import { setupNativeTest } from "./helpers/mysql.mjs";
import { configureAccessTransport } from "../server/portal/accessTransport.ts";
import {
  accessSafetyGuide,
  accessSafetyErrors,
} from "../src/utils/accessSafetyLanguage.ts";
for (const lang of [0, 1, 2])
  test("P0 guidance and errors are complete for language " + lang, () => {
    assert.equal(accessSafetyGuide.length, 6);
    for (const s of accessSafetyGuide) {
      assert.ok(s.title[lang]);
      assert.ok(s.body[lang].length > 80);
    }
    for (const v of Object.values(accessSafetyErrors)) assert.ok(v[lang]);
  });
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("access_p0");
  process.env.PLATFORM_MODE = "local";
  process.env.PORTAL_FAULT_TEST = "true";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const app = express();
  configureAccessTransport(app);
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const client = (origin = base) => {
    let cookie = "";
    return {
      async call(route: string, body?: any, headers: any = {}) {
        const r = await fetch(origin + route, {
          method: body ? "POST" : "GET",
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            cookie,
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (r.headers.get("set-cookie"))
          cookie = r.headers.get("set-cookie")!.split(";")[0];
        return { status: r.status, data: await r.json(), headers: r.headers };
      },
      async login(id: string, password = id) {
        return this.call("/api/crm/auth/login", { loginId: id, password });
      },
    };
  };
  const admin = client(),
    sales = client(),
    backup = client();
  await admin.login("Robert");
  await sales.login("Fadhil");
  const op = (body: any) => ({ ...body, operationId: crypto.randomUUID() });
  const privateDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "uper-access-p0-"),
  );
  const authorizeRecovery = async (
    input: any,
    env: any = process.env,
    backupSha256?: string,
  ) => {
    const operationId = crypto.randomUUID(),
      reply = await admin.call("/api/admin/access/recovery/authorize", {
        operationId,
        userId: input.userId,
        reason: input.reason,
        enableAccount: !!input.enable,
        restoreSystemAccess: true,
        targetDatabase: new URL(env.MYSQL_TRIAL_URL).pathname.slice(1),
        backupSha256,
      });
    assert.equal(reply.status, 200, JSON.stringify(reply.data));
    const file = path.join(privateDir, operationId + ".authorization.json");
    await fs.writeFile(file, JSON.stringify(reply.data.authorization), {
      mode: 0o600,
    });
    input.authorizationFile = file;
  };
  await test("Independent MySQL P0 security and management acceptance", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
      await fs.rm(privateDir, { recursive: true, force: true });
    });
    let person: any;
    await t.test(
      "same operation concurrently retried ten times creates one user and one audit; changed body and stale page fail",
      async () => {
        const body = op({
          loginId: "TEST_P0_User",
          displayName: "TEST P0 Learner Handler",
          email: "p0.user@example.invalid",
          roles: ["sales"],
          temporaryPassword: "TEST-strong-password-2026",
          reason: "TEST create once",
        });
        const replies = await Promise.all(
          Array.from({ length: 10 }, () =>
            admin.call("/api/admin/access/users", body),
          ),
        );
        assert.ok(
          replies.every((r) => r.status === 200),
          JSON.stringify(replies.map((r) => [r.status, r.data.error])),
        );
        person = replies[0].data.user;
        assert.ok(replies.every((r) => r.data.user.id === person.id));
        assert.equal(
          (
            await pool.query(
              "SELECT * FROM portal_audit WHERE action='access.user.create'",
            )
          ).rows.filter((r: any) => r.data.id === person.id).length,
          1,
        );
        assert.equal(
          (
            await admin.call("/api/admin/access/users", {
              ...body,
              displayName: "TEST altered",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await admin.call("/api/admin/access/users", {
              ...body,
              operationId: undefined,
            })
          ).status,
          400,
        );
        assert.equal(
          (await sales.call("/api/admin/access/users", op(body))).status,
          403,
        );
      },
    );
    await t.test(
      "post-commit lost response has durable receipt; unrelated actors denied; replay and transaction rollback are safe",
      async () => {
        const body = op({
          loginId: "TEST_Dropped",
          displayName: "TEST Lost response",
          roles: [],
          temporaryPassword: "TEST-dropped-password",
          reason: "TEST drop only response",
        });
        await assert.rejects(
          admin.call("/api/admin/access/users", body, {
            "x-test-access-fault": "after-commit",
          }),
        );
        const receipt = await admin.call(
          "/api/crm/auth/operations/" + body.operationId,
        );
        assert.equal(receipt.data.state, "committed");
        assert.equal(
          (
            await sales.call(
              "/api/crm/auth/operations/" + body.operationId + "?actor=Robert",
            )
          ).status,
          403,
        );
        const replay = await admin.call("/api/admin/access/users", body);
        assert.equal(replay.status, 200);
        assert.equal(replay.data.replayed, true);
        assert.doesNotMatch(
          JSON.stringify(receipt.data),
          /TEST-dropped-password|password_hash/,
        );
        const fail = await admin.call(
          "/api/admin/access/users/" + person.id,
          op({
            ...person,
            roles: ["missing-role"],
            reason: "TEST invalid transaction",
          }),
        );
        assert.equal(fail.status, 400);
        const fresh = (await admin.call("/api/admin/access")).data.users.find(
          (u: any) => u.id === person.id,
        );
        assert.equal(fresh.revision, 1);
        assert.deepEqual(fresh.roles, ["sales"]);
        const gateway = op({
          ...body,
          loginId: "TEST_Gateway",
          displayName: "TEST gateway failure",
        });
        const gatewayReply = await admin.call(
          "/api/admin/access/users",
          gateway,
          { "x-test-access-fault": "after-commit-http" },
        );
        assert.equal(gatewayReply.status, 503);
        assert.equal(
          (await admin.call("/api/crm/auth/operations/" + gateway.operationId))
            .data.state,
          "committed",
        );
        assert.equal(
          (await admin.call("/api/admin/access/users", gateway)).data.replayed,
          true,
        );
        process.env.PORTAL_FAULT_TEST = "false";
        try {
          assert.equal(
            (
              await admin.call(
                "/api/admin/access/users",
                op({ ...body, loginId: "TEST_NoFault" }),
                { "x-test-access-fault": "after-commit-http" },
              )
            ).status,
            200,
          );
        } finally {
          process.env.PORTAL_FAULT_TEST = "true";
        }
      },
    );
    await t.test(
      "closing an unresolved operation prevents delayed writes; committed results cannot be cancelled",
      async () => {
        const body = op({
          loginId: "TEST_Closed",
          displayName: "TEST closed operation",
          roles: [],
          temporaryPassword: "TEST-closed-password",
          reason: "TEST close before arrival",
        });
        const path = "/api/admin/access/users",
          closePath = "/api/crm/auth/operations/" + body.operationId + "/close";
        assert.equal(
          (
            await sales.call(closePath, {
              url: path,
              reason: "TEST no permission",
            })
          ).status,
          403,
        );
        const closes = await Promise.all(
          Array.from({ length: 10 }, () =>
            admin.call(closePath, {
              url: path,
              reason: "TEST lost draft replaced",
            }),
          ),
        );
        assert.ok(
          closes.every((r) => r.status === 200 && r.data.state === "cancelled"),
        );
        assert.equal(
          (await admin.call(path, body)).data.error,
          "access_operation_cancelled",
        );
        assert.equal(
          (await admin.call("/api/crm/auth/operations/" + body.operationId))
            .data.state,
          "cancelled",
        );
        assert.equal(
          (
            await pool.query("SELECT * FROM crm_users WHERE login_id=:p1", [
              "TEST_Closed",
            ])
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT * FROM portal_audit WHERE action='access.operation.closed'",
            )
          ).rows.filter((x: any) => x.data.operationId === body.operationId)
            .length,
          1,
        );
        const saved = await admin.call(
          path,
          op({ ...body, loginId: "TEST_Close_After" }),
        );
        assert.equal(saved.status, 200);
        const existing = await admin.call(
          "/api/crm/auth/operations/" + saved.data.operationId + "/close",
          { url: path, reason: "TEST already committed" },
        );
        assert.equal(existing.data.state, "committed");
        assert.equal(
          (
            await pool.query("SELECT * FROM crm_users WHERE id=:p1", [
              saved.data.user.id,
            ])
          ).rows.length,
          1,
        );
      },
    );
    await t.test(
      "password reset and self-change replay once, revoke old sessions, and keep passwords out of receipts",
      async () => {
        const user = client();
        assert.equal(
          (await user.login("TEST_P0_User", "TEST-strong-password-2026"))
            .status,
          200,
        );
        const body = op({
          revision: person.revision,
          temporaryPassword: "TEST-reset-password-2026",
          reason: "TEST reset once",
        });
        const replies = await Promise.all(
          Array.from({ length: 10 }, () =>
            admin.call(
              "/api/admin/access/users/" + person.id + "/password",
              body,
            ),
          ),
        );
        assert.ok(replies.every((r) => r.status === 200));
        assert.equal((await user.call("/api/crm/auth/me")).status, 401);
        const receipt = (
          await admin.call("/api/crm/auth/operations/" + body.operationId)
        ).data;
        assert.doesNotMatch(
          JSON.stringify(receipt),
          /TEST-reset-password-2026|password_hash/,
        );
        assert.equal(
          (await user.login("TEST_P0_User", "TEST-reset-password-2026")).status,
          200,
        );
        const self = op({
          currentPassword: "TEST-reset-password-2026",
          newPassword: "TEST-self-password-2026",
        });
        assert.equal(
          (await user.call("/api/crm/auth/password", self)).status,
          200,
        );
        assert.equal(
          (await user.call("/api/crm/auth/password", self)).data.replayed,
          true,
        );
        person = (await admin.call("/api/admin/access")).data.users.find(
          (u: any) => u.id === person.id,
        );
      },
    );
    await t.test(
      "failure after writes rolls back user, handover, audit and receipt atomically",
      async () => {
        const before = (await admin.call("/api/admin/access")).data.users.find(
          (u: any) => u.id === person.id,
        );
        const body = op({
          ...before,
          displayName: "TEST rolled back",
          reason: "TEST injected rollback",
        });
        assert.equal(
          (
            await admin.call("/api/admin/access/users/" + person.id, body, {
              "x-test-access-fault": "before-commit",
            })
          ).status,
          503,
        );
        assert.deepEqual(
          (await admin.call("/api/admin/access")).data.users.find(
            (u: any) => u.id === person.id,
          ),
          before,
        );
        assert.equal(
          (await admin.call("/api/crm/auth/operations/" + body.operationId))
            .data.state,
          "unconfirmed",
        );
      },
    );
    await t.test(
      "deactivation retains ownership and deadlines; partial handover selects exact tasks and preserves unrelated owners",
      async () => {
        for (const [id, owner] of [
          ["TEST-handover-a", person.id],
          ["TEST-handover-b", "Fadhil"],
        ])
          await pool.query(
            "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
            [
              id,
              {
                name: "TEST " + id,
                owner,
                currentStage: "New",
                tier: "Hot",
                original: "TEST original unchanged",
              },
            ],
          );
        for (const [id, lead, owner] of [
          ["TEST-task-a", "TEST-handover-a", person.id],
          ["TEST-task-b", "TEST-handover-b", person.id],
          ["TEST-task-other", "TEST-handover-a", "Wigar"],
        ])
          await pool.query(
            "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,:p5,:p3,:p4)",
            [
              id,
              lead,
              owner,
              "2027-01-12T04:00:00Z",
              id === "TEST-task-other" ? "booking" : "consultation",
            ],
          );
        const original = (
          await pool.query("SELECT * FROM followup_tasks ORDER BY id")
        ).rows;
        const userClient = client();
        assert.equal(
          (await userClient.login("TEST_P0_User", "TEST-self-password-2026"))
            .status,
          200,
        );
        assert.equal(
          (
            await admin.call(
              "/api/admin/access/users/" + person.id,
              op({
                ...person,
                active: false,
                reason: "TEST immediate disable",
              }),
            )
          ).status,
          200,
        );
        assert.equal((await userClient.call("/api/crm/auth/me")).status, 401);
        const cases = (await admin.call("/api/admin/access/handovers")).data;
        let h = cases.find((x: any) => x.userId === person.id);
        assert.equal(h.customerCount, 1);
        assert.equal(h.taskCount, 2);
        const backupBody = op({
          loginId: "TEST_BackupAdmin",
          displayName: "TEST Backup Admin",
          roles: ["access_admin"],
          temporaryPassword: "TEST-backup-password",
          reason: "TEST system-only role",
        });
        await admin.call("/api/admin/access/users", backupBody);
        await backup.login("TEST_BackupAdmin", "TEST-backup-password");
        const summary = (
          await backup.call("/api/admin/access/handovers")
        ).data.find((x: any) => x.id === h.id);
        assert.equal(summary.customerCount, 1);
        assert.deepEqual(summary.leads, []);
        assert.deepEqual(summary.tasks, []);
        assert.equal((await backup.call("/api/crm/leads")).status, 403);
        assert.equal(
          (
            await backup.call(
              "/api/crm/access-handovers/" + h.id,
              op({
                revision: h.revision,
                reason: "TEST forbidden",
                complete: true,
              }),
            )
          ).status,
          403,
        );
        const transfer = () => ({
          revision: h.revision,
          reason: "TEST selected transfer",
          targetId: "Wigar",
          leads: [{ id: h.leads[0].id, fingerprint: h.leads[0].fingerprint }],
          taskIds: ["TEST-task-a"],
          operationId: crypto.randomUUID(),
        });
        const bad = { ...transfer(), targetId: "Fenny" };
        assert.equal(
          (await admin.call("/api/crm/access-handovers/" + h.id, bad)).status,
          400,
        );
        const good = await admin.call(
          "/api/crm/access-handovers/" + h.id,
          transfer(),
        );
        assert.equal(good.status, 200);
        assert.equal(good.data.remainingTasks, 1);
        h = (await admin.call("/api/admin/access/handovers")).data.find(
          (x: any) => x.id === h.id,
        );
        assert.equal(
          (
            await admin.call(
              "/api/crm/access-handovers/" + h.id,
              op({
                revision: h.revision,
                reason: "TEST cannot close partial",
                complete: true,
              }),
            )
          ).status,
          409,
        );
        const stale = await admin.call(
          "/api/crm/access-handovers/" + h.id,
          op({
            revision: h.revision - 1,
            reason: "TEST stale",
            targetId: "Fadhil",
            leads: [],
            taskIds: ["TEST-task-b"],
          }),
        );
        assert.equal(stale.status, 409);
        assert.equal(
          (
            await admin.call(
              "/api/crm/access-handovers/" + h.id,
              op({
                revision: h.revision,
                reason: "TEST separate task",
                targetId: "Fadhil",
                leads: [],
                taskIds: ["TEST-task-b"],
              }),
            )
          ).status,
          200,
        );
        h = (await admin.call("/api/admin/access/handovers")).data.find(
          (x: any) => x.id === h.id,
        );
        assert.equal(
          (
            await admin.call(
              "/api/crm/access-handovers/" + h.id,
              op({
                revision: h.revision,
                reason: "TEST verified complete",
                complete: true,
              }),
            )
          ).status,
          200,
        );
        for (const prior of original) {
          const current = (
            await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
              prior.id,
            ])
          ).rows[0];
          assert.equal(+current.due_at, +prior.due_at);
          assert.equal(current.status, prior.status);
          if (prior.id === "TEST-task-other")
            assert.equal(current.owner_id, "Wigar");
        }
      },
    );
    await t.test(
      "parallel administrator removal retains a complete administrator and rejects stale authorization",
      async () => {
        let data = (await admin.call("/api/admin/access")).data;
        const a = data.users.find((u: any) => u.id === "Robert"),
          b = data.users.find((u: any) => u.loginId === "TEST_BackupAdmin");
        const replies = await Promise.all([
          admin.call(
            "/api/admin/access/users/" + a.id,
            op({
              ...a,
              roles: a.roles.filter((x: string) => x !== "access_admin"),
              reason: "TEST race A",
            }),
          ),
          backup.call(
            "/api/admin/access/users/" + b.id,
            op({ ...b, active: false, reason: "TEST race B" }),
          ),
        ]);
        assert.equal(replies.filter((r) => r.status === 200).length, 1);
        data = (
          await (replies[0].status === 200 ? backup : admin).call(
            "/api/admin/access",
          )
        ).data;
        assert.ok(
          data.users.some(
            (u: any) =>
              u.active &&
              [
                "access.read",
                "access.users",
                "access.roles",
                "access.sessions",
                "access.audit",
              ].every((p) => u.effective.permissions.includes(p)),
          ),
        );
        // Restore the fixture's Robert through the authorized survivor for later tests.
        if (replies[0].status === 200) {
          const current = data.users.find((u: any) => u.id === "Robert");
          await backup.call(
            "/api/admin/access/users/Robert",
            op({
              ...current,
              roles: [...current.roles, "access_admin"],
              reason: "TEST restore fixture admin",
            }),
          );
          await admin.login("Robert");
        }
      },
    );
    await t.test(
      "offline recovery is isolated, explicit, non-escalating and produces a private record; stale confirmations fail",
      async () => {
        const {
          recoveryPreview,
          recoverAdministrator,
          securityCheckpoint,
          compareCheckpoint,
        } = await import("../cloud/mysql/access-recovery.mjs");
        const input = {
          userId: person.id,
          reason: "TEST approved offline recovery",
          enable: true,
        };
        await authorizeRecovery(input);
        await assert.rejects(
          recoveryPreview({ ...process.env, PORT: "3000" }, input),
          /restricted/,
        );
        await assert.rejects(
          recoveryPreview(process.env, { ...input, enable: false }),
          /scope mismatch/,
        );
        await pool.query(
          "INSERT INTO crm_login_limits(`key`,failures) VALUES(:p1,5) ON DUPLICATE KEY UPDATE failures=5",
          [
            crypto
              .createHash("sha256")
              .update("account:" + person.id)
              .digest("hex"),
          ],
        );
        const preview = await recoveryPreview(process.env, input),
          file = path.join(privateDir, "recovery.json");
        await assert.rejects(
          recoverAdministrator(
            process.env,
            { ...input, confirmation: "wrong", recordFile: file },
            "TEST-new-recovery-password",
          ),
          /confirmation/,
        );
        const result = await recoverAdministrator(
          process.env,
          { ...input, confirmation: preview.confirmation, recordFile: file },
          "TEST-new-recovery-password",
        );
        assert.equal(result.userId, person.id);
        assert.equal((await fs.stat(file)).mode & 0o077, 0);
        assert.doesNotMatch(
          await fs.readFile(file, "utf8"),
          /TEST-new-recovery-password|password_hash/,
        );
        assert.equal(
          (
            await recoverAdministrator(
              process.env,
              {
                ...input,
                confirmation: preview.confirmation,
                recordFile: file,
              },
              "TEST-new-recovery-password",
            )
          ).replayed,
          true,
        );
        const account = client();
        assert.equal(
          (await account.login("TEST_P0_User", "TEST-new-recovery-password"))
            .status,
          200,
        );
        const me = (await account.call("/api/crm/auth/me")).data.employee;
        assert.ok(me.permissions.includes("access.roles"));
        assert.equal(me.permissions.includes("cms.manage"), false);
        assert.equal(me.permissions.includes("crm.export"), false);
        const checkpoint = path.join(privateDir, "checkpoint.json");
        await securityCheckpoint(process.env, checkpoint);
        assert.doesNotMatch(
          await fs.readFile(checkpoint, "utf8"),
          /password_hash|token_hash|TEST-new-recovery-password/,
        );
        assert.deepEqual(
          (await compareCheckpoint(process.env, checkpoint)).changedUsers,
          [],
        );
        await pool.query(
          "UPDATE crm_users SET access_revision=access_revision+1 WHERE id=:p1",
          [person.id],
        );
        assert.deepEqual(
          (await compareCheckpoint(process.env, checkpoint)).changedUsers,
          [person.id],
        );
        const tampered = JSON.parse(await fs.readFile(checkpoint, "utf8"));
        tampered.payload.users[0].active = false;
        await fs.writeFile(
          path.join(privateDir, "tampered.json"),
          JSON.stringify(tampered),
        );
        await assert.rejects(
          compareCheckpoint(
            process.env,
            path.join(privateDir, "tampered.json"),
          ),
          /checksum/,
        );
      },
    );
    await t.test(
      "restored backup blocks old credentials and business, removes sessions, holds notifications, and requires per-account approval",
      async () => {
        const { backup: dump, restore } =
          await import("../cloud/mysql/backup.mjs");
        const { recoveryPreview, recoverAdministrator } =
          await import("../cloud/mysql/access-recovery.mjs");
        const target = await fixture.createRestore(),
          file = path.join(privateDir, "restore.sql");
        const saved = await dump(process.env, file);
        await restore(target, file, saved.sha256);
        const { openTrialDatabase } =
          await import("../cloud/mysql/database.mjs");
        const targetDb = await openTrialDatabase(target);
        let child: any;
        try {
          assert.equal(
            (await targetDb.query("SELECT * FROM crm_sessions"))[0].length,
            0,
          );
          const restoreInfo = (
            await targetDb.query(
              "SELECT value FROM access_state WHERE id='restore_review'",
            )
          )[0][0].value;
          const reservation = net.createServer();
          reservation.listen(0, "127.0.0.1");
          await new Promise<void>((r) => reservation.on("listening", r));
          const restorePort = (reservation.address() as any).port;
          await new Promise<void>((r) => reservation.close(() => r()));
          const env = {
            ...target,
            PORT: String(restorePort),
            PORTAL_WORKER_ENABLED: "false",
            TRIAL_FRONTEND_DIRECTORY: "",
          };
          const input = {
            userId: "Robert",
            reason: "TEST restore recovery",
            enable: true,
          };
          await authorizeRecovery(input, env, saved.sha256);
          const pre = await recoveryPreview(env, input);
          await recoverAdministrator(
            env,
            {
              ...input,
              confirmation: pre.confirmation,
              recordFile: path.join(privateDir, "restore-admin.json"),
            },
            "TEST-restore-admin-password",
          );
          child = spawn(
            process.execPath,
            [
              "--import",
              "tsx",
              "-e",
              "import('./server/mysqlApplication.ts').then(m=>m.startMysqlApplication())",
            ],
            { env, stdio: ["ignore", "ignore", "pipe"] },
          );
          let logs = "";
          child.stderr.on("data", (x: any) => (logs += x));
          const restored = client("http://127.0.0.1:" + restorePort);
          let ready = false;
          for (let i = 0; i < 50; i++) {
            try {
              await restored.call("/api/crm/auth/me");
              ready = true;
              break;
            } catch {
              await new Promise((r) => setTimeout(r, 100));
            }
          }
          assert.ok(ready, logs);
          assert.equal((await restored.login("Fadhil")).status, 423);
          assert.equal(
            (await restored.login("Robert", "TEST-restore-admin-password"))
              .status,
            200,
          );
          assert.equal((await restored.call("/api/crm/leads")).status, 423);
          const state = (await restored.call("/api/admin/access/restore")).data;
          assert.equal(
            (
              await restored.call(
                "/api/admin/access/restore/release",
                op({
                  restoreId: restoreInfo.restoreId,
                  reason: "TEST premature",
                }),
              )
            ).status,
            409,
          );
          const users = (await restored.call("/api/admin/access")).data.users;
          for (const u of users) {
            if (u.active && u.id !== "Robert")
              assert.equal(
                (
                  await restored.call(
                    "/api/admin/access/users/" + u.id + "/password",
                    op({
                      revision: u.revision,
                      temporaryPassword: "TEST-reviewed-password-2026",
                      reason: "TEST fresh credential",
                    }),
                  )
                ).status,
                200,
              );
            const approved = await restored.call(
              "/api/admin/access/restore/review",
              op({
                restoreId: restoreInfo.restoreId,
                userId: u.id,
                confirmAuthorization: true,
                authorizationStamp: state.users.find((x: any) => x.id === u.id)
                  .authorizationStamp,
                reason: "TEST manual independent authorization review",
              }),
            );
            assert.equal(approved.status, 200, JSON.stringify(approved.data));
          }
          assert.equal(
            (
              await restored.call(
                "/api/admin/access/restore/release",
                op({
                  restoreId: restoreInfo.restoreId,
                  reason: "TEST complete release",
                }),
              )
            ).status,
            200,
          );
          assert.equal((await restored.call("/api/crm/auth/me")).status, 401);
          assert.equal(
            (await restored.login("Robert", "TEST-restore-admin-password"))
              .status,
            200,
          );
          assert.equal((await restored.call("/api/crm/leads")).status, 200);
          assert.equal((await restored.login("Fadhil")).status, 401);
          assert.equal(
            (await restored.login("Fadhil", "TEST-reviewed-password-2026"))
              .status,
            200,
          );
        } finally {
          if (child) {
            child.kill("SIGTERM");
            await new Promise<void>((r) => child.once("exit", () => r()));
          }
          await targetDb.end();
        }
      },
    );
  });
}
