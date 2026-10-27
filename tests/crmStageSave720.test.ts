import test from 'node:test';import assert from 'node:assert/strict';
import {confirmedStageLead} from '../src/utils/crmOperationResult';
import {submitProgressStage} from '../src/utils/crmProgressStage';
const body={requestId:'r720',newStage:'progress:discovery'};
const receipt={saved:true,leadId:'test720',operationKind:'stage',lead:{id:'test720',currentStage:body.newStage}};
test('720: only confirmed matching stage receipts may finish the edit; failed, unknown and foreign responses cannot',()=>{
 assert.equal(confirmedStageLead(receipt,'test720',body.newStage),receipt.lead);
 for(const bad of [{...receipt,saved:false},{...receipt,leadId:'other'},{...receipt,operationKind:'owner'},{...receipt,lead:{...receipt.lead,id:'other'}},{...receipt,lead:{...receipt.lead,currentStage:'progress:proposal'}},{}])assert.throws(()=>confirmedStageLead(bad,'test720',body.newStage));
 assert.throws(()=>confirmedStageLead(receipt,'test720',undefined));
});
test('720: unknown write recovered by read query does not issue another stage write',async()=>{
 const calls:any[]=[];const request:any=async(url:any,options:any)=>{calls.push({url,options});if(calls.length===1)throw Error('lost response');return Response.json(receipt);};
 assert.equal((await submitProgressStage('test720',body,request)).state,'unknown');
 const result=await submitProgressStage('test720',body,request,true);assert.equal(result.state,'saved');
 assert.equal(confirmedStageLead(result.data,'test720',body.newStage),result.data.lead);
 assert.equal(calls.filter(c=>c.options?.method==='POST').length,1);assert.match(calls[1].url,/operations\/r720$/);
});
