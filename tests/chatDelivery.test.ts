import {test} from 'node:test';import assert from 'node:assert/strict';
import {readChatResponse,saveDraft,drafts,removeDraft,waitForChatResponse} from '../src/services/chatDelivery';
import {selectVisitorScope} from '../src/services/visitorScope';
import {readChatInputDraft,writeChatInputDraft} from '../src/hooks/useChatInputDraft';
import {plainChatParagraphs} from '../src/utils/chatPlainReply';

test('plain paragraphs skip Markdown while links, numbered lists and hard breaks retain formatting',()=>{
  for(const prose of ['这是适合你的 HSK 1 班次。','The class meets at 7 p.m.','Kelasnya mulai pukul 19.00.']) {
    assert.deepEqual(plainChatParagraphs(prose),[prose]);
  }
  assert.deepEqual(plainChatParagraphs('先看课程。\n\n再选合适的班次。\n\n\n可以在线学习。'),
    ['先看课程。','再选合适的班次。','可以在线学习。']);
  for(const markup of ['**HSK 1**','1. HSK 1','1.','www.example.com','learner@example.com','https://example.com',
    'HSK\n1','> HSK','- HSK','  HSK','[HSK](/enrollment)','&copy;','<b>HSK</b>','`HSK`','',
    '先看课程。\n\n1. 选班','先看课程。\n\nwww.example.com','第一段。  \n第二行。','第一段。\n\n    代码']) {
    assert.equal(plainChatParagraphs(markup),undefined,markup);
  }
});

test('composer writes and conditional clears remain scoped to the active visitor and conversation', t => {
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key),setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};
  const window=new EventTarget();
  for(const [key,value] of [['localStorage',storage],['window',window]] as const){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  t.after(()=>selectVisitorScope(''));
  selectVisitorScope('visitor-a');
  writeChatInputDraft('visitor-a','chat-a','initial');
  writeChatInputDraft('visitor-a','chat-a','newer input');
  writeChatInputDraft('visitor-a','chat-a','','initial');
  assert.equal(readChatInputDraft('visitor-a','chat-a'),'newer input');
  assert.equal(readChatInputDraft('visitor-a','chat-b'),'');
  selectVisitorScope('visitor-b');
  assert.equal(readChatInputDraft('visitor-a','chat-a'),'');
  writeChatInputDraft('visitor-a','chat-a','stale write');
  selectVisitorScope('visitor-a');
  assert.equal(readChatInputDraft('visitor-a','chat-a'),'newer input');
  writeChatInputDraft('visitor-a','chat-a','','newer input');
  assert.equal(readChatInputDraft('visitor-a','chat-a'),'');
});

test('a readable but unwritable Chat draft keeps current input and conditional clears in memory', t => {
  const values = new Map<string,string>();
  let writable = true;
  const write = (update:()=>void) => {
    if(!writable) throw new DOMException('Storage is full','QuotaExceededError');
    update();
  };
  const storage = {
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>write(()=>values.set(key,value)),
    removeItem:(key:string)=>write(()=>values.delete(key)),
  };
  for(const [key,value] of [['localStorage',storage],['window',new EventTarget()]] as const){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  t.after(()=>selectVisitorScope(''));
  const owner='quota-fixture';
  selectVisitorScope(owner);
  writeChatInputDraft(owner,'chat-a','Older saved text');
  writable=false;
  writeChatInputDraft(owner,'chat-a','Which classes run on Sunday?');
  assert.equal(readChatInputDraft(owner,'chat-a'),'Which classes run on Sunday?');
  writeChatInputDraft(owner,'chat-a','','Older saved text');
  assert.equal(readChatInputDraft(owner,'chat-a'),'Which classes run on Sunday?');
  assert.equal(readChatInputDraft(owner,'chat-b'),'');
  selectVisitorScope('another-visitor');
  assert.equal(readChatInputDraft(owner,'chat-a'),'');
  selectVisitorScope(owner);
  writeChatInputDraft(owner,'chat-a','','Which classes run on Sunday?');
  assert.equal(readChatInputDraft(owner,'chat-a'),'');
  writable=true;
  writeChatInputDraft(owner,'chat-a','Persisted again');
  assert.equal(readChatInputDraft(owner,'chat-a'),'Persisted again');
  writeChatInputDraft(owner,'chat-a','');
});

test('one corrupt stored row does not prevent valid Chat drafts from being recovered', t => {
  const owner = 'fixture-owner';
  const valid = { id: 'valid', conversationId: 'chat-a', content: 'Try again', timestamp: '2026-11-22', delivery: 'unknown' };
  const storage = { getItem: () => JSON.stringify([null, { id: 'incomplete' }, valid]) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  selectVisitorScope(owner);
  t.after(() => {
    selectVisitorScope('');
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  assert.deepEqual(drafts('shared_chat'), [valid]);
});
test('stream ending without persisted completion is rejected; resets replace partial reply',async()=>{
 const stream=(events:any[])=>new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
 await assert.rejects(readChatResponse(stream([{saved:true},{chunk:'PARTIAL'}]),()=>{}));
 let text='';const result=await readChatResponse(stream([{saved:true},{chunk:'PARTIAL'},{reset:true},{chunk:'Final'},{done:true,saved:true,reply:'Final'}]),e=>{if(e.reset)text='';if(e.chunk)text+=e.chunk;});assert.equal(text,result.reply);
 await assert.rejects(readChatResponse(Response.json({saved:true,status:'failed',error:'all_providers_failed'}),()=>{}));
});
test('Chat completion requires an explicit saved flag and a reply on both transports', async () => {
  const eventStream = (frame: object) => new Response('data: ' + JSON.stringify(frame) + '\n\n', {
    headers: { 'content-type': 'text/event-stream' },
  });
  for (const frame of [{ reply: 'Unconfirmed' }, { saved: 'true', reply: 'Unconfirmed' }, { saved: true },
    { saved: true, reply: 'Partial', status: 'interrupted' }, { saved: true, reply: 'Partial', status: 'generating' }]) {
    await assert.rejects(readChatResponse(Response.json(frame), () => {}), /Reply incomplete/);
    await assert.rejects(readChatResponse(eventStream({ ...frame, done: true }), () => {}), /Reply incomplete/);
  }
  await assert.rejects(readChatResponse(eventStream({ done: 'true', saved: true, reply: 'Unconfirmed' }), () => {}), /Reply incomplete/);
});
test('invalid Chat frame fields never reach UI or receipt handlers', async () => {
  for (const frame of [null, [], { reply: { text: 'not a reply string' } }, { chunk: 3 }, { reset: 'false' },
    { saved: 'true' }, { done: 1 }]) {
    const progress: unknown[] = [];
    const record = (event: unknown) => progress.push(event);
    await assert.rejects(readChatResponse(Response.json(frame), record), /Reply incomplete/);
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(frame) + '\n\n')); },
      cancel() { canceled = true; },
    });
    await assert.rejects(readChatResponse(new Response(body, { headers: { 'content-type': 'text/event-stream' } }), record),
      /Reply incomplete/);
    assert.deepEqual(progress, []);
    assert.equal(canceled, true);
  }
});
test('a terminal reply settles and releases an open stream without waiting for EOF',{timeout:1000},async()=>{
 const events=[{saved:true},{chunk:'最终答复'},{done:true,saved:true,reply:'最终答复',status:'completed'}];
 let canceled=false;
 const body=new ReadableStream<Uint8Array>({
   start(controller){controller.enqueue(new TextEncoder().encode(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join('')));},
   cancel(){canceled=true;},
 });
 const received:unknown[]=[];
 const result=await readChatResponse(new Response(body,{headers:{'content-type':'text/event-stream'}}),event=>received.push(event));
 assert.equal(result.reply,'最终答复');
 assert.deepEqual(received,events);
 assert.equal(canceled,true);
});
test('a stalled reply cancels the stream without confirming completion',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let canceled=false;
 let acknowledge!:()=>void;
 const firstFrame=new Promise<void>(resolve=>{acknowledge=resolve;});
 const body=new ReadableStream<Uint8Array>({
   start(controller){controller.enqueue(new TextEncoder().encode('data: {"saved":true}\n\n'));},
   cancel(){canceled=true;},
 });
 const result=readChatResponse(new Response(body,{headers:{'content-type':'text/event-stream'}}),acknowledge);
 const rejected=assert.rejects(result,{name:'TimeoutError'});
 await firstFrame;
 t.mock.timers.tick(180_000);
 await rejected;
 assert.equal(canceled,true);
});
test('a partial JSON reply times out and never reports a saved action',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let canceled=false;
 const body=new ReadableStream<Uint8Array>({
   start(controller){controller.enqueue(new TextEncoder().encode('{"saved":true,'));},
   cancel(){canceled=true;},
 });
 let updates=0;
 const result=readChatResponse(new Response(body,{headers:{'content-type':'application/json'}}),()=>updates++);
 const rejected=assert.rejects(result,{name:'TimeoutError'});
 await new Promise<void>(resolve=>setImmediate(resolve));
 t.mock.timers.tick(180_000);
 await rejected;
 assert.equal(updates,0);
 assert.equal(canceled,true);
});
test('a stalled reply stops waiting after reconnect rather than reaching its original idle deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 const browser=new EventTarget();
 Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else Reflect.deleteProperty(globalThis,'window');});
 let canceled=false;
 const body=new ReadableStream<Uint8Array>({cancel(){canceled=true;}});
 const result=readChatResponse(new Response(body,{headers:{'content-type':'text/event-stream'}}),()=>{});
 const rejected=assert.rejects(result,{name:'TimeoutError'});
 browser.dispatchEvent(new Event('online'));
 t.mock.timers.tick(2000);
 assert.equal(canceled,false);
 browser.dispatchEvent(new Event('offline'));
 browser.dispatchEvent(new Event('online'));
 t.mock.timers.tick(1999);
 assert.equal(canceled,false);
 t.mock.timers.tick(1);
 await rejected;
 assert.equal(canceled,true);
});

test('response headers after reconnect carry the original deadline into the body reader',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 const browser=new EventTarget();
 Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else Reflect.deleteProperty(globalThis,'window');});
 let deliverHeaders!:(response:Response)=>void;
 const headers=waitForChatResponse(new Promise<Response>(resolve=>{deliverHeaders=resolve;}));
 browser.dispatchEvent(new Event('offline'));
 browser.dispatchEvent(new Event('online'));
 t.mock.timers.tick(600);
 let canceled=false;
 const body=new ReadableStream<Uint8Array>({cancel(){canceled=true;}});
 deliverHeaders(new Response(body,{headers:{'content-type':'text/event-stream'}}));
 const response=await headers;
 const result=readChatResponse(response,()=>assert.fail('No frame was sent'));
 const rejected=assert.rejects(result,{name:'TimeoutError'});
 t.mock.timers.tick(1399);
 assert.equal(canceled,false);
 t.mock.timers.tick(1);
 await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(canceled,true);
 await rejected;
});

test('a final reply that arrives during the reconnect grace period is accepted',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 const browser=new EventTarget();
 Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else Reflect.deleteProperty(globalThis,'window');});
 let stream!:ReadableStreamDefaultController<Uint8Array>;
 const body=new ReadableStream<Uint8Array>({start(controller){stream=controller;}});
 const result=readChatResponse(new Response(body,{headers:{'content-type':'text/event-stream'}}),()=>{});
 browser.dispatchEvent(new Event('offline'));
 browser.dispatchEvent(new Event('online'));
 t.mock.timers.tick(1000);
 stream.enqueue(new TextEncoder().encode('data: {"done":true,"saved":true,"reply":"已恢复"}\n\n'));
 assert.equal((await result).reply,'已恢复');
});

for(const completeFrame of [false,true]){
 test(completeFrame
   ? 'a complete frame split across chunks restores the normal chat idle deadline'
   : 'an incomplete frame does not extend the reconnect deadline',async t=>{
   t.mock.timers.enable({apis:['setTimeout']});
   const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
   const browser=new EventTarget();
   Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
   t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else Reflect.deleteProperty(globalThis,'window');});
   let controller!:ReadableStreamDefaultController<Uint8Array>;
   let canceled=false;
   const body=new ReadableStream<Uint8Array>({
     start(stream){controller=stream;},
     cancel(){canceled=true;},
   });
   const chunks:string[]=[];
   const result=readChatResponse(new Response(body,{headers:{'content-type':'text/event-stream'}}),event=>{
     if(event.chunk)chunks.push(event.chunk);
   });
   const rejected=completeFrame?undefined:assert.rejects(result,{name:'TimeoutError'});
   const push=(data:string)=>controller.enqueue(new TextEncoder().encode(data));
   browser.dispatchEvent(new Event('offline'));
   browser.dispatchEvent(new Event('online'));
   t.mock.timers.tick(500);
   push('data: {"chunk":"半条');
   await new Promise<void>(resolve=>setImmediate(resolve));
   assert.deepEqual(chunks,[]);
   if(completeFrame){
     push('回复"}\n\n');
     await new Promise<void>(resolve=>setImmediate(resolve));
     assert.deepEqual(chunks,['半条回复']);
   }
   t.mock.timers.tick(1499);
   assert.equal(canceled,false);
   t.mock.timers.tick(1);
   if(!completeFrame){
     await new Promise<void>(resolve=>setImmediate(resolve));
     assert.equal(canceled,true);
     await rejected;
     assert.deepEqual(chunks,[]);
     return;
   }
   assert.equal(canceled,false);
   push('data: {"done":true,"saved":true,"reply":"完整回复"}\n\n');
   assert.equal((await result).reply,'完整回复');
 });
}

test('retry drafts retain message ID and conversation across refresh and are visitor-scoped',()=>{
 const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)}});
 try{selectVisitorScope('visitor-a');saveDraft('homepage_widget',{id:'same-request',conversationId:'owned-conversation',content:'Unsent text',timestamp:'2026-10-12',delivery:'unsaved'});assert.equal(drafts('homepage_widget')[0].id,'same-request');selectVisitorScope('visitor-b');assert.equal(drafts('homepage_widget').length,0);selectVisitorScope('visitor-a');assert.equal(drafts('homepage_widget')[0].conversationId,'owned-conversation');removeDraft('homepage_widget','same-request');assert.equal(drafts('homepage_widget').length,0);}finally{selectVisitorScope('');Reflect.deleteProperty(globalThis,'localStorage');}
});

test('malformed optional Chat attachments do not discard a completed reply', async()=>{
  const received={saved:true,reply:'请先看班次时间。',enrollment:{kind:'class',rows:[null]},
    suggestedPrompts:[{text:'invalid'},' 周末班有哪些？ ','周末班有哪些？','https://example.invalid']};
  for(const response of [
    Response.json(received),
    new Response('data: '+JSON.stringify({...received,done:true})+'\n\n',{headers:{'content-type':'text/event-stream'}}),
  ]){
    const result=await readChatResponse(response,()=>{});
    assert.equal(result.reply,received.reply);
    assert.equal(result.enrollment,undefined);
    assert.deepEqual(result.suggestedPrompts,['周末班有哪些？']);
  }
  const valid={kind:'class',rows:[{id:'class-1',level:'HSK 1',price:99000}]};
  assert.deepEqual((await readChatResponse(Response.json({...received,enrollment:valid}),()=>{})).enrollment,valid);
});
