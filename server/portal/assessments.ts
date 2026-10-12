import type { Express } from "express";
import { createHash } from "node:crypto";
import {
  gradeHskAttempt,
  validateHskAttempt,
  type HskLanguage,
} from "../../src/data/hskAssessment.ts";
import { pool, tx, event } from "./store.ts";
import { visitor, wrap, fail } from "./runtime.ts";
export function mountHskAssessments(app: Express) {
  app.get(
    "/api/portal/assessments",
    wrap(async (req, res) => {
      const v = await visitor(req, res);
      const rows = (
        await pool.query(
          "SELECT result FROM hsk_attempts WHERE visitor_id=$1 ORDER BY created_at DESC LIMIT 20",
          [v.id],
        )
      ).rows;
      res.json({ results: rows.map((r) => r.result) });
    }),
  );
  app.post(
    "/api/portal/assessments",
    wrap(async (req, res) => {
      const v = await visitor(req, res);
      const lang: HskLanguage = ["zh", "en", "id"].includes(req.body.lang)
        ? req.body.lang
        : "en";
      let attempt;
      try {
        attempt = validateHskAttempt(req.body.attempt);
      } catch {
        fail(400, "Invalid or incompatible HSK attempt");
      }
      if (!attempt.completedAt) fail(400, "Completed attempt required");
      const digest = createHash("sha256")
        .update(JSON.stringify(attempt))
        .digest("hex");
      const result = await tx(async (c) => {
        const visitorRow = (
          await c.query(
            "SELECT * FROM visitor_sessions WHERE id=$1 FOR UPDATE",
            [v.id],
          )
        ).rows[0];
        const prior = (
          await c.query(
            "SELECT visitor_id,input_hash,result FROM hsk_attempts WHERE id=$1",
            [attempt.attemptId],
          )
        ).rows[0];
        if (prior) {
          if (prior.visitor_id !== v.id) fail(404, "Attempt not found");
          if (prior.input_hash !== digest)
            fail(409, "Attempt already submitted with different answers");
          return {
            ...gradeHskAttempt(attempt, lang),
            saveStatus: "saved" as const,
          };
        }
        const calculated = {
          ...gradeHskAttempt(attempt, lang),
          saveStatus: "saved" as const,
        };
        await c.query(
          "INSERT INTO hsk_attempts(id,visitor_id,lead_id,input_hash,attempt,result) VALUES($1,$2,$3,$4,$5,$6)",
          [
            attempt.attemptId,
            v.id,
            visitorRow.lead_id,
            digest,
            attempt,
            calculated,
          ],
        );
        if (visitorRow.lead_id) {
          await c.query(
            `UPDATE portal_leads SET profile=profile || $2::jsonb || CASE WHEN profile->>'levelSource'='trial' THEN '{}'::jsonb ELSE $3::jsonb END WHERE id=$1`,
            [
              visitorRow.lead_id,
              JSON.stringify({
                quizScore: calculated.score,
                totalQuestions: calculated.questionCount,
                quizMaxScore: calculated.maxScore,
                assessmentProvenance: "server_recomputed_adapted_paper",
                quizResultSummary: calculated.summary,
                quizBreakdown: calculated.breakdown,
                latestAssessment: calculated,
              }),
              JSON.stringify({
                levelConfirmed: calculated.levelConfirmed,
                levelSource: "assessment",
              }),
            ],
          );
          await event(c, "assessment.completed", visitorRow.lead_id, {
            attemptId: attempt.attemptId,
            mode: attempt.mode,
            score: calculated.score,
            maxScore: calculated.maxScore,
            questionCount: calculated.questionCount,
            scoringVersion: attempt.scoringVersion,
          });
        }
        return calculated;
      });
      res.json({ saved: true, result });
    }),
  );
}
