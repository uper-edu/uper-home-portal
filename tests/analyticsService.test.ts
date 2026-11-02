import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import analyticsEnvironments from '../src/data/analyticsEnvironments.json';

test("actual portal services emit only scope-checked saved receipts; failures and repeated recovery do not fabricate conversions", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "uper-analytics-"));
  const original = Object.getOwnPropertyDescriptors(globalThis);
  const values = new Map<string, string>(),
    events: any[] = [];
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => values.delete(k),
  };
  const A = "a".repeat(64),
    B = "b".repeat(64);
  const loc = {
    href: "http://localhost:3000/chat?lang=zh",
    pathname: "/chat",
    search: "?lang=zh",
  };
  Object.assign(globalThis, {
    window: {
      location: loc,
      sessionStorage: storage,
      gtag: (...v: any[]) => events.push(v),
      dataLayer: [],
      dispatchEvent() {},
      addEventListener() {},
    },
    location: loc,
    localStorage: storage,
    sessionStorage: storage,
    document: {
      referrer: "",
      documentElement: { lang: "zh" },
      getElementById: () => ({}),
      head: { appendChild() {} },
    },
  });
  try {
    const bundled = await build({
      stdin: {
        contents: `export * from './src/services/portalChat';export * from './src/services/visitorScope';export * from './src/services/chatDelivery';`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      define: {
        "import.meta.env": JSON.stringify({
          VITE_UPER_MEASUREMENT_ID: analyticsEnvironments.environments.dev.measurementId,
          MODE: "dev",
        }),
        __UPER_ANALYTICS__:JSON.stringify({target:'dev',...analyticsEnvironments.environments.dev}),
      },
    });
    await writeFile(
      path.join(dir, "services.mjs"),
      bundled.outputFiles[0].text,
    );
    const api = await import(path.join(dir, "services.mjs"));
    api.selectVisitorScope(A);
    let request: any;
    globalThis.fetch = async (url: any, init: any) => {
      if (String(url).endsWith("/session"))
        return Response.json({ registered: false, cacheScope: A });
      request = JSON.parse(init.body);
      return Response.json({
        success: true,
        saved: true,
        submissionId: request.submissionId,
        lead: { id: "PRIVATE-LEAD", fullName: "PRIVATE-NAME" },
      });
    };
    await api.registerContact({
      fullName: "PRIVATE-NAME",
      email: "private@example.test",
    });
    const registrations = () =>
      events.filter(
        (e) => e[0] === "event" && e[1] === "questionnaire_complete",
      );
    assert.equal(registrations().length, 1);
    assert.ok(
      !JSON.stringify(events).includes("PRIVATE") &&
        !JSON.stringify(events).includes("private@"),
    );
    // A delayed response from A must not be attributed after switching to B.
    let release!: (r: Response) => void, entered!: () => void;
    const started = new Promise<void>((r) => (entered = r));
    globalThis.fetch = async (url: any, init: any) => {
      if (String(url).endsWith("/session"))
        return Response.json({ registered: false, cacheScope: A });
      request = JSON.parse(init.body);
      entered();
      return new Promise<Response>((r) => (release = r));
    };
    const delayed = api.registerContact({ fullName: "different" });
    await started;
    api.selectVisitorScope(B);
    release(
      Response.json({
        saved: true,
        submissionId: request.submissionId,
        lead: { id: "OTHER" },
        advisorRequests:[{leadId:'OTHER',messageId:'late-other-request',action:'handoff',status:'awaiting_advisor',taskOperation:'recorded'}],
      }),
    );
    await assert.rejects(
      delayed,
      /Visitor changed|Registration result unknown/,
    );
    assert.equal(registrations().length, 1);
    assert.equal(events.filter(e=>e[1]==='advisor_request').length,0);
    api.selectVisitorScope(A);
    api.setDraftScope(A);
    const run = async (id: string, result: any, action?: string) => {
      api.saveDraft("standalone_chat", {
        id,
        content: "PRIVATE-ORIGINAL",
        conversationId: "PRIVATE-C",
        timestamp: new Date().toISOString(),
        delivery: "unknown",
        action,
      });
      return api.finishChat(
        Response.json(result),
        "standalone_chat",
        id,
        () => {},
      );
    };
    await run("message-1", { saved: true, reply: "PRIVATE-REPLY" });
    assert.equal(
      events.filter((e) => e[1] === "consultation_message_saved").length,
      1,
    );
    await assert.rejects(
      run("message-2", {
        saved: true,
        status: "failed",
        error: "all_providers_failed",
      }),
    );
    assert.equal(
      events.filter(
        (e) => e[1] === "consultation_result" && e[2].status === "failed",
      ).length,
      1,
    );
    assert.equal(
      events.filter(
        (e) => e[1] === "consultation_result" && e[2].status === "saved",
      ).length,
      1,
    );
    await run(
      "request-1",
      { saved: true, status: "awaiting_advisor", taskOperation: "recorded" },
      "handoff",
    );
    await run(
      "request-1",
      { saved: true, status: "awaiting_advisor", taskOperation: "recorded" },
      "handoff",
    );
    assert.equal(events.filter((e) => e[1] === "advisor_request").length, 1);
    await run("not-request", {
      saved: true,
      status: "awaiting_advisor",
      taskOperation: "recorded",
    });
    assert.equal(events.filter((e) => e[1] === "advisor_request").length, 1);
    assert.ok(
      !JSON.stringify(events).includes("PRIVATE") &&
        !JSON.stringify(events).includes("private@"),
    );
    // An anonymous request is confirmed only when registration commits it.
    const C='c'.repeat(64);api.selectVisitorScope(C);api.setDraftScope(C);
    let savedRegistration:any;let drop=true;
    globalThis.fetch=async(url:any,init:any)=>{
      if(String(url).endsWith('/session'))return Response.json({registered:false,cacheScope:C});
      if(String(url).includes('/registrations/'))return Response.json(savedRegistration);
      const body=JSON.parse(init.body);
      savedRegistration={saved:true,submissionId:body.submissionId,lead:{id:'PRIVATE-C'},advisorRequests:[{leadId:'PRIVATE-C',messageId:'anonymous-request',action:'handoff',status:'awaiting_advisor',taskOperation:'recorded'}]};
      if(drop){drop=false;throw new TypeError('TEST response lost after commit');}
      return Response.json(savedRegistration);
    };
    const advisorCount=()=>events.filter(e=>e[1]==='advisor_request').length,beforeAnonymous=advisorCount();
    await assert.rejects(api.registerContact({fullName:'PRIVATE-C',email:'private-c@example.test'}));
    assert.equal(advisorCount(),beforeAnonymous);
    await api.registerContact({}, {queryOnly:true});assert.equal(advisorCount(),beforeAnonymous+1);
    await run('anonymous-request',{saved:true,status:'awaiting_advisor',taskOperation:'recorded'},'handoff');assert.equal(advisorCount(),beforeAnonymous+1);
    assert.doesNotMatch(JSON.stringify(events),/PRIVATE|private@|private-c@/);
  } finally {
    for (const k of [
      "window",
      "location",
      "localStorage",
      "sessionStorage",
      "document",
      "fetch",
    ]) {
      if (original[k]) Object.defineProperty(globalThis, k, original[k]);
      else delete (globalThis as any)[k];
    }
    await rm(dir, { recursive: true, force: true });
  }
});
