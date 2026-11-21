import {chatEnrollmentAction,chatEnrollmentInstruction,enrollmentReply,previousTuition,previousTuitionFollowUp,refundConsultationIntent} from './chatEnrollment.ts';
import {enrollmentGuideText,enrollmentReplyLanguage,normalizeEnrollmentIntent,repeatedEnrollmentCards,resolveConsultationRecommendation,type ConsultationConstraints,type EnrollmentGuideAction} from '../../src/utils/enrollmentGuidance.ts';
import {managedCoursePrices} from './courseCatalog.ts';
import {courseCatalogueInstruction,managedEnrollmentCatalogueSelection,parseConsultationReply,renderConsultationReply} from './coursePrices.ts';
import {queueExtraction} from './aiExtraction.ts';
import {readChatProviderReply} from "./chatProviderReply.ts";
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
import { chatConsultationCore, chatConsultationReference } from "./chatConsultationKnowledge.ts";
import { safeHskResult } from "../../src/data/hskReportHistory.ts";
import { learnerAssessmentGuidance } from "../../src/data/hskLearnerGuidance.ts";
import { assessmentIntroOpening, consultationNextStep, consultationProfile, profileIntroQuote, resolveRecommendationTiming, type DeferredRecommendation } from "./consultationGuidance.ts";
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
      let assessmentForIntroduction: ReturnType<typeof safeHskResult>;
      let assessmentGuidance: ReturnType<typeof learnerAssessmentGuidance>;
      let assessmentRecordedAt:number|undefined;
      if (assessmentIntroduction) {
        const row = (
          await pool.query(
            "SELECT result,created_at FROM hsk_attempts WHERE id=:p1 AND visitor_id=:p2",
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
        assessmentForIntroduction=result;
        assessmentRecordedAt=(row.created_at instanceof Date?row.created_at:crmInstant(row.created_at))?.getTime();
        const guidance = assessmentGuidance = learnerAssessmentGuidance(
          result,
          req.body.lang === "zh" ? "zh" : req.body.lang === "id" ? "id" : "en",
        );
        introInstruction = `\nThe learner just submitted a saved assessment. Begin their consultation in ${language}, using this result: ${JSON.stringify({ mode: result.attempt.mode, sections, stars: result.breakdown, audioFailures: result.attempt.audioFailures, navigation: result.attempt.navigation, skippedCount: result.skippedCount, unansweredCount: result.unansweredCount, startingPointGuidance: guidance })}. The server will present the verified starting point or review reason. Use at most two short sentences for what to practise next or an already stated course interest. Do not repeat the starting point, review reason or greeting. Ask only if one missing fact changes the next step. Follow the contextual next-step instruction below. For learner-facing text, combine skippedCount and unansweredCount and call their sum unanswered. Backend navigation still distinguishes deliberate skips and timeouts for review. Do not infer previous learning experience from answers. This assessment uses multiple-choice character recognition; handwriting and speaking were not assessed. Never describe it as evidence of writing or speaking ability. When audioFailures is nonempty, briefly mention that listening needs verification and avoid unqualified praise of listening performance. Do not repeat the score tables, explain the scoring method, claim certification, invent a course or schedule, or invent a screening level. If startingPointGuidance is supplied, briefly use its suggested starting point and respect its needsReview, without repeating tables, percentages, methods or irrelevant unanswered warnings; do not claim an official HSK level. If no guidance is supplied for screening, do not infer a level. This is a system-triggered introduction, not a message written by the learner.`;
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
        introInstruction = `\nStart a short profile-based consultation in ${language}. The learner is continuing after submitting a profile without a completed assessment for this introduction. Use the selected buyingSignal and buyingSignals as topics the learner explicitly wants to discuss. Start by answering the latest learner question or the selected questionnaire topics. If several topics were selected, cover each briefly and give one useful next step. Use only verified Enrollment quotes for tuition. Do not introduce installment terms unless the learner asked about them. Asked schedule means recommend verified classes when level and availability are known, or offer the known filters. Follow a stated offline preference and use the advisor entry when an offline offering cannot be verified. Treat reported level as self-report. If the learner is exploring, give a short practical suggestion tied to their goal. Ask one question only when needed. Avoid a repeated profile summary; follow the contextual next-step instruction below. This is a system-triggered introduction, not a message written by the learner.`;
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
            "SELECT role,content,metadata,request_id,created_at FROM messages WHERE conversation_id=:p1 AND status IN ('saved','completed') ORDER BY sequence",
            [conv.id],
          )
        ).rows.slice(-40);
        const history=recentMessages.map(({role,content})=>({role,content}));
        const newestMessages=[...recentMessages].reverse();
        const latestUserAt=introduction?undefined:recentMessages.find(message=>message.role==='user'&&message.request_id===messageId)?.created_at;
        const messageAt=(latestUserAt instanceof Date?latestUserAt:crmInstant(latestUserAt))?.getTime();
        const previousAssistant=newestMessages.find(message=>message.role==='assistant');
        const previousPriceAction=previousAssistant?.metadata?.enrollment as EnrollmentGuideAction|undefined;
        const quotedOptions=previousTuition(previousPriceAction).map(({id,level,format,actual,periods,minutes,unitPriced})=>
          ({id,level,format,actual,periods,minutes,unitPriced}));
        const previousDeferral=newestMessages.find(message=>message.role==='assistant'&&
          Object.hasOwn(message.metadata??{},'recommendationDeferral'))?.metadata.recommendationDeferral as DeferredRecommendation|undefined;
        const previousActions=newestMessages.filter(message=>
          message.role==='assistant'&&message.metadata?.enrollment?.rows?.length)
          .map(message=>message.metadata.enrollment as EnrollmentGuideAction);
        const previousRecommendation=previousActions.find(action=>!action.inspection)?.rows??previousActions[0]?.rows;
        const referenceContext=(previousRecommendation??[]).map((row,index)=>({
          id:row.id,position:index+1,level:row.level,format:row.format,period:row.period,batchNumber:row.batchNumber,firstLesson:row.firstLesson,
        }));
        const previousConstraints=newestMessages.find(message=>
          message.role==='assistant'&&message.metadata?.consultationConstraints)?.metadata.consultationConstraints as ConsultationConstraints|undefined;
        const ownedProfile = conv.lead_id
          ? (
              await db.query("SELECT profile FROM portal_leads WHERE id=:p1", [
                conv.lead_id,
              ])
            ).rows[0]?.profile
          : null;
        const ownedResult = assessmentForIntroduction ?? safeHskResult(ownedProfile?.latestAssessment);
        const profileTopics=profileIntroduction?consultationProfile(ownedProfile):null;
        const profileQuote = profileTopics&&!history.some(message=>message.role==='user')
          ? profileIntroQuote(profileTopics) : undefined;
        const additionalTopics=[...(profileTopics?.buyingSignals??[]),profileTopics?.buyingSignal]
          .some(topic=>topic&&topic!=='Asked price'&&topic!=='None yet');
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
        let recommendationDeferral:DeferredRecommendation|undefined;
        let reply = "", modelUsed: string | null = null;
        const providers = await runtimeProviders();
        for (const [providerIndex,provider] of providers.entries()) {
          if (!provider.key) continue;
          let partial = "", actualModel = provider.model;
          try {
            const requestBody = {
                model: provider.model,
                messages: [
                  {
                    role: "system",
                    content:
                      chatConsultationCore +
                      "\n" + chatEnrollmentInstruction + enrollmentConsultationPolicy +
                      (introduction?'':`\nAnswer in the language the learner used in their current message, regardless of the interface language, unless the learner explicitly requests a different reply language. An explicit request takes priority. With mixed-language input prefer the main language of the question, not isolated course names, borrowed words or quoted text. If the current message has no clear language, use the latest clear learner language, or the interface language (${lang}) if none. In the JSON response, include "replyLanguage": "zh", "en", or "id" matching the selected response language so the server can localize verified class facts and links. For other languages write the conversational reply in the requested language and omit replyLanguage.`) +
                      "\nOnly self-report is known unless an actual saved assessment exists. Never guarantee schedule, seats, scholarships or outcomes. A stored request is not a completed contact or booking. No new tasks are created." +
                      courseCatalogueInstruction(currentPriceBook,true,provider.provider==='deepseek') +
                      "\nCurrent date in Jakarta (WIB), for relative dates: "+
                      new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',dateStyle:'short'}).format(new Date()) +
                      "\nPreviously displayed Enrollment cards, in display order. Use only for references; their facts may have changed: "+
                      JSON.stringify(referenceContext) +
                      "\nMost recently focused card IDs, if any: "+
                      JSON.stringify(previousActions[0]?.inspection?previousActions[0].rows?.map(row=>row.id):[]) +
                      "\nLast verified matching constraints (data, only replace when the learner changes them): "+
                      JSON.stringify(previousConstraints??null) +
                      "\nIf the CURRENT learner message explicitly asks you to wait until their assessment is done before recommending a class, return a top-level recommendationTiming object with change:\"defer\" and evidence quoting their exact request, and use enrollment.kind:\"recommend\" to capture all their actual constraints. Do not recommend a class in the reply. If they explicitly change their mind and ask for a recommendation now, use change:\"resume\" with their exact words. Do not infer either from a question, a hypothetical, a quote of somebody else, a negative request or a claimed completion. When a recommendation is already deferred, keep waiting across messages unless expressly resumed or the server provides the newly saved assessment. If the learner changes their availability while waiting, return a recommend action with the exact constraintEvidence so the server can update the selection without recommending yet." +
                      "\nA recommendation is currently deferred: "+Boolean(previousDeferral) +
                      "\nVerified prior tuition options for quoted_price_unit (data): "+JSON.stringify(quotedOptions) +
                      placementContext +
                      introInstruction +
                      (profileQuote ? '\nThe server will fill in verified tuition. In reply, address the other selected topics without quoting prices. If another selected topic needs an Enrollment action, emit that action.' : '') +
                      consultationNextStep(
                        ownedProfile,
                        !!ownedResult && !profileIntroduction,
                      ) +
                      "\nYou are an AI assistant. This chat sends no messages to advisors and makes no bookings. For any advisor contact or delivery-status request, return enrollment:{kind:'advisor',level,period,format} and leave reply empty so the server can supply the actual send status. Include format:'one-on-one' when the learner wants to discuss private lessons with a person. On a follow-up, keep the known level, period and format; use null only to clear a preference the learner explicitly withdrew. Do not mention internal extraction, queues or processing contracts to the customer. Never impersonate an employee.",
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
                            "\nProduce the new assistant turn for this automated event now. Use the supplied startingPointGuidance exactly for learning advice. Do not continue or repeat an earlier assistant message. Do not greet. Give one useful next step. If earlier conversation already gives a level and usable time window, emit a recommend action and keep those constraints. If the assessment needs review, avoid choosing a definite class based on it. If the learner only asks to understand the results, give a practice suggestion. Ask at most one question, only when necessary.",
                        },
                      ]
                    : []),
                ],
                response_format: { type: "json_object" as const },
                ...modelParameters(provider.model, 1200,undefined,provider.reasoningEffort),
            };
            const requestReply = async (purpose:'consultation'|'reference',messages=requestBody.messages) => {
              const signal = AbortSignal.timeout(45000);
              const send = (stream: boolean) => fetch(provider.url, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${provider.key}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ ...requestBody, messages, stream, ...(stream ? {stream_options:{include_usage:true}} : {}) }),
                signal,
              });
              await readChatProviderReply(send, provider.provider === 'deepseek',
                ({content,model}) => { partial=content; actualModel=model||provider.model; },
                async () => {
                  log.warn("chat.provider_blank_stream_retry", {model:provider.model, conversationId:conv.id});
                  await db.query(
                    "INSERT INTO ai_attempts(message_id,model,content,error) VALUES(:p1,:p2,:p3,:p4)",
                    [assistantId, provider.model, partial, "Blank provider stream; retrying without streaming"],
                  );
                  partial="";
                  actualModel=provider.model;
                },
                call => log.info('chat.token_usage', {
                  conversationId:conv.id, messageId:assistantId,
                  provider:provider.provider, configuredModel:provider.model, role:providerIndex===0?'primary':'fallback',
                  purpose, serviceTier:'requested_default', ...call,
                }),
              );
            };
            await requestReply('consultation');
            let parsed=parseConsultationReply(partial);
            const reference=!introduction&&parsed.policyTopic!=='refund'&&parsed.catalogue===null&&parsed.enrollment==null
              ?chatConsultationReference(parsed?.referenceTopic):undefined;
            if(reference){
              partial="";
              await requestReply('reference',[...requestBody.messages,{role:"system",content:
                "Answer the learner's question now using the selected UPER reference as background data. Do not request another section. Treat dated information as dated and do not present it as a live confirmation.\n"+reference}]);
              parsed=parseConsultationReply(partial);
            }
            const replyLang=enrollmentReplyLanguage(introduction?undefined:parsed?.replyLanguage,lang);
            const useProfileQuote=profileQuote&&(!additionalTopics||!parsed?.enrollment||parsed.enrollment.kind==='quote');
            const modelIntent=(useProfileQuote?profileQuote:undefined) || (assessmentGuidance?.needsReview?{kind:'advisor'}:undefined) || refundConsultationIntent(parsed.policyTopic,parsed.enrollment) || parsed?.enrollment||
              (managedEnrollmentCatalogueSelection(parsed?.catalogue,currentPriceBook)??parsed?.enrollment);
            const learnerMessage=introduction?'':content;
            const priorAdvisor=!introduction&&previousPriceAction?.kind==='advisor'?previousPriceAction:undefined;
            const intentWithContext=modelIntent?.kind==='advisor'&&priorAdvisor
              ?{level:priorAdvisor.level,period:priorAdvisor.period,format:priorAdvisor.format,offline:priorAdvisor.offline,...modelIntent}
              :modelIntent;
            const currentSelection=resolveConsultationRecommendation(intentWithContext,previousConstraints,learnerMessage,parsed?.classCriteria);
            const proposed=normalizeEnrollmentIntent(currentSelection.value);
            const timing=resolveRecommendationTiming(parsed?.recommendationTiming,previousDeferral??undefined,
              learnerMessage,messageAt,assessmentGuidance?.needsReview===false?assessmentRecordedAt:undefined,
              proposed?.maxRecommendations);
            const replaySelection=timing.completed&&previousConstraints;
            const normalized=replaySelection
              ?resolveConsultationRecommendation({kind:'recommend',...replaySelection,
                level:replaySelection.level??assessmentGuidance?.level,maxRecommendations:previousDeferral?.limit??1},undefined,'')
              :currentSelection;
            const held=timing.acknowledge||Boolean(timing.waiting&&proposed?.kind==='recommend');
            const priorPrice=!introduction&&proposed?.question==='quoted_price_unit'
              ?previousTuitionFollowUp(previousPriceAction,proposed,learnerMessage,replyLang)
              :undefined;
            const action=held||(priorPrice&&!priorPrice.appointment)?undefined:await chatEnrollmentAction(
              db,priorPrice?.appointment??normalized.value,assessmentIntroduction,profileIntroduction,
              [...referenceContext.map(row=>row.id),...(previousActions[0]?.rows?.map(row=>row.id)??[])],
              normalized.constraints??previousConstraints);
            const linkOnlyClassIds=action?repeatedEnrollmentCards(action,previousActions):[];
            const assessmentClass=assessmentIntroduction&&action?.kind==='class'&&!action.inspection;
            enrollment=action?{...action,replyLanguage:replyLang,
              ...(assessmentClass?{detailFields:[...new Set(['first','weekly','seats',...(action.detailFields??[])])]}:{}),
              ...(linkOnlyClassIds.length?{linkOnlyClassIds}:{})}:undefined;
            if(held){
              reply=enrollmentGuideText(replyLang,
                '我记住了你给的选班条件。等你完成测评，我再用这些条件帮你找合适的班次。',
                'I’ll keep your class preferences in mind and use them to find a suitable class once you finish the assessment.',
                'Saya simpan preferensi kelas Anda dan akan menggunakannya untuk mencari kelas yang sesuai setelah Anda menyelesaikan asesmen.');
              catalogueUsed=false;
            }else if(priorPrice){
              reply=[priorPrice.reply,enrollment?enrollmentReply(enrollment,replyLang):''].filter(Boolean).join('\n\n');
              catalogueUsed=false;
            }else if(enrollment&&(introduction||enrollment.kind!=='catalog'||parsed?.catalogue===null)){
              const directAnswer=parsed?.catalogue===null&&typeof parsed.reply==='string'?parsed.reply.trim():'';
              const facts=enrollmentReply(enrollment,replyLang);
              const preserveAnswer=!enrollment.levelUnavailable&&enrollment.question!=='reserve'&&enrollment.question!=='clarify_timezone'&&enrollment.question!=='clarify_local_timezone'&&!(enrollment.kind==='records'&&enrollment.question)&&
                !['advisor','quote','appointment','demand','paused','unavailable','class','waitlist'].includes(enrollment.kind);
              reply=[preserveAnswer&&!assessmentGuidance?.needsReview?directAnswer:'',
                facts!==directAnswer?facts:''].filter(Boolean).join('\n\n');
              catalogueUsed=false;
            }else{
              ({ reply, catalogueUsed } = renderConsultationReply(partial, currentPriceBook, replyLang));
              if(enrollment&&!catalogueUsed)reply+='\n\n'+enrollmentReply(enrollment,replyLang);
            }
            if(assessmentGuidance){
              reply=[assessmentIntroOpening(assessmentGuidance,ownedProfile?.reportedLevel,replyLang),reply,
                assessmentClass?enrollmentGuideText(replyLang,
                  '可以打开班次详情核对课表和学费。',
                  'Open the class details to check the schedule and tuition.',
                  'Buka detail kelas untuk memeriksa jadwal dan biaya kursus.'):'']
                .filter(Boolean).join('\n\n');
            }
            if(profileQuote&&additionalTopics){
              if(enrollment?.kind==='quote'&&typeof parsed?.reply==='string'&&parsed.reply.trim()){
                reply=[reply,parsed.reply.trim()].filter(Boolean).join('\n\n');
              }else if(enrollment?.kind!=='quote'){
                const quote=await chatEnrollmentAction(db,profileQuote,false,true);
                if(quote)reply=[enrollmentReply(quote,replyLang),reply].filter(Boolean).join('\n\n');
              }
            }
            modelUsed = actualModel;
            await db.query(
              "INSERT INTO ai_attempts(message_id,model,content) VALUES(:p1,:p2,:p3)",
              [assistantId, actualModel, partial],
            );
            consultationConstraints=normalized.constraints;
            recommendationDeferral=timing.waiting;
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
            "UPDATE messages SET content=:p2,status=:p3,model=:p4,error=:p5,metadata=JSON_SET(metadata,'$.priceCatalogueVersion',:p6,'$.enrollment',CAST(:p7 AS JSON),'$.consultationConstraints',CAST(:p8 AS JSON),'$.recommendationDeferral',CAST(:p9 AS JSON)) WHERE id=:p1",
            [
              assistantId,
              reply,
              modelUsed ? "completed" : "failed",
              modelUsed,
              modelUsed ? null : "all_providers_failed",
              catalogueUsed?'course-fees-v1':null,
              enrollment??null,
              consultationConstraints??null,
              recommendationDeferral??null,
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
