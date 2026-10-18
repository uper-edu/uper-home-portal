import { test } from "node:test";
import assert from "node:assert/strict";
import {
  followupOverview,
  followupHistoryDay,
} from "../src/utils/crmFollowupOverview.ts";
const contact = {
  id: "log",
  timestamp: "2026-10-17T03:00:00Z",
  connectStatus: "Connected",
  summary: "original 人工原文",
};
test("communication overview uses reliable customer messages without changing facts", () => {
  const lead = {
    followUpLogs: [
      contact,
      {
        id: "attempt",
        timestamp: "2026-10-17T04:00:00Z",
        connectStatus: "No Response",
      },
    ],
    chatTranscript: [
      {
        id: "old",
        role: "user",
        created_at: "2026-10-17T01:00:00Z",
        content: "old",
      },
      {
        id: "new",
        role: "user",
        created_at: "2026-10-17T05:00:00Z",
        content: "原文",
      },
      {
        id: "assistant",
        role: "assistant",
        created_at: "2026-10-17T06:00:00Z",
        content: "AI",
      },
      {
        id: "unknown",
        role: "user",
        timestampKnown: false,
        created_at: "2026-10-18T00:00:00Z",
      },
    ],
  };
  const before = JSON.stringify(lead),
    view = followupOverview(lead);
  assert.equal(view.message.id, "new");
  assert.equal(view.newer, true);
  assert.equal(view.lastAttempt.id, "attempt");
  assert.equal(view.lastConnected.id, "log");
  assert.equal(JSON.stringify(lead), before);
});
test("old or unknown-time messages never become a new inquiry", () => {
  assert.equal(
    followupOverview({
      followUpLogs: [contact],
      chatTranscript: [{ role: "user", created_at: "2026-10-17T02:00:00Z" }],
    }).message,
    null,
  );
  assert.equal(
    followupOverview({
      followUpLogs: [],
      chatTranscript: [
        { role: "user", status: "legacy", created_at: "2026-10-18T02:00:00Z" },
      ],
    }).message,
    undefined,
  );
  const first = followupOverview({
    chatTranscript: [
      { role: "user", timestamp: "2026-10-17T02:00:00Z", content: "original" },
    ],
  });
  assert.equal(first.newer, false);
  assert.equal(first.message.content, "original");
});
test("timeline date follows the operational timezone and keeps unknown time unknown", () => {
  assert.equal(
    followupHistoryDay("2026-10-17T18:00:00Z", "Asia/Jakarta"),
    "2026-10-18",
  );
  assert.equal(
    followupHistoryDay("2026-10-17T18:00:00Z", "America/Vancouver"),
    "2026-10-17",
  );
  assert.equal(followupHistoryDay("invalid", "Asia/Jakarta"), "");
  assert.equal(followupHistoryDay(undefined, "Asia/Jakarta"), "");
});

test('message task links use saved IDs, retain current states and never infer from text or completed contact', async()=>{
  const {messageTaskLinks}=await import('../src/utils/crmFollowupOverview.ts');
  const message={id:'m',request_id:'req',conversation_id:'c',content:'same text'};
  const tasks=[{id:'original',status:'completed',details:{sourceConversationId:'c',sourceMessageId:'m'}},{id:'supplement',status:'open'},{id:'wrong',status:'open',details:{sourceConversationId:'other',sourceMessageId:'m'}}];
  const receipts=[{id:'receipt',conversation_id:'c',request_id:'req',metadata:{followupAction:'booking',taskId:'supplement'}},{conversation_id:'other',request_id:'req',metadata:{followupAction:'booking',taskId:'wrong'}}];
  const facts=[{kind:'task.request_evidence',data:{conversationId:'c',messageId:'req',taskId:'supplement'}},{kind:'followup.recorded',data:{sourceConversationId:'c',sourceMessageId:'m',processingTaskId:'original'}}];
  const original=JSON.stringify({tasks,receipts,facts});
  assert.deepEqual(messageTaskLinks(message,receipts,tasks,facts).map(v=>[v.id,v.task.status]),[['original','completed'],['supplement','open']]);
  assert.deepEqual(messageTaskLinks({...message,id:'different',request_id:'different'},receipts,tasks,facts),[]);
  assert.deepEqual(messageTaskLinks({...message,conversation_id:undefined},receipts,tasks,facts),[]);
  assert.deepEqual(messageTaskLinks(message,receipts,[],facts).map(v=>v.task),[undefined,undefined]);
  assert.equal(JSON.stringify({tasks,receipts,facts}),original);
});
