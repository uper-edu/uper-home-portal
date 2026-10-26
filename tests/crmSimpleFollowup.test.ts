import test from 'node:test';import assert from 'node:assert/strict';import{firstContactOutcome,attentionFacts,validateCommitment,hasSimpleWorkflowDraft}from'../src/utils/crmSimpleFollowup';import{evaluateFullLeadTier}from'../src/types/crmLead';
test('real attempts and successful contact have different outcomes; internal records cannot fake attempts',()=>{const b={kind:'contact' as const,channel:'WhatsApp',summary:'TEST actual contact'};assert.equal(firstContactOutcome({...b,result:'No Response'}),'attempted');assert.equal(firstContactOutcome({...b,result:'Connected'}),'connected');assert.equal(firstContactOutcome({...b,result:'Wrong Number'}),'invalid_contact');assert.equal(firstContactOutcome({...b,kind:'internal'}),null);assert.throws(()=>firstContactOutcome(b));});
test('duplicate source evidence is displayed once; stopping contact retains facts',()=>{const f={id:'1',kind:'request' as const,at:'2026-10-23T10:00:00Z',sourceId:'m1',text:'TEST contact me'};assert.equal(attentionFacts([f,f]).length,1);assert.equal(attentionFacts([f],true)[0].internalOnly,true);});
test('commitments preserve date-only meaning and reject invented or ambiguous time',()=>{const c={id:'c1',action:'TEST call',status:'active' as const,date:'2026-11-01',timezone:'Asia/Jakarta',sourceId:'m1'};assert.equal(validateCommitment(c).at,undefined);assert.throws(()=>validateCommitment({...c,date:'2026-02-30'}));assert.throws(()=>validateCommitment({...c,date:undefined,at:'2026-11-01T10:00:00'}));});
test('R6 cannot override a real buying signal, regardless of historical attempt flags',()=>{const base:any={buyingSignal:'Ready to enroll',currentStatus:'Working professional',goal:'Work in China',levelState:'Beginner',city:'Jakarta',mode:'Online'};assert.equal(evaluateFullLeadTier({...base,noResponseReady:true,touchCount:100}).tier,'Hot');assert.deepEqual(evaluateFullLeadTier({...base,noResponseReady:true}),evaluateFullLeadTier({...base,noResponseReady:false}));});

test('untouched workflow closes without a warning; meaningful changes or unknown result retain the draft',()=>{
 const initial={requestId:'test',recordKind:'internal',expectedRevision:0,expectedStage:'New',expectedStageRevision:0,workflowVersion:3,summary:'',channel:'',connectStatus:''};
 assert.equal(hasSimpleWorkflowDraft(initial),false);
 assert.equal(hasSimpleWorkflowDraft({...initial,recordKind:'contact'}),true);
 assert.equal(hasSimpleWorkflowDraft({...initial,channel:'WhatsApp'}),true);
 assert.equal(hasSimpleWorkflowDraft({...initial,buyingSignalsDetected:['Asked price']}),true);
 assert.equal(hasSimpleWorkflowDraft({...initial,buyingSignalsDetected:[]}),false);
 assert.equal(hasSimpleWorkflowDraft(initial,true),true);
});
