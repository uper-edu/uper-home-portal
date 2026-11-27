import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runTool} from './chat-consultation-process.mjs';
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,rename,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {comparisonDifferences,evaluateGates,gateVersion,type Gate,type Run,type Transcript} from './chat-consultation-gates.mts';

const {values:options}=parseArgs({options:{
  output:{type:'string'},baseline:{type:'string'},'baseline-build':{type:'string'},candidate:{type:'string'},
  cases:{type:'string'},model:{type:'string'},repeat:{type:'string'},worker:{type:'string'},resume:{type:'boolean'},
  answer:{type:'string'},judge:{type:'string'},
}});
assert.ok(options.output,'Pass --output with the path for evaluation evidence.');
const directory=resolve(options.output);
const checkpoint=join(directory,'loop.json');
const read=async<T>(path:string)=>JSON.parse(await readFile(path,'utf8')) as T;
const save=(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const loadFixture=async()=>read<{checks:Gate[]}>(fileURLToPath(new URL('../tests/fixtures/chat-consultation-regressions.json',import.meta.url)));
const {checks:gates}=await loadFixture();
const evaluationScript=fileURLToPath(new URL('./evaluate-chat-consultation.mts',import.meta.url));
const scoringScript=fileURLToPath(new URL('./score-chat-consultation.mts',import.meta.url));

type Evaluation={path:string;manifest:Run;gates:ReturnType<typeof evaluateGates>;
  findings:Array<{case:string;turn?:number;issue:string;severe?:boolean}>;missing:string[];judgement?:{
    complete:boolean;meetsThreshold:boolean;allScenarioResolution:number;learnerMean:number;businessMean:number;critical:number;
  }};
type Decision={id:string;question:string;options:string[]};
type State={status:string;baseline:string;baselineBuild:string;baselineDigest:string;candidate?:string;worker?:string;judge?:string;question?:Decision;
  model?:string;report?:unknown;attempts?:AttemptFailure[]};
type AttemptFailure={attempt:number;reason:string;evidence?:string;failed?:ReturnType<typeof diagnosis>['failed'];patch?:string};
type WorkerResponse={kind:'build';buildId:string;patch?:string}|{kind:'failed';reason:string;patch?:string}|{kind:'question';decision:Decision}|{kind:'no_candidate';reason:string};

function runCapture(buildId:string,output:string,plan:{cases?:string;repeat:number;model:string}){
  const args=['--import','tsx',evaluationScript,'--live','--build='+buildId,'--model='+plan.model,
    '--repeat='+plan.repeat,'--audit-verified-links','--output',output,
    ...(plan.cases?['--cases='+plan.cases]:['--with-regressions'])];
  const result=spawnSync(process.execPath,args,{stdio:'inherit',timeout:20*60_000});
  if(result.error)throw result.error;
  // The scorer will keep failed requests and missing evidence as findings.
  if(result.status===null)throw Error('Evaluation was terminated before evidence was saved.');
}

async function evaluate(path:string,judge?:string):Promise<Evaluation>{
  const manifest=await read<Run>(join(path,'run.json'));
  assert.equal(manifest.version.consistent,true,'Evidence must identify a consistent build.');
  assert.ok(manifest.fixtureDigest&&manifest.expectedModel&&manifest.auditVerifiedLinks,
    'Capture an exact fixture, an expected model and a verified write audit for both builds.');
  const records=new Map<string,Transcript>();
  const files=await readdir(path);
  for(const name of files.filter(file=>/^(?:\d\d|F\d+)-\d+\.json$/.test(file))){
    records.set(name.slice(0,-5),await read<Transcript>(join(path,name)));
  }
  if(judge&&!files.includes('reviews.json')){
    const cases=[...(await read<{cases:unknown[]}>(fileURLToPath(new URL('../tests/fixtures/chat-consultation-v1.json',import.meta.url)))).cases,
      ...(await read<{cases:unknown[]}>(fileURLToPath(new URL('../tests/fixtures/chat-consultation-regressions.json',import.meta.url)))).cases] as
      Array<{id:string;expected:string[]}>;
    const samples=[...records.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,record])=>({
      key,expected:cases.find(item=>item.id===record.id)?.expected,
      turns:record.turns.map(({input,reply,links,enrollment})=>({input,reply,links,enrollment})),
    }));
    const grades=invokeWorker(judge,{kind:'grade',gateVersion,samples,catalog:manifest.catalog,intake:manifest.intake});
    assert.ok(Array.isArray(grades),'Expected a list of two-reviewer scores.');
    await save(join(path,'reviews.json'),grades);
    files.push('reviews.json');
  }
  const score=spawnSync(process.execPath,['--import','tsx',scoringScript,path,
    ...(files.includes('reviews.json')?[join(path,'reviews.json')]:[])],{encoding:'utf8',timeout:30_000});
  if(score.status!==0)throw Error('Could not score evidence in '+path+': '+(score.stderr||score.error?.message||'unknown error').trim());
  const verdict=await read<{checks:Evaluation['findings'];missing:string[];judgement?:Evaluation['judgement']}>(join(path,'score.json'));
  const results=evaluateGates(manifest,records,gates);
  assert.ok(results.length,'The run did not contain any registered regression checks.');
  return {path,manifest,gates:results,findings:verdict.checks,missing:verdict.missing,judgement:verdict.judgement};
}

function diagnosis(evaluation:Evaluation){
  return {
    failed:evaluation.gates.filter(gate=>!gate.pass),findings:evaluation.findings,missing:evaluation.missing,
    passes:evaluation.gates.filter(gate=>gate.pass).length,total:evaluation.gates.length,
    ...(evaluation.judgement?{quality:evaluation.judgement}:{}),
  };
}

function invokeWorker(worker:string,request:unknown):unknown{
  const result=runTool(worker,[],{input:JSON.stringify(request),encoding:'utf8',timeout:15*60_000,maxBuffer:256_000});
  if(result.status!==0)throw Error('Evaluation worker failed: '+(result.error?.message||result.stderr.trim()||result.status));
  return JSON.parse(result.stdout);
}

function workerResponse(worker:string,request:unknown):WorkerResponse{
  const reply=invokeWorker(worker,request) as WorkerResponse;
  if(reply.kind==='build')assert.match(reply.buildId,/^[a-z0-9-]{6,100}$/);
  else if(reply.kind==='question'){
    const {id,question,options}=reply.decision;
    assert.ok(typeof id==='string'&&id.trim()&&typeof question==='string'&&question.trim()&&
      Array.isArray(options)&&options.every(option=>typeof option==='string'&&option.trim()));
  }else assert.ok((reply.kind==='no_candidate'||reply.kind==='failed')&&typeof reply.reason==='string');
  return reply;
}

async function finish(state:State){
  const temporary=checkpoint+'.'+process.pid;
  await save(temporary,state);
  await rename(temporary,checkpoint);
  console.log(JSON.stringify(state,null,2));
  if(['incomparable','rejected','incomplete_baseline','no_candidate','restore_failed'].includes(state.status))process.exitCode=1;
  if(state.status==='needs_decision')process.exitCode=3;
}

async function execute(){
  await mkdir(directory,{recursive:true,mode:0o700});
  let prior:State|undefined;
  if(options.resume){
    prior=await read<State>(checkpoint);
    assert.ok(prior.status==='needs_decision'&&prior.question&&options.answer?.trim(),
      'Resume a pending decision with --resume --answer.');
    assert.ok(!options.baseline&&!options['baseline-build']&&!options.candidate&&!options.worker&&!options.judge&&!options.model&&!options.cases&&!options.repeat,
      'Resuming keeps the same baseline, candidate worker and run settings.');
  }else{
    const existing=await readdir(directory);
    assert.ok(!existing.includes('loop.json'),'Use an empty output directory for a new run.');
    assert.ok(Boolean(options.baseline)!==Boolean(options['baseline-build']),'Specify --baseline or --baseline-build.');
  }
  const baselinePath=prior?.baseline??resolve(options.baseline??join(directory,'baseline'));
  if(options['baseline-build']){
    assert.ok(options.model,'Provide --model so both real runs can verify the actual model.');
    const repeat=Number(options.repeat??2);
    assert.ok(Number.isInteger(repeat)&&repeat>=1&&repeat<=3);
    runCapture(options['baseline-build'],baselinePath,{cases:options.cases,repeat,model:options.model});
  }
  const judge=prior?.judge??(options.judge?resolve(options.judge):undefined);
  const baseline=await evaluate(baselinePath,judge);
  const baselineDigest=createHash('sha256').update(JSON.stringify({manifest:baseline.manifest,gates:baseline.gates,
    findings:baseline.findings,missing:baseline.missing})).digest('hex');
  if(prior)assert.equal(baselineDigest,prior.baselineDigest,'Baseline evidence changed after the decision was requested.');
  const state:State={status:'evaluating',baseline:baselinePath,baselineBuild:baseline.manifest.version.backend.buildId,
    baselineDigest,worker:prior?.worker??(options.worker?resolve(options.worker):undefined),judge,model:baseline.manifest.expectedModel};
  const before=diagnosis(baseline);
  if(baseline.missing.length||baseline.gates.some(gate=>gate.layer==='execution')){
    return finish({...state,status:'incomplete_baseline',report:before});
  }
  const attempts=prior?.attempts??[];
  const verdict=(path:string)=>compareCandidates(path,baseline,judge,state.baselineBuild);
  if(options.candidate){
    const candidate=resolve(options.candidate);
    return finish({...state,candidate,...await verdict(candidate)});
  }
  if(!before.failed.length&&!before.findings.length&&!before.quality?.critical&&
    !(before.quality?.complete&&!before.quality.meetsThreshold))
    return finish({...state,status:'no_regression_found',report:before});
  const worker=state.worker;
  if(!worker)return finish({...state,status:'diagnosed',report:before});
  for(let attempt=attempts.length+1;attempt<=2;attempt++){
    let evidence:string|undefined,patch:string|undefined;
    let result:Awaited<ReturnType<typeof verdict>>|undefined;
    let reason:string;
    try{
      const response=workerResponse(worker,{
        kind:'repair_and_load',build:state.baselineBuild,evidence:baselinePath,findings:before,gateVersion,
        attempt,previousFailure:attempts.at(-1),
        decision:prior?.question?{id:prior.question.id,answer:options.answer}:undefined,
      });
      if(response.kind==='question')return finish({...state,status:'needs_decision',question:response.decision,attempts,report:before});
      if(response.kind==='no_candidate')return finish({...state,status:'no_candidate',attempts,report:{before,reason:response.reason}});
      patch=response.patch;
      if(response.kind==='failed')throw Error(response.reason);
      assert.notEqual(response.buildId,state.baselineBuild,'The candidate must identify a different build.');
      evidence=join(directory,'candidate-'+attempt);
      runCapture(response.buildId,evidence,{cases:baseline.manifest.cases.join(','),repeat:baseline.manifest.repeat,model:state.model!});
      result=await verdict(evidence);
      if(result.status==='targeted_pass'||result.status==='quality_pass')
        return finish({...state,candidate:evidence,attempts,...result});
      reason=result.status==='incomparable'?'Candidate evidence is incomparable: '+result.report.differences.join(', '):
        'Candidate did not pass the acceptance checks.';
    }catch(error){
      reason=error instanceof Error?error.message:String(error);
    }
    attempts.push({attempt,reason,evidence,failed:result?.report.after.failed,patch});
    try{
      const restored=invokeWorker(worker,{kind:'restore_baseline',build:state.baselineBuild}) as {kind:string;buildId:string};
      assert.ok(restored.kind==='restored'&&restored.buildId===state.baselineBuild,'The baseline build was not confirmed after restoration.');
    }catch(error){
      return finish({...state,status:'restore_failed',attempts,report:{before,restoreError:String(error)}});
    }
    if(attempt===2||result?.status==='incomparable')
      return finish({...state,status:result?.status==='incomparable'?'incomparable':'rejected',
        candidate:evidence,attempts,report:{...result?.report,before,restoredBuild:state.baselineBuild}});
  }
}

async function compareCandidates(candidatePath:string,baseline:Evaluation,judge:string|undefined,baselineBuild:string){
  const before=diagnosis(baseline);
  const candidate=await evaluate(candidatePath,judge);
  const after=diagnosis(candidate);
  const differences:string[]=comparisonDifferences(baseline.manifest,candidate.manifest);
  if(candidate.manifest.version.backend.buildId===baselineBuild)differences.push('build');
  const reference=new Map(before.failed.map(gate=>[gate.id+'-'+gate.repetition,gate]));
  const fixed=candidate.gates.filter(gate=>gate.pass&&reference.has(gate.id+'-'+gate.repetition)).map(gate=>gate.id+'-'+gate.repetition);
  const severe=candidate.gates.some(gate=>!gate.pass&&gate.critical)||
    candidate.findings.some(finding=>finding.severe)||(after.quality?.critical??0)>0;
  const qualityRegressed=before.quality&&after.quality&&(
    after.quality.learnerMean<before.quality.learnerMean||
    after.quality.businessMean<before.quality.businessMean||
    after.quality.allScenarioResolution<before.quality.allScenarioResolution);
  const status=differences.length?'incomparable':
    severe||after.failed.length||after.findings.length||after.missing.length||qualityRegressed||
      (after.quality?.complete&&!after.quality.meetsThreshold)?'rejected':
    before.quality&&after.quality?.meetsThreshold?'quality_pass':'targeted_pass';
  return {status,report:{gateVersion,before,after,fixed,differences,severe,qualityRegressed,
    candidateBuild:candidate.manifest.version.backend.buildId,
    scope:baseline.manifest.cases,repetitions:baseline.manifest.repeat}};
}

await execute();
