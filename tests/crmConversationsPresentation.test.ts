import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmConversationTimeline } from "../src/components/crm/CrmConversationTimeline.tsx";
import {
  conversationGroups,
  conversationRole,
  conversationRequestOperation,
  conversationRequestSource,
  linkedConversationTasks,
  type ConversationMessage,
} from "../src/utils/crmConversations.ts";
import type { CrmLeadRecord } from "../src/types/crmLead.ts";
import { guideSections } from "../src/components/crm/CrmGuideContent.ts";

const messages: ConversationMessage[] = [
  {
    id: "customer-1",
    conversation_id: "session",
    role: "user",
    content: "原文 same message catatan <script>",
    timestamp: "2026-10-17T03:00:00Z",
  },
  {
    id: "ai",
    conversation_id: "session",
    role: "assistant",
    content: "Original AI response",
    timestamp: "2026-10-17T03:01:00Z",
  },
  {
    id: "receipt-1",
    conversation_id: "session",
    role: "assistant",
    content: "Original receipt: awaiting contact",
    timestamp: "2026-10-17T03:02:00Z",
    metadata: { followupAction: "handoff", taskId: "completed" },
  },
  {
    id: "customer-2",
    conversation_id: "session",
    role: "user",
    content: "原文 same message catatan <script>",
    timestamp: "2026-10-17T03:03:00Z",
  },
  {
    id: "receipt-2",
    conversation_id: "session",
    role: "assistant",
    content: "Original supplementary receipt",
    timestamp: "2026-10-17T03:04:00Z",
    metadata: { followupAction: "handoff", taskId: "completed" },
  },
  {
    id: "failure",
    conversation_id: "session",
    role: "assistant",
    content: "",
    timestamp: "2026-10-17T03:05:00Z",
    status: "failed",
  },
  {
    id: "interrupt",
    conversation_id: "session",
    role: "assistant",
    content: "Partial AI original",
    timestamp: "2026-10-17T03:06:00Z",
    status: "interrupted",
  },
  {
    id: "pending",
    conversation_id: "session",
    role: "assistant",
    content: "",
    timestamp: "2026-10-17T03:07:00Z",
    status: "generating",
  },
  {
    id: "unknown",
    conversation_id: "session",
    role: "system",
    content: "Original historical event",
    timestamp: "2000-01-01T00:00:00Z",
    timestampKnown: false,
  },
];
const tasks = [
  {
    id: "completed",
    kind: "handoff",
    status: "completed",
    owner_id: "Fadhil",
    due_at: "2026-10-17T04:00:00Z",
    details: { action: "Original saved task 原文" },
  },
];
const lead = {
  id: "TEST-conversation",
  fullName: "原名 Alice",
} as CrmLeadRecord;
const render = (lang: "en" | "id" | "zh", overrides = {}) =>
  renderToStaticMarkup(
    React.createElement(CrmConversationTimeline, {
      lead,
      messages,
      conversations: [{ id: "session", source: "standalone_chat" }],
      tasks,
      lang,
      timezone: "Asia/Jakarta",
      isLight: true,
      onOpenTask() {},
      ...overrides,
    }),
  );

test("Conversation projection orders sessions by reliable activity, preserves all IDs and unknown-time source positions without mutation", () => {
  const source = [
    messages[3],
    messages[8],
    messages[0],
    {
      ...messages[1],
      id: "newer",
      conversation_id: "new",
      timestamp: "2026-10-18T03:00:00Z",
    },
  ];
  const before = JSON.stringify(source);
  const grouped = conversationGroups(source, [
    { id: "session", source: "standalone_chat" },
    { id: "empty", source: "homepage" },
  ]);
  assert.equal(grouped[0].id, "new");
  assert.deepEqual(
    grouped[1].messages.map((message) => message.id),
    ["customer-1", "unknown", "customer-2"],
  );
  assert.equal(grouped.length, 2);
  assert.equal(JSON.stringify(source), before);
  assert.equal(
    conversationRole(messages[2]),
    "system",
    "Legacy assistant-role handoff receipt is a system event",
  );
  assert.equal(conversationRole(messages[1]), "assistant");
});

test("Current task summary deduplicates only explicit task IDs; distinct requests with no ID are not silently merged", () => {
  const projection = linkedConversationTasks(
    [
      ...messages,
      {
        ...messages[2],
        id: "missing-1",
        metadata: { followupAction: "handoff" },
      },
      {
        ...messages[2],
        id: "missing-2",
        metadata: { followupAction: "handoff" },
      },
    ],
    tasks,
  );
  assert.equal(projection.length, 3);
  assert.equal(projection[0].task?.status, "completed");
  assert.equal(projection[1].task, undefined);
});

test("Three-language viewer separates current task state from original receipts, preserves duplicate evidence and exposes accessible actions only when allowed", () => {
  const before = JSON.stringify({ messages, tasks, lead });
  const expected = {
    en: [
      "Advisor contact request recorded",
      "Completed",
      "Reply failed",
      "Reply interrupted",
      "Reply pending",
      "Unknown time",
    ],
    id: [
      "Permintaan kontak konsultan tercatat",
      "Selesai",
      "Balasan gagal",
      "Balasan terputus",
      "Balasan tertunda",
      "Waktu tidak diketahui",
    ],
    zh: [
      "顾问联系请求已记录",
      "已完成",
      "回复失败",
      "回复已中断",
      "等待回复",
      "未知时间",
    ],
  };
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(lang);
    for (const text of expected[lang])
      assert.ok(html.includes(text), `${lang}: ${text}`);
    assert.equal((html.match(/data-task-id="completed"/g) || []).length, 0);
    assert.equal(
      (html.match(/Original receipt: awaiting contact/g) || []).length,
      1,
    );
    assert.equal(
      (html.match(/原文 same message catatan &lt;script&gt;/g) || []).length,
      2,
    );
    assert.match(
      html,
      /dateTime="2026-10-17T03:00:00Z"|datetime="2026-10-17T03:00:00Z"/,
    );
    assert.doesNotMatch(html, />2000-01-01/);
    assert.match(html, /crm-conversation-task-reference/);
    assert.doesNotMatch(html, /<textarea|contenteditable|<script>/);
    assert.equal((html.match(/<article /g) || []).length, messages.length);
    assert.doesNotMatch(
      render(lang),
      /crm-message-associate|crm-conversation-task-record/,
    );
  }
  assert.equal(JSON.stringify({ messages, tasks, lead }), before);
});

test("Multiple sessions use shared choice control; absent tasks show unavailable rather than completed", () => {
  const html = render("en", {
    messages: [
      ...messages,
      {
        ...messages[0],
        id: "old",
        conversation_id: "old",
        timestamp: "2026-10-16T03:00:00Z",
      },
    ],
    tasks: [],
  });
  assert.match(html, /Conversation history/);
  assert.match(html, /Linked task unavailable/);
  assert.doesNotMatch(html, /Follow-up completed/);
  assert.match(render("en", { messages: [] }), /No conversations recorded/);
});

test("Conversation guide describes current-versus-historical status and no automatic contact/task completion in all languages", () => {
  const section = guideSections.find((section) => section.key === "chat")!;
  assert.ok(
    section.body.every(
      (paragraph) =>
        paragraph.length === 3 && paragraph.every((text) => text.length > 3),
    ),
  );
  assert.match(section.body.flat().join(" "), /original evidence/);
  assert.match(section.body.flat().join(" "), /不创建任务/);
});

test("Request event titles distinguish handoff, booking and enrollment without inferring confirmed business outcomes", () => {
  const originals = ["handoff", "booking", "enrollment", "unknown_action"].map(
    (action, index) => ({
      ...messages[2],
      id: `request-${index}`,
      content: `UNEDITED ${action}`,
      metadata: { followupAction: action },
    }),
  );
  const labels = {
    en: [
      "Advisor contact request recorded",
      "Booking request recorded",
      "Enrollment interest recorded",
      "Follow-up request recorded",
      "Original request confirmations",
    ],
    id: [
      "Permintaan kontak konsultan tercatat",
      "Permintaan janji temu tercatat",
      "Minat pendaftaran tercatat",
      "Permintaan tindak lanjut tercatat",
      "Konfirmasi permintaan asli",
    ],
    zh: [
      "顾问联系请求已记录",
      "预约请求已记录",
      "报名意向已记录",
      "跟进请求已记录",
      "请求确认原文",
    ],
  };
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(lang, { messages: [...originals, messages[0]] });
    labels[lang].forEach((label) => assert.ok(html.includes(label), label));
    originals.forEach((message) => assert.ok(html.includes(message.content)));
    assert.doesNotMatch(
      html,
      /Advisor request recorded|已记录顾问请求|Booking confirmed|Enrolled successfully|预约已确认|报名已完成/,
    );
    assert.doesNotMatch(
      html,
      /crm-message-associate/,
      "Actions are in current linked tasks, not repeated below customer messages",
    );
    assert.equal(
      (html.match(/class="crm-conversation-event-label"/g) || []).length,
      4,
    );
  }
});

test("Request operation needs saved evidence, while repeated tasks use one full task reference without a duplicate card", () => {
  const original = {
    ...messages[2],
    request_id: "request-a",
    metadata: { followupAction: "booking", taskId: "booking" },
  };
  const subsequent = { ...original, id: "supplement", request_id: "request-b" };
  const task = {
    id: "booking",
    kind: "booking",
    status: "open",
    due_at: "2026-10-20T04:00:00Z",
    details: {
      action: "Confirm requested trial 原文",
      sourceConversationId: "session",
      sourceMessageId: "request-a",
    },
  };
  assert.equal(conversationRequestOperation(original, task), "created");
  assert.equal(conversationRequestOperation(subsequent, task), "supplemented");
  assert.equal(conversationRequestOperation(messages[2], tasks[0]), "linked");
  assert.equal(
    conversationRequestOperation(
      {
        ...original,
        metadata: { ...original.metadata, taskOperation: "supplemented" },
      },
      task,
    ),
    "supplemented",
  );
  const customer = { ...messages[0], request_id: "request-a" };
  assert.equal(
    conversationRequestSource(original, [customer, original]),
    customer,
  );
  assert.equal(
    conversationRequestSource(subsequent, [customer, subsequent]),
    undefined,
    "Never infer source by adjacency",
  );
  for (const lang of ["en", "id", "zh"] as const) {
    const html = render(lang, {
      messages: [customer, original, subsequent],
      tasks: [task],
    });
    assert.equal((html.match(/data-task-id="booking"/g) || []).length, 0);
    assert.equal(
      (html.match(/class="crm-conversation-task-record"/g) || []).length,
      0,
    );
    assert.equal(
      (html.match(/class="crm-conversation-task-reference"/g) || []).length,
      2,
    );
    assert.match(html, /tabindex="-1"|tabIndex="-1"/);
    assert.ok(html.includes(lang === "zh" ? "预约请求已记录" : lang === "id" ? "Permintaan janji temu tercatat" : "Booking request recorded"));
    assert.doesNotMatch(html, /已创建跟进任务|已补充到现有任务|Follow-up task created|Added to existing task/);
    assert.doesNotMatch(html, /查看原始回执|View original receipt/);
    assert.equal(
      (html.match(/Original receipt: awaiting contact/g) || []).length,
      2,
      "Both distinct original confirmations survive in audit history",
    );
    const missing = render(lang, { messages: [original], tasks: [] });
    assert.doesNotMatch(
      missing,
      /crm-conversation-task-record|data-task-id=|2026-10-20/,
    );
  }
});

test("Chinese conversation timestamps display seconds for messages and session activity", () => {
  const html = render('zh', {messages:[{id:'precise',conversation_id:'session',role:'user',content:'秒级时间核对',timestamp:'2026-10-17T03:04:27Z'}]});
  assert.match(html, /<time[^>]*>\d{2}:\d{2}:27<\/time>/);
  assert.match(html, /2026-10-\d{2} \d{2}:04:27/);
});
