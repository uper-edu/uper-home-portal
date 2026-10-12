import {test} from 'node:test';import assert from 'node:assert/strict';
import {readChatResponse,setDraftScope,saveDraft,drafts,removeDraft} from '../src/services/chatDelivery';
test('stream ending without persisted completion is rejected; resets replace partial reply',async()=>{
 const stream=(events:any[])=>new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
 await assert.rejects(readChatResponse(stream([{saved:true},{chunk:'PARTIAL'}]),()=>{}));
 let text='';const result=await readChatResponse(stream([{saved:true},{chunk:'PARTIAL'},{reset:true},{chunk:'Final'},{done:true,saved:true,reply:'Final'}]),e=>{if(e.reset)text='';if(e.chunk)text+=e.chunk;});assert.equal(text,result.reply);
 await assert.rejects(readChatResponse(Response.json({saved:true,status:'failed',error:'all_providers_failed'}),()=>{}));
});
test('retry drafts retain message ID and conversation across refresh and are visitor-scoped',()=>{
 const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)}});
 try{setDraftScope('visitor-a');saveDraft('homepage_widget',{id:'same-request',conversationId:'owned-conversation',content:'Unsent text',timestamp:'2026-10-12',delivery:'unsaved'});assert.equal(drafts('homepage_widget')[0].id,'same-request');setDraftScope('visitor-b');assert.equal(drafts('homepage_widget').length,0);setDraftScope('visitor-a');assert.equal(drafts('homepage_widget')[0].conversationId,'owned-conversation');removeDraft('homepage_widget','same-request');assert.equal(drafts('homepage_widget').length,0);}finally{delete (globalThis as any).localStorage;}
});
