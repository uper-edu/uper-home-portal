import {createBrowserUuid} from '../utils/browserUuid';
import {sameHskSubmission} from '../utils/hskSubmissionIdentity';
import type {HskAttempt,HskLanguage,HskResult} from '../data/hskAssessment';
import {trackEvent,trackReceipt,trackConfirmedReceipt} from '../utils/analytics';
import {registrationAnalyticsReceipt,assessmentAnalyticsReceipt,advisorAnalyticsReceipt,registrationAdvisorAnalyticsReceipts} from '../utils/analyticsReceipts';
import {chatFollowupPrompts,readChatEnrollmentGuide} from '../utils/chatReplyMetadata';
import {saveRegistration,RegistrationSaveError} from './registrationSave';
import {verifyVisitorSession, visitorScope, assertVisitorScope, invalidateVisitorScope, VISITOR_MARKER} from './visitorScope';
import {saveStudentContext} from './studentProfileStorage';
import { mergeHskHistoryRows, writeHskResult } from "./hskAttemptStorage";
import {normalizeEnrollmentChatSelection} from '../utils/enrollmentChatJourney';
import {promotionEvidenceKeys, promotionEntryPoint} from '../utils/promotionNavigation';
import {
  drafts,
  chatDraftsEmpty,
  draft,
  saveDraft,
  removeDraft,
  updateDraftDelivery,
  readChatResponse,
  readChatJson,
  waitForChatResponse,
  writeChatDrafts,
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
    throw Object.assign(Error(e.error || `Request failed ${res.status}`), {status:res.status});
  }
  return res;
}
async function chatError(res:Response){
  const error=await readChatJson(res).catch((cause:Error)=>{
    if(cause.name==='TimeoutError')throw cause;
    return {};
  });
  return {saved:error?.saved,message:error?.error||`Request failed ${res.status}`};
}
const session = verifyVisitorSession;
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
function scopedChatFetch(url:string,init:RequestInit) {
  const controller=new AbortController();
  const signal=init.signal?AbortSignal.any([init.signal,controller.signal]):controller.signal;
  return waitForChatResponse(scopedFetch(url,{...init,signal}),()=>controller.abort());
}
type SharedConversationOptions = {previous?:string;page?:string;signal?:AbortSignal};
async function openConversation(source:ChatSource,newSession:boolean,shared?:SharedConversationOptions,history?:{includeHistory:true;historyDigest?:string}) {
  const expected = visitorScope();
  // Shared restore already has a verified scope. The conversation endpoint
  // checks the current cookie against that scope before looking up history.
  if (!history || newSession) await session();
  assertVisitorScope(expected);
  shared?.signal?.throwIfAborted();
  const res = await checked(
    await scopedFetch("/api/portal/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: shared?.signal ? AbortSignal.any([shared.signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      body: JSON.stringify({ source, page: shared?.page ?? location.pathname + location.search,
        ...(newSession && {newSession}), ...(shared && {shared:true, previousConversationId:shared.previous, ...history}) }),
    }),
  );
  return await scopedJson(res);
}
export async function conversation(source:ChatSource,newSession=false,shared?:SharedConversationOptions) {
  return (await openConversation(source,newSession,shared)).conversationId as string;
}
export async function registerContact(profile: object,options:{queryOnly?:boolean;retryOriginal?:boolean;chatOrigin?:ChatOrigin;contactConversion?:boolean}={}) {
  const began=Date.now();
  const expected = visitorScope();
  // The enrollment prefill code can load while the server verifies and saves the profile.
  const contactStorage=options.contactConversion ? import('./rememberVisitorContact').catch(()=>undefined) : undefined;
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
  const send=()=>{
    const scope=responseScope;
    return saveRegistration({scope,payload:contact,storage,...options,fetcher:(url,init)=>{
      assertVisitorScope(scope);
      return scopedFetch(url,init);
    }});
  };
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
  const contactWriter=await contactStorage;
  assertVisitorScope(responseScope);
  const analyticsReceipt=registrationAnalyticsReceipt(data,String(location.pathname||'').startsWith('/chat')||String(location.pathname||'').startsWith('/consult')?'standalone_chat':'homepage_widget');
  if(analyticsReceipt&&options.contactConversion!==false)trackConfirmedReceipt({...analyticsReceipt,params:{...analyticsReceipt.params,entry_point:contact.promotionEntryPoint,response_time_ms:Date.now()-began}});
  for(const receipt of registrationAdvisorAnalyticsReceipts(data))trackConfirmedReceipt(receipt);
  saveStudentContext({leadProfile:data.lead});
  contactWriter?.rememberVisitorContact(responseScope,data.lead??{});
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
  assertVisitorScope(expected);
  const old = JSON.parse(String(init.body));
  const user = [...old.messages].reverse().find((m) => m.role === "user");
  const previous = draft(draftSource, user.id);
  if (previous?.conversationId && threadId && previous.conversationId !== threadId)
    throw Error("Message belongs to another conversation");
  const messageId = user.id || createBrowserUuid();
  if (old.action !== undefined && !['handoff','booking','enrollment'].includes(old.action)) throw Error('Invalid request action');
  // Explicit product controls do not depend on localized prose matching an intent regex.
  const action = previous?.action || old.action;
  const pending = {
    id: messageId,
    content: user.content,
    conversationId: previous?.conversationId || threadId || "",
    timestamp: previous?.timestamp || new Date().toISOString(),
    delivery: previous?.delivery ?? "unsaved" as const,
    action,
    enrollmentContext: previous?.enrollmentContext ?? normalizeEnrollmentChatSelection(old.enrollmentContext),
  };
  // The composer can clear once its scoped retry draft is durable. Sending still requires a fresh session check.
  saveDraft(draftSource, pending);
  if (globalThis.navigator?.onLine === false) throw Error('Chat cannot send while offline');
  await session();
  assertVisitorScope(expected);
  const conversationId = pending.conversationId || await conversation(source);
  assertVisitorScope(expected);
  if (pending.conversationId !== conversationId) {
    pending.conversationId = conversationId;
    saveDraft(draftSource, pending);
  }
  // Before dispatch only a previous attempt can have reached the server.
  // Retain that evidence when a retry is stopped by the session check.
  init.signal?.throwIfAborted();
  updateDraftDelivery(draftSource, pending, 'unknown', pending.delivery);
  if (action) {
    const res=await scopedChatFetch('/api/portal/actions',{...init,body:JSON.stringify({conversationId,messageId,content:user.content,action,language:old.language || 'en',...(shared && {entrySurface:source})})});
    if(!res.ok){
      const error=await chatError(res);
      assertVisitorScope(expected);
      if(error.saved===false)updateDraftDelivery(draftSource,pending,'unsaved');
      throw Error(error.message);
    }
    return res;
  }
  const res = await scopedChatFetch("/api/chat", {
      ...init,
      body: JSON.stringify({
        conversationId,
        messageId,
        content: user.content,
        lang: old.language,
        stream: old.stream,
        ...(old.stream === true && {streamReply:'terminal'}),
        enrollmentContext:pending.enrollmentContext,
        ...(shared && {entrySurface:source}),
      }),
  });
  if (!res.ok) {
    const error = await chatError(res);
    assertVisitorScope(expected);
    if (error.saved === false)
      updateDraftDelivery(draftSource, pending, 'unsaved');
    if (error.saved === true)
      updateDraftDelivery(draftSource, pending, 'interrupted');
    throw Error(error.message);
  }
  return res;
}

async function readChatData(conversationId:string,signal?:AbortSignal,reference=false) {
  const deadline=AbortSignal.timeout(15000);
  return scopedJson(await checked(await scopedFetch(
    '/api/portal/conversations/'+encodeURIComponent(conversationId)+(reference?'?view=reference':''),
    {cache:"no-store", signal:signal?AbortSignal.any([signal,deadline]):deadline},
  )));
}

async function readChat(conversationId:string,signal?:AbortSignal) {
  return validateChatSnapshot(await readChatData(conversationId,signal),conversationId);
}

function validateChatSnapshot(data:any,conversationId:string) {
  // Validate the snapshot before it can migrate or reconcile any local drafts.
  const conversation = data?.conversation;
  if ((conversation?.source !== 'homepage_widget' && conversation?.source !== 'standalone_chat') ||
      (conversation.id !== undefined && conversation.id !== conversationId) ||
      !Array.isArray(data?.messages) || data.messages.some(row =>
        (row?.role !== 'user' && row?.role !== 'assistant') ||
        (row.conversation_id !== undefined && row.conversation_id !== conversationId) ||
        typeof row.request_id !== 'string' || !row.request_id || typeof row.content !== 'string' ||
        typeof row.status !== 'string' || typeof row.created_at !== 'string' || !row.created_at)) {
    throw Error('Invalid conversation snapshot');
  }
  return data;
}

function chatSnapshot(data: any, conversationId: string, draftSource: string, boundOnly: boolean, noLocalDrafts=false) {
  const answers = new Map();
  for (const row of data.messages) {
    if(row.role === "assistant" && !answers.has(row.request_id))answers.set(row.request_id,row);
  }
  const local = new Map(noLocalDrafts ? [] : drafts(draftSource).map(message=>[message.id,message]));
  const belongs = (message: { conversationId: string }) =>
    message.conversationId === conversationId || (!boundOnly && !message.conversationId);
  let changed=false;
  for (const m of data.messages) {
    const previous = local.get(m.request_id);
    if (previous && !belongs(previous)) continue;
    if (m.role === "user") {
      const answer = answers.get(m.request_id);
      if (answer && ["failed", "interrupted"].includes(answer.status)) {
        const action=answer.metadata?.followupAction || previous?.action;
        const enrollmentContext=normalizeEnrollmentChatSelection(m.metadata?.enrollmentContext) ?? previous?.enrollmentContext;
        if (previous?.conversationId===conversationId && previous.content===m.content && previous.timestamp===m.created_at &&
          previous.delivery===answer.status && previous.action===action &&
          (previous.enrollmentContext===enrollmentContext || JSON.stringify(previous.enrollmentContext)===JSON.stringify(enrollmentContext))) continue;
        local.delete(m.request_id);
        local.set(m.request_id, {
          id: m.request_id,
          content: m.content,
          conversationId,
          timestamp: m.created_at,
          delivery: answer.status,
          action,
          enrollmentContext,
        });
        changed=true;
      }
    }
    if (m.role === "assistant" && m.status === "completed" && local.delete(m.request_id))changed=true;
  }
  if(changed)writeChatDrafts(draftSource,local.values());
  const rows = data.messages.map((m: any) => {
    const candidate=m.role==='user'?local.get(m.request_id):undefined;
    const pending=candidate&&belongs(candidate)?candidate:undefined;
    const awaitingReply=m.role==='user'&&m.status==='saved'&&answers.get(m.request_id)?.status==='generating';
    return {
      ...m,
      id: m.role === "user" ? m.request_id : "reply-" + m.request_id,
      delivery: m.role === "user" ? (awaitingReply ? "saved" : pending?.delivery || "saved") : undefined,
      timestamp: new Date(m.created_at),
      action:pending?.action,
      enrollmentContext:m.role==='user' ? normalizeEnrollmentChatSelection(m.metadata?.enrollmentContext) ?? pending?.enrollmentContext : undefined,
      enrollment: m.role==='assistant'&&m.status==='completed'?readChatEnrollmentGuide(m.metadata?.enrollment):undefined,
      workspaceEntry: m.role==='assistant'&&m.status==='completed'?m.metadata?.workspaceEntry:undefined,
      suggestedPrompts: m.role==='assistant'&&m.status==='completed'&&m.metadata?.suggestedPrompts!==undefined
        ?chatFollowupPrompts(m.metadata.suggestedPrompts):undefined,
      content: m.status === "interrupted" ? "[回复中断，可重试]" : m.content,
    };
  });
  const rowIds=new Set(rows.map((row:{id:string})=>row.id));
  const messages = [
    ...rows,
    ...[...local.values()]
      .filter(m => belongs(m) && !rowIds.has(m.id))
      .map(m => ({...m, role:"user" as const, timestamp:new Date(m.timestamp)})),
  ];
  const page = data.conversation?.attribution?.page;
  return {conversationId, messages, page: typeof page === "string" ? page : undefined};
}

export async function restoreChat(source: ChatSource, threadId?: string) {
  const owner = visitorScope();
  const conversationId = threadId ?? await conversation(source);
  if (threadId !== undefined) await session();
  assertVisitorScope(owner);
  const data = await readChat(conversationId);
  if (threadId !== undefined && data.conversation?.source !== source) throw Error("Invalid conversation source");
  return chatSnapshot(data, conversationId, source, threadId !== undefined);
}

type RestoredChat = ReturnType<typeof chatSnapshot> & {source:ChatSource;restarted:boolean};
const confirmedChatHistory = new WeakMap<object,{owner:string;conversationId:string;digest:string;data:ReturnType<typeof validateChatSnapshot>;noLocalDrafts:boolean}>();

export function sameChatSnapshot(previous:RestoredChat|undefined, next:RestoredChat) {
  if (previous===next) return true;
  if (!previous || previous.conversationId!==next.conversationId) return false;
  const before=confirmedChatHistory.get(previous);
  const after=confirmedChatHistory.get(next);
  if (before&&after&&(before.owner!==after.owner||before.digest!==after.digest)) return false;
  // The server digest excludes browser drafts, which can change on their own.
  return JSON.stringify(previous)===JSON.stringify(next);
}

function migrateLegacyChatDrafts(conversationId:string) {
  const sources=['homepage_widget','standalone_chat'].map(source=>({source,rows:drafts(source)}));
  const owned=sources.flatMap(({rows})=>rows.filter(row=>row.conversationId===conversationId));
  if(!owned.length)return;
  const shared=drafts(sharedChatDrafts);
  const confirmed=new Map<string,string>();
  for(const row of shared)if(!confirmed.has(row.id))confirmed.set(row.id,row.conversationId);
  const additions=new Map<string,(typeof owned)[number]>();
  for(const row of owned)if(!confirmed.has(row.id)&&!additions.has(row.id))additions.set(row.id,row);
  // Keep the legacy row until its destination is durable.
  if(additions.size&&writeChatDrafts(sharedChatDrafts,[...shared,...additions.values()]))
    for(const row of additions.values())confirmed.set(row.id,row.conversationId);
  for(const {source,rows} of sources){
    const remaining=rows.filter(row=>row.conversationId!==conversationId||confirmed.get(row.id)!==conversationId);
    if(remaining.length!==rows.length)writeChatDrafts(source,remaining);
  }
}

export async function restoreCurrentChat(source: ChatSource, options: SharedConversationOptions & {legacyThreadId?:string;priorRestore?:RestoredChat} = {}):Promise<RestoredChat> {
  const owner = visitorScope();
  const {signal}=options;
  signal?.throwIfAborted();
  if (options.legacyThreadId !== undefined) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(options.legacyThreadId))
      throw Error("Invalid conversation reference");
    const reference=await readChatData(options.legacyThreadId,signal,true);
    // Older servers ignore the projection and return a complete snapshot.
    if(reference?.messages!==undefined)validateChatSnapshot(reference,options.legacyThreadId);
    else if(reference?.conversation?.id!==options.legacyThreadId)throw Error('Invalid conversation reference');
    if(reference.conversation?.source!=='homepage_widget')throw Error('Invalid conversation source');
  }
  signal?.throwIfAborted();
  assertVisitorScope(owner);
  const cached = options.priorRestore && confirmedChatHistory.get(options.priorRestore);
  const ownedCache = cached?.owner === owner && options.previous === undefined ? cached : undefined;
  const {conversationId,snapshot,historyDigest,historyUnchanged} = await openConversation(source, options.previous !== undefined, options,
    {includeHistory:true,historyDigest:ownedCache?.digest});
  assertVisitorScope(owner);
  signal?.throwIfAborted();
  if (typeof conversationId !== 'string' || !conversationId) throw Error('Invalid conversation reference');
  // Older servers return only the ID. An invalid snapshot must never reconcile drafts.
  if (snapshot !== undefined && snapshot?.conversation?.id !== conversationId) throw Error('Invalid conversation snapshot');
  const unchanged = historyUnchanged === true && snapshot === undefined &&
    ownedCache?.conversationId === conversationId && ownedCache.digest === historyDigest;
  if (historyUnchanged !== undefined && !unchanged) throw Error('Invalid conversation snapshot');
  const data = unchanged ? ownedCache.data : snapshot === undefined
    ? await readChat(conversationId,signal) : validateChatSnapshot(snapshot,conversationId);
  signal?.throwIfAborted();
  assertVisitorScope(owner);
  migrateLegacyChatDrafts(conversationId);
  const noLocalDrafts = typeof historyDigest==='string' && chatDraftsEmpty(sharedChatDrafts);
  if (unchanged && ownedCache.noLocalDrafts && noLocalDrafts && options.priorRestore) return options.priorRestore;
  const restored = {...chatSnapshot(data, conversationId, sharedChatDrafts, true,noLocalDrafts),
    source: (data.conversation.attribution?.chatOriginSource ?? data.conversation.source) as ChatSource,
    restarted: data.conversation.attribution?.chatRestarted === true};
  if (typeof historyDigest === 'string' && /^[a-f0-9]{64}$/.test(historyDigest))
    confirmedChatHistory.set(restored,{owner,conversationId,digest:historyDigest,data,
      noLocalDrafts:noLocalDrafts && !restored.messages.some(row=>row.role==='user' && ['failed','interrupted'].includes(row.delivery))});
  return restored;
}

export async function saveHskAttempt(
  attempt: HskAttempt,
  lang: HskLanguage,
  expectedScope = visitorScope(),
) {
  await session();
  assertVisitorScope(expectedScope);
  let result:HskResult;
  try {
    const res = await checked(
      await scopedFetch("/api/portal/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt, lang }),
        signal: AbortSignal.timeout(15000),
      }),
    );
    const data = await scopedJson(res);
    result = data.result as HskResult;
    if(result?.attempt?.attemptId!==attempt.attemptId||result.saveStatus!=='saved')throw Error('Invalid assessment receipt');
  } catch(cause) {
    assertVisitorScope(expectedScope);
    const status=(cause as {status?:number} | null)?.status;
    if(status!==undefined&&status>=400&&status<500&&status!==408)throw cause;
    // An uncertain response can hide an already saved attempt. Only read here.
    const saved=await readHskReceipt(attempt.attemptId,expectedScope).catch(()=>null);
    assertVisitorScope(expectedScope);
    if(!saved)throw cause;
    assertSameHskSubmission(saved,attempt);
    result=saved;
  }
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
  assertSameHskSubmission(saved,attempt);
  acceptHskReceipt(saved,expectedScope);
  return saved;
}

function assertSameHskSubmission(saved:HskResult,attempt:HskAttempt) {
  if(!sameHskSubmission(saved.attempt,attempt))throw Error('Attempt already submitted with different answers');
}

function acceptHskReceipt(result:HskResult,expectedScope:string) {
  assertVisitorScope(expectedScope);
  trackConfirmedReceipt(assessmentAnalyticsReceipt(result,result.attempt.attemptId));
  writeHskResult(result);
}

type HistoryRead = {controller:AbortController; response:Promise<unknown[]>; readers:number};
const historyReads=new Map<string,HistoryRead>();

async function fetchHskHistory(signal:AbortSignal):Promise<unknown[]> {
  const data = await scopedJson(await checked(await scopedFetch("/api/portal/assessments", {signal})));
  if (!Array.isArray(data.results)) throw Error("Invalid assessment history response");
  return data.results;
}

async function readHskHistoryRows(owner:string, signal?:AbortSignal) {
  let read=historyReads.get(owner);
  if (!read) {
    const controller=new AbortController();
    const response=fetchHskHistory(AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));
    read={controller,response,readers:0};
    historyReads.set(owner,read);
    const current=read;
    const clear=()=>{if(historyReads.get(owner)===current)historyReads.delete(owner);};
    void response.then(clear,clear);
  }
  read.readers++;
  let cancel:(()=>void)|undefined;
  try {
    if (!signal) return await read.response;
    const cancelled=new Promise<never>((_,reject)=>{
      cancel=()=>reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      signal.addEventListener('abort',cancel,{once:true});
    });
    return await Promise.race([read.response,cancelled]);
  } finally {
    if (cancel) signal?.removeEventListener('abort',cancel);
    if (--read.readers===0 && historyReads.get(owner)===read) {
      historyReads.delete(owner);
      read.controller.abort();
    }
  }
}

export async function restoreHskHistory(lang: HskLanguage = "en", signal?: AbortSignal) {
  await session();
  return restoreScopedHskHistory(visitorScope(), lang, signal);
}

async function restoreScopedHskHistory(expected: string, lang: HskLanguage, signal?: AbortSignal) {
  assertVisitorScope(expected);
  signal?.throwIfAborted();
  const rows=await readHskHistoryRows(expected,signal);
  assertVisitorScope(expected);
  signal?.throwIfAborted();
  return mergeHskHistoryRows(rows, lang);
}
export async function restoreVerifiedHskAttempts(owner: string, signal?: AbortSignal) {
  // The Chat boundary already verified the visitor. The history request still
  // sends the expected scope so the server can reject a changed session.
  return (await restoreScopedHskHistory(owner, 'en', signal)).results;
}

/** Idempotent system introduction. It does not fabricate a learner-authored message. */
export async function assessmentConsultation(attemptId: string, lang: "zh" | "en" | "id", threadId?: string, entrySurface?: ChatSource) {
  const conversationId = threadId ?? await conversation("standalone_chat");
  const response=await scopedChatFetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({conversationId, assessmentAttemptId: attemptId, lang, stream: true, streamReply:'terminal', entrySurface}),
  });
  if(!response.ok)throw Error((await chatError(response)).message);
  return response;
}

export async function profileConsultation(lang: "zh" | "en" | "id", threadId?: string, entrySurface?: ChatSource) {
  const conversationId = threadId ?? await conversation("standalone_chat");
  const response=await scopedChatFetch('/api/chat', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({conversationId,consultationStart:true,lang,stream:true,streamReply:'terminal',entrySurface}),
  });
  if(!response.ok)throw Error((await chatError(response)).message);
  return response;
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
  let persistedDelivery = m?.delivery;
  let acknowledged = false;
  const began=responseStarts.get(res)||Date.now();let knownFailure=false;
  try {
    const result = await readChatResponse(res, (e) => {
      assertVisitorScope(owner);
      const failed = Boolean(e.error) || e.status === 'failed';
      if(failed&&!knownFailure){knownFailure=true;trackEvent("consultation_result",{status:"failed",reason:"provider_failure",entry_point:source,response_time_ms:Date.now()-began});}
      if (e.saved === true && m) {
        if (!acknowledged) {
          acknowledged = true;
          trackReceipt("consultation_message_saved",messageId,{entry_point:source});
        }
        const delivery = failed ? 'failed' : 'saved';
        if (delivery !== persistedDelivery && updateDraftDelivery(draftSource, m, delivery)) persistedDelivery = delivery;
      }
      onProgress(e);
    });
    assertVisitorScope(owner);
    trackConfirmedReceipt(advisorAnalyticsReceipt(result,m));
    if(m&&result?.saved===true)trackReceipt("consultation_result",messageId,{entry_point:source,response_time_ms:Date.now()-began});
    if(m)removeDraft(draftSource, messageId, m.conversationId);
    return result;
  } catch (e) {
    if(!knownFailure&&visitorScope()===owner)trackEvent("consultation_result",{status:"unknown",reason:"transport",entry_point:source,response_time_ms:Date.now()-began});
    if (m && visitorScope() === owner)
      updateDraftDelivery(draftSource, m, 'interrupted', 'saved');
    throw e;
  }
}

/** Explicit shared-device person switch; server records remain intact. */
export async function startAnotherVisitor(continuationExit?: string) {
  await session();
  await checked(await scopedFetch('/api/portal/new-person', {method:'POST',signal:AbortSignal.timeout(15000)}));
  try { localStorage.removeItem(VISITOR_MARKER); } catch {}
  invalidateVisitorScope();
  if (continuationExit) location.replace(continuationExit);
  else await session();
}
