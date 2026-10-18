import {engagement} from "./trustWorkflow.ts";
import type { Express } from "express";
import {
  pool,
  tx,
  id,
  event,
  connection,
  databaseConfigured,
} from "./store.ts";
import { wrap, own, fail } from "./runtime.ts";
import { getSystemInstruction } from "../../src/data/knowledgeBase.ts";
import { safeHskResult } from "../../src/data/hskReportHistory.ts";
import { learnerAssessmentGuidance } from "../../src/data/hskLearnerGuidance.ts";
import { consultationNextStep } from "./consultationGuidance.ts";
export function mountChat(app: Express) {
  app.post(
    "/api/chat",
    wrap(async (req, res) => {
      if (!databaseConfigured())
        fail(503, "Database required; message not saved");
      const conv = await own(req, res);
      const assessmentIntroduction =
        typeof req.body.assessmentAttemptId === "string";
      const profileIntroduction = req.body.consultationStart === true;
      const introduction = assessmentIntroduction || profileIntroduction;
      let messageId = req.body.messageId,
        content = req.body.content;
      let introInstruction = "";
      if (assessmentIntroduction) {
        const row = (
          await pool.query(
            "SELECT result FROM hsk_attempts WHERE id=:p1 AND visitor_id=:p2",
            [req.body.assessmentAttemptId, conv.visitor_id],
          )
        ).rows[0];
        const result = safeHskResult(row?.result);
        if (!result) fail(404, "Saved assessment not found");
        messageId = "hsk-intro-" + result.attempt.attemptId;
        content = "assessment consultation";
        const language =
          req.body.lang === "zh"
            ? "Chinese"
            : req.body.lang === "id"
              ? "Indonesian"
              : "English";
        const sections = {
          listening: result.sections.listening,
          reading: result.sections.reading,
          characterRecognition: result.sections.writing,
        };
        const guidance = learnerAssessmentGuidance(
          result,
          req.body.lang === "zh" ? "zh" : req.body.lang === "id" ? "id" : "en",
        );
        introInstruction = `\nThe learner just submitted a saved assessment. Begin their consultation in ${language}, using this result: ${JSON.stringify({ mode: result.attempt.mode, sections, stars: result.breakdown, audioFailures: result.attempt.audioFailures, navigation: result.attempt.navigation, skippedCount: result.skippedCount, unansweredCount: result.unansweredCount, startingPointGuidance: guidance })}. Use at most two short sentences: one learning recommendation (or an answer to their explicit course request), followed by one relevant question. Do not greet again. Follow the contextual next-step instruction below. For learner-facing text, combine skippedCount and unansweredCount and call their sum unanswered. Backend navigation still distinguishes deliberate skips and timeouts for review. Do not infer previous learning experience from answers. This assessment uses multiple-choice character recognition; handwriting and speaking were not assessed. Never describe it as evidence of writing or speaking ability. When audioFailures is nonempty, briefly mention that listening needs verification and avoid unqualified praise of listening performance. Do not repeat the score tables, explain the scoring method, claim certification, invent a course or schedule, or invent a screening level. If startingPointGuidance is supplied, briefly use its suggested starting point and respect its needsReview, without repeating tables, percentages, methods or irrelevant unanswered warnings; do not claim an official HSK level. If no guidance is supplied for screening, do not infer a level. This is a system-triggered introduction, not a message written by the learner.`;
      } else if (profileIntroduction) {
        if (!conv.lead_id)
          fail(404, "Registered consultation profile required");
        messageId = "profile-intro-" + conv.lead_id;
        content = "profile consultation";
        const language =
          req.body.lang === "zh"
            ? "Chinese"
            : req.body.lang === "id"
              ? "Indonesian"
              : "English";
        introInstruction = `\nStart a short profile-based consultation in ${language}. The learner skipped or paused the current assessment. Do not imply they completed it or assign an assessed level from their self-report. Their welcome and profile are already displayed. Address any stated course inquiry first, otherwise output one concise question only, without a greeting or a repeated profile summary; follow the contextual next-step instruction below. This is a system-triggered introduction, not a message written by the learner.`;
      }
      if (
        typeof messageId !== "string" ||
        messageId.length > 100 ||
        typeof content !== "string" ||
        !content.trim() ||
        content.length > 5000
      )
        fail(400, "messageId and content required");
      const lease = await connection();
      const db = lease.client;
      let lock;
      try {
        lock = await db.query("SELECT GET_LOCK(:p1,0) AS acquired", [conv.id]);
      } catch (e) {
        lease.release();
        throw e;
      }
      if (!lock.rows[0].acquired) {
        lease.release();
        fail(409, "Conversation busy; retry same messageId");
      }
      const transaction = async (fn: any) => {
        await db.query("BEGIN");
        try {
          const result = await fn(db);
          await db.query("COMMIT");
          return result;
        } catch (e) {
          await db.query("ROLLBACK").catch(() => {});
          throw e;
        }
      };
      let assistantId = id();
      let saved = false;
      try {
        const old = (
          await db.query(
            "SELECT * FROM messages WHERE conversation_id=:p1 AND request_id=:p2",
            [conv.id, messageId],
          )
        ).rows;
        if (old.length) {
          const user = old.find((m) => m.role === "user");
          if (!introduction && user?.content !== content)
            fail(409, "Idempotency key reused with different content");
          const answer = old.find((m) => m.role === "assistant");
          if (answer?.status === "completed") {
            res.json({
              saved: true,
              reply: answer.content,
              modelUsed: answer.model,
              status: answer.status,
            });
            return;
          }
          assistantId = answer?.id || assistantId;
          await db.query(
            "UPDATE messages SET status='generating',content='',error=NULL,model=NULL WHERE id=:p1",
            [assistantId],
          );
        } else {
          await transaction(async (c) => {
            if (introduction)
              await c.query(
                "INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES(:p1,:p2,:p3,'assistant','','generating')",
                [assistantId, conv.id, messageId],
              );
            else
              await c.query(
                "INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES(:p1,:p2,:p3,'user',:p4,'saved'),(:p5,:p2,:p3,'assistant','','generating')",
                [id(), conv.id, messageId, content, assistantId],
              );
            await c.query(
              "UPDATE conversations SET updated_at=UTC_TIMESTAMP(6) WHERE id=:p1",
              [conv.id],
            );
            if(conv.lead_id&&!introduction)await engagement(c,conv.lead_id,'message',conv.id+':'+messageId,{conversationId:conv.id,requestId:messageId,text:content});
            if (conv.lead_id)
              await event(c, "conversation.updated", conv.lead_id, {
                source: conv.source,
              });
          });
        }
        saved = true;
        const stream = req.body.stream === true;
        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache, no-transform");
          res.write(`data: ${JSON.stringify({ saved: true, messageId })}\n\n`);
        }
        const history = (
          await db.query(
            "SELECT role,content FROM messages WHERE conversation_id=:p1 AND status IN ('saved','completed') ORDER BY sequence",
            [conv.id],
          )
        ).rows.slice(-40);
        const ownedProfile = conv.lead_id
          ? (
              await db.query("SELECT profile FROM portal_leads WHERE id=:p1", [
                conv.lead_id,
              ])
            ).rows[0]?.profile
          : null;
        const ownedResult = safeHskResult(ownedProfile?.latestAssessment);
        const placementContext = ownedResult
          ? "\nVisitor-owned diagnostic result (server-recomputed answers, not HSK certification). Character recognition is multiple choice; writing and speaking were not assessed. Playback errors require listening verification. In learner-facing text, combine skipped and unanswered counts as unanswered. For screening, use only the supplied startingPointGuidance as a tentative learning recommendation, respect startingPointGuidance.needsReview, and never claim an official HSK level: " +
            JSON.stringify({
              mode: ownedResult.attempt.mode,
              score: ownedResult.score,
              maxScore: ownedResult.maxScore,
              questionCount: ownedResult.questionCount,
              sections: {
                listening: ownedResult.sections.listening,
                reading: ownedResult.sections.reading,
                characterRecognition: ownedResult.sections.writing,
              },
              audioFailures: ownedResult.attempt.audioFailures,
              thresholds: ownedResult.thresholds,
              startingPointGuidance: learnerAssessmentGuidance(
                ownedResult,
                req.body.lang === "zh"
                  ? "zh"
                  : req.body.lang === "id"
                    ? "id"
                    : "en",
              ),
            })
          : "";
        let reply = "",
          modelUsed: string | null = null;
        const providers = [
          {
            model: process.env.OPENAI_MODEL || "gpt-4o",
            key: process.env.OPENAI_API_KEY,
            url:
              process.env.OPENAI_API_BASE_URL ||
              "https://api.openai.com/v1/chat/completions",
          },
          {
            model: "deepseek-chat",
            key: process.env.DEEPSEEK_API_KEY,
            url:
              process.env.DEEPSEEK_API_BASE_URL ||
              "https://api.deepseek.com/chat/completions",
          },
        ];
        for (const provider of providers) {
          if (!provider.key) continue;
          let partial = "";
          try {
            const upstream = await fetch(provider.url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${provider.key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: provider.model,
                messages: [
                  {
                    role: "system",
                    content:
                      getSystemInstruction(false) +
                      placementContext +
                      introInstruction +
                      consultationNextStep(
                        ownedProfile,
                        history.filter((m) => m.role === "user").at(-1)
                          ?.content,
                        !!ownedResult && !profileIntroduction,
                      ) +
                      "\nYou are an AI assistant. Human requests create follow-up tasks; never impersonate an employee.",
                  },
                  ...history,
                  ...(introduction
                    ? [
                        {
                          role: "system",
                          content:
                            introInstruction +
                            consultationNextStep(
                              ownedProfile,
                              history.filter((m) => m.role === "user").at(-1)
                                ?.content,
                              assessmentIntroduction,
                            ) +
                            "\nProduce the new assistant turn for this automated event now. Use the supplied startingPointGuidance exactly for learning advice. Do not continue or repeat an earlier assistant message. Do not greet. Use at most two concise sentences and exactly one relevant question.",
                        },
                      ]
                    : []),
                ],
                stream: true,
                max_tokens: 1200,
              }),
              signal: AbortSignal.timeout(45000),
            });
            if (!upstream.ok) throw Error(`Provider HTTP ${upstream.status}`);
            let complete = false;
            if (
              upstream.headers
                .get("content-type")
                ?.includes("text/event-stream")
            ) {
              const reader = upstream.body!.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              while (true) {
                const next = await reader.read();
                if (next.done) break;
                buffer += decoder.decode(next.value, { stream: true });
                let index;
                while ((index = buffer.indexOf("\n")) >= 0) {
                  const line = buffer.slice(0, index).trim();
                  buffer = buffer.slice(index + 1);
                  if (!line.startsWith("data:")) continue;
                  const data = line.slice(5).trim();
                  if (data === "[DONE]") {
                    complete = true;
                    continue;
                  }
                  const payload = JSON.parse(data);
                  if (payload.error) throw Error("Provider stream error");
                  if (payload.choices?.[0]?.finish_reason === "length")
                    throw Error("Answer truncated");
                  const chunk = payload.choices?.[0]?.delta?.content || "";
                  partial += chunk;
                  if (stream && !res.destroyed)
                    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
                }
              }
            } else {
              const payload = await upstream.json();
              partial = payload.choices?.[0]?.message?.content || "";
              complete = payload.choices?.[0]?.finish_reason !== "length";
            }
            if (!partial || !complete) throw Error("Incomplete answer");
            try {
              partial = JSON.parse(partial).reply || partial;
            } catch {}
            reply = partial;
            modelUsed = provider.model;
            await db.query(
              "INSERT INTO ai_attempts(message_id,model,content) VALUES(:p1,:p2,:p3)",
              [assistantId, provider.model, partial],
            );
            break;
          } catch (e) {
            if (stream && !res.destroyed)
              res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
            await db.query(
              "INSERT INTO ai_attempts(message_id,model,content,error) VALUES(:p1,:p2,:p3,:p4)",
              [assistantId, provider.model, partial, (e as Error).message],
            );
          }
        }
        await transaction(async (c) => {
          await c.query(
            "UPDATE messages SET content=:p2,status=:p3,model=:p4,error=:p5 WHERE id=:p1",
            [
              assistantId,
              reply,
              modelUsed ? "completed" : "failed",
              modelUsed,
              modelUsed ? null : "all_providers_failed",
            ],
          );
          if (!modelUsed)
            await event(c, "ai.failed", conv.lead_id, { source: conv.source });
        });
        const result = {
          reply: modelUsed ? reply : "AI 回复失败，消息已保存。请稍后重试。",
          suggestedPrompts: [],
          modelUsed,
          saved: true,
          status: modelUsed ? "completed" : "failed",
          error: modelUsed ? undefined : "all_providers_failed",
        };
        if (stream) {
          res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
          res.write(`data: ${JSON.stringify({ chunk: result.reply })}\n\n`);
          res.write(`data: ${JSON.stringify({ ...result, done: true })}\n\n`);
          res.end();
        } else res.json(result);
      } catch (e) {
        throw Object.assign(e as Error, { saved });
      } finally {
        try {
          if (saved)
            await db.query(
              "UPDATE messages SET status='interrupted',error='request_interrupted' WHERE id=:p1 AND status='generating'",
              [assistantId],
            );
          await db.query("SELECT RELEASE_LOCK(:p1)", [conv.id]);
        } catch (e) {
          console.error("[CHAT CLEANUP]", (e as Error).message);
        } finally {
          lease.release();
        }
      }
    }),
  );
}
