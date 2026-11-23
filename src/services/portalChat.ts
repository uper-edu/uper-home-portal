import {sameHskSubmission} from '../utils/hskSubmissionIdentity';
import type {HskAttempt,HskLanguage,HskResult} from '../data/hskAssessment';
import {rememberVisitorContact} from './visitorContact';
import {trackEvent,trackReceipt,trackConfirmedReceipt} from '../utils/analytics';
import {registrationAnalyticsReceipt,assessmentAnalyticsReceipt,advisorAnalyticsReceipt,registrationAdvisorAnalyticsReceipts} from '../utils/analyticsReceipts';
import {saveRegistration,hasPendingRegistration,RegistrationSaveError} from './registrationSave';
import {verifyVisitorSession, visitorScope, assertVisitorScope, invalidateVisitorScope, VISITOR_MARKER} from './visitorScope';
import {saveStudentContext} from './studentProfileStorage';
import { mergeHskHistoryRows, writeHskResult } from "./hskAttemptStorage";
import {normalizeEnrollmentChatSelection} from '../utils/enrollmentChatJourney';
import {promotionEvidenceKeys, promotionEntryPoint} from '../utils/promotionNavigation';
import {
  setDraftScope,
  drafts,
  draft,
  saveDraft,
  removeDraft,
  readChatResponse,
} from "./chatDelivery";
export type ChatSource = "homepage_widget" | "standalone_chat";
export const sharedChatDrafts = "shared_chat";
export type ChatOrigin = {page?: string; source: ChatSource};
export function chatPromotionParams(origin?: ChatOrigin, search = location.search) {
  const page = origin?.page;
  const original = page ? page.match(/\?.*$/)?.[0] : search;
  const params = new URLSearchParams(original);
  if (origin?.source === 'homepage_widget' && !params.has('entry_point')) params.set('entry_point', 'homepage_widget');
  return params;
}
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
export async function conversation(source: ChatSource, newSession = false, shared?: {previous?: string; page?: string}) {
  const expected = visitorScope();
  await session();
  assertVisitorScope(expected);
  const res = await checked(
    await scopedFetch("/api/portal/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ source, page: shared?.page ?? location.pathname + location.search,
        ...(newSession && {newSession}), ...(shared && {shared:true, previousConversationId:shared.previous}) }),
    }),
  );
  return (await scopedJson(res)).conversationId as string;
}
export async function registerContact(profile: object,options:{queryOnly?:boolean;retryOriginal?:boolean;chatOrigin?:ChatOrigin;contactConversion?:boolean}={}) {
  const began=Date.now();
  const expected = visitorScope();
  // Contact registration never submits grade claims; assessment answers have their own endpoint.
  const contact: Record<string, unknown> = { ...profile };
  const params=chatPromotionParams(options.chatOrigin);
  const promotionId = params.get('p');
  contact.promotionLinkId = promotionId ?? undefined;
  delete contact.campaignId;
  delete contact.campaign;
  if (promotionId !== null) {
    contact.promotionParametersInvalid = new Set(params.getAll('p')).size > 1 || undefined;
    contact.promotionParameters = promotionEvidenceKeys.flatMap(key =>
      params.getAll(key).map(value => ({ key, value: value.slice(0, 191) }))).slice(0, 24);
  }
  contact.utmCampaign = params.get('utm_campaign') || undefined;
  contact.promotionEntryPoint = promotionEntryPoint(params.get('entry_point'))
    ?? (options.chatOrigin?.source === 'standalone_chat' || location.pathname.startsWith('/chat') || location.pathname.startsWith('/consult') ? 'direct' : 'homepage_widget');
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
  let responseScope=expected;
  let storage:Storage|undefined;try{storage=window.sessionStorage;}catch{}
  const send=()=>saveRegistration({scope:visitorScope(),payload:contact,fetcher:scopedFetch as typeof fetch,storage,...options});
  let data:any;
  try{data=await send();}catch(error){
  if(error instanceof Error&&error.message==='Contact identity changed; start a separate visitor session'){
    const lang=String((profile as any).language||(profile as any).lang||document.documentElement.lang||'en');
    const agreed=window.confirm(lang.startsWith('zh')?'联系方式与当前客户不同。是否作为另一位使用者开始？原客户记录将保留。':lang.startsWith('id')?'Kontak berbeda dari pelanggan saat ini. Mulai sebagai pengguna lain? Catatan lama tetap tersimpan.':'Contact details differ from the current customer. Start as another user? Existing records will be preserved.');
    if(!agreed)throw new RegistrationSaveError('failed',lang.startsWith('zh')?'未覆盖原客户，请核对联系方式。':lang.startsWith('id')?'Catatan lama tidak ditimpa. Periksa kontak.':'Existing customer was preserved. Review contact details.');
    await checked(await scopedFetch('/api/portal/new-person',{method:'POST'}));invalidateVisitorScope();await session();
    responseScope=visitorScope();
    if (options.chatOrigin) {
      delete contact.promotionLinkId;
      delete contact.promotionParametersInvalid;
      delete contact.promotionParameters;
      delete contact.utmCampaign;
      contact.promotionEntryPoint = location.pathname.startsWith('/chat') || location.pathname.startsWith('/consult') ? 'direct' : 'homepage_widget';
    }
    data=await send();
  }else throw error;
  }
  assertVisitorScope(responseScope);
  const analyticsReceipt=registrationAnalyticsReceipt(data,String(location.pathname||'').startsWith('/chat')||String(location.pathname||'').startsWith('/consult')?'standalone_chat':'homepage_widget');
  if(analyticsReceipt&&options.contactConversion!==false)trackConfirmedReceipt({...analyticsReceipt,params:{...analyticsReceipt.params,entry_point:contact.promotionEntryPoint,response_time_ms:Date.now()-began}});
  for(const receipt of registrationAdvisorAnalyticsReceipts(data))trackConfirmedReceipt(receipt);
  saveStudentContext({leadProfile:data.lead});
  if(options.contactConversion)rememberVisitorContact(responseScope,data.lead??{});
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
const responseStarts=new WeakMap<Response,number>();
const responseDraftSources=new WeakMap<Response,string>();
export async function chatFetch(url:string,init:RequestInit,source:ChatSource,threadId?:string,shared=false){
 const began=Date.now(),owner=visitorScope();trackEvent('consultation_send',{entry_point:source,status:'attempt'});
 try{const draftSource=shared ? sharedChatDrafts : source;
   const response=await sendChatRequest(url,init,source,threadId,draftSource,shared);
   responseDraftSources.set(response,draftSource);responseStarts.set(response,began);return response;}
 catch(error){if(visitorScope()===owner)trackEvent('consultation_result',{entry_point:source,status:'unknown',reason:'transport',response_time_ms:Date.now()-began});throw error;}
}
async function sendChatRequest(
  _url: string,
  init: RequestInit,
  source: ChatSource,
  threadId?: string,
  draftSource = source as string,
  shared = false,
) {
  const expected = visitorScope();
  const old = JSON.parse(String(init.body));
  const user = [...old.messages].reverse().find((m) => m.role === "user");
  await session();
  assertVisitorScope(expected);
  const previous = draft(draftSource, user.id);
  if (previous?.conversationId && threadId && previous.conversationId !== threadId)
    throw Error("Message belongs to another conversation");
  const messageId = user.id || crypto.randomUUID();
  const queued = {
    id: messageId,
    content: user.content,
    conversationId: previous?.conversationId || threadId || "",
    timestamp: previous?.timestamp || new Date().toISOString(),
    delivery: "unknown" as const,
  };
  if (old.action !== undefined && !['handoff','booking','enrollment'].includes(old.action)) throw Error('Invalid request action');
  // Explicit product controls do not depend on localized prose matching an intent regex.
  const action = previous?.action || old.action;
  saveDraft(draftSource, {...queued,action});
  const conversationId =
    queued.conversationId || (await conversation(source));
  if (action) {
    const pending={...queued,conversationId,action};saveDraft(draftSource,pending);
    const res=await scopedFetch('/api/portal/actions',{...init,body:JSON.stringify({conversationId,messageId,content:user.content,action,language:old.language || 'en',...(shared && {entrySurface:source})})});
    if(!res.ok){const error=await res.clone().json().catch(()=>({}));if(error.saved===false)saveDraft(draftSource,{...pending,delivery:'unsaved'});await checked(res);}
    return res;
  }
  const pending = {
    id: messageId,
    content: user.content,
    conversationId,
    enrollmentContext:previous?.enrollmentContext??normalizeEnrollmentChatSelection(old.enrollmentContext),
    timestamp: previous?.timestamp || new Date().toISOString(),
    delivery: "unknown" as const,
  };
  saveDraft(draftSource, pending);
  try {
    const res = await scopedFetch("/api/chat", {
      ...init,
      body: JSON.stringify({
        conversationId,
        messageId,
        content: user.content,
        lang: old.language,
        stream: old.stream,
        enrollmentContext:pending.enrollmentContext,
        ...(shared && {entrySurface:source}),
      }),
    });
    if (!res.ok) {
      const error = await res
        .clone()
        .json()
        .catch(() => ({}));
      if (error.saved === false)
        saveDraft(draftSource, { ...pending, delivery: "unsaved" });
      if (error.saved === true)
        saveDraft(draftSource, { ...pending, delivery: "interrupted" });
      await checked(res);
    }
    return res;
  } catch (e) {
    throw e;
  }
}

async function readChat(conversationId: string) {
  return scopedJson(await checked(await scopedFetch(
    "/api/portal/conversations/" + encodeURIComponent(conversationId),
    {cache:"no-store", signal:AbortSignal.timeout(15000)},
  )));
}

async function recoverRegistration(owner: string) {
  let storage:Storage|undefined;try{storage=window.sessionStorage;}catch{}
  if(hasPendingRegistration(owner,storage)){
    try{await saveRegistration({scope:owner,payload:{},fetcher:scopedFetch as typeof fetch,storage,queryOnly:true});}catch{/* Keep an unconfirmed tab draft. */}
    assertVisitorScope(owner);
  }
}

function chatSnapshot(data: any, conversationId: string, draftSource: string, boundOnly: boolean) {
  for (const m of data.messages) {
    if (m.role === "user") {
      const answer = data.messages.find((a: any) => a.request_id === m.request_id && a.role === "assistant");
      if (answer && ["failed", "interrupted"].includes(answer.status))
        saveDraft(draftSource, {
          id: m.request_id,
          content: m.content,
          conversationId,
          timestamp: m.created_at,
          delivery: answer.status,
          action: answer.metadata?.followupAction || draft(draftSource, m.request_id)?.action,
          enrollmentContext:normalizeEnrollmentChatSelection(m.metadata?.enrollmentContext) ??
            draft(draftSource,m.request_id)?.enrollmentContext,
        });
    }
    if (m.role === "assistant" && m.status === "completed") removeDraft(draftSource, m.request_id);
  }
  const rows = data.messages.map((m: any) => ({
    ...m,
    id: m.role === "user" ? m.request_id : "reply-" + m.request_id,
    delivery: m.role === "user" ? draft(draftSource, m.request_id)?.delivery || "saved" : undefined,
    timestamp: new Date(m.created_at),
    action: m.role === 'user' ? draft(draftSource, m.request_id)?.action : undefined,
    enrollmentContext:m.role==='user'?draft(draftSource,m.request_id)?.enrollmentContext:undefined,
    enrollment: m.role==='assistant'&&m.status==='completed'?m.metadata?.enrollment:undefined,
    workspaceEntry: m.role==='assistant'&&m.status==='completed'?m.metadata?.workspaceEntry:undefined,
    suggestedPrompts: m.role==='assistant'&&m.status==='completed'?m.metadata?.suggestedPrompts:undefined,
    content: m.status === "interrupted" ? "[回复中断，可重试]" : m.content,
  }));
  const messages = [
    ...rows,
    ...drafts(draftSource)
      .filter(m => (m.conversationId === conversationId || (!boundOnly && !m.conversationId)) && !rows.some((row: {id: string}) => row.id === m.id))
      .map(m => ({...m, role:"user" as const, timestamp:new Date(m.timestamp)})),
  ];
  const page = data.conversation?.attribution?.page;
  return {conversationId, messages, page: typeof page === "string" ? page : undefined};
}

export async function restoreChat(source: ChatSource, threadId?: string) {
  const owner = visitorScope();
  await recoverRegistration(owner);
  const conversationId = threadId ?? await conversation(source);
  if (threadId !== undefined) await session();
  assertVisitorScope(owner);
  const data = await readChat(conversationId);
  if (threadId !== undefined && data.conversation?.source !== source) throw Error("Invalid conversation source");
  return chatSnapshot(data, conversationId, source, threadId !== undefined);
}

export async function restoreCurrentChat(source: ChatSource, options: {previous?: string; legacyThreadId?: string; page?: string} = {}) {
  const owner = visitorScope();
  if (options.legacyThreadId !== undefined) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(options.legacyThreadId))
      throw Error("Invalid conversation reference");
    const saved = await readChat(options.legacyThreadId);
    if (saved.conversation?.source !== 'homepage_widget') throw Error("Invalid conversation source");
  }
  await recoverRegistration(owner);
  assertVisitorScope(owner);
  const conversationId = await conversation(source, options.previous !== undefined, options);
  assertVisitorScope(owner);
  const data = await readChat(conversationId);
  for (const legacySource of ['homepage_widget','standalone_chat']) {
    for (const message of drafts(legacySource)) {
      if (message.conversationId !== conversationId) continue;
      if (!draft(sharedChatDrafts, message.id)) saveDraft(sharedChatDrafts, message);
      removeDraft(legacySource, message.id);
    }
  }
  return {...chatSnapshot(data, conversationId, sharedChatDrafts, true),
    source: (data.conversation.attribution?.chatOriginSource ?? data.conversation.source) as ChatSource,
    restarted: data.conversation.attribution?.chatRestarted === true};
}

export async function saveHskAttempt(
  attempt: HskAttempt,
  lang: HskLanguage,
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
  const result = data.result as HskResult;
  if(result?.attempt?.attemptId!==attempt.attemptId||result.saveStatus!=='saved')throw Error('Invalid assessment receipt');
  acceptHskReceipt(result,expectedScope);
  return result;
}
/** Recover an owned result before explicitly retrying a submission with no confirmed receipt. */
async function readHskReceipt(attemptId:string, expectedScope=visitorScope()): Promise<HskResult|null> {
  await session();
  assertVisitorScope(expectedScope);
  const response=await scopedFetch('/api/portal/assessments/'+encodeURIComponent(attemptId),{signal:AbortSignal.timeout(15000)});
  if(response.status===404 && (await scopedJson(response.clone())).error==='Attempt not found')return null;
  const {result}=await scopedJson(await checked(response));
  if(result?.attempt?.attemptId!==attemptId||result.saveStatus!=='saved')throw Error('Invalid assessment receipt');
  return result;
}

export async function recoverHskAttempt(attemptId:string, expectedScope=visitorScope()) {
  const saved=await readHskReceipt(attemptId,expectedScope);
  if(!saved)throw Error('Attempt not found');
  acceptHskReceipt(saved,expectedScope);
  return saved;
}

export async function retryHskAttempt(attempt:HskAttempt, lang:HskLanguage, expectedScope=visitorScope()) {
  const saved=await readHskReceipt(attempt.attemptId,expectedScope);
  if(!saved)return saveHskAttempt(attempt,lang,expectedScope);
  if(!sameHskSubmission(saved.attempt,attempt))throw Error('Attempt already submitted with different answers');
  acceptHskReceipt(saved,expectedScope);
  return saved;
}

function acceptHskReceipt(result:HskResult,expectedScope:string) {
  assertVisitorScope(expectedScope);
  trackConfirmedReceipt(assessmentAnalyticsReceipt(result,result.attempt.attemptId));
  writeHskResult(result);
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
export async function assessmentConsultation(attemptId: string, lang: "zh" | "en" | "id", threadId?: string, entrySurface?: ChatSource) {
  const conversationId = threadId ?? await conversation("standalone_chat");
  return checked(await scopedFetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({conversationId, assessmentAttemptId: attemptId, lang, stream: true, entrySurface}),
  }));
}

export async function profileConsultation(lang: "zh" | "en" | "id", threadId?: string, entrySurface?: ChatSource) {
  const conversationId = threadId ?? await conversation("standalone_chat");
  return checked(await scopedFetch('/api/chat', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({conversationId,consultationStart:true,lang,stream:true,entrySurface}),
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
  const draftSource = responseDraftSources.get(res) || source;
  const m = draft(draftSource, messageId);
  const began=responseStarts.get(res)||Date.now();let knownFailure=false;
  try {
    const result = await readChatResponse(res, (e) => {
      assertVisitorScope(owner);
      if(e.saved&&m)trackReceipt("consultation_message_saved",messageId,{entry_point:source});
      if(e.error||e.status==='failed'){knownFailure=true;trackEvent("consultation_result",{status:"failed",reason:"provider_failure",entry_point:source,response_time_ms:Date.now()-began});}
      if (e.saved && m)
        saveDraft(draftSource, {
          ...m,
          delivery: e.done && e.error ? "failed" : "saved",
        });
      onProgress(e);
    });
    assertVisitorScope(owner);
    trackConfirmedReceipt(advisorAnalyticsReceipt(result,m));
    if(m&&result?.saved===true)trackReceipt("consultation_result",messageId,{entry_point:source,response_time_ms:Date.now()-began});
    removeDraft(draftSource, messageId);
    return result;
  } catch (e) {
    if(!knownFailure&&visitorScope()===owner)trackEvent("consultation_result",{status:"unknown",reason:"transport",entry_point:source,response_time_ms:Date.now()-began});
    if (m && visitorScope() === owner) {
      const latest = draft(draftSource, messageId);
      saveDraft(draftSource, {
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
export async function startAnotherVisitor(continuationExit?: string) {
  await session();
  await checked(await scopedFetch('/api/portal/new-person', {method:'POST'}));
  try { localStorage.removeItem(VISITOR_MARKER); } catch {}
  invalidateVisitorScope();
  if (continuationExit) location.replace(continuationExit);
  else await session();
}
