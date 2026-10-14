import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactStatistics,
  needsHandling,
  greeting,
} from "../src/utils/crmContact.ts";
import { defaultLeadFilters } from "../src/utils/crmLeadFilters.ts";
import { validateWorkflow } from "../server/portal/salesWorkflow.ts";
test("contact evidence separates attempts from responses and excludes unknown times and admin records", () => {
  const lead = {
    followUpLogs: [
      {
        id: "connected",
        timestamp: "2026-10-01T10:00Z",
        connectStatus: "Connected",
        summary: "原文",
      },
      {
        id: "retry",
        timestamp: "2026-10-02T10:00Z",
        connectStatus: "No Response",
      },
      { timestamp: "1970-01-01T00:00Z", connectStatus: "Connected" },
      {
        timestamp: "2026-10-03T10:00Z",
        recordKind: "closure",
        connectStatus: "Connected",
      },
      { timestamp: "2026-10-04T10:00Z", connectStatus: "Interested" },
    ],
  };
  const stats = contactStatistics(lead);
  assert.equal(stats.attemptCount, 2);
  assert.equal(stats.connectedCount, 1);
  assert.equal(stats.lastConnected.id, "connected");
  assert.equal(stats.lastAttempt.id, "retry");
  assert.equal(stats.lastConnected.summary, "原文");
});
test("work queue includes internal review without waking future ordinary contact", () => {
  const now = Date.parse("2026-10-14T10:00Z");
  const day = (n: number) => new Date(n).toISOString().slice(0, 10);
  const lead: any = {
    lastContactedAt: "2026-10-10",
    currentStage: "Contacted",
    attention: {
      tasks: [
        { kind: "follow_up", status: "open", dueAt: "2026-10-16T10:00Z" },
      ],
    },
  };
  assert.equal(needsHandling(lead, now, day), false);
  lead.contactArrangement = { state: "waiting", at: "2026-10-13" };
  assert.equal(needsHandling(lead, now, day), true);
  lead.attention.tasks = [
    { kind: "contact_review", status: "open", dueAt: "2026-10-16T10:00Z" },
  ];
  assert.equal(needsHandling(lead, now, day), false);
  lead.attention.tasks[0].dueAt = "2026-10-14T09:00Z";
  assert.equal(needsHandling(lead, now, day), true);
  assert.equal(needsHandling({}, now, day), true);
  assert.equal(defaultLeadFilters("own").workScope, "action");
  assert.equal(defaultLeadFilters("all").workScope, "all");
});
test("language unknown cannot produce an interface-driven greeting and ambiguous contact is rejected", () => {
  assert.equal(greeting("unknown", "原名", "Robert"), "");
  assert.match(greeting("id", "原名", "Robert"), /Halo 原名/);
  assert.throws(
    () =>
      validateWorkflow({
        requestId: "a",
        summary: "note",
        completeTaskIds: [],
        channel: "WhatsApp",
        connectStatus: "",
        disposition: "keep",
      }),
    /contact result/,
  );
  assert.throws(
    () =>
      validateWorkflow({
        requestId: "a",
        summary: "note",
        recordKind: "closure",
        completeTaskIds: [],
        disposition: "none",
        noNextReason: "old",
      }),
    /contact arrangement/,
  );
});
if(process.env.CRM_EFFICIENCY_TEST_DATABASE_URL){
 test('PostgreSQL: stopped/nurture/recovery, foreign task rejection and transaction rollback',async()=>{
 const {default:pg}=await import('pg');const {saveSalesWorkflow}=await import('../server/portal/salesWorkflow.ts');
 const url=new URL(process.env.CRM_EFFICIENCY_TEST_DATABASE_URL!);assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname.includes('efficiency_workflow_test'));
 const db=new pg.Client({connectionString:url.href});await db.connect();await db.query('BEGIN');
 try{const id='test-rollback-'+Date.now();await db.query('INSERT INTO portal_leads(id,profile) VALUES($1,$2)',[id,{id,owner:'Fadhil',tier:'Hot',currentStage:'Contacted',quizScore:8,followUpLogs:[]}]);const task=id+'-task';await db.query("INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at) VALUES($1,$2,'follow_up','Fadhil','2030-01-01')",[task,id]);const due=(await db.query('SELECT due_at FROM followup_tasks WHERE id=$1',[task])).rows[0].due_at;
 const body:any={requestId:'stop',recordKind:'closure',summary:'TEST stop',completeTaskIds:[],disposition:'none',contactArrangement:{state:'stopped',reason:'TEST customer request',version:0}};
 const stop=await saveSalesWorkflow(db,id,'Fadhil',body,()=>true);assert.equal(stop.lead.contactArrangement.state,'stopped');assert.equal(stop.lead.touchCount,0);assert.equal(stop.lead.tier,'Hot');assert.equal(stop.lead.quizScore,8);
 const recover=await saveSalesWorkflow(db,id,'Fadhil',{...body,requestId:'recover',disposition:'keep',contactArrangement:{state:'active',reason:'TEST owner review',version:1}},()=>true);assert.equal(recover.lead.contactArrangement.state,'active');assert.deepEqual((await db.query('SELECT due_at FROM followup_tasks WHERE id=$1',[task])).rows[0].due_at,due);
 await db.query('SAVEPOINT denied');await assert.rejects(saveSalesWorkflow(db,id,'Wigar',{...body,requestId:'deny'},()=>false),/not found/);await db.query('ROLLBACK TO denied');
 await db.query('SAVEPOINT foreign_task');await assert.rejects(saveSalesWorkflow(db,id,'Fadhil',{...body,requestId:'foreign',contactArrangement:{state:'stopped',reason:'TEST foreign task',version:2},completeTaskIds:['other-lead-task']},()=>true),/changed|reason/);await db.query('ROLLBACK TO foreign_task');
 await db.query('SAVEPOINT fail');await db.query("CREATE TEMP TABLE efficiency_failure(flag int CHECK(flag=1))");await assert.rejects((async()=>{await saveSalesWorkflow(db,id,'Fadhil',{requestId:'rollback',recordKind:'closure',summary:'TEST administrative completion',completeTaskIds:[task],disposition:'none',contactArrangement:{state:'nurture',reason:'TEST pause',reviewAt:'2030-03-01T09:00Z',version:2}},()=>true);await db.query('INSERT INTO efficiency_failure VALUES(2)');})());await db.query('ROLLBACK TO fail');assert.equal((await db.query('SELECT status FROM followup_tasks WHERE id=$1',[task])).rows[0].status,'open');assert.equal((await db.query('SELECT profile FROM portal_leads WHERE id=$1',[id])).rows[0].profile.contactArrangement.state,'active');
 }finally{await db.query('ROLLBACK');await db.end();}
 });
}

test('staff page-memory drafts survive same-account remount and are isolated and removed at sign out',async()=>{
 const {draftsFor,clearStaffDrafts}=await import('../src/utils/crmDrafts.ts');
 const first=draftsFor('TEST-sales-a');first.customer={summary:'private staff draft',requestId:'retry-key'};
 assert.equal(draftsFor('TEST-sales-a').customer.requestId,'retry-key');assert.equal(draftsFor('TEST-sales-b').customer,undefined);
 clearStaffDrafts('TEST-sales-a');assert.equal(draftsFor('TEST-sales-a').customer,undefined);clearStaffDrafts('TEST-sales-b');
});
