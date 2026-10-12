import type { Express, Request, Response } from "express";
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
  type Rule,
} from "./policy.ts";
import { getSystemInstruction } from "../../src/data/knowledgeBase.ts";
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
  if (!l || !allowed(e, l.profile)) fail(404, "Lead not found");
  return { e, l };
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
      res.json({ registered: !!v.lead_id });
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
            "SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at,id",
            [c.id],
          )
        ).rows,
      });
    }),
  );
  const register = wrap(async (req, res) => {
    const v = await visitor(req, res);
    const b = req.body;
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
          await c.query("SELECT profile FROM portal_leads WHERE id=$1", [
            leadId,
          ])
        ).rows[0]?.profile || {};
      const profile = {
        ...existing,
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
      for (const k of [
        "currentStatus",
        "goal",
        "reportedLevel",
        "levelState",
        "city",
        "mode",
        "quizScore",
        "totalQuestions",
        "levelConfirmed",
        "quizResultSummary",
        "buyingSignal",
      ])
        if (b[k] !== undefined) profile[k] = b[k];
      await c.query(
        "INSERT INTO portal_leads(id,profile) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET profile=excluded.profile",
        [leadId, profile],
      );
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
        const due = sla(new Date(), s.warmHours, s);
        const taskId = id();
        profile.slaDueTime = due.toISOString();
        await c.query("UPDATE portal_leads SET profile=$2 WHERE id=$1", [
          leadId,
          profile,
        ]);
        await c.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES($1,$2,$3,$4)",
          [taskId, leadId, "consultation", due],
        );
        await event(c, "lead.created", leadId, {
          source: b.entryPoint || "homepage_widget",
          taskId,
        });
      }
      if (b.quizScore !== undefined && b.quizScore !== existing.quizScore)
        await event(c, "assessment.completed", leadId, { score: b.quizScore });
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
      if (!c.lead_id) fail(409, "Register contact details first");
      await tx(async (db) => {
        await db.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,due_at) VALUES($1,$2,$3,now()+interval '3 hours') ON CONFLICT DO NOTHING",
          [id(), c.lead_id, req.body.action],
        );
        await event(
          db,
          req.body.action === "handoff"
            ? "handoff.requested"
            : req.body.action === "booking"
              ? "booking.requested"
              : "enrollment.requested",
          c.lead_id,
          { source: c.source },
        );
      });
      res.json({ success: true, status: "awaiting_advisor" });
    }),
  );
  app.post("/api/crm/leads/sync-chat", (_q, r) => {
    r.status(410).json({ error: "Use owned conversations" });
  });
  app.get(
    "/api/crm/leads",
    wrap(async (req, res) => {
      const e = await staff(req);
      const leads = (
        await pool.query(
          "SELECT l.profile || jsonb_build_object('chatTranscript',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'content',m.content,'timestamp',m.created_at,'source',c.source,'status',m.status) ORDER BY m.created_at) FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.lead_id=l.id),'[]'::jsonb)) AS profile FROM portal_leads l ORDER BY created_at DESC",
        )
      ).rows
        .map((r) => r.profile)
        .filter((p) => allowed(e, p))
        .filter(
          (p) =>
            (!req.query.search ||
              JSON.stringify(p)
                .toLowerCase()
                .includes(String(req.query.search).toLowerCase())) &&
            (!req.query.owner || p.owner === req.query.owner) &&
            (!req.query.tier || p.tier === req.query.tier) &&
            (!req.query.stage || p.currentStage === req.query.stage),
        );
      const attention = (
        await pool.query(
          `SELECT l.id,clock_timestamp()::text AS observed_at,
        (SELECT count(*) FROM notification_inbox i JOIN notification_jobs j ON j.id=i.id JOIN outbox o ON o.id=j.event_id
         WHERE i.employee_id=$1 AND o.lead_id=l.id AND i.read_at IS NULL AND o.created_at>COALESCE((SELECT seen_at FROM lead_read_marks WHERE employee_id=$1 AND lead_id=l.id),'-infinity'::timestamptz)) AS unread_count,
        (SELECT jsonb_build_object('type',o.type,'at',o.created_at) FROM outbox o WHERE o.lead_id=l.id ORDER BY o.created_at DESC LIMIT 1) AS latest,
        (SELECT jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'ownerId',t.owner_id,'status',t.status,'dueAt',t.due_at) ORDER BY t.due_at) FROM followup_tasks t WHERE t.lead_id=l.id AND (t.status IN ('open','overdue') OR (t.status='migration_hold' AND l.profile->>'currentStage' NOT IN ('Enrolled','Lost')))) AS tasks
        FROM portal_leads l`,
          [e.id],
        )
      ).rows;
      const byId = new Map(attention.map((a) => [a.id, a]));
      for (const lead of leads) {
        const a = byId.get(lead.id);
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
      res.json({
        leads,
        total: leads.length,
        dataScope: e.scope,
        employeeId: e.id,
        stats: {
          total: leads.length,
          hot: leads.filter((p) => p.tier === "Hot").length,
          warmOffline: leads.filter((p) => p.tier === "Warm-Offline").length,
          warmOnline: leads.filter((p) => p.tier === "Warm-Online").length,
          school: leads.filter((p) => p.tier === "School").length,
          coldNurture: leads.filter((p) => p.tier === "Cold-Nurture").length,
          overdueSla: leads.filter(
            (p) =>
              p.slaDueTime && new Date(p.slaDueTime).getTime() < Date.now(),
          ).length,
          enrolled: leads.filter((p) => p.currentStage === "Enrolled").length,
          conversionRate:
            (leads.length
              ? (100 *
                  leads.filter((p) => p.currentStage === "Enrolled").length) /
                leads.length
              : 0
            ).toFixed(1) + "%",
        },
      });
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
          "SELECT m.*,c.source FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.lead_id=$1 ORDER BY m.created_at",
          [l.id],
        )
      ).rows;
      const tasks = (
        await pool.query("SELECT * FROM followup_tasks WHERE lead_id=$1", [
          l.id,
        ])
      ).rows;
      res.json({
        ...l.profile,
        lead: { ...l.profile, chatTranscript: rows },
        chatTranscript: rows,
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
  app.patch(
    "/api/crm/leads/:id",
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const next = { ...l.profile };
      for (const k of ["owner", "currentStage", "tier", "nextAction"])
        if (req.body[k] !== undefined) next[k] = req.body[k];
      if (
        next.owner !== l.profile.owner &&
        !e.permissions.includes("crm.assign")
      )
        fail(403, "Lead assignment permission required");
      if (
        next.owner &&
        !(await platform.employees()).some((p) => p.id === next.owner)
      )
        fail(400, "Unknown employee");
      await tx(async (c) => {
        await c.query("UPDATE portal_leads SET profile=$2 WHERE id=$1", [
          l.id,
          next,
        ]);
        await c.query(
          "UPDATE followup_tasks SET owner_id=$2 WHERE lead_id=$1 AND status='open'",
          [l.id, next.owner],
        );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)",
          [e.id, "lead.update", { id: l.id, changes: req.body }],
        );
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
      if (!t || !allowed(e, t.profile)) fail(404, "Task not found");
      await pool.query(
        "UPDATE followup_tasks SET status='open' WHERE id=$1 AND status='migration_hold'",
        [t.id],
      );
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/crm/tasks/:id/complete",
    wrap(async (req, res) => {
      const e = await staff(req, "crm.write");
      const t = (
        await pool.query(
          "SELECT t.*,l.profile FROM followup_tasks t JOIN portal_leads l ON l.id=t.lead_id WHERE t.id=$1",
          [req.params.id],
        )
      ).rows[0];
      if (!t || !allowed(e, t.profile)) fail(404, "Task not found");
      await pool.query(
        "UPDATE followup_tasks SET status='completed' WHERE id=$1",
        [t.id],
      );
      res.json({ success: true });
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
  app.get(
    "/api/crm/notification-rules",
    wrap(async (req, res) => {
      await staff(req, "notifications.manage");
      res.json((await pool.query("SELECT * FROM notification_rules")).rows);
    }),
  );
  app.post(
    "/api/crm/notification-rules/:id",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      validate(req.body.config);
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
          "INSERT INTO notification_rules(id,version,config,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET version=$2,config=$3,enabled=$4",
          [req.params.id, version, req.body.config, req.body.enabled === true],
        );
        await c.query("INSERT INTO rule_versions VALUES($1,$2,$3)", [
          req.params.id,
          version,
          req.body.config,
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
      validate(req.body.config);
      res.json({
        sendAt: req.body.config.channels.map((channel: string) => ({
          channel,
          at: schedule(
            new Date(req.body.at || Date.now()),
            req.body.config,
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
            "SELECT * FROM portal_audit ORDER BY id DESC LIMIT 200",
          )
        ).rows,
      );
    }),
  );
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
        channels: (await pool.query("SELECT * FROM notification_channels"))
          .rows,
        unconnected: ["email", "sms"],
      });
    }),
  );
  app.post(
    "/api/crm/notification-channels/:id",
    wrap(async (req, res) => {
      const e = await staff(req, "notifications.manage");
      const { team, secretRef, mode } = req.body;
      if (
        !/^[A-Z0-9_]{1,80}$/.test(secretRef) ||
        !["simulation", "live"].includes(mode) ||
        typeof team !== "string"
      )
        fail(400, "Invalid channel config");
      await pool.query(
        "INSERT INTO notification_channels VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET config=$2",
        [req.params.id, { team, secretRef, mode }],
      );
      await pool.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)",
        [e.id, "channel.save", { id: req.params.id, team, mode }],
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
      res.json({
        ...((
          await pool.query(
            "SELECT value FROM portal_settings WHERE id='crm_policy'",
          )
        ).rows[0]?.value || DEFAULT_CRM_POLICY_CONFIG),
        businessHours: {
          timezone: v.timezone,
          startTime: v.start,
          endTime: v.end,
          workDays: v.days,
          nextDayGraceTime: v.start,
        },
        firstResponseSla: {
          hot: { value: v.hotHours, unit: "hours" },
          warm: { value: v.warmHours, unit: "hours" },
          cold: { value: v.coldHours, unit: "hours" },
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
      const duration = (d: any) =>
        d.value * (d.unit === "minutes" ? 1 / 60 : d.unit === "days" ? 24 : 1);
      const next = {
        ...old,
        timezone: b.businessHours?.timezone || old.timezone,
        start: b.businessHours?.startTime || old.start,
        end: b.businessHours?.endTime || old.end,
        days: b.businessHours?.workDays || old.days,
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
      await pool.query("UPDATE portal_settings SET value=$1 WHERE id='sla'", [
        next,
      ]);
      await pool.query(
        "INSERT INTO portal_audit(actor,action,data) VALUES($1,$2,$3)",
        [e.id, "sla.save", next],
      );
      await pool.query(
        "INSERT INTO portal_settings(id,value) VALUES('crm_policy',$1) ON CONFLICT(id) DO UPDATE SET value=$1",
        [b],
      );
      res.json({ success: true });
    }),
  );
  app.post(
    ["/api/crm/leads/:id/follow-up", "/api/crm/leads/:id/logs"],
    wrap(async (req, res) => {
      const { l, e } = await leadAccess(req, "crm.write");
      if (!req.body.summary?.trim()) fail(400, "Follow-up summary required");
      if (
        req.body.nextFollowUpAt &&
        !Number.isFinite(Date.parse(req.body.nextFollowUpAt))
      )
        fail(400, "Invalid follow-up date");
      const log = {
        ...req.body,
        staffName: e.id,
        id: id(),
        timestamp: new Date().toISOString(),
        at: new Date().toISOString(),
        previousStage: l.profile.currentStage,
      };
      const updated = await tx(async (c) => {
        const current = (
          await c.query(
            "SELECT profile FROM portal_leads WHERE id=$1 FOR UPDATE",
            [l.id],
          )
        ).rows[0].profile;
        const profile = {
          ...current,
          followUpLogs: [...(current.followUpLogs || []), log],
          lastContactedAt: log.at,
          touchCount: (current.touchCount || 0) + 1,
          connectStatus: req.body.connectStatus || l.profile.connectStatus,
          stageUpdatedAt: log.at,
          nextFollowUpAt: req.body.nextFollowUpAt || l.profile.nextFollowUpAt,
          currentStage: req.body.newStage || l.profile.currentStage,
          nextAction: req.body.nextAction || l.profile.nextAction,
        };
        await c.query("UPDATE portal_leads SET profile=$2 WHERE id=$1", [
          l.id,
          profile,
        ]);
        await c.query(
          "UPDATE followup_tasks SET status='completed' WHERE lead_id=$1 AND status IN ('open','overdue')",
          [l.id],
        );
        if (
          req.body.nextFollowUpAt &&
          !["Enrolled", "Lost"].includes(profile.currentStage)
        )
          await c.query(
            "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES($1,$2,'follow_up',$3,$4)",
            [
              id(),
              l.id,
              profile.owner || null,
              new Date(req.body.nextFollowUpAt),
            ],
          );
        return profile;
      });
      res.json({ success: true, lead: updated });
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
      const rows = (await pool.query("SELECT profile FROM portal_leads")).rows
        .map((r) => r.profile)
        .filter((p) => allowed(e, p));
      res.attachment("leads.json").json(rows);
    }),
  );
  app.use("/api/crm/campaigns", (req, res, next) => {
    staff(req, req.method === "GET" ? "crm.read" : "notifications.manage")
      .then(() => next())
      .catch((e) => res.status(e.status || 503).json({ error: e.message }));
  });
  app.use("/api/crm", (q, r, next) => {
    if (q.path.startsWith("/campaigns")) {
      next();
      return;
    }
    r.status(501).json({
      error: "Legacy administrative endpoint disabled; use portal APIs",
    });
  });
}
export { wrap, own, fail };
