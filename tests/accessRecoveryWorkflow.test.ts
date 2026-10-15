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
import { sealRecoveryAuthorization } from "../server/portal/recoveryAuthorization.ts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHooks } from "node:module";
const cssHook = registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith(".css")
      ? { format: "module", source: "export default {}", shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { AccessRecoveryPreparation } =
  await import("../src/components/AccessRecoveryPreparation");
cssHook.deregister();
for (const [lang, prompt] of [
  ["en", "Select a recovery account"],
  ["id", "Pilih akun pemulihan"],
  ["zh", "请选择恢复账号"],
] as const)
  test("Recovery preparation distinguishes no selection from an invalid account in " + lang, () => {
    const html = renderToStaticMarkup(
      React.createElement(AccessRecoveryPreparation, {
        actor: "TEST",
        lang,
        isLight: true,
      }),
    );
    assert.ok(html.includes(prompt));
    assert.doesNotMatch(html, /Unavailable option|选项已失效/);
  });
for (const lang of ["en", "id", "zh"] as const)
  test(
    "Restore gate exposes result query without authorization issuance form in " +
      lang,
    () => {
      const html = renderToStaticMarkup(
        React.createElement(AccessRecoveryPreparation, {
          actor: "TEST",
          lang,
          isLight: true,
          queryOnly: true,
        }),
      );
      assert.match(
        html,
        /Check recovery result|Periksa hasil pemulihan|查询恢复结果/,
      );
      assert.doesNotMatch(
        html,
        /Prepare one-hour recovery authorization|Siapkan izin pemulihan satu jam|生成一小时有效恢复授权|uper-recovery-authorization.json/,
      );
    },
  );
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("recovery_workflow");
  process.env.PLATFORM_MODE = "local";
  process.env.PORTAL_FAULT_TEST = "true";
  const { pool } = await import("../server/portal/store.ts"),
    { mountPortal } = await import("../server/portal/runtime.ts"),
    { configureAccessTransport } =
      await import("../server/portal/accessTransport.ts");
  const recovery = await import("../cloud/mysql/access-recovery.mjs"),
    { openTrialDatabase } = await import("../cloud/mysql/database.mjs");
  const app = express();
  configureAccessTransport(app);
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port,
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "uper-recovery-workflow-"));
  const client = (origin = base) => {
    let cookie = "";
    return {
      async call(route: string, body?: any) {
        const r = await fetch(origin + route, {
          method: body ? "POST" : "GET",
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            cookie,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (r.headers.get("set-cookie"))
          cookie = r.headers.get("set-cookie")!.split(";")[0];
        return { status: r.status, data: await r.json() };
      },
      async login(id: string, password = id) {
        return this.call("/api/crm/auth/login", { loginId: id, password });
      },
    };
  };
  const admin = client(),
    sales = client();
  await admin.login("Robert");
  await sales.login("Fadhil");
  const op = (b: any) => ({ ...b, operationId: crypto.randomUUID() });
  const authorize = async (userId = "Ethan", changes: any = {}) => {
    const body = op({
        userId,
        reason: "TEST explicit maintenance approval",
        enableAccount: false,
        restoreSystemAccess: false,
        ...changes,
      }),
      r = await admin.call("/api/admin/access/recovery/authorize", body);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const file = path.join(dir, body.operationId + ".authorization.json");
    await fs.writeFile(file, JSON.stringify(r.data.authorization), {
      mode: 0o600,
    });
    return {
      file,
      body,
      envelope: r.data.authorization,
      input: {
        userId,
        reason: "TEST offline host maintenance",
        enable: body.enableAccount,
        authorizationFile: file,
        recordFile: path.join(dir, body.operationId + ".record.json"),
      },
    };
  };
  await test("Authorized administrator recovery and restore release on independent MySQL", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
      await fs.rm(dir, { recursive: true, force: true });
    });
    await t.test(
      "Ethan becomes the second administrator without changing existing business roles or credentials",
      async () => {
        const before = (
            await pool.query("SELECT * FROM crm_users WHERE id='Ethan'")
          ).rows[0],
          u = (await admin.call("/api/admin/access")).data.users.find(
            (u: any) => u.id === "Ethan",
          );
        const r = await admin.call(
          "/api/admin/access/users/Ethan",
          op({
            ...u,
            roles: [...u.roles, "access_admin"],
            reason: "TEST user-approved second administrator Ethan",
          }),
        );
        assert.equal(r.status, 200);
        const after = (
          await pool.query("SELECT * FROM crm_users WHERE id='Ethan'")
        ).rows[0];
        assert.equal(after.password_hash, before.password_hash);
        assert.deepEqual(
          after.roles.filter((r: string) => r !== "access_admin"),
          before.roles,
        );
        const info = await admin.call("/api/admin/access/recovery");
        assert.deepEqual(
          info.data.administrators.map((x: any) => x.id).sort(),
          ["Ethan", "Robert"],
        );
        const e = client();
        await e.login("Ethan");
        assert.equal((await e.call("/api/admin/access")).status, 200);
        assert.equal(
          (
            await sales.call(
              "/api/admin/access/recovery/authorize",
              op({
                userId: "Ethan",
                reason: "TEST denied",
                enableAccount: false,
                restoreSystemAccess: true,
              }),
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "approval is idempotent, specific and contains no password or signing key in receipts",
      async () => {
        const a = await authorize();
        const again = await admin.call(
          "/api/admin/access/recovery/authorize",
          a.body,
        );
        assert.deepEqual(again.data.authorization, a.envelope);
        assert.equal(
          (
            await admin.call("/api/admin/access/recovery/authorize", {
              ...a.body,
              enableAccount: true,
            })
          ).status,
          409,
        );
        const receipt = await admin.call(
          "/api/crm/auth/operations/" + a.body.operationId,
        );
        assert.equal(receipt.data.state, "committed");
        assert.equal(
          JSON.stringify(receipt.data).includes(a.envelope.signature),
          false,
        );
        assert.equal(
          JSON.stringify(receipt.data).includes(
            process.env.ACCESS_OPERATION_KEY!,
          ),
          false,
        );
        const preview = await recovery.recoveryPreview(process.env, a.input);
        assert.equal(preview.preview.approvedBy, "Robert");
        assert.equal(preview.preview.addsSystemAccess, false);
      },
    );
    await t.test(
      "missing, tampered, expired, public and wrong-target authorizations fail closed",
      async () => {
        const a = await authorize();
        await assert.rejects(
          recovery.recoveryPreview(process.env, {
            ...a.input,
            authorizationFile: undefined,
          }),
          /authorization file/,
        );
        const tampered = structuredClone(a.envelope);
        tampered.payload.userId = "Fadhil";
        const f = path.join(dir, "tampered.json");
        await fs.writeFile(f, JSON.stringify(tampered), { mode: 0o600 });
        await assert.rejects(
          recovery.recoveryPreview(process.env, {
            ...a.input,
            authorizationFile: f,
          }),
          /authorization_invalid/,
        );
        await fs.chmod(a.file, 0o644);
        await assert.rejects(
          recovery.recoveryPreview(process.env, a.input),
          /0600/,
        );
        await fs.chmod(a.file, 0o600);
        const expired = sealRecoveryAuthorization(process.env, {
          ...a.envelope.payload,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        });
        await fs.writeFile(f, JSON.stringify(expired));
        await assert.rejects(
          recovery.recoveryPreview(process.env, {
            ...a.input,
            authorizationFile: f,
          }),
          /expired/,
        );
        const target = sealRecoveryAuthorization(process.env, {
          ...a.envelope.payload,
          target: {
            ...a.envelope.payload.target,
            database: "uper_trial_other",
          },
        });
        await fs.writeFile(f, JSON.stringify(target));
        await assert.rejects(
          recovery.recoveryPreview(process.env, {
            ...a.input,
            authorizationFile: f,
          }),
          /authorization_invalid/,
        );
        await assert.rejects(
          recovery.recoveryPreview({ ...process.env, PORT: "3000" }, a.input),
          /restricted/,
        );
      },
    );
    await t.test(
      "real maintenance needs an explicit stopped-services confirmation and refuses a listening app",
      async () => {
        const a = await authorize(),
          env = {
            ...process.env,
            TRIAL_DATASET: "local-crm",
            PORTAL_LOCAL_CUTOVER: "true",
            ACCESS_RECOVERY_MAINTENANCE: "true",
            PORT: String((server.address() as any).port),
          };
        await assert.rejects(
          recovery.recoverAdministrator(
            env,
            a.input,
            "TEST-guard-password-2026",
          ),
          /stopped/,
        );
        await assert.rejects(
          recovery.recoverAdministrator(
            env,
            { ...a.input, servicesStopped: true },
            "TEST-guard-password-2026",
          ),
          /still listening/,
        );
      },
    );
    await t.test(
      "a stale exact-state preview cannot reset a concurrently edited account",
      async () => {
        const a = await authorize(),
          pre = await recovery.recoveryPreview(process.env, a.input),
          u = (await admin.call("/api/admin/access")).data.users.find(
            (u: any) => u.id === "Ethan",
          );
        await admin.call(
          "/api/admin/access/users/Ethan",
          op({
            ...u,
            displayName: "TEST Ethan",
            reason: "TEST concurrent editor",
          }),
        );
        await assert.rejects(
          recovery.recoverAdministrator(
            process.env,
            { ...a.input, confirmation: pre.confirmation },
            "TEST-stale-password-2026",
          ),
          /confirmation/,
        );
        assert.equal(
          (await recovery.queryRecoveryResult(process.env, a.body.operationId))
            .state,
          "unconfirmed",
        );
      },
    );
    await t.test(
      "system privileges and reactivation each require their explicit approved scope",
      async () => {
        const a = await authorize("Fadhil");
        await assert.rejects(
          recovery.recoveryPreview(process.env, a.input),
          /not authorized/,
        );
        await assert.rejects(
          recovery.recoveryPreview(process.env, { ...a.input, enable: true }),
          /scope mismatch/,
        );
      },
    );
    await t.test(
      "closing an uncommitted recovery prevents delayed execution",
      async () => {
        const a = await authorize(),
          pre = await recovery.recoveryPreview(process.env, a.input);
        assert.equal(
          (await recovery.closeRecoveryOperation(process.env, a.input)).state,
          "cancelled",
        );
        await assert.rejects(
          recovery.recoverAdministrator(
            process.env,
            { ...a.input, confirmation: pre.confirmation },
            "TEST-recovery-password-2026",
          ),
          /cancelled/,
        );
        assert.equal(
          (await recovery.queryRecoveryResult(process.env, a.body.operationId))
            .state,
          "cancelled",
        );
      },
    );
    let committedId = "";
    await t.test(
      "ten concurrent retries reset once and return one durable receipt",
      async () => {
        const a = await authorize(),
          pre = await recovery.recoveryPreview(process.env, a.input),
          input = { ...a.input, confirmation: pre.confirmation };
        committedId = a.body.operationId;
        const replies = await Promise.all(
          Array.from({ length: 10 }, () =>
            recovery.recoverAdministrator(
              process.env,
              input,
              "TEST-Ethan-recovered-password",
            ),
          ),
        );
        assert.equal(replies.filter((r: any) => !r.replayed).length, 1);
        const audits = (
          await pool.query(
            "SELECT * FROM portal_audit WHERE action='access.recovery'",
          )
        ).rows.filter((r: any) => r.data.id === committedId);
        assert.equal(audits.length, 1);
        assert.equal(
          (await recovery.queryRecoveryResult(process.env, committedId)).state,
          "committed",
        );
        await assert.rejects(
          recovery.recoverAdministrator(
            process.env,
            input,
            "TEST-different-password-2026",
          ),
          /conflict/,
        );
        const e = client();
        assert.equal(
          (await e.login("Ethan", "TEST-Ethan-recovered-password")).status,
          200,
        );
      },
    );
    await t.test(
      "record write failure rolls back; post-commit response failure is queryable and never resets twice",
      async () => {
        const a = await authorize(),
          pre = await recovery.recoveryPreview(process.env, a.input),
          input = { ...a.input, confirmation: pre.confirmation };
        const before = (
          await pool.query(
            "SELECT password_hash FROM crm_users WHERE id='Ethan'",
          )
        ).rows[0].password_hash;
        await assert.rejects(
          recovery.recoverAdministrator(
            process.env,
            { ...input, recordFile: path.join(dir, "missing", "record.json") },
            "TEST-Ethan-new-password-2026",
          ),
        );
        assert.equal(
          (
            await pool.query(
              "SELECT password_hash FROM crm_users WHERE id='Ethan'",
            )
          ).rows[0].password_hash,
          before,
        );
        assert.equal(
          (await recovery.queryRecoveryResult(process.env, a.body.operationId))
            .state,
          "unconfirmed",
        );
        await assert.rejects(
          recovery.recoverAdministrator(
            { ...process.env, ACCESS_RECOVERY_FAULT_AFTER_COMMIT: "true" },
            input,
            "TEST-Ethan-new-password-2026",
          ),
          /after commit/,
        );
        assert.equal(
          JSON.parse(await fs.readFile(input.recordFile, "utf8")).state,
          "prepared",
        );
        assert.equal(
          (await recovery.queryRecoveryResult(process.env, a.body.operationId))
            .state,
          "committed",
        );
        await recovery.reconcileRecoveryRecord(
          process.env,
          a.body.operationId,
          input.recordFile,
        );
        assert.equal(
          JSON.parse(await fs.readFile(input.recordFile, "utf8")).state,
          "committed",
        );
        assert.equal(
          (await recovery.closeRecoveryOperation(process.env, a.input)).state,
          "committed",
        );
        assert.equal(
          (
            await recovery.recoverAdministrator(
              process.env,
              input,
              "TEST-Ethan-new-password-2026",
            )
          ).replayed,
          true,
        );
        assert.doesNotMatch(
          await fs.readFile(input.recordFile, "utf8"),
          /TEST-Ethan-new-password|password_hash/,
        );
      },
    );
    await t.test(
      "restored database release requires fresh account snapshots and two admins; held history never replays",
      async () => {
        await pool.query(
          "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
          [
            "TEST-recovery-lead",
            {
              name: "TEST Recovery Learner",
              owner: "Ethan",
              tier: "Warm",
              currentStage: "New",
              notes: "TEST 原文 tetap unchanged",
            },
          ],
        );
        await pool.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,'consultation','Ethan',:p3)",
          ["TEST-recovery-task", "TEST-recovery-lead", "2025-01-01T00:00:00Z"],
        );
        await pool.query(
          "INSERT INTO outbox(id,type,lead_id,payload) VALUES('TEST-recovery-event','lead.created','TEST-recovery-lead',:p1)",
          [{ source: "standalone_chat" }],
        );
        for (const [id, state] of [
          ["TEST-history-pending", "pending"],
          ["TEST-history-failed", "failed"],
          ["TEST-history-unknown", "unknown"],
        ])
          await pool.query(
            "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot) VALUES(:p1,'TEST-recovery-event',:p1,1,'lark','TEST-simulation',:p2,:p3,:p4)",
            [id, state, "2025-01-01T00:00:00Z", { mode: "simulation" }],
          );
        const { backup, restore } = await import("../cloud/mysql/backup.mjs"),
          target = await fixture.createRestore(),
          dump = path.join(dir, "backup.sql"),
          saved = await backup(process.env, dump);
        await restore(target, dump, saved.sha256);
        const db = await openTrialDatabase(target),
          a = await authorize("Ethan", {
            targetDatabase: new URL(target.MYSQL_TRIAL_URL).pathname.slice(1),
            backupSha256: saved.sha256,
          }),
          env = {
            ...target,
            PORT: "4474",
            PLATFORM_MODE: "local",
            PORTAL_WORKER_ENABLED: "true",
            PORTAL_NOTIFICATION_MODE: "simulation",
            TRIAL_FRONTEND_DIRECTORY: "",
            OPENAI_API_KEY: "",
            DEEPSEEK_API_KEY: "",
            LARK_GROUP_CRM: "",
          };
        assert.equal(
          (await recovery.queryRecoveryResult(env, committedId)).state,
          "historical",
        );
        const before = {
          leads: (await db.query("SELECT * FROM portal_leads"))[0],
          tasks: (await db.query("SELECT * FROM followup_tasks"))[0],
          jobs: (
            await db.query("SELECT * FROM notification_jobs ORDER BY id")
          )[0],
          holds: (
            await db.query(
              "SELECT * FROM notification_migration_holds ORDER BY kind,id",
            )
          )[0],
        };
        const pre = await recovery.recoveryPreview(env, a.input);
        await recovery.recoverAdministrator(
          env,
          { ...a.input, confirmation: pre.confirmation },
          "TEST-restored-Ethan-password",
        );
        const reserve = net.createServer();
        reserve.listen(0, "127.0.0.1");
        await new Promise<void>((r) => reserve.on("listening", r));
        env.PORT = String((reserve.address() as any).port);
        await new Promise<void>((r) => reserve.close(() => r()));
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "server.ts"],
          { env: env as any, stdio: ["ignore", "ignore", "pipe"] },
        );
        let errors = "";
        child.stderr.on("data", (x) => (errors += x));
        const api = client("http://127.0.0.1:" + env.PORT);
        try {
          let ready = false;
          for (let i = 0; i < 80; i++) {
            try {
              await api.call("/api/crm/auth/me");
              ready = true;
              break;
            } catch {
              await new Promise((r) => setTimeout(r, 80));
            }
          }
          assert.ok(ready, errors);
          assert.equal((await api.login("Robert")).status, 423);
          assert.equal(
            (await api.login("Ethan", "TEST-restored-Ethan-password")).status,
            200,
          );
          assert.equal((await api.call("/api/crm/leads")).status, 423);
          const state = (await api.call("/api/admin/access/restore")).data,
            users = (await api.call("/api/admin/access")).data.users;
          assert.equal(
            (
              await api.call(
                "/api/admin/access/restore/release",
                op({ restoreId: state.restoreId, reason: "TEST premature" }),
              )
            ).status,
            409,
          );
          const wrong = await api.call(
            "/api/admin/access/restore/review",
            op({
              restoreId: state.restoreId,
              userId: "Ethan",
              authorizationStamp: "stale",
              confirmAuthorization: true,
              reason: "TEST old screen",
            }),
          );
          assert.equal(wrong.data.error, "access_restore_stale");
          for (const u of users) {
            if (u.active && u.id !== "Ethan")
              assert.equal(
                (
                  await api.call(
                    "/api/admin/access/users/" + u.id + "/password",
                    op({
                      revision: u.revision,
                      temporaryPassword: "TEST-reviewed-password-2026",
                      reason: "TEST credentials",
                    }),
                  )
                ).status,
                200,
              );
            assert.equal(
              (
                await api.call(
                  "/api/admin/access/restore/review",
                  op({
                    restoreId: state.restoreId,
                    userId: u.id,
                    authorizationStamp: state.users.find(
                      (x: any) => x.id === u.id,
                    ).authorizationStamp,
                    confirmAuthorization: true,
                    reason: "TEST independent account authorization review",
                  }),
                )
              ).status,
              200,
            );
          }
          // Even reviewed accounts cannot release with only one complete administrator.
          const robert = (await api.call("/api/admin/access")).data.users.find(
            (u: any) => u.id === "Robert",
          );
          assert.equal(
            (
              await api.call(
                "/api/admin/access/users/Robert",
                op({
                  ...robert,
                  roles: robert.roles.filter(
                    (r: string) => r !== "access_admin",
                  ),
                  reason: "TEST second-admin gate",
                }),
              )
            ).status,
            200,
          );
          let current = (await api.call("/api/admin/access/restore")).data;
          assert.equal(
            (
              await api.call(
                "/api/admin/access/restore/review",
                op({
                  restoreId: state.restoreId,
                  userId: "Robert",
                  authorizationStamp: current.users.find(
                    (u: any) => u.id === "Robert",
                  ).authorizationStamp,
                  confirmAuthorization: true,
                  reason: "TEST changed role confirmed",
                }),
              )
            ).status,
            200,
          );
          const refused = await api.call(
            "/api/admin/access/restore/release",
            op({
              restoreId: state.restoreId,
              reason: "TEST cannot release one admin",
            }),
          );
          assert.equal(refused.data.error, "access_restore_two_administrators");
          let r = (await api.call("/api/admin/access")).data.users.find(
            (u: any) => u.id === "Robert",
          );
          await api.call(
            "/api/admin/access/users/Robert",
            op({
              ...r,
              roles: [...r.roles, "access_admin"],
              reason: "TEST restore original administrator",
            }),
          );
          current = (await api.call("/api/admin/access/restore")).data;
          await api.call(
            "/api/admin/access/restore/review",
            op({
              restoreId: state.restoreId,
              userId: "Robert",
              authorizationStamp: current.users.find(
                (u: any) => u.id === "Robert",
              ).authorizationStamp,
              confirmAuthorization: true,
              reason: "TEST refreshed authorization",
            }),
          );
          const released = await api.call(
            "/api/admin/access/restore/release",
            op({
              restoreId: state.restoreId,
              reason: "TEST complete security review",
            }),
          );
          assert.equal(released.status, 200, JSON.stringify(released.data));
          assert.equal((await api.call("/api/crm/auth/me")).status, 401);
          await api.login("Ethan", "TEST-restored-Ethan-password");
          assert.equal((await api.call("/api/crm/leads")).status, 200);
          await new Promise((r) => setTimeout(r, 1400));
          assert.deepEqual(
            (await db.query("SELECT * FROM portal_leads"))[0],
            before.leads,
          );
          assert.deepEqual(
            (await db.query("SELECT * FROM followup_tasks"))[0],
            before.tasks,
          );
          assert.deepEqual(
            (
              await db.query("SELECT * FROM notification_jobs ORDER BY id")
            )[0].filter((r: any) => r.id.startsWith("TEST-history")),
            before.jobs,
          );
          assert.deepEqual(
            (
              await db.query(
                "SELECT * FROM notification_migration_holds ORDER BY kind,id",
              )
            )[0],
            before.holds,
          );
          const nextId = crypto.randomUUID(),
            nextGrant = await api.call("/api/admin/access/recovery/authorize", {
              userId: "Ethan",
              operationId: nextId,
              reason: "TEST normal recovery after release",
              enableAccount: false,
              restoreSystemAccess: false,
            });
          assert.equal(nextGrant.status, 200);
          const nextFile = path.join(dir, "after-release.authorization.json");
          await fs.writeFile(
            nextFile,
            JSON.stringify(nextGrant.data.authorization),
            { mode: 0o600 },
          );
          const nextInput = {
            userId: "Ethan",
            enable: false,
            reason: "TEST subsequent normal recovery",
            authorizationFile: nextFile,
            recordFile: path.join(dir, "after-release.record.json"),
          };
          const nextPreview = await recovery.recoveryPreview(env, nextInput);
          assert.equal(nextPreview.preview.restoreId, state.restoreId);
          await recovery.recoverAdministrator(
            env,
            { ...nextInput, confirmation: nextPreview.confirmation },
            "TEST-postrelease-Ethan-password",
          );
          assert.equal(
            (await recovery.queryRecoveryResult(env, nextId)).state,
            "committed",
          );
          // An unplanned outage must not depend on a still-logged-in administrator or an unexpired pre-issued grant.
          const checkpointFile = path.join(
              dir,
              "trusted-current-checkpoint.json",
            ),
            checkpoint = await recovery.securityCheckpoint(env, checkpointFile);
          const lostSalt = crypto.randomBytes(16).toString("hex"),
            lostHash =
              lostSalt +
              ":" +
              crypto
                .scryptSync(crypto.randomBytes(32), lostSalt, 64)
                .toString("hex");
          await db.execute(
            "UPDATE crm_users SET password_hash=? WHERE id IN ('Robert','Ethan')",
            [lostHash],
          );
          await db.execute("DELETE FROM crm_sessions");
          assert.equal(
            (await api.login("Robert", "TEST-reviewed-password-2026")).status,
            401,
          );
          assert.equal(
            (await api.login("Ethan", "TEST-postrelease-Ethan-password"))
              .status,
            401,
          );
          const emergency = {
            authorizationId: crypto.randomUUID(),
            userId: "Ethan",
            approvedBy: "TEST incident owner",
            approvalReference: "TEST-INCIDENT-2026-01",
            reason: "TEST all administrators unavailable",
            enable: false,
            restoreSystemAccess: false,
            checkpointFile,
            checkpointSha256: checkpoint.sha256,
            authorizationFile: path.join(dir, "emergency.authorization.json"),
          };
          await assert.rejects(
            recovery.emergencyAuthorizationPreview(env, {
              ...emergency,
              checkpointSha256: "0".repeat(64),
            }),
            /checksum/,
          );
          await assert.rejects(
            recovery.emergencyAuthorizationPreview(env, {
              ...emergency,
              userId: "Fadhil",
            }),
            /complete administrator/,
          );
          const emergencyPreview = await recovery.emergencyAuthorizationPreview(
            env,
            emergency,
          );
          await assert.rejects(
            recovery.prepareEmergencyAuthorization(env, {
              ...emergency,
              confirmation: "stale",
            }),
            /confirmation/,
          );
          const badOutput = {
            ...emergency,
            authorizationFile: path.join(dir, "missing-dir", "emergency.json"),
            confirmation: emergencyPreview.confirmation,
          };
          await assert.rejects(
            recovery.prepareEmergencyAuthorization(env, badOutput),
          );
          assert.equal(
            (
              await recovery.queryEmergencyAuthorization(
                env,
                emergency.authorizationId,
              )
            ).state,
            "authorized",
          );
          await recovery.prepareEmergencyAuthorization(env, {
            ...emergency,
            confirmation: emergencyPreview.confirmation,
          });
          const emergencyInput = {
              userId: "Ethan",
              enable: false,
              reason: "TEST incident owner approved recovery",
              authorizationFile: emergency.authorizationFile,
              recordFile: path.join(dir, "emergency.recovery.json"),
            },
            ep = await recovery.recoveryPreview(env, emergencyInput);
          await recovery.recoverAdministrator(
            env,
            { ...emergencyInput, confirmation: ep.confirmation },
            "TEST-emergency-Ethan-password",
          );
          assert.equal(
            (await recovery.queryRecoveryResult(env, emergency.authorizationId))
              .state,
            "committed",
          );
          assert.equal(
            (await api.login("Ethan", "TEST-emergency-Ethan-password")).status,
            200,
          );
          assert.equal((await api.call("/api/crm/leads")).status, 200);
          const currentRobert = (
            await api.call("/api/admin/access")
          ).data.users.find((u: any) => u.id === "Robert");
          assert.equal(
            (
              await api.call(
                "/api/admin/access/users/Robert/password",
                op({
                  revision: currentRobert.revision,
                  temporaryPassword: "TEST-second-admin-restores-Robert",
                  reason: "TEST Ethan restores Robert after incident",
                }),
              )
            ).status,
            200,
          );
          const recoveredRobert = client("http://127.0.0.1:" + env.PORT);
          assert.equal(
            (
              await recoveredRobert.login(
                "Robert",
                "TEST-second-admin-restores-Robert",
              )
            ).status,
            200,
          );
          assert.equal(
            (await recoveredRobert.call("/api/admin/access")).status,
            200,
          );
        } finally {
          child.kill("SIGTERM");
          await new Promise<void>((r) => child.once("exit", () => r()));
          await db.end();
        }
      },
    );
  });
}
