import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrmPolling,stableCrmOrder,CrmRefreshError} from '../src/utils/crmPolling.ts';
function clock(){let now=1000,id=0;const jobs=new Map<number,{at:number;fn:()=>void}>();return {now:()=>now,setTimer:((fn:any,ms:number)=>{jobs.set(++id,{at:now+ms,fn});return id;}) as any,clearTimer:((key:number)=>jobs.delete(key)) as any,async tick(ms:number){const end=now+ms;while(true){await flush();const next=[...jobs].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();}now=end;await flush();}};}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('642 slow successful lists are accepted once; completion-based cadence and manual coalescing',async()=>{
 for(const latency of [6500,12000]){const c=clock();let requests=0,accepted=0;const p=new CrmPolling({...c,list:async signal=>{requests++;await new Promise(r=>c.setTimer(r,latency));if(!signal.aborted)accepted++;},changes:async()=>{},error:()=>assert.fail('unexpected error'),busy:()=>{}});p.setVisible(true);await c.tick(5000);p.refresh();p.refresh();assert.equal(requests,1);await c.tick(latency-5000);assert.equal(accepted,1);await c.tick(29999);assert.equal(requests,1);await c.tick(1);assert.equal(requests,2);p.setVisible(false);}
});
test('642 hidden pause, stale return refresh and generation abort prevent late writes',async()=>{
 const c=clock();let calls=0,writes=0;const p=new CrmPolling({...c,list:async signal=>{calls++;await new Promise(r=>c.setTimer(r,6500));if(!signal.aborted)writes++;},changes:async()=>{},error:()=>assert.fail('cancel is not an error'),busy:()=>{}});p.setVisible(true);await c.tick(1000);p.setVisible(false);await c.tick(60000);assert.equal(calls,1);assert.equal(writes,0);p.setVisible(true);await c.tick(6500);assert.equal(writes,1);p.setVisible(false);
});
test('642 timeout releases busy, backs off and ignores late transport completion; manual retry works',async()=>{
 const c=clock();let calls=0,writes=0,busy=false;const errors:any[]=[];const p=new CrmPolling({...c,list:async signal=>{calls++;await new Promise(r=>c.setTimer(r,calls===1?35000:1));if(!signal.aborted)writes++;},changes:async()=>{},error:e=>errors.push(e),busy:v=>busy=v});p.setVisible(true);await c.tick(20000);assert.equal(busy,false);assert.equal(errors[0].code,'timeout');p.refresh();await c.tick(1);assert.equal(writes,1);await c.tick(15000);assert.equal(writes,1);p.setVisible(false);
});
test('642 post-save queues one refresh behind an older in-flight result',async()=>{
 const c=clock();let calls=0;const p=new CrmPolling({...c,list:async()=>{calls++;await new Promise(r=>c.setTimer(r,100));},changes:async()=>{},error:()=>{},busy:()=>{}});p.setVisible(true);p.refresh('mutation');p.refresh('mutation');await c.tick(100);assert.equal(calls,2);await c.tick(100);assert.equal(calls,2);p.setVisible(false);
});
test('642 five visible sessions: bounded idle request counts; hidden sessions generate none',async()=>{
 const c=clock();let lists=0,changes=0;const sessions=Array.from({length:5},()=>new CrmPolling({...c,list:async()=>{lists++;},changes:async()=>{changes++;},error:()=>{},busy:()=>{}}));sessions.forEach(s=>s.setVisible(true));await c.tick(60000);assert.equal(lists,15);assert.equal(changes,35);sessions.forEach(s=>s.setVisible(false));await c.tick(60000);assert.equal(lists,15);assert.equal(changes,35);
});
test('642 automatic refresh preserves working order, removes inaccessible records, appends new customers',()=>{
 assert.deepEqual(stableCrmOrder([{id:'A',v:1},{id:'B',v:1}],[{id:'B',v:2},{id:'C',v:3}]),[{id:'B',v:2},{id:'C',v:3}]);
 assert.deepEqual(stableCrmOrder([{id:'A'},{id:'B'}],[{id:'B'},{id:'A'}]),[{id:'A'},{id:'B'}]);
});
test('642 query switch cancels A; fast B wins and late A cannot write',async()=>{
 const c=clock();let shown='';const make=(name:string,delay:number)=>new CrmPolling({...c,list:async signal=>{await new Promise(r=>c.setTimer(r,delay));if(!signal.aborted)shown=name;},changes:async()=>{},busy:()=>{},error:()=>{}});const a=make('A',12000);a.setVisible(true);await c.tick(1000);a.setVisible(false);const b=make('B',100);b.setVisible(true);await c.tick(100);assert.equal(shown,'B');await c.tick(12000);assert.equal(shown,'B');b.setVisible(false);
});
test('642 lightweight timeout never cancels a slower successful list; recovery returns normal cadence',async()=>{
 const c=clock();let lists=0,changes=0;const errors:any[]=[];const p=new CrmPolling({...c,list:async signal=>{await new Promise(r=>c.setTimer(r,12000));if(!signal.aborted)lists++;},changes:async()=>{changes++;if(changes===1)await new Promise(()=>{});},busy:()=>{},error:(e,channel)=>errors.push({e,channel})});p.setVisible(true);await c.tick(10000);assert.equal(errors[0].channel,'changes');await c.tick(2000);assert.equal(lists,1);await c.tick(18000);assert.equal(changes,2);p.setVisible(false);
});
test('642 transport classifies 401/403 separately and rejects HTTP failures without interpreting empty data',async()=>{
 const {crmJson}=await import('../src/utils/crmPolling.ts');const original=globalThis.fetch;
 try{for(const status of [401,403,500]){globalThis.fetch=async()=>new Response('{}',{status});await assert.rejects(()=>crmJson('http://test.invalid',new AbortController().signal),(e:any)=>e instanceof CrmRefreshError&&e.code===(status===500?'unavailable':'unauthorized'));}}finally{globalThis.fetch=original;}
});
