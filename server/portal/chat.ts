import type { Express } from "express";
import { pool, tx, id, event, connection } from "./store.ts";
import { wrap, own, fail } from "./runtime.ts";
import { getSystemInstruction } from "../../src/data/knowledgeBase.ts";
export function mountChat(app: Express) {
  app.post(
    "/api/chat",
    wrap(async (req, res) => {
      if (!process.env.DATABASE_URL)
        fail(503, "Database required; message not saved");
      const conv = await own(req, res);
      const { messageId, content } = req.body;
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
      try { lock = await db.query(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
        [conv.id],
      ); } catch (e) { lease.release(); throw e; }
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
            "SELECT * FROM messages WHERE conversation_id=$1 AND request_id=$2",
            [conv.id, messageId],
          )
        ).rows;
        if (old.length) {
          const user = old.find((m) => m.role === "user");
          if (user?.content !== content)
            fail(409, "Idempotency key reused with different content");
          const answer = old.find((m) => m.role === "assistant");
          if (answer?.status === 'completed') {
            res.json({saved:true,reply:answer.content,modelUsed:answer.model,status:answer.status});
            return;
          }
          assistantId = answer?.id || assistantId;
          await db.query("UPDATE messages SET status='generating',content='',error=NULL,model=NULL WHERE id=$1",[assistantId]);
        } else {
        await transaction(async (c) => {
          await c.query(
            "INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES($1,$2,$3,'user',$4,'saved'),($5,$2,$3,'assistant','','generating')",
            [id(), conv.id, messageId, content, assistantId],
          );
          await c.query(
            "UPDATE conversations SET updated_at=now() WHERE id=$1",
            [conv.id],
          );
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
            "SELECT role,content FROM messages WHERE conversation_id=$1 AND status IN ('saved','completed') ORDER BY sequence",
            [conv.id],
          )
        ).rows.slice(-40);
        const ownedProfile=conv.lead_id?(await db.query('SELECT profile FROM portal_leads WHERE id=$1',[conv.lead_id])).rows[0]?.profile:null;
        const placementContext=ownedProfile?.latestAssessment
          ? '\nVisitor-owned diagnostic result (server-recomputed answers, not HSK certification): '+JSON.stringify({mode:ownedProfile.latestAssessment.attempt.mode,score:ownedProfile.latestAssessment.score,maxScore:ownedProfile.latestAssessment.maxScore,questionCount:ownedProfile.latestAssessment.questionCount,sections:ownedProfile.latestAssessment.sections,thresholds:ownedProfile.latestAssessment.thresholds,summary:ownedProfile.latestAssessment.summary})
          : '';
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
                      getSystemInstruction(false) + placementContext +
                      "\nYou are an AI assistant. Human requests create follow-up tasks; never impersonate an employee.",
                  },
                  ...history,
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
              "INSERT INTO ai_attempts(message_id,model,content) VALUES($1,$2,$3)",
              [assistantId, provider.model, partial],
            );
            break;
          } catch (e) {
            if (stream && !res.destroyed)
              res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
            await db.query(
              "INSERT INTO ai_attempts(message_id,model,content,error) VALUES($1,$2,$3,$4)",
              [assistantId, provider.model, partial, (e as Error).message],
            );
          }
        }
        await transaction(async (c) => {
          await c.query(
            "UPDATE messages SET content=$2,status=$3,model=$4,error=$5 WHERE id=$1",
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
      } catch(e) { throw Object.assign(e as Error,{saved}); } finally {
        try { if (saved)
          await db.query(
            "UPDATE messages SET status='interrupted',error='request_interrupted' WHERE id=$1 AND status='generating'",
            [assistantId],
          );
        await db.query("SELECT pg_advisory_unlock(hashtext($1))", [conv.id]);
        } catch (e) { console.error("[CHAT CLEANUP]", (e as Error).message); } finally { lease.release(); }
      }
    }),
  );
}
