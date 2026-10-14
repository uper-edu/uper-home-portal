import { setupNativeTest } from "./helpers/mysql.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { newHskAttempt } from "../src/data/hskAssessment";
import { getVersionQuestions } from "../src/data/hskAssessmentVersions";
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("hskConsultation");
  process.env.PLATFORM_MODE = "mock";
  const { pool } = await import("../server/portal/store");
  const { mountPortal } = await import("../server/portal/runtime");
  const { mountChat } = await import("../server/portal/chat");
  test("saved assessment starts one assistant-only consultation; refresh/retry is idempotent and other visitors cannot access it", async () => {
    const provider = express();
    provider.use(express.json());
    let calls = 0;
    provider.post("/completion", (req, res) => {
      calls++;
      const instruction = JSON.stringify(req.body.messages);
      const system = req.body.messages[0].content;
      assert.match(instruction, /system-triggered introduction/);
      if (system.includes("The learner just submitted a saved assessment")) {
        assert.match(instruction, /characterRecognition/);
        assert.match(instruction, /handwriting and speaking were not assessed/);
        assert.match(instruction, /listening needs verification/);
      }
      assert.match(system, /Consultation profile and focus/);
      assert.doesNotMatch(
        system,
        /consult-context@example.invalid|weekly study availability/,
      );
      const tail = req.body.messages.at(-1).content;
      assert.match(tail, /Produce the new assistant turn/);
      if (tail.includes("The learner just submitted a saved assessment")) {
        assert.match(tail, /HSK 3 consolidation/);
        assert.match(tail, /selfReportedBeforeAssessment/);
      }
      if (
        instruction.includes('"mode":"express"') ||
        instruction.includes('\\"mode\\":\\"express\\"')
      ) {
        assert.match(instruction, /startingPointGuidance/);
        assert.match(instruction, /learner-startpoint-presentation-v2/);
        assert.match(instruction, /HSK 3 consolidation/);
      }
      res.json({
        choices: [
          {
            message: {
              content: system.includes('"topic":"fees"')
                ? "Which course would you like the fee details for?"
                : system.includes('"topic":"work_scenarios"')
                  ? "Which work situation would you most like to handle in Mandarin?"
                  : "Which practical situation would you most like to use Mandarin in?",
            },
            finish_reason: "stop",
          },
        ],
      });
    });
    const upstream = provider.listen(0, "127.0.0.1");
    await new Promise<void>((r) => upstream.on("listening", r));
    process.env.OPENAI_API_KEY = "TEST-local-stub";
    process.env.OPENAI_API_BASE_URL = `http://127.0.0.1:${(upstream.address() as any).port}/completion`;
    const app = express();
    app.use(express.json());
    await mountPortal(app);
    mountChat(app);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.on("listening", r));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    let cookie = "";
    const api = async (path: string, body?: unknown, other?: string) => {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Cookie: other ?? cookie,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (other === undefined && r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie")!.split(";")[0];
      return { status: r.status, data: await r.json() };
    };
    try {
      assert.equal(
        (
          await api("/api/portal/register", {
            fullName: "TEST CONSULT CONTEXT",
            email: "consult-context@example.invalid",
            goal: "Work in China",
            buyingSignal: "Which level is right",
            buyingSignals: ["Which level is right"],
            goals: ["Work in China"],
            reportedLevel: "Beginner",
            city: "Jakarta",
            mode: "Offline",
            hskExamPlan: "Within 6 months",
          })
        ).status,
        200,
      );
      const a = newHskAttempt("full", randomUUID());
      a.completedAt = new Date().toISOString();
      for (const q of getVersionQuestions("full"))
        a.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
      assert.equal(
        (await api("/api/portal/assessments", { attempt: a })).status,
        200,
      );
      const conv = (
        await api("/api/portal/conversations", {
          source: "standalone_chat",
          page: "/chat",
        })
      ).data.conversationId;
      const payload = {
        conversationId: conv,
        assessmentAttemptId: a.attemptId,
        lang: "en",
      };
      const first = await api("/api/chat", payload);
      assert.equal(first.status, 200);
      assert.match(first.data.reply, /Which work situation/);
      const repeat = await api("/api/chat", payload);
      assert.equal(repeat.data.reply, first.data.reply);
      assert.equal(calls, 1);
      const rows = (
        await pool.query(
          "SELECT role,request_id,status FROM messages WHERE conversation_id=:p1",
          [conv],
        )
      ).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, "assistant");
      assert.equal(rows[0].status, "completed");
      assert.equal(rows[0].request_id, "hsk-intro-" + a.attemptId);
      assert.equal((await api("/api/chat", payload, "")).status, 404);
      assert.equal(calls, 1);
      assert.equal(
        (
          await api("/api/chat", {
            ...payload,
            assessmentAttemptId: randomUUID(),
          })
        ).status,
        404,
      );
      const profileIntro = {
        conversationId: conv,
        consultationStart: true,
        lang: "en",
      };
      const profileFirst = await api("/api/chat", profileIntro);
      assert.equal(profileFirst.status, 200);
      assert.match(profileFirst.data.reply, /Which work situation/);
      const profileCalls = calls;
      assert.equal(
        (await api("/api/chat", profileIntro)).data.reply,
        profileFirst.data.reply,
      );
      assert.equal(calls, profileCalls);
      assert.equal(
        (await api("/api/chat", profileIntro, "other=unregistered")).status,
        404,
      );
      assert.equal(
        Number(
          (
            await pool.query(
              "SELECT count(*) n FROM messages WHERE conversation_id=:p1 AND role='user'",
              [conv],
            )
          ).rows[0].n,
        ),
        0,
      );
      assert.equal(
        (
          await api("/api/portal/register", {
            fullName: "TEST CONSULT CONTEXT",
            email: "consult-context@example.invalid",
            goal: "Work in China",
            buyingSignal: "Which level is right",
            buyingSignals: ["Asked price", "Asked schedule"],
          })
        ).status,
        200,
      );
      const quick = newHskAttempt("express", randomUUID());
      quick.completedAt = new Date().toISOString();
      for (const q of getVersionQuestions("express"))
        quick.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
      const savedQuick = await api("/api/portal/assessments", {
        attempt: quick,
      });
      assert.equal(savedQuick.status, 200);
      assert.equal(
        savedQuick.data.result.screeningPlacement.suggestedStartLevel,
        3,
      );
      const quickPayload = { ...payload, assessmentAttemptId: quick.attemptId };
      const quickReply = await api("/api/chat", quickPayload);
      assert.equal(quickReply.status, 200);
      assert.match(quickReply.data.reply, /fee details/);
      assert.equal((await api("/api/chat", quickPayload)).status, 200);
      assert.equal(calls, 3);
      const quickRows = (
        await pool.query(
          "SELECT role,status FROM messages WHERE request_id=:p1",
          ["hsk-intro-" + quick.attemptId],
        )
      ).rows;
      assert.deepEqual(quickRows, [{ role: "assistant", status: "completed" }]);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      await new Promise<void>((r) => upstream.close(() => r()));
      await pool.end();
    }
  });
}
