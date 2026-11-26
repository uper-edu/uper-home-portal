import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmod,mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

const script=new URL('../scripts/run-chat-consultation-loop.mts',import.meta.url);
const json=async(path,value)=>writeFile(path,JSON.stringify(value));
const evaluate=(output,...args)=>spawnSync(process.execPath,
  ['--import','tsx',fileURLToPath(script),'--output',output,...args],{encoding:'utf8'});
const read=async(path)=>JSON.parse(await readFile(path,'utf8'));
const model='gpt-6.2-sol';

test('strict schedule regression distinguishes a lookup promise from a no-match result',async()=>{
  const {evaluateGates}=await import('../scripts/chat-consultation-gates.mts');
  const gate={id:'strict_local_time_no_match',case:'30',turn:1,rule:'strict_local_time_no_match',critical:false};
  const check=reply=>evaluateGates({cases:['30'],repeat:1,expectedModel:model},new Map([
    ['30-1',{turns:[{reply,status:200,state:'completed',modelUsed:model}]}],
  ]),[gate])[0].pass;
  assert.equal(check('东京下午三点是 WIB 13:00。我会查有没有符合条件的班次。'),false);
  assert.equal(check('东京下午三点是 WIB 13:00。目前没有符合这个时段的班次。'),true);
});

async function fixture(directory,{pass,build,effort='low'}){
  await mkdir(directory);
  await json(join(directory,'run.json'),{
    version:{consistent:true,backend:{buildId:build}},suite:'uper-chat-consultation-v1',fixtureDigest:'fixture',
    cases:['F2'],repeat:1,jakartaDate:'2026-11-21',expectedModel:model,selection:{primary:{model,effort}},
    catalog:{classes:[],appointments:[]},intake:{accepting:true},auditVerifiedLinks:true,
  });
  const audited={orders:0,orderSeats:0,transferHolds:0,waitlist:0,demands:0,customerRecords:0};
  const base={status:200,state:'completed',modelUsed:model,reply:'上传凭证后还需要等财务核实。',links:[
    {href:'/enrollment/mine?lang=zh&enrollment_via=ai_chat',status:200},
  ]};
  await json(join(directory,'F2-1.json'),{
    id:'F2',repetition:1,opportunityCount:0,enrollmentAudit:{before:audited,after:audited},
    turns:[base,{...base,assistantId:'turn-2',reply:pass?'不用再付。核对原订单。':base.reply},base],
    providerAttempts:[{message_id:'turn-2',model,failed:0,content:JSON.stringify({
      enrollment:{kind:'records',question:pass?'avoid_duplicate_payment':'payment_verification'},
    })}],
  });
}

test('the loop detects a completed but unsafe turn, accepts the repair, and rejects incomparable runs',async()=>{
  const work=await mkdtemp(join(tmpdir(),'chat-loop-'));
  try{
    const baseline=join(work,'old'),candidate=join(work,'new'),mismatch=join(work,'mismatch');
    await fixture(baseline,{pass:false,build:'baseline'});
    await fixture(candidate,{pass:true,build:'candidate'});
    await fixture(mismatch,{pass:true,build:'other',effort:'high'});
    const success=join(work,'success');
    const pass=evaluate(success,'--baseline',baseline,'--candidate',candidate);
    assert.equal(pass.status,0,pass.stderr);
    const state=await read(join(success,'loop.json'));
    assert.equal(state.status,'targeted_pass');
    assert.equal(state.report.before.failed[0].layer,'intent');
    assert.equal(state.report.before.failed[0].critical,true);
    assert.deepEqual(state.report.fixed,['duplicate-transfer-1']);
    const other=join(work,'other');
    assert.equal(evaluate(other,'--baseline',baseline,'--candidate',mismatch).status,1);
    assert.deepEqual((await read(join(other,'loop.json'))).report.differences,['selection']);
  }finally{await rm(work,{recursive:true,force:true});}
});

test('the loop checkpoints a business decision and passes the answer back on the same run',async()=>{
  const work=await mkdtemp(join(tmpdir(),'chat-loop-'));
  try{
    const baseline=join(work,'old');
    await fixture(baseline,{pass:false,build:'baseline'});
    const worker=join(work,'worker.mjs'),output=join(work,'output');
    await writeFile(worker,`#!${process.execPath}
import {readFileSync} from 'node:fs';
const input=JSON.parse(readFileSync(0,'utf8'));
const reply=input.decision
  ? {kind:'no_candidate',reason:input.build+' '+input.decision.id+' '+input.decision.answer}
  : {kind:'question',decision:{id:'order-policy',question:'应采用哪个业务规则？',options:['沿用当前规则','更新规则']}};
process.stdout.write(JSON.stringify(reply));`);
    await chmod(worker,0o700);
    const ask=evaluate(output,'--baseline',baseline,'--worker',worker);
    assert.equal(ask.status,3,ask.stderr);
    assert.equal((await read(join(output,'loop.json'))).question.id,'order-policy');
    const resume=evaluate(output,'--resume','--answer','沿用当前规则');
    assert.equal(resume.status,1,resume.stderr);
    const state=await read(join(output,'loop.json'));
    assert.equal(state.status,'no_candidate');
    assert.equal(state.report.reason,'baseline order-policy 沿用当前规则');
  }finally{await rm(work,{recursive:true,force:true});}
});

test('the loop sends failed candidate evidence back once and verifies restoration after each failure',async()=>{
  const work=await mkdtemp(join(tmpdir(),'chat-loop-'));
  try{
    const baseline=join(work,'old'),output=join(work,'output'),worker=join(work,'worker.mjs');
    const calls=join(work,'calls.jsonl');
    await fixture(baseline,{pass:false,build:'baseline'});
    await writeFile(worker,`#!${process.execPath}
import assert from 'node:assert/strict';
import {appendFileSync,readFileSync} from 'node:fs';
const input=JSON.parse(readFileSync(0,'utf8'));
appendFileSync(${JSON.stringify(calls)},JSON.stringify(input)+'\\n');
assert.equal(input.build,'baseline');
const reply=input.kind==='restore_baseline'?{kind:'restored',buildId:'baseline'}:
  {kind:'failed',reason:'original assertion failed',patch:'candidate-'+input.attempt};
process.stdout.write(JSON.stringify(reply));`);
    await chmod(worker,0o700);
    const run=evaluate(output,'--baseline',baseline,'--worker',worker);
    assert.equal(run.status,1,run.stderr);
    const seen=(await readFile(calls,'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(seen.map(call=>call.kind),['repair_and_load','restore_baseline','repair_and_load','restore_baseline']);
    assert.equal(seen[2].previousFailure.reason,'original assertion failed');
    assert.equal(seen[2].previousFailure.patch,'candidate-1');
    const data=await read(join(output,'loop.json'));
    assert.equal(data.status,'rejected');
    assert.equal(data.report.restoredBuild,'baseline');
    assert.equal(data.attempts.length,2);
  }finally{await rm(work,{recursive:true,force:true});}
});

test('the candidate adapter checks a generated patch before asking the local loader to run it',async()=>{
  const work=await mkdtemp(join(tmpdir(),'chat-loop-'));
  try{
    const baseline=join(work,'old');
    await fixture(baseline,{pass:false,build:'baseline'});
    const codingCli=join(work,'coding-cli.mjs'),loader=join(work,'loader.mjs');
    await writeFile(codingCli,`#!${process.execPath}
import {writeFileSync} from 'node:fs';
const output=process.argv[process.argv.indexOf('--output-last-message')+1];
writeFileSync(output,JSON.stringify({kind:'patch',patch:process.env.TEST_PATCH,reason:'Programmatic fixture',question:''}));`);
    await writeFile(loader,`#!${process.execPath}
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const input=JSON.parse(readFileSync(0,'utf8'));
assert.deepEqual(input.touched,['server/portal/chat.ts']);
assert.equal(input.baselineBuild,'baseline');
assert.equal(process.cwd(),input.source);
process.stdout.write(JSON.stringify({kind:'build',buildId:'candidate'}));`);
    await chmod(codingCli,0o700);
    await chmod(loader,0o700);
    const adapter=new URL('../scripts/chat-consultation-codex-worker.mjs',import.meta.url);
    const edit=(path,lines)=>`diff --git a/${path} b/${path}
--- a/${path}
+++ b/${path}
@@ -1,3 +1,4 @@
 ${lines[0]}
+// Candidate fixture.
 ${lines[1]}
 ${lines[2]}
`;
    const attempt=(patch)=>spawnSync(process.execPath,[fileURLToPath(adapter)],{
      encoding:'utf8',input:JSON.stringify({kind:'repair_and_load',evidence:baseline,build:'baseline',findings:{failed:[]}}),
      env:{...process.env,UPER_CHAT_EVAL_CODEX:codingCli,UPER_CHAT_EVAL_LOCAL_LOADER:loader,TEST_PATCH:patch},
    });
    const first=(await readFile('server/portal/chat.ts','utf8')).split('\n').slice(0,3);
    const pass=attempt(edit('server/portal/chat.ts',first));
    assert.equal(pass.status,0,pass.stderr);
    assert.equal(JSON.parse(pass.stdout).buildId,'candidate');
    const reject=attempt(edit('tests/fixtures/chat-consultation-v1.json',['{','  "version": "ignored",','}']));
    assert.equal(reject.status,1);
    assert.match(reject.stderr,/outside the allowed consultation source/);
  }finally{await rm(work,{recursive:true,force:true});}
});

test('the automatic judge masks the build and adjudicates discrepant reviews',async()=>{
  const work=await mkdtemp(join(tmpdir(),'chat-judge-'));
  try{
    const cli=join(work,'coding-cli.mjs');
    await writeFile(cli,`#!${process.execPath}
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const input=readFileSync(0,'utf8');
const samples=JSON.parse(input.trim().split('\\n').at(-1)).samples;
const isLearner=input.includes('viewpoint: learner');
const isAdjudicator=input.includes('viewpoint: adjudicator');
assert.ok(!input.includes('unmasked-build'));
assert.equal(Boolean(samples[0].reviewerA),isAdjudicator);
const reviews=samples.map(sample=>({key:sample.key,resolved:!isLearner,severe:false,
  evidence:'第 2 轮给出了核对步骤。',cause:'none',
  scores:Object.fromEntries(['courtesy','clarity','context','accuracy','initiative','need','match','nextStep','conversionQuality'].map(key=>[key,4]))}));
writeFileSync(process.argv[process.argv.indexOf('--output-last-message')+1],JSON.stringify({reviews}));`);
    await chmod(cli,0o700);
    const judge=new URL('../scripts/chat-consultation-codex-judge.mjs',import.meta.url);
    const run=spawnSync(process.execPath,[fileURLToPath(judge)],{encoding:'utf8',
      env:{...process.env,UPER_CHAT_EVAL_CODEX:cli},input:JSON.stringify({kind:'grade',samples:[{key:'F2-1',expected:['核对原订单']}],catalog:{},intake:{}})});
    assert.equal(run.status,0,run.stderr);
    const [scored]=JSON.parse(run.stdout);
    assert.equal(scored.reviewerA.resolved,false);
    assert.equal(scored.reviewerB.resolved,true);
    assert.equal(scored.adjudication.resolved,true);
  }finally{await rm(work,{recursive:true,force:true});}
});
