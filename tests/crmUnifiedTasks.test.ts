import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { presentFollowUpTask, projectPendingTasks } from "../src/utils/crmTaskPresentation.ts";
import { CrmTaskCard } from "../src/components/crm/CrmTaskCard.tsx";
import { CrmNextTaskSummary } from "../src/components/crm/CrmNextTaskSummary.tsx";
const now = Date.parse("2026-10-17T10:00:00Z");
const task = {
  id: "TEST-task",
  kind: "booking",
  status: "open",
  owner_id: "Fadhil",
  due_at: "2026-10-17T09:00:00Z",
  original_due_at: "2026-10-17T09:00:00Z",
  scheduled_at: "2026-10-20T02:00:00Z",
  timing_kind: "response",
  details: {
    action: "确认试听 <original>",
    purpose: "Customer original note 原文",
  },
};
test("Polling and task-list projections retain revised dates and the existing closed-customer history scope", () => {
  const hold = { ...task, id: "held", status: "migration_hold" };
  const completed = { ...task, id: "done", status: "completed" };
  const active = projectPendingTasks([task, hold, completed], "Contacted");
  assert.equal(active.length, 2);
  const projected = active.find((row) => row.id === task.id)!;
  assert.equal(projected.scheduledAt, task.scheduled_at);
  assert.equal(projected.originalDueAt, task.original_due_at);
  assert.equal(projected.timingKind, task.timing_kind);
  assert.equal(projected.dueAt, task.due_at);
  for (const stage of ["Enrolled", "Lost"])
    assert.deepEqual(projectPendingTasks([task, hold, completed], stage).map((row) => row.id), [task.id]);
});
test("Revised execution never overwrites response deadline, overdue fact, ordering or original data; camel and native projections agree", () => {
  const before = JSON.stringify(task);
  for (const lang of ["en", "id", "zh"] as const) {
    const view = presentFollowUpTask(task, lang, "Asia/Jakarta", now);
    const projected = presentFollowUpTask(
      {
        ...task,
        due_at: undefined,
        owner_id: undefined,
        original_due_at: undefined,
        scheduled_at: undefined,
        timing_kind: undefined,
        dueAt: task.due_at,
        ownerId: task.owner_id,
        originalDueAt: task.original_due_at,
        scheduledAt: task.scheduled_at,
        timingKind: task.timing_kind,
      },
      lang,
      "Asia/Jakarta",
      now,
    );
    assert.deepEqual(view.times, projected.times);
    assert.equal(view.tone, "overdue");
    assert.equal(view.deadline, Date.parse(task.due_at));
    assert.deepEqual(
      view.times.map((row) => row.value),
      [task.scheduled_at, task.due_at],
    );
    assert.equal(view.formatTime(view.times[0].value), "2026-10-20 09:00");
    assert.equal(view.formatTime(view.times[1].value), "2026-10-17 16:00");
  }
  assert.equal(JSON.stringify(task), before);
});
test("Response, agreed execution and internal review remain distinct; historical placeholders are never dates", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    const response = presentFollowUpTask(
      { ...task, scheduled_at: null },
      lang,
      "Asia/Jakarta",
      now,
    );
    const appointment = presentFollowUpTask(
      { ...task, scheduled_at: null, timing_kind: "appointment" },
      lang,
      "Asia/Jakarta",
      now,
    );
    const review = presentFollowUpTask(
      { ...task, scheduled_at: null, kind: "contact_review" },
      lang,
      "Asia/Jakarta",
      now,
    );
    assert.notEqual(response.times[0].label, appointment.times[0].label);
    assert.notEqual(review.times[0].label, response.times[0].label);
    const old = presentFollowUpTask(
      { ...task, status: "migration_hold", due_at: "1970-01-01" },
      lang,
      "Asia/Jakarta",
      now,
    );
    assert.equal(old.deadline, null);
    assert.deepEqual(
      old.times.map((row) => row.value),
      [null],
    );
    assert.equal(old.tone, "review");
    const completed = presentFollowUpTask(
      { ...task, status: "completed" },
      lang,
      "Asia/Jakarta",
      now,
    );
    assert.equal(completed.active, false);
    assert.equal(completed.tone, "complete");
    assert.ok(completed.times.every((row) => row.tone === "normal"));
  }
});
test("Canonical cards preserve original text, separate active processing from historical review, and respect read-only permissions", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    const render = (extra = {}) =>
      renderToStaticMarkup(
        React.createElement(CrmTaskCard, {
          task,
          lead: { owner: "Fadhil" },
          lang,
          timezone: "Asia/Jakarta",
          onProcess() {},
          onSource() {},
          ...extra,
        }),
      );
    const html = render();
    assert.match(html, /确认试听 &lt;original&gt;/);
    assert.match(html, /Customer original note 原文/);
    assert.equal((html.match(/class="crm-task-process"/g) || []).length, 1);
    assert.equal((html.match(/data-task-id="TEST-task"/g) || []).length, 1);
    assert.doesNotMatch(render({ readOnly: true }), /class="crm-task-process"/);
    const history = render({
      task: { ...task, status: "completed" },
      onHistory() {},
    });
    assert.doesNotMatch(history, /class="crm-task-process"/);
    assert.ok(
      history.includes(
        lang === "zh"
          ? "查看处理记录"
          : lang === "id"
            ? "Lihat riwayat penanganan"
            : "View handling history",
      ),
    );
    const summary = renderToStaticMarkup(
      React.createElement(CrmNextTaskSummary, {
        lead: {
          id: "TEST",
          owner: "Fadhil",
          nextAction: "Not a task",
          attention: {
            tasks: [{ ...task, dueAt: task.due_at, ownerId: "Fadhil" }],
          },
        } as any,
        lang,
        timezone: "Asia/Jakarta",
        onOpen() {},
      }),
    );
    assert.doesNotMatch(
      summary,
      /crm-task-process|crm-unified-task|Not a task/,
    );
    assert.equal((summary.match(/<button/g) || []).length, 1);
  }
});

test("priority summary and task list agree for every stage, including closed historic placeholders", async () => {
  const {leadFollowUp}=await import('../src/utils/crmFollowUp.ts');
  const input=[task,{...task,id:'held',status:'migration_hold'}, {...task,id:'done',status:'completed'}, {...task,id:'undated',due_at:'unknown'}];
  for(const stage of ['New','Contacted','Enrolled','Lost']) {
    const projected=projectPendingTasks(input,stage);
    const lead={currentStage:stage,attention:{tasks:input.map(t=>({...t,dueAt:t.due_at}))}} as any;
    const summary=leadFollowUp(lead,'en','Asia/Jakarta');
    assert.equal(summary.next?.task.id,projected[0]?.id);
    assert.equal(summary.additionalCount+1,projected.length);
  }
  for(const lang of ['en','id','zh'] as const) {
    const lead={currentStage:'Enrolled',attention:{tasks:[{...task,dueAt:task.due_at,status:'migration_hold'}]}} as any;
    assert.equal(leadFollowUp(lead,lang,'Asia/Jakarta').next,null);
    const html=renderToStaticMarkup(React.createElement(CrmNextTaskSummary,{lead,lang,timezone:'Asia/Jakarta',onOpen(){}}));
    assert.equal(html,'');
    assert.doesNotMatch(html,/\(1\)|确认试听/);
  }
});

test("Task wording distinguishes work, deadlines, history and unavailable data without changing task semantics", async () => {
  const { emptyFollowUpLabel } = await import('../src/utils/crmFollowUp.ts');
  const { CrmFollowUp } = await import('../src/components/crm/CrmFollowUp.tsx');
  const cases = [
    { status:'open', due_at:'2026-10-18T02:00:00Z', labels:['To do','Perlu ditindaklanjuti','待处理'], tone:'normal' },
    { status:'open', due_at:'2026-10-17T12:00:00Z', labels:['Due today','Jatuh tempo hari ini','今天到期'], tone:'today' },
    { status:'overdue', due_at:'2026-10-17T09:00:00Z', labels:['Overdue','Terlambat','已逾期'], tone:'overdue' },
    { status:'completed', due_at:'2026-10-17T09:00:00Z', labels:['Completed','Selesai','已完成'], tone:'complete' },
    { status:'cancelled', due_at:'2026-10-17T09:00:00Z', labels:['Cancelled','Dibatalkan','已取消'], tone:'normal' },
    { status:'migration_hold', due_at:'1970-01-01T00:00:00Z', labels:['Historical task: review required','Tugas lama perlu dikonfirmasi','历史待办待确认'], tone:'review' },
  ];
  for (const [index,lang] of (['en','id','zh'] as const).entries()) {
    for (const c of cases) {
      const input={...task,...c,scheduled_at:null};const before=JSON.stringify(input);
      const view=presentFollowUpTask(input,lang,'Asia/Jakarta',now);
      assert.equal(view.status,c.labels[index]);assert.equal(view.tone,c.tone);
      assert.equal(JSON.stringify(input),before);
      assert.equal(view.active,['open','overdue'].includes(c.status));
    }
    const undecided=emptyFollowUpLabel({currentStage:'New'},lang);
    const deferred=emptyFollowUpLabel({currentStage:'New',followUpDisposition:{kind:'none',reason:'original reason'}},lang);
    assert.equal(undecided,deferred);
    const closed=emptyFollowUpLabel({currentStage:'Lost'},lang);assert.equal(closed,undecided);
    const failure=renderToStaticMarkup(React.createElement(CrmFollowUp,{lead:{currentStage:'New'} as any,lang,timezone:'Asia/Jakarta',employees:[],isLight:true,onOpen(){}}));
    assert.ok(failure.includes(['Follow-up information unavailable','Informasi tindak lanjut sementara tidak tersedia','跟进信息暂不可用'][index]));
    assert.ok(failure.includes('unavailable')||lang!=='en');
  }
});
