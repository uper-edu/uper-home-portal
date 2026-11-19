import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {readEnvironment} from '../server/environment.mjs';
import {openTrialDatabase,transaction,validateTrialDatabase} from '../cloud/mysql/database.mjs';
import {newHskAttempt} from '../src/data/hskAssessment';
import {getVersionQuestions} from '../src/data/hskAssessmentVersions';
import {enrollmentGuideHref,type EnrollmentGuideAction} from '../src/utils/enrollmentGuidance';

type Case={id:string;name:string;turns:string[];expected:string[];source?:string;reported?:string;scores?:number[];
  assessmentAfterTurns?:boolean;profileIntroduction?:boolean;buyingSignal?:string;interfaceLanguage?:'zh'|'en'|'id'};
const suite=JSON.parse(await readFile(new URL('../tests/fixtures/chat-consultation-v1.json',import.meta.url),'utf8'));
const cases=suite.cases as Case[];
assert.ok(cases.length>=30&&new Set(cases.map(test=>test.id)).size===cases.length);
if(!process.argv.includes('--live')){
  const check=spawnSync(process.execPath,['--import','tsx','--test','tests/enrollmentGuidance.test.ts','tests/chatConsultationEval.test.ts'],{stdio:'inherit'});
  process.exit(check.status??1);
}
const outputIndex=process.argv.indexOf('--output');
const output=resolve(outputIndex<0?'data/chat-consultation-eval/'+Date.now():process.argv[outputIndex+1]);
const selected=process.argv.find(arg=>arg.startsWith('--cases='))?.slice(8).split(',');
const plan=selected?selected.map(key=>{
  const item=cases.find(test=>test.id===key);
  assert.ok(item,'Unknown case: '+key);
  return item;
}):cases;
const repeat=Number(process.argv.find(arg=>arg.startsWith('--repeat='))?.slice(9)??1);
assert.ok(Number.isInteger(repeat)&&repeat>=1&&repeat<=3);
const auditVerifiedLinks=process.argv.includes('--audit-verified-links');
const origin='http://localhost:3000';
const request=async(path:string,options?:RequestInit)=>{
  const target=new URL(path,origin);
  assert.equal(target.origin,origin);
  return fetch(target,{...options,redirect:'manual',signal:AbortSignal.timeout(110_000)});
};
const read=async(path:string)=>{
  const response=await request(path);
  assert.equal(response.status,200);
  return response.json();
};
const version=await read('/api/version');
assert.ok(version.consistent&&version.environment==='dev');
const expectedBuild=process.argv.find(arg=>arg.startsWith('--build='))?.slice(8);
assert.equal(version.backend.buildId,expectedBuild,'Pass the exact expected build with --build=');
const {values}=readEnvironment('dev');
const config=validateTrialDatabase(values);
assert.equal(config.name,'uper_local_crm');
assert.equal(config.url.hostname,'localhost');
assert.equal(values.MYSQL_TRIAL_SOCKET,'/private/tmp/uper-crm-mysql-local3000.sock');
const db=await openTrialDatabase(values);
const rows=async(sql:string,parameters:unknown[]=[])=>((await db.execute(sql,parameters))[0] as Record<string,any>[]);
const save=(file:string,value:unknown)=>writeFile(join(output,file),JSON.stringify(value,null,2)+'\n',{mode:0o600});

async function enrollmentActivity(email:string,lead:string|null){
  const [record]=await rows(`SELECT
    (SELECT COUNT(*) FROM enrollment_orders WHERE email=?) AS orders,
    (SELECT COUNT(*) FROM enrollment_orders WHERE email=? AND state NOT IN ('expired','ended','refunding','refunded')) AS orderSeats,
    (SELECT COUNT(*) FROM enrollment_transfer_invitations i JOIN enrollment_orders o ON o.id=i.order_id
      WHERE o.email=? AND i.state='offered') AS transferHolds,
    (SELECT COUNT(*) FROM enrollment_waitlist WHERE email=?) AS waitlist,
    (SELECT COUNT(*) FROM enrollment_demands WHERE email=?) AS demands,
    (SELECT COUNT(*) FROM enrollment_customer_records WHERE lead_id=?) AS customerRecords`,[email,email,email,email,email,lead]);
  return Object.fromEntries(Object.entries(record).map(([key,value])=>[key,Number(value)]));
}

async function run(item:Case,index:number){
  const visitor=randomBytes(32).toString('hex');
  const scope=createHash('sha256').update(visitor).digest('hex');
  const lead=item.reported?randomUUID():null;
  const email=`chateval-${visitor}@example.invalid`;
  const token=auditVerifiedLinks?randomBytes(32).toString('hex'):undefined;
  const digest=token?createHash('sha256').update(token).digest('hex'):undefined;
  const label='CHATEVAL-'+item.id+'-'+visitor.slice(0,8);
  const source=item.source??'standalone_chat';
  const interfaceLanguage=item.interfaceLanguage??'zh';
  const headers={'content-type':'application/json',origin,cookie:'uper_visitor='+visitor,'x-visitor-scope':scope};
  const submit=(path:string,body:unknown)=>request(path,{method:'POST',headers,body:JSON.stringify(body)});
  const transcript={id:item.id,name:item.name,source,repetition:index,assessment:undefined as unknown,
    turns:[] as Record<string,any>[],providerAttempts:[] as unknown[],opportunityCount:0,
    enrollmentAudit:undefined as {before:Record<string,number>;after?:Record<string,number>}|undefined};
  let ready=false;
  try{
    await transaction(db,async c=>{
      if(lead){
        const buyingSignal=item.buyingSignal??'Which level is right';
        const profile={id:lead,name:'模拟学员 '+item.id,goal:'Improve my Mandarin skills',reportedLevel:item.reported,
          city:'Jakarta',mode:'Online',buyingSignal,...(item.buyingSignal?{buyingSignals:[buyingSignal]}:{}),currentStage:'progress:unreached'};
        await c.execute('INSERT INTO portal_leads(id,business_number,profile) VALUES(?,?,?)',[lead,label,JSON.stringify(profile)]);
      }
      await c.execute('INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES(?,?,UTC_TIMESTAMP()+INTERVAL 3 HOUR)',[visitor,lead]);
      if(digest)await c.execute('INSERT INTO enrollment_email_sessions(digest,email,expires_at) VALUES(?,?,UTC_TIMESTAMP()+INTERVAL 1 HOUR)',[digest,email]);
    });
    ready=true;
    const verifiedOrderList=async()=>{
      const response=await request('/api/enrollment/orders',{headers:{cookie:`uper_enrollment_session=${token}`}});
      assert.equal(response.status,200,'Synthetic Enrollment session was not accepted');
      const result=await response.json();
      assert.deepEqual(result.orders,[]);
      assert.deepEqual(result.applications,[]);
    };
    if(token){
      await verifiedOrderList();
      transcript.enrollmentAudit={before:await enrollmentActivity(email,lead)};
    }
    const started=await submit('/api/portal/conversations',{source});
    assert.equal(started.status,200);
    const {conversationId}=await started.json();

    async function chat(input:string,body:{content?:string;assessmentAttemptId?:string;consultationStart?:true}){
      const clock=Date.now();
      const messageId=randomUUID();
      const requestId=body.assessmentAttemptId?'hsk-intro-'+body.assessmentAttemptId:body.consultationStart?'profile-intro-'+lead:messageId;
      const response=await submit('/api/chat',{conversationId,lang:interfaceLanguage,messageId,...body});
      const {reply,enrollment,modelUsed,status,error}=await response.json();
      const turn={input,requestId,status:response.status,reply,error,modelUsed,state:status,elapsedMs:Date.now()-clock,
        enrollment:enrollment as EnrollmentGuideAction|undefined,links:[] as unknown[]};
      transcript.turns.push(turn);
      if(enrollment){
        const actions=enrollment.rows?.length?enrollment.rows.map(row=>({...enrollment,classId:row.id,
          kind:row.availability==='full'?'waitlist':'class'} as EnrollmentGuideAction)):[enrollment];
        for(const action of actions){
          const href=enrollmentGuideHref(action,enrollment.replyLanguage??interfaceLanguage,'ai_chat');
          const page=await request(href,{headers:{cookie:headers.cookie}});
          turn.links.push({href,status:page.status,robots:page.headers.get('x-robots-tag')});
          await page.body?.cancel();
        }
      }
      console.log(item.id,index,transcript.turns.length,response.status,modelUsed??'—',enrollment?.kind??'—');
    }
    async function assess(scores:number[]){
      const attempt=newHskAttempt('express',randomUUID());
      attempt.completedAt=new Date().toISOString();
      for(const [ordinal,level] of ['HSK 1','HSK 2','HSK 3'].entries()){
        getVersionQuestions('express').filter(question=>question.level===level).forEach((question,n)=>{
          attempt.answers[question.id]=question.options.find(option=>option.isCorrect===(n<scores[ordinal]))!.id;
        });
      }
      const saved=await submit('/api/portal/assessments',{attempt,lang:'zh'});
      assert.equal(saved.status,200);
      const {result}=await saved.json();
      transcript.assessment={score:result?.score,maxScore:result?.maxScore};
      await chat('【系统事件】学员完成并保存测评',{assessmentAttemptId:attempt.attemptId});
    }
    if(item.profileIntroduction)await chat('【系统事件】学员完成问卷并关注学费',{consultationStart:true});
    if(item.scores&&!item.assessmentAfterTurns)await assess(item.scores);
    for(const input of item.turns)await chat(input,{content:input});
    if(item.scores&&item.assessmentAfterTurns)await assess(item.scores);
    const assistants=await rows("SELECT id,request_id FROM messages WHERE conversation_id=? AND role='assistant'",[conversationId]);
    for(const turn of transcript.turns)turn.assistantId=assistants.find(row=>row.request_id===turn.requestId)?.id;
    transcript.providerAttempts=await rows(
      'SELECT a.message_id,a.model,a.content,(a.error IS NOT NULL) AS failed FROM ai_attempts a JOIN messages m ON m.id=a.message_id WHERE m.conversation_id=? ORDER BY m.sequence,a.id',[conversationId]);
    if(lead)transcript.opportunityCount=Number((await rows('SELECT COUNT(*) AS n FROM enrollment_opportunities WHERE lead_id=?',[lead]))[0].n);
    if(transcript.enrollmentAudit){
      transcript.enrollmentAudit.after=await enrollmentActivity(email,lead);
      assert.ok(Object.values(transcript.enrollmentAudit.before).every(count=>count===0),'Synthetic learner already has enrollment records');
      assert.deepEqual(transcript.enrollmentAudit.after,transcript.enrollmentAudit.before,'Consultation or navigation wrote enrollment records');
      await verifiedOrderList();
    }
    assert.equal(transcript.opportunityCount,0);
    assert.ok(transcript.turns.every(turn=>turn.status===200&&turn.state==='completed'),'One or more AI requests failed');
  }finally{
    await save(item.id+'-'+index+'.json',transcript);
    if(ready)await transaction(db,async c=>{
      const [sessions]=await c.execute('SELECT lead_id FROM visitor_sessions WHERE id=? FOR UPDATE',[visitor]);
      assert.equal(sessions[0]?.lead_id,lead);
      if(lead){
        const [fixtures]=await c.execute('SELECT business_number FROM portal_leads WHERE id=? FOR UPDATE',[lead]);
        assert.equal(fixtures[0]?.business_number,label);
        const [opportunities]=await c.execute('SELECT COUNT(*) AS n FROM enrollment_opportunities WHERE lead_id=?',[lead]);
        assert.equal(Number(opportunities[0].n),0);
        for(const table of ['outbox','crm_ai_extractions','crm_engagements','crm_facts']){
          await c.execute('DELETE FROM '+table+' WHERE lead_id=?',[lead]);
        }
      }
      await c.execute('DELETE a FROM ai_attempts a JOIN messages m ON m.id=a.message_id JOIN conversations c ON c.id=m.conversation_id WHERE c.visitor_id=?',[visitor]);
      await c.execute('DELETE m FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.visitor_id=?',[visitor]);
      for(const table of ['hsk_attempts','conversations']){
        await c.execute('DELETE FROM '+table+' WHERE visitor_id=?',[visitor]);
      }
      await c.execute('DELETE FROM visitor_sessions WHERE id=?',[visitor]);
      if(digest)await c.execute('DELETE FROM enrollment_email_sessions WHERE digest=? AND email=?',[digest,email]);
      if(lead)await c.execute('DELETE FROM portal_leads WHERE id=?',[lead]);
    });
  }
}

try{
  await mkdir(output,{recursive:true,mode:0o700});
  const [catalog,intake]=await Promise.all([read('/api/enrollment/classes'),read('/api/enrollment/availability')]);
  await save('run.json',{suite:suite.version,version,clock:'WIB',at:new Date().toISOString(),
    catalog:{classes:catalog.classes,appointments:catalog.appointments},intake,cases:plan.map(item=>item.id),repeat,auditVerifiedLinks});
  const work=plan.flatMap(item=>Array.from({length:repeat},(_,i)=>({item,index:i+1})));
  const errors:{id:string;index:number;error:string}[]=[];
  await Promise.all(Array.from({length:3},async()=>{
    for(let job=work.shift();job;job=work.shift()){
      try{await run(job.item,job.index);}
      catch(error){errors.push({id:job.item.id,index:job.index,error:error instanceof Error?error.name+': '+error.message:'Unknown error'});}
    }
  }));
  await save('errors.json',errors);
  console.log('Consultation evidence: '+output);
  if(errors.length)process.exitCode=1;
}finally{
  await db.end();
}
