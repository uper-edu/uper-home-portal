import { setupNativeTest } from "./helpers/mysql.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import crypto from "node:crypto";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("crmMessageTimePortal");
  process.env.PLATFORM_MODE = "mock";
  const { pool } = await import("../server/portal/store.ts");
  const { mountPortal } = await import("../server/portal/runtime.ts");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  await test("CRM list/detail preserve original message time and never expose placeholder as known time", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    await pool.query(
      "INSERT INTO portal_leads(id,profile) VALUES('crm-time-test-lead',:p1)",
      [
        {
          id: "crm-time-test-lead",
          fullName: "TEST 历史时间验收",
          phone: "00000004359",
          whatsapp: "00000004359",
          mode: "Online",
          city: "Unknown",
          goal: "TEST message timestamp acceptance",
          reportedLevel: "Beginner",
          currentStatus: "TEST",
          hookType: "TEST",
          hookContext: "TEST",
          entryPoint: "legacy_unknown",
          campaign: "TEST",
          slaDueTime: "2030-01-01T00:00:00Z",
          submittedAt: "2026-09-01T00:00:00Z",
          tier: "Cold",
          owner: "test-admin",
          followUpLogs: [],
        },
      ],
    );
    await pool.query(
      "INSERT INTO visitor_sessions VALUES('crm-time-test-visitor','crm-time-test-lead','2030-01-01')",
    );
    await pool.query(
      "INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES('crm-time-legacy','crm-time-test-visitor','crm-time-test-lead','legacy_unknown'),('crm-time-modern','crm-time-test-visitor','crm-time-test-lead','standalone_chat')",
    );
    const fixtures = [
      {
        id: "unknown-old",
        text: "TEST 缺失原时间（旧导入借用了提交时间）",
        created: "2026-09-01T00:00:00Z",
        metadata: { index: 0 },
      },
      {
        id: "unknown-epoch",
        text: "TEST 未知时间（epoch占位）",
        created: "1970-01-01T00:00:00Z",
        metadata: { index: 1, timestampKnown: false },
      },
      {
        id: "unknown-invalid",
        text: "TEST 原时间无效",
        created: "2026-09-01T00:00:00Z",
        metadata: { index: 2, originalTimestamp: "not-a-date" },
      },
      {
        id: "known-original",
        text: "TEST 有效原始时间",
        created: "2026-09-01T00:00:00Z",
        metadata: {
          index: 3,
          originalTimestamp: "2026-08-30T12:34:56Z",
          timestampKnown: true,
        },
      },
      {
        id: "known-epoch",
        text: "TEST 有效真实 epoch 时间",
        created: "1970-01-01T00:00:00Z",
        metadata: {
          index: 4,
          originalTimestamp: "1970-01-01T00:00:00Z",
          timestampKnown: true,
        },
      },
    ];
    for (const f of fixtures)
      await pool.query(
        "INSERT INTO messages(id,conversation_id,request_id,role,content,status,error,created_at) VALUES(:p1,'crm-time-legacy',:p1,'user',:p2,'legacy',:p3,:p4)",
        [f.id, f.text, JSON.stringify(f.metadata), f.created],
      );
    await pool.query(
      "INSERT INTO messages(id,conversation_id,request_id,role,content,status,created_at) VALUES('known-modern','crm-time-modern','known-modern','assistant','TEST 现代消息','completed','2026-10-12 01:23:45')",
    );
    const snapshot = async () =>
      crypto
        .createHash("sha256")
        .update(
          JSON.stringify(
            (await pool.query("SELECT m.* FROM messages m ORDER BY sequence"))
              .rows,
          ),
        )
        .digest("hex");
    const before = await snapshot();
    const listResponse = await fetch(base + "/api/crm/leads");
    assert.equal(listResponse.status, 200);
    const listed = (await listResponse.json()).leads.find(
      (l: any) => l.id === "crm-time-test-lead",
    );
    const detailResponse = await fetch(
      base + "/api/crm/leads/crm-time-test-lead",
    );
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    for (const rows of [
      listed.chatTranscript,
      detail.chatTranscript,
      detail.lead.chatTranscript,
    ]) {
      assert.equal(rows.length, 6);
      assert.deepEqual(
        rows.map((m: any) => m.id),
        [...fixtures.map((f) => f.id), "known-modern"],
      );
      for (const id of ["unknown-old", "unknown-epoch", "unknown-invalid"]) {
        const m = rows.find((r: any) => r.id === id);
        assert.equal(m.timestampKnown, false);
        assert.equal(m.timestamp, "");
      }
      assert.equal(
        rows.find((r: any) => r.id === "known-original").timestamp,
        "2026-08-30T12:34:56Z",
      );
      assert.equal(
        rows.find((r: any) => r.id === "known-epoch").timestampKnown,
        true,
      );
      assert.equal(
        new Date(
          rows.find((r: any) => r.id === "known-modern").timestamp,
        ).toISOString(),
        "2026-10-12T01:23:45.000Z",
      );
    }
    assert.equal(
      await snapshot(),
      before,
      "GET must not rewrite original dates, IDs, content or metadata",
    );
    process.env.MOCK_EMPLOYEE_ID = "test-sales";
    assert.equal(
      (await fetch(base + "/api/crm/leads/crm-time-test-lead")).status,
      404,
    );
    assert.equal(
      (await (await fetch(base + "/api/crm/leads")).json()).leads.length,
      0,
    );
    delete process.env.MOCK_EMPLOYEE_ID;
  });
}
