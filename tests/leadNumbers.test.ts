import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { leadDisplayNumber } from "../src/utils/leadNumber";
import { formatCrmOperatingTime } from "../src/utils/crmOperatingTime";

test("CRM displays the business number while retaining internal and legacy fallback IDs", () => {
  const id = randomUUID();
  assert.equal(
    leadDisplayNumber({ id, businessNumber: "20261013-001" }),
    "20261013-001",
  );
  assert.equal(leadDisplayNumber({ id }), id);
  assert.equal(leadDisplayNumber({ id: "UPER-20260930-005" }), "20260930-005");
});

test("CRM timestamp dates match Operating Timezone across midnight and daylight saving", () => {
  const stamp = "2038-05-01T16:30:00Z";
  assert.equal(
    formatCrmOperatingTime(stamp, "Asia/Jakarta"),
    "2038-05-01 23:30:00",
  );
  assert.equal(
    formatCrmOperatingTime(stamp, "Asia/Shanghai"),
    "2038-05-02 00:30:00",
  );
  assert.equal(
    formatCrmOperatingTime("2026-03-08T09:59:59Z", "America/Vancouver"),
    "2026-03-08 01:59:59",
  );
  assert.equal(
    formatCrmOperatingTime("2026-03-08T10:00:00Z", "America/Vancouver"),
    "2026-03-08 03:00:00",
  );
  assert.equal(formatCrmOperatingTime(undefined, "Asia/Jakarta"), "");
});

if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const { setupNativeTest } = await import("./helpers/mysql.mjs");
  await setupNativeTest("leadNumbers");
  const { pool, tx } = await import("../server/portal/store.ts");
  test("native daily numbers are unique under concurrency and rollback, preserve saved numbers", async () => {
    try {
      await pool.query(
        "INSERT INTO portal_settings(id,value) VALUES('sla',:p1)",
        [{ timezone: "Asia/Jakarta" }],
      );
      const stamp = "2038-05-01T17:30:00Z";
      const creates = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          tx(
            async (c) =>
              (
                await c.query(
                  "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
                  [
                    "TEST-number-" + i,
                    { fullName: "TEST number", submittedAt: stamp },
                  ],
                )
              ).rows[0],
          ),
        ),
      );
      assert.equal(new Set(creates.map((r) => r.business_number)).size, 20);
      assert.ok(
        creates.every((r) => r.business_number.startsWith("20380502-")),
      );
      await assert.rejects(
        tx(async (c) => {
          await c.query(
            "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
            ["TEST-rollback", { submittedAt: stamp }],
          );
          throw Error("TEST rollback");
        }),
      );
      const saved = creates[0];
      await pool.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
        saved.id,
        { businessNumber: "FORGED", submittedAt: "2099-01-01" },
      ]);
      assert.equal(
        (
          await pool.query(
            "SELECT business_number,profile FROM portal_leads WHERE id=:p1",
            [saved.id],
          )
        ).rows[0].profile.businessNumber,
        saved.business_number,
      );
      assert.equal(
        (
          await pool.query("SELECT id FROM portal_leads WHERE id=:p1", [
            "TEST-rollback",
          ])
        ).rows.length,
        0,
      );
    } finally {
      await pool.end();
    }
  });
}
