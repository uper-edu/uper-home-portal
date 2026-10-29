import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {appendRecordAmendment,assertAmendmentProfileBoundary} from '../server/portal/recordAmendments.ts';
import {CrmRecordAmendmentForm} from '../src/components/crm/CrmRecordAmendmentForm.tsx';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage.tsx';
import {crmUiText} from '../src/utils/crmUiText.ts';

const original={id:'lead',city:'Jakarta',followUpLogs:[{id:'log',summary:'原始进展'}],recordAmendments:[]};
const body={requestId:'test-request',targetFactId:'fact',expectedAmendmentRevision:0,kind:'supplement',text:'补充说明'};
function connection(prior?:any){
 const queries:string[]=[];
 return {queries,query:async(sql:string)=>{
  queries.push(sql);
  assert.match(sql,/^SELECT /,'this boundary must not write facts, queue AI, update customers or audit');
  if(sql.includes('FROM portal_leads'))return {rows:[{profile:original}]};
  if(sql.includes('FROM crm_facts'))return {rows:[{id:'fact',kind:'followup.recorded',data:{result:{logId:'log'}}}]};
  if(sql.includes('FROM crm_operations'))return {rows:prior?[prior]:[]};
  return {rows:[]};
 }};
}
test('new amendments reject populated profile fields and versions, including attempts to clear fields',async()=>{
 const before=JSON.stringify(original);
 for(const patch of [{profileUpdates:{city:'Bandung'}},{profileUpdates:{city:null}},{profileVersions:{city:1}},{profileUpdates:['city']},{profileUpdates:null}]){
  const db=connection();
  await assert.rejects(appendRecordAmendment(db,'lead','actor',{...body,...patch},()=>true),e=>(e as any).status===400&&String(e).includes('直接编辑客户资料请到“客户资料”页签'));
 }
 assert.equal(JSON.stringify(original),before);
});
test('omitted and empty legacy profile envelopes remain harmless',()=>{
 for(const patch of [{},{profileUpdates:{}},{profileVersions:{}},{profileUpdates:{},profileVersions:{}}])assert.doesNotThrow(()=>assertAmendmentProfileBoundary({...body,...patch}));
});
test('successful historical profile amendments replay their saved result without rewriting historical data',async()=>{
 const oldBody={...body,profileUpdates:{city:'Bandung'},profileVersions:{city:1}};
 const result={leadId:'lead',operationKind:'record.amended',saved:true,profileFieldResults:[{field:'city',status:'applied',requestedValue:'Bandung'}]};
 const fingerprint=createHash('sha256').update(JSON.stringify(['crm-operation-v2','lead','record.amended',oldBody])).digest('hex');
 const db=connection({fingerprint,result});
 const got=await appendRecordAmendment(db,'lead','actor',oldBody,()=>true);
 assert.deepEqual(got,{...result,replayed:true});
 assert.equal(original.city,'Jakarta');
});
test('amendment form removes the embedded profile editor and directs users to the profile tab',()=>{
 const html=renderToStaticMarkup(React.createElement(CrmUiProvider,{lang:'zh',children:React.createElement(CrmRecordAmendmentForm,{target:{eventId:'fact',eventType:'followup.recorded',payload:{recordKind:'contact'}},lead:original,onCancel:()=>{}})}));
 assert.match(html,/直接编辑客户资料请到“客户资料”页签/);
 assert.doesNotMatch(html,/同时更新当前客户资料|crm-profile-fields|profileUpdates/);
 assert.match(html,/原文不会修改或删除/);
 assert.match(html,/保存补充／修正/);
 for(const lang of ['en','id'])assert.notEqual(crmUiText('直接编辑客户资料请到“客户资料”页签。',lang),'直接编辑客户资料请到“客户资料”页签。');
});
