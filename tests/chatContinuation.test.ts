import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessmentConsultation, chatFetch, finishChat, restoreChat, restoreCurrentChat, chatPromotionParams} from '../src/services/portalChat';
import {draft, saveDraft, setDraftScope} from '../src/services/chatDelivery';
import {selectVisitorScope} from '../src/services/visitorScope';

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
    setDraftScope('');
  });
  selectVisitorScope(owner);
  setDraftScope(owner);
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
          metadata:{enrollment:{level:'HSK 1', period:'weekend'}}}],
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
    {conversationId:threadId, messageId:'retry', content:'试试周末班', lang:'zh', stream:true},
    {conversationId:threadId, assessmentAttemptId:'assessment-id', lang:'zh', stream:true},
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
  Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname:'/',search:'?p=unrelated'}});
  selectVisitorScope(owner);
  t.after(() => {
    globalThis.fetch = priorFetch;
    if (priorLocation) Object.defineProperty(globalThis,'location',priorLocation);
    else Reflect.deleteProperty(globalThis,'location');
    selectVisitorScope('');
    setDraftScope('');
  });

  let current = original;
  const lookups: Array<Record<string,unknown>> = [];
  const writes: Array<Record<string,unknown>> = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path === '/api/portal/session') return Response.json({cacheScope:owner});
    assert.equal(new Headers(init?.headers).get('X-Visitor-Scope'), owner);
    if (path === '/api/portal/conversations') {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.shared,true);
      lookups.push(body);
      if (body.newSession && body.previousConversationId === current) current = fresh;
      return Response.json({conversationId:current});
    }
    if (path === '/api/portal/conversations/' + current) return Response.json({conversation:{
      id:current,source:current===original?'standalone_chat':'homepage_widget',
      attribution:{page:origin,chatOriginSource:'standalone_chat',chatRestarted:current===fresh},
    },messages:[]});
    assert.equal(path,'/api/chat');
    writes.push(JSON.parse(String(init?.body)));
    return Response.json({reply:'已确认',saved:true,status:'completed'});
  };
  const widget = await restoreCurrentChat('homepage_widget');
  const standalone = await restoreCurrentChat('standalone_chat');
  assert.equal(widget.conversationId,original);
  assert.deepEqual(standalone,widget);
  assert.equal(chatPromotionParams(widget).get('p'),'paid-ig');
  await chatFetch('/api/chat',{method:'POST',body:JSON.stringify({
    messages:[{id:'in-widget',role:'user',content:'想继续看周末班'}],language:'zh',stream:true,
  })},'homepage_widget',widget.conversationId,true);
  assert.deepEqual(writes,[{conversationId:original,messageId:'in-widget',content:'想继续看周末班',lang:'zh',stream:true,entrySurface:'homepage_widget'}]);
  const restarted = await restoreCurrentChat('homepage_widget',{previous:widget.conversationId});
  assert.equal(restarted.conversationId,fresh);
  assert.equal(restarted.restarted,true);
  assert.equal(restarted.page,origin);
  assert.deepEqual(await restoreCurrentChat('standalone_chat'),restarted);
  assert.equal(lookups[2].previousConversationId,original);
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
  setDraftScope(owner);
  selectVisitorScope(owner);
  t.after(()=>{
    if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);
    else Reflect.deleteProperty(globalThis,'localStorage');
    setDraftScope('');
    selectVisitorScope('');
  });
  const pending=(id:string,conversationId=threadId)=>({id,conversationId,content:id,timestamp,delivery:'unknown' as const});
  saveDraft('homepage_widget',pending('completed-0'));
  saveDraft('homepage_widget',{...pending('retry'),enrollmentContext:{kind:'class',classId:'sample-class'}});
  saveDraft('homepage_widget',pending('unsent'));
  saveDraft('homepage_widget',pending('other-visitor-thread','other-chat'));
  const pair=(id:string,status:string)=>[
    {role:'user',request_id:id,content:id,created_at:timestamp,status:'saved'},
    {role:'assistant',request_id:id,content:'answer',created_at:timestamp,status},
  ];
  t.mock.method(globalThis,'fetch',async(input:RequestInfo)=>Response.json(input==='/api/portal/session'?{cacheScope:owner}:{
    conversation:{source:'homepage_widget'},
    messages:[...Array.from({length:500},(_,i)=>pair('completed-'+i,'completed')).flat(),...pair('retry','interrupted')],
  }));
  reads=0;writes=0;
  const restored=await restoreChat('homepage_widget',threadId);
  assert.equal(reads,1);
  assert.equal(writes,1);
  assert.equal(restored.messages.length,1003);
  assert.equal(restored.messages[0].delivery,'saved');
  assert.equal(restored.messages[1000].delivery,'interrupted');
  assert.deepEqual(restored.messages[1000].enrollmentContext,{kind:'class',classId:'sample-class'});
  assert.equal(restored.messages.at(-1)?.id,'unsent');
  assert.equal(draft('homepage_widget','other-visitor-thread')?.conversationId,'other-chat');
  assert.equal(draft('homepage_widget','completed-0'),undefined);
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
  setDraftScope(owner);
  selectVisitorScope(owner);
  t.after(()=>{
    if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);
    else Reflect.deleteProperty(globalThis,'localStorage');
    if(priorLocation)Object.defineProperty(globalThis,'location',priorLocation);
    else Reflect.deleteProperty(globalThis,'location');
    setDraftScope('');
    selectVisitorScope('');
  });
  const message={id:'restore-me',conversationId:threadId,content:'try again',timestamp:'2026-11-22T12:00:00Z',delivery:'unknown' as const};
  saveDraft('homepage_widget',message);
  t.mock.method(globalThis,'fetch',async(input:RequestInfo)=>Response.json(
    input==='/api/portal/session'?{cacheScope:owner}:input==='/api/portal/conversations'
      ?{conversationId:threadId}:{conversation:{source:'homepage_widget'},messages:[]}));
  await restoreCurrentChat('standalone_chat');
  assert.deepEqual(draft('homepage_widget',message.id),message);
  assert.equal(draft('shared_chat',message.id),undefined);
  rejectShared=false;
  const restored=await restoreCurrentChat('standalone_chat');
  assert.equal(restored.messages.length,1);
  assert.equal(restored.messages[0].id,message.id);
  assert.equal(draft('homepage_widget',message.id),undefined);
  assert.deepEqual(draft('shared_chat',message.id),message);
});
