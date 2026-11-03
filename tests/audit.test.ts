import test from "node:test";
import assert from "node:assert/strict";

// Console mirror of portal_audit writes; see server/portal/audit.ts.
function captureInfo(run: () => void): Record<string, any> {
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => void lines.push(String(args[0]));
  try {
    run();
  } finally {
    console.log = originalLog;
  }
  assert.equal(lines.length, 1, "exactly one audit log line");
  return JSON.parse(lines[0]);
}

test("auditLog maps data.leadId to leadId and keeps data.id neutral", async () => {
  const { auditLog } = await import("../server/portal/audit.ts");
  const record = captureInfo(() =>
    auditLog("emp_1", "campaign.save", { id: "camp_2", requestId: "req_3" }),
  );
  assert.equal(record.event, "campaign.save");
  assert.equal(record.actor, "emp_1");
  assert.equal(record.id, "camp_2");
  assert.equal("leadId" in record, false, "a non-customer id is never labeled leadId");
  assert.equal(record.requestId, "req_3");

  const lead = captureInfo(() => auditLog("emp_1", "lead.claim", { leadId: "L_9" }));
  assert.equal(lead.leadId, "L_9");
});

test("auditLog never copies business payload fields into the console line", async () => {
  const { auditLog } = await import("../server/portal/audit.ts");
  const record = captureInfo(() =>
    auditLog("emp_1", "payment.verify", {
      leadId: "L_1",
      fullName: "客户姓名",
      phone: "+6281234567890",
      reason: "内部备注",
      historyId: "h1",
    }),
  );
  assert.equal(record.leadId, "L_1");
  for (const leaked of ["fullName", "phone", "reason", "historyId"])
    assert.equal(leaked in record, false, `${leaked} stays out of container logs`);
});

test("auditLog with default or empty data logs actor and action only", async () => {
  const { auditLog } = await import("../server/portal/audit.ts");
  const none = captureInfo(() => auditLog("emp_2", "auth.login"));
  assert.equal(none.actor, "emp_2");
  assert.equal(none.event, "auth.login");
  assert.deepEqual(Object.keys(none).sort(), ["actor", "event", "level", "time"]);

  const empty = captureInfo(() => auditLog("emp_2", "auth.password_changed", {}));
  assert.equal("leadId" in empty, false);
  assert.equal("id" in empty, false);
});
