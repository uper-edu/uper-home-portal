import test from 'node:test';
import assert from 'node:assert/strict';
import {compareGoals,mountGoalReviewRoute,goalReviewInstruction} from '../server/portal/goalReview.ts';
import {goalReviewInput,goalRelation} from '../src/utils/crmGoalReview.ts';
import {dynamicProfileHints} from '../src/utils/crmDynamicProfile.ts';

const profile=()=>({id:'sample',goal:'在印尼中资或合资企业工作',tier:'Warm',profileFieldMeta:{goal:{revision:3,sourceFactIds:['questionnaire'],pendingDifferences:[{value:'希望能和中国客户开会',sourceFactId:'meeting',effectiveAt:'2026-11-06T01:00:00Z'},{value:'不再以职场沟通为目标，只为申请奖学金',sourceFactId:'changed'}]}}});
const providers=[{model:'gpt-4o',key:'fake-unit-key',url:'https://unit.invalid/primary'},{model:'deepseek-chat',key:'fake-unit-key-2',url:'https://unit.invalid/fallback'}];
const response=(relations:any)=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({relations})}}]}));

test('semantic review uses model results, keeps compatible detail and true conflicts distinct, without rewriting facts',async()=>{
 const p=profile(),before=JSON.stringify(p),input=goalReviewInput(p);let calls=0;
 const relations=await compareGoals(input.current,input.candidates.map(d=>d.value),(async(_url,options)=>{
  calls++;const body=JSON.parse(String(options?.body));assert.equal(body.messages[0].content,goalReviewInstruction);
  assert.deepEqual(JSON.parse(body.messages[1].content),{current:p.goal,candidates:input.candidates.map(d=>d.value)});
  assert.doesNotMatch(body.messages[1].content,/tier|sample|questionnaire|meeting/);
  return response(['compatible','conflict']);
 }) as typeof fetch,providers);
 const review={snapshot:input.snapshot,relations};
 assert.equal(calls,1);assert.equal(goalRelation(p,input.candidates[0],review),'compatible');
 const hint=dynamicProfileHints(p,Date.now(),review).find(h=>h.id==='difference:goal');
 assert.deepEqual(hint.evidenceIds,['changed']);assert.equal(hint.goalReviewState,'conflict');
 assert.equal(JSON.stringify(p),before);
 // A prior review can never suppress a new goal/version/source conflict.
 const updated={...p,goal:'申请中国大学奖学金'};
 assert.equal(goalRelation(updated,input.candidates[0],review),'uncertain');
 assert.equal(dynamicProfileHints(updated,Date.now(),review).find(h=>h.id==='difference:goal').goalReviewState,'uncertain');
});

test('missing/invalid/failed AI never silently guesses compatibility and uses configured fallback',async()=>{
 const p=profile(),input=goalReviewInput(p);
 assert.equal(goalRelation(p,input.candidates[0],null),'uncertain');
 assert.equal(dynamicProfileHints(p).find(h=>h.id==='difference:goal').goalReviewState,'uncertain');
 let calls=0;const out=await compareGoals(p.goal,input.candidates.map(d=>d.value),(async()=>++calls===1?response(['yes']):response(['compatible','uncertain'])) as typeof fetch,providers);
 assert.deepEqual(out,['compatible','uncertain']);assert.equal(calls,2);
 await assert.rejects(()=>compareGoals(p.goal,['another'],(async()=>new Response('',{status:429})) as typeof fetch,providers),{status:503});
 assert.deepEqual(await compareGoals(null,['another'],(async()=>{throw Error('must not call')}) as typeof fetch,providers),['uncertain']);
});

test('read-only route authorizes before cache/model and after request, binds output to current record, and single-flights repeated reads',async()=>{
 let handler:any,allowed=true,p=profile(),calls=0,checks=0,release:any;
 const app={get(path:string,h:any){assert.equal(path,'/api/crm/leads/:id/goal-review');handler=h;}};
 mountGoalReviewRoute(app,{wrap:(v:any)=>v,leadAccess:async()=>{checks++;if(!allowed)throw Object.assign(Error('denied'),{status:404});return {l:{id:p.id,profile:structuredClone(p)}};},compare:async()=>{calls++;await new Promise(r=>{release=r});return ['compatible','conflict'];}});
 const replies:any[]=[];const res=()=>({set(k:string,v:string){assert.equal(k,'Cache-Control');assert.equal(v,'no-store');},json(v:any){replies.push(v);}});
 const a=handler({},res()),b=handler({},res());await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);release();await Promise.all([a,b]);assert.equal(replies.length,2);assert.equal(checks,4);
 allowed=false;await assert.rejects(()=>handler({},res()),{status:404});assert.equal(calls,1);
 allowed=true;p={...profile(),goal:'new goal'};const changed=handler({},res());await new Promise(r=>setTimeout(r,0));p.goal='changed while model was working';release();await assert.rejects(()=>changed,{status:409});assert.equal(replies.length,2);
 const revoked=handler({},res());await new Promise(r=>setTimeout(r,0));allowed=false;release();await assert.rejects(()=>revoked,{status:404});assert.equal(replies.length,2);
});

test('withdrawn, superseded and exact same records are not sent for semantic review',()=>{
 const p=profile();p.profileFieldMeta.goal.pendingDifferences.push(...[{value:p.goal,sourceFactId:'same'},{value:'withdrawn',sourceFactId:'old',effective:false},{value:'old',sourceFactId:'old2',supersededBy:'new'}] as any);
 assert.equal(goalReviewInput(p).candidates.length,2);
 assert.equal(goalRelation(p,{value:p.goal}),'equivalent');
});
