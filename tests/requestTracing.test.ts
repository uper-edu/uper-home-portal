import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {EventEmitter} from "node:events";
import {measureEnrollmentPhase,mountRequestTracing,requestErrorContext} from "../server/requestTracing.ts";

test("enrollment telemetry omits identifiers and distinguishes completed and interrupted writes without a server",async t=>{
  const lines:string[]=[];
  t.mock.method(console,'log',(line:string)=>lines.push(line));
  let middleware:(q:any,r:any,next:()=>void)=>void=()=>assert.fail('middleware not installed');
  mountRequestTracing({use:(handler:typeof middleware)=>{middleware=handler;}} as express.Express);
  const event=()=>Object.assign(new EventEmitter(),{locals:{},setHeader(){},statusCode:200,writableFinished:false});
  const request={method:'POST',path:'/api/enrollment/orders/private-id/proofs/finish',headers:{},
    route:{path:'/api/enrollment/orders/:id/proofs/finish'}};
  const finished=event();
  middleware(request,finished,()=>{});
  assert.equal(await measureEnrollmentPhase(finished as unknown as express.Response,'transaction',()=>42),42);
  finished.emit('finish');
  finished.emit('close');
  const interrupted=event();
  middleware(request,interrupted,()=>{});
  interrupted.emit('close');
  Object.assign(interrupted,{destroyed:true});
  await measureEnrollmentPhase(interrupted as unknown as express.Response,'transaction',()=>42);
  assert.equal(lines.length,3);
  const [a,b,phase]=lines.map(line=>JSON.parse(line));
  assert.equal(a.outcome,'finished');
  assert.equal(a.path,request.route.path);
  assert.equal(a.status,200);
  assert.ok(a.phases.transaction>=0);
  assert.equal(b.outcome,'aborted');
  assert.equal(b.status,undefined);
  assert.equal(phase.event,'enrollment.phase_after_disconnect');
  assert.equal(phase.traceId,b.traceId);
  assert.equal(phase.outcome,'resolved');
  assert.ok(lines.every(line=>!line.includes('private-id')));
  assert.deepEqual(requestErrorContext(request,Error('enrollment_invalid_proof')),
    {path:request.route.path,errorCode:'enrollment_invalid_proof'});
  assert.deepEqual(requestErrorContext({...request,route:undefined},Error('private-id')),
    {path:'/api/:enrollment',errorCode:undefined});
});

// Trace-id adoption and the /api access log; see server/requestTracing.ts.
async function withServer(
  routes: (app: express.Express) => void,
  handler: (base: string) => Promise<void>,
): Promise<string[]> {
  const { mountRequestTracing } = await import("../server/requestTracing.ts");
  const app = express();
  mountRequestTracing(app);
  routes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => void lines.push(String(args[0]));
  try {
    await handler(base);
    // Give finish/close events a beat to fire before restoring the console.
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    console.log = originalLog;
    await new Promise((resolve) => server.close(resolve));
  }
  return lines;
}

test("a well-formed edge X-Trace-Id is adopted, echoed and logged unchanged", async () => {
  const edge = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
  const lines = await withServer(
    (app) => app.get("/api/ok", (_q, r) => r.status(200).json({ ok: true })),
    async (base) => {
      const response = await fetch(base + "/api/ok", { headers: { "x-trace-id": edge } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-trace-id"), edge);
    },
  );
  assert.equal(lines.length, 1);
  assert.ok(!lines[0].includes("\n"), "the access line stays on one line");
  const record = JSON.parse(lines[0]);
  assert.equal(record.event, "http.request");
  assert.equal(record.method, "GET");
  assert.equal(record.path, "/api/ok");
  assert.equal(record.status, 200);
  assert.equal(record.traceId, edge);
  assert.equal("actor" in record, false, "actor stays absent when crmEmployee is not resolved");
});

test("X-Request-Id is never adopted; malformed trace ids are replaced by a generated one", async () => {
  const lines = await withServer(
    (app) => app.get("/api/ok", (_q, r) => r.status(200).json({ ok: true })),
    async (base) => {
      const viaRequestId = await fetch(base + "/api/ok", { headers: { "x-request-id": "12345678abcdef99" } });
      assert.notEqual(viaRequestId.headers.get("x-trace-id"), "12345678abcdef99");

      const malformed = await fetch(base + "/api/ok", { headers: { "x-trace-id": "short" } });
      assert.notEqual(malformed.headers.get("x-trace-id"), "short");

      const tooLong = await fetch(base + "/api/ok", { headers: { "x-trace-id": "x".repeat(65) } });
      assert.notEqual(tooLong.headers.get("x-trace-id"), "x".repeat(65));

      const illegal = await fetch(base + "/api/ok", { headers: { "x-trace-id": "bad@value!id" } });
      assert.notEqual(illegal.headers.get("x-trace-id"), "bad@value!id");
    },
  );
  assert.equal(lines.length, 4);
  for (const line of lines) {
    const record = JSON.parse(line);
    assert.match(record.traceId, /^[A-Za-z0-9_-]{8,64}$/);
    assert.notEqual(record.traceId, "12345678abcdef99");
  }
});

test("non-/api paths produce no access log line but still carry the header", async () => {
  const lines = await withServer(
    (app) => app.get("/static/asset", (_q, r) => r.status(200).send("x")),
    async (base) => {
      const response = await fetch(base + "/static/asset");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("x-trace-id")!, /^[A-Za-z0-9_-]{8,64}$/);
    },
  );
  assert.equal(lines.length, 0);
});

test("an aborted request is logged exactly once via close", async () => {
  const lines = await withServer(
    (app) =>
      app.get("/api/slow", async (_q, r) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        r.status(200).end();
      }),
    async (base) => {
      await assert.rejects(fetch(base + "/api/slow", { signal: AbortSignal.timeout(30) }));
      await new Promise((resolve) => setTimeout(resolve, 300));
    },
  );
  assert.equal(lines.length, 1, "exactly one line even if both finish and close fire");
  const record = JSON.parse(lines[0]);
  assert.equal(record.path, "/api/slow");
  assert.match(record.traceId, /^[A-Za-z0-9_-]{8,64}$/);
});
