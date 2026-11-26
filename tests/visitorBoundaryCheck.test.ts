import test from 'node:test';import assert from 'node:assert/strict';import{createBoundaryCheck,type BoundaryState}from'../src/services/visitorBoundaryCheck';import{invalidateVisitorScope,selectVisitorScope,subscribeVisitorScope,visitorScope}from'../src/services/visitorScope';
const tick=()=>new Promise(r=>setImmediate(r));
test('first session selection does not invalidate its own boundary check',async()=>{
 invalidateVisitorScope();
 let state:BoundaryState={ready:'',failed:false,checking:true};
 const c=createBoundaryCheck(async()=>{selectVisitorScope('a'.repeat(64));return{cacheScope:'a'.repeat(64)}},visitorScope,s=>{state=s},()=>{});
 const unsubscribe=subscribeVisitorScope(()=>c.invalidate());
 try{c.check();await tick();assert.deepEqual(state,{ready:'a'.repeat(64),failed:false,checking:false});}
 finally{unsubscribe();c.dispose();invalidateVisitorScope();}
});
test('ordinary recheck never hides mounted UI; failure retains identity/draft mount but blocks content until successful retry',async()=>{
 let scope='A',state:BoundaryState={ready:'',failed:false,checking:true},resolve:any,reject:any;const states:BoundaryState[]=[];
 const c=createBoundaryCheck(()=>new Promise((a,b)=>{resolve=a;reject=b}),()=>scope,s=>{state=s;states.push(s)},()=>{});
 c.check();resolve({cacheScope:'A'});await tick();assert.equal(state.ready,'A');states.length=0;
 c.check();assert.equal(states.length,0);resolve({cacheScope:'A'});await tick();assert.ok(states.every(s=>s.ready==='A'&&!s.checking&&!s.failed));
 c.check();reject(Error('offline'));await tick();assert.equal(state.ready,'A');assert.equal(state.failed,true);
 c.check();assert.equal(state.failed,true);resolve({cacheScope:'A'});await tick();assert.equal(state.failed,false);c.dispose();
});
test('person change immediately clears old UI and late failure cannot replace new person success',async()=>{
 let scope='A',state:BoundaryState={ready:'',failed:false,checking:true};const requests:{resolve:any,reject:any}[]=[];const hydrated:string[]=[];
 const c=createBoundaryCheck(()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),()=>scope,s=>state=s,s=>hydrated.push(s.cacheScope));
 c.check();requests[0].resolve({cacheScope:'A'});await tick();c.check();scope='B';c.invalidate();assert.equal(state.ready,'');requests[2].resolve({cacheScope:'B'});await tick();requests[1].reject(Error('stale'));await tick();assert.deepEqual(state,{ready:'B',failed:false,checking:false});assert.deepEqual(hydrated,['A','B']);
 c.check();c.dispose();requests[3].resolve({cacheScope:'B'});await tick();assert.equal(hydrated.length,2);
});
test('cached pages stay hidden until a new verification, including when the visitor is unchanged',async()=>{
 let state:BoundaryState={ready:'',failed:false,checking:true};
 const requests:Array<(session:{cacheScope:string;registered:boolean})=>void>=[];
 const snapshot={cacheScope:'A',registered:false};
 const controller=createBoundaryCheck(()=>new Promise(resolve=>requests.push(resolve)),()=>snapshot.cacheScope,
   next=>{state=next;},()=>{});
 controller.check();
 requests[0](snapshot);
 await tick();
 controller.check();
 controller.suspend();
 requests[1](snapshot);
 await tick();
 assert.equal(state.checking,true);
 controller.invalidate();
 assert.equal(state.ready,'');
 requests[2](snapshot);
 await tick();
 assert.deepEqual(state,{ready:'A',failed:false,checking:false});
 controller.dispose();
});

test('reconnection during a pending visitor check retries only if the old request fails',async()=>{
 const snapshot={cacheScope:'A',registered:false};
 let state:BoundaryState={ready:'',failed:false,checking:true};
 const requests:{resolve:(session:typeof snapshot)=>void; reject:(error:Error)=>void}[]=[];
 const controller=createBoundaryCheck(()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),
  ()=>snapshot.cacheScope,next=>{state=next;},()=>{});
 try{
  controller.check();
  controller.reconnect();
  controller.check();
  controller.reconnect();
  assert.equal(requests.length,1);
  requests[0].reject(Error('old connection'));
  await tick();
  assert.equal(requests.length,2);
  assert.equal(state.failed,false);
  requests[1].resolve(snapshot);
  await tick();
  assert.deepEqual(state,{ready:'A',failed:false,checking:false});

  controller.check();
  controller.reconnect();
  requests[2].resolve(snapshot);
  await tick();
  assert.equal(requests.length,3);

  controller.check();
  controller.reconnect();
  requests[3].reject(Error('old connection'));
  await tick();
  assert.deepEqual(state,{ready:'A',failed:false,checking:true});
  requests[4].reject(Error('still unavailable'));
  await tick();
  assert.equal(requests.length,5);
  assert.equal(state.failed,true);
 }finally{controller.dispose();}
});
