import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectMigration } from "../server/portal/migration.ts";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { backupTables } from "../server/portal/backup.ts";
const fixtures = [
  {
    id: "legacy-test-a",
    fullName: "TEST Legacy A",
    phone: "000100",
    email: "shared@example.invalid",
    owner: "test-admin",
    submittedAt: "2026-09-01T00:00:00Z",
    slaDueTime: "2026-09-02T03:00:00Z",
    currentStage: "New",
    followUpLogs: [
      {
        id: "old-log-a",
        summary: "TEST first call",
        timestamp: "2026-09-01T02:00:00Z",
      },
      { id: "old-log-b", summary: "TEST second call" },
    ],
    chatTranscript: Array.from({ length: 12 }, (_, i) => ({
      id: "original-" + i,
      role: i % 2 ? "assistant" : "user",
      content: i < 2 ? "same repeated text" : i === 4 ? "" : "message " + i,
      ...(i === 4 ? { text: "must not replace empty content" } : {}),
      ...(i === 2
        ? {}
        : {
            timestamp:
              i === 3
                ? "invalid-time"
                : `2026-09-01T00:${String(12 - i).padStart(2, "0")}:00Z`,
          }),
    })),
  },
  {
    id: "legacy-test-b",
    fullName: "TEST Legacy B",
    phone: "000-100",
    email: "SHARED@example.invalid",
    slaDueTime: "2026-09-03T03:00:00Z",
    followUpLogs: [{ id: "old-log-c", summary: "TEST archived contact" }],
    chatTranscript: [
      {
        id: "b-1",
        role: "user",
        text: "TEST inquiry",
        timestamp: "2026-09-01T01:00:00Z",
      },
      {
        id: "b-2",
        role: "assistant",
        content: "TEST reply",
        timestamp: "2026-09-01T01:01:00Z",
      },
    ],
  },
  {
    id: "legacy-test-c",
    fullName: "TEST Legacy C",
    submittedAt: "invalid-date",
    chatTranscript: [],
  },
];
test("migration inspection exposes candidates and anomalies without inventing customer facts", () => {
  const { report } = inspectMigration(JSON.stringify(fixtures));
  assert.equal(report.leads, 3);
  assert.equal(report.messages, 14);
  assert.equal(report.followUpRecords, 3);
  assert.equal(report.invalidDates, 2);
  assert.equal(report.duplicateCandidates.length, 2);
  assert.equal(report.anomalies.length, 3);
  assert.equal(
    inspectMigration(JSON.stringify([{ id: "x", slaDueTime: "bad" }])).report
      .anomalies[0].severity,
    "blocking",
  );
  assert.equal(
    inspectMigration(JSON.stringify([{ id: "x" }, { id: "x" }])).report
      .duplicateIds,
    1,
  );
});
if (process.env.PORTAL_MIGRATION_TEST_DATABASE_URL) {
  const sourceUrl = new URL(process.env.PORTAL_MIGRATION_TEST_DATABASE_URL);
  if (
    !["127.0.0.1", "localhost"].includes(sourceUrl.hostname) ||
    sourceUrl.port !== "5448" ||
    !/^\/uper_backup_[a-z0-9_]+$/.test(sourceUrl.pathname)
  )
    throw Error("Explicit disposable 5448 backup test database required");
  const root = process.cwd(),
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "uper-backup-drill-")),
    names: string[] = [];
  const client = new pg.Client({ connectionString: sourceUrl.toString() });
  await client.connect();
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const file = path.join(dir, "leads.json"),
    policyFile = path.join(dir, "policy.json"),
    backup = path.join(dir, "backup.json");
  await fs.writeFile(file, JSON.stringify(fixtures));
  await fs.writeFile(
    policyFile,
    JSON.stringify({
      businessHours: {
        timezone: "Asia/Jakarta",
        startTime: "09:00",
        endTime: "20:00",
        workDays: [1, 2, 3, 4, 5, 6],
      },
      firstResponseSla: {
        hot: { value: 90, unit: "minutes" },
        warm: { value: 2, unit: "days" },
        cold: { value: 36, unit: "hours" },
      },
    }),
  );
  function run(script: string, args: string[], url = sourceUrl.toString()) {
    return JSON.parse(
      execFileSync(
        process.execPath,
        ["--import", "tsx", path.join(root, script), ...args],
        {
          cwd: root,
          env: {
            PATH: process.env.PATH,
            TMPDIR: os.tmpdir(),
            DATABASE_URL: url,
          },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    );
  }
  async function destination(suffix: string) {
    const name = sourceUrl.pathname.slice(1) + "_" + suffix;
    await admin.query("CREATE DATABASE " + name);
    names.push(name);
    const u = new URL(sourceUrl);
    u.pathname = "/" + name;
    return u.toString();
  }
  async function hashes(c: pg.Client) {
    const out: Record<string, string> = {};
    for (const t of backupTables) {
      const rows = (
        await c.query(
          `SELECT row_to_json(x)::text data FROM ${t} x ORDER BY row_to_json(x)::text`,
        )
      ).rows;
      out[t] = crypto
        .createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex");
    }
    return out;
  }
  const compatibility = path.join(dir, "compatible-51d4a78");
  await fs.mkdir(compatibility);
  const archive = execFileSync(
    "git",
    ["archive", "51d4a78", "server/portal", "src"],
    { cwd: root, maxBuffer: 32 * 1024 * 1024 },
  );
  execFileSync("tar", ["-x", "-C", compatibility], { input: archive });
  await fs.writeFile(
    path.join(compatibility, "package.json"),
    '{"type":"module"}',
  );
  await fs.symlink(
    path.join(root, "node_modules"),
    path.join(compatibility, "node_modules"),
  );
  let baseline: any, allData: any;
  await test("migration, backup, recovery and compatible rollback in disposable PostgreSQL", async (t) => {
    t.after(async () => {
      await client.end();
      await admin.end(); /* Keep test databases and report for audit. */
    });
    const passed: string[] = [];
    async function check(name: string, fn: () => Promise<void>) {
      await t.test(name, async () => {
        await fn();
        passed.push(name);
      });
    }
    await check(
      "dry-run is read-only; import is exact, idempotent and creates no historical notifications",
      async () => {
        assert.equal(
          (
            await client.query(
              "SELECT count(*) n FROM pg_tables WHERE schemaname='public'",
            )
          ).rows[0].n,
          "0",
        );
        const dry = run("scripts/portal-migrate.ts", [
          file,
          "--policy",
          policyFile,
        ]);
        assert.equal(dry.mode, "dry-run");
        assert.equal(dry.duplicateCandidates.length, 2);
        assert.equal(
          (
            await client.query(
              "SELECT count(*) n FROM pg_tables WHERE schemaname='public'",
            )
          ).rows[0].n,
          "0",
        );
        assert.equal(
          run("scripts/portal-migrate.ts", [
            file,
            "--apply",
            "--policy",
            policyFile,
          ]).importedLeads,
          3,
        );
        const first = await hashes(client);
        const repeated = run("scripts/portal-migrate.ts", [
          file,
          "--apply",
          "--policy",
          policyFile,
        ]);
        assert.equal(repeated.importedLeads, 0);
        assert.equal(repeated.skippedLeads, 3);
        assert.deepEqual(await hashes(client), first);
        for (const lead of fixtures) {
          const importedProfile = (
              await client.query(
                "SELECT profile FROM portal_leads WHERE id=$1",
                [lead.id],
              )
            ).rows[0].profile;
          const {businessNumber,...originalFields}=importedProfile;
          assert.match(businessNumber,/^\d{8}-\d{3,}$/);
          assert.deepEqual(originalFields,lead);
          const messages = (
            await client.query(
              "SELECT request_id,content,error,created_at::text stamp FROM messages WHERE conversation_id=$1 ORDER BY sequence",
              ["legacy-" + lead.id],
            )
          ).rows;
          assert.deepEqual(
            messages.map((m) => Number(m.request_id)),
            lead.chatTranscript.map((_, i) => i),
          );
          assert.deepEqual(
            messages.map((m) => m.content),
            lead.chatTranscript.map((m) => m.content ?? m.text ?? ""),
          );
          for (const [i, m] of messages.entries()) {
            const metadata = JSON.parse(m.error);
            assert.equal(metadata.index, i);
            assert.equal(metadata.originalId, lead.chatTranscript[i].id);
            if (!metadata.timestampKnown)
              assert.equal(
                new Date(m.stamp).toISOString(),
                "1970-01-01T00:00:00.000Z",
              );
          }
        }
        const tasks = (
          await client.query("SELECT lead_id,status,due_at FROM followup_tasks")
        ).rows;
        assert.equal(tasks.length, 2);
        assert.ok(tasks.every((x) => x.status === "migration_hold"));
        for (const task of tasks)
          assert.equal(
            task.due_at.toISOString(),
            new Date(
              fixtures.find((l) => l.id === task.lead_id)!.slaDueTime!,
            ).toISOString(),
          );
        const sla = (
          await client.query("SELECT value FROM portal_settings WHERE id='sla'")
        ).rows[0].value;
        assert.equal(sla.hotHours, 1.5);
        assert.equal(sla.warmHours, 48);
        assert.equal(sla.coldHours, 36);
        for (const table of [
          "outbox",
          "notification_jobs",
          "notification_inbox",
        ])
          assert.equal(
            (await client.query(`SELECT count(*) n FROM ${table}`)).rows[0].n,
            "0",
          );
        execFileSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            `const {tick}=await import('./server/portal/worker.ts');const {pool}=await import('./server/portal/store.ts');await tick();await pool.end();`,
          ],
          {
            cwd: root,
            env: {
              PATH: process.env.PATH,
              DATABASE_URL: sourceUrl.toString(),
              PLATFORM_MODE: "mock",
            },
          },
        );
        assert.equal(
          (await client.query("SELECT count(*) n FROM outbox")).rows[0].n,
          "0",
        );
        baseline = await hashes(client);
      },
    );
    await check(
      "bad deadlines, duplicate IDs and conflicting source imports fail without partial business writes",
      async () => {
        for (const [suffix, rows] of [
          [
            "deadline",
            [...fixtures, { id: "bad-date", slaDueTime: "invalid" }],
          ],
          ["duplicate", [...fixtures, fixtures[0]]],
          ["conflict", [{ ...fixtures[0], fullName: "CHANGED SOURCE" }]],
        ] as const) {
          const bad = path.join(dir, suffix + ".json");
          await fs.writeFile(bad, JSON.stringify(rows));
          assert.throws(() =>
            run("scripts/portal-migrate.ts", [bad, "--apply"]),
          );
          assert.deepEqual(await hashes(client), baseline);
        }
      },
    );
    await check(
      "snapshot covers every portal table, HSK attempts and microseconds; backup itself does not mutate source",
      async () => {
        await client.query(
          "INSERT INTO visitor_sessions VALUES('new-visitor','legacy-test-a','2030-01-01')",
        );
        await client.query(
          "INSERT INTO conversations(id,visitor_id,lead_id,source,updated_at) VALUES('new-conv','new-visitor','legacy-test-a','standalone_chat','2026-10-12T01:02:03.123456Z')",
        );
        await client.query(
          "INSERT INTO messages(id,conversation_id,request_id,role,content,status,model,created_at) VALUES('new-user','new-conv','new-request','user','TEST post-cutover write','saved',NULL,'2026-10-12T01:02:03.123456Z'),('new-answer','new-conv','new-request','assistant','TEST persisted reply','completed','deepseek-chat','2026-10-12T01:02:04.654321Z')",
        );
        await client.query(
          "INSERT INTO ai_attempts(message_id,model,content) VALUES('new-answer','deepseek-chat','TEST persisted reply')",
        );
        await client.query(
          "INSERT INTO hsk_attempts VALUES('new-assessment','new-visitor','legacy-test-a','test-hash',$1,$2,'2026-10-12T01:02:05.999999Z')",
          [
            { attemptId: "new-assessment", answers: { test: "test" } },
            { testFixture: true, score: 0 },
          ],
        );
        await client.query(
          "INSERT INTO outbox(id,type,lead_id,payload,processed_at) VALUES('test-event','conversation.updated','legacy-test-a','{}',now())",
        );
        await client.query(
          "INSERT INTO notification_rules(id,version,config,enabled,effective_at) VALUES('test-rule',1,'{}',false,'2026-10-12T01:02:03.123456Z')",
        );
        await client.query(
          "INSERT INTO rule_versions VALUES('test-rule',1,'{}')",
        );
        await client.query(
          'INSERT INTO notification_channels VALUES(\'test-channel\',\'{"mode":"simulation","secretRef":"PLACEHOLDER_ONLY"}\')',
        );
        await client.query(
          "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,snapshot,completed_at) VALUES('test-job','test-event','test-rule',1,'inapp','test-admin','accepted',now(),'{}','2026-10-12T01:02:03.123456Z')",
        );
        await client.query(
          "INSERT INTO notification_inbox VALUES('test-job','test-admin','{\"name\":\"TEST customer\"}',NULL)",
        );
        await client.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES('test-admin','test.action','{}')",
        );
        await client.query(
          "INSERT INTO identity_candidates VALUES('new-visitor','legacy-test-a','legacy-test-b')",
        );
        await client.query(
          "INSERT INTO lead_read_marks VALUES('test-admin','legacy-test-a','2026-10-12T01:02:03.123456Z')",
        );
        await client.query(
          "UPDATE portal_leads SET profile=jsonb_set(jsonb_set(profile,'{nextAction}','\"TEST post-cutover follow-up\"'),'{followUpLogs}',coalesce(profile->'followUpLogs','[]'::jsonb)||$1::jsonb) WHERE id='legacy-test-a'",
          [
            JSON.stringify([
              {
                id: "new-followup",
                summary: "TEST new follow-up after migration",
              },
            ]),
          ],
        );
        await client.query(
          "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES('new-task','legacy-test-a','follow_up','test-admin','2030-01-01T00:00:00Z')",
        );
        const afterWrites = await hashes(client);
        const replayImport = run("scripts/portal-migrate.ts", [
          file,
          "--apply",
          "--policy",
          policyFile,
        ]);
        assert.equal(replayImport.skippedLeads, 3);
        assert.deepEqual(await hashes(client), afterWrites);
        await client.query("SELECT setval('message_sequence',1000,true)");
        allData = await hashes(client);
        const saved = run("scripts/portal-backup.ts", ["backup", backup]);
        assert.equal(Object.keys(saved.rows).length, backupTables.length);
        assert.equal(saved.rows.hsk_attempts, 1);
        assert.deepEqual(await hashes(client), allData);
        assert.equal((await fs.stat(backup)).mode & 0o777, 0o600);
        const body = JSON.parse(await fs.readFile(backup, "utf8"));
        assert.match(
          body.data.messages.find((m: any) => m.id === "new-user").created_at,
          /123456/,
        );
      },
    );
    await check(
      "all rows, relations and new writes restore exactly; sequences safely continue",
      async () => {
        const url = await destination("restore");
        assert.equal(
          run("scripts/portal-backup.ts", ["restore", backup], url).restored,
          true,
        );
        const c = new pg.Client({ connectionString: url });
        await c.connect();
        try {
          assert.deepEqual(await hashes(c), allData);
          assert.equal(
            (await c.query("SELECT nextval('message_sequence') n")).rows[0].n,
            "1001",
          );
          for (const table of ["ai_attempts", "portal_audit"]) {
            const result = (
              await c.query(
                `SELECT nextval(pg_get_serial_sequence('${table}','id'))::bigint > (SELECT max(id) FROM ${table}) ok`,
              )
            ).rows[0];
            assert.equal(result.ok, true);
          }
          const existing = await hashes(c);
          assert.throws(() =>
            run("scripts/portal-backup.ts", ["restore", backup], url),
          );
          assert.deepEqual(await hashes(c), existing);
        } finally {
          await c.end();
        }
      },
    );
    await check(
      "damaged backup rejected; late foreign-key failure rolls back the entire import",
      async () => {
        const original = JSON.parse(await fs.readFile(backup, "utf8"));
        original.data.portal_leads[0].profile.fullName = "TAMPERED";
        const bad = path.join(dir, "tampered.json");
        await fs.writeFile(bad, JSON.stringify(original));
        const url = await destination("corrupt");
        assert.throws(() =>
          run("scripts/portal-backup.ts", ["restore", bad], url),
        );
        const c = new pg.Client({ connectionString: url });
        await c.connect();
        assert.equal(
          (
            await c.query(
              "SELECT count(*) n FROM pg_tables WHERE schemaname='public'",
            )
          ).rows[0].n,
          "0",
        );
        await c.end();
        const broken = JSON.parse(await fs.readFile(backup, "utf8"));
        broken.data.identity_candidates[0].candidate_id = "missing-parent";
        const { sha256, ...payload } = broken;
        broken.sha256 = crypto
          .createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex");
        const late = path.join(dir, "late-failure.json");
        await fs.writeFile(late, JSON.stringify(broken));
        const empty = await destination("atomic");
        assert.throws(() =>
          run("scripts/portal-backup.ts", ["restore", late], empty),
        );
        const restored = new pg.Client({ connectionString: empty });
        await restored.connect();
        for (const table of backupTables)
          assert.equal(
            (await restored.query(`SELECT count(*) n FROM ${table}`)).rows[0].n,
            "0",
          );
        await restored.end();
      },
    );
    await check(
      "database-compatible rollback keeps post-cutover records and accepts new writes",
      async () => {
        const url = await destination("rollback");
        run("scripts/portal-backup.ts", ["restore", backup], url);
        const script = path.join(dir, "rollback.mjs");
        await fs.writeFile(
          script,
          `import assert from 'node:assert/strict';import express from '${root}/node_modules/express/index.js';
const {mountPortal}=await import('${compatibility}/server/portal/runtime.ts');const {mountChat}=await import('${compatibility}/server/portal/chat.ts');const {pool}=await import('${compatibility}/server/portal/store.ts');
const app=express();app.use(express.json());await mountPortal(app);mountChat(app);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base='http://127.0.0.1:'+server.address().port;
const native=globalThis.fetch;globalThis.fetch=async(u,o)=>String(u).includes('mock.invalid')?Response.json({choices:[{message:{content:'TEST compatible rollback reply'},finish_reason:'stop'}]}):native(u,o);
try{const headers={'Content-Type':'application/json',cookie:'uper_visitor=new-visitor'};const history=await (await fetch(base+'/api/portal/conversations/new-conv',{headers})).json();assert.equal(history.messages.length,2);assert.equal(history.messages[1].content,'TEST persisted reply');
const replay=await (await fetch(base+'/api/chat',{method:'POST',headers,body:JSON.stringify({conversationId:'new-conv',messageId:'new-request',content:'TEST post-cutover write'})})).json();assert.equal(replay.modelUsed,'deepseek-chat');
const next=await (await fetch(base+'/api/chat',{method:'POST',headers,body:JSON.stringify({conversationId:'new-conv',messageId:'rollback-write',content:'TEST new write after compatible rollback'})})).json();assert.equal(next.status,'completed');assert.equal(next.reply,'TEST compatible rollback reply');
assert.equal((await pool.query('SELECT count(*) n FROM hsk_attempts')).rows[0].n,'1');assert.equal((await pool.query('SELECT count(*) n FROM messages WHERE request_id=$1',['new-request'])).rows[0].n,'2');console.log(JSON.stringify({compatibleCommit:'51d4a78',newWritesPreserved:true,rollbackWriteAccepted:true,hskAttemptsRetained:1}));
}finally{globalThis.fetch=native;server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}`,
        );
        const result = JSON.parse(
          execFileSync(process.execPath, ["--import", "tsx", script], {
            cwd: root,
            env: {
              PATH: process.env.PATH,
              DATABASE_URL: url,
              PLATFORM_MODE: "mock",
              OPENAI_API_KEY: "test",
              OPENAI_API_BASE_URL: "https://mock.invalid/rollback",
            },
            encoding: "utf8",
          }),
        );
        assert.equal(result.rollbackWriteAccepted, true);
        const c = new pg.Client({ connectionString: url });
        await c.connect();
        assert.equal(
          (
            await c.query(
              "SELECT count(*) n FROM messages WHERE conversation_id='new-conv'",
            )
          ).rows[0].n,
          "4",
        );
        assert.equal(
          (
            await c.query(
              "SELECT count(*) n FROM messages WHERE status='legacy'",
            )
          ).rows[0].n,
          "14",
        );
        await c.end();
      },
    );
    await check(
      "restored in-flight attempts become interrupted or unknown without replaying accepted notifications",
      async () => {
        const url = await destination("leases");
        run("scripts/portal-backup.ts", ["restore", backup], url);
        const c = new pg.Client({ connectionString: url });
        await c.connect();
        await c.query(
          "INSERT INTO messages(id,conversation_id,request_id,role,content,status) VALUES('flight-user','new-conv','flight-request','user','TEST acknowledged before restart','saved'),('flight-assistant','new-conv','flight-request','assistant','','generating')",
        );
        await c.query(
          "INSERT INTO notification_jobs(id,event_id,rule_id,version,channel,recipient,state,due_at,lease_until,snapshot) VALUES('flight-lark','test-event','test-rule',1,'lark','test-channel','sending',now(),now()-interval '2 minutes','{}')",
        );
        execFileSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            "const {tick}=await import('./server/portal/worker.ts');const {pool}=await import('./server/portal/store.ts');globalThis.fetch=async()=>{throw Error('Unexpected external send during recovery')};await tick();await tick();await pool.end();",
          ],
          {
            cwd: root,
            env: {
              PATH: process.env.PATH,
              DATABASE_URL: url,
              PLATFORM_MODE: "mock",
            },
          },
        );
        assert.equal(
          (
            await c.query(
              "SELECT status FROM messages WHERE id='flight-assistant'",
            )
          ).rows[0].status,
          "interrupted",
        );
        assert.equal(
          (await c.query("SELECT status FROM messages WHERE id='flight-user'"))
            .rows[0].status,
          "saved",
        );
        assert.equal(
          (
            await c.query(
              "SELECT state FROM notification_jobs WHERE id='flight-lark'",
            )
          ).rows[0].state,
          "unknown",
        );
        assert.equal(
          (await c.query("SELECT count(*) n FROM notification_inbox")).rows[0]
            .n,
          "1",
        );
        await c.end();
      },
    );
    await check(
      "old 16-table databases and v1 snapshots restore with explicit missing-HSK coverage",
      async () => {
        const url = await destination("legacy_schema");
        execFileSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            "const {initialize,pool}=await import('./server/portal/store.ts');await initialize();await pool.query(\"INSERT INTO portal_leads(id,profile) VALUES('old-schema-test','{\\\"fullName\\\":\\\"TEST Old Schema\\\"}')\");await pool.end();",
          ],
          {
            cwd: compatibility,
            env: { PATH: process.env.PATH, DATABASE_URL: url },
          },
        );
        const oldBackup = path.join(dir, "old-schema-v2.json");
        const r = run("scripts/portal-backup.ts", ["backup", oldBackup], url);
        assert.equal(r.rows.hsk_attempts, 0);
        const v2 = JSON.parse(await fs.readFile(oldBackup, "utf8"));
        assert.equal(v2.sourceTables.length, 16);
        const restored = await destination("old_schema_restore");
        assert.equal(
          run("scripts/portal-backup.ts", ["restore", oldBackup], restored)
            .restored,
          true,
        );
        const oldData = { ...v2.data };
        delete oldData.hsk_attempts;
        const v1 = path.join(dir, "old-schema-v1.json");
        await fs.writeFile(
          v1,
          JSON.stringify({
            version: 1,
            data: oldData,
            sha256: crypto
              .createHash("sha256")
              .update(JSON.stringify(oldData))
              .digest("hex"),
          }),
        );
        const oldRestore = await destination("v1_restore");
        assert.equal(
          run("scripts/portal-backup.ts", ["restore", v1], oldRestore)
            .legacyHskCoverage,
          "not present in original backup",
        );
      },
    );
    await check(
      "unknown source tables stop backup instead of silently omitting data",
      async () => {
        const url = await destination("unknown_table");
        const c = new pg.Client({ connectionString: url });
        await c.connect();
        await c.query("CREATE TABLE unexpected_records(id text)");
        await c.end();
        assert.throws(() =>
          run(
            "scripts/portal-backup.ts",
            ["backup", path.join(dir, "unknown.json")],
            url,
          ),
        );
      },
    );
    await fs.writeFile(
      path.join(dir, "result.json"),
      JSON.stringify({
        passed: passed.length === 9,
        passedCases: passed,
        sourceDatabase: sourceUrl.pathname.slice(1),
        destinationDatabases: names,
        sourceHash: baseline,
        postCutoverHash: allData,
        tables: backupTables,
        backupFile: backup,
      }),
      { mode: 0o600 },
    );
    console.log("BACKUP_DRILL_REPORT=" + path.join(dir, "result.json"));
  });
}
