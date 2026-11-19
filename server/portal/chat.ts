import {chatEnrollmentAction,chatEnrollmentInstruction,enrollmentReply} from './chatEnrollment.ts';
import {enrollmentGuideText,enrollmentReplyLanguage,repeatedEnrollmentCards,resolveConsultationRecommendation,type ConsultationConstraints,type EnrollmentGuideAction} from '../../src/utils/enrollmentGuidance.ts';
import {managedCoursePrices} from './courseCatalog.ts';
import {courseCatalogueInstruction,managedEnrollmentCatalogueSelection,renderConsultationReply} from './coursePrices.ts';
import {queueExtraction} from './aiExtraction.ts';
import {runtimeProviders} from './aiServiceConfig.ts';
import {modelParameters} from './modelParameters.ts';
import {crmInstant} from '../../src/utils/crmOperatingTime.ts';
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
import { enrollmentConsultationPolicy } from "./enrollmentConsultationPolicy.ts";
import { log } from "../logger.ts";
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
      let assessmentStartingPoint:string|undefined;
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
        if(guidance)assessmentStartingPoint=guidance.needsReview?guidance.review:enrollmentGuideText(
          req.body.lang==='zh'||req.body.lang==='id'?req.body.lang:'en',
          `测评建议你从${guidance.start}开始。`,
          `Your assessment suggests starting with ${guidance.start}.`,
          `Hasil asesmen menyarankan kamu mulai dari ${guidance.start}.`,
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
              enrollment: answer.metadata?.enrollment ?? undefined,
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
            // Lock the customer before FK-backed evidence inserts to avoid
            // shared-lock upgrades across simultaneous conversations.
            if(conv.lead_id)await c.query("SELECT id FROM portal_leads WHERE id=:p1 FOR UPDATE",[conv.lead_id]);
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
            let notificationMessageId:string|undefined;
            if(conv.lead_id&&!introduction){const source=(await c.query("SELECT id,created_at FROM messages WHERE conversation_id=:p1 AND request_id=:p2 AND role='user'",[conv.id,messageId])).rows[0];notificationMessageId=source.id;await queueExtraction(c,conv.lead_id,'customer_message',source.id,content,(source.created_at instanceof Date ? source.created_at : crmInstant(source.created_at))?.toISOString()||null,'visitor');}
            if (conv.lead_id)
              await event(c, "conversation.updated", conv.lead_id, {
                source: conv.source,conversationId:conv.id,messageId:notificationMessageId,
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
        const recentMessages = (
          await db.query(
            "SELECT role,content,metadata FROM messages WHERE conversation_id=:p1 AND status IN ('saved','completed') ORDER BY sequence",
            [conv.id],
          )
        ).rows.slice(-40);
        const history=recentMessages.map(({role,content})=>({role,content}));
        const previousActions=[...recentMessages].reverse().filter(message=>
          message.role==='assistant'&&message.metadata?.enrollment?.rows?.length)
          .map(message=>message.metadata.enrollment as EnrollmentGuideAction);
        const previousRecommendation=previousActions.find(action=>!action.inspection)?.rows??previousActions[0]?.rows;
        const referenceContext=(previousRecommendation??[]).map((row,index)=>({
          id:row.id,position:index+1,level:row.level,format:row.format,period:row.period,batchNumber:row.batchNumber,firstLesson:row.firstLesson,
        }));
        const previousConstraints=[...recentMessages].reverse().find(message=>
          message.role==='assistant'&&message.metadata?.consultationConstraints)?.metadata.consultationConstraints as ConsultationConstraints|undefined;
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
        const currentPriceBook = await managedCoursePrices(pool) ?? { courses: [] };
        const lang = req.body.lang === 'id' || req.body.lang === 'en' ? req.body.lang : 'zh';
        let catalogueUsed = false;
        let enrollment:EnrollmentGuideAction|undefined;
        let consultationConstraints:ConsultationConstraints|undefined;
        let reply = "", modelUsed: string | null = null;
        for (const provider of await runtimeProviders()) {
          if (!provider.key) continue;
          let partial = "", actualModel = provider.model;
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
                      (introduction?'':`\nAnswer in the language the learner used in their current message, regardless of the interface language, unless the learner explicitly requests a different reply language. An explicit request takes priority. With mixed-language input prefer the main language of the question, not isolated course names, borrowed words or quoted text. If the current message has no clear language, use the latest clear learner language, or the interface language (${lang}) if none. In the JSON response, include "replyLanguage": "zh", "en", or "id" matching the selected response language so the server can localize verified class facts and links. For other languages write the conversational reply in the requested language and omit replyLanguage.`) +
                      "\nOnly self-report is known unless an actual saved assessment exists. Never guarantee schedule, seats, scholarships or outcomes. A stored request is not a completed contact or booking. No new tasks are created." +
                      courseCatalogueInstruction(currentPriceBook,true) + chatEnrollmentInstruction + enrollmentConsultationPolicy +
                      "\nCurrent date in Jakarta (WIB), for relative dates: "+
                      new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',dateStyle:'short'}).format(new Date()) +
                      "\nPreviously displayed Enrollment cards, in display order. Use only for references; their facts may have changed: "+
                      JSON.stringify(referenceContext) +
                      "\nMost recently focused card IDs, if any: "+
                      JSON.stringify(previousActions[0]?.inspection?previousActions[0].rows?.map(row=>row.id):[]) +
                      "\nLast verified matching constraints (data, only replace when the learner changes them): "+
                      JSON.stringify(previousConstraints??null) +
                      placementContext +
                      introInstruction +
                      consultationNextStep(
                        ownedProfile,
                        !!ownedResult && !profileIntroduction,
                      ) +
                      "\nYou are an AI assistant. Human requests are evidence and hints only, never new tasks or a booking confirmation. Never claim a request was routed or an advisor will contact them; say their original message is saved and any appointment still needs advisor confirmation. Do not mention internal extraction, queues or processing contracts to the customer. Never impersonate an employee.",
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
                              assessmentIntroduction,
                            ) +
                            "\nProduce the new assistant turn for this automated event now. Use the supplied startingPointGuidance exactly for learning advice. Do not continue or repeat an earlier assistant message. Do not greet. Use at most two concise sentences and exactly one relevant question.",
                        },
                      ]
                    : []),
                ],
                stream: true,
                response_format: { type: "json_object" },
                ...modelParameters(provider.model, 1200),
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
                  actualModel = payload.model || actualModel;
                  if (payload.error) throw Error("Provider stream error");
                  if (payload.choices?.[0]?.finish_reason === "length")
                    throw Error("Answer truncated");
                  const chunk = payload.choices?.[0]?.delta?.content || "";
                  partial += chunk;
                  // Only validated complete replies are sent to the client.
                }
              }
            } else {
              const payload = await upstream.json();
              actualModel = payload.model || actualModel;
              partial = payload.choices?.[0]?.message?.content || "";
              complete = payload.choices?.[0]?.finish_reason !== "length";
            }
            if (!partial.trim() || !complete) throw Error("Incomplete answer");
            const parsed=JSON.parse(partial);
            const replyLang=enrollmentReplyLanguage(introduction?undefined:parsed?.replyLanguage,lang);
            const modelIntent=parsed?.enrollment||
              (managedEnrollmentCatalogueSelection(parsed?.catalogue,currentPriceBook)??parsed?.enrollment);
            const normalized=resolveConsultationRecommendation(modelIntent,previousConstraints,introduction?'':content);
            const action=await chatEnrollmentAction(db,normalized.value,assessmentIntroduction,profileIntroduction,
              referenceContext.map(row=>row.id),previousConstraints);
            const linkOnlyClassIds=action?repeatedEnrollmentCards(action,previousActions):[];
            enrollment=action?{...action,replyLanguage:replyLang,...(linkOnlyClassIds.length?{linkOnlyClassIds}:{})}:undefined;
            if(enrollment&&(enrollment.kind!=='catalog'||parsed?.catalogue===null)){
              const directAnswer=parsed?.catalogue===null&&typeof parsed.reply==='string'?parsed.reply.trim():'';
              const facts=enrollmentReply(enrollment,replyLang);
              const preserveAnswer=!enrollment.levelUnavailable&&enrollment.question!=='reserve'&&!(enrollment.kind==='records'&&enrollment.question)&&
                !['quote','appointment','demand','paused','unavailable','class','waitlist'].includes(enrollment.kind);
              reply=[preserveAnswer?directAnswer:'',assessmentIntroduction&&!directAnswer?assessmentStartingPoint:'',
                facts!==directAnswer?facts:''].filter(Boolean).join('\n\n');
              catalogueUsed=false;
            }else{
              ({ reply, catalogueUsed } = renderConsultationReply(partial, currentPriceBook, replyLang));
              if(enrollment&&!catalogueUsed)reply+='\n\n'+enrollmentReply(enrollment,replyLang);
            }
            modelUsed = actualModel;
            await db.query(
              "INSERT INTO ai_attempts(message_id,model,content) VALUES(:p1,:p2,:p3)",
              [assistantId, actualModel, partial],
            );
            consultationConstraints=normalized.constraints;
            break;
          } catch (e) {
            if (stream && !res.destroyed)
              res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
            log.warn("chat.provider_failed", { model: provider.model, conversationId: conv.id, error: e as Error });
            await db.query(
              "INSERT INTO ai_attempts(message_id,model,content,error) VALUES(:p1,:p2,:p3,:p4)",
              [assistantId, provider.model, partial, (e as Error).message],
            );
          }
        }
        await transaction(async (c) => {
          await c.query(
            "UPDATE messages SET content=:p2,status=:p3,model=:p4,error=:p5,metadata=JSON_SET(metadata,'$.priceCatalogueVersion',:p6,'$.enrollment',CAST(:p7 AS JSON),'$.consultationConstraints',CAST(:p8 AS JSON)) WHERE id=:p1",
            [
              assistantId,
              reply,
              modelUsed ? "completed" : "failed",
              modelUsed,
              modelUsed ? null : "all_providers_failed",
              catalogueUsed?'course-fees-v1':null,
              enrollment??null,
              consultationConstraints??null,
            ],
          );
          if (!modelUsed) {
            log.error("chat.all_providers_failed", { conversationId: conv.id, messageId: assistantId });
            await event(c, "ai.failed", conv.lead_id, { source: conv.source,conversationId:conv.id,messageId:assistantId });
          }
        });
        const result = {
          reply: modelUsed ? reply : "AI 回复失败，消息已保存。请稍后重试。",
          suggestedPrompts: [],
          enrollment:modelUsed?enrollment:undefined,
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
          log.error("chat.cleanup_failed", { conversationId: conv.id, error: e as Error });
        } finally {
          lease.release();
        }
      }
    }),
  );
}
