import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory=process.argv[2];
assert.ok(directory,'Usage: node --import tsx scripts/score-chat-consultation.mts <run-directory> [reviews.json]');
const read=async(file:string|URL)=>JSON.parse(await readFile(file,'utf8'));
const suite=await read(new URL('../tests/fixtures/chat-consultation-v1.json',import.meta.url));
const run=await read(join(directory,'run.json'));
assert.equal(run.suite,suite.version);
const learnerDimensions=['courtesy','clarity','context','accuracy','initiative'] as const;
const businessDimensions=['need','match','nextStep','conversionQuality'] as const;
const checks:{case:string;turn?:number;issue:string;severe?:boolean}[]=[];
const evidence=new Map<string,any>();
const loaded=await readdir(directory);
const latency:number[]=[];
const models:Record<string,number>={};
const actions:Record<string,number>={};
const providerAttempts:Record<string,{successful:number;failed:number}>={};
const enrollmentAuditFields=['orders','orderSeats','transferHolds','waitlist','demands','customerRecords'] as const;
let enrollmentAudits=0;
const publicClasses=new Map<string,any>(run.catalog.classes.map((row:any)=>[row.id,row]));
const publicAppointments=new Map<string,any>(run.catalog.appointments.map((row:any)=>[row.id,row]));
for(const file of loaded.filter(file=>/^\d\d-\d+\.json$/.test(file))){
  const record=await read(join(directory,file));
  const key=file.slice(0,-5);
  evidence.set(key,record);
  const note=(issue:string,turn?:number,severe=false)=>checks.push({case:key,turn,issue,severe});
  if(record.opportunityCount!==0)note('Unexpected opportunity write',undefined,true);
  if(run.auditVerifiedLinks){
    const proof=record.enrollmentAudit;
    if(!proof?.before||!proof.after)note('Missing verified enrollment write audit');
    else if(enrollmentAuditFields.some(field=>proof.before[field]!==0||proof.after[field]!==0))note('Unexpected business record or seat hold for the synthetic learner',undefined,true);
    else enrollmentAudits++;
  }
  for(const attempt of record.providerAttempts){
    const model=providerAttempts[attempt.model]??{successful:0,failed:0};
    if(attempt.failed)model.failed++;
    else model.successful++;
    providerAttempts[attempt.model]=model;
  }
  for(const [offset,turn] of record.turns.entries()){
    const n=offset+1;
    const action=turn.enrollment;
    if(turn.status!==200||turn.state!=='completed')note('Model response incomplete',n);
    if(turn.modelUsed)models[turn.modelUsed]=(models[turn.modelUsed]??0)+1;
    if(turn.elapsedMs)latency.push(turn.elapsedMs);
    if(action)actions[action.kind]=(actions[action.kind]??0)+1;
    for(const link of turn.links){
      if(link.status!==200)note('Destination returned '+link.status+': '+link.href,n,true);
    }
    for(const row of action?.rows??[]){
      const truth=publicClasses.get(row.id);
      if(!truth){note('Recommended class absent from public snapshot: '+row.id,n,true);continue;}
      for(const field of ['price','standardPrice','firstLesson','sessions','minutes','availability','weeklySchedule']){
        if(JSON.stringify(row[field])!==JSON.stringify(truth[field]))note('Public class snapshot mismatch in '+field+': '+row.id,n,true);
      }
    }
    for(const quote of action?.quotes??[]){
      const truth=quote.unitPriced?publicAppointments.get(quote.id):publicClasses.get(quote.id);
      if(!truth||truth.price!==quote.actual||truth.standardPrice!==quote.standard||truth.minutes!==quote.minutes||
        (quote.unitPriced?truth.lessons:truth.sessions)!==quote.periods){
        note('Public quote snapshot mismatch: '+quote.id,n,true);
      }
    }
  }
}
const required=run.cases.flatMap((id:string)=>Array.from({length:run.repeat},(_,index)=>id+'-'+(index+1)));
const missing=required.filter((key:string)=>!evidence.has(key));
if(loaded.includes('errors.json')){
  for(const failure of await read(join(directory,'errors.json'))){
    checks.push({case:failure.id+'-'+failure.index,issue:failure.error});
  }
}
const reviewRows=required.map((key:string)=>{
  const item=suite.cases.find((candidate:any)=>candidate.id===key.split('-')[0]);
  return {key,eligible:item.eligible!==false,expected:item.expected,reviewerA:null,reviewerB:null,adjudication:null};
});
const average=(numbers:number[])=>numbers.reduce((sum,value)=>sum+value,0)/numbers.length;
const measure=(dimensions:readonly string[],scores:Record<string,number>)=>average(dimensions.map(name=>{
  const score=scores[name];assert.ok(Number.isInteger(score)&&score>=1&&score<=5,'Invalid score for '+name);
  return score;
}));
let judgement;
if(process.argv[3]){
  const reviews=await read(process.argv[3]);
  const reviewsByKey=new Map<string,any>(reviews.map((row:any)=>[row.key,row]));
  let resolved=0,eligibleResolved=0,eligibleCount=0,critical=0;
  const causes:Record<string,number>={};
  const scored=reviewRows.map((row:any)=>{
    const review=reviewsByKey.get(row.key);
    assert.ok(review?.reviewerA&&review?.reviewerB,'Both reviews required: '+row.key);
    const {reviewerA:a,reviewerB:b,adjudication:c}=review;
    const disputed=a.resolved!==b.resolved||Boolean(a.severe)!==Boolean(b.severe)||
      [...learnerDimensions,...businessDimensions].some(dimension=>Math.abs(a.scores[dimension]-b.scores[dimension])>=2);
    assert.ok(!disputed||c?.evidence,'Adjudication with evidence required: '+row.key);
    for(const person of [a,b,...(c?[c]:[])]){
      assert.ok(typeof person.resolved==='boolean'&&typeof person.severe==='boolean'&&typeof person.evidence==='string'&&person.evidence.trim());
      measure([...learnerDimensions,...businessDimensions],person.scores);
    }
    const accepted=c??a;
    if(accepted.resolved)resolved++;
    if(row.eligible){eligibleCount++;if(accepted.resolved)eligibleResolved++;}
    if(accepted.severe)critical++;
    if(accepted.cause)causes[accepted.cause]=(causes[accepted.cause]??0)+1;
    const learner=c?measure(learnerDimensions,c.scores):average([measure(learnerDimensions,a.scores),measure(learnerDimensions,b.scores)]);
    const business=c?measure(businessDimensions,c.scores):average([measure(businessDimensions,a.scores),measure(businessDimensions,b.scores)]);
    return {key:row.key,learner,business,resolved:accepted.resolved,severe:accepted.severe,
      cause:accepted.cause,evidence:accepted.evidence};
  });
  const base=scored.filter((row:any)=>Number(row.key.split('-')[0])<=8);
  const allScenarioResolution=resolved/scored.length;
  const eligibleResolution=eligibleCount?eligibleResolved/eligibleCount:null;
  const learnerMean=average(scored.map((row:any)=>row.learner));
  const businessMean=average(scored.map((row:any)=>row.business));
  const complete=required.length===suite.cases.length&&run.repeat===1&&!missing.length&&base.length===8;
  judgement={allScenarioResolution,eligibleResolution,learnerMean,businessMean,critical,causes,scored,
    meetsThreshold:complete&&checks.length===0&&critical===0&&eligibleResolution!==null&&eligibleResolution>=suite.thresholds.eligibleResolution&&
      learnerMean>=suite.thresholds.learnerMean&&businessMean>=suite.thresholds.businessMean&&
      base.every((row:any)=>row.learner>=suite.thresholds.baseCaseMinimum&&row.business>=suite.thresholds.baseCaseMinimum)};
}
latency.sort((a,b)=>a-b);
const result={suite:suite.version,build:run.version.backend.buildId,cases:evidence.size,requests:latency.length,
  successfulReplies:Object.values(models).reduce((a,b)=>a+b,0),
  medianElapsedMs:latency.length?latency[Math.floor(latency.length/2)]:null,models,providerAttempts,actions,missing,checks,enrollmentAudits,
  reviewStatus:judgement?'scored':'awaiting-two-reviewers',judgement};
await writeFile(join(directory,'score.json'),JSON.stringify(result,null,2)+'\n');
if(!process.argv[3])await writeFile(join(directory,'review-template.json'),JSON.stringify(reviewRows,null,2)+'\n',{flag:'wx'}).catch(error=>{
  if(error.code!=='EEXIST')throw error;
});
console.log(JSON.stringify(result,null,2));
