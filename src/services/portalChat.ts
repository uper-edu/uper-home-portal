import {verifyVisitorSession, visitorScope, assertVisitorScope, invalidateVisitorScope} from './visitorScope';
import {saveStudentContext} from './studentProfileStorage';
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
async function session() {
  const s = await verifyVisitorSession();
  setDraftScope(s.cacheScope);
  return s;
}
const responseScopes = new WeakMap<Response,string>();
async function scopedFetch(url: string, init?: RequestInit) {
  const expected = visitorScope();
  assertVisitorScope(expected);
  const response = await fetch(url, {...init, headers: {...Object.fromEntries(new Headers(init?.headers)), 'X-Visitor-Scope': expected}});
  assertVisitorScope(expected);
  if (response.status === 409 && (await response.clone().json().catch(()=>({}))).error === 'Visitor identity changed') {
    invalidateVisitorScope();
    throw Error('Visitor changed; reload before continuing');
  }
  responseScopes.set(response, expected);
  return response;
}
async function scopedJson(response: Response) {
  const expected = responseScopes.get(response) || visitorScope();
  const data = await response.json();
  assertVisitorScope(expected);
  return data;
}
export async function conversation(source: ChatSource) {
  const expected = visitorScope();
  await session();
  assertVisitorScope(expected);
  const res = await checked(
    await scopedFetch("/api/portal/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, page: location.pathname + location.search, campaign: new URLSearchParams(location.search).get("c") || "" }),
    }),
  );
  return (await scopedJson(res)).conversationId as string;
}
export async function registerContact(profile: object) {
  const expected = visitorScope();
  // Contact registration never submits grade claims; assessment answers have their own endpoint.
  const contact: Record<string, unknown> = { ...profile };
  const params=new URLSearchParams(location.search);
  contact.promotionLinkId=params.get('p')||undefined;
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
  assertVisitorScope(expected);
  let response=await scopedFetch("/api/portal/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(contact)});
  if(response.status===409&&(await response.clone().json()).error==='Contact identity changed; start a separate visitor session'){
    const lang=String((profile as any).language||(profile as any).lang||document.documentElement.lang||'en');
    const agreed=window.confirm(lang.startsWith('zh')?'联系方式与当前客户不同。是否作为另一位使用者开始？原客户记录将保留。':lang.startsWith('id')?'Kontak berbeda dari pelanggan saat ini. Mulai sebagai pengguna lain? Catatan lama tetap tersimpan.':'Contact details differ from the current customer. Start as another user? Existing records will be preserved.');
    if(!agreed)throw Error(lang.startsWith('zh')?'未覆盖原客户，请核对联系方式。':lang.startsWith('id')?'Catatan lama tidak ditimpa. Periksa kontak.':'Existing customer was preserved. Review contact details.');
    await checked(await scopedFetch('/api/portal/new-person',{method:'POST'}));invalidateVisitorScope();await session();
    response=await scopedFetch("/api/portal/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(contact)});
  }
  const data = await scopedJson(await checked(response));
  saveStudentContext({leadProfile:data.lead});
  return data;
}
export const INQUIRY_IDENTITY_CHANGED = 'INQUIRY_IDENTITY_CHANGED';
export const INQUIRY_IDENTITY_CANCELLED = 'INQUIRY_IDENTITY_CANCELLED';
/** A contact-form draft stays with its verified visitor until an explicit change. */
export async function contactInquiry(payload: Record<string,string>, language: string, identity: {scope: string}) {
  await session();
  if(!identity.scope) identity.scope=visitorScope();
  if(identity.scope!==visitorScope()) throw Error(INQUIRY_IDENTITY_CHANGED);
  const send=()=>scopedFetch('/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let response=await send();
  if(response.status===409&&(await response.clone().json()).error==='Contact identity changed; start a separate visitor session') {
    const agreed=window.confirm(language.startsWith('zh')?'联系方式与当前客户不同。是否作为另一位使用者提交本次咨询？原客户记录将保留。取消后可继续核对表单。':language.startsWith('id')?'Kontak berbeda dari pelanggan saat ini. Kirim pertanyaan ini sebagai pengguna lain? Catatan lama tetap tersimpan. Pilih Batal untuk memeriksa formulir.':'Contact details differ from the current customer. Submit this inquiry as another user? Existing records will be preserved. Cancel to review the form.');
    if(!agreed) throw Error(INQUIRY_IDENTITY_CANCELLED);
    assertVisitorScope(identity.scope);
    await checked(await scopedFetch('/api/portal/new-person',{method:'POST'}));
    invalidateVisitorScope();
    identity.scope='';
    const current=await session(); identity.scope=current.cacheScope;
    response=await send();
  }
  // Parse within the scope guard so delayed responses cannot clear a different visitor's draft.
  const data=await scopedJson(response);
  return Response.json(data,{status:response.status});
}
export async function chatFetch(
  _url: string,
  init: RequestInit,
  source: ChatSource,
) {
  const expected = visitorScope();
  const old = JSON.parse(String(init.body));
  const user = [...old.messages].reverse().find((m) => m.role === "user");
  await session();
  assertVisitorScope(expected);
  const previous = draft(source, user.id);
  const messageId = user.id || crypto.randomUUID();
  const queued = {
    id: messageId,
    content: user.content,
    conversationId: previous?.conversationId || "",
    timestamp: previous?.timestamp || new Date().toISOString(),
    delivery: "unknown" as const,
  };
  if (old.action !== undefined && !['handoff','booking','enrollment'].includes(old.action)) throw Error('Invalid request action');
  // Explicit product controls do not depend on localized prose matching an intent regex.
  const action = previous?.action || old.action || (old.isHumanMode ? 'handoff' : undefined);
  saveDraft(source, {...queued,action});
  const conversationId =
    previous?.conversationId || (await conversation(source));
  if (action) {
    const pending={...queued,conversationId,action};saveDraft(source,pending);
    const res=await scopedFetch('/api/portal/actions',{...init,body:JSON.stringify({conversationId,messageId,content:user.content,action,language:old.language || 'en'})});
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
    const res = await scopedFetch("/api/chat", {
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
  const expected = visitorScope();
  const data = await scopedJson(await checked(await scopedFetch("/api/portal/conversations/" + conversationId)));
  assertVisitorScope(expected);
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
    action: m.role === 'user' ? data.messages.find((a:any) => a.request_id === m.request_id && ['handoff','booking','enrollment'].includes(a.metadata?.followupAction))?.metadata.followupAction : undefined,
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
  expectedScope = visitorScope(),
) {
  await session();
  assertVisitorScope(expectedScope);
  const res = await checked(
    await scopedFetch("/api/portal/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt, lang }),
      signal: AbortSignal.timeout(15000),
    }),
  );
  const data = await scopedJson(res);
  assertVisitorScope(expectedScope);
  return data.result as import("../data/hskAssessment").HskResult;
}
export async function restoreHskHistory(lang: import("../data/hskAssessment").HskLanguage = "en") {
  await session();
  const expected = visitorScope();
  const res = await checked(await scopedFetch("/api/portal/assessments"));
  const data = await scopedJson(res);
  if (!Array.isArray(data.results)) throw Error("Invalid assessment history response");
  assertVisitorScope(expected);
  return mergeHskHistoryRows(data.results, lang);
}
export async function restoreHskAttempts() {
  return (await restoreHskHistory()).results;
}

/** Idempotent system introduction. It does not fabricate a learner-authored message. */
export async function assessmentConsultation(attemptId: string, lang: "zh" | "en" | "id") {
  const conversationId = await conversation("standalone_chat");
  return checked(await scopedFetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({conversationId, assessmentAttemptId: attemptId, lang, stream: true}),
  }));
}

export async function profileConsultation(lang: "zh" | "en" | "id") {
  const conversationId = await conversation("standalone_chat");
  return checked(await scopedFetch('/api/chat', {
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
  const owner = responseScopes.get(res) || visitorScope();
  assertVisitorScope(owner);
  const m = draft(source, messageId);
  try {
    const result = await readChatResponse(res, (e) => {
      assertVisitorScope(owner);
      if (e.saved && m)
        saveDraft(source, {
          ...m,
          delivery: e.done && e.error ? "failed" : "saved",
        });
      onProgress(e);
    });
    assertVisitorScope(owner);
    removeDraft(source, messageId);
    return result;
  } catch (e) {
    if (m && visitorScope() === owner) {
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

/** Explicit shared-device person switch; server records remain intact. */
export async function startAnotherVisitor() {
  await session();
  await checked(await scopedFetch('/api/portal/new-person', {method:'POST'}));
  invalidateVisitorScope();
  await session();
}

/** Recovery reads one attempt owned by the active visitor; never returns another visitor's result. */
export async function restoreHskAttempt(attemptId:string, expectedScope=visitorScope()){
 await session();assertVisitorScope(expectedScope);
 const res=await checked(await scopedFetch('/api/portal/assessments/'+encodeURIComponent(attemptId),{signal:AbortSignal.timeout(15000)}));
 const data=await scopedJson(res);assertVisitorScope(expectedScope);
 return data.result as import('../data/hskAssessment').HskResult;
}
