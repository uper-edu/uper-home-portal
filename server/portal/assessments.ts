import {sameHskSubmission} from '../../src/utils/hskSubmissionIdentity.ts';
import {engagement,fact} from "./trustWorkflow.ts";
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
  app.get('/api/portal/assessments/:attemptId',wrap(async(req,res)=>{
    const v=await visitor(req,res);
    const row=(await pool.query('SELECT result FROM hsk_attempts WHERE id=:p1 AND visitor_id=:p2',[req.params.attemptId,v.id])).rows[0];
    if(!row)fail(404,'Attempt not found');
    res.set('Cache-Control','no-store').json({result:row.result});
  }));
  app.get(
    "/api/portal/assessments",
    wrap(async (req, res) => {
      const v = await visitor(req, res);
      const rows = (
        await pool.query(
          "SELECT result FROM hsk_attempts WHERE visitor_id=:p1 ORDER BY created_at DESC LIMIT 20",
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
            "SELECT * FROM visitor_sessions WHERE id=:p1 FOR UPDATE",
            [v.id],
          )
        ).rows[0];
        const prior = (
          await c.query(
            "SELECT visitor_id,input_hash,attempt,result FROM hsk_attempts WHERE id=:p1",
            [attempt.attemptId],
          )
        ).rows[0];
        if (prior) {
          if (prior.visitor_id !== v.id) fail(404, "Attempt not found");
          if (prior.input_hash !== digest && !sameHskSubmission(prior.attempt,attempt))
            fail(409, "Attempt already submitted with different answers");
          return {...prior.result,saveStatus:"saved" as const};
        }
        const calculated = {
          ...gradeHskAttempt(attempt, lang),
          saveStatus: "saved" as const,
        };
        await c.query(
          "INSERT INTO hsk_attempts(id,visitor_id,lead_id,input_hash,attempt,result) VALUES(:p1,:p2,:p3,:p4,:p5,:p6)",
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
          await c.mergeLeadProfile([
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
          ]);
          await engagement(c,visitorRow.lead_id,"assessment",attempt.attemptId,{attemptId:attempt.attemptId,mode:attempt.mode,score:calculated.score,maxScore:calculated.maxScore});
          await fact(c,visitorRow.lead_id,"assessment.submitted","visitor",{attemptId:attempt.attemptId,mode:attempt.mode,score:calculated.score,maxScore:calculated.maxScore});
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
