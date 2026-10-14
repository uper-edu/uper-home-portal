import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { setupNativeTest } from "./helpers/mysql.mjs";
if (!process.env.MYSQL_NATIVE_TEST_ENV)
  test(
    "persisted provider failover needs explicit isolated MySQL fixture",
    { skip: true },
    () => {},
  );
else {
  await setupNativeTest("chatFailover");
  Object.assign(process.env, {
    PLATFORM_MODE: "mock",
    OPENAI_API_KEY: "TEST",
    DEEPSEEK_API_KEY: "TEST",
    OPENAI_MODEL: "gpt-4o",
    OPENAI_API_BASE_URL: "https://mock.invalid/openai",
    DEEPSEEK_API_BASE_URL: "https://mock.invalid/deepseek",
  });
  const { pool } = await import("../server/portal/store.ts"),
    { mountPortal } = await import("../server/portal/runtime.ts"),
    { mountChat } = await import("../server/portal/chat.ts");
  const app = express();
  app.use(express.json());
  await mountPortal(app);
  mountChat(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port,
    nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://mock.invalid/"))
      return nativeFetch(url, options);
    const body = JSON.parse(options.body),
      scenario = body.messages.at(-1).content,
      primary = String(url).endsWith("/openai");
    if (primary && /^(401|429|500|legacy)$/.test(scenario))
      return new Response("{}", {
        status: scenario === "legacy" ? 500 : Number(scenario),
      });
    if (primary && scenario === "network") throw new TypeError("TEST network");
    if (scenario === "both-fail") return new Response("{}", { status: 503 });
    let step = 0;
    const content = primary ? "PRIMARY answer" : "BACKUP answer";
    return new Response(
      new ReadableStream({
        pull(c) {
          if (step++ === 0) {
            c.enqueue(
              new TextEncoder().encode(
                "data: " +
                  JSON.stringify({ choices: [{ delta: { content } }] }) +
                  "\n\n",
              ),
            );
            return;
          }
          if (primary && scenario === "partial") {
            c.error(Error("TEST disconnect"));
            return;
          }
          if (!(primary && scenario === "truncated"))
            c.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          c.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  };
  await test("persisted MySQL failover suite", async (t) => {
    t.after(async () => {
      globalThis.fetch = nativeFetch;
      await new Promise((r) => server.close(r));
      await pool.end();
    });
    async function request(scenario, stream = true) {
      let cookie = "";
      const call = async (path, body) => {
        const response = await fetch(base + path, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify(body),
        });
        cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
        return response;
      };
      const conversation = await (
        await call("/api/portal/conversations", { source: "standalone_chat" })
      ).json();
      const messageId = randomUUID(),
        reply = await call("/api/chat", {
          conversationId: conversation.conversationId,
          messageId,
          content: scenario,
          stream,
        });
      assert.equal(reply.status, 200);
      const events = stream
        ? (await reply.text())
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => JSON.parse(l.slice(5)))
        : [await reply.json()];
      const rows = (
        await pool.query(
          "SELECT * FROM messages WHERE conversation_id=:p1 AND request_id=:p2",
          [conversation.conversationId, messageId],
        )
      ).rows;
      assert.equal(rows.length, 2);
      assert.equal(rows.find((r) => r.role === "user").content, scenario);
      assert.equal(
        rows.find((r) => r.role === "assistant").status,
        events.at(-1).status,
      );
      return { events, rows };
    }
    for (const scenario of [
      "401",
      "429",
      "500",
      "network",
      "partial",
      "truncated",
    ])
      await t.test(
        "OpenAI " +
          scenario +
          " switches to DeepSeek with persisted failure evidence",
        async () => {
          const { events, rows } = await request(scenario);
          let text = "";
          for (const e of events) {
            if (e.reset) text = "";
            if (e.chunk) text += e.chunk;
          }
          assert.equal(text, "BACKUP answer");
          assert.equal(events.at(-1).modelUsed, "deepseek-chat");
          assert.equal(
            rows.find((r) => r.role === "assistant").content,
            "BACKUP answer",
          );
          const attempts = (
            await pool.query("SELECT * FROM ai_attempts WHERE message_id=:p1", [
              rows.find((r) => r.role === "assistant").id,
            ])
          ).rows;
          assert.equal(attempts.length, 2);
          assert.ok(attempts[0].error);
        },
      );
    await t.test("healthy primary uses OpenAI", async () => {
      const { events } = await request("success");
      assert.equal(events.at(-1).modelUsed, "gpt-4o");
    });
    await t.test(
      "both providers fail explicitly while user message remains saved",
      async () => {
        const { events } = await request("both-fail");
        assert.equal(events.at(-1).error, "all_providers_failed");
        assert.equal(events.at(-1).modelUsed, null);
      },
    );
    await t.test(
      "JSON response also switches providers and persists complete reply",
      async () => {
        const { events } = await request("legacy", false);
        assert.equal(events[0].reply, "BACKUP answer");
        assert.equal(events[0].modelUsed, "deepseek-chat");
      },
    );
  });
}
