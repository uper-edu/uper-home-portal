import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {selectVisitorScope, visitorKey, visitorScope, verifyVisitorSession, invalidateVisitorScope, assertVisitorScope} from '../src/services/visitorScope';
import {writeHskResult, readHskHistory, mergeHskHistoryRows, readHskDraft, writeHskDraft} from '../src/services/hskAttemptStorage';
import {saveStudentContext,getStudentContext,subscribeStudentContext} from '../src/services/studentProfileStorage';
import {saveHskAttempt,restoreHskHistory,registerContact,startAnotherVisitor} from '../src/services/portalChat';
import {newHskAttempt,gradeHskAttempt} from '../src/data/hskAssessment';
const A='a'.repeat(64),B='b'.repeat(64);
function environment() {
  const originals=Object.getOwnPropertyDescriptors(globalThis), values=new Map<string,string>();
  const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>values.delete(k)};
  Object.assign(globalThis,{localStorage:storage,sessionStorage:storage,window:{dispatchEvent(){}}});
  selectVisitorScope(A);
  return {values,restore(){invalidateVisitorScope();for(const k of ['window','localStorage','sessionStorage','fetch']){if(originals[k])Object.defineProperty(globalThis,k,originals[k]);else delete (globalThis as any)[k];}}};
}
function result(mode:'express'|'full'='express') { const a=newHskAttempt(mode,randomUUID());a.completedAt=new Date().toISOString();return gradeHskAttempt(a); }
test('657: visitor histories, profiles and unfinished answers remain separate; empty server history cannot borrow A',()=>{
 const e=environment();try{
  const r=result();writeHskResult(r);const a=newHskAttempt('full',randomUUID());writeHskDraft({attempt:a,currentIdx:2,reviewing:false});saveStudentContext({leadProfile:{fullName:'TEST A'} as any});
  selectVisitorScope(B);assert.deepEqual(mergeHskHistoryRows([]).results,[]);assert.equal(readHskDraft(),null);assert.equal(getStudentContext(),null);
  const b=result('full');writeHskResult(b);saveStudentContext({leadProfile:{fullName:'TEST B'} as any});assert.equal(readHskHistory()[0].attempt.attemptId,b.attempt.attemptId);
  selectVisitorScope(A);assert.equal(readHskHistory()[0].attempt.attemptId,r.attempt.attemptId);assert.equal(readHskDraft()?.attempt.attemptId,a.attemptId);assert.equal(getStudentContext()?.leadProfile?.fullName,'TEST A');
 }finally{e.restore();}
});
test('657: unowned legacy caches are preserved but never adopted; unverified identity cannot read/write personal data',()=>{
 const e=environment();try{const r=result();for(const [k,v] of Object.entries({uper_hsk_history_v2:[r],uper_hsk_draft_v2:{attempt:newHskAttempt('full',randomUUID()),currentIdx:0},uper_unified_student_context:{leadProfile:{fullName:'OLD'},assessment:{result:r}}}))e.values.set(k,JSON.stringify(v));
 assert.deepEqual(readHskHistory(),[]);assert.equal(readHskDraft(),null);assert.equal(getStudentContext(),null);assert.equal(e.values.size,3);
 invalidateVisitorScope();assert.equal(writeHskResult(r),false);assert.deepEqual(readHskHistory(),[]);assert.equal(getStudentContext(),null);assert.throws(()=>assertVisitorScope(A));assert.equal(e.values.size,3);
 }finally{e.restore();}
});
test('657: old mounted assessment cannot submit after cookie changes, even before the tab receives a storage event',async()=>{
 const e=environment();try{let writes=0;globalThis.fetch=async(url:any)=>{if(String(url).endsWith('/session'))return Response.json({registered:true,cacheScope:B});writes++;return Response.json({});};await assert.rejects(saveHskAttempt(result().attempt,'en',A),/Visitor changed/);assert.equal(writes,0);assert.equal(visitorScope(),B);}finally{e.restore();}
});
test('657: delayed history and save responses cannot write into a new visitor context',async()=>{
 const e=environment();try{let release!:(r:Response)=>void;let entered!:(v?:unknown)=>void;let started=new Promise(r=>entered=r);
 globalThis.fetch=async(url:any,init:any)=>{if(String(url).endsWith('/session'))return Response.json({registered:true,cacheScope:A});assert.equal(new Headers(init.headers).get('X-Visitor-Scope'),A);entered();return new Promise<Response>(r=>release=r);};
 const restore=restoreHskHistory();await started;selectVisitorScope(B);release(Response.json({results:[result()]}));await assert.rejects(restore,/Visitor changed/);assert.deepEqual(readHskHistory(),[]);
 selectVisitorScope(A);started=new Promise(r=>entered=r);const save=saveHskAttempt(result().attempt,'en',A);await started;selectVisitorScope(B);release(Response.json({result:result()}));await assert.rejects(save,/Visitor changed/);assert.deepEqual(readHskHistory(),[]);
 }finally{e.restore();}
});
test('657: session reply after invalidation cannot restore an old identity; network failure never selects an identity',async()=>{
 const e=environment();try{let release!:(r:Response)=>void;globalThis.fetch=async()=>new Promise<Response>(r=>release=r);const s=verifyVisitorSession();invalidateVisitorScope();release(Response.json({cacheScope:A,registered:true}));await assert.rejects(s,/Visitor changed/);assert.equal(visitorScope(),'');globalThis.fetch=async()=>{throw Error('offline');};await assert.rejects(verifyVisitorSession(),/offline/);assert.equal(visitorScope(),'');}finally{e.restore();}
});

test('657: storage notification while another tab invalidates identity does not read an unverified cache',()=>{
 const e=environment();try{const handlers=new Map<string,(e:any)=>void>();(globalThis as any).window={addEventListener:(k:string,f:any)=>handlers.set(k,f),removeEventListener:(k:string)=>handlers.delete(k),dispatchEvent(){}};
 const unsubscribe=subscribeStudentContext(()=>assert.fail('No personal context should be recovered'));
 invalidateVisitorScope();assert.doesNotThrow(()=>handlers.get('storage')?.({key:'uper_active_visitor_scope',newValue:B}));unsubscribe();
 }finally{e.restore();}
});

test('657: updating the same visitor profile preserves that visitor assessment',async()=>{
 const e=environment(), original=Object.getOwnPropertyDescriptor(globalThis,'location');try{
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:''}});
 const r=result();saveStudentContext({leadProfile:{fullName:'TEST A'} as any,assessment:{completed:true,result:r}});
 globalThis.fetch=async(url:any)=>String(url).endsWith('/session')?Response.json({registered:true,cacheScope:A}):Response.json({success:true,lead:{fullName:'TEST A Updated'}});
 await registerContact({fullName:'TEST A Updated'});assert.equal(getStudentContext()?.assessment?.result?.attempt.attemptId,r.attempt.attemptId);
 }finally{if(original)Object.defineProperty(globalThis,'location',original);else delete (globalThis as any).location;e.restore();}
});

test('explicit person switch retains A history but selects empty B and uses guarded POST',async()=>{
 const e=environment();try{let switched=false;const r=result();writeHskResult(r);saveStudentContext({leadProfile:{fullName:'TEST A'} as any});
 globalThis.fetch=async(url:any,init:any)=>{if(String(url).endsWith('/session'))return Response.json({registered:!switched,cacheScope:switched?B:A});assert.equal(String(url),'/api/portal/new-person');assert.equal(init.method,'POST');assert.equal(new Headers(init.headers).get('X-Visitor-Scope'),A);switched=true;return Response.json({ok:true});};
 await startAnotherVisitor();assert.equal(visitorScope(),B);assert.equal(getStudentContext(),null);assert.deepEqual(readHskHistory(),[]);selectVisitorScope(A);assert.equal(readHskHistory()[0].attempt.attemptId,r.attempt.attemptId);
 }finally{e.restore();}
});
test('failed person switch does not locally erase current profile or history',async()=>{
 const e=environment();try{saveStudentContext({leadProfile:{fullName:'TEST A'} as any});globalThis.fetch=async(url:any)=>String(url).endsWith('/session')?Response.json({registered:true,cacheScope:A}):Response.json({error:'Unavailable'},{status:503});await assert.rejects(startAnotherVisitor(),/Unavailable/);assert.equal(visitorScope(),A);assert.equal(getStudentContext()?.leadProfile?.fullName,'TEST A');}finally{e.restore();}
});
