import {attachIdentityContactHolds,canonicalIdentity,assertIdentitySalesAllowed,lockIdentityRegistry,projectIdentityProfiles,identityProjectionRows} from './identityConsolidation.ts';
import {attachQuestionnaireBasicSources} from './questionnaireSources.ts';
import {saveAttendance} from "./attendance.ts";
import {ownerAssignmentBody,changeLeadOwner,ownerReceipt} from './ownerAssignment.ts';
import {containsRemovedProfileMetadata} from './removedProfileMetadata.ts';
import {hasInapplicableExamPlan,hasHskQuestionnaireGoal,validateQuestionnaireAnswers} from '../../src/utils/crmQuestionnaire.ts';
import {attachEnrollmentEvidence} from './enrollmentEvidence.ts';
import {salesProgressStages} from '../../src/utils/crmSalesProgress.ts';
import {contactOverview} from '../../src/utils/crmContactOverview.ts';
import {campaignSaveResultHandler} from './campaignSaveResults.ts';
import {correctedSignalSources} from '../../src/utils/crmExtractionEvidence.ts';
import {extractionHints} from '../../src/utils/crmExtractionHints.ts';
import {initialTierProvenance} from './tierProvenance.ts';
import {randomUUID} from 'node:crypto';
import {recordProfileUpdates} from './dynamicProfile.ts';
import {profileFields,basicProfileFields,dynamicProfileHints} from '../../src/utils/crmDynamicProfile.ts';
import {attachInteractionTimelines} from './interactionTimeline.ts';
import {saveSimpleSalesWorkflow as saveSalesWorkflow} from './simpleSalesWorkflow.ts';
import {mergePolicyTopic,topicPatch,type PolicyTopic} from '../../src/utils/crmPolicyTopics.ts';
import {requestDeadline} from './taskManagement.ts';
import {isCrmManager} from '../../src/utils/crmOutreach.ts';
import {attachIdentity,pendingIdentity,discoverIdentity,identityControls} from './identityReview.ts';
import {leadChanges} from "./leadChanges.ts";
import {promotionAttribution} from "./campaignPromotion.ts";
import {validContactEmail, CONTACT_EMAIL_ERROR} from "../../src/utils/contactEmail.ts";
import {validContactPhone, CONTACT_PHONE_ERROR} from "../../src/utils/contactPhone.ts";
import {recordCampaignSource} from './campaignSources.ts';
import {attachFactMilestones} from "./factMilestones.ts";
import { attachBuyingEvidence } from "./buyingEvidence.ts";
import {mountTrustRoutes} from "./trustRoutes.ts";
import {fact,contactsConflict,stageFact,engagement,normalizeContactPhone} from "./trustWorkflow.ts";
import { mountAccessOperations } from "./accessOperations.ts";
import { mountAccessHandovers } from "./accessHandovers.ts";
import { mountAccessRecovery } from "./accessRecovery.ts";
import { accessRestoreGate } from "./accessRecoveryState.ts";
import { trustedOrigin } from "./accessTransport.ts";
import {initializeTeamlessAccess} from "./teamlessAccess.ts";
import {mountAccessManagement} from './accessManagement.ts';
import {eligibleOwner,permittedRecord,canClaimRecord} from '../../src/utils/accessControl.ts';
import { contactStatistics } from "../../src/utils/crmContact.ts";
import { processMetrics } from "../../src/utils/crmProcessMetrics.ts";
import { firstTouchAttribution } from "./attribution.ts";
import { WorkflowValidationError } from "./salesWorkflow.ts";
import {
  parseLeadFilters,
  filterAndSummarize,
} from "../../src/utils/crmLeadFilters.ts";
import {
  taskDeadline,
  leadTier,
  ensureFollowup,
  followupReply,
  type FollowupAction,
} from "./followup.ts";
import { initializeLocalAccounts, mountLocalAuth } from "./localAuth.ts";
import { normalizeCrmMessage } from "../../src/utils/crmMessageTime.ts";
import { safeHskResult } from "../../src/data/hskReportHistory.ts";
import type { Express, Request, Response } from "express";
import {
  validWebhook,
  channelConnection,
  groupRateLimit,
  CRM_LEADER_ROLE,
} from "./notificationDelivery.ts";
import crypto from "node:crypto";
import { DEFAULT_CRM_POLICY_CONFIG } from "../../src/types/crmPolicyConfig.ts";
import { effectivePolicy, mergePolicyConfig, policySla } from "../../src/utils/crmPolicyConfigValidation.ts";
import {
  pool,
  tx,
  id,
  event,
  initialize,
  databaseConfigured,
} from "./store.ts";
import { platform, allowed, type Employee } from "./identity.ts";
import {
  defaults,
  defaultRules,
  validate,
  sla,
  schedule,
  withCalendarMode,
  resolveCalendar,
  globalWorkCalendar,
  type Rule,
} from "./policy.ts";
import { getSystemInstruction } from "../../src/data/knowledgeBase.ts";
import { loadCampaigns } from "../campaignStorage.ts";
import { mountHskAssessments } from "./assessments.ts";
const cookieName = "uper_visitor";
async function visitor(req: Request, res: Response) {
  if (res.locals.portalVisitor) return res.locals.portalVisitor;
  let token = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  let row =
    token &&
    (
      await pool.query(
        "SELECT * FROM visitor_sessions WHERE id=:p1 AND expires_at>UTC_TIMESTAMP(6)",
        [token],
      )
    ).rows[0];
  if (!row) {
    token = crypto.randomBytes(32).toString("hex");
    row = (
      await pool.query(
        "INSERT INTO visitor_sessions(id,expires_at) VALUES(:p1,UTC_TIMESTAMP(6)+INTERVAL 30 day)",
        [token],
      )
    ).rows[0];
    res.append(
      "Set-Cookie",
      `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  }
  const expected = req.headers['x-visitor-scope'];
  if (expected && expected !== crypto.createHash('sha256').update(row.id).digest('hex')) fail(409, 'Visitor identity changed');
  res.locals.portalVisitor = row;
  return row;
}
function wrap(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => {
    Promise.resolve().then(()=>{if(containsRemovedProfileMetadata(req.body))fail(400,"不支持的资料字段");return fn(req,res);}).catch((e) => {
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
      "SELECT * FROM conversations WHERE id=:p1 AND visitor_id=:p2",
      [req.body?.conversationId || req.params.id, v.id],
    )
  ).rows[0];
  if (!row) fail(404, "Conversation not found");
  return row;
}
function requestPermission(req:Request,original:string){
 const path=req.originalUrl.split('?')[0];
 if(original==='notifications.manage'){
  if(path.includes('/policy-config'))return 'crm.operations.manage';
  if(path.includes('/campaigns'))return 'campaigns.manage';
  return ['GET','HEAD'].includes(req.method)?'notifications.read':'notifications.manage';
 }
 if(original==='crm.write'){
  if(req.method==='PATCH'&&path.includes('/leads/')&&ownerAssignmentBody(req.body))return 'crm.assign';
  if(/\/(?:logs|follow-up|contact-arrangement|information|task-actions|identity-actions|engagement-actions)$/.test(path)||path.includes('/tasks/'))return 'crm.followup';
  if(path.endsWith('/attendance'))return 'crm.attendance';
 }
 return original;
}
function requestAllowed(e:Employee,profile:any,req:Request,permission='crm.write'){
 if(!e.grants)return allowed(e,profile,permission==='crm.read'?'read':'write');
 let action=requestPermission(req,permission);if(action==='crm.assign'&&!e.permissions.includes('crm.assign'))action='crm.write';return allowed(e,profile,'read')&&(action==='crm.read'||permittedRecord(e,profile,action));
}
async function staff(req: Request, permission = "crm.read") {
  const e = await platform.authenticate(req);
  if (!e) fail(401, "Education platform authentication required");
  let action=e.grants ? requestPermission(req,permission) : permission;
  if(action==='crm.assign'&&!e.permissions.includes('crm.assign'))action='crm.write';
  if (!e.permissions.includes(action)) fail(403, "Permission denied");
  return e;
}
async function leadAccess(req: Request, permission = "crm.read") {
  const e = await staff(req, permission);
  let l = (
    await pool.query("SELECT * FROM portal_leads WHERE id=:p1", [
      req.params.id || req.body.leadId,
    ])
  ).rows[0];
  if(!l)fail(404,'Lead not found');
  const identityEndpoint=/\/(identity-comparison|identity-actions|operations)(?:\/|$)/.test(req.path);
  if(l.profile.identityMergedInto){
    const root=await canonicalIdentity(pool,l.id);
    if(!root||!requestAllowed(e,root.profile,req,permission))fail(404,'Lead not found');
    if(!identityEndpoint){
      if(!['GET','HEAD'].includes(req.method))fail(409,'IDENTITY_RECORD_MERGED');
      l={...l,...root,profile:{...root.profile,identityResolvedFrom:l.id}};
    }
  }else if(!requestAllowed(e,l.profile,req,permission))fail(404,'Lead not found');
  if(!['GET','HEAD'].includes(req.method)&&!identityEndpoint&&!req.path.endsWith('/contact-authorization'))await assertIdentitySalesAllowed(pool,l.id);
  if(['GET','HEAD'].includes(req.method)&&!identityEndpoint)l.profile=(await projectIdentityProfiles(pool,[l.profile]))[0]||l.profile;
  return { e, l };
}
async function visibleLeadProfiles(e: any) {
  const snapshot = (await pool.query("SELECT DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%fZ') AS cutoff")).rows[0].cutoff;
  const leads = await projectIdentityProfiles(pool,(await pool.exportLeads([])).rows
    .map((r) => ({
      ...r.profile,
      chatTranscript: (r.profile.chatTranscript || []).map(normalizeCrmMessage),
    }))
    .filter((p) => allowed(e, p)));
  await attachLeadAttention(e, leads, snapshot);
  await attachBuyingEvidence(pool,leads);
  await attachFactMilestones(pool,leads);
  return leads;
}
async function attachLeadAttention(e: any, leads: any[], snapshot?: string) {
  await attachQuestionnaireBasicSources(pool,leads);
  await attachEnrollmentEvidence(pool,leads);
  await attachIdentity(pool,e,leads);
  await attachIdentityContactHolds(pool,leads);
  await attachInteractionTimelines(pool,leads);
  const textExtractions=leads.length?(await pool.query("SELECT id,lead_id,source_type,source_id,status,input,output,created_at FROM crm_ai_extractions WHERE status='completed' AND JSON_CONTAINS(:p1,JSON_QUOTE(lead_id)) ORDER BY created_at DESC,id DESC",[JSON.stringify(leads.map(l=>l.id))])).rows:[];
  const attention = (await pool.leadAttention([e.id, leads.map(l=>l.id), snapshot])).rows;
  const requests=await identityProjectionRows(pool,leads,"SELECT * FROM crm_engagements WHERE kind='task_request' AND JSON_CONTAINS(:p1,JSON_QUOTE(lead_id))");
  const pendingMap=new Map<string,number>();for(const r of requests)pendingMap.set(r.lead_id,(pendingMap.get(r.lead_id)||0)+1);
  const cuePolicy=(await pool.query("SELECT value FROM portal_settings WHERE id='crm_policy'")).rows[0]?.value?.inactivityWatchdog;
  const byId = new Map(attention.map((a) => [a.id, a]));
  for (const lead of leads) {
    const a = byId.get(lead.id);
    Object.defineProperty(lead, "_taskHistory", {
      value: a?.history || [],
      enumerable: false,
    });
    lead.contactStats = contactStatistics(lead);
    lead.extractionSignalCorrections=correctedSignalSources(textExtractions.filter((r:any)=>r.lead_id===lead.id));
    lead.informationHints=[...extractionHints(textExtractions.filter((r:any)=>r.lead_id===lead.id)),...dynamicProfileHints(lead)];
    lead.contactOverview=contactOverview(lead,{inactivityWatchdog:cuePolicy});
    lead.attention = {
      inactivity: lead.contactOverview.stale,
      requestCount: pendingMap.get(lead.id)||0,
      latest: a?.latest,
      customerRequests:requests.filter((r:any)=>r.lead_id===lead.id).map((r:any)=>({id:r.id,dueAt:r.data.dueAt,action:r.data.action})),
      tasks: (a?.tasks || []).map((t:any)=>({...t,requestDueAt:requestDeadline(t,requests)})),
      isMine:
        lead.owner === e.id || (a?.tasks || []).some((t) => t.ownerId === e.id),
    };
  }

}
export async function mountPortal(app: Express) {
  if (!databaseConfigured()) {
    app.use(
      [
        "/api/portal",
        "/api/crm",
        "/api/chatbot-inquiry",
        "/api/standalone-chat-lead",
      ],
      (_q, r) => {
        r.status(503).json({ error: "Database configuration required" });
      },
    );
    return;
  }
  await initialize();
  await initializeLocalAccounts();
  app.use(accessRestoreGate);
  mountAccessOperations(app);
  mountLocalAuth(app, (req) => platform.authenticate(req));
  mountAccessHandovers(app);
  mountAccessRecovery(app);
  mountAccessManagement(app);
  for (const r of defaultRules)
    await pool.query(
      "INSERT INTO notification_rules(id,version,config,enabled) VALUES(:p1,1,:p2,:p3) ON DUPLICATE KEY UPDATE id=id",
      [r.event, r, !["task.created","task.rescheduled","task.appointment_due"].includes(r.event)],
    );
  await initializeTeamlessAccess();
  await pool.query(
    "INSERT INTO portal_settings(id,value) VALUES('sla',:p1) ON DUPLICATE KEY UPDATE id=id",
    [{ ...defaults, hotHours: 3, warmHours: 24, coldHours: 48 }],
  );
  app.use("/api", (req, res, next) => {
    if (
      process.env.PLATFORM_MODE === "local" &&
      req.path.startsWith("/crm") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== trustedOrigin(req)
    ) {
      res.status(403).json({ error: "Origin mismatch" });
      return;
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== trustedOrigin(req)
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
      res.json((await platform.employees()).map(e=>({id:e.id,displayName:e.displayName,active:e.active,roles:e.roles,roleLabels:e.roleLabels,permissions:e.permissions.filter(p=>['crm.read','crm.own','crm.followup'].includes(p)),grants:e.grants?{}:undefined})));
    }),
  );
  app.get(
    "/api/portal/session",
    wrap(async (req, res) => {
      const v = await visitor(req, res);
      const lead = v.lead_id ? (await pool.query(`SELECT profile FROM portal_leads WHERE id=:p1`,[v.lead_id])).rows[0]?.profile : null;
      // Return only learner-facing questionnaire fields, never internal CRM notes or routing.
      const publicFields = ['id','fullName','whatsapp','email','currentStatus','goal','goals','city','cityDetail','mode','reportedLevel','levelState','language','submittedAt'];
      res.setHeader('Cache-Control','no-store');
      res.json({
        registered: !!v.lead_id,
        cacheScope: crypto.createHash("sha256").update(v.id).digest("hex"),
        profile: lead ? Object.fromEntries(publicFields.filter(k=>lead[k]!==undefined).map(k=>[k,lead[k]])) : null,
      });
    }),
  );
  app.post("/api/portal/new-person",wrap(async(req,res)=>{
    await visitor(req,res);
    res.append("Set-Cookie",`${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({success:true});
  }));
  app.post(
    "/api/portal/conversations",
    wrap(async (req, res) => {
      const v = await visitor(req, res);
      const source = req.body.source;
      if (!["homepage_widget", "standalone_chat"].includes(source))
        fail(400, "Invalid source");
      const row = await tx(async (c) => {
        await c.query(
          "SELECT id FROM visitor_sessions WHERE id=:p1 FOR UPDATE",
          [v.id],
        );
        const old =
          !req.body.newSession &&
          (
            await c.query(
              "SELECT * FROM conversations WHERE visitor_id=:p1 AND source=:p2 AND updated_at>UTC_TIMESTAMP(6)-INTERVAL 30 minute ORDER BY updated_at DESC LIMIT 1",
              [v.id, source],
            )
          ).rows[0];
        if (old) return old;
        const row = (
          await c.query(
            "INSERT INTO conversations(id,visitor_id,lead_id,source,attribution) VALUES(:p1,:p2,:p3,:p4,:p5)",
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
              "SELECT updated_at FROM conversations WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND id<>:p2 ORDER BY updated_at DESC LIMIT 1",
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
            "SELECT * FROM messages WHERE conversation_id=:p1 ORDER BY sequence",
            [c.id],
          )
        ).rows,
      });
    }),
  );
  mountHskAssessments(app);
  const register = wrap(async (req, res) => {
    const b = req.body;
    validateQuestionnaireAnswers(b);
    const v = await visitor(req, res);
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
    // Hidden/inapplicable fields are not customer answers. Older clients must not save a default plan.
    if (hasInapplicableExamPlan(b))
      fail(400, "未选择HSK备考目标，不能保存考试计划");
    for (const field of ["whatsapp", "phone"]) {
      if (b[field] !== undefined && typeof b[field] !== "string") fail(400, CONTACT_PHONE_ERROR);
    }
    if (!validContactPhone(b.whatsapp || b.phone || "", false)) fail(400, CONTACT_PHONE_ERROR);
    if (!validContactEmail(b.email === undefined ? "" : b.email, false)) fail(400, CONTACT_EMAIL_ERROR);
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
      await lockIdentityRegistry(c);
      const locked = (
        await c.query(
          "SELECT * FROM visitor_sessions WHERE id=:p1 FOR UPDATE",
          [v.id],
        )
      ).rows[0];
      const leadId = locked.lead_id || id();
      const existing =
        (
          await c.query(
            "SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",
            [leadId],
          )
        ).rows[0]?.profile || {};
      if(contactsConflict(existing,b)) fail(409,"Contact identity changed; start a separate visitor session");
      const promotion = await promotionAttribution(c, existing, b);
      let profile:any = {
        ...existing,
        ...firstTouchAttribution(existing, b),
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
        currentStage: existing.currentStage || "progress:unreached",
        tier: existing.tier || "Unqualified",
        submittedAt: existing.submittedAt || new Date().toISOString(),
        entryPoint: existing.entryPoint || b.entryPoint || "homepage_widget",
        ...promotion,
      };
      if (!locked.lead_id) {
        profile.ownerChangedAt = new Date().toISOString();
        profile.stageUpdatedAt = profile.submittedAt;
      }
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
      for (const k of ["goals", "buyingSignals"])
        if (b[k] !== undefined) {
          if (
            !Array.isArray(b[k]) ||
            b[k].length > 8 ||
            b[k].some((v: unknown) => typeof v !== "string" || v.length > 160)
          )
            fail(400, "Invalid consultation preferences");
          profile[k] = b[k];
        }
      if (
        [profile.goal, ...(profile.goals || [])].includes(
          "Prepare for HSK certification",
        ) &&
        typeof b.hskExamPlan === "string"
      )
        profile.hskExamPlan = b.hskExamPlan.slice(0, 160);
      await recordCampaignSource(c,profile);
      const numbered = await c.query(
        locked.lead_id
          ? "UPDATE portal_leads SET profile=:p2 WHERE id=:p1"
          : "INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",
        [leadId, profile],
      );
      profile.businessNumber = numbered.rows[0].business_number;
      const questionnaireFactId=randomUUID();
      const fieldInput:any={};for(const k of Object.keys({...profileFields,...basicProfileFields})){if(k==='hskExamPlan'&&!hasHskQuestionnaireGoal(b.goal,b.goals))continue;if(b[k]!==undefined&&b[k]!==null&&b[k]!==''&&(!Array.isArray(b[k])||b[k].length))fieldInput[k]=b[k];if(existing[k]!==undefined)profile[k]=existing[k];else delete profile[k];}
      const updated=await recordProfileUpdates(c,profile,fieldInput,null,{actor:'visitor',sourceType:'questionnaire',sourceRecordId:questionnaireFactId,basisFactIds:[questionnaireFactId],occurredAt:new Date().toISOString(),recordedAt:new Date().toISOString(),reason:'客户提交问卷'});
      profile=updated.profile;await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,profile]);

      await c.query("UPDATE visitor_sessions SET lead_id=:p1 WHERE id=:p2", [
        leadId,
        v.id,
      ]);
      await c.query(
        "UPDATE conversations SET lead_id=:p1 WHERE visitor_id=:p2",
        [leadId, v.id],
      );
      const matches=await discoverIdentity(c,v.id,leadId,profile);
      if(!locked.lead_id&&matches||profile.identityLifecycle==='pending'){
        profile.identityLifecycle='pending';
        delete profile.currentStage;delete profile.tier;delete profile.stageUpdatedAt;
        await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,profile]);
      }
      if (!locked.lead_id&&!matches) {
        const s = (
          await c.query("SELECT value FROM portal_settings WHERE id='sla'")
        ).rows[0].value;
        profile.tier = leadTier(profile);
        Object.assign(profile,initialTierProvenance(profile,questionnaireFactId,new Date().toISOString()));
        const { due, snapshot } = taskDeadline(profile, "consultation", s);
        const taskId = id();
        profile.slaDueTime = due.toISOString();
        await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
          leadId,
          profile,
        ]);
        await c.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES(:p1,:p2,:p3,:p4,:p5)",
          [taskId, leadId, "consultation", profile.owner || null, due],
        );
        await event(c, "lead.created", leadId, {
          source: b.entryPoint || "homepage_widget",
          taskId,
          sla: snapshot,
        });
      }
      // Anonymous follow-up messages are already saved; link them without copying messages.
      const pending = (
        await c.query(
          "SELECT m.id,m.request_id,m.metadata,c.id conversation_id,c.source FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.visitor_id=:p1 AND m.role='assistant' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(m.metadata,'$.followupAction')),'null') IN ('handoff','booking','enrollment') AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(m.metadata,'$.taskId')),'null') IS NULL ORDER BY m.sequence",
          [v.id],
        )
      ).rows;
      for (const message of pending) {
        const action = message.metadata.followupAction as FollowupAction;
        const outcome = await ensureFollowup(
          c,
          {
            id: message.conversation_id,
            lead_id: leadId,
            source: message.source,
          },
          action,
          message.request_id,
          message.metadata.language || "en",
        );
        await c.query(
          "UPDATE messages SET metadata=JSON_SET(metadata,'$.taskId',:p2,'$.taskOperation',:p3) WHERE id=:p1",
          [message.id, outcome.taskId, outcome.taskOperation || null],
        );
      }
      const priorMessages=(await c.query("SELECT m.*,c.id AS source_conversation FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.visitor_id=:p1 AND (c.lead_id=:p2 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2)) AND m.role='user'",[v.id,leadId])).rows;
      for(const m of priorMessages)await engagement(c,leadId,'message',m.source_conversation+':'+m.request_id,{conversationId:m.source_conversation,requestId:m.request_id,text:m.content,messageRecordedAt:m.created_at});
      // Link previously submitted anonymous attempts without trusting contact-supplied grades.
      await c.query(
        "UPDATE hsk_attempts SET lead_id=:p1 WHERE visitor_id=:p2 AND lead_id IS NULL",
        [leadId, v.id],
      );
      const latestRows = (
        await c.query(
          "SELECT result FROM hsk_attempts WHERE visitor_id=:p1 ORDER BY created_at DESC LIMIT 20",
          [v.id],
        )
      ).rows;
      const attempts=(await c.query("SELECT id,result FROM hsk_attempts WHERE visitor_id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2))",[v.id,leadId])).rows;
      for(const a of attempts.filter((r:any)=>r.result&&typeof r.result==='object'))await engagement(c,leadId,"assessment",a.id,{attemptId:a.id,mode:a.result.mode,score:a.result.score,maxScore:a.result.maxScore});
      const latest = latestRows
        .map((row) => safeHskResult(row.result))
        .find(Boolean);
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
        await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
          leadId,
          profile,
        ]);
      }
      await fact(c,leadId,"questionnaire.submitted","visitor",{answers:b,previous:Object.fromEntries(["fullName","whatsapp","email","goal","goals","city","mode","reportedLevel"].map(k=>[k,existing[k]??null]))},questionnaireFactId);
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
      const { messageId, content } = req.body;
      if (
        typeof messageId !== "string" ||
        !messageId.trim() ||
        messageId.length > 100 ||
        typeof content !== "string" ||
        !content.trim() ||
        content.length > 5000
      )
        fail(400, "messageId and content required");
      const action = req.body.action as FollowupAction;
      const lang = ["zh", "en", "id"].includes(req.body.language)
        ? req.body.language
        : "en";
      try {
        const outcome = await tx(async (db) => {
          await db.query(
            "SELECT id FROM visitor_sessions WHERE id=:p1 FOR UPDATE",
            [c.visitor_id],
          );
          await db.query("SELECT GET_LOCK(:p1,5) AS acquired", [c.id]);
          const current = (
            await db.query("SELECT * FROM conversations WHERE id=:p1", [c.id])
          ).rows[0];
          const old = (
            await db.query(
              "SELECT * FROM messages WHERE conversation_id=:p1 AND request_id=:p2",
              [c.id, messageId],
            )
          ).rows;
          if (old.length) {
            const user = old.find((m) => m.role === "user"),
              answer = old.find((m) => m.role === "assistant");
            if (
              user?.content !== content ||
              answer?.metadata?.followupAction !== action
            )
              fail(
                409,
                "Idempotency key reused with different action or content",
              );
            const taskId = answer.metadata.taskId;
            const task = !taskId
              ? null
              : (
                  await db.query(
                    "SELECT status FROM followup_tasks WHERE id=:p1",
                    [taskId],
                  )
                ).rows[0];
            const status = !taskId
              ? (answer.metadata.taskOperation==='review_required'&&c.lead_id?"awaiting_advisor":"contact_required")
              : task?.status === "completed"
                ? "completed"
                : "awaiting_advisor";
            return {
              taskId: taskId || null,
              taskOperation: answer.metadata.taskOperation,
              status,
              reply: followupReply(lang, status, action),
            };
          }
          await db.query(
            "INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES(:p1,:p2,:p3,'user',:p4,'saved')",
            [id(), c.id, messageId, content],
          );
          const result = await ensureFollowup(
            db,
            current,
            action,
            messageId,
            lang,
          );
          await db.query(
            "INSERT INTO messages(id,conversation_id,request_id,role,content,status,metadata) VALUES(:p1,:p2,:p3,'assistant',:p4,'completed',:p5)",
            [
              id(),
              c.id,
              messageId,
              result.reply,
              { followupAction: action, taskId: result.taskId, language: lang, taskOperation: result.taskOperation },
            ],
          );
          await db.query(
            "UPDATE conversations SET updated_at=UTC_TIMESTAMP(6) WHERE id=:p1",
            [c.id],
          );
          if (current.lead_id)
            await event(db, "conversation.updated", current.lead_id, {
              source: c.source,
              taskId: result.taskId,
            });
          return result;
        });
        res.json({ success: true, saved: true, ...outcome });
      } catch (e) {
        throw Object.assign(e, { saved: false });
      }
    }),
  );
  app.post("/api/crm/leads/sync-chat", (_q, r) => {
    r.status(410).json({ error: "Use owned conversations" });
  });
  app.get("/api/crm/lead-changes", wrap(async (req,res)=>{
    const employee=await staff(req);
    res.set("Cache-Control","no-store").json(await leadChanges(pool,employee));
  }));
  app.get(
    "/api/crm/leads",
    wrap(async (req, res) => {
      const e = await staff(req);
      const changes = await leadChanges(pool,e);
      const leads = await visibleLeadProfiles(e);
      let filters;
      try {
        filters = parseLeadFilters(req.query);
      } catch {
        fail(400, "Invalid lead filters");
      }
      const settings = (
        await pool.query(
          "SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy')",
        )
      ).rows;
      let timezone = settings.find((r) => r.id === "sla")?.value.timezone || "Asia/Jakarta";
      if (req.query.viewerTimezone !== undefined) {
        if (typeof req.query.viewerTimezone !== 'string') fail(400, 'Invalid display timezone');
        try { new Intl.DateTimeFormat('en', {timeZone: String(req.query.viewerTimezone)}); }
        catch { fail(400, 'Invalid display timezone'); }
        timezone = String(req.query.viewerTimezone);
      }
      const config = {
        ...DEFAULT_CRM_POLICY_CONFIG,
        ...settings.find((r) => r.id === "crm_policy")?.value,
      };
      const now = Date.now();
      const result = filterAndSummarize(
        leads,
        filters,
        e.id,
        timezone,
        now,
        config,
      );
      res.json({
        ...result,
        accessibleCount: leads.length,
        changeCursor: changes.cursor,
        processMetrics: processMetrics(result.leads, now),
        dataScope: e.scope,
        employeeId: e.id,
        timezone,
        ownerOptions: [...new Set(leads.map((l) => l.owner).filter(Boolean))],
      });
    }),
  );
  app.get(
    "/api/crm/leads/:id/tasks",
    wrap(async (req, res) => {
      const { l } = await leadAccess(req);
      res.json(
        (
          await pool.query(
            "SELECT * FROM followup_tasks WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY due_at",
            [l.id],
          )
        ).rows,
      );
    }),
  );
  app.get(
    "/api/crm/leads/:id",
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req);
      await attachLeadAttention(e, [l.profile]);
      const rows = (
        await pool.query(
          "SELECT m.*,c.source FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE (c.lead_id=:p1 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY m.sequence",
          [l.id],
        )
      ).rows;
      const transcript = rows.map(normalizeCrmMessage);
      const tasks = (
        await pool.query("SELECT * FROM followup_tasks WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1))", [
          l.id,
        ])
      ).rows;
      await attachBuyingEvidence(pool,[l.profile]);
      await attachFactMilestones(pool,[l.profile]);
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
          await pool.query("SELECT * FROM conversations WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1))", [
            l.id,
          ])
        ).rows,
      );
    }),
  );
  app.post(
    "/api/crm/leads/:id/claim",
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req);
      if (!(e.grants ? e.permissions.includes("crm.claim") : e.roles?.includes("sales") && e.permissions.includes("crm.write")))
        fail(403, "Sales claim permission required");
      const lead = await tx(async (c) => {
        if((await identityControls(c)).ownerAssignmentManagerOnly&&!isCrmManager(e))fail(403,"OWNER_MANAGER_REQUIRED");
        const current = (
          await c.query(
            "SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",
            [l.id],
          )
        ).rows[0]?.profile;
        if (!current) fail(404, "Lead not found");
        await assertIdentitySalesAllowed(c,l.id);
        if ((await pendingIdentity(c,l.id,true)).length) fail(409,"IDENTITY_REVIEW_REQUIRED");
        if (current.owner)
          fail(409, "Lead has already been assigned; refresh the list");
        if (!allowed(e, current)) fail(404, "Lead not found");
        if(e.grants&&!canClaimRecord(e,current))fail(404,'Lead not found');
        const next = {
          ...current,
          owner: e.id,
          ownerChangedAt: new Date().toISOString(),
        };
        await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
          l.id,
          next,
        ]);
        await c.query(
          "UPDATE followup_tasks SET owner_id=:p2 WHERE lead_id=:p1 AND status IN ('open','overdue','migration_hold')",
          [l.id, e.id],
        );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'lead.claim',:p2)",
          [e.id, { id: l.id, owner: e.id }],
        );
        await fact(c,l.id,'owner.changed',e.id,{before:null,after:e.id,beforeName:'未分配',afterName:e.displayName||e.id,reason:'自己认领',changedAt:next.ownerChangedAt,requestId:randomUUID()});
        await event(c, "conversation.updated", l.id, {
          source: "crm_assignment",
          assignmentChanged: true,
        });
        return next;
      });
      res.json({ success: true, lead });
    }),
  );
  app.post(
    "/api/crm/leads/:id/attendance",
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const lead = await tx(c => saveAttendance(c,l.id,e.id,req.body,loadCampaigns(),current=>requestAllowed(e,current,req)));
      res.json({ success: true, lead });
    }),
  );
  app.patch(
    "/api/crm/leads/:id",
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const directory = await platform.employees();
      const next = await tx(async (c) => {
        const current = (
          await c.query(
            "SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",
            [l.id],
          )
        ).rows[0]?.profile;
        if (!current || !requestAllowed(e,current,req))
          fail(404, "Lead not found");
        await assertIdentitySalesAllowed(c,l.id);
        if(Object.hasOwn(req.body||{},'owner')){
          if(!ownerAssignmentBody(req.body))fail(400,'负责人变更必须单独保存');
          return changeLeadOwner(c,{actor:e,current,body:req.body,directory,managerOnly:(await identityControls(c)).ownerAssignmentManagerOnly,pendingIdentity:(await pendingIdentity(c,l.id,true)).length>0,fact,event});
        }
        if (
          req.body.communicationLanguage !== undefined &&
          !["en", "id", "zh", "unknown"].includes(
            req.body.communicationLanguage,
          )
        )
          fail(400, "Invalid communication language");
        if (
          req.body.owner !== undefined &&
          req.body.owner !== null &&
          typeof req.body.owner !== "string"
        )
          fail(400, "Owner must be an active Sales employee");
        if(req.body.currentStage!==undefined&&req.body.currentStage!==current.currentStage)fail(400,'请使用销售阶段独立保存入口并关联依据');
        let next = { ...current };
        if(req.body.tier!==undefined){
          if(!['Hot','Warm-Offline','Warm-Online','Cold-Nurture','School','Unqualified'].includes(req.body.tier))fail(400,'Invalid Tier');
          next.tierConfirmed=req.body.tier;
          next.tierSource='sales_confirmed';
          next.tierUpdatedAt=new Date().toISOString();
        }
        for (const k of [
          "owner",
          "currentStage",
          "tier",
          "nextAction",
          "communicationLanguage",
        ])
          if (req.body[k] !== undefined) next[k] = req.body[k];
        if (
          req.body.currentStage !== undefined &&
          ![
            "New",
            "Contacted",
            "Assessment Booked",
            "Assessment Done",
            "Trial Booked",
            "Trial Attended",
            "Enrolled",
            "Lost",
          ].includes(req.body.currentStage)
        )
          fail(400, "Invalid sales stage");
        if(req.body.communicationLanguage!==undefined){const changed=await recordProfileUpdates(c,{...next,communicationLanguage:current.communicationLanguage,profileFieldMeta:current.profileFieldMeta},{communicationLanguage:req.body.communicationLanguage},null,{actor:e.id,sourceType:'sales_edit',occurredAt:null,recordedAt:new Date().toISOString(),reason:'员工明确更新首选沟通语言'});next=changed.profile;}
        const ownerChanged = (next.owner || null) !== (current.owner || null);
        if(ownerChanged && (await pendingIdentity(c,l.id,true)).length)fail(409,"IDENTITY_REVIEW_REQUIRED");
        if(ownerChanged&&(await identityControls(c)).ownerAssignmentManagerOnly&&!isCrmManager(e))fail(403,"OWNER_MANAGER_REQUIRED");
        if (ownerChanged && (!e.permissions.includes("crm.assign") || e.grants && !permittedRecord(e,current,"crm.assign")))
          fail(403, "Lead assignment permission required");
        if (
          ownerChanged &&
          next.owner &&
          !directory.some(
            (person) =>
              person.id === next.owner &&
              person.active === true &&
              eligibleOwner(person),
          )
        )
          fail(400, "Owner must be an active Sales employee");
        if(ownerChanged&&next.owner&&e.grants){const target=directory.find(person=>person.id===next.owner)!;const assigned={...current,owner:next.owner};if(!allowed(target,assigned,'read')||!permittedRecord(target,assigned,'crm.followup'))fail(400,'Owner cannot access and follow up this customer');}
        if (ownerChanged) next.ownerChangedAt = new Date().toISOString();
        if (next.currentStage !== current.currentStage){
          await stageFact(c,l.id,e.id,current,{newStage:next.currentStage,expectedStage:req.body.expectedStage,expectedStageRevision:req.body.expectedStageRevision},req.body.stageReason);
          next.stageUpdatedAt = new Date().toISOString();
          next.stageRevision=(current.stageRevision||0)+1;
        }
        await fact(c,l.id,"profile.changed",e.id,{before:Object.fromEntries(Object.keys(req.body).filter(k=>k in current).map(k=>[k,current[k]])),changes:req.body});
        await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
          l.id,
          next,
        ]);
        if (ownerChanged)
          await c.query(
            "UPDATE followup_tasks SET owner_id=:p2 WHERE lead_id=:p1 AND status IN ('open','overdue','migration_hold')",
            [l.id, next.owner],
          );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
          [e.id, "lead.update", { id: l.id, changes: req.body }],
        );
        if (ownerChanged)
          await event(c, "conversation.updated", l.id, {
            source: "crm_assignment",
            assignmentChanged: true,
          });
        return next;
      });
      res.json(next?.receipt ? {success:true,...next} : { success: true, lead: next });
    }),
  );
  app.get('/api/crm/leads/:id/owner-result/:requestId',wrap(async(req,res)=>{
    const {l,e}=await leadAccess(req);
    const saved=await ownerReceipt(pool,e,l.profile,String(req.params.requestId),(await identityControls(pool)).ownerAssignmentManagerOnly);
    res.set('Cache-Control','no-store').json({success:true,receipt:saved.receipt,lead:l.profile});
  }));
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
          "SELECT t.*,l.profile FROM followup_tasks t JOIN portal_leads l ON l.id=t.lead_id WHERE t.id=:p1",
          [req.params.id],
        )
      ).rows[0];
      if (!t || !requestAllowed(e,t.profile,req)) fail(404, "Task not found");
      await tx(async (c) => {
        const current = (
          await c.query(
            "SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",
            [t.lead_id],
          )
        ).rows[0]?.profile;
        if (!current || !requestAllowed(e,current,req))
          fail(404, "Task not found");
        await assertIdentitySalesAllowed(c,t.lead_id);
        await c.query(
          "UPDATE followup_tasks SET status='open' WHERE id=:p1 AND status='migration_hold'",
          [t.id],
        );
      });
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/crm/tasks/:id/complete",
    wrap(async (req, res) => {
      const e = await staff(req, "crm.write");
      const task = (
        await pool.query(
          "SELECT t.*,l.profile FROM followup_tasks t JOIN portal_leads l ON l.id=t.lead_id WHERE t.id=:p1",
          [req.params.id],
        )
      ).rows[0];
      if (!task || !requestAllowed(e,task.profile,req))
        fail(404, "Task not found");
      fail(400, "Record a follow-up result and explicitly select the task");
    }),
  );
  app.get(
    "/api/crm/notifications",
    wrap(async (req, res) => {
      const e = await staff(req);
      res.json(
        (
          await pool.query(
            "SELECT ranked.* FROM (SELECT i.*,l.profile AS lead_profile,ROW_NUMBER() OVER (PARTITION BY i.content->>'$.leadId',i.content->>'$.event' ORDER BY j.due_at DESC,j.id DESC) AS rn FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id LEFT JOIN portal_leads l ON l.id=i.content->>'$.leadId' WHERE i.employee_id=:p1) ranked WHERE rn=1 LIMIT 200",
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
  app.get(
    "/api/crm/notification-routing",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      const employees = await platform.employees();
      res.json({
        mode: "owner_then_crm_leader",
        leaderRole: CRM_LEADER_ROLE,
        identityMode: process.env.PLATFORM_MODE || "disabled",
        leaders: employees
          .filter(
            (e) =>
              e.active === true &&
              (e.grants?e.permissions.includes("crm.leader"):e.roles?.includes(CRM_LEADER_ROLE)) &&
              e.permissions.includes("crm.read") &&
              e.permissions.includes("crm.assign"),
          )
          .map((e) => ({ id: e.id, scope: e.scope })),
        unresolved: "audit_and_operations_event",
        scope: "owner_based_lead_notifications",
      });
    }),
  );
  app.get(
    "/api/crm/notification-options",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      const options = {
        sources: ["homepage_widget", "standalone_chat", "legacy_unknown"],
        tiers: [
          "Unqualified",
          "Hot",
          "Warm-Offline",
          "Warm-Online",
          "School",
          "Cold-Nurture",
        ],
        states: [
          ...salesProgressStages.map(s=>s[0]),
          "New",
          "Contacted",
          "Assessment Booked",
          "Assessment Done",
          "Trial Booked",
          "Trial Attended",
          "Enrolled",
          "Lost",
        ],
      };
      const actualSources = (
        await pool.query(
          "SELECT DISTINCT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.source')),'null') value FROM outbox WHERE JSON_CONTAINS_PATH(payload,'one','$.\"source\"') UNION SELECT DISTINCT source value FROM conversations",
        )
      ).rows
        .map((r) => r.value)
        .filter(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 100,
        );
      options.sources = Array.from(
        new Set([...options.sources, ...actualSources]),
      );
      // Historical values remain selectable and are never silently dropped.
      const rules = (await pool.query("SELECT config FROM notification_rules"))
        .rows;
      const leads = (
        await pool.query(
          "SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.tier')),'null') tier,NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.currentStage')),'null') state,NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.team')),'null') team FROM portal_leads",
        )
      ).rows;
      for (const key of ["sources", "tiers", "states"] as const) {
        const legacy = rules.flatMap((r) =>
          Array.isArray(r.config[key]) ? r.config[key] : [],
        );
        const current =
          key === "sources"
            ? []
            : leads.map(
                (l) =>
                  l[
                    key === "tiers" ? "tier" : "state"
                  ],
              );
        options[key] = Array.from(
          new Set(
            [...options[key], ...legacy, ...current].filter(
              (v) => typeof v === "string" && v.length > 0 && v.length <= 100,
            ),
          ),
        );
      }
      res.json(options);
    }),
  );
  app.get(
    "/api/crm/notification-calendar",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      const value = (
        await pool.query("SELECT value FROM portal_settings WHERE id='sla'")
      ).rows[0]?.value;
      res.json(globalWorkCalendar(value));
    }),
  );
  app.get(
    "/api/crm/notification-rules",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      res.json(
        (await pool.query("SELECT * FROM notification_rules")).rows.map(
          (row) => ({ ...row, config: withCalendarMode(row.config) }),
        ),
      );
    }),
  );
  app.post(
    "/api/crm/notification-rules/:id",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      if (
        !req.body.config ||
        typeof req.body.config !== "object" ||
        Array.isArray(req.body.config)
      )
        fail(400, "Invalid policy");
      const config = withCalendarMode(req.body.config);
      if(config.teams?.length)fail(400,"Retired team filters require explicit review");
      delete config.team;delete config.teams;
      config.recipient=config.event.includes("failed") || config.event==="daily.digest"?"managers":"owner";
      const calendar = (
        await pool.query("SELECT value FROM portal_settings WHERE id='sla'")
      ).rows[0]?.value;
      try {
        validate(resolveCalendar(config, calendar));
      } catch (e) {
        fail(400, (e as Error).message);
      }
      await tx(async (c) => {
        await c.query(
          "SELECT id FROM notification_rules WHERE id=:p1 FOR UPDATE",
          [req.params.id],
        );
        const old = (
          await c.query("SELECT version,config FROM notification_rules WHERE id=:p1", [
            req.params.id,
          ])
        ).rows[0];
        if((old?.config.requiresRoutingReview || config.requiresRoutingReview) && req.body.confirmRoutingReset!==true){config.requiresRoutingReview=true;if(req.body.enabled===true)fail(409,"Confirm routing review before enabling");}
        if(req.body.confirmRoutingReset===true)delete config.requiresRoutingReview;
        const version = (old?.version || 0) + 1;
        await c.query(
          "INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES(:p1,:p2,:p3,:p4,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE version=:p2,config=:p3,enabled=:p4,effective_at=UTC_TIMESTAMP(6)",
          [req.params.id, version, config, req.body.enabled === true],
        );
        await c.query("INSERT INTO rule_versions VALUES(:p1,:p2,:p3)", [
          req.params.id,
          version,
          config,
        ]);
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
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
      if (
        !req.body.config ||
        typeof req.body.config !== "object" ||
        Array.isArray(req.body.config)
      )
        fail(400, "Invalid policy");
      const config = withCalendarMode(req.body.config);
      if(config.teams?.length)fail(400,"Retired team filters require explicit review");
      delete config.team;delete config.teams;
      config.recipient=config.event.includes("failed") || config.event==="daily.digest"?"managers":"owner";
      const calendar = (
        await pool.query("SELECT value FROM portal_settings WHERE id='sla'")
      ).rows[0]?.value;
      try {
        validate(resolveCalendar(config, calendar));
      } catch (e) {
        fail(400, (e as Error).message);
      }
      const effective = resolveCalendar(config, calendar);
      const at = new Date(req.body.at || Date.now());
      const eventTime =
        config.event === "daily.digest"
          ? schedule(
              at,
              {
                ...effective,
                timing: "digest",
                businessOnly: false,
                quiet: undefined,
              },
              "lark",
            )
          : at;
      res.json({
        calendar: globalWorkCalendar(calendar),
        sendAt: config.channels.map((channel: string) => ({
          channel,
          at: schedule(
            eventTime,
            config.event === "daily.digest"
              ? { ...effective, timing: "immediate" }
              : effective,
            channel as any,
          ),
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
            "SELECT * FROM portal_audit WHERE action NOT LIKE 'access.%' ORDER BY id DESC LIMIT 200",
          )
        ).rows,
      );
    }),
  );
  app.post(
    "/api/crm/notification-jobs/:id/cancel",
    wrap(async (req, res) => {
      const employee = await staff(req, "notifications.manage");
      await tx(async (c) => {
        const job = (
          await c.query(
            "SELECT * FROM notification_jobs WHERE id=:p1 FOR UPDATE",
            [req.params.id],
          )
        ).rows[0];
        if (!job) fail(404, "Notification not found");
        if (job.state !== "pending")
          fail(409, "Only pending notifications can be cancelled");
        const reason = String(req.body.reason || "Cancelled by employee").slice(
          0,
          300,
        );
        await c.query(
          "UPDATE notification_jobs SET state='cancelled',result=:p2,completed_at=UTC_TIMESTAMP(6) WHERE id=:p1",
          [job.id, reason],
        );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
          [employee.id, "notification.cancel", { jobId: job.id, reason }],
        );
      });
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/crm/integration-readiness",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      const channels = (
        await pool.query("SELECT * FROM notification_channels")
      ).rows.map((row) => {
        const config = row.config;
        return {
          id: row.id,
          team: config.team,
          mode: config.mode,
          webhookConfigured: validWebhook(process.env[config.secretRef]),
          signingSecretConfigured:
            !(config.signingEnabled ?? !!config.signingSecretRef) ||
            !!process.env[config.signingSecretRef],
          designatedTestGroup: process.env.LARK_TEST_GROUP === row.id,
          realReceiptVerified: false,
        };
      });
      const missingReferences = (
        await pool.query(
          "SELECT r.id,r.enabled,NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.config,'$.group')),'null') AS channel FROM notification_rules r LEFT JOIN notification_channels c ON c.id=NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.config,'$.group')),'null') WHERE JSON_CONTAINS(JSON_EXTRACT(r.config,'$.channels'),JSON_QUOTE('lark')) AND c.id IS NULL",
        )
      ).rows;
      res.json({
        missingReferences,
        identity: {
          mode: process.env.PLATFORM_MODE || "disabled",
          adapter:
            process.env.PLATFORM_MODE === "local"
              ? "local-staff-accounts"
              : "local-fixtures-only",
          realPlatformVerified: false,
        },
        channels,
        releaseReady: false,
        required: [
          "Real platform identity/directory/scope contract",
          "Designated Lark group receipt with event/job IDs",
        ],
      });
    }),
  );
  app.get(
    "/api/crm/notification-jobs",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      res.json(
        (
          await pool.query(
            "SELECT j.*,EXISTS(SELECT 1 FROM notification_migration_holds h WHERE h.kind='job' AND h.id=j.id) AS historicalHold FROM notification_jobs j ORDER BY due_at DESC LIMIT 200",
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
        channels: await Promise.all(
          (await pool.query("SELECT * FROM notification_channels")).rows.map(
            async (row) => ({
              ...row,
              connection: channelConnection(row.id, row.config),
              rateLimit: await groupRateLimit(pool, row.id, row.config),
              usage: (
                await pool.query(
                  "SELECT COUNT(*) AS total,COALESCE(SUM(enabled),0) AS enabled FROM notification_rules WHERE config->>'$.group'=:p1 AND JSON_CONTAINS(config->'$.channels',JSON_QUOTE('lark'))",
                  [row.id],
                )
              ).rows[0],
            }),
          ),
        ),
        unconnected: ["email", "sms"],
      });
    }),
  );
  app.post(
    "/api/crm/notification-channels/:id",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      const {
        team,
        secretRef,
        mode,
        signingSecretRef,
        signingEnabled,
        groupName,
        teamName,
        maxPerHour,
      } = req.body;
      const previous = (
        await pool.query(
          "SELECT config FROM notification_channels WHERE id=:p1",
          [req.params.id],
        )
      ).rows[0]?.config;
      const ref = secretRef ?? previous?.secretRef;
      const signing =
        signingEnabled ??
        previous?.signingEnabled ??
        !!(signingSecretRef ?? previous?.signingSecretRef);
      const signingRef = signingSecretRef ?? previous?.signingSecretRef;
      if (
        !["simulation", "live"].includes(mode) ||
        (secretRef !== undefined &&
          (typeof secretRef !== "string" ||
            !/^[A-Z0-9_]{1,80}$/.test(secretRef))) ||
        (signingSecretRef !== undefined &&
          (typeof signingSecretRef !== "string" ||
            !/^[A-Z0-9_]{1,80}$/.test(signingSecretRef))) ||
        (mode === "live" &&
          (typeof ref !== "string" || !/^[A-Z0-9_]{1,80}$/.test(ref))) ||
        (signingEnabled !== undefined && typeof signingEnabled !== "boolean") ||
        (mode === "live" &&
          signing &&
          (typeof signingRef !== "string" ||
            !/^[A-Z0-9_]{1,80}$/.test(signingRef))) ||
        (maxPerHour !== undefined &&
          (!Number.isInteger(maxPerHour) ||
            maxPerHour < 0 ||
            maxPerHour > 10080)) ||
        (groupName !== undefined &&
          (typeof groupName !== "string" ||
            !groupName.trim() ||
            groupName.length > 100)) ||
        (!previous && !groupName?.trim()) ||
        (team !== undefined &&
          (typeof team !== "string" || team.length > 100)) ||
        (teamName !== undefined &&
          (typeof teamName !== "string" || teamName.length > 100))
      )
        fail(400, "Invalid channel config");
      const limit =
        maxPerHour ??
        (await groupRateLimit(pool, String(req.params.id), previous))
          .maxPerHour;
      await pool.query(
        "INSERT INTO notification_channels VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE config=:p2",
        [
          req.params.id,
          {
            ...previous,
            team: team ?? previous?.team,
            teamName: teamName ?? previous?.teamName,
            groupName: groupName?.trim() || previous?.groupName,
            mode,
            maxPerHour: limit,
            secretRef: ref,
            signingSecretRef: signingRef,
            signingEnabled: signing,
          },
        ],
      );
      await pool.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",
        [
          e.id,
          "channel.save",
          { id: req.params.id, team, mode, maxPerHour: limit },
        ],
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
      const configured =
        (
          await pool.query(
            "SELECT value FROM portal_settings WHERE id='crm_policy'",
          )
        ).rows[0]?.value || DEFAULT_CRM_POLICY_CONFIG;
      res.json(effectivePolicy(configured,v));
    }),
  );
  app.post('/api/crm/policy-config/topics/:topic',wrap(async(req,res)=>{
    const employee=await staff(req,'notifications.manage');
    const result=await tx(async(db)=>{
      const rows=(await db.query("SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy') ORDER BY id FOR UPDATE")).rows;
      const sla=rows.find((row:any)=>row.id==='sla').value,configured=rows.find((row:any)=>row.id==='crm_policy')?.value;
      const current=effectivePolicy(configured,sla),merged=mergePolicyTopic(current,String(req.params.topic),req.body);
      if(merged.kind!=='saved')return merged;
      const value=merged.value;value.updatedAt=new Date().toISOString();
      const before={identityReviewManagerOnly:current.identityReviewManagerOnly,ownerAssignmentManagerOnly:current.ownerAssignmentManagerOnly,sourceAttributionManagerOnly:current.sourceAttributionManagerOnly};
      const after={identityReviewManagerOnly:value.identityReviewManagerOnly,ownerAssignmentManagerOnly:value.ownerAssignmentManagerOnly,sourceAttributionManagerOnly:value.sourceAttributionManagerOnly};
      if(JSON.stringify(before)!==JSON.stringify(after))await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",[employee.id,'crm.access-controls.save',{before,after}]);
      await db.query("UPDATE portal_settings SET value=:p1 WHERE id='sla'",[policySla(sla,value)]);
      await db.query("INSERT INTO portal_settings(id,value) VALUES('crm_policy',:p1) ON DUPLICATE KEY UPDATE value=:p1",[value]);
      await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",[employee.id,'sla.topic.save',{topic:req.params.topic,before:topicPatch(current,req.params.topic as PolicyTopic),after:topicPatch(value,req.params.topic as PolicyTopic)}]);
      return {kind:'saved' as const,value};
    });
    if(result.kind==='invalid'){res.status(400).json({error:'policy_topic_invalid'});return;}
    if(result.kind==='validation'){res.status(400).json({error:'policy_save_rejected',fieldErrors:result.errors});return;}
    if(result.kind==='conflict'){res.status(409).json({error:'policy_topic_conflict',currentPolicy:result.current});return;}
    res.json({success:true,policy:result.value,unchanged:result.kind==='unchanged'});
  }));
  app.post(
    "/api/crm/policy-config",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      const result = await tx(async (db) => {
        const rows = (await db.query("SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy') ORDER BY id FOR UPDATE")).rows;
        const old=rows.find((row:any)=>row.id==='sla').value;
        const configured=rows.find((row:any)=>row.id==='crm_policy')?.value;
        const {value,errors}=mergePolicyConfig(effectivePolicy(configured,old),req.body);
        if(Object.keys(errors).length) return {errors};
        const previousControls={identityReviewManagerOnly:configured?.identityReviewManagerOnly!==false,ownerAssignmentManagerOnly:effectivePolicy(configured,old).ownerAssignmentManagerOnly,sourceAttributionManagerOnly:configured?.sourceAttributionManagerOnly!==false};
        const currentControls={identityReviewManagerOnly:value.identityReviewManagerOnly,ownerAssignmentManagerOnly:value.ownerAssignmentManagerOnly,sourceAttributionManagerOnly:value.sourceAttributionManagerOnly};
        if(JSON.stringify(previousControls)!==JSON.stringify(currentControls))await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",[e.id,"crm.access-controls.save",{before:previousControls,after:currentControls}]);
        const next=policySla(old,value);
        value.updatedAt=new Date().toISOString();
        await db.query("UPDATE portal_settings SET value=:p1 WHERE id='sla'",[next]);
        await db.query("INSERT INTO portal_settings(id,value) VALUES('crm_policy',:p1) ON DUPLICATE KEY UPDATE value=:p1",[value]);
        await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)",[e.id,"sla.save",next]);
        return {errors:null};
      });
      if(result.errors) {
        res.status(400).json({error:"Invalid sales operations configuration",fieldErrors:result.errors});
        return;
      }
      res.json({ success: true });
    }),
  );
  mountTrustRoutes(app,{wrap,leadAccess,requestAllowed,staff});
  app.post(
    [
      "/api/crm/leads/:id/follow-up",
      "/api/crm/leads/:id/logs",
      "/api/crm/leads/:id/contact-arrangement",
    ],
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req, "crm.write");
      try {
        const result = await tx((c) =>
          saveSalesWorkflow(c, l.id, e.id, req.body, (current) =>
            requestAllowed(e,current,req),
          ),
        );
        result.lead=(await projectIdentityProfiles(pool,[result.lead]))[0]||result.lead;
        await attachLeadAttention(e,[result.lead]);
        await attachBuyingEvidence(pool,[result.lead]);
        await attachFactMilestones(pool,[result.lead]);
        res.json({ success: true, ...result });
      } catch (error) {
        fail(
          (error as any).status||(error instanceof WorkflowValidationError ? 400 : 503),
          error instanceof WorkflowValidationError||(error as any).status
            ? error.message
            : "Follow-up service unavailable",
        );
      }
    }),
  );
  app.post(
    "/api/crm/notification-jobs/:id/cancel",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      await pool.query(
        "UPDATE notification_jobs SET state='cancelled' WHERE id=:p1 AND state='pending'",
        [req.params.id],
      );
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/crm/export",
    wrap(async (req, res) => {
      const e = await staff(req, "crm.export");
      const rows = (await visibleLeadProfiles(e)).filter(p=>!e.grants||permittedRecord(e,p,"crm.export"));
      let filters;
      try {
        filters = parseLeadFilters(req.query);
      } catch {
        fail(400, "Invalid lead filters");
      }
      const settings = (
        await pool.query(
          "SELECT id,value FROM portal_settings WHERE id IN ('sla','crm_policy')",
        )
      ).rows;
      let timezone = settings.find((r) => r.id === "sla")?.value.timezone || "Asia/Jakarta";
      if (req.query.viewerTimezone !== undefined) {
        if (typeof req.query.viewerTimezone !== 'string') fail(400, 'Invalid display timezone');
        try { new Intl.DateTimeFormat('en', {timeZone: String(req.query.viewerTimezone)}); }
        catch { fail(400, 'Invalid display timezone'); }
        timezone = String(req.query.viewerTimezone);
      }
      const config = {
        ...DEFAULT_CRM_POLICY_CONFIG,
        ...settings.find((r) => r.id === "crm_policy")?.value,
      };
      res
        .attachment("leads.json")
        .json(
          filterAndSummarize(rows, filters, e.id, timezone, Date.now(), config)
            .leads,
        );
    }),
  );
  app.get('/api/crm/campaign-save-results/:requestId',wrap(campaignSaveResultHandler(pool,req=>platform.authenticate(req))));
  app.use("/api/crm/campaigns", (req, res, next) => {
    staff(req, req.method === "GET" && !req.path.startsWith("/sources") ? "crm.read" : "notifications.manage")
      .then((e) => {
        res.locals.crmEmployee = e;
        next();
      })
      .catch((e) => res.status(e.status || 503).json({ error: e.message }));
  });
  app.use("/api/crm", (q, r, next) => {
    if (q.path.startsWith("/campaigns")) {
      next();
      return;
    }
    staff(q)
      .then(() =>
        r
          .status(501)
          .json({
            error: "Legacy administrative endpoint disabled; use portal APIs",
          }),
      )
      .catch((e) => r.status(e.status || 503).json({ error: e.message }));
  });
}
export { wrap, own, fail, visitor };
