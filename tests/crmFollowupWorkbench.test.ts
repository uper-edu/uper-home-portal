import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  followupHistory,
  historyTouchesTask,
  followupHistorySource,
} from "../src/utils/crmFollowupHistory.ts";
import { CrmFollowupContext, CrmContactRestriction } from "../src/components/crm/CrmFollowupContext.tsx";
import { CrmFollowupHistory } from "../src/components/crm/CrmFollowupHistory.tsx";
import { CrmTaskCard } from "../src/components/crm/CrmTaskCard.tsx";
test("History joins the exact saved log ID only; same text in different sessions and unknown dates survive", () => {
  const facts = [
    {
      id: "f",
      kind: "followup.recorded",
      created_at: "2026-10-17T09:00:00Z",
      data: {
        summary: "same",
        result: { logId: "one", completedTaskIds: ["task-a"] },
      },
    },
  ];
  const journey = [
    {
      id: "log-one",
      category: "follow_up",
      timestamp: "2026-10-17T09:00:00Z",
      content: "same",
    },
    {
      id: "log-two",
      category: "follow_up",
      timestamp: "2026-10-17T09:00:00Z",
      content: "same",
    },
    { id: "message-a", timestamp: "unknown", content: "same" },
    { id: "message-b", timestamp: "unknown", content: "same" },
  ];
  const before = JSON.stringify({ facts, journey });
  const rows = followupHistory(facts, journey);
  assert.equal(rows.length, 4);
  assert.ok(!rows.some((r) => r.id === "journey-log-one"));
  assert.ok(rows.some((r) => r.id === "journey-log-two"));
  assert.equal(
    rows.slice(-2).every((r) => r.at === "unknown"),
    true,
  );
  assert.equal(JSON.stringify({ facts, journey }), before);
  assert.equal(
    historyTouchesTask(
      rows.find((r) => r.id === "fact-f"),
      "task-a",
    ),
    true,
  );
  assert.equal(
    historyTouchesTask(
      rows.find((r) => r.id === "fact-f"),
      "task-b",
    ),
    false,
  );
});
test("Latest effective communication and newer failed attempt stay distinct; unknown-time messages remain behind the original-source link", () => {
  const lead = {
    contactArrangement: {
      state: "waiting",
      reason: "Customer asks to wait",
      reviewAt: "2026-10-20T09:00:00Z",
    },
    followUpLogs: [
      {
        id: "connected",
        connectStatus: "Connected",
        channel: "WhatsApp",
        staffName: "Fadhil",
        timestamp: "2026-10-16T09:00:00Z",
        summary: "Original summary 原文",
        sourceMessageId: "same-id",
        sourceConversationId: "session-b",
      },
      {
        id: "attempt",
        connectStatus: "No Response",
        channel: "Call",
        staffName: "Fadhil",
        timestamp: "2026-10-17T09:00:00Z",
        summary: "No answer",
      },
      {
        id: "closure",
        recordKind: "closure",
        connectStatus: "Connected",
        timestamp: "2026-10-18T09:00:00Z",
        summary: "Must not become a contact",
      },
    ],
    chatTranscript: [
      {
        id: "same-id",
        conversation_id: "session-a",
        role: "user",
        content: "Wrong session",
      },
      {
        id: "same-id",
        conversation_id: "session-b",
        role: "user",
        content: "Correct original",
      },
    ],
  };
  for (const lang of ["en", "id", "zh"]) {
    const html = renderToStaticMarkup(
      React.createElement(React.Fragment, null, React.createElement(CrmContactRestriction,{lead,lang,timezone:"Asia/Jakarta"}), React.createElement(CrmFollowupContext, {
        lead,
        lang,
        timezone: "Asia/Jakarta",
        onSource: () => {},
      })),
    );
    assert.match(html, /Original summary 原文/);
    assert.match(html, /No answer/);
    assert.match(
      html,
      /View linked message|Lihat pesan terkait|查看关联原文/,
    );
    assert.doesNotMatch(html, /Correct original/);
    assert.doesNotMatch(html, /Wrong session|Must not become a contact/);
    assert.ok(
      html.indexOf("Customer asks to wait") <
        html.indexOf("Original summary 原文"),
    );
  }
});
test("Compact task keeps revised time and original deadline visible; raw request is secondary; read-only has no processing action", () => {
  const task = {
    id: "a",
    kind: "booking",
    status: "open",
    owner_id: "Fadhil",
    due_at: "2026-10-17T09:00:00Z",
    scheduled_at: "2026-10-20T09:00:00Z",
    timing_kind: "response",
    details: { action: "Confirm weekend", purpose: "Original purpose" },
  };
  for (const lang of ["en", "id", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrmTaskCard, {
        task,
        lead: { owner: "Fadhil" },
        lang,
        timezone: "Asia/Jakarta",
        compact: true,
        onSource: () => {},
        onProcess: () => {},
        sourceQuote: "Exact 原文",
      }),
    );
    assert.match(html, /2026-10-17 16:00/);
    assert.match(html, /2026-10-20 16:00/);
    assert.doesNotMatch(html, /Exact 原文/);
    assert.match(
      html,
      /View customer request|Lihat permintaan pelanggan|查看客户原话/,
    );
    assert.equal((html.match(/<details/g) || []).length, 0);
    assert.doesNotMatch(html, /crm-task-completion-guidance/);
    assert.doesNotMatch(html, /crm-task-evidence/);
    assert.match(html, /crm-task-process/);
    const read = renderToStaticMarkup(
      React.createElement(CrmTaskCard, {
        task,
        lead: {},
        lang,
        timezone: "Asia/Jakarta",
        compact: true,
        readOnly: true,
        onProcess: () => {},
      }),
    );
    assert.doesNotMatch(read, /crm-task-process/);
  }
});
test("Unified history renders one contact record, literal notes, completed task action and retained arrangement in three languages", () => {
  const facts = [
    {
      id: "f",
      kind: "followup.recorded",
      actor: "Fadhil",
      created_at: "2026-10-17T09:00:00Z",
      data: {
        summary: "Original <note>",
        channel: "WhatsApp",
        connectStatus: "Connected",
        disposition: "keep",
        result: { logId: "one", completedTaskIds: ["a"] },
      },
    },
  ];
  for (const lang of ["en", "id", "zh"]) {
    const html = renderToStaticMarkup(
      React.createElement(CrmFollowupHistory, {
        facts,
        journey: [
          { id: "log-one", category: "follow_up", content: "duplicate" },
        ],
        tasks: [
          {
            id: "a",
            kind: "booking",
            status: "completed",
            details: { action: "Confirmed action" },
          },
        ],
        lang,
        timezone: "Asia/Jakarta",
        onClearTask: () => {},
        kindLabel: (s: string) => s,
      }),
    );
    assert.equal((html.match(/data-history-id=/g) || []).length, 1);
    assert.match(html, /Original &lt;note&gt;/);
    assert.match(html, /16:00:00/);
    assert.match(html, /data-source="sales"/);
    assert.match(html, /Confirmed action/);
    assert.doesNotMatch(html, /duplicate/);
  }
});

test("Timeline source uses recorded authorship; missing sources never impersonate customer or sales", () => {
  assert.equal(followupHistorySource({fact:{actor:"visitor",kind:"task.request_evidence"}}), "customer");
  assert.equal(followupHistorySource({fact:{actor:"Fadhil",kind:"stage.changed"}}), "sales");
  assert.equal(followupHistorySource({fact:{actor:"system"}}), "system");
  assert.equal(followupHistorySource({fact:{actor:null}}), "unknown");
  assert.equal(followupHistorySource({event:{actorType:"client",id:"chat-message"}}), "customer");
  assert.equal(followupHistorySource({event:{actorType:"consultant"}}), "sales");
  assert.equal(followupHistorySource({event:{actorType:"record"}}), "unknown");
  assert.equal(followupHistorySource({event:{actorType:"client",id:"signal-old"}}), "unknown");
});

test('overview task references are localized, deduplicated, and never label the customer message handled',()=>{
  const message={id:'message',conversation_id:'conversation',role:'user',timestamp:'2026-10-17T03:00:00Z',content:'Original 客户文字'};
  const lead={chatTranscript:[message]};
  const tasks=[{id:'task',kind:'booking',status:'completed',due_at:'2026-10-18T03:00:00Z',details:{action:'Original 任务',sourceMessageId:'message',sourceConversationId:'conversation'}}];
  for(const lang of ['en','id','zh']) {
    const render=(extra={})=>renderToStaticMarkup(React.createElement(CrmFollowupContext,{lead,lang,timezone:'Asia/Jakarta',tasks,onTask(){},...extra}));
    const html=render();assert.match(html,/Original 客户文字/);assert.match(html,/Original 任务/);
    assert.equal((html.match(/class="crm-work-link crm-message-task-link"/g)||[]).length,1);
    assert.ok(html.includes(lang==='zh'?'已完成':lang==='id'?'Selesai':'Completed'));
    assert.doesNotMatch(render({tasks:[]}),/Original 任务/);
    assert.doesNotMatch(render({tasks:[]}),/未记录任务关联|Belum ada tautan tugas tercatat|No task link recorded/);
    assert.ok(render({taskError:'error'}).includes(lang==='zh'?'任务关联暂不可用':lang==='id'?'Tautan tugas tidak tersedia':'Task links unavailable'));
  }
});

test('compact task rows retain an overdue original deadline and one consistent trilingual result action',()=>{
 for(const [lang,action]of [['zh','添加进展'],['id','Tambah progres'],['en','Add progress']] as const){
 const html=renderToStaticMarkup(React.createElement(CrmTaskCard,{task:{id:'row-overdue',kind:'follow_up',status:'overdue',timing_kind:'response',due_at:'2026-01-01T02:00:00Z',scheduled_at:'2099-09-02T04:00:00Z',details:{action:'TEST requested schedule'}},lead:{},lang,timezone:'Asia/Jakarta',compact:true,onProcess:()=>{}}));
 assert.match(html,/2026-01-01 09:00/);assert.match(html,/2099-09-02 11:00/);
 assert.match(html,/data-secondary="true"/);assert.match(html,/data-tone="overdue"/);
 assert.ok(html.includes(action));assert.doesNotMatch(html,/crm-task-completion-guidance/);
 }
});
