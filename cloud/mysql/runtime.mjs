import crypto from "node:crypto";
import { openTrialDatabase } from "./database.mjs";
import { bindSql, validateSql } from "./sql.mjs";
import { migrate } from "./migrate.mjs";
const raw = await openTrialDatabase(process.env);
export const nativePool = raw;
const database = decodeURIComponent(new URL(process.env.MYSQL_TRIAL_URL).pathname.slice(1));
export const id = () => crypto.randomUUID();
function result(rows) {
  return {
    rows: Array.isArray(rows)
      ? rows.map((row) => {
          if (row.historicalHold !== undefined)
            row.historicalHold = Boolean(Number(row.historicalHold));
          if (typeof row.active === "number") row.active = Boolean(row.active);
          if (typeof row.enabled === "number" && row.config)
            row.enabled = Boolean(row.enabled);
          for (const field of [
            "at",
            "created_at",
            "updated_at",
            "due_at",
            "original_due_at",
            "scheduled_at",
            "expires_at",
            "effective_at",
            "processed_at",
            "completed_at",
            "lease_until",
            "window_start",
          ])
            if (typeof row[field] === "string")
              row[field] = new Date(row[field].replace(" ", "T") + "Z");
          return row;
        })
      : [],
    rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows,
  };
}
const lockKey = (resource) =>
  "uper:" +
  crypto.createHash("sha256").update(resource).digest("hex").slice(0, 58);
function dayKey(stamp, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(stamp);
  return ["year", "month", "day"]
    .map((kind) => parts.find((p) => p.type === kind).value)
    .join("");
}
export async function initialize() {
  await migrate(raw, database);
}
export async function connection() {
  const c = await raw.getConnection();
  await c.query("SET time_zone='+00:00'");
  const sessionLocks = new Set(),
    transactionLocks = new Set();
  let inTransaction = false,
    broken = false;
  const execute = async (sql, values = []) => {
    const prepared = [...values];
    for (const match of sql.matchAll(/CAST\(:p(\d+) AS DATETIME\(6\)\)/g)) {
      const i = Number(match[1]) - 1;
      if (typeof prepared[i] === "string") prepared[i] = new Date(prepared[i]);
    }
    const insert = sql.match(/^INSERT INTO \w+\(([^)]+)\) VALUES\(([^)]+)\)/);
    if (insert) {
      const columns = insert[1].split(","),
        tokens = insert[2].split(",");
      columns.forEach((column, index) => {
        if (
          /^(due_at|expires_at|created_at)$/.test(column.trim()) &&
          /^:p\d+$/.test(tokens[index]?.trim())
        ) {
          const position = Number(tokens[index].trim().slice(2)) - 1;
          if (
            typeof prepared[position] === "string" &&
            /T.*(?:Z|[+-]\d\d:\d\d)$/.test(prepared[position])
          )
            prepared[position] = new Date(prepared[position]);
        }
      });
    }
    const query = bindSql(sql, prepared);
    return result(
      (
        await (/^(CREATE|DROP|ALTER|TRUNCATE|SAVEPOINT|ROLLBACK TO)/i.test(sql)
          ? c.query(query.sql, query.parameters)
          : c.execute(query.sql, query.parameters))
      )[0],
    );
  };
  async function releaseLock(key) {
    const [rows] = await c.execute("SELECT RELEASE_LOCK(?) AS released", [key]);
    if (Number(rows[0].released) !== 1) throw Error("Lock release uncertain");
  }
  const client = {
    async query(input, values = []) {
      if (typeof input !== "string")
        throw Error("A native MySQL statement is required");
      const sql = validateSql(input.trim());
      if (sql === "BEGIN") {
        await c.beginTransaction();
        inTransaction = true;
        return { rows: [], rowCount: 0 };
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") {
        try {
          if (sql === "COMMIT") await c.commit();
          else await c.rollback();
        } catch (error) {
          broken = true;
          throw error;
        } finally {
          inTransaction = false;
          for (const key of transactionLocks) {
            try {
              await releaseLock(key);
            } catch {
              broken = true;
            }
          }
          transactionLocks.clear();
        }
        return { rows: [], rowCount: 0 };
      }
      if (/^SELECT GET_LOCK\(:p1,(0|5)\)/.test(sql)) {
        const key = lockKey(String(values[0])),
          timeout = sql.includes(",0)") ? 0 : 5;
        if (sessionLocks.has(key) || transactionLocks.has(key))
          return { rows: [{ acquired: true }], rowCount: 1 };
        const [rows] = await c.execute("SELECT GET_LOCK(?,?) AS acquired", [
          key,
          timeout,
        ]);
        const acquired = Number(rows[0].acquired) === 1;
        if (acquired)
          (inTransaction ? transactionLocks : sessionLocks).add(key);
        else if (timeout)
          throw Object.assign(Error("Resource busy; retry same request"), {
            status: 409,
          });
        return { rows: [{ acquired }], rowCount: 1 };
      }
      if (sql === "SELECT RELEASE_LOCK(:p1)") {
        const key = lockKey(String(values[0]));
        await releaseLock(key);
        sessionLocks.delete(key);
        transactionLocks.delete(key);
        return { rows: [], rowCount: 1 };
      }
      if (/^INSERT INTO portal_leads\(id,profile(?:,created_at)?\)/.test(sql)) {
        const match = sql.match(
          /^INSERT INTO portal_leads\(id,profile(?:,created_at)?\) VALUES\(([^)]+)\)/,
        );
        if (!match || /^,/.test(sql.slice(match[0].length)))
          throw Error("One explicit lead insert required");
        const tokens = match[1].split(","),
          selected = (
            await execute(
              "SELECT " +
                tokens[0] +
                " AS leadId," +
                tokens[1] +
                " AS inputProfile",
              values,
            )
          ).rows[0];
        const leadId = selected.leadId,
          profile =
            typeof selected.inputProfile === "string"
              ? JSON.parse(selected.inputProfile)
              : selected.inputProfile;
        const ownTransaction = !inTransaction;
        if (ownTransaction) {
          await c.beginTransaction();
          inTransaction = true;
        }
        try {
          const calendar = (
              await execute("SELECT value FROM portal_settings WHERE id='sla'")
            ).rows[0]?.value,
            zone = calendar?.timezone || "Asia/Jakarta";
          const at = /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(
            profile.submittedAt || "",
          )
            ? new Date(profile.submittedAt)
            : new Date();
          const key = dayKey(
            Number.isFinite(at.getTime()) ? at : new Date(),
            zone,
          );
          await execute(
            "INSERT INTO lead_daily_counters(business_date,`last_value`) VALUES(:p1,1) ON DUPLICATE KEY UPDATE `last_value`=`last_value`+1",
            [key],
          );
          const count = (
              await execute(
                "SELECT `last_value` AS n FROM lead_daily_counters WHERE business_date=:p1 FOR UPDATE",
                [key],
              )
            ).rows[0].n,
            number = key + "-" + String(count).padStart(3, "0");
          await execute(
            "INSERT INTO portal_leads(id,business_number,profile) VALUES(:p1,:p2,:p3)",
            [leadId, number, { ...profile, businessNumber: number }],
          );
          if (tokens[2])
            await execute(
              "UPDATE portal_leads SET created_at=" +
                tokens[2] +
                " WHERE id=:p" +
                (values.length + 1),
              [...values, leadId],
            );
          const saved = await execute(
            "SELECT * FROM portal_leads WHERE id=:p1",
            [leadId],
          );
          if (ownTransaction) {
            await c.commit();
            inTransaction = false;
          }
          return saved;
        } catch (error) {
          if (ownTransaction) {
            await c.rollback();
            inTransaction = false;
          }
          throw error;
        }
      }
      if (sql === "UPDATE portal_leads SET profile=:p2 WHERE id=:p1") {
        const number = (
          await execute(
            "SELECT business_number FROM portal_leads WHERE id=:p1",
            [values[0]],
          )
        ).rows[0]?.business_number;
        if (!number) return { rows: [], rowCount: 0 };
        const profile =
            typeof values[1] === "string" ? JSON.parse(values[1]) : values[1],
          changed = await execute(sql, [
            values[0],
            { ...profile, businessNumber: number },
          ]);
        return {
          rows: [{ business_number: number }],
          rowCount: changed.rowCount,
        };
      }
      const output = await execute(sql, values);
      // These repository inserts return the persisted row explicitly; MySQL has no INSERT result row.
      const table = sql.startsWith(
        "INSERT INTO conversations(id,visitor_id,lead_id,source,attribution)",
      )
        ? "conversations"
        : sql.startsWith("INSERT INTO visitor_sessions(id,expires_at)")
          ? "visitor_sessions"
          : sql.startsWith(
                "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at",
              )
            ? "followup_tasks"
            : null;
      return table
        ? execute(`SELECT * FROM ${table} WHERE id=:p1`, [values[0]])
        : output;
    },
    async mergeLeadProfile([leadId, changes, assessmentChanges]) {
      const row = (
        await execute(
          "SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",
          [leadId],
        )
      ).rows[0];
      if (!row) return { rows: [], rowCount: 0 };
      const parse = (value) =>
        typeof value === "string" ? JSON.parse(value) : value;
      return client.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
        leadId,
        {
          ...row.profile,
          ...parse(changes),
          ...(row.profile.levelSource === "trial"
            ? {}
            : parse(assessmentChanges)),
        },
      ]);
    },
    async recoverInterruptedMessages() {
      const rows = (
        await execute(
          "SELECT DISTINCT conversation_id FROM messages WHERE status='generating'",
        )
      ).rows;
      for (const row of rows) {
        const key = lockKey(row.conversation_id),
          [locked] = await c.execute("SELECT GET_LOCK(?,0) acquired", [key]);
        if (Number(locked[0].acquired) !== 1) continue;
        try {
          await execute(
            "UPDATE messages SET status='interrupted',error='process_interrupted' WHERE status='generating' AND conversation_id=:p1",
            [row.conversation_id],
          );
        } finally {
          await releaseLock(key);
        }
      }
      return { rows: [], rowCount: rows.length };
    },
    async dailyStageCounts([_retiredTeam, zone, date, tiers, states, sources]) {
      const records = (
          await execute("SELECT profile,created_at FROM portal_leads")
        ).rows,
        counts = new Map();
      for (const row of records) {
        const p = row.profile;
        if (
          dayKey(row.created_at, zone) !== date.replaceAll("-", "") ||
          (tiers.length && !tiers.includes(p.tier)) ||
          (states.length && !states.includes(p.currentStage)) ||
          (sources.length && !sources.includes(p.entryPoint))
        )
          continue;
        counts.set(p.currentStage, (counts.get(p.currentStage) || 0) + 1);
      }
      return {
        rows: [...counts].map(([stage, count]) => ({ stage, count })),
        rowCount: counts.size,
      };
    },
    async exportLeads() {
      const leads = (
        await execute(
          "SELECT id,business_number,profile FROM portal_leads WHERE NULLIF(profile->>'$.identityMergedInto','null') IS NULL ORDER BY created_at DESC",
        )
      ).rows;
      for (const row of leads)
        row.profile = {
          ...row.profile,
          id: row.id,
          businessNumber: row.business_number,
          chatTranscript: (
            await execute(
              "SELECT m.*,c.source FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE (c.lead_id=:p1 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY m.sequence",
              [row.id],
            )
          ).rows.map((m) => ({ ...m, timestamp: m.created_at })),
        };
      return { rows: leads, rowCount: leads.length };
    },
    async leadAttention([employeeId, leadIds, activitySnapshot]) {
      if (Array.isArray(leadIds) && !leadIds.length) return {rows: [], rowCount: 0};
      const leads = (await execute(Array.isArray(leadIds)
        ? `SELECT id,profile FROM portal_leads WHERE id IN (${leadIds.map((_,i)=>':p'+(i+1)).join(',')})`
        : "SELECT id,profile FROM portal_leads", leadIds || [])).rows,
        rows = [];
      for (const lead of leads) {
        const tasks = (
          await execute(
            "SELECT * FROM followup_tasks WHERE lead_id=:p1 ORDER BY due_at",
            [lead.id],
          )
        ).rows;
        const activity=(await execute(`SELECT a.activity_at,a.event_type,a.source FROM (
          SELECT m.created_at AS activity_at,m.id AS activity_id,'conversation.updated' AS event_type,c.source FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE (c.lead_id=:p1 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND m.role='user' AND TRIM(m.content)<>''
          UNION ALL SELECT o.created_at,o.id,o.type,o.payload->>'$.source' FROM outbox o WHERE o.lead_id=:p1 AND o.type IN ('lead.created','assessment.completed','conversation.reactivated','handoff.requested','booking.requested','enrollment.requested')
        ) a WHERE a.activity_at<=COALESCE(STR_TO_DATE(:p2,'%Y-%m-%dT%H:%i:%s.%fZ'),UTC_TIMESTAMP(6)) ORDER BY a.activity_at DESC,a.activity_id DESC LIMIT 1`,[lead.id,activitySnapshot||null])).rows[0];
        rows.push({
          id: lead.id,
          latest: activity?{type:activity.event_type,at:activity.activity_at,source:activity.source}:null,
          tasks: tasks
            .filter(
              (t) =>
                ["open", "overdue"].includes(t.status) ||
                (t.status === "migration_hold" &&
                  !["Enrolled", "Lost"].includes(lead.profile.currentStage)),
            )
            .map((t) => ({
              id: t.id,
              kind: t.kind,
              revision: t.revision,
              ownerId: t.owner_id,
              status: t.status,
              dueAt: t.due_at,
              originalDueAt: t.original_due_at,
              scheduledAt: t.scheduled_at,
              timingKind: t.timing_kind,
              details: t.details,
            })),
          history: tasks
            .filter((t) => t.status === "completed")
            .map((t) => ({ id: t.id, status: t.status, dueAt: t.due_at })),
        });
      }
      return { rows, rowCount: rows.length };
    },
  };
  return {
    client,
    discard() { broken = true; },
    async release() {
      if (inTransaction)
        await c.rollback().catch(() => {
          broken = true;
        });
      for (const key of new Set([...sessionLocks, ...transactionLocks]))
        try {
          await releaseLock(key);
        } catch {
          broken = true;
        }
      if (broken) c.destroy();
      else c.release();
    },
  };
}
const methods = [
  "query",
  "mergeLeadProfile",
  "recoverInterruptedMessages",
  "dailyStageCounts",
  "exportLeads",
  "leadAttention",
];
export const pool = { end: () => raw.end() };
for (const method of methods)
  pool[method] = async (...args) => {
    const lease = await connection();
    try {
      return await lease.client[method](...args);
    } finally {
      await lease.release();
    }
  };
export async function tx(operation, options = {}) {
  if (options.isolation !== undefined && options.isolation !== 'READ COMMITTED')
    throw Error('Unsupported transaction isolation');
  const lease = await connection();
  let begun = false;
  try {
    // One transaction only: never change the pooled connection's session default.
    if (options.isolation) await lease.client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await lease.client.query("BEGIN");
    begun = true;
    lease.client.transactionIsolation = options.isolation;
    const value = await operation(lease.client);
    await lease.client.query("COMMIT");
    return value;
  } catch (error) {
    if(options.isolation && !begun)lease.discard();
    await lease.client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    delete lease.client.transactionIsolation;
    await lease.release();
  }
}
export async function event(client, type, leadId, payload) {
  await client.query(
    "INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,:p2,:p3,:p4)",
    [id(), type, leadId, payload],
  );
}
