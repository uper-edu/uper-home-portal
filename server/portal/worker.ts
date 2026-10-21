import {settleNoResponse} from "./noResponse.ts";
import { restoreState } from "./accessRecoveryState.ts";
import { retryLeaseRecovery } from "./notificationLeaseRecovery.ts";
import { contactPaused } from "../../src/utils/crmContact.ts";
import {
  recipients,
  priority,
  retryAfter,
  validWebhook,
  larkCard,
  groupRateLimit,
  resolveRecipients,
} from "./notificationDelivery.ts";
import { pool, tx, id, event, connection } from "./store.ts";
import { platform } from "./identity.ts";
import {
  schedule,
  local,
  defaults,
  withCalendarMode,
  resolveCalendar,
  type Rule,
} from "./policy.ts";
export async function tick(clock = new Date()) {
  if((await restoreState())?.required)return;
  await tx(async (c) => {
    await settleNoResponse(c,clock);
    const globalCalendar = (
      await c.query("SELECT value FROM portal_settings WHERE id='sla'")
    ).rows[0]?.value;
    await c.recoverInterruptedMessages([]);
    const digestRules = (
      await c.query(
        "SELECT * FROM notification_rules WHERE enabled=true AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(config,'$.event')),'null')='daily.digest' AND effective_at<=:p1",
        [clock],
      )
    ).rows;
    for (const row of digestRules) {
      if (row.config.teams?.length || row.config.requiresRoutingReview || row.config.team) continue;
      const digestRule = resolveCalendar(row.config as Rule, globalCalendar);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: digestRule.timezone,
      }).format(clock);
      const l = local(clock, digestRule);
      if (digestRule.days.includes(l.day) && l.time >= digestRule.digestTime) {
        const counts = (
          await c.dailyStageCounts([
            null,
            digestRule.timezone,
            today,
            digestRule.tiers,
            digestRule.states,
            digestRule.sources,
          ])
        ).rows;
        await c.query(
          "INSERT INTO outbox(id,type,payload,created_at) VALUES(:p1,'daily.digest',:p2,:p3) ON DUPLICATE KEY UPDATE id=id",
          [
            "digest-" + row.id + "-" + today,
            { date: today, ruleId: row.id, counts },
            clock,
          ],
        );
      }
    }
    const tasks = (
      await c.query(
        "SELECT * FROM followup_tasks t WHERE status='open' AND due_at<:p1 AND NOT EXISTS(SELECT 1 FROM notification_migration_holds h WHERE h.kind='task' AND h.id=t.id) FOR UPDATE SKIP LOCKED",
        [clock],
      )
    ).rows;
    for (const task of tasks) {
      await c.query("UPDATE followup_tasks SET status='overdue' WHERE id=:p1", [
        task.id,
      ]);
      await event(c, "task.overdue", task.lead_id, { taskId: task.id });
    }
    const appointments=(await c.query("SELECT * FROM followup_tasks t WHERE status IN ('open','overdue') AND scheduled_at<=:p1 AND NOT EXISTS(SELECT 1 FROM notification_migration_holds h WHERE h.kind='task' AND h.id=t.id) FOR UPDATE",[clock])).rows;
    for(const t of appointments){
      const key='appointment:'+t.id+':'+(t.details.noticeRevision||0);
      await c.query("INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,'task.appointment_due',:p2,:p3) ON DUPLICATE KEY UPDATE id=id",[key,t.lead_id,{taskId:t.id,source:'crm',taskNoticeVersion:t.details.noticeRevision||0}]);
    }
    const events = (
      await c.query(
        "SELECT * FROM outbox o WHERE processed_at IS NULL AND NOT EXISTS(SELECT 1 FROM notification_migration_holds h WHERE h.kind='event' AND h.id=o.id) ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED",
      )
    ).rows;
    const employees = await platform.employees();
    for (const ev of events) {
      const lead = ev.lead_id
        ? (
            await c.query("SELECT profile FROM portal_leads WHERE id=:p1", [
              ev.lead_id,
            ])
          ).rows[0]?.profile
        : {};
      let eventTask: any;
      if (ev.payload.taskId) {
        eventTask = (
          await c.query("SELECT * FROM followup_tasks WHERE id=:p1", [
            ev.payload.taskId,
          ])
        ).rows[0];
        if (!eventTask || ["completed", "cancelled"].includes(eventTask.status)) {
          await c.query(
            "UPDATE outbox SET processed_at=UTC_TIMESTAMP(6) WHERE id=:p1",
            [ev.id],
          );
          continue;
        }
      }
      if(ev.payload.taskId)ev.payload={...ev.payload,taskNoticeVersion:ev.payload.taskNoticeVersion||0};
      const rules = (
        await c.query(
          "SELECT * FROM notification_rules WHERE enabled=true AND effective_at<=(SELECT created_at FROM outbox WHERE id=:p1)",
          [ev.id],
        )
      ).rows;
      for (const rule of rules) {
        const r = withCalendarMode(rule.config as Rule);
        const effective = resolveCalendar(r, globalCalendar);
        // Enabling a rule must not synthesize reminders for appointments already missed
        // before its activation, even if their outbox event is generated afterward.
        if(ev.type==='task.appointment_due' && eventTask?.scheduled_at &&
          new Date(eventTask.scheduled_at).getTime()<new Date(rule.effective_at).getTime())continue;
        if (
          r.event !== ev.type ||
          (ev.type === "daily.digest" && ev.payload.ruleId !== rule.id) ||
          r.requiresRoutingReview || !!r.teams?.length ||
          (ev.type !== "daily.digest" &&
            r.sources.length &&
            !r.sources.includes(ev.payload.source)) ||
          (ev.type !== "daily.digest" &&
            r.tiers.length &&
            !r.tiers.includes(lead?.tier)) ||
          (ev.type !== "daily.digest" &&
            r.states.length &&
            !r.states.includes(lead?.currentStage))
        )
          continue;
        for (const channel of r.channels) {
          const route =
            channel === "inapp"
              ? resolveRecipients(r, lead, employees, ev.lead_id)
              : null;
          const targets = route ? route.ids : [r.group];
          if (route && !targets.length) {
            await c.query(
              "INSERT INTO portal_audit(actor,action,data) VALUES('system','notification.routing_unresolved',:p1)",
              [{ eventId: ev.id, ruleId: rule.id, reason: route.reason }],
            );
            if (ev.type !== "notification.failed")
              await event(c, "notification.failed", null, {
                reason: route.reason,
                eventId: ev.id,
                ruleId: rule.id,
              });
          }
          for (const recipient of targets) {
            const key = id();
            await c.query(
              "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8) ON DUPLICATE KEY UPDATE id=id",
              [
                key,
                ev.id,
                rule.id,
                rule.version,
                channel,
                recipient,
                schedule(
                  new Date(ev.created_at),
                  ev.type === "daily.digest"
                    ? { ...effective, timing: "immediate" }
                    : effective,
                  channel,
                ),
                {
                  routingReason: route?.reason,
                  priority: priority(ev.type, ev.payload, lead),
                  plannedCalendar: {
                    timezone: effective.timezone,
                    start: effective.start,
                    end: effective.end,
                    days: effective.days,
                  },
                  rule: r,
                  event: ev.type,
                  leadId: ev.lead_id,
                  payload: ev.payload,
                },
              ],
            );
          }
        }
      }
      await c.query(
        "UPDATE outbox SET processed_at=UTC_TIMESTAMP(6) WHERE id=:p1",
        [ev.id],
      );
    }
  });
  await retryLeaseRecovery(()=>pool.query(
    "UPDATE notification_jobs j SET state=CASE WHEN channel='lark' THEN 'unknown' ELSE 'pending' END,result='Lease expired' WHERE state='sending' AND lease_until<UTC_TIMESTAMP(6) AND NOT EXISTS(SELECT 1 FROM notification_migration_holds h WHERE h.kind='job' AND h.id=j.id)",
  ));
  const job = await tx(async (c) => {
    const row = (
      await c.query(
        "SELECT * FROM notification_jobs j WHERE state='pending' AND due_at<=:p1 AND NOT EXISTS(SELECT 1 FROM notification_migration_holds h WHERE h.kind='job' AND h.id=j.id) ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED",
        [clock],
      )
    ).rows[0];
    if (row)
      await c.query(
        "UPDATE notification_jobs SET state='sending',lease_until=UTC_TIMESTAMP(6)+INTERVAL 1 minute,attempts=attempts+1 WHERE id=:p1",
        [row.id],
      );
    return row;
  });
  if (!job) return;
  const lease = job.channel === "lark" ? await connection() : null;
  const guard = lease?.client;
  if (guard) {
    try {
      const locked = (
        await guard.query("SELECT GET_LOCK(:p1,0) AS acquired", [
          "lark:" + job.recipient,
        ])
      ).rows[0].acquired;
      if (!locked) {
        await pool.query(
          "UPDATE notification_jobs SET state='pending',due_at=UTC_TIMESTAMP(6)+INTERVAL 1 second WHERE id=:p1",
          [job.id],
        );
        lease?.release();
        return;
      }
    } catch (e) {
      lease?.release();
      throw e;
    }
  }
  try {
    const storedRule = job.snapshot.rule as Rule;
    if(storedRule.teams?.length || storedRule.requiresRoutingReview || storedRule.event==='daily.digest' && storedRule.team){
      await pool.query("UPDATE notification_jobs SET state='cancelled',result='Retired team scope requires review',completed_at=UTC_TIMESTAMP(6) WHERE id=:p1",[job.id]);return;
    }
    const globalCalendar = (
      await pool.query("SELECT value FROM portal_settings WHERE id='sla'")
    ).rows[0]?.value;
    const r = resolveCalendar(
      { ...storedRule, calendarMode: storedRule.calendarMode || "custom" },
      globalCalendar,
    );
    const lead =
      (
        await pool.query("SELECT profile FROM portal_leads WHERE id=:p1", [
          job.snapshot.leadId,
        ])
      ).rows[0]?.profile || {};
    if (job.channel === "inapp") {
      const targets = recipients(
        r,
        lead,
        await platform.employees(),
        job.snapshot.leadId,
      );
      if (!targets.includes(job.recipient)) {
        if (!targets.length)
          await tx(async (c) => {
            await c.query(
              "INSERT INTO portal_audit(actor,action,data) VALUES('system','notification.routing_unresolved',:p1)",
              [{ jobId: job.id, reason: "no_authorized_recipient" }],
            );
            if (job.snapshot.event !== "notification.failed")
              await event(c, "notification.failed", null, {
                jobId: job.id,
                reason: "no_authorized_recipient",
              });
          });
        await tx(async (c) => {
          for (const recipient of targets)
            await c.query(
              "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES(:p1,:p2,:p3,:p4,'inapp',:p5,:p6,:p7) ON DUPLICATE KEY UPDATE id=id",
              [
                id(),
                job.event_id,
                job.rule_id,
                job.version,
                recipient,
                clock,
                job.snapshot,
              ],
            );
          await c.query(
            "UPDATE notification_jobs SET state='cancelled',result='Recipient changed or no longer authorized',completed_at=:p2 WHERE id=:p1",
            [job.id, clock],
          );
        });
        return;
      }
    }
    const task =
      job.snapshot.payload.taskId &&
      (
        await pool.query("SELECT * FROM followup_tasks WHERE id=:p1", [
          job.snapshot.payload.taskId,
        ])
      ).rows[0];
    if (
      job.snapshot.payload.taskId &&
      (!task || ["completed", "cancelled"].includes(task.status)||Number(task.details?.noticeRevision||0)!==Number(job.snapshot.payload.taskNoticeVersion||0))
    ) {
      await pool.query(
        "UPDATE notification_jobs SET state='cancelled',result='Task completed' WHERE id=:p1",
        [job.id],
      );
      return;
    }
    const content = {
      event:
        contactPaused(lead) && task ? "Internal review" : job.snapshot.event,
      name: lead.fullName || lead.name || "Anonymous",
      owner: lead.owner || "Unassigned",
      due: (job.snapshot.event==="task.rescheduled"||job.snapshot.event==="task.appointment_due")&&task?.scheduled_at ? new Intl.DateTimeFormat(r.language==="zh"?"zh-CN":r.language==="id"?"id-ID":"en-GB",{timeZone:r.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(task.scheduled_at)) : task?.due_at
        ? new Intl.DateTimeFormat(
            r.language === "zh"
              ? "zh-CN"
              : r.language === "id"
                ? "id-ID"
                : "en-US",
            { timeZone: r.timezone, dateStyle: "medium", timeStyle: "short" },
          ).format(new Date(task.due_at))
        : "",
      leadId: job.snapshot.leadId,
    };
    if (job.channel === "inapp") {
      await tx(async (c) => {
        await c.query(
          "INSERT INTO notification_inbox(id,employee_id,content) VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE id=id",
          [job.id, job.recipient, content],
        );
        await c.query(
          "UPDATE notification_jobs SET state='accepted',completed_at=:p2 WHERE id=:p1",
          [job.id, clock],
        );
      });
      return;
    }
    const next = schedule(clock, { ...r, timing: "immediate" }, "lark");
    if (next.getTime() > clock.getTime()) {
      await pool.query(
        "UPDATE notification_jobs SET state='pending',due_at=:p2,result='Deferred by current working hours' WHERE id=:p1",
        [job.id, next],
      );
      return;
    }
    const recent = (
      await pool.query(
        "SELECT j.id FROM notification_jobs j WHERE j.channel='lark' AND j.recipient=:p1 AND j.state IN ('accepted','simulated') AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.snapshot,'$.leadId')),'null') <=> :p2 AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.snapshot,'$.event')),'null')=:p3 AND COALESCE(j.completed_at,j.due_at)>CAST(:p4 AS DATETIME(6))-INTERVAL (:p5 * 60) SECOND AND COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.snapshot,'$.priority')),'null'),'normal')=:p6 LIMIT 1",
        [
          job.recipient,
          job.snapshot.leadId,
          job.snapshot.event,
          clock,
          r.dedupeMinutes,
          job.snapshot.priority || "normal",
        ],
      )
    ).rows;
    if (recent.length) {
      await pool.query(
        "UPDATE notification_jobs SET state='cancelled',result='Merged within dedupe window' WHERE id=:p1",
        [job.id],
      );
      return;
    }
    const count = (
      await pool.query(
        "SELECT COUNT(*) AS count FROM notification_jobs WHERE channel='lark' AND recipient=:p1 AND state IN ('accepted','simulated') AND COALESCE(completed_at,due_at)>CAST(:p2 AS DATETIME(6))-INTERVAL 1 hour",
        [job.recipient, clock],
      )
    ).rows[0].count;
    const config = (
      await pool.query(
        "SELECT config FROM notification_channels WHERE id=:p1",
        [job.recipient],
      )
    ).rows[0]?.config;
    const limit = await groupRateLimit(pool, job.recipient, config);
    if (Number(count) >= limit.maxPerHour) {
      await pool.query(
        "UPDATE notification_jobs SET state='pending',due_at=:p2,result='Group hourly limit reached' WHERE id=:p1",
        [job.id, new Date(clock.getTime() + 3600000)],
      );
      return;
    }
    if (!config) {
      await tx(async (c) => {
        await c.query(
          "UPDATE notification_jobs SET state='failed',result='Missing notification channel',completed_at=:p2 WHERE id=:p1",
          [job.id, clock],
        );
        if (job.snapshot.event !== "notification.failed")
          await event(c, "notification.failed", null, { jobId: job.id });
      });
      return;
    }
    if (process.env.PORTAL_DEPLOYMENT === 'company-trial' && process.env.PORTAL_NOTIFICATION_MODE === 'simulation' && config.mode !== 'simulation') {
      await pool.query("UPDATE notification_jobs SET state='failed',result='Company trial simulation mode blocks live channel',completed_at=:p2 WHERE id=:p1",[job.id,clock]);
      return;
    }
    if (config.mode === "simulation") {
      await pool.query(
        "UPDATE notification_jobs SET state='simulated',result='No live channel configured',completed_at=:p2 WHERE id=:p1",
        [job.id, clock],
      );
      return;
    }
    const url = process.env[config.secretRef];
    if (
      !validWebhook(url) ||
      ((config.signingEnabled ?? !!config.signingSecretRef) &&
        !process.env[config.signingSecretRef]) ||
      ((process.env.PORTAL_DEPLOYMENT === 'company-trial' || process.env.PLATFORM_MODE === "mock" ||
        process.env.APP_ENV === "test" ||
        process.env.NODE_ENV !== "production") &&
        process.env.LARK_TEST_GROUP !== job.recipient)
    ) {
      await tx(async (c) => {
        await c.query(
          "UPDATE notification_jobs SET state='failed',result='Channel not configured or test group disallowed',completed_at=:p2 WHERE id=:p1",
          [job.id, clock],
        );
        if (job.snapshot.event !== "notification.failed")
          await event(c, "notification.failed", null, { jobId: job.id });
      });
      return;
    }
    let state = "accepted",
      result = "";
    let retry = false;
    let serverWait = 0;
    try {
      const text = (
        contactPaused(lead) && task
          ? r.language === "zh"
            ? "内部核实／复查：{{name}}，负责人 {{owner}}，原期限 {{due}}。暂停主动联系。"
            : r.language === "id"
              ? "Tinjauan internal: {{name}}, penanggung jawab {{owner}}, tenggat awal {{due}}. Kontak proaktif dijeda."
              : "Internal review: {{name}}, owner {{owner}}, original deadline {{due}}. Proactive contact paused."
          : r.template
      ).replace(/\{\{(event|name|owner|due)\}\}/g, (_, k) =>
        String(content[k]),
      );
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          larkCard(
            (r.language === "zh"
              ? job.snapshot.event === "notification.failed"
                ? "[运营异常] "
                : "[销售通知] "
              : r.language === "id"
                ? job.snapshot.event === "notification.failed"
                  ? "[Operasional] "
                  : "[Penjualan] "
                : job.snapshot.event === "notification.failed"
                  ? "[Operations] "
                  : "[Sales] ") +
              text +
              (job.snapshot.payload.counts
                ? "\n" + JSON.stringify(job.snapshot.payload.counts)
                : ""),
            job.snapshot.leadId,
            (config.signingEnabled ?? !!config.signingSecretRef)
              ? process.env[config.signingSecretRef]
              : undefined,
            clock,
          ),
        ),
        signal: AbortSignal.timeout(10000),
      });
      serverWait = retryAfter(response.headers.get("retry-after"), clock);
      const body = await response.json().catch(() => null);
      if (
        response.ok &&
        (!body || (body.code === undefined && body.StatusCode === undefined))
      )
        throw Error("Invalid Lark receipt");
      if (!response.ok || Number(body?.code ?? body?.StatusCode) !== 0) {
        state = "failed";
        result = `HTTP ${response.status}; code ${body?.code ?? body?.StatusCode}`;
        // Lark can return a rate-limit rejection in an HTTP 200 receipt.
        // Only this documented transient business code joins the existing HTTP retries.
        retry = response.status === 429 || response.status >= 500 ||
          Number(body?.code ?? body?.StatusCode) === 11232;
      }
    } catch (e) {
      state = "unknown";
      result = (e as Error).message;
    }
    if (retry && job.attempts < r.retries.length) {
      await pool.query(
        "UPDATE notification_jobs SET state='pending',due_at=UTC_TIMESTAMP(6)+INTERVAL (:p2 * 60) SECOND,result=:p3 WHERE id=:p1",
        [job.id, Math.max(r.retries[job.attempts], serverWait / 60), result],
      );
    } else {
      if (retry) result += "; retry limit reached";
      await tx(async (c) => {
        await c.query(
          "UPDATE notification_jobs SET state=:p2,result=:p3,completed_at=:p4 WHERE id=:p1",
          [job.id, state, result, clock],
        );
        if (
          ["failed", "unknown"].includes(state) &&
          job.snapshot.event !== "notification.failed"
        )
          await event(c, "notification.failed", null, { jobId: job.id });
      });
    }
  } finally {
    if (guard) {
      try {
        await guard.query("SELECT RELEASE_LOCK(:p1)", [
          "lark:" + job.recipient,
        ]);
      } catch (e) {
        console.error("[WORKER CLEANUP]", (e as Error).message);
      } finally {
        lease?.release();
      }
    }
  }
}
const workerRuns = new WeakMap<object, { stop: () => Promise<void> }>();
export function startWorker() {
  let running: Promise<void> | null = null,
    stopped = false;
  const timer = setInterval(() => {
    if (running || stopped) return;
    running = (async () => {
      try {
        for (let i = 0; i < 20 && !stopped; i++) await tick();
      } catch (e) {
        console.error("[WORKER]", (e as Error).message);
      }
    })().finally(() => {
      running = null;
    });
  }, 1000);
  timer.unref();
  workerRuns.set(timer, {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  });
  return timer;
}
export async function stopWorker(timer: ReturnType<typeof startWorker>) {
  const run = workerRuns.get(timer);
  if (run) await run.stop();
  else clearInterval(timer);
  workerRuns.delete(timer);
}
