import test from "node:test";
import assert from "node:assert/strict";
import {
  managementRequest,
  pendingAccessOperations,
  forgetAccessOperation,
} from "../src/utils/accessOperationClient.ts";
test("unknown management results retain only metadata in session storage and retry the same ID without storing passwords", async () => {
  const previous = {
    window: globalThis.window,
    sessionStorage: globalThis.sessionStorage,
    fetch: globalThis.fetch,
  };
  const storage = new Map<string, string>();
  const target = new EventTarget();
  Object.assign(globalThis, {
    window: target,
    sessionStorage: {
      getItem: (k: string) => storage.get(k) || null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
  });
  const sent: any[] = [];
  globalThis.fetch = (async (_url: any, options: any) => {
    sent.push(JSON.parse(options.body));
    throw Error("TEST network dropped");
  }) as any;
  try {
    const body = { temporaryPassword: "TEST-sensitive-input", reason: "TEST" };
    await assert.rejects(
      managementRequest("TEST-actor", "/api/admin/access/users", body),
      /network/,
    );
    assert.equal(pendingAccessOperations("TEST-actor").length, 1);
    assert.doesNotMatch(
      [...storage.values()].join(""),
      /TEST-sensitive-input|temporaryPassword/,
    );
    await assert.rejects(
      managementRequest("TEST-actor", "/api/admin/access/users", {
        ...body,
        reason: "changed",
      }),
      /access_operation_pending/,
    );
    await assert.rejects(
      managementRequest("TEST-actor", "/api/admin/access/users", body),
      /network/,
    );
    assert.equal(sent[0].operationId, sent[1].operationId);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ saved: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as any;
    assert.equal(
      (await managementRequest("TEST-actor", "/api/admin/access/users", body))
        .saved,
      true,
    );
    assert.equal(pendingAccessOperations("TEST-actor").length, 0);
  } finally {
    for (const p of pendingAccessOperations("TEST-actor"))
      forgetAccessOperation(p.operationId);
    Object.assign(globalThis, previous);
  }
});
