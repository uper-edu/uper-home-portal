import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { newHskAttempt } from "../src/data/hskAssessment";
import { inspectHskHistoryRows } from "../src/data/hskReportHistory";
import { getExamQuestions } from "../src/data/hskQuizQuestions";
import { mountHskAssets } from "../server/hskAssets";
test("learner image/audio uploads are retired, including arbitrary path keys", async () => {
  const app = express();
  app.use(express.json());
  mountHskAssets(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    for (const path of [
      "/api/upload-hsk-extracted-images",
      "/api/upload-hsk-audio",
    ]) {
      const res = await fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: { "../../../outside": "A".repeat(100) },
          audioBase64: "A".repeat(100),
        }),
      });
      assert.equal(res.status, 410);
    }
    const res = await fetch(base + "/api/hsk-images-status");
    assert.equal((await res.json()).total, 21);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
if (process.env.PORTAL_TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PORTAL_TEST_DATABASE_URL;
  process.env.PLATFORM_MODE = "mock";
  const { pool } = await import("../server/portal/store");
  const { mountPortal } = await import("../server/portal/runtime");
  test("HSK attempt persistence and authoritative grading in isolated PostgreSQL", async (t) => {
    const app = express();
    app.use(express.json());
    await mountPortal(app);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.on("listening", r));
    t.after(async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    let cookie = "";
    async function request(path: string, body?: object, other?: string) {
      const res = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          cookie: other ?? cookie,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get("set-cookie");
      if (set && other === undefined) cookie = set.split(";")[0];
      return { status: res.status, data: await res.json() };
    }
    const a = newHskAttempt("full", randomUUID());
    for (const q of getExamQuestions("full"))
      a.answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
    a.completedAt = new Date().toISOString();
    await t.test(
      "save before registration, score forgery ignored, retry idempotent and all answers retained",
      async () => {
        const saved = await request("/api/portal/assessments", {
          attempt: a,
          score: 0,
          levelConfirmed: "FAKE",
          lang: "id",
        });
        assert.equal(saved.status, 200);
        assert.equal(saved.data.result.score, 100);
        assert.equal(saved.data.result.questionCount, 50);
        assert.equal(saved.data.result.maxScore, 100);
        assert.equal(saved.data.result.saveStatus, "saved");
        assert.deepEqual(saved.data.result.attempt.answers, a.answers);
        const retry = await request("/api/portal/assessments", {
          attempt: a,
          lang: "zh",
        });
        assert.equal(retry.status, 200);
        assert.match(retry.data.result.levelConfirmed, /门槛/);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) AS n FROM hsk_attempts WHERE id=$1",
              [a.attemptId],
            )
          ).rows[0].n,
          "1",
        );
        assert.equal(
          (
            await request("/api/portal/assessments", {
              attempt: { ...a, answers: { ...a.answers, 1: null } },
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "other visitors cannot read or overwrite an attempt",
      async () => {
        const originalCookie = cookie;
        const other = await request(
          "/api/portal/assessments",
          undefined,
          "other=1",
        );
        assert.equal(other.status, 200);
        assert.deepEqual(other.data.results, []);
        assert.equal(cookie, originalCookie);
        assert.equal(
          (await request("/api/portal/assessments", { attempt: a }, "other=1"))
            .status,
          404,
        );
      },
    );
    await t.test(
      "contact registration rejects grade claims and links the server-owned report",
      async () => {
        assert.equal(
          (
            await request("/api/portal/register", {
              fullName: "HSK QA",
              email: "hsk@example.invalid",
              quizScore: 100,
              levelConfirmed: "HSK 9",
            })
          ).status,
          400,
        );
        const lead = (
          await request("/api/portal/register", {
            fullName: "HSK QA",
            email: "hsk@example.invalid",
          })
        ).data.lead;
        assert.equal(lead.totalQuestions, 50);
        assert.equal(lead.quizMaxScore, 100);
        assert.equal(lead.quizScore, 100);
        assert.equal(
          lead.assessmentProvenance,
          "server_recomputed_adapted_paper",
        );
        assert.equal(lead.latestAssessment.attempt.attemptId, a.attemptId);
        assert.ok(lead.quizBreakdown);
      },
    );
    await t.test(
      "refresh restores complete reports, replays and invalid versions are rejected",
      async () => {
        const history = (await request("/api/portal/assessments")).data.results;
        assert.equal(
          history.find((r: any) => r.attempt.attemptId === a.attemptId).sections
            .writing.total,
          8,
        );
        assert.equal(
          (
            await request("/api/portal/assessments", {
              attempt: { ...a, attemptId: randomUUID(), examVersion: "stale" },
            })
          ).status,
          400,
        );
        const newer = {
          ...newHskAttempt("express", randomUUID()),
          completedAt: new Date().toISOString(),
          answers: { 1: null },
          plays: { 1: 2 },
          activeSeconds: { 1: 19 },
          audioFailures: [1],
        };
        const result = (
          await request("/api/portal/assessments", { attempt: newer })
        ).data.result;
        assert.equal(result.attempt.plays[1], 2);
        assert.equal(result.attempt.activeSeconds[1], 19);
        assert.equal(result.skippedCount, 1);
        assert.equal(result.unansweredCount, 14);
        assert.equal(result.score, 0);
        assert.equal(
          (await request("/api/portal/assessments")).data.results[0].attempt
            .attemptId,
          newer.attemptId,
        );
      },
    );
    await t.test(
      "an adapted diagnostic never overwrites an existing teacher placement",
      async () => {
        const leadId = (
          await pool.query("SELECT lead_id FROM visitor_sessions WHERE id=$1", [
            cookie.split("=")[1],
          ])
        ).rows[0].lead_id;
        await pool.query(
          "UPDATE portal_leads SET profile=profile || $2::jsonb WHERE id=$1",
          [
            leadId,
            JSON.stringify({ levelConfirmed: "HSK 4", levelSource: "trial" }),
          ],
        );
        const next = {
          ...newHskAttempt("full", randomUUID()),
          completedAt: new Date().toISOString(),
        };
        const saved = await request("/api/portal/assessments", {
          attempt: next,
        });
        assert.equal(saved.status, 200);
        assert.equal(saved.data.result.score, 0);
        const profile = (
          await pool.query("SELECT profile FROM portal_leads WHERE id=$1", [
            leadId,
          ])
        ).rows[0].profile;
        assert.equal(profile.levelConfirmed, "HSK 4");
        assert.equal(profile.levelSource, "trial");
        assert.equal(profile.latestAssessment.score, 0);
        const refreshed = (
          await request("/api/portal/register", {
            fullName: "HSK QA",
            email: "hsk@example.invalid",
          })
        ).data.lead;
        assert.equal(refreshed.levelConfirmed, "HSK 4");
        assert.equal(refreshed.levelSource, "trial");
      },
    );
    await t.test(
      "mixed archived, unavailable and corrupt database reports remain isolated and retain raw records",
      async () => {
        const visitorId = cookie.split("=")[1];
        const legacyAttempt = {
          ...newHskAttempt("full", randomUUID()),
          examVersion: "test-unavailable-legacy",
          scoringVersion: "test-old-rule",
          completedAt: new Date().toISOString(),
        };
        const legacy = {
          attempt: legacyAttempt,
          score: 42,
          maxScore: 100,
          levelConfirmed: "Recorded legacy",
          summary: "Archived unverified snapshot",
          saveStatus: "saved",
        };
        const damagedAttempt = {
          ...newHskAttempt("full", randomUUID()),
          completedAt: new Date().toISOString(),
        };
        for (const [attempt, result] of [
          [legacyAttempt, legacy],
          [damagedAttempt, null],
        ] as const)
          await pool.query(
            "INSERT INTO hsk_attempts(id,visitor_id,input_hash,attempt,result) VALUES($1,$2,$3,$4,$5)",
            [
              attempt.attemptId,
              visitorId,
              "history-qa-fixture",
              JSON.stringify(attempt),
              JSON.stringify(result),
            ],
          );
        const restored = (await request("/api/portal/assessments")).data
          .results;
        const state = inspectHskHistoryRows(restored, "zh");
        assert.ok(
          state.results.some(
            (r) => r.attempt.attemptId === a.attemptId && r.score === 100,
          ),
        );
        assert.equal(
          state.problems.filter((r) => r.reason === "unknown_version").length,
          1,
        );
        assert.equal(
          state.problems.filter((r) => r.reason === "invalid_record").length,
          1,
        );
        assert.equal(
          (await request("/api/portal/assessments", { attempt: legacyAttempt }))
            .status,
          400,
        );
        const registered = await request("/api/portal/register", {
          fullName: "HSK QA",
          email: "hsk@example.invalid",
        });
        assert.equal(registered.status, 200);
        assert.equal(
          registered.data.lead.latestAssessment.attempt.examVersion,
          a.examVersion,
        );
        assert.equal(registered.data.lead.latestAssessment.score, 0);
        assert.equal(registered.data.lead.levelSource, "trial");
        assert.equal(registered.data.lead.levelConfirmed, "HSK 4");
        const raw = (
          await pool.query("SELECT result FROM hsk_attempts WHERE id=$1", [
            legacyAttempt.attemptId,
          ])
        ).rows[0].result;
        assert.deepEqual(raw, legacy);
        assert.equal(
          (
            await pool.query("SELECT result FROM hsk_attempts WHERE id=$1", [
              damagedAttempt.attemptId,
            ])
          ).rows[0].result,
          null,
        );
      },
    );
  });
}
