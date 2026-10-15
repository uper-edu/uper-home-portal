import { mergeHskHistoryRows } from "./hskAttemptStorage";
import {canonicalCampaignId} from '../utils/organicCampaign';
import {
  setDraftScope,
  drafts,
  draft,
  saveDraft,
  removeDraft,
  readChatResponse,
} from "./chatDelivery";
export type ChatSource = "homepage_widget" | "standalone_chat";
async function checked(res: Response) {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw Error(e.error || `Request failed ${res.status}`);
  }
  return res;
}
let sessionReady: Promise<Response> | undefined;
function session() {
  return (sessionReady ||= fetch("/api/portal/session")
    .then(checked)
    .then(async (r) => {
      const s = await r.clone().json();
      setDraftScope(s.cacheScope || "");
      return r;
    })
    .catch((e) => {
      sessionReady = undefined;
      throw e;
    }));
}
export async function conversation(source: ChatSource) {
  await session();
  const res = await checked(
    await fetch("/api/portal/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, page: location.pathname + location.search, campaign: new URLSearchParams(location.search).get("c") || "" }),
    }),
  );
  return (await res.json()).conversationId as string;
}
export async function registerContact(profile: object) {
  // Contact registration never submits grade claims; assessment answers have their own endpoint.
  const contact: Record<string, unknown> = { ...profile };
  const params=new URLSearchParams(location.search);
  contact.campaignId=canonicalCampaignId(params.get('c')||params.get('cid')||params.get('campaign'));
  for (const key of [
    "quizScore",
    "quizMaxScore",
    "totalQuestions",
    "levelConfirmed",
    "quizResultSummary",
    "quizBreakdown",
    "latestAssessment",
  ])
    delete contact[key];
  await session();
  return (
    await checked(
      await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contact),
      }),
    )
  ).json();
}
export async function chatFetch(
  _url: string,
  init: RequestInit,
  source: ChatSource,
) {
  const old = JSON.parse(String(init.body));
  const user = [...old.messages].reverse().find((m) => m.role === "user");
  await session();
  const previous = draft(source, user.id);
  const messageId = user.id || crypto.randomUUID();
  const queued = {
    id: messageId,
    content: user.content,
    conversationId: previous?.conversationId || "",
    timestamp: previous?.timestamp || new Date().toISOString(),
    delivery: "unknown" as const,
  };
  saveDraft(source, {...queued,action:old.isHumanMode || previous?.action==='handoff'?'handoff':undefined});
  const conversationId =
    previous?.conversationId || (await conversation(source));
  if (old.isHumanMode || previous?.action==='handoff') {
    const pending={...queued,conversationId,action:'handoff' as const};saveDraft(source,pending);
    const res=await fetch('/api/portal/actions',{...init,body:JSON.stringify({conversationId,messageId,content:user.content,action:'handoff',language:old.language || 'en'})});
    if(!res.ok){const error=await res.clone().json().catch(()=>({}));if(error.saved===false)saveDraft(source,{...pending,delivery:'unsaved'});await checked(res);}
    return res;
  }
  const pending = {
    id: messageId,
    content: user.content,
    conversationId,
    timestamp: previous?.timestamp || new Date().toISOString(),
    delivery: "unknown" as const,
  };
  saveDraft(source, pending);
  try {
    const res = await fetch("/api/chat", {
      ...init,
      body: JSON.stringify({
        conversationId,
        messageId,
        content: user.content,
        stream: old.stream,
      }),
    });
    if (!res.ok) {
      const error = await res
        .clone()
        .json()
        .catch(() => ({}));
      if (error.saved === false)
        saveDraft(source, { ...pending, delivery: "unsaved" });
      if (error.saved === true)
        saveDraft(source, { ...pending, delivery: "interrupted" });
      await checked(res);
    }
    return res;
  } catch (e) {
    throw e;
  }
}

export async function restoreChat(source: ChatSource) {
  const conversationId = await conversation(source);
  const data = await (
    await checked(await fetch("/api/portal/conversations/" + conversationId))
  ).json();
  for (const m of data.messages)
    if (m.role === "user") {
      const answer = data.messages.find(
        (a: any) => a.request_id === m.request_id && a.role === "assistant",
      );
      if (answer && ["failed", "interrupted"].includes(answer.status))
        saveDraft(source, {
          id: m.request_id,
          content: m.content,
          conversationId: m.conversation_id,
          timestamp: m.created_at,
          delivery: answer.status,
        });
    }
  for (const m of data.messages)
    if (m.role === "assistant" && m.status === "completed")
      removeDraft(source, m.request_id);
  const rows = data.messages.map((m: any) => ({
    ...m,
    id: m.role === "user" ? m.request_id : "reply-" + m.request_id,
    delivery:
      m.role === "user"
        ? draft(source, m.request_id)?.delivery || "saved"
        : undefined,
    timestamp: new Date(m.created_at),
    action: m.role==='user' && data.messages.some((a:any)=>a.request_id===m.request_id && a.metadata?.followupAction==='handoff') ? 'handoff' : undefined,
    content: m.status === "interrupted" ? "[回复中断，可重试]" : m.content,
  }));
  return [
    ...rows,
    ...drafts(source)
      .filter((m) => !rows.some((x: any) => x.id === m.id))
      .map((m) => ({
        ...m,
        role: "user" as const,
        timestamp: new Date(m.timestamp),
      })),
  ];
}

export async function saveHskAttempt(
  attempt: import("../data/hskAssessment").HskAttempt,
  lang: import("../data/hskAssessment").HskLanguage,
) {
  await session();
  const res = await checked(
    await fetch("/api/portal/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt, lang }),
      signal: AbortSignal.timeout(15000),
    }),
  );
  return (await res.json()).result as import("../data/hskAssessment").HskResult;
}
export async function restoreHskHistory(lang: import("../data/hskAssessment").HskLanguage = "en") {
  await session();
  const res = await checked(await fetch("/api/portal/assessments"));
  const data = await res.json();
  if (!Array.isArray(data.results)) throw Error("Invalid assessment history response");
  return mergeHskHistoryRows(data.results, lang);
}
export async function restoreHskAttempts() {
  return (await restoreHskHistory()).results;
}

/** Idempotent system introduction. It does not fabricate a learner-authored message. */
export async function assessmentConsultation(attemptId: string, lang: "zh" | "en" | "id") {
  const conversationId = await conversation("standalone_chat");
  return checked(await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({conversationId, assessmentAttemptId: attemptId, lang, stream: true}),
  }));
}

export async function profileConsultation(lang: "zh" | "en" | "id") {
  const conversationId = await conversation("standalone_chat");
  return checked(await fetch('/api/chat', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({conversationId,consultationStart:true,lang,stream:true}),
  }));
}

export async function finishChat(
  res: Response,
  source: ChatSource,
  messageId: string,
  onProgress: (e: any) => void,
) {
  const m = draft(source, messageId);
  try {
    const result = await readChatResponse(res, (e) => {
      if (e.saved && m)
        saveDraft(source, {
          ...m,
          delivery: e.done && e.error ? "failed" : "saved",
        });
      onProgress(e);
    });
    removeDraft(source, messageId);
    return result;
  } catch (e) {
    if (m) {
      const latest = draft(source, messageId);
      saveDraft(source, {
        ...m,
        delivery:
          latest?.delivery === "saved"
            ? "interrupted"
            : latest?.delivery || "unknown",
      });
    }
    throw e;
  }
}
