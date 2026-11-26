import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';
import{saveRegistration,RegistrationSaveError,registrationSaveText}from'../src/services/registrationSave';
import{registrationFingerprint,registrationReceiptKey,registrationSubmissionId,publicRegistrationProfile}from'../server/portal/registrationReceipt';
const response=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function storage(){const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k),values} as any;}
test('registration request fingerprints exclude generated time, preserve answers and scope receipts',()=>{
 assert.equal(registrationFingerprint({fullName:'Maya',submittedAt:'a'}),registrationFingerprint({submittedAt:'b',fullName:'Maya'}));
 assert.notEqual(registrationFingerprint({fullName:'Maya'}),registrationFingerprint({fullName:'Arif'}));
 assert.notEqual(registrationReceiptKey('A','same-id'),registrationReceiptKey('B','same-id'));
 assert.throws(()=>registrationSubmissionId({submissionId:'bad'}));
 assert.deepEqual(publicRegistrationProfile({id:'A',fullName:'Maya',internalNote:'private',owner:'Sales',tier:'Hot'}),{id:'A',fullName:'Maya'});
});
test('ambiguous response queries the original receipt once and clears the visitor draft on confirmation',async()=>{
 const scope=randomUUID(),store=storage();let posts=0,queries=0,id='';
 const fetcher=(async(url:any,init:any={})=>{
  if(init.method==='POST'){posts++;id=JSON.parse(init.body).submissionId;return response({error:'gateway'},503);}
  queries++;
  assert.equal(url,'/api/portal/registrations/'+id);
  assert.deepEqual([...store.values.keys()],['uper_registration_pending:'+scope]);
  return response({saved:true,submissionId:id,lead:{id:'A',fullName:'Maya'}});
 })as typeof fetch;
 const data=await saveRegistration({scope,payload:{fullName:'Maya'},fetcher,storage:store});
 assert.equal(data.lead.id,'A');assert.equal(posts,1);assert.equal(queries,1);assert.equal(store.values.size,0);
});
test('404 does not authorize a query-only write; explicit retry reuses original ID and timestamp',async()=>{
 const scope=randomUUID(),store=storage(),bodies:any[]=[];let recover=false;
 const fetcher=(async(url:any,init:any={})=>{if(init.method!=='POST')return response({},404);const b=JSON.parse(init.body);bodies.push(b);if(!recover)throw Error('lost response');return response({saved:true,submissionId:b.submissionId,lead:{id:'A'}});})as typeof fetch;
 await assert.rejects(()=>saveRegistration({scope,payload:{fullName:'Maya',submittedAt:'first'},fetcher,storage:store}));
 await assert.rejects(()=>saveRegistration({scope,payload:{},fetcher,storage:store,queryOnly:true}));assert.equal(bodies.length,1);
 recover=true;await saveRegistration({scope,payload:{},retryOriginal:true,fetcher,storage:store});assert.equal(bodies.length,2);assert.equal(bodies[0].submissionId,bodies[1].submissionId);assert.equal(bodies[0].submittedAt,bodies[1].submittedAt);assert.equal(bodies[1].fullName,'Maya');
});
test('validation rejection is failed, changed unknown draft conflicts, malformed success stays unknown',async()=>{
 const scope=randomUUID(),store=storage();const fail=(async()=>response({error:'Invalid contact'},400))as typeof fetch;
 await assert.rejects(()=>saveRegistration({scope,payload:{fullName:'Maya'},fetcher:fail,storage:store}),e=>e instanceof RegistrationSaveError&&e.state==='failed');assert.equal(store.values.size,0);
 const identity=(async()=>response({error:'Contact identity changed; start a separate visitor session'},409))as typeof fetch;
 await assert.rejects(()=>saveRegistration({scope,payload:{fullName:'Other'},fetcher:identity,storage:store}),e=>e instanceof RegistrationSaveError&&e.state==='failed');assert.equal(store.values.size,0);
 const bad=(async(_u:any,i:any)=>i?.method==='POST'?response({success:true}):response({},404))as typeof fetch;
 await assert.rejects(()=>saveRegistration({scope,payload:{fullName:'Maya'},fetcher:bad,storage:store}),e=>e instanceof RegistrationSaveError&&e.state==='unknown');
 await assert.rejects(()=>saveRegistration({scope,payload:{fullName:'Other'},fetcher:bad,storage:store}),e=>e instanceof RegistrationSaveError&&e.state==='conflict');
 for(const lang of ['zh','en','id'])for(const state of ['failed','unknown','conflict']as const)assert(registrationSaveText(state,lang).length>10);
});
test('concurrent same-form submits share one transport operation',async()=>{
 const scope=randomUUID();let posts=0;const fetcher=(async(_u:any,i:any)=>{posts++;const b=JSON.parse(i.body);await new Promise(r=>setTimeout(r,15));return response({saved:true,submissionId:b.submissionId,lead:{id:'A'}});})as typeof fetch;
 await Promise.all(Array.from({length:10},()=>saveRegistration({scope,payload:{fullName:'Maya'},fetcher})));assert.equal(posts,1);
});
test('a fresh page recovers only its verified visitor tab draft and explicitly retries original answers',async()=>{
 const scope=randomUUID(),store=storage();
 await assert.rejects(()=>saveRegistration({scope,payload:{fullName:'Sari'},fetcher:(async()=>{throw Error('offline');})as typeof fetch,storage:store}));
 const modulePath='../src/services/registrationSave.ts?reload='+randomUUID();const fresh=await import(modulePath);
 assert.equal(fresh.hasPendingRegistration(randomUUID(),store),false);
 assert.equal(fresh.pendingRegistrationDraft(randomUUID(),store),null);assert.equal(fresh.pendingRegistrationDraft(scope,store)?.fullName,'Sari');
 let posted:any;const fetcher=(async(_u:any,i:any={})=>{if(i.method!=='POST')return response({},404);posted=JSON.parse(i.body);return response({saved:true,submissionId:posted.submissionId,lead:{id:'S'}});})as typeof fetch;
 await fresh.saveRegistration({scope,payload:{},retryOriginal:true,fetcher,storage:store});assert.equal(posted.fullName,'Sari');assert.equal(store.values.size,0);
});
test('an HTTP browser can restore a draft and retry with the original submission ID',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto')!;
 const getRandomValues=crypto.getRandomValues.bind(crypto);
 t.after(()=>Object.defineProperty(globalThis,'crypto',descriptor));
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues}});
 const scope=randomUUID(),store=storage(),posts:any[]=[];
 const fetcher=(async(_url:any,init:any={})=>{
   if (init.method!=='POST') return response({},404);
   const body=JSON.parse(init.body); posts.push(body);
   return posts.length===1?response({},503):response({saved:true,submissionId:body.submissionId,lead:{id:'S'}});
 }) as typeof fetch;
 const payload={fullName:'Sari',goals:['Work'],submittedAt:'initial'};
 await assert.rejects(saveRegistration({scope,payload,fetcher,storage:store}),{state:'unknown'});
 const fresh=await import('../src/services/registrationSave.ts?http='+randomUUID());
 assert.equal(fresh.pendingRegistrationDraft(scope,store)?.fullName,'Sari');
 await assert.rejects(fresh.saveRegistration({scope,payload:{...payload,goals:['Study']},fetcher,storage:store}),{state:'conflict'});
 assert.equal(posts.length,1);
 await fresh.saveRegistration({scope,payload:{goals:['Work'],fullName:'Sari',submittedAt:'changed'},fetcher,storage:store});
 assert.deepEqual(posts[1],posts[0]);
 assert.equal(store.values.size,0);
});

test('legacy hash-only drafts keep their original receipt and submission ID',async()=>{
 const scope=randomUUID(),id=randomUUID(),store=storage();
 const payload={fullName:'Sari'};
 const submittedAt=new Date().toISOString();
 store.setItem('uper_registration_pending:'+scope,JSON.stringify({id,submittedAt,fingerprint:registrationFingerprint(payload)}));
 const fetcher=(async(_url:any,init:any={})=>{
   if(init.method!=='POST')return response({},404);
   const body=JSON.parse(init.body);
   assert.deepEqual(body,{...payload,submittedAt,submissionId:id});
   return response({saved:true,submissionId:id,lead:{id:'S'}});
 }) as typeof fetch;
 await saveRegistration({scope,payload,fetcher,storage:store});
 assert.equal(store.values.size,0);
});
