import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PURCHASE_INTENT_VERSION, attachPurchaseIntentSuggestions, latestPurchaseIntentRows, loadPurchaseIntentContext,
  lockPurchaseIntentSuggestion, purchaseIntentReviewable, unreviewedPurchaseIntent, validatePurchaseIntent,
} from '../server/portal/purchaseIntentSuggestions.ts';
import {applyExtractionOutput,extractWithAI} from '../server/portal/aiExtraction.ts';
import {EXTRACTION_VERSION} from '../src/utils/crmExtractionContract.ts';
import {enrollmentOpportunityLevels} from '../src/utils/enrollmentCatalog.ts';
import {purchaseIntentSourceRefs} from '../src/utils/crmPurchaseIntentSuggestion.ts';

const at='2026-11-20T10:45:00.000000Z';
const statement='我确定想报 HSK 2 小班。周六下午可以上课，希望12月开始。';
const evidence=[{messageId:'learner-1',quote:statement}];
const modelOutput={decision:'strong',summary:'想报 HSK 2 小班。',level:'HSK 2',format:'small',
  availability:'周六下午',startWindow:'12月',evidence};
const context={
  version:PURCHASE_INTENT_VERSION,conversationId:'chat-1',levels:enrollmentOpportunityLevels,
  messages:[
    {id:'assistant-1',role:'assistant' as const,content:'我可以帮您选班。',sent_at:at},
    {id:'learner-1',role:'user' as const,content:statement,sent_at:at},
  ],
};
const intent=validatePurchaseIntent(modelOutput,context)!;
const id='4a7624b2-0efb-49ba-b07a-489e67a90633';
const current={lead_id:'customer',id,sequence:'100',suggestion:intent};
const employee={id:'staff',active:true,scope:'own' as const,permissions:['crm.followup']};
const profile={id:'customer',owner:'staff',identityLifecycle:'independent'};

test('accepts only versioned purchase intent citing actual learner messages and supported fields',()=>{
  assert.equal(intent.version,PURCHASE_INTENT_VERSION);
  assert.equal(intent.anchorAt,at);
  assert.equal(intent.level,'HSK 2');
  assert.deepEqual(purchaseIntentSourceRefs({id,...intent}),[{id:'learner-1',type:'customer_message'}]);
  for(const response of [
    {decision:'none'}, {...modelOutput,evidence:[]},
    {...modelOutput,evidence:[{messageId:'assistant-1',quote:'我可以帮您选班。'}]},
    {...modelOutput,evidence:[{messageId:'other-customer',quote:statement}]},
    {...modelOutput,evidence:[{messageId:'learner-1',quote:'该学员已付费'}]},
    {...modelOutput,evidence:[...evidence,...evidence]},
    {...modelOutput,format:'fake'},{...modelOutput,level:'HSK 99'},{...modelOutput,availability:'周日晚上'},
  ])assert.equal(validatePurchaseIntent(response,context),undefined);
  assert.equal(validatePurchaseIntent({...modelOutput,level:null,format:null,availability:null,startWindow:null},context)?.level,null);
});

test('builds bounded dialogue from the original staff-scoped message and preserves ordering',async()=>{
  const db={async query(sql:string,params:unknown[]){
    assert.deepEqual(params,['learner-1','customer']);
    assert.match(sql,/c\.lead_id=:p2/);
    assert.match(sql,/m\.sequence<=source\.sequence/);
    assert.match(sql,/LIMIT 16/);
    return {rows:[...context.messages].reverse().map(message=>({...message,conversation_id:'chat-1'}))};
  }};
  assert.deepEqual(await loadPurchaseIntentContext(db,'customer','learner-1'),context);
  assert.equal(await loadPurchaseIntentContext({query:async()=>({rows:[]})},'other','learner-1'),undefined);
});

test('latest withdrawal, uncertified or unfinished extraction hides an old suggestion across linked customer sources',()=>{
  const newer={lead_id:'customer',sequence:'101',id:null,suggestion:null};
  assert.deepEqual(latestPurchaseIntentRows([newer,current]),[newer]);
  assert.deepEqual(latestPurchaseIntentRows([current,{...newer,lead_id:'another'}]),[current,{...newer,lead_id:'another'}]);
  assert.equal(unreviewedPurchaseIntent(newer,[],[]),undefined);
});

test('ignores handled evidence and later matching Enrollment, allows new evidence and a different level',()=>{
  const dismissed={lead_id:'customer',data:{suggestionId:id,scopeKey:intent.scopeKey,proofKey:intent.proofKey}};
  const submitted={lead_id:'customer',level:'HSK 2',submitted_at:'2026-11-20T10:46:00.000000Z'};
  assert.equal(unreviewedPurchaseIntent(current,[dismissed],[]),undefined);
  assert.equal(unreviewedPurchaseIntent({...current,id:'another-extraction-of-the-same-evidence'},[dismissed],[]),undefined);
  assert.equal(unreviewedPurchaseIntent(current,[],[submitted]),undefined);
  assert.equal(unreviewedPurchaseIntent(current,[],[{...submitted,level:'HSK 1'}]),intent);
  const older={...submitted,submitted_at:'2026-11-20T09:00:00.000000Z'};
  assert.equal(unreviewedPurchaseIntent(current,[],[older]),intent);
  assert.equal(unreviewedPurchaseIntent(current,[],[{...older,in_progress:1}]),undefined);
  assert.equal(unreviewedPurchaseIntent({...current,id:'new',suggestion:{...intent,scopeKey:'updated-class-format'}},[dismissed],[] )?.scopeKey,'updated-class-format');
});

test('scope and pending identity hide the cue, and server rechecks it under a lock',async()=>{
  assert.equal(purchaseIntentReviewable(employee,profile),true);
  assert.equal(purchaseIntentReviewable(employee,{...profile,identityReview:{pending:true}}),false);
  assert.equal(purchaseIntentReviewable(employee,{...profile,owner:'another'}),false);
  assert.equal(purchaseIntentReviewable({...employee,permissions:['crm.read']},profile),false);
  const queryLog:string[]=[];
  const db={async query(sql:string){
    queryLog.push(sql);
    if(sql.includes("AS suggestion"))return {rows:[current]};
    return {rows:[]};
  }};
  const [allowed,other]=[{...profile},{...profile,id:'other',owner:'other'}];
  await attachPurchaseIntentSuggestions(db,[allowed,other],employee);
  assert.equal((allowed as typeof profile&{purchaseIntentSuggestion:{id:string}}).purchaseIntentSuggestion.id,id);
  assert.equal((other as any).purchaseIntentSuggestion,null);
  assert.equal((await lockPurchaseIntentSuggestion(db,profile,id)).id,id);
  assert.ok(queryLog.at(-4)?.endsWith('FOR UPDATE'));
  await assert.rejects(lockPurchaseIntentSuggestion(db,profile,'13d16c2f-1bf3-449c-a731-14ee7f1683f5'),/enrollment_purchase_intent_changed/);
});

test('extends the existing model call for new Chat messages and only stores a review cue',async()=>{
  const mockReply=(value:unknown)=>async(_url:unknown,init:any)=>{
    const body=JSON.parse(init.body);
    assert.equal(body.messages.length,2);
    assert.match(body.messages[0].content,/Strong requires the learner/);
    assert.deepEqual(JSON.parse(body.messages[1].content),{CONTEXT:{purchaseIntent:context},SOURCE:statement});
    return new Response(JSON.stringify({model:'fixture',choices:[{message:{content:JSON.stringify({
      observations:[],purchaseIntent:value,
    })}}]}));
  };
  const provider=[{model:'fixture',key:'fixture',url:'https://example.invalid'}];
  const positive=await extractWithAI(statement,{purchaseIntent:context},mockReply(modelOutput),provider);
  assert.equal(positive.purchaseIntent?.summary,modelOutput.summary);
  for(const example of ['价格是多少？','其实我是替朋友问的','先不报了','如果公司报销我再报名']){
    const output=await extractWithAI(example,{purchaseIntent:context},async()=>
      new Response(JSON.stringify({choices:[{message:{content:'{"observations":[],"purchaseIntent":{"decision":"none"}}'}}]})),provider);
    assert.equal(output.purchaseIntent,undefined);
  }
  const writes:Array<{sql:string;values:any[]}>=[],customerProfile={id:'customer',currentStage:'progress:unreached'};
  const db={async query(sql:string,values:any[]){
    if(sql.startsWith('SELECT profile'))return {rows:[{profile:customerProfile}]};
    if(sql.startsWith('SELECT status'))return {rows:[{status:'processing'}]};
    if(!sql.startsWith('SELECT'))writes.push({sql,values});
    return {rows:[]};
  }};
  await applyExtractionOutput(db,{id,lead_id:'customer',source_id:'learner-1',source_type:'customer_message',
    contract_version:EXTRACTION_VERSION,input:{text:statement,purchaseIntentVersion:PURCHASE_INTENT_VERSION,
      sourceRoot:{type:'customer_message',id:'learner-1'},baseVersions:{},explicitFields:[]}},
  {...positive,observations:[{kind:'signal',field:'enrollment_request',value:true,quote:statement,
    subject:'customer',temporality:'current',change:'state'}]});
  assert.deepEqual(writes.find(entry=>entry.sql.startsWith('UPDATE crm_ai_extractions'))?.values[1].purchaseIntent,intent);
  assert.deepEqual(writes.find(entry=>entry.sql.startsWith('UPDATE portal_leads'))?.values[1],customerProfile);
  assert.ok(writes.every(entry=>!/enrollment_opportunities|followup_tasks|notification_jobs|crm_engagements|outbox/.test(entry.sql)));
});

test('opportunity evidence follows the last message before the matching enrollment even if analysis finishes later',async()=>{
  const {readOpportunityChatEvidence}=await import('../server/portal/purchaseIntentSuggestions.ts');
  const opportunityId='enrollment-opportunity';
  const first='2026-11-20T10:46:00.000000Z';
  const record={lead_id:'customer',opportunity_id:opportunityId,level:'HSK 2',submitted_at:first};
  const fixture=({extra=[],dismissed=false,latest=intent,original=statement}:{
    extra?:any[];dismissed?:boolean;latest?:typeof intent|null;original?:string;
  }={})=>({async query(sql:string,args:unknown[]){
    if(sql.startsWith('SELECT id FROM portal_leads'))return {rows:[{id:'source'}]};
    if(sql.includes('FROM enrollment_customer_records'))return {rows:[record,...extra]};
    if(sql.includes('AS suggestion')){
      assert.deepEqual(args,[JSON.stringify(['customer','source']),first]);
      assert.match(sql,/m\.created_at<=STR_TO_DATE/);
      assert.match(sql,/ORDER BY m\.sequence DESC LIMIT 1/);
      assert.doesNotMatch(sql,/completed_at/);
      return {rows:[{id,suggestion:latest}]};
    }
    if(sql.includes('purchase_intent.reviewed'))return {rows:dismissed?[{lead_id:'source',data:{decision:'dismissed',suggestionId:id}}]:[]};
    if(sql.includes('AS received_at'))return {rows:[{id:'learner-1',content:original,received_at:at}]};
    throw Error('Unexpected SQL '+sql);
  }});
  const expected=[{type:'customer_message',id:'learner-1',text:statement,receivedAt:at}];
  assert.deepEqual(await readOpportunityChatEvidence(fixture(),profile,opportunityId,'HSK 2',new Set()),expected);
  assert.deepEqual(await readOpportunityChatEvidence(fixture(),profile,opportunityId,'HSK 2',new Set(['learner-1'])),[]);
  assert.deepEqual(await readOpportunityChatEvidence(fixture(),profile,opportunityId,'HSK 1',new Set()),[]);
  for(const db of [fixture({dismissed:true}),fixture({latest:null}),fixture({original:'Changes to a later message are not the same quote'}),
    fixture({extra:[{...record,opportunity_id:null,submitted_at:at}]}),
    fixture({extra:[{...record,opportunity_id:'a-different-purchase',submitted_at:at}]})]){
    assert.deepEqual(await readOpportunityChatEvidence(db,profile,opportunityId,'HSK 2',new Set()),[]);
  }
});
