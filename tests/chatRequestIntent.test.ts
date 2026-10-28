import {selectVisitorScope} from '../src/services/visitorScope';
selectVisitorScope('a'.repeat(64));
import { test } from "node:test";
import assert from "node:assert/strict";
import { explicitChatRequest } from "../src/utils/chatRequestIntent.ts";
import { chatFetch, finishChat } from "../src/services/portalChat.ts";
import { draft } from "../src/services/chatDelivery.ts";
import { followupReply } from "../server/portal/followup.ts";

test("Only explicit singular requests route to follow-up; ordinary, negated, conditional and conflicting intent remains consultation", () => {
  for (const [text, action] of [
    ["请顾问联系我", "handoff"],
    ["我想转人工", "handoff"],
    ["Please ask a human adviser to contact me", "handoff"],
    ["Saya ingin berbicara dengan konsultan", "handoff"],
    ["我想预约试听", "booking"],
    ["I would like to book a trial lesson", "booking"],
    ["Saya ingin menjadwalkan kelas percobaan", "booking"],
    ["我要报名", "enrollment"],
    ["I want to enroll in a course", "enrollment"],
    ["Saya ingin mendaftar kelas", "enrollment"],
    ["我不想报名，但是我想预约试听", "booking"],
  ])
    assert.equal(explicitChatRequest(text), action, text);
  for (const text of [
    "我想了解周末课程",
    "What weekend courses do you offer?",
    "Saya ingin tahu jadwal kelas akhir pekan",
    "我不想报名",
    "不要转人工",
    "如果我要报名，需要准备什么",
    "如何预约试听",
    "How do I enroll?",
    "I don't want to enroll",
    "If I want to book a trial lesson",
    "Saya belum mau daftar kelas",
    "Bagaimana cara mendaftar kelas?",
    "我想预约试听，我要报名",
    "Please explain what ‘I want to enroll’ means",
  ]) {
    assert.equal(explicitChatRequest(text), undefined, text);
  }
});

test("Shared real chat client routes all request types, keeps retry identity/action and leaves ordinary consultation on AI endpoint", async () => {
  const storage = new Map<string, string>(),
    posts: any[] = [];
  const before = {
    fetch: globalThis.fetch,
    localStorage: globalThis.localStorage,
    location: globalThis.location,
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { pathname: "/chat", search: "" },
  });
  let rejectBooking = true;
  globalThis.fetch = async (input: any, init: any) => {
    const url = String(input);
    if (url === "/api/portal/session")
      return Response.json({ cacheScope: 'a'.repeat(64) });
    if (url === "/api/portal/conversations")
      return Response.json({ conversationId: "TEST-real-conversation" });
    const body = JSON.parse(init.body);
    posts.push({ url, body });
    if (body.action === "booking" && rejectBooking)
      return Response.json(
        { saved: false, error: "TEST unavailable" },
        { status: 503 },
      );
    return Response.json({
      saved: true,
      reply: "TEST saved response",
      status: "completed",
      taskId: body.action ? "TEST-" + body.action : undefined,
    });
  };
  const init = (id: string, content: string) => ({
    method: "POST",
    body: JSON.stringify({
      messages: [{ id, role: "user", content }],
      language: "zh",
      stream: true,
    }),
  });
  try {
    for (const [id, text, action] of [
      ["ordinary", "我想了解周末课程", undefined],
      ["handoff", "请顾问联系我", "handoff"],
      ["enrollment", "我要报名", "enrollment"],
    ] as const) {
      await finishChat(
        await chatFetch("/api/chat", init(id, text), "standalone_chat"),
        "standalone_chat",
        id,
        () => {},
      );
      assert.equal(
        posts.at(-1).url,
        action ? "/api/portal/actions" : "/api/chat",
      );
      assert.equal(posts.at(-1).body.action, action);
      assert.equal(posts.at(-1).body.content, text);
    }
    await assert.rejects(
      chatFetch(
        "/api/chat",
        init("booking", "我想预约试听"),
        "standalone_chat",
      ),
      /TEST unavailable/,
    );
    assert.equal(draft("standalone_chat", "booking")?.action, "booking");
    const first = posts.at(-1);
    rejectBooking = false;
    await finishChat(
      await chatFetch(
        "/api/chat",
        init("booking", "我想预约试听"),
        "standalone_chat",
      ),
      "standalone_chat",
      "booking",
      () => {},
    );
    assert.deepEqual(posts.at(-1), first);
    assert.equal(draft("standalone_chat", "booking"), undefined);
  } finally {
    globalThis.fetch = before.fetch;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: before.localStorage,
    });
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: before.location,
    });
  }
});

test("Booking and enrollment acknowledgements distinguish requests from confirmed business results in three languages", () => {
  for (const lang of ["en", "id", "zh"]) {
    assert.notEqual(
      followupReply(lang, "awaiting_advisor", "booking"),
      followupReply(lang, "awaiting_advisor", "enrollment"),
    );
    assert.notEqual(
      followupReply(lang, "awaiting_advisor", "handoff"),
      followupReply(lang, "awaiting_advisor", "booking"),
    );
  }
  assert.match(followupReply("zh", "awaiting_advisor", "booking"), /尚未确认/);
  assert.match(
    followupReply("zh", "awaiting_advisor", "enrollment"),
    /尚未完成/,
  );
});

test('664 exact advisor request accepts an advisor while negated, conditional, quoted and conflicting requests stay on AI',()=>{
 for(const text of ['please have an advisor contact me','Please have a human advisor call me','Please have an adviser contact me'])assert.equal(explicitChatRequest(text),'handoff',text);
 for(const text of ['If I decide, please have an advisor contact me','Do not have an advisor contact me','Translate "please have an advisor contact me"','How to have an advisor contact me?','please have an advisor contact me, I want to enroll','What can an advisor do?'])assert.equal(explicitChatRequest(text),undefined,text);
});

 test('booking denial, withdrawal and historical intent are checked across clauses in three languages',()=>{
 for(const text of ['我没有说我想预约试听，请先介绍周末线上班的学费。','我之前说我想预约试听，但现在不约了，只想先了解课程费用。','我之前说我想预约试听','I never said I want to book a trial lesson, please explain fees.','I previously said I want to book a trial, but I no longer want to book.','Saya tidak pernah bilang saya ingin booking kelas trial','Dulu saya ingin booking kelas trial, sekarang tidak jadi'])assert.equal(explicitChatRequest(text),undefined,text);
 for(const text of ['我想预约试听','I would like to book a trial lesson','Saya ingin menjadwalkan kelas percobaan','我不想报名，但是我想预约试听'])assert.equal(explicitChatRequest(text),'booking',text);
 });
