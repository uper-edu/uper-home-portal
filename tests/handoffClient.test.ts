import {test} from 'node:test';import assert from 'node:assert/strict';
import {chatFetch,finishChat} from '../src/services/portalChat.ts';import {draft} from '../src/services/chatDelivery.ts';
test('handoff client persists drafts and reuses original request after storage failure without calling AI',async()=>{
 const storage=new Map<string,string>();const before={fetch:globalThis.fetch,localStorage:globalThis.localStorage,location:globalThis.location};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname:'/'}});
 let failed=true;const posts:any[]=[];
 globalThis.fetch=async(input:any,init:any)=>{const url=String(input);if(url==='/api/portal/session')return Response.json({cacheScope:'TEST-handoff-client'});if(url==='/api/portal/conversations')return Response.json({conversationId:'TEST-conversation'});posts.push({url,body:JSON.parse(init.body)});assert.equal(url,'/api/portal/actions');if(failed)return Response.json({saved:false,error:'TEST storage failure'},{status:503});return Response.json({saved:true,status:'awaiting_advisor',taskId:'TEST-task',reply:'Message saved. Awaiting advisor contact.'});};
 try{
  const init=(human:boolean)=>({method:'POST',body:JSON.stringify({messages:[{id:'TEST-id',role:'user',content:'TEST original request'}],isHumanMode:human,language:'en'})});
  await assert.rejects(chatFetch('/api/chat',init(true),'homepage_widget'),/TEST storage failure/);assert.equal(draft('homepage_widget','TEST-id')?.delivery,'unsaved');assert.equal(draft('homepage_widget','TEST-id')?.action,'handoff');
  failed=false;const response=await chatFetch('/api/chat',init(false),'homepage_widget');const result=await finishChat(response,'homepage_widget','TEST-id',()=>{});assert.equal(result.saved,true);assert.equal(result.taskId,'TEST-task');assert.equal(draft('homepage_widget','TEST-id'),undefined);assert.equal(posts.length,2);assert.deepEqual(posts[0].body,posts[1].body);assert.equal(posts[1].body.content,'TEST original request');
 }finally{globalThis.fetch=before.fetch;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:before.localStorage});Object.defineProperty(globalThis,'location',{configurable:true,value:before.location});}
});
