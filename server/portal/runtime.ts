import {contactStatistics} from "../../src/utils/crmContact.ts";
import {processMetrics} from "../../src/utils/crmProcessMetrics.ts";
import {firstTouchAttribution} from "./attribution.ts";
import {saveSalesWorkflow,WorkflowValidationError} from "./salesWorkflow.ts";
import {parseLeadFilters,filterAndSummarize} from '../../src/utils/crmLeadFilters.ts';
import {taskDeadline,leadTier,ensureFollowup,followupReply,type FollowupAction} from './followup.ts';
import {initializeLocalAccounts,mountLocalAuth} from "./localAuth.ts";
import {normalizeCrmMessage} from '../../src/utils/crmMessageTime.ts';
import { safeHskResult } from "../../src/data/hskReportHistory.ts";
import type { Express, Request, Response } from "express";
import {validWebhook,channelConnection,groupRateLimit,CRM_LEADER_ROLE} from "./notificationDelivery.ts";
import crypto from "node:crypto";
import { DEFAULT_CRM_POLICY_CONFIG } from "../../src/types/crmPolicyConfig.ts";
import { pool, tx, id, event, initialize } from "./store.ts";
import { platform, allowed, type Employee } from "./identity.ts";
import {
  defaults,
  defaultRules,
  validate,
  sla,
  schedule,
  withCalendarMode, resolveCalendar, globalWorkCalendar,
  type Rule,
} from "./policy.ts";
import { getSystemInstruction } from "../../src/data/knowledgeBase.ts";
import {loadCampaigns} from "../campaignStorage.ts";
import { mountHskAssessments } from "./assessments.ts";
const cookieName = "uper_visitor";
async function visitor(req: Request, res: Response) {
  let token = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  let row =
    token &&
    (
      await pool.query(
        "SELECT * FROM visitor_sessions WHERE id=$1 AND expires_at>now()",
        [token],
      )
    ).rows[0];
  if (!row) {
    token = crypto.randomBytes(32).toString("hex");
    row = (
      await pool.query(
        "INSERT INTO visitor_sessions(id,expires_at) VALUES($1,now()+interval '30 days') RETURNING *",
        [token],
      )
    ).rows[0];
    res.append(
      "Set-Cookie",
      `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  }
  return row;
}
function wrap(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((e) => {
      console.error("[PORTAL]", e.message);
      if (!res.headersSent)
        res.status(e.status || 503).json({
          saved: typeof e.saved === "boolean" ? e.saved : undefined,
          error: e.status
            ? e.message
            : "Storage or service unavailable; not saved",
        });
      else res.end();
    });
  };
}
function fail(status: number, message: string): never {
  throw Object.assign(Error(message), { status });
}
async function own(req: Request, res: Response) {
  const v = await visitor(req, res);
  const row = (
    await pool.query(
      "SELECT * FROM conversations WHERE id=$1 AND visitor_id=$2",
      [req.body?.conversationId || req.params.id, v.id],
    )
  ).rows[0];
  if (!row) fail(404, "Conversation not found");
  return row;
}
async function staff(req: Request, permission = "crm.read") {
  const e = await platform.authenticate(req);
  if (!e) fail(401, "Education platform authentication required");
  if (!e.permissions.includes(permission)) fail(403, "Permission denied");
  return e;
}
async function leadAccess(req: Request, permission = "crm.read") {
  const e = await staff(req, permission);
  const l = (
    await pool.query("SELECT * FROM portal_leads WHERE id=$1", [
      req.params.id || req.body.leadId,
    ])
  ).rows[0];
  if (!l || !allowed(e, l.profile, permission === "crm.read" ? "read" : "write")) fail(404, "Lead not found");
  return { e, l };
}
async function visibleLeadProfiles(e:any){
      const leads = (
        await pool.query(
          "SELECT l.profile || jsonb_build_object('chatTranscript',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'content',m.content,'timestamp',m.created_at,'created_at',m.created_at,'source',c.source,'metadata',m.metadata,'status',m.status,'error',m.error) ORDER BY m.sequence) FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.lead_id=l.id),'[]'::jsonb)) AS profile FROM portal_leads l ORDER BY created_at DESC",
        )
      ).rows
        .map((r) => ({...r.profile,chatTranscript:(r.profile.chatTranscript || []).map(normalizeCrmMessage)}))
        .filter((p) => allowed(e, p))
;
      const attention = (
        await pool.query(
          `SELECT l.id,clock_timestamp()::text AS observed_at,
        (SELECT count(*) FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id JOIN outbox o ON o.id=j.event_id
         WHERE i.employee_id=$1 AND o.lead_id=l.id AND i.read_at IS NULL AND o.created_at>COALESCE((SELECT seen_at FROM lead_read_marks WHERE employee_id=$1 AND lead_id=l.id),'-infinity'::timestamptz)) AS unread_count,
        (SELECT jsonb_build_object('type',o.type,'at',o.created_at,'source',o.payload->>'source') FROM outbox o WHERE o.lead_id=l.id ORDER BY o.created_at DESC LIMIT 1) AS latest,
        (SELECT jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'ownerId',t.owner_id,'status',t.status,'dueAt',t.due_at,'details',t.details) ORDER BY t.due_at) FROM followup_tasks t WHERE t.lead_id=l.id AND (t.status IN ('open','overdue') OR (t.status='migration_hold' AND l.profile->>'currentStage' NOT IN ('Enrolled','Lost')))) AS tasks,
        (SELECT jsonb_agg(jsonb_build_object('id',t.id,'status',t.status,'dueAt',t.due_at)) FROM followup_tasks t WHERE t.lead_id=l.id AND t.status='completed') AS history
        FROM portal_leads l`,
          [e.id],
        )
      ).rows;
      const byId = new Map(attention.map((a) => [a.id, a]));
      for (const lead of leads) {
        const a = byId.get(lead.id);
        Object.defineProperty(lead,'_taskHistory',{value:a?.history || [],enumerable:false});
        lead.contactStats = contactStatistics(lead);
        lead.attention = {
          unreadCount: Number(a?.unread_count || 0),
          observedAt: a?.observed_at,
          latest: a?.latest,
          tasks: a?.tasks || [],
          isMine:
            lead.owner === e.id ||
            (a?.tasks || []).some((t) => t.ownerId === e.id),
        };
      }

 return leads;
}
export async function mountPortal(app: Express) {
  if (!process.env.DATABASE_URL) {
    app.use(
      [
        "/api/portal",
        "/api/crm",
        "/api/chatbot-inquiry",
        "/api/standalone-chat-lead",
      ],
      (_q, r) => {
        r.status(503).json({ error: "DATABASE_URL required" });
      },
    );
    return;
  }
  await initialize();
  await initializeLocalAccounts();
  mountLocalAuth(app,req=>platform.authenticate(req));
  for (const r of defaultRules)
    await pool.query(
      "INSERT INTO notification_rules(id,version,config,enabled) VALUES($1,1,$2,true) ON CONFLICT DO NOTHING",
      [r.event, r],
    );
  await pool.query(
    "INSERT INTO portal_settings(id,value) VALUES('sla',$1) ON CONFLICT DO NOTHING",
    [{ ...defaults, hotHours: 3, warmHours: 24, coldHours: 48 }],
  );
  app.use("/api", (req, res, next) => {
    if(process.env.PLATFORM_MODE==='local' && req.path.startsWith('/crm') && !['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin!==`${req.protocol}://${req.get('host')}`){res.status(403).json({error:'Origin mismatch'});return;}
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}`
    ) {
      res.status(403).json({ error: "Origin mismatch" });
      return;
    }
    next();
  });
  app.get(
    "/api/portal/ready",
    wrap(async (_req, res) => {
      await pool.query("SELECT 1");
      res.json({ ready: true });
    }),
  );
  app.get(
    "/api/portal/employees",
    wrap(async (req, res) => {
      await staff(req);
      res.json(await platform.employees());
    }),
  );
  app.get(
    "/api/portal/session",
    wrap(async (req, res) => {
      const v = await visitor(req, res);
      res.json({
        registered: !!v.lead_id,
        cacheScope: crypto.createHash("sha256").update(v.id).digest("hex"),
      });
    }),
  );
  app.post(
    "/api/portal/conversations",
    wrap(async (req, res) => {
      const v = await visitor(req, res);
      const source = req.body.source;
      if (!["homepage_widget", "standalone_chat"].includes(source))
        fail(400, "Invalid source");
      const row = await tx(async (c) => {
        await c.query(
          "SELECT id FROM visitor_sessions WHERE id=$1 FOR UPDATE",
          [v.id],
        );
        const old =
          !req.body.newSession &&
          (
            await c.query(
              "SELECT * FROM conversations WHERE visitor_id=$1 AND source=$2 AND updated_at>now()-interval '30 minutes' ORDER BY updated_at DESC LIMIT 1",
              [v.id, source],
            )
          ).rows[0];
        if (old) return old;
        const row = (
          await c.query(
            "INSERT INTO conversations(id,visitor_id,lead_id,source,attribution) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [
              id(),
              v.id,
              v.lead_id,
              source,
              {
                page: String(req.body.page || "").slice(0, 300),
                campaign: String(req.body.campaign || "").slice(0, 100),
              },
            ],
          )
        ).rows[0];
        if (v.lead_id) {
          const last = (
            await c.query(
              "SELECT updated_at FROM conversations WHERE lead_id=$1 AND id<>$2 ORDER BY updated_at DESC LIMIT 1",
              [v.lead_id, row.id],
            )
          ).rows[0];
          if (
            !last ||
            Date.now() - new Date(last.updated_at).getTime() > 86400000
          )
            await event(c, "conversation.reactivated", v.lead_id, { source });
        }
        return row;
      });
      res.json({ conversationId: row.id });
    }),
  );
  app.get(
    "/api/portal/conversations/:id",
    wrap(async (req, res) => {
      const c = await own(req, res);
      res.json({
        conversation: c,
        messages: (
          await pool.query(
            "SELECT * FROM messages WHERE conversation_id=$1 ORDER BY sequence",
            [c.id],
          )
        ).rows,
      });
    }),
  );
  mountHskAssessments(app);
  const register = wrap(async (req, res) => {
    const v = await visitor(req, res);
    const b = req.body;
    if (
      [
        "quizScore",
        "quizMaxScore",
        "totalQuestions",
        "levelConfirmed",
        "quizResultSummary",
        "quizBreakdown",
        "latestAssessment",
      ].some((k) => b[k] !== undefined)
    )
      fail(
        400,
        "Submit answers through the assessment endpoint; client scores are not accepted",
      );
    const name = String(b.fullName || "").trim(),
      phone = String(b.whatsapp || b.phone || "").trim(),
      email = String(b.email || "")
        .trim()
        .toLowerCase();
    if (
      !name ||
      (!phone && !email) ||
      name.length > 200 ||
      phone.length > 40 ||
      email.length > 254
    )
      fail(400, "Contact fields required");
    const result = await tx(async (c) => {
      const locked = (
        await c.query("SELECT * FROM visitor_sessions WHERE id=$1 FOR UPDATE", [
          v.id,
        ])
      ).rows[0];
      const leadId = locked.lead_id || id();
      const existing =
        (
          await c.query("SELECT profile FROM portal_leads WHERE id=$1 FOR UPDATE", [
            leadId,
          ])
        ).rows[0]?.profile || {};
      const profile = {
        ...existing,
        ...firstTouchAttribution(existing,b),
        ...(existing.quizScore !== undefined && !existing.assessmentProvenance
          ? { assessmentProvenance: "legacy_unverified" }
          : {}),
        id: leadId,
        name,
        fullName: name,
        whatsapp: phone,
        email,
        team: existing.team || "sales",
        owner: existing.owner || null,
        currentStage: existing.currentStage || "New",
        tier: existing.tier || "Unqualified",
        submittedAt: existing.submittedAt || new Date().toISOString(),
        entryPoint: existing.entryPoint || b.entryPoint || "homepage_widget",
      };
      if(!locked.lead_id){profile.ownerChangedAt=new Date().toISOString();profile.stageUpdatedAt=profile.submittedAt;}
      for (const k of [
        "currentStatus",
        "goal",
        "reportedLevel",
        "levelState",
        "city",
        "mode",
        "buyingSignal",
      ])
        if (b[k] !== undefined) profile[k] = b[k];
      for(const k of ['goals','buyingSignals'])if(b[k]!==undefined){
        if(!Array.isArray(b[k]) || b[k].length>8 || b[k].some((v:unknown)=>typeof v!=='string' || v.length>160))fail(400,'Invalid consultation preferences');
        profile[k]=b[k];
      }
      if([profile.goal,...(profile.goals || [])].includes('Prepare for HSK certification') && typeof b.hskExamPlan==='string')profile.hskExamPlan=b.hskExamPlan.slice(0,160);
      const numbered = await c.query(
        locked.lead_id
          ? "UPDATE portal_leads SET profile=$2 WHERE id=$1 RETURNING business_number"
          : "INSERT INTO portal_leads(id,profile) VALUES($1,$2) RETURNING business_number",
        [leadId, profile],
      );
      profile.businessNumber = numbered.rows[0].business_number;
      await c.query("UPDATE visitor_sessions SET lead_id=$1 WHERE id=$2", [
        leadId,
        v.id,
      ]);
      await c.query("UPDATE conversations SET lead_id=$1 WHERE visitor_id=$2", [
        leadId,
        v.id,
      ]);
      await c.query(
        "INSERT INTO identity_candidates(visitor_id,lead_id,candidate_id) SELECT $1,$2,id FROM portal_leads WHERE id<>$2 AND (lower(profile->>'email')=$3 OR regexp_replace(profile->>'whatsapp','[^0-9]','','g')=$4) ON CONFLICT DO NOTHING",
        [v.id, leadId, email, phone.replace(/\D/g, "")],
      );
      if (!locked.lead_id) {
        const s = (
          await c.query("SELECT value FROM portal_settings WHERE id='sla'")
        ).rows[0].value;
        profile.tier=leadTier(profile);
        const {due,snapshot}=taskDeadline(profile,'consultation',s);
        const taskId = id();
        profile.slaDueTime = due.toISOString();
        await c.query("UPDATE portal_leads SET profile=$2 WHERE id=$1", [
          leadId,
          profile,
        ]);
        await c.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES($1,$2,$3,$4,$5)",
          [taskId, leadId, "consultation", profile.owner || null, due],
        );
        await event(c, "lead.created", leadId, {
          source: b.entryPoint || "homepage_widget",
          taskId,sla:snapshot,
        });
      }
      // Anonymous follow-up messages are already saved; link them without copying messages.
      const pending=(await c.query("SELECT m.id,m.request_id,m.metadata,c.id conversation_id,c.source FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.visitor_id=$1 AND m.role='assistant' AND m.metadata->>'followupAction' IN ('handoff','booking','enrollment') AND m.metadata->>'taskId' IS NULL ORDER BY m.sequence",[v.id])).rows;
      for(const message of pending){const action=message.metadata.followupAction as FollowupAction;const outcome=await ensureFollowup(c,{id:message.conversation_id,lead_id:leadId,source:message.source},action,message.request_id,message.metadata.language || 'en');await c.query("UPDATE messages SET metadata=metadata || jsonb_build_object('taskId',$2::text) WHERE id=$1",[message.id,outcome.taskId]);}
      // Link previously submitted anonymous attempts without trusting contact-supplied grades.
      await c.query(
        "UPDATE hsk_attempts SET lead_id=$1 WHERE visitor_id=$2 AND lead_id IS NULL",
        [leadId, v.id],
      );
      const latestRows = (await c.query(
        "SELECT result FROM hsk_attempts WHERE visitor_id=$1 ORDER BY created_at DESC LIMIT 20", [v.id]
      )).rows;
      const latest = latestRows.map(row => safeHskResult(row.result)).find(Boolean);
      if (latest) {
        latest.saveStatus = "saved";
        Object.assign(profile, {
          latestAssessment: latest,
          quizScore: latest.score,
          totalQuestions: latest.questionCount,
          quizMaxScore: latest.maxScore,
          quizResultSummary: latest.summary,
          quizBreakdown: latest.breakdown,
          ...(profile.levelSource === "trial"
            ? {}
            : {
                levelConfirmed: latest.levelConfirmed,
                levelSource: "assessment",
              }),
          assessmentProvenance: "server_recomputed_adapted_paper",
        });
        await c.query("UPDATE portal_leads SET profile=$2 WHERE id=$1", [
          leadId,
          profile,
        ]);
      }
      return profile;
    });
    res.json({ success: true, lead: result });
  });
  app.post(
    [
      "/api/portal/register",
      "/api/chatbot-inquiry",
      "/api/standalone-chat-lead",
    ],
    register,
  );
  app.post(
    "/api/portal/actions",
    wrap(async (req, res) => {
      const c = await own(req, res);
      if (!["handoff", "booking", "enrollment"].includes(req.body.action))
        fail(400, "Invalid action");
      const {messageId,content}=req.body;
      if(typeof messageId!=='string'||!messageId.trim()||messageId.length>100||typeof content!=='string'||!content.trim()||content.length>5000)fail(400,'messageId and content required');
      const action=req.body.action as FollowupAction;
      const lang=['zh','en','id'].includes(req.body.language)?req.body.language:'en';
      try {const outcome=await tx(async db=>{
        await db.query('SELECT id FROM visitor_sessions WHERE id=$1 FOR UPDATE',[c.visitor_id]);
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[c.id]);
        const current=(await db.query('SELECT * FROM conversations WHERE id=$1',[c.id])).rows[0];
        const old=(await db.query('SELECT * FROM messages WHERE conversation_id=$1 AND request_id=$2',[c.id,messageId])).rows;
        if(old.length){
          const user=old.find(m=>m.role==='user'),answer=old.find(m=>m.role==='assistant');
          if(user?.content!==content || answer?.metadata?.followupAction!==action)fail(409,'Idempotency key reused with different action or content');
          const taskId=answer.metadata.taskId;
          const task=!taskId?null:(await db.query('SELECT status FROM followup_tasks WHERE id=$1',[taskId])).rows[0];
          const status=!taskId?'contact_required':task?.status==='completed'?'completed':'awaiting_advisor';
          return {taskId:taskId || null,status,reply:followupReply(lang,status)};
        }
        await db.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES($1,$2,$3,'user',$4,'saved')",[id(),c.id,messageId,content]);
        const result=await ensureFollowup(db,current,action,messageId,lang);
        await db.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status,metadata) VALUES($1,$2,$3,'assistant',$4,'completed',$5)",[id(),c.id,messageId,result.reply,{followupAction:action,taskId:result.taskId,language:lang}]);
        await db.query('UPDATE conversations SET updated_at=now() WHERE id=$1',[c.id]);
        if(current.lead_id)await event(db,'conversation.updated',current.lead_id,{source:c.source,taskId:result.taskId});
        return result;
      });res.json({success:true,saved:true,...outcome});}catch(e){throw Object.assign(e,{saved:false});}

    }),
  );
  app.post("/api/crm/leads/sync-chat", (_q, r) => {
    r.status(410).json({ error: "Use owned conversations" });
  });
  app.get(
    "/api/crm/leads",
    wrap(async (req, res) => {
      const e = await staff(req);
      const leads=await visibleLeadProfiles(e);
      let filters;try {filters=parseLeadFilters(req.query);}catch {fail(400,'Invalid lead filters');}
      const settings=(await pool.query("SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy')")).rows;
      const timezone=settings.find(r=>r.id==='sla')?.value.timezone || 'Asia/Jakarta';
      const config={...DEFAULT_CRM_POLICY_CONFIG,...settings.find(r=>r.id==='crm_policy')?.value};
      const now=Date.now();
      const result=filterAndSummarize(leads,filters,e.id,timezone,now,config);
      res.json({...result,processMetrics:processMetrics(result.leads,now),dataScope:e.scope,employeeId:e.id,timezone,ownerOptions:[...new Set(leads.map(l=>l.owner).filter(Boolean))]});
    }),
  );
  app.post(
    "/api/crm/leads/:id/read",
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req);
      const cutoff = req.body.readThrough;
      if (typeof cutoff !== "string" || !Number.isFinite(Date.parse(cutoff)))
        fail(400, "readThrough timestamp required");
      await pool.query(
        `INSERT INTO lead_read_marks(employee_id,lead_id,seen_at) VALUES($1,$2,LEAST($3::timestamptz,clock_timestamp()))
      ON CONFLICT(employee_id,lead_id) DO UPDATE SET seen_at=GREATEST(lead_read_marks.seen_at,excluded.seen_at)`,
        [e.id, l.id, cutoff],
      );
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/crm/leads/:id/tasks",
    wrap(async (req, res) => {
      const { l } = await leadAccess(req);
      res.json(
        (
          await pool.query(
            "SELECT * FROM followup_tasks WHERE lead_id=$1 ORDER BY due_at",
            [l.id],
          )
        ).rows,
      );
    }),
  );
  app.get(
    "/api/crm/leads/:id",
    wrap(async (req, res) => {
      const { l } = await leadAccess(req);
      const rows = (
        await pool.query(
          "SELECT m.*,c.source FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.lead_id=$1 ORDER BY m.sequence",
          [l.id],
        )
      ).rows;
      const transcript = rows.map(normalizeCrmMessage);
      const tasks = (
        await pool.query("SELECT * FROM followup_tasks WHERE lead_id=$1", [
          l.id,
        ])
      ).rows;
      res.json({
        ...l.profile,
        lead: { ...l.profile, chatTranscript: transcript },
        chatTranscript: transcript,
        tasks,
      });
    }),
  );
  app.get(
    "/api/crm/leads/:id/conversations",
    wrap(async (req, res) => {
      const { l } = await leadAccess(req);
      res.json(
        (
          await pool.query("SELECT * FROM conversations WHERE lead_id=$1", [
            l.id,
          ])
        ).rows,
      );
    }),
  );
  app.post('/api/crm/leads/:id/claim',wrap(async(req,res)=>{
    const {l,e}=await leadAccess(req);
    if(!e.roles?.includes('sales') || !e.permissions.includes('crm.write'))fail(403,'Sales claim permission required');
    const lead=await tx(async c=>{
      const current=(await c.query('SELECT profile FROM portal_leads WHERE id=$1 FOR UPDATE',[l.id])).rows[0]?.profile;
      if(!current)fail(404,'Lead not found');
      if(current.owner)fail(409,'Lead has already been assigned; refresh the list');
      if(!allowed(e,current))fail(404,'Lead not found');
      const next={...current,owner:e.id,ownerChangedAt:new Date().toISOString()};
      await c.query('UPDATE portal_leads SET profile=$2 WHERE id=$1',[l.id,next]);
      await c.query("UPDATE followup_tasks SET owner_id=$2 WHERE lead_id=$1 AND status IN ('open','overdue','migration_hold')",[l.id,e.id]);
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES($1,'lead.claim',$2)",[e.id,{id:l.id,owner:e.id}]);
      await event(c,'conversation.updated',l.id,{source:'crm_assignment',assignmentChanged:true});
      return next;
    });res.json({success:true,lead});
  }));
  app.post('/api/crm/leads/:id/attendance',wrap(async(req,res)=>{
    const {l,e}=await leadAccess(req,'crm.write');
    const b=req.body;
    if(typeof b.requestId!=='string' || b.requestId.length>100 || !b.requestId.trim())fail(400,'Attendance request ID required');
    if(!loadCampaigns().some(c=>c.id===b.campaignId))fail(400,'Choose a valid campaign');
    if(typeof b.confirmed!=='boolean' || !['onsite','online'].includes(b.mode) || typeof b.reason!=='string' || !b.reason.trim() || b.reason.length>2000)fail(400,'Choose participation mode and enter evidence');
    const input={campaignId:b.campaignId,confirmed:b.confirmed,mode:b.mode,reason:b.reason.trim()};
    const lead=await tx(async c=>{
      const current=(await c.query('SELECT profile FROM portal_leads WHERE id=$1 FOR UPDATE',[l.id])).rows[0]?.profile;
      if(!current || !allowed(e,current,'write'))fail(404,'Lead not found');
      const previous=(await c.query("SELECT data FROM portal_audit WHERE action='attendance.record' AND data->>'id'=$1 AND data->>'requestId'=$2",[l.id,b.requestId])).rows[0]?.data;
      if(previous){if(JSON.stringify(previous.input)!==JSON.stringify(input)){
        const equal=Object.keys(input).every(k=>previous.input[k]===input[k]);if(!equal)fail(409,'Attendance request conflict');
      }return current;}
      const record={...input,recordedAt:new Date().toISOString(),actor:e.id};
      const next={...current,attendanceRecords:[...(current.attendanceRecords||[]).filter(a=>a.campaignId!==input.campaignId),record]};
      await c.query('UPDATE portal_leads SET profile=$2 WHERE id=$1',[l.id,next]);
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES($1,'attendance.record',$2)",[e.id,{id:l.id,requestId:b.requestId,input}]);
      return next;
    });res.json({success:true,lead});
  }));
  app.patch(
    "/api/crm/leads/:id",
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const directory=await platform.employees();
      const next=await tx(async c=>{
        const current=(await c.query('SELECT profile FROM portal_leads WHERE id=$1 FOR UPDATE',[l.id])).rows[0]?.profile;
        if(!current || !allowed(e,current,"write"))fail(404,'Lead not found');
        if(req.body.communicationLanguage!==undefined && !["en","id","zh","unknown"].includes(req.body.communicationLanguage))fail(400,"Invalid communication language");
        if(req.body.owner!==undefined && req.body.owner!==null && typeof req.body.owner!=='string')fail(400,'Owner must be an active Sales employee');
        const next={...current};
        for(const k of ['owner','currentStage','tier','nextAction','communicationLanguage'])if(req.body[k]!==undefined)next[k]=req.body[k];
        if(req.body.currentStage!==undefined && !['New','Contacted','Assessment Booked','Assessment Done','Trial Booked','Trial Attended','Enrolled','Lost'].includes(req.body.currentStage))fail(400,'Invalid sales stage');
        const ownerChanged=(next.owner||null)!==(current.owner||null);
        if(ownerChanged && !e.permissions.includes('crm.assign'))fail(403,'Lead assignment permission required');
        if(ownerChanged && next.owner && !directory.some(person=>person.id===next.owner && person.active===true && person.roles?.includes('sales')))fail(400,'Owner must be an active Sales employee');
        if(ownerChanged)next.ownerChangedAt=new Date().toISOString();
        if(next.currentStage!==current.currentStage)next.stageUpdatedAt=new Date().toISOString();
        await c.query('UPDATE portal_leads SET profile=$2 WHERE id=$1',[l.id,next]);
        if(ownerChanged)await c.query("UPDATE followup_tasks SET owner_id=$2 WHERE lead_id=$1 AND status IN ('open','overdue','migration_hold')",[l.id,next.owner]);
        await c.query('INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)',[e.id,'lead.update',{id:l.id,changes:req.body}]);
        if(ownerChanged)await event(c,'conversation.updated',l.id,{source:'crm_assignment',assignmentChanged:true});
        return next;
      });
      res.json({ success: true, lead: next });
    }),
  );
  app.get(
    "/api/crm/tasks",
    wrap(async (req, res) => {
      const e = await staff(req);
      res.json(
        (
          await pool.query(
            "SELECT t.*,l.profile FROM followup_tasks t JOIN portal_leads l ON l.id=t.lead_id",
          )
        ).rows
          .filter((t) => allowed(e, t.profile))
          .map(({ profile, ...task }) => task),
      );
    }),
  );
  app.post(
    "/api/crm/tasks/:id/activate",
    wrap(async (req, res) => {
      const e = await staff(req, "crm.write");
      const t = (
        await pool.query(
          "SELECT t.*,l.profile FROM followup_tasks t JOIN portal_leads l ON l.id=t.lead_id WHERE t.id=$1",
          [req.params.id],
        )
      ).rows[0];
      if (!t || !allowed(e, t.profile,"write")) fail(404, "Task not found");
      await tx(async c=>{
        const current=(await c.query('SELECT profile FROM portal_leads WHERE id=$1 FOR UPDATE',[t.lead_id])).rows[0]?.profile;
        if(!current || !allowed(e,current,"write"))fail(404,'Task not found');
        await c.query("UPDATE followup_tasks SET status='open' WHERE id=$1 AND status='migration_hold'",[t.id]);
      });
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/crm/tasks/:id/complete",
    wrap(async (req, res) => {
      await staff(req, "crm.write");
      fail(400,"Record a follow-up result and explicitly select the task");
    }),
  );
  app.get(
    "/api/crm/notifications",
    wrap(async (req, res) => {
      const e = await staff(req);
      res.json(
        (
          await pool.query(
            "SELECT DISTINCT ON (i.content->>'leadId',i.content->>'event') i.*,l.profile AS lead_profile FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id LEFT JOIN portal_leads l ON l.id=i.content->>'leadId' WHERE i.employee_id=$1 ORDER BY i.content->>'leadId',i.content->>'event',j.due_at DESC LIMIT 200",
            [e.id],
          )
        ).rows
          .filter((row) =>
            row.lead_profile
              ? allowed(e, row.lead_profile)
              : e.permissions.includes("notifications.manage"),
          )
          .map(({ lead_profile, ...row }) => row),
      );
    }),
  );
  app.post(
    "/api/crm/notifications/:id/read",
    wrap(async (req, res) => {
      const e = await staff(req);
      await pool.query(
        "UPDATE notification_inbox SET read_at=now() WHERE id=$1 AND employee_id=$2",
        [req.params.id, e.id],
      );
      res.json({ success: true });
    }),
  );
  app.get('/api/crm/notification-routing',wrap(async(req,res)=>{
    await staff(req,'notifications.manage');
    const employees=await platform.employees();
    res.json({mode:'owner_then_crm_leader',leaderRole:CRM_LEADER_ROLE,identityMode:process.env.PLATFORM_MODE || 'disabled',leaders:employees.filter(e=>e.active===true && e.roles?.includes(CRM_LEADER_ROLE) && e.permissions.includes('crm.read') && e.permissions.includes('crm.assign')).map(e=>({id:e.id,teams:e.teams,scope:e.scope})),unresolved:'audit_and_operations_event',scope:'owner_based_lead_notifications'});
  }));
  app.get('/api/crm/notification-options',wrap(async(req,res)=>{
    await staff(req,'notifications.manage');
    const options={sources:['homepage_widget','standalone_chat','legacy_unknown'],tiers:['Unqualified','Hot','Warm-Offline','Warm-Online','School','Cold-Nurture'],states:['New','Contacted','Assessment Booked','Assessment Done','Trial Booked','Trial Attended','Enrolled','Lost'],teams:[] as string[]};
    const actualSources=(await pool.query("SELECT DISTINCT payload->>'source' value FROM outbox WHERE payload ? 'source' UNION SELECT DISTINCT source value FROM conversations")).rows.map(r=>r.value).filter(v=>typeof v==='string' && v.length>0 && v.length<=100);
    options.sources=Array.from(new Set([...options.sources,...actualSources]));
    const employees=await platform.employees();options.teams=Array.from(new Set(employees.flatMap(e=>e.teams)));
    // Historical values remain selectable and are never silently dropped.
    const rules=(await pool.query('SELECT config FROM notification_rules')).rows;
    const leads=(await pool.query("SELECT profile->>'tier' tier,profile->>'currentStage' state,profile->>'team' team FROM portal_leads")).rows;
    for(const key of ['sources','tiers','states','teams'] as const){const legacy=rules.flatMap(r=>Array.isArray(r.config[key])?r.config[key]:[]);const current=key==='sources'?[]:leads.map(l=>l[key==='tiers'?'tier':key==='states'?'state':'team']);options[key]=Array.from(new Set([...options[key],...legacy,...current].filter(v=>typeof v==='string' && v.length>0 && v.length<=100)));}
    res.json(options);
  }));
  app.get('/api/crm/notification-calendar',wrap(async(req,res)=>{
    await staff(req,'notifications.manage');const value=(await pool.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0]?.value;res.json(globalWorkCalendar(value));
  }));
  app.get(
    "/api/crm/notification-rules",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      res.json((await pool.query("SELECT * FROM notification_rules")).rows.map(row=>({...row,config:withCalendarMode(row.config)})));
    }),
  );
  app.post(
    "/api/crm/notification-rules/:id",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      if(!req.body.config || typeof req.body.config!=='object' || Array.isArray(req.body.config))fail(400,'Invalid policy');
      const config=withCalendarMode(req.body.config);
      const calendar=(await pool.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0]?.value;
      try { validate(resolveCalendar(config,calendar)); } catch(e) { fail(400,(e as Error).message); }
      await tx(async (c) => {
        await c.query(
          "SELECT id FROM notification_rules WHERE id=$1 FOR UPDATE",
          [req.params.id],
        );
        const old = (
          await c.query("SELECT version FROM notification_rules WHERE id=$1", [
            req.params.id,
          ])
        ).rows[0];
        const version = (old?.version || 0) + 1;
        await c.query(
          "INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES($1,$2,$3,$4,clock_timestamp()) ON CONFLICT(id) DO UPDATE SET version=$2,config=$3,enabled=$4,effective_at=clock_timestamp()",
          [req.params.id, version, config, req.body.enabled === true],
        );
        await c.query("INSERT INTO rule_versions VALUES($1,$2,$3)", [
          req.params.id,
          version,
          config,
        ]);
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)",
          [e.id, "rule.save", { id: req.params.id, version }],
        );
      });
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/crm/notification-simulate",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      if(!req.body.config || typeof req.body.config!=='object' || Array.isArray(req.body.config))fail(400,'Invalid policy');
      const config=withCalendarMode(req.body.config);
      const calendar=(await pool.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0]?.value;
      try { validate(resolveCalendar(config,calendar)); } catch(e) { fail(400,(e as Error).message); }
      const effective=resolveCalendar(config,calendar);
      const at=new Date(req.body.at || Date.now());
      const eventTime=config.event==='daily.digest' ? schedule(at,{...effective,timing:'digest',businessOnly:false,quiet:undefined},'lark') : at;
      res.json({
        calendar:globalWorkCalendar(calendar),
        sendAt: config.channels.map((channel: string) => ({
          channel,
          at: schedule(eventTime,config.event==='daily.digest'?{...effective,timing:'immediate'}:effective,channel as any),
        })),
        simulation: true,
      });
    }),
  );
  app.get(
    "/api/crm/notification-audit",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      res.json(
        (
          await pool.query(
            "SELECT * FROM portal_audit ORDER BY id DESC LIMIT 200",
          )
        ).rows,
      );
    }),
  );
  app.post('/api/crm/notification-jobs/:id/cancel',wrap(async(req,res)=>{
    const employee=await staff(req,'notifications.manage');
    await tx(async c=>{
      const job=(await c.query('SELECT * FROM notification_jobs WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
      if(!job)fail(404,'Notification not found');
      if(job.state!=='pending')fail(409,'Only pending notifications can be cancelled');
      const reason=String(req.body.reason || 'Cancelled by employee').slice(0,300);
      await c.query("UPDATE notification_jobs SET state='cancelled',result=$2,completed_at=now() WHERE id=$1",[job.id,reason]);
      await c.query('INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)',[employee.id,'notification.cancel',{jobId:job.id,reason}]);
    });res.json({success:true});
  }));
  app.get('/api/crm/integration-readiness',wrap(async(req,res)=>{
    await staff(req,'notifications.manage');
    const channels=(await pool.query('SELECT * FROM notification_channels')).rows.map(row=>{
      const config=row.config;
      return {id:row.id,team:config.team,mode:config.mode,webhookConfigured:validWebhook(process.env[config.secretRef]),signingSecretConfigured:!(config.signingEnabled ?? !!config.signingSecretRef) || !!process.env[config.signingSecretRef],designatedTestGroup:process.env.LARK_TEST_GROUP===row.id,realReceiptVerified:false};
    });
    const missingReferences=(await pool.query("SELECT r.id,r.config->>'group' AS channel FROM notification_rules r LEFT JOIN notification_channels c ON c.id=r.config->>'group' WHERE r.config->'channels' ? 'lark' AND c.id IS NULL")).rows;
    res.json({missingReferences,identity:{mode:process.env.PLATFORM_MODE || 'disabled',adapter:process.env.PLATFORM_MODE==='local'?'local-staff-accounts':'local-fixtures-only',realPlatformVerified:false},channels,releaseReady:false,required:['Real platform identity/directory/scope contract','Designated Lark group receipt with event/job IDs']});
  }));
  app.get(
    "/api/crm/notification-jobs",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      res.json(
        (
          await pool.query(
            "SELECT * FROM notification_jobs ORDER BY due_at DESC LIMIT 200",
          )
        ).rows,
      );
    }),
  );
  app.get(
    "/api/crm/notification-channels",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      res.json({
        channels: await Promise.all((await pool.query("SELECT * FROM notification_channels")).rows.map(async row=>({...row,connection:channelConnection(row.id,row.config),rateLimit:await groupRateLimit(pool,row.id,row.config),usage:(await pool.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE enabled)::int AS enabled FROM notification_rules WHERE config->>'group'=$1 AND config->'channels' ? 'lark'",[row.id])).rows[0]}))),
        unconnected: ["email", "sms"],
      });
    }),
  );
  app.post(
    "/api/crm/notification-channels/:id",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      const { team, secretRef, mode, signingSecretRef, signingEnabled, groupName, teamName, maxPerHour } = req.body;
      const previous=(await pool.query("SELECT config FROM notification_channels WHERE id=$1",[req.params.id])).rows[0]?.config;
      const ref=secretRef ?? previous?.secretRef;
      const signing=signingEnabled ?? previous?.signingEnabled ?? !!(signingSecretRef ?? previous?.signingSecretRef);
      const signingRef=signingSecretRef ?? previous?.signingSecretRef;
      if (!['simulation','live'].includes(mode) ||
        (secretRef!==undefined && (typeof secretRef!=='string'||!/^[A-Z0-9_]{1,80}$/.test(secretRef))) ||
        (signingSecretRef!==undefined && (typeof signingSecretRef!=='string'||!/^[A-Z0-9_]{1,80}$/.test(signingSecretRef))) ||
        (mode==='live' && (typeof ref!=='string' || !/^[A-Z0-9_]{1,80}$/.test(ref))) ||
        (signingEnabled!==undefined && typeof signingEnabled!=='boolean') ||
        (mode==='live' && signing && (typeof signingRef!=='string' || !/^[A-Z0-9_]{1,80}$/.test(signingRef))) ||
        (maxPerHour!==undefined && (!Number.isInteger(maxPerHour)||maxPerHour<0||maxPerHour>10080)) ||
        (groupName!==undefined && (typeof groupName!=='string'||!groupName.trim()||groupName.length>100)) ||
        (!previous && !groupName?.trim()) ||
        (team!==undefined && (typeof team!=='string'||team.length>100)) ||
        (teamName!==undefined && (typeof teamName!=='string'||teamName.length>100)))fail(400,'Invalid channel config');
      const limit=maxPerHour ?? (await groupRateLimit(pool,String(req.params.id),previous)).maxPerHour;
      await pool.query("INSERT INTO notification_channels VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET config=$2",[req.params.id,{...previous,team:team ?? previous?.team,teamName:teamName ?? previous?.teamName,groupName:groupName?.trim() || previous?.groupName,mode,maxPerHour:limit,secretRef:ref,signingSecretRef:signingRef,signingEnabled:signing}]);
      await pool.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)",
        [e.id, "channel.save", { id: req.params.id, team, mode,maxPerHour:limit }],
      );
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/crm/policy-config",
    wrap(async (req, res) => {
      await staff(req);
      const v = (
        await pool.query("SELECT value FROM portal_settings WHERE id='sla'")
      ).rows[0].value;
      const configured=(await pool.query("SELECT value FROM portal_settings WHERE id='crm_policy'")).rows[0]?.value || DEFAULT_CRM_POLICY_CONFIG;
      const displayDuration=(name:string,hours:number)=>{const d=configured.firstResponseSla?.[name];const factor=d?.unit==='minutes'?1/60:d?.unit==='days'?24:d?.unit==='hours'?1:NaN;return d && Number.isFinite(d.value) && d.value*factor===hours?d:{value:hours,unit:'hours'};};
      res.json({
        ...configured,
        businessHours: {
          timezone: v.timezone,
          startTime: v.start,
          endTime: v.end,
          workDays: v.days,
          nextDayGraceTime: v.nextDayGraceTime || v.start,
        },
        firstResponseSla: {
          hot: displayDuration("hot",v.hotHours),
          warm: displayDuration("warm",v.warmHours),
          cold: displayDuration("cold",v.coldHours),
        },
      });
    }),
  );
  app.post(
    "/api/crm/policy-config",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      const old = (
        await pool.query("SELECT value FROM portal_settings WHERE id='sla'")
      ).rows[0].value;
      const b = req.body;
      if (!b || typeof b !== 'object' || Array.isArray(b) || !Object.keys(b).length) fail(400,'Sales operations configuration required');
      const duration=(d:any)=>{if(!d || !['minutes','hours','days'].includes(d.unit)||!Number.isFinite(d.value)||d.value<=0)fail(400,'Invalid SLA duration');return d.value*(d.unit==='minutes'?1/60:d.unit==='days'?24:1);};
      const next = {
        ...old,
        timezone: b.businessHours?.timezone || old.timezone,
        start: b.businessHours?.startTime || old.start,
        end: b.businessHours?.endTime || old.end,
        days: b.businessHours?.workDays || old.days,
        nextDayGraceTime:b.businessHours?.nextDayGraceTime || old.nextDayGraceTime || old.start,
        hotHours: b.firstResponseSla
          ? duration(b.firstResponseSla.hot)
          : old.hotHours,
        warmHours: b.firstResponseSla
          ? duration(b.firstResponseSla.warm)
          : old.warmHours,
        coldHours: b.firstResponseSla
          ? duration(b.firstResponseSla.cold)
          : old.coldHours,
      };
      validate(next);
      for (const k of ["hotHours", "warmHours", "coldHours"])
        if (!Number.isFinite(next[k]) || next[k] <= 0) fail(400, "Invalid SLA");
      await tx(async db=>{
      await db.query("UPDATE portal_settings SET value=$1 WHERE id='sla'", [
        next,
      ]);
      await db.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)",
        [e.id, "sla.save", next],
      );
      await db.query(
        "INSERT INTO portal_settings(id,value) VALUES('crm_policy',$1) ON CONFLICT(id) DO UPDATE SET value=$1",
        [b],
      );
      });
      res.json({ success: true });
    }),
  );
  app.post(
    ["/api/crm/leads/:id/follow-up", "/api/crm/leads/:id/logs", "/api/crm/leads/:id/contact-arrangement"],
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req, "crm.write");
      try {
        const result=await tx(c=>saveSalesWorkflow(c,l.id,e.id,req.body,current=>allowed(e,current,"write")));
        res.json({success:true,...result});
      } catch(error){fail(error instanceof WorkflowValidationError?400:503,error instanceof WorkflowValidationError?error.message:"Follow-up service unavailable");}
    }),
  );
  app.post(
    "/api/crm/notification-jobs/:id/cancel",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      await pool.query(
        "UPDATE notification_jobs SET state='cancelled' WHERE id=$1 AND state='pending'",
        [req.params.id],
      );
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/crm/export",
    wrap(async (req, res) => {
      const e = await staff(req, "crm.export");
      const rows=await visibleLeadProfiles(e);
      let filters;try{filters=parseLeadFilters(req.query);}catch{fail(400,'Invalid lead filters');}
      const settings=(await pool.query("SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy')")).rows;
      const timezone=settings.find(r=>r.id==='sla')?.value.timezone||'Asia/Jakarta';
      const config={...DEFAULT_CRM_POLICY_CONFIG,...settings.find(r=>r.id==='crm_policy')?.value};
      res.attachment("leads.json").json(filterAndSummarize(rows,filters,e.id,timezone,Date.now(),config).leads);
    }),
  );
  app.use("/api/crm/campaigns", (req, res, next) => {
    staff(req, req.method === "GET" ? "crm.read" : "notifications.manage")
      .then(e => {res.locals.crmEmployee=e;next();})
      .catch((e) => res.status(e.status || 503).json({ error: e.message }));
  });
  app.use("/api/crm", (q, r, next) => {
    if (q.path.startsWith("/campaigns")) {
      next();
      return;
    }
    staff(q).then(()=>r.status(501).json({error:"Legacy administrative endpoint disabled; use portal APIs"})).catch(e=>r.status(e.status||503).json({error:e.message}));
  });
}
export { wrap, own, fail, visitor };
