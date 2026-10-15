import test from "node:test";
import assert from "node:assert/strict";
import { retryLeaseRecovery } from "../server/portal/notificationLeaseRecovery.ts";
test("lease recovery retries a rolled-back deadlock, then returns the one successful update", async () => {
  let calls = 0;
  assert.equal(
    await retryLeaseRecovery(async () => {
      calls++;
      if (calls === 1)
        throw Object.assign(Error("TEST deadlock"), {
          code: "ER_LOCK_DEADLOCK",
        });
      return 2;
    }),
    2,
  );
  assert.equal(calls, 2);
});
test("lease recovery stops after three deadlocks and never retries a different failure", async () => {
  let calls = 0;
  await assert.rejects(
    retryLeaseRecovery(async () => {
      calls++;
      throw Object.assign(Error("TEST persistent deadlock"), {
        code: "ER_LOCK_DEADLOCK",
      });
    }),
    /persistent/,
  );
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(
    retryLeaseRecovery(async () => {
      calls++;
      throw Error("TEST unknown database outcome");
    }),
    /unknown/,
  );
  assert.equal(calls, 1);
});
