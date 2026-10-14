import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectMigration } from "../server/portal/migration.ts";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const fixtures = [
  {
    id: "legacy-test-a",
    fullName: "TEST Legacy A",
    phone: "000100",
    email: "shared@example.invalid",
    owner: "test-admin",
    submittedAt: "2026-09-01T00:00:00Z",
    slaDueTime: "2026-09-02T03:00:00Z",
    currentStage: "New",
    followUpLogs: [
      {
        id: "old-log-a",
        summary: "TEST first call",
        timestamp: "2026-09-01T02:00:00Z",
      },
      { id: "old-log-b", summary: "TEST second call" },
    ],
    chatTranscript: Array.from({ length: 12 }, (_, i) => ({
      id: "original-" + i,
      role: i % 2 ? "assistant" : "user",
      content: i < 2 ? "same repeated text" : i === 4 ? "" : "message " + i,
      ...(i === 4 ? { text: "must not replace empty content" } : {}),
      ...(i === 2
        ? {}
        : {
            timestamp:
              i === 3
                ? "invalid-time"
                : `2026-09-01T00:${String(12 - i).padStart(2, "0")}:00Z`,
          }),
    })),
  },
  {
    id: "legacy-test-b",
    fullName: "TEST Legacy B",
    phone: "000-100",
    email: "SHARED@example.invalid",
    slaDueTime: "2026-09-03T03:00:00Z",
    followUpLogs: [{ id: "old-log-c", summary: "TEST archived contact" }],
    chatTranscript: [
      {
        id: "b-1",
        role: "user",
        text: "TEST inquiry",
        timestamp: "2026-09-01T01:00:00Z",
      },
      {
        id: "b-2",
        role: "assistant",
        content: "TEST reply",
        timestamp: "2026-09-01T01:01:00Z",
      },
    ],
  },
  {
    id: "legacy-test-c",
    fullName: "TEST Legacy C",
    submittedAt: "invalid-date",
    chatTranscript: [],
  },
];
test("migration inspection exposes candidates and anomalies without inventing customer facts", () => {
  const { report } = inspectMigration(JSON.stringify(fixtures));
  assert.equal(report.leads, 3);
  assert.equal(report.messages, 14);
  assert.equal(report.followUpRecords, 3);
  assert.equal(report.invalidDates, 2);
  assert.equal(report.duplicateCandidates.length, 2);
  assert.equal(report.anomalies.length, 3);
  assert.equal(
    inspectMigration(JSON.stringify([{ id: "x", slaDueTime: "bad" }])).report
      .anomalies[0].severity,
    "blocking",
  );
  assert.equal(
    inspectMigration(JSON.stringify([{ id: "x" }, { id: "x" }])).report
      .duplicateIds,
    1,
  );
});

if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  const fixture = await setupNativeTest("migration");
  const { pool } = await import("../server/portal/store.ts");
  const { backup, restore, fingerprints } =
    await import("../cloud/mysql/backup.mjs");
  test("native migration is repeatable and backups restore every table with original evidence", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "uper-native-backup-")),
      file = path.join(dir, "leads.json"),
      dump = path.join(dir, "backup.sql");
    try {
      await fs.writeFile(file, JSON.stringify(fixtures));
      const run = () =>
        JSON.parse(
          execFileSync(
            process.execPath,
            ["--import", "tsx", "scripts/portal-migrate.ts", file, "--apply"],
            { env: process.env, encoding: "utf8" },
          ),
        );
      assert.equal(run().importedLeads, 3);
      assert.equal(run().skippedLeads, 3);
      const messages = (
        await pool.query("SELECT * FROM messages ORDER BY sequence")
      ).rows;
      assert.equal(messages.length, 14);
      assert.equal(messages[0].content, messages[1].content);
      assert.equal(JSON.parse(messages[2].error).timestampKnown, false);
      assert.equal(
        Number((await pool.query("SELECT COUNT(*) n FROM outbox")).rows[0].n),
        0,
      );
      assert.equal(
        (
          await pool.query("SELECT status FROM followup_tasks WHERE id=:p1", [
            "legacy-legacy-test-a",
          ])
        ).rows[0].status,
        "migration_hold",
      );
      const before = await fingerprints(process.env),
        saved = await backup(process.env, dump),
        target = await fixture.createRestore();
      await assert.rejects(restore(target, dump, "bad"), /checksum/);
      await restore(target, dump, saved.sha256);
      assert.deepEqual(await fingerprints(target), before);
      await assert.rejects(restore(target, dump, saved.sha256), /empty/);
    } finally {
      await pool.end();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}
