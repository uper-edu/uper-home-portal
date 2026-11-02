import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationAdvisorAnalyticsReceipts,advisorAnalyticsReceipt} from '../src/utils/analyticsReceipts';
import {createAnalyticsClient} from '../src/utils/analyticsPolicy';

const request={leadId:'PRIVATE-LEAD',messageId:'PRIVATE-MESSAGE',action:'handoff',status:'awaiting_advisor',taskOperation:'recorded'};
const saved={saved:true,submissionId:'PRIVATE-SUBMISSION',lead:{id:'PRIVATE-LEAD'},advisorRequests:[request]};
test('only a saved registration with its own confirmed explicit advisor request yields a conversion',()=>{
 assert.equal(registrationAdvisorAnalyticsReceipts(saved).length,1);
 for(const data of [{...saved,saved:false},{...saved,submissionId:''},{...saved,lead:{}},{...saved,advisorRequests:null}])assert.deepEqual(registrationAdvisorAnalyticsReceipts(data),[]);
 for(const patch of [{leadId:'OTHER'},{messageId:''},{action:'booking'},{action:'enrollment'},{status:'contact_required'},{status:'failed'},{taskOperation:'unknown'}])assert.deepEqual(registrationAdvisorAnalyticsReceipts({...saved,advisorRequests:[{...request,...patch}]}),[]);
 assert.deepEqual(registrationAdvisorAnalyticsReceipts({...saved,advisorRequests:[]}),[]);
});
test('registration recovery and direct-request recovery share the original message key without leaking identifiers',()=>{
 const values=new Map<string,string>(),events:any[]=[],options={id:'G-TEST',context:()=>({}),send:(...e:any[])=>events.push(e),storage:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)}};
 const receipt=registrationAdvisorAnalyticsReceipts(saved)[0],first=createAnalyticsClient(options);
 assert.equal(first.confirmed(receipt.event,receipt.key,true,receipt.params),true);
 const direct=advisorAnalyticsReceipt({saved:true,status:'awaiting_advisor',taskOperation:'recorded'},{id:request.messageId,action:'handoff'})!;
 assert.equal(first.confirmed(direct.event,direct.key,true,direct.params),false);
 const restored=createAnalyticsClient(options);assert.equal(restored.confirmed(receipt.event,receipt.key,true,receipt.params),false);
 assert.equal(events.length,1);assert.doesNotMatch(JSON.stringify(events),/PRIVATE/);
 const second={...request,messageId:'PRIVATE-SECOND'};const next=registrationAdvisorAnalyticsReceipts({...saved,advisorRequests:[second]})[0];
 assert.equal(restored.confirmed(next.event,next.key,true,next.params),true);assert.equal(events.length,2);
});
