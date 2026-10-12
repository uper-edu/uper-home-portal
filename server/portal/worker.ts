import { pool, tx, id, event, connection } from "./store.ts";
import { platform } from "./identity.ts";
import { schedule, local, defaults, type Rule } from "./policy.ts";
export async function tick() {
  await tx(async (c) => {
    await c.query(
      "UPDATE messages SET status='interrupted',error='process_interrupted' WHERE status='generating' AND pg_try_advisory_xact_lock(hashtext(conversation_id))",
    );
    const digestRule = (
      await c.query(
        "SELECT config FROM notification_rules WHERE enabled=true AND config->>'event'='daily.digest' LIMIT 1",
      )
    ).rows[0]?.config;
    if (digestRule) {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: digestRule.timezone,
      }).format(new Date());
      const l = local(new Date(), digestRule);
      if (digestRule.days.includes(l.day) && l.time >= digestRule.digestTime) {
        await c.query(
          "INSERT INTO outbox(id,type,payload) VALUES($1,'daily.digest',$2) ON CONFLICT DO NOTHING",
          [
            "digest-" + digestRule.timezone + "-" + today,
            {
              date: today,
              counts: (
                await c.query(
                  "SELECT stage,count(*) FROM (SELECT profile->>'currentStage' AS stage FROM portal_leads) p GROUP BY stage",
                )
              ).rows,
            },
          ],
        );
      }
    }
    const tasks = (
      await c.query(
        "SELECT * FROM followup_tasks WHERE status='open' AND due_at<now() FOR UPDATE SKIP LOCKED",
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
      const rules = (
        await c.query("SELECT * FROM notification_rules WHERE enabled=true")
      ).rows;
      for (const rule of rules) {
        const r = rule.config as Rule;
        if (
          r.event !== ev.type ||
          (r.sources.length && !r.sources.includes(ev.payload.source)) ||
          (r.tiers.length && !r.tiers.includes(lead?.tier)) ||
          (r.states.length && !r.states.includes(lead?.currentStage))
        )
          continue;
        for (const channel of r.channels) {
          const recipients =
            channel === "lark"
              ? [r.group]
              : employees
                  .filter((e) =>
                    r.recipient === "owner" && lead?.owner
                      ? e.id === lead.owner
                      : e.teams.includes(
                          r.recipient === "supervisor" ? "supervisors" : r.team,
                        ),
                  )
                  .map((e) => e.id);
          for (const recipient of recipients) {
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
                    ? { ...r, timing: "immediate" }
                    : r,
                  channel,
                ),
                {
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
        "SELECT * FROM notification_jobs WHERE state='pending' AND due_at<=now() ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1",
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
    const r = job.snapshot.rule as Rule;
    const lead =
      (
        await pool.query("SELECT profile FROM portal_leads WHERE id=$1", [
          job.snapshot.leadId,
        ])
      ).rows[0]?.profile || {};
    if (
      r.recipient === "owner" &&
      lead.owner &&
      job.channel === "inapp" &&
      lead.owner !== job.recipient
    ) {
      job.recipient = lead.owner;
      await pool.query(
        "UPDATE notification_jobs SET recipient=$2 WHERE id=$1",
        [job.id, job.recipient],
      );
    }
    const task =
      job.snapshot.payload.taskId &&
      (
        await pool.query("SELECT * FROM followup_tasks WHERE id=$1", [
          job.snapshot.payload.taskId,
        ])
      ).rows[0];
    if (task?.status === "completed") {
      await pool.query(
        "UPDATE notification_jobs SET state='cancelled',result='Task completed' WHERE id=$1",
        [job.id],
      );
      return;
    }
    const content = {
      event: job.snapshot.event,
      name: lead.name || "Anonymous",
      owner: lead.owner || "Unassigned",
      due: task?.due_at || "",
      leadId: job.snapshot.leadId,
    };
    if (job.channel === "inapp") {
      await tx(async (c) => {
        await c.query(
          "INSERT INTO notification_inbox(id,employee_id,content) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [job.id, job.recipient, content],
        );
        await c.query(
          "UPDATE notification_jobs SET state='accepted' WHERE id=$1",
          [job.id],
        );
      });
      return;
    }
    const recent = (
      await pool.query(
        "SELECT j.id FROM notification_jobs j WHERE j.channel='lark' AND j.recipient=$1 AND j.state IN ('accepted','simulated') AND j.snapshot->>'leadId' IS NOT DISTINCT FROM $2 AND j.snapshot->>'event'=$3 AND j.due_at>now()-($4*interval '1 minute') LIMIT 1",
        [
          job.recipient,
          job.snapshot.leadId,
          job.snapshot.event,
          r.dedupeMinutes,
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
        "SELECT count(*) FROM notification_jobs WHERE channel='lark' AND recipient=$1 AND state IN ('accepted','simulated') AND due_at>now()-interval '1 hour'",
        [job.recipient],
      )
    ).rows[0].count;
    if (Number(count) >= r.maxPerHour) {
      await pool.query(
        "UPDATE notification_jobs SET state='pending',due_at=now()+interval '1 hour' WHERE id=$1",
        [job.id],
      );
      return;
    }
    const config = (
      await pool.query("SELECT config FROM notification_channels WHERE id=$1", [
        job.recipient,
      ])
    ).rows[0]?.config;
    if (!config || config.mode !== "live") {
      await pool.query(
        "UPDATE notification_jobs SET state='simulated',result='No live channel configured' WHERE id=$1",
        [job.id],
      );
      return;
    }
    const url = process.env[config.secretRef];
    if (
      !url ||
      !url.startsWith("https://open.larksuite.com/open-apis/bot/v2/hook/") ||
      (process.env.NODE_ENV !== "production" &&
        process.env.LARK_TEST_GROUP !== job.recipient)
    ) {
      await pool.query(
        "UPDATE notification_jobs SET state='failed',result='Channel not configured or test group disallowed' WHERE id=$1",
        [job.id],
      );
      return;
    }
    let state = "accepted",
      result = "";
    let retry = false;
    let retryAfter = 0;
    try {
      const text = r.template.replace(
        /\{\{(event|name|owner|due)\}\}/g,
        (_, k) => String(content[k]),
      );
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg_type: "text",
          content: {
            text: `[${process.env.NODE_ENV || "DEV"}] ${text}${job.snapshot.payload.counts ? "\n" + JSON.stringify(job.snapshot.payload.counts) : ""}\n${process.env.APP_URL || ""}/crm?lead=${content.leadId}`,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      retryAfter = Number(response.headers.get("retry-after")) || 0;
      const body = await response.json();
      if (!response.ok || Number(body.code ?? body.StatusCode) !== 0) {
        state = "failed";
        result = `HTTP ${response.status}; code ${body.code ?? body.StatusCode}`;
        retry = response.status === 429 || response.status >= 500;
      }
    } catch (e) {
      state = "unknown";
      result = (e as Error).message;
    }
    if (retry && job.attempts < r.retries.length) {
      await pool.query(
        "UPDATE notification_jobs SET state='pending',due_at=now()+($2*interval '1 minute'),result=$3 WHERE id=$1",
        [job.id, Math.max(r.retries[job.attempts], retryAfter / 60), result],
      );
    } else {
      await tx(async (c) => {
        await c.query(
          "UPDATE notification_jobs SET state=$2,result=$3 WHERE id=$1",
          [job.id, state, result],
        );
        if (state === "failed" && job.snapshot.event !== "notification.failed")
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
