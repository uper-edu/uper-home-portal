import test from "node:test";
import assert from "node:assert/strict";

// Single-line JSON console logging for container collection; see server/logger.ts.
function captureConsole<T>(run: () => T): { stdout: string[]; stderr: string[]; value: T } {
  const stdout: string[] = [], stderr: string[] = [];
  const originalLog = console.log, originalError = console.error;
  console.log = (...args: unknown[]) => void stdout.push(String(args[0]));
  console.error = (...args: unknown[]) => void stderr.push(String(args[0]));
  try {
    const value = run();
    return { stdout, stderr, value };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function withLevel<T>(level: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const previous = process.env.PORTAL_LOG_LEVEL;
  if (level === undefined) delete process.env.PORTAL_LOG_LEVEL;
  else process.env.PORTAL_LOG_LEVEL = level;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.PORTAL_LOG_LEVEL;
    else process.env.PORTAL_LOG_LEVEL = previous;
  }
}

test("info records are single-line JSON on stdout with time, level and event", async () => {
  const { log } = await import("../server/logger.ts");
  const { stdout, stderr } = await withLevel("info", () =>
    captureConsole(() =>
      log.info("http.request", { method: "GET", path: "api/health", status: 200 }),
    ),
  );
  assert.equal(stderr.length, 0);
  assert.equal(stdout.length, 1);
  assert.ok(!stdout[0].includes("\n"), "the info line stays on one line");
  const record = JSON.parse(stdout[0]);
  assert.equal(record.level, "info");
  assert.equal(record.event, "http.request");
  assert.equal(record.method, "GET");
  assert.equal(record.status, 200);
  assert.ok(!Number.isNaN(Date.parse(record.time)));
});

test("warn and error go to stderr; errors serialize name, message and single-line stack", async () => {
  const { log } = await import("../server/logger.ts");
  const failure = new Error("ER_LOCK_WAIT_TIMEOUT");
  const { stdout, stderr } = await withLevel("info", () =>
    captureConsole(() => {
      log.warn("notification.retry", { jobId: "j1" });
      log.error("http.error", { error: failure });
    }),
  );
  assert.equal(stdout.length, 0);
  assert.equal(stderr.length, 2);
  const retry = JSON.parse(stderr[0]);
  assert.equal(retry.level, "warn");
  assert.equal(retry.jobId, "j1");
  const error = JSON.parse(stderr[1]);
  assert.equal(error.level, "error");
  assert.equal(error.error.name, "Error");
  assert.equal(error.error.message, "ER_LOCK_WAIT_TIMEOUT");
  assert.match(error.error.stack, /logger\.test\.ts/);
  assert.ok(!stderr[1].includes("\n"), "the error line stays on one line");
});

test("database ER_ errors log the driver code without the value-carrying message", async () => {
  const { log } = await import("../server/logger.ts");
  const duplicate = Object.assign(new Error("Duplicate entry '客户姓名' for key 'PRIMARY'"), {
    code: "ER_DUP_ENTRY",
  });
  const { stderr } = await withLevel("info", () =>
    captureConsole(() => log.error("http.error", { error: duplicate })),
  );
  const record = JSON.parse(stderr[0]);
  assert.equal(record.error.code, "ER_DUP_ENTRY");
  assert.equal("message" in record.error, false);
  assert.ok(!stderr[0].includes("客户姓名"), "bound customer values never reach the log");
});

test("nested Error values keep name/message/stack instead of serializing as {}", async () => {
  const { log } = await import("../server/logger.ts");
  const inner = new Error("inner failure");
  const { stderr } = await withLevel("info", () =>
    captureConsole(() => log.error("chat.provider_failed", { detail: { cause: inner } })),
  );
  const record = JSON.parse(stderr[0]);
  assert.equal(record.detail.cause.message, "inner failure");
  assert.match(record.detail.cause.stack, /logger\.test\.ts/);
});

test("PORTAL_LOG_LEVEL filters lower levels; invalid values fall back to info; undefined fields are omitted", async () => {
  const { log } = await import("../server/logger.ts");
  const { stdout, stderr } = await withLevel("error", () =>
    captureConsole(() => {
      log.debug("noise");
      log.info("hidden", { actor: "a1" });
      log.error("kept", { actor: "a1", leadId: undefined });
    }),
  );
  assert.equal(stdout.length, 0);
  assert.equal(stderr.length, 1);
  const record = JSON.parse(stderr[0]);
  assert.equal(record.event, "kept");
  assert.equal(record.actor, "a1");
  assert.equal("leadId" in record, false);

  // Prototype-chain names such as "constructor" must not disable filtering.
  const inherited = await withLevel("constructor", () =>
    captureConsole(() => log.debug("still hidden")),
  );
  assert.equal(inherited.stdout.length, 0, "debug stays filtered for an invalid level value");
});

test("unserializable fields fall back to a minimal valid single-line record", async () => {
  const { log } = await import("../server/logger.ts");
  const circular: any = { self: null };
  circular.self = circular;
  const { stderr } = await withLevel("info", () =>
    captureConsole(() => log.error("cycle", { bad: circular })),
  );
  assert.equal(stderr.length, 1);
  assert.ok(!stderr[0].includes("\n"), "the fallback line stays on one line");
  const record = JSON.parse(stderr[0]);
  assert.equal(record.event, "cycle");
  assert.equal(record.note, "log write failed");
});
