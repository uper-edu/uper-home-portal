import {selectVisitorScope} from '../src/services/visitorScope';
selectVisitorScope('a'.repeat(64));
import {test} from 'node:test';import assert from 'node:assert/strict';
import {chatFetch,finishChat} from '../src/services/portalChat.ts';import {draft} from '../src/services/chatDelivery.ts';
test('handoff client persists drafts and reuses original request after storage failure without calling AI',async()=>{
 const storage=new Map<string,string>();const before={fetch:globalThis.fetch,localStorage:globalThis.localStorage,location:globalThis.location};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname:'/'}});
 let failed=true;const posts:any[]=[];
 globalThis.fetch=async(input:any,init:any)=>{const url=String(input);if(url==='/api/portal/session')return Response.json({cacheScope:'a'.repeat(64)});if(url==='/api/portal/conversations')return Response.json({conversationId:'TEST-conversation'});posts.push({url,body:JSON.parse(init.body)});assert.equal(url,'/api/portal/actions');if(failed)return Response.json({saved:false,error:'TEST storage failure'},{status:503});return Response.json({saved:true,status:'awaiting_advisor',taskId:'TEST-task',reply:'Message saved. Awaiting advisor contact.'});};
 try{
  const init=(human:boolean)=>({method:'POST',body:JSON.stringify({messages:[{id:'TEST-id',role:'user',content:'TEST original request'}],isHumanMode:human,language:'en'})});
  await assert.rejects(chatFetch('/api/chat',init(true),'homepage_widget'),/TEST storage failure/);assert.equal(draft('homepage_widget','TEST-id')?.delivery,'unsaved');assert.equal(draft('homepage_widget','TEST-id')?.action,'handoff');
  failed=false;const response=await chatFetch('/api/chat',init(false),'homepage_widget');const result=await finishChat(response,'homepage_widget','TEST-id',()=>{});assert.equal(result.saved,true);assert.equal(result.taskId,'TEST-task');assert.equal(draft('homepage_widget','TEST-id'),undefined);assert.equal(posts.length,2);assert.deepEqual(posts[0].body,posts[1].body);assert.equal(posts[1].body.content,'TEST original request');
 }finally{globalThis.fetch=before.fetch;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:before.localStorage});Object.defineProperty(globalThis,'location',{configurable:true,value:before.location});}
});

test('664 explicit buttons bypass prose matching in all languages, preserve action on retry and leave ordinary questions on AI',async()=>{
 const before=Object.getOwnPropertyDescriptors(globalThis),values=new Map<string,string>(),posts:any[]=[];let fail=false;
 for(const [k,v] of Object.entries({localStorage:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)},location:{pathname:'/',search:''}}))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 globalThis.fetch=async(input:any,init:any)=>{const url=String(input);if(url.endsWith('/session'))return Response.json({cacheScope:'a'.repeat(64),registered:true});if(url.endsWith('/conversations'))return Response.json({conversationId:'TEST-664'});const body=JSON.parse(init.body);posts.push({url,body});if(fail)return Response.json({saved:false,error:'TEST unavailable'},{status:503});return Response.json({saved:true,status:body.action?'awaiting_advisor':'completed',taskId:body.action?'TEST-task':null,reply:'TEST reply'});};
 try{
  const payload=(id:string,content:string,language:string,action?:string)=>({method:'POST',body:JSON.stringify({messages:[{id,role:'user',content}],language,action})});
  for(const [lang,text] of [['en','Please arrange advisor follow-up'],['id','Mohon tindak lanjut konsultan'],['zh','请安排顾问联系我']]){const id='TEST-664-'+lang;const res=await chatFetch('/api/chat',payload(id,text,lang,'handoff'),'homepage_widget');assert.equal((await finishChat(res,'homepage_widget',id,()=>{})).taskId,'TEST-task');assert.equal(posts.at(-1).url,'/api/portal/actions');assert.equal(posts.at(-1).body.action,'handoff');assert.equal(posts.at(-1).body.content,text);}
  fail=true;await assert.rejects(chatFetch('/api/chat',payload('TEST-664-retry','Please arrange advisor follow-up','en','handoff'),'homepage_widget'),/TEST unavailable/);assert.equal(draft('homepage_widget','TEST-664-retry')?.action,'handoff');
  fail=false;const res=await chatFetch('/api/chat',payload('TEST-664-retry','Please arrange advisor follow-up','id'),'homepage_widget');await finishChat(res,'homepage_widget','TEST-664-retry',()=>{});assert.equal(posts.at(-1).body.messageId,'TEST-664-retry');assert.equal(posts.at(-1).body.action,'handoff');
  await chatFetch('/api/chat',payload('TEST-664-normal','What are the course fees?','en'),'homepage_widget');assert.equal(posts.at(-1).url,'/api/chat');assert.equal(posts.at(-1).body.action,undefined);
  const n=posts.length;await assert.rejects(chatFetch('/api/chat',payload('TEST-664-invalid','bad action','en','delete'),'homepage_widget'),/Invalid request action/);assert.equal(posts.length,n);
 }finally{for(const k of ['fetch','localStorage','location']){if(before[k])Object.defineProperty(globalThis,k,before[k]);else delete (globalThis as any)[k];}}
});
