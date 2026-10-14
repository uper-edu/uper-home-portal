import {contactPaused} from "../../src/utils/crmContact.ts";
import {recipients,priority,retryAfter,validWebhook,larkCard,groupRateLimit,resolveRecipients} from "./notificationDelivery.ts";
import { pool, tx, id, event, connection } from "./store.ts";
import { platform } from "./identity.ts";
import { schedule, local, defaults, withCalendarMode, resolveCalendar, type Rule } from "./policy.ts";
export async function tick(clock=new Date()) {
  await tx(async (c) => {
    const globalCalendar=(await c.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0]?.value;
    await c.query(
      "UPDATE messages SET status='interrupted',error='process_interrupted' WHERE status='generating' AND pg_try_advisory_xact_lock(hashtext(conversation_id))",
    );
    const digestRules=(await c.query("SELECT * FROM notification_rules WHERE enabled=true AND config->>'event'='daily.digest' AND effective_at<=$1",[clock])).rows;
    for(const row of digestRules){
      const digestRule=resolveCalendar(row.config as Rule,globalCalendar);
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:digestRule.timezone}).format(clock);
      const l=local(clock,digestRule);
      if(digestRule.days.includes(l.day) && l.time>=digestRule.digestTime){
        const counts=(await c.query("SELECT profile->>'currentStage' AS stage,count(*) FROM portal_leads WHERE COALESCE(profile->>'team','sales')=$1 AND (created_at AT TIME ZONE $2)::date=$3::date AND (cardinality($4::text[])=0 OR profile->>'tier'=ANY($4)) AND (cardinality($5::text[])=0 OR profile->>'currentStage'=ANY($5)) AND (cardinality($6::text[])=0 OR profile->>'entryPoint'=ANY($6)) GROUP BY profile->>'currentStage'",[digestRule.team,digestRule.timezone,today,digestRule.tiers,digestRule.states,digestRule.sources])).rows;
        await c.query("INSERT INTO outbox(id,type,payload,created_at) VALUES($1,'daily.digest',$2,$3) ON CONFLICT DO NOTHING",['digest-'+row.id+'-'+today,{date:today,ruleId:row.id,team:digestRule.team,counts},clock]);
      }
    }
    const tasks = (
      await c.query(
        "SELECT * FROM followup_tasks WHERE status='open' AND due_at<$1 FOR UPDATE SKIP LOCKED",[clock],
      )
    ).rows;
    for (const task of tasks) {
      await c.query("UPDATE followup_tasks SET status='overdue' WHERE id=$1", [
        task.id,
      ]);
      await event(c, "task.overdue", task.lead_id, { taskId: task.id });
    }
    const events = (
      await c.query(
        "SELECT * FROM outbox WHERE processed_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 50",
      )
    ).rows;
    const employees = await platform.employees();
    for (const ev of events) {
      const lead = ev.lead_id
        ? (
            await c.query("SELECT profile FROM portal_leads WHERE id=$1", [
              ev.lead_id,
            ])
          ).rows[0]?.profile
        : {};
      if(ev.payload.taskId){
        const task=(await c.query('SELECT status FROM followup_tasks WHERE id=$1',[ev.payload.taskId])).rows[0];
        if(!task || ['completed','cancelled'].includes(task.status)){await c.query('UPDATE outbox SET processed_at=now() WHERE id=$1',[ev.id]);continue;}
      }
      const rules = (
        await c.query("SELECT * FROM notification_rules WHERE enabled=true AND effective_at<=(SELECT created_at FROM outbox WHERE id=$1)",[ev.id])
      ).rows;
      for (const rule of rules) {
        const r = withCalendarMode(rule.config as Rule);
        const effective=resolveCalendar(r,globalCalendar);
        if (
          r.event !== ev.type ||
          (ev.type==='daily.digest' && ev.payload.ruleId!==rule.id) ||
          (r.teams?.length && !r.teams.includes(ev.type==='daily.digest'?ev.payload.team:(lead?.team || 'sales'))) ||
          (ev.type!=='daily.digest' && r.sources.length && !r.sources.includes(ev.payload.source)) ||
          (ev.type!=='daily.digest' && r.tiers.length && !r.tiers.includes(lead?.tier)) ||
          (ev.type!=='daily.digest' && r.states.length && !r.states.includes(lead?.currentStage))
        )
          continue;
        for (const channel of r.channels) {
          const route=channel==='inapp'?resolveRecipients(r,lead,employees,ev.lead_id):null;
          const targets=route?route.ids:[r.group];
          if(route && !targets.length){
            await c.query("INSERT INTO portal_audit(actor,action,data) VALUES('system','notification.routing_unresolved',$1)",[{eventId:ev.id,ruleId:rule.id,reason:route.reason}]);
            if(ev.type!=='notification.failed')await event(c,'notification.failed',null,{reason:route.reason,eventId:ev.id,ruleId:rule.id});
          }
          for (const recipient of targets) {
            const key = id();
            await c.query(
              "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
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
                  routingReason:route?.reason,
                  priority: priority(ev.type,ev.payload,lead),
                  plannedCalendar:{timezone:effective.timezone,start:effective.start,end:effective.end,days:effective.days},
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
      await c.query("UPDATE outbox SET processed_at=now() WHERE id=$1", [
        ev.id,
      ]);
    }
  });
  await pool.query(
    "UPDATE notification_jobs SET state=CASE WHEN channel='lark' THEN 'unknown' ELSE 'pending' END,result='Lease expired' WHERE state='sending' AND lease_until<now()",
  );
  const job = await tx(async (c) => {
    const row = (
      await c.query(
        "SELECT * FROM notification_jobs WHERE state='pending' AND due_at<=$1 ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1",[clock],
      )
    ).rows[0];
    if (row)
      await c.query(
        "UPDATE notification_jobs SET state='sending',lease_until=now()+interval '1 minute',attempts=attempts+1 WHERE id=$1",
        [row.id],
      );
    return row;
  });
  if (!job) return;
  const lease = job.channel === "lark" ? await connection() : null;
  const guard = lease?.client;
  if (guard) {
    try { const locked = (
      await guard.query(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
        ["lark:" + job.recipient],
      )
    ).rows[0].acquired;
    if (!locked) {
      await pool.query(
        "UPDATE notification_jobs SET state='pending',due_at=now()+interval '1 second' WHERE id=$1",
        [job.id],
      );
      lease?.release();
      return;
    } } catch(e) { lease?.release(); throw e; }
  }
  try {
    const storedRule=job.snapshot.rule as Rule;
    const globalCalendar=(await pool.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0]?.value;
    const r=resolveCalendar({...storedRule,calendarMode:storedRule.calendarMode || 'custom'},globalCalendar);
    const lead =
      (
        await pool.query("SELECT profile FROM portal_leads WHERE id=$1", [
          job.snapshot.leadId,
        ])
      ).rows[0]?.profile || {};
    if(job.channel==='inapp'){
      const targets=recipients(r,lead,await platform.employees(),job.snapshot.leadId);
      if(!targets.includes(job.recipient)){
        if(!targets.length)await tx(async c=>{await c.query("INSERT INTO portal_audit(actor,action,data) VALUES('system','notification.routing_unresolved',$1)",[{jobId:job.id,reason:'no_authorized_recipient'}]);if(job.snapshot.event!=='notification.failed')await event(c,'notification.failed',null,{jobId:job.id,reason:'no_authorized_recipient'});});
        await tx(async c=>{
          for(const recipient of targets)await c.query("INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,due_at,snapshot) VALUES($1,$2,$3,$4,'inapp',$5,$6,$7) ON CONFLICT DO NOTHING",[id(),job.event_id,job.rule_id,job.version,recipient,clock,job.snapshot]);
          await c.query("UPDATE notification_jobs SET state='cancelled',result='Recipient changed or no longer authorized',completed_at=$2 WHERE id=$1",[job.id,clock]);
        });return;
      }
    }
    const task =
      job.snapshot.payload.taskId &&
      (
        await pool.query("SELECT * FROM followup_tasks WHERE id=$1", [
          job.snapshot.payload.taskId,
        ])
      ).rows[0];
    if (job.snapshot.payload.taskId && (!task || ["completed","cancelled"].includes(task.status))) {
      await pool.query(
        "UPDATE notification_jobs SET state='cancelled',result='Task completed' WHERE id=$1",
        [job.id],
      );
      return;
    }
    const content = {
      event: contactPaused(lead)&&task ? "Internal review" : job.snapshot.event,
      name: lead.fullName || lead.name || "Anonymous",
      owner: lead.owner || "Unassigned",
      due: task?.due_at ? new Intl.DateTimeFormat(r.language==='zh'?'zh-CN':r.language==='id'?'id-ID':'en-US',{timeZone:r.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(task.due_at)) : '',
      leadId: job.snapshot.leadId,
    };
    if (job.channel === "inapp") {
      await tx(async (c) => {
        await c.query(
          "INSERT INTO notification_inbox(id,employee_id,content) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [job.id, job.recipient, content],
        );
        await c.query(
          "UPDATE notification_jobs SET state='accepted',completed_at=$2 WHERE id=$1",
          [job.id,clock],
        );
      });
      return;
    }
    const next=schedule(clock,{...r,timing:'immediate'},'lark');
    if(next.getTime()>clock.getTime()){await pool.query("UPDATE notification_jobs SET state='pending',due_at=$2,result='Deferred by current working hours' WHERE id=$1",[job.id,next]);return;}
    const recent = (
      await pool.query(
        "SELECT j.id FROM notification_jobs j WHERE j.channel='lark' AND j.recipient=$1 AND j.state IN ('accepted','simulated') AND j.snapshot->>'leadId' IS NOT DISTINCT FROM $2 AND j.snapshot->>'event'=$3 AND COALESCE(j.completed_at,j.due_at)>$4::timestamptz-($5*interval '1 minute') AND COALESCE(j.snapshot->>'priority','normal')=$6 LIMIT 1",
        [
          job.recipient,
          job.snapshot.leadId,
          job.snapshot.event,
          clock,r.dedupeMinutes,job.snapshot.priority || 'normal',
        ],
      )
    ).rows;
    if (recent.length) {
      await pool.query(
        "UPDATE notification_jobs SET state='cancelled',result='Merged within dedupe window' WHERE id=$1",
        [job.id],
      );
      return;
    }
    const count = (
      await pool.query(
        "SELECT count(*) FROM notification_jobs WHERE channel='lark' AND recipient=$1 AND state IN ('accepted','simulated') AND COALESCE(completed_at,due_at)>$2::timestamptz-interval '1 hour'",
        [job.recipient,clock],
      )
    ).rows[0].count;
    const config=(await pool.query("SELECT config FROM notification_channels WHERE id=$1",[job.recipient])).rows[0]?.config;
    const limit=await groupRateLimit(pool,job.recipient,config);
    if (Number(count) >= limit.maxPerHour) {
      await pool.query("UPDATE notification_jobs SET state='pending',due_at=$2,result='Group hourly limit reached' WHERE id=$1",[job.id,new Date(clock.getTime()+3600000)]);
      return;
    }
    if (!config) {
      await tx(async c=>{await c.query("UPDATE notification_jobs SET state='failed',result='Missing notification channel',completed_at=$2 WHERE id=$1",[job.id,clock]);if(job.snapshot.event!=='notification.failed')await event(c,'notification.failed',null,{jobId:job.id});});return;
    }
    if (config.mode === "simulation") {
      await pool.query(
        "UPDATE notification_jobs SET state='simulated',result='No live channel configured',completed_at=$2 WHERE id=$1",
        [job.id,clock],
      );
      return;
    }
    const url = process.env[config.secretRef];
    if (
      !validWebhook(url) ||
      ((config.signingEnabled ?? !!config.signingSecretRef) && !process.env[config.signingSecretRef]) ||
      ((process.env.PLATFORM_MODE === "mock" || process.env.APP_ENV === "test" || process.env.NODE_ENV !== "production") &&
        process.env.LARK_TEST_GROUP !== job.recipient)
    ) {
      await tx(async c=>{
        await c.query("UPDATE notification_jobs SET state='failed',result='Channel not configured or test group disallowed',completed_at=$2 WHERE id=$1",[job.id,clock]);
        if(job.snapshot.event!=='notification.failed')await event(c,'notification.failed',null,{jobId:job.id});
      });
      return;
    }
    let state = "accepted",
      result = "";
    let retry = false;
    let serverWait = 0;
    try {
      const text = (contactPaused(lead)&&task ? (r.language==="zh"?"内部核实／复查：{{name}}，负责人 {{owner}}，原期限 {{due}}。暂停主动联系。":r.language==="id"?"Tinjauan internal: {{name}}, penanggung jawab {{owner}}, tenggat awal {{due}}. Kontak proaktif dijeda.":"Internal review: {{name}}, owner {{owner}}, original deadline {{due}}. Proactive contact paused.") : r.template).replace(
        /\{\{(event|name|owner|due)\}\}/g,
        (_, k) => String(content[k]),
      );
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(larkCard((r.language==="zh"?(job.snapshot.event==="notification.failed"?"[运营异常] ":"[销售通知] "):r.language==="id"?(job.snapshot.event==="notification.failed"?"[Operasional] ":"[Penjualan] "):(job.snapshot.event==="notification.failed"?"[Operations] ":"[Sales] "))+text+(job.snapshot.payload.counts?'\n'+JSON.stringify(job.snapshot.payload.counts):''),job.snapshot.leadId,(config.signingEnabled ?? !!config.signingSecretRef)?process.env[config.signingSecretRef]:undefined,clock)),
        signal: AbortSignal.timeout(10000),
      });
      serverWait = retryAfter(response.headers.get("retry-after"),clock);
      const body = await response.json().catch(()=>null);
      if(response.ok && (!body || (body.code===undefined && body.StatusCode===undefined)))throw Error("Invalid Lark receipt");
      if (!response.ok || Number(body?.code ?? body?.StatusCode) !== 0) {
        state = "failed";
        result = `HTTP ${response.status}; code ${body?.code ?? body?.StatusCode}`;
        retry = response.status === 429 || response.status >= 500;
      }
    } catch (e) {
      state = "unknown";
      result = (e as Error).message;
    }
    if (retry && job.attempts < r.retries.length) {
      await pool.query(
        "UPDATE notification_jobs SET state='pending',due_at=now()+($2*interval '1 minute'),result=$3 WHERE id=$1",
        [job.id, Math.max(r.retries[job.attempts], serverWait / 60), result],
      );
    } else {
      await tx(async (c) => {
        await c.query(
          "UPDATE notification_jobs SET state=$2,result=$3,completed_at=$4 WHERE id=$1",
          [job.id, state, result,clock],
        );
        if (["failed","unknown"].includes(state) && job.snapshot.event !== "notification.failed")
          await event(c, "notification.failed", null, { jobId: job.id });
      });
    }
  } finally {
    if (guard) {
      try { await guard.query("SELECT pg_advisory_unlock(hashtext($1))", [
        "lark:" + job.recipient,
      ]); } catch(e) { console.error("[WORKER CLEANUP]",(e as Error).message); } finally { lease?.release(); }
    }
  }
}
export function startWorker() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (let i = 0; i < 20; i++) await tick();
    } catch (e) {
      console.error("[WORKER]", (e as Error).message);
    } finally {
      busy = false;
    }
  }, 1000);
  timer.unref();
  return timer;
}
