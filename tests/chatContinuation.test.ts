import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessmentConsultation, chatFetch, finishChat, restoreChat, restoreCurrentChat, sameChatSnapshot, chatPromotionParams, sharedChatDrafts} from '../src/services/portalChat';
import {draft, removeDraft, saveDraft} from '../src/services/chatDelivery';
import {selectVisitorScope, visitorScope} from '../src/services/visitorScope';
import {pendingRegistrationDraft} from '../src/services/registrationSave';

test('shared workspace snapshots keep retry and reply fields while omitting internal message fields',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {conversationSnapshot}=await import('../server/portal/runtime');
  const {operationContext}=await import('../server/portal/operationContext');
  const conversation={id:'fixture-chat',source:'standalone_chat',attribution:{page:'/chat?p=fixture'}};
  const message={
    conversation_id:conversation.id,request_id:'fixture-request',role:'assistant',content:'Fixture reply',
    status:'interrupted',metadata:{followupAction:'booking'},created_at:'2026-11-22T12:00:00Z',
  };
  const internal={id:'fixture-message-row',sequence:42,model:'fixture-model',error:'internal fixture diagnostic'};
  const databaseRow={...message,...internal};
  await operationContext.run({query:async(sql:string,args:unknown[])=>{
    assert.deepEqual(args,[conversation.id]);
    const projection=/^SELECT (.+) FROM messages WHERE conversation_id=:p1 ORDER BY sequence$/.exec(sql)?.[1];
    assert.ok(projection);
    return {rows:[projection==='*'?databaseRow:Object.fromEntries(
      projection.split(',').map(column=>[column,Reflect.get(databaseRow,column)]),
    )]};
  }},async()=>{
    assert.deepEqual(await conversationSnapshot(conversation,'workspace'),{conversation,messages:[message]});
    assert.deepEqual(await conversationSnapshot(conversation),{conversation,messages:[databaseRow]});
  });
});

test('Chat history restores without consuming a pending learning registration',async t=>{
  const owner='c'.repeat(64),conversationId='fixture-chat';
  const key='uper_registration_pending:'+owner;
  const pending={id:'8999b957-7252-481b-84f7-63a43dabc333',submittedAt:'2026-11-22T12:00:00Z',payload:{fullName:'Fixture Learner'}};
  const storage={getItem:(name:string)=>name===key?JSON.stringify(pending):null};
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:storage}});
  selectVisitorScope(owner);
  t.after(()=>{
    selectVisitorScope('');
    if(previous)Object.defineProperty(globalThis,'window',previous);
    else Reflect.deleteProperty(globalThis,'window');
  });
  const request=t.mock.method(globalThis,'fetch',async (url:string)=>{
    assert.equal(url,'/api/portal/conversations');
    return Response.json({conversationId,snapshot:{conversation:{id:conversationId,source:'standalone_chat'},messages:[]}});
  });
  assert.equal((await restoreCurrentChat('standalone_chat',{page:'/chat?p=fixture'})).conversationId,conversationId);
  assert.equal(request.mock.callCount(),1);
  assert.deepEqual(pendingRegistrationDraft(owner,storage as Storage),pending.payload);
});

test('a legacy widget link checks the owned reference before restoring the shared consultation',async t=>{
  const owner='a'.repeat(64);
  const legacy='8999b957-7252-481b-84f7-63a43dabc222';
  const current='8999b957-7252-481b-84f7-63a43dabc333';
  selectVisitorScope(owner);
  t.after(()=>selectVisitorScope(''));
  let reference:unknown={conversation:{id:legacy,source:'homepage_widget'}};
  let denied=false;
  let opens=0;
  t.mock.method(globalThis,'fetch',async (input:string,init:RequestInit)=>{
    assert.equal(new Headers(init.headers).get('X-Visitor-Scope'),owner);
    if(input==='/api/portal/conversations/'+legacy+'?view=reference'){
      assert.equal(init.method,undefined);
      return denied?Response.json({error:'Conversation not found'},{status:404}):Response.json(reference);
    }
    assert.equal(input,'/api/portal/conversations');
    assert.equal(JSON.parse(String(init.body)).includeHistory,true);
    opens++;
    return Response.json({conversationId:current,snapshot:{conversation:{id:current,source:'standalone_chat'},messages:[]}});
  });
  const restore=()=>restoreCurrentChat('standalone_chat',{legacyThreadId:legacy,page:'/chat?p=fixture'});
  assert.equal((await restore()).conversationId,current);
  reference={conversation:{source:'homepage_widget'},messages:[]};
  assert.equal((await restore()).conversationId,current);
  reference={conversation:{id:current,source:'homepage_widget'}};
  await assert.rejects(restore,/Invalid conversation reference/);
  reference={conversation:{id:legacy,source:'standalone_chat'}};
  await assert.rejects(restore,/Invalid conversation source/);
  denied=true;
  await assert.rejects(restore,/Conversation not found/);
  assert.equal(opens,2);
});

test('Chat receipt processing writes only distinct draft states and does not create an empty draft store', async t => {
  const owner = 'a'.repeat(64);
  const key = `uper_chat_drafts:${owner}:standalone_chat`;
  const storage = new Map<string, string>();
  const writes: string[][] = [];
  let draftReads=0;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (name: string) => {
      if(name===key)draftReads++;
      return storage.get(name) ?? null;
    },
    setItem: (name: string, value: string) => {
      storage.set(name, value);
      if (name === key) writes.push(JSON.parse(value).map((row: { delivery: string }) => row.delivery));
    },
  } });
  t.after(() => {
    selectVisitorScope('');
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  selectVisitorScope(owner);
  const stream = (frames: object[]) => new Response(frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join(''),
    { headers: { 'content-type': 'text/event-stream' } });
  const finish = (id: string, ...frames: object[]) => finishChat(stream(frames), 'standalone_chat', id, () => {});
  const pending = { id: 'fixture', content: 'A question', timestamp: '2026-11-22T12:00:00Z',
    conversationId: 'fixture-chat', delivery: 'unknown' as const };
  const ack = { saved: true };
  const success = { ...ack, done: true, reply: 'Reply', status: 'completed' };

  await finish('automatic', ack, success);
  assert.deepEqual(writes, []);
  saveDraft('standalone_chat', pending);
  writes.length = 0;
  await finish(pending.id, ack, ack, success);
  assert.deepEqual(writes, [['saved'], []]);
  saveDraft('standalone_chat', pending);
  writes.length = 0;
  draftReads = 0;
  await assert.rejects(finish(pending.id, ack, ack, { chunk: 'Partial reply' }), /Reply incomplete/);
  assert.deepEqual(writes, [['saved'], ['interrupted']]);
  assert.equal(draftReads,3);

  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const delayedStream = new ReadableStream<Uint8Array>({ start(stream) { controller = stream; } });
  const delayed = finishChat(new Response(delayedStream, { headers: { 'content-type': 'text/event-stream' } }),
    'standalone_chat', pending.id, () => {});
  const failure = assert.rejects(delayed, /Reply incomplete/);
  removeDraft('standalone_chat', pending.id, pending.conversationId);
  writes.length = 0;
  controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ ...ack, done: true, status: 'failed' }) + '\n\n'));
  controller.close();
  await failure;
  assert.deepEqual(writes, []);
  assert.equal(draft('standalone_chat', pending.id), undefined);

  saveDraft('standalone_chat', pending);
  const oldReply = finish(pending.id, success);
  saveDraft('standalone_chat', { ...pending, conversationId: 'another-chat' });
  writes.length = 0;
  await oldReply;
  assert.deepEqual(writes, []);
  assert.equal(draft('standalone_chat', pending.id)?.conversationId, 'another-chat');
});

test('a restored message with a confirmed generating reply waits while unanswered drafts remain retryable',async t=>{
  const owner='a'.repeat(64), conversationId='fixture-chat';
  const key=`uper_chat_drafts:${owner}:${sharedChatDrafts}`;
  const timestamp='2026-11-22T12:00:00Z';
  const waiting={id:'waiting',conversationId,content:'Waiting question',timestamp,delivery:'unknown' as const};
  const missing={...waiting,id:'missing',content:'Another question'};
  const storage=new Map([[key,JSON.stringify([waiting,missing])]]);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(name:string)=>storage.get(name)??null,
    setItem:(name:string,value:string)=>storage.set(name,value),
  }});
  selectVisitorScope(owner);
  t.after(()=>{
    selectVisitorScope('');
    if(previous)Object.defineProperty(globalThis,'localStorage',previous);
    else Reflect.deleteProperty(globalThis,'localStorage');
  });
  let status='generating';
  t.mock.method(globalThis,'fetch',async()=>Response.json({conversationId,snapshot:{
    conversation:{id:conversationId,source:'standalone_chat'},
    messages:[
      {role:'user',request_id:waiting.id,content:waiting.content,status:'saved',created_at:timestamp},
      {role:'assistant',request_id:waiting.id,content:status==='completed'?'Answer':'',status,created_at:timestamp},
    ],
  }}));
  const restore=()=>restoreCurrentChat('standalone_chat',{page:'/chat'});
  const state=async()=>new Map((await restore()).messages.filter(row=>row.role==='user').map(row=>[row.id,row.delivery]));
  assert.deepEqual(await state(),new Map([['waiting','saved'],['missing','unknown']]));
  assert.equal(draft(sharedChatDrafts,waiting.id)?.delivery,'unknown');
  status='failed';
  assert.deepEqual(await state(),new Map([['waiting','failed'],['missing','unknown']]));
  status='completed';
  assert.deepEqual(await state(),new Map([['waiting','saved'],['missing','unknown']]));
  assert.equal(draft(sharedChatDrafts,waiting.id),undefined);
});

test('an invalid Chat history response cannot clear or migrate pending drafts', async t => {
  const owner = 'a'.repeat(64), conversationId = 'fixture-chat';
  const timestamp = '2026-11-22T12:00:00Z';
  const storage = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } });
  t.after(() => {
    selectVisitorScope('');
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  selectVisitorScope(owner);
  saveDraft(sharedChatDrafts, { id: 'pending', conversationId, content: 'Needs recovery', timestamp, delivery: 'unknown' });
  saveDraft('standalone_chat', { id: 'legacy', conversationId, content: 'Legacy draft', timestamp, delivery: 'unknown' });
  const valid = { conversation: { id: conversationId, source: 'standalone_chat' }, messages: [
    { role: 'assistant', request_id: 'pending', content: 'Confirmed', status: 'completed', created_at: timestamp },
  ] };
  let snapshot: unknown;
  t.mock.method(globalThis, 'fetch', async input => Response.json(input === '/api/portal/session' ? { cacheScope: owner }
    : input === '/api/portal/conversations' ? { conversationId } : snapshot));
  const restore = () => restoreCurrentChat('standalone_chat', { page: '/chat' });
  const original = [...storage];
  for (const invalid of [{ ...valid, conversation: null },
    { ...valid, conversation: { ...valid.conversation, id: 'other-chat' } },
    { ...valid, messages: [...valid.messages, { ...valid.messages[0], content: { invalid: true } }] }]) {
    snapshot = invalid;
    await assert.rejects(restore(), /Invalid conversation snapshot/);
    assert.deepEqual([...storage].filter(([key]) => key.includes('uper_chat_drafts:')), original);
  }
  snapshot = valid;
  assert.deepEqual((await restore()).messages.map(row => row.id), ['reply-pending', 'legacy']);
  assert.equal(draft(sharedChatDrafts, 'pending'), undefined);
  assert.equal(draft('standalone_chat', 'legacy'), undefined);
  assert.equal(draft(sharedChatDrafts, 'legacy')?.content, 'Legacy draft');
});

test('a send is recoverable before the session check and cannot post after the visitor changes', async t => {
  const owner = 'a'.repeat(64), another = 'b'.repeat(64);
  const conversationId = 'fixture-chat', messageId = 'pending-check';
  const enrollmentContext = { kind: 'class', classId: 'sample-class' };
  const storage = new Map<string, string>();
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } });
  t.after(() => {
    selectVisitorScope('');
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  selectVisitorScope(owner);
  let release!: (response: Response) => void;
  const pendingSession = new Promise<Response>(resolve => { release = resolve; });
  const postBodies: unknown[] = [];
  let postError=false;
  let session = pendingSession;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    if (input === '/api/portal/session') return session;
    assert.equal(input, '/api/chat');
    assert.equal(new Headers(init?.headers).get('X-Visitor-Scope'), owner);
    if(postError)throw new TypeError('Connection lost after dispatch');
    postBodies.push(JSON.parse(String(init?.body)));
    return Response.json({ saved: true, reply: '已确认' });
  });
  const send = (selection?: typeof enrollmentContext) => chatFetch('/api/chat', {
    method: 'POST', body: JSON.stringify({ language: 'zh', messages: [{ id: messageId, role: 'user', content: '比较这个班次' }],
      enrollmentContext: selection }),
  }, 'standalone_chat', conversationId, true);

  const original = send(enrollmentContext);
  assert.equal(draft(sharedChatDrafts, messageId)?.conversationId, conversationId);
  assert.deepEqual(draft(sharedChatDrafts, messageId)?.enrollmentContext, enrollmentContext);
  assert.equal(draft(sharedChatDrafts, messageId)?.delivery,'unsaved');
  release(Response.json({ cacheScope: another }));
  await assert.rejects(original, /Visitor changed/);
  assert.equal(draft(sharedChatDrafts, messageId), undefined);
  assert.deepEqual(postBodies, []);

  selectVisitorScope(owner);
  session=Promise.resolve(new Response(null,{status:503}));
  await assert.rejects(send(),/Visitor identity is unavailable/);
  assert.equal(draft(sharedChatDrafts, messageId)?.delivery,'unsaved');
  assert.deepEqual(postBodies,[]);

  const navigatorBefore=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  try {
    await assert.rejects(send(),/offline/);
    assert.equal(draft(sharedChatDrafts,messageId)?.delivery,'unsaved');
    assert.deepEqual(postBodies,[]);
  } finally {
    if(navigatorBefore)Object.defineProperty(globalThis,'navigator',navigatorBefore);
    else Reflect.deleteProperty(globalThis,'navigator');
  }

  session = Promise.resolve(Response.json({ cacheScope: owner }));
  postError=true;
  await assert.rejects(send(),/Connection lost after dispatch/);
  assert.equal(draft(sharedChatDrafts,messageId)?.delivery,'unknown');
  session=Promise.resolve(new Response(null,{status:503}));
  await assert.rejects(send(),/Visitor identity is unavailable/);
  assert.equal(draft(sharedChatDrafts,messageId)?.delivery,'unknown');

  session=Promise.resolve(Response.json({cacheScope:owner}));
  postError=false;
  assert.equal(draft(sharedChatDrafts, messageId)?.content, '比较这个班次');
  const response = await send();
  await finishChat(response, 'standalone_chat', messageId, () => {});
  assert.deepEqual(postBodies, [{ conversationId, messageId, content: '比较这个班次', lang: 'zh',
    enrollmentContext, entrySurface: 'standalone_chat' }]);
  assert.equal(draft(sharedChatDrafts, messageId), undefined);
});

test('Widget continuation restores one owned thread and routes retries and assessment to it', async t => {
  const owner = 'a'.repeat(64);
  const threadId = '8999b957-7252-481b-84f7-63a43dabc222';
  const otherThread = '8999b957-7252-481b-84f7-63a43dabc333';
  const page = '/?p=fixture-promotion&utm_campaign=fixture';
  const timestamp = new Date().toISOString();
  const storage = new Map<string, string>();
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const priorFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  t.after(() => {
    globalThis.fetch = priorFetch;
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    selectVisitorScope('');
  });
  selectVisitorScope(owner);
  saveDraft('homepage_widget', {id:'retry', conversationId:threadId, content:'试试周末班', timestamp, delivery:'unknown'});
  saveDraft('homepage_widget', {id:'other', conversationId:otherThread, content:'其他会话草稿', timestamp, delivery:'unknown'});

  const posts: unknown[] = [];
  let denial: 'owner'|'source'|undefined;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path === '/api/portal/session') return Response.json({cacheScope:owner});
    assert.equal(new Headers(init?.headers).get('X-Visitor-Scope'), owner);
    if (path === '/api/portal/conversations/' + threadId) {
      assert.equal(init?.method, undefined);
      if (denial === 'owner') return Response.json({error:'Conversation not found'}, {status:404});
      return Response.json({
        conversation: {source:denial === 'source' ? 'standalone_chat' : 'homepage_widget', attribution:{page}},
        messages: [{role:'assistant', request_id:'prior', content:'HSK 1 周末班', status:'completed', created_at:timestamp,
          metadata:{enrollment:{level:'HSK 1', period:'weekend'},suggestedPrompts:[null,'周末几点上课？']}}],
      });
    }
    assert.equal(path, '/api/chat');
    posts.push(JSON.parse(String(init?.body)));
    return Response.json({reply:'已确认', saved:true, status:'completed'});
  };

  const restored = await restoreChat('homepage_widget', threadId);
  assert.equal(restored.page, page);
  assert.deepEqual(restored.messages.map(message => message.id), ['reply-prior', 'retry']);
  assert.equal(restored.messages[0].enrollment?.period, 'weekend');
  assert.deepEqual(restored.messages[0].suggestedPrompts,['周末几点上课？']);
  assert.equal(posts.length, 0);

  const send = (id: string) => chatFetch('/api/chat', {method:'POST', body:JSON.stringify({
    messages:[{id, role:'user', content:'试试周末班'}], language:'zh', stream:true,
  })}, 'homepage_widget', threadId);
  const response = await send('retry');
  await finishChat(response, 'homepage_widget', 'retry', () => {});
  assert.equal(draft('homepage_widget', 'retry'), undefined);
  await assert.rejects(send('other'), /another conversation/);
  await assessmentConsultation('assessment-id', 'zh', threadId);
  assert.deepEqual(posts, [
    {conversationId:threadId, messageId:'retry', content:'试试周末班', lang:'zh', stream:true, streamReply:'terminal'},
    {conversationId:threadId, assessmentAttemptId:'assessment-id', lang:'zh', stream:true, streamReply:'terminal'},
  ]);

  denial = 'owner';
  await assert.rejects(restoreChat('homepage_widget', threadId), /not found/);
  denial = 'source';
  await assert.rejects(restoreChat('homepage_widget', threadId), /Invalid conversation source/);
  assert.equal(posts.length, 2);
});

test('Shared entry points restore the same conversation and retain the original promotion through reset', async t => {
  const owner = 'a'.repeat(64);
  const original = '8999b957-7252-481b-84f7-63a43dabc222';
  const fresh = '8999b957-7252-481b-84f7-63a43dabc333';
  const origin = '/chat?lang=zh&p=paid-ig&utm_campaign=original';
  const priorFetch = globalThis.fetch;
  const priorLocation = Object.getOwnPropertyDescriptor(globalThis,'location');
  const priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const storage=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>storage.get(key)??null,
    setItem:(key:string,value:string)=>storage.set(key,value),
  }});
  Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname:'/',search:'?p=unrelated'}});
  selectVisitorScope(owner);
  t.after(() => {
    globalThis.fetch = priorFetch;
    if (priorLocation) Object.defineProperty(globalThis,'location',priorLocation);
    else Reflect.deleteProperty(globalThis,'location');
    if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);
    else Reflect.deleteProperty(globalThis,'localStorage');
    selectVisitorScope('');
  });

  let current = original;
  let corruptSnapshot = false;
  let returnUnchanged = false;
  let activeOwner = owner;
  const historyDigest = 'c'.repeat(64);
  let responseDigest=historyDigest;
  let historyRows:unknown[]=[];
  const lookups: Array<Record<string,unknown>> = [];
  const writes: Array<Record<string,unknown>> = [];
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(path);
    if (path === '/api/portal/session') return Response.json({cacheScope:activeOwner});
    if (new Headers(init?.headers).get('X-Visitor-Scope') !== activeOwner)
      return Response.json({error:'Visitor identity changed'},{status:409});
    if (path === '/api/portal/conversations') {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.shared,true);
      assert.equal(body.includeHistory,true);
      lookups.push(body);
      if (body.newSession && body.previousConversationId === current) current = fresh;
      if(returnUnchanged)return Response.json({conversationId:current,historyDigest,historyUnchanged:true});
      return Response.json({conversationId:current,historyDigest:responseDigest,snapshot:{conversation:{
        id:corruptSnapshot?original:current,source:current===original?'standalone_chat':'homepage_widget',
        attribution:{page:origin,chatOriginSource:'standalone_chat',chatRestarted:current===fresh},
      },messages:historyRows}});
    }
    assert.equal(path,'/api/chat');
    writes.push(JSON.parse(String(init?.body)));
    return Response.json({reply:'已确认',saved:true,status:'completed'});
  };
  const widget = await restoreCurrentChat('homepage_widget');
  const standalone = await restoreCurrentChat('standalone_chat');
  assert.deepEqual(requests,['/api/portal/conversations','/api/portal/conversations']);
  assert.equal(widget.conversationId,original);
  assert.deepEqual(standalone,widget);
  assert.equal(sameChatSnapshot(standalone,widget),true);
  assert.equal(chatPromotionParams(widget).get('p'),'paid-ig');
  const widgetReply=await chatFetch('/api/chat',{method:'POST',body:JSON.stringify({
    messages:[{id:'in-widget',role:'user',content:'想继续看周末班'}],language:'zh',stream:true,
  })},'homepage_widget',widget.conversationId,true);
  await finishChat(widgetReply,'homepage_widget','in-widget',()=>{});
  assert.deepEqual(writes,[{conversationId:original,messageId:'in-widget',content:'想继续看周末班',lang:'zh',stream:true,streamReply:'terminal',entrySurface:'homepage_widget'}]);
  const restarted = await restoreCurrentChat('homepage_widget',{previous:widget.conversationId});
  assert.deepEqual(requests.slice(-2),['/api/portal/session','/api/portal/conversations']);
  assert.equal(restarted.conversationId,fresh);
  assert.equal(restarted.restarted,true);
  assert.equal(restarted.page,origin);
  assert.deepEqual(await restoreCurrentChat('standalone_chat'),restarted);
  assert.equal(lookups[2].previousConversationId,original);
  assert.equal(lookups[2].historyDigest,undefined);
  corruptSnapshot = true;
  await assert.rejects(restoreCurrentChat('standalone_chat'),/Invalid conversation snapshot/);
  returnUnchanged = true;
  assert.equal(await restoreCurrentChat('standalone_chat',{priorRestore:restarted}),restarted);
  assert.equal(lookups.at(-1)?.historyDigest,historyDigest);
  saveDraft('homepage_widget',{id:'legacy-local',conversationId:fresh,timestamp:'2026-11-22',content:'unsent',delivery:'unknown'});
  const withDraft=await restoreCurrentChat('standalone_chat',{priorRestore:restarted});
  assert.notEqual(withDraft,restarted);
  assert.equal(sameChatSnapshot(withDraft,restarted),false);
  assert.deepEqual(withDraft.messages.map(row=>row.id),['legacy-local']);
  removeDraft(sharedChatDrafts,'legacy-local',fresh);
  const withoutDraft=await restoreCurrentChat('standalone_chat',{priorRestore:withDraft});
  assert.notEqual(withoutDraft,withDraft);
  assert.deepEqual(withoutDraft.messages,[]);
  assert.equal(await restoreCurrentChat('standalone_chat',{priorRestore:withoutDraft}),withoutDraft);
  returnUnchanged=false;
  corruptSnapshot=false;
  responseDigest='d'.repeat(64);
  historyRows=[{role:'assistant',request_id:'reply-new',content:'New reply',status:'completed',created_at:'2026-11-22T12:00:00Z'}];
  const changed=await restoreCurrentChat('standalone_chat',{priorRestore:withoutDraft});
  assert.equal(changed.messages[0].content,'New reply');
  {
    const stringify=JSON.stringify;
    let serializedSnapshots=0;
    const serialization=t.mock.method(JSON,'stringify',(...args:Parameters<typeof JSON.stringify>)=>{
      if(args[0]===withoutDraft||args[0]===changed)serializedSnapshots++;
      return stringify(...args);
    });
    try {
      assert.equal(sameChatSnapshot(withoutDraft,changed),false);
      assert.equal(serializedSnapshots,0);
    } finally { serialization.mock.restore(); }
  }
  returnUnchanged=true;
  await assert.rejects(restoreCurrentChat('standalone_chat',{priorRestore:widget}),/Invalid conversation snapshot/);
  activeOwner='b'.repeat(64);
  const lookupCount=lookups.length;
  await assert.rejects(restoreCurrentChat('standalone_chat',{priorRestore:restarted}),/Visitor changed/);
  assert.equal(visitorScope(),'');
  assert.equal(lookups.length,lookupCount);
  selectVisitorScope(activeOwner);
  await assert.rejects(restoreCurrentChat('standalone_chat',{priorRestore:restarted}),/Invalid conversation snapshot/);
  assert.equal(lookups.at(-1)?.historyDigest,undefined);
});

test('Long history reconciles retry drafts in one storage write and preserves ownership',async t=>{
  const owner='a'.repeat(64), threadId='fixture-chat', timestamp='2026-11-22T12:00:00Z';
  const storage=new Map<string,string>();
  const priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  let reads=0,writes=0;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem(key:string){if(key.includes("uper_chat_drafts:"))reads++;return storage.get(key)??null;},
    setItem(key:string,value:string){if(key.includes("uper_chat_drafts:"))writes++;storage.set(key,value);},
  }});
  selectVisitorScope(owner);
  t.after(()=>{
    if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);
    else Reflect.deleteProperty(globalThis,'localStorage');
    selectVisitorScope('');
  });
  const pending=(id:string,conversationId=threadId)=>({id,conversationId,content:id,timestamp,delivery:'unknown' as const});
  saveDraft('homepage_widget',pending('completed-0'));
  saveDraft('homepage_widget',{...pending('retry'),enrollmentContext:{kind:'class',classId:'sample-class'}});
  saveDraft('homepage_widget',pending('unsent'));
  saveDraft('homepage_widget',pending('other-visitor-thread','other-chat'));
  saveDraft('homepage_widget',pending('foreign-completed','other-chat'));
  saveDraft('homepage_widget',{...pending('foreign-failed','other-chat'),delivery:'unknown',action:'booking'});
  let retryStatus='interrupted';
  let retryMetadata: {enrollmentContext:{kind:'class';classId:string}} | undefined;
  const pair=(id:string,status:string,metadata?:typeof retryMetadata)=>[
    {role:'user',request_id:id,content:id,created_at:timestamp,status:'saved',metadata},
    {role:'assistant',request_id:id,content:'answer',created_at:timestamp,status},
  ];
  t.mock.method(globalThis,'fetch',async(input:RequestInfo)=>Response.json(input==='/api/portal/session'?{cacheScope:owner}:{
    conversation:{source:'homepage_widget'},
    messages:[...Array.from({length:500},(_,i)=>pair('completed-'+i,'completed')).flat(),...pair('retry',retryStatus,retryMetadata),
      ...pair('foreign-completed','completed'),...pair('foreign-failed','failed')],
  }));
  reads=0;writes=0;
  const restored=await restoreChat('homepage_widget',threadId);
  assert.equal(reads,1);
  assert.equal(writes,1);
  assert.equal(restored.messages.length,1007);
  assert.equal(restored.messages[0].delivery,'saved');
  assert.equal(restored.messages[1000].delivery,'interrupted');
  assert.deepEqual(restored.messages[1000].enrollmentContext,{kind:'class',classId:'sample-class'});
  assert.equal(restored.messages.at(-1)?.id,'unsent');
  assert.equal(draft('homepage_widget','other-visitor-thread')?.conversationId,'other-chat');
  assert.equal(draft('homepage_widget','foreign-completed')?.conversationId,'other-chat');
  assert.equal(draft('homepage_widget','foreign-failed')?.conversationId,'other-chat');
  assert.equal(restored.messages.find(row=>row.id==='foreign-failed')?.action,undefined);
  assert.equal(draft('homepage_widget','completed-0'),undefined);
  reads=0;writes=0;
  assert.deepEqual(await restoreChat('homepage_widget',threadId),restored);
  assert.equal(reads,1);
  assert.equal(writes,0);
  retryMetadata={enrollmentContext:{kind:'class',classId:'new-class'}};
  await restoreChat('homepage_widget',threadId);
  assert.equal(writes,1);
  assert.deepEqual(draft('homepage_widget','retry')?.enrollmentContext,{kind:'class',classId:'new-class'});
  await restoreChat('homepage_widget',threadId);
  assert.equal(writes,1);
  retryStatus='completed';
  await restoreChat('homepage_widget',threadId);
  assert.equal(writes,2);
  assert.equal(draft('homepage_widget','retry'),undefined);
});

test('shared Chat migrates each legacy store in one write and retains drafts for other conversations',async t=>{
  const owner='b'.repeat(64), conversationId='fixture-chat';
  const key=(source:string)=>`uper_chat_drafts:${owner}:${source}`;
  const row=(id:string,conversation=conversationId)=>({
    id,conversationId:conversation,content:id,timestamp:'2026-11-22T12:00:00Z',delivery:'unknown',
  });
  const original=row('duplicate');
  const foreign=row('collision','another-chat');
  const collision=row('collision');
  const widget=Array.from({length:8},(_,index)=>row('widget-'+index));
  const page=Array.from({length:8},(_,index)=>row('page-'+index));
  const storage=new Map([
    [key('homepage_widget'),JSON.stringify([...widget,original,collision])],
    [key('standalone_chat'),JSON.stringify([...page,{...original,content:'duplicate from page'}])],
    [key(sharedChatDrafts),JSON.stringify([foreign])],
  ]);
  const writes:string[]=[];
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(name:string)=>storage.get(name)??null,
    setItem:(name:string,value:string)=>{writes.push(name);storage.set(name,value);},
  }});
  selectVisitorScope(owner);
  t.after(()=>{
    selectVisitorScope('');
    if(previous)Object.defineProperty(globalThis,'localStorage',previous);
    else Reflect.deleteProperty(globalThis,'localStorage');
  });
  t.mock.method(globalThis,'fetch',async()=>Response.json({conversationId,snapshot:{
    conversation:{id:conversationId,source:'standalone_chat'},messages:[],
  }}));
  const restore=()=>restoreCurrentChat('standalone_chat',{page:'/chat'});
  const restored=await restore();
  assert.equal(restored.messages.length,17);
  assert.equal(restored.messages.find(message=>message.id==='duplicate')?.content,original.content);
  assert.deepEqual(writes,[key(sharedChatDrafts),key('homepage_widget'),key('standalone_chat')]);
  assert.deepEqual(draft(sharedChatDrafts,'collision'),foreign);
  assert.deepEqual(draft('homepage_widget','collision'),collision);
  assert.deepEqual(await restore(),restored);
  assert.equal(writes.length,3);
});

test('legacy drafts remain recoverable when shared storage rejects migration',async t=>{
  const owner='a'.repeat(64), threadId='fixture-chat';
  const storage=new Map<string,string>();
  let rejectShared=true;
  const priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const priorLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname:'/chat',search:''}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>storage.get(key)??null,
    setItem(key:string,value:string){
      if(rejectShared&&key.endsWith(':shared_chat'))throw new Error('Storage quota exceeded');
      storage.set(key,value);
    },
  }});
  selectVisitorScope(owner);
  t.after(()=>{
    if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);
    else Reflect.deleteProperty(globalThis,'localStorage');
    if(priorLocation)Object.defineProperty(globalThis,'location',priorLocation);
    else Reflect.deleteProperty(globalThis,'location');
    selectVisitorScope('');
  });
  const message={id:'restore-me',conversationId:threadId,content:'try again',timestamp:'2026-11-22T12:00:00Z',delivery:'unknown' as const};
  saveDraft('homepage_widget',message);
  const collision={...message,id:'shared-collision'};
  const other={...collision,conversationId:'other-chat'};
  saveDraft('homepage_widget',collision);
  // Simulate a draft already stored by a different chat before the migration runs.
  storage.set('uper_chat_drafts:'+owner+':shared_chat',JSON.stringify([other]));
  t.mock.method(globalThis,'fetch',async(input:RequestInfo)=>Response.json(
    input==='/api/portal/session'?{cacheScope:owner}:input==='/api/portal/conversations'
      ?{conversationId:threadId}:{conversation:{source:'homepage_widget'},messages:[]}));
  await restoreCurrentChat('standalone_chat');
  assert.deepEqual(draft('homepage_widget',message.id),message);
  assert.equal(draft('shared_chat',message.id),undefined);
  rejectShared=false;
  const controller=new AbortController();
  const fetcher=globalThis.fetch;
  t.mock.method(globalThis,'fetch',async(input:RequestInfo,init?:RequestInit)=>{
    const response=await fetcher(input,init);
    if(input==='/api/portal/conversations/'+threadId&&!controller.signal.aborted){
      assert.ok(init?.signal);
      controller.abort();
      assert.equal(init.signal.aborted,true);
    }
    return response;
  });
  await assert.rejects(restoreCurrentChat('standalone_chat',{signal:controller.signal}),{name:'AbortError'});
  assert.deepEqual(draft('homepage_widget',message.id),message);
  assert.equal(draft('shared_chat',message.id),undefined);
  const restored=await restoreCurrentChat('standalone_chat');
  assert.equal(restored.messages.length,1);
  assert.equal(restored.messages[0].id,message.id);
  assert.equal(draft('homepage_widget',message.id),undefined);
  assert.deepEqual(draft('shared_chat',message.id),message);
  assert.deepEqual(draft('homepage_widget',collision.id),collision);
  assert.deepEqual(draft('shared_chat',collision.id),other);
});
