import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {AI_PROFILE_POLICY,aiProtectedFieldLabels,aiProfileFieldLabels} from '../src/utils/crmAiProfilePolicy';
import {validateExtraction,extractionDecision} from '../src/utils/crmExtractionContract';import {applyProfileFields} from '../src/utils/crmDynamicProfile';
import {applyExtractionOutput} from '../server/portal/aiExtraction';import {CrmHistoryInformation} from '../src/components/crm/CrmHistoryInformation';import {historyInformation} from '../src/utils/crmHistoryInformation';
import {CrmUiProvider} from '../src/components/crm/CrmUiLanguage';import {crmUiText} from '../src/utils/crmUiText';
const at='2026-10-29T05:00:00Z',earlier='2026-10-28T05:00:00Z';
const observation=(field='city',value:any='Surabaya',extra:any={})=>({kind:'field',field,value,quote:'本次原文',subject:'customer',temporality:'current',change:'changed',...extra});
function fixture(profile:any,extra:any={}){
 let current=structuredClone(profile),status='processing';const calls:any[]=[];
 const job={id:'job-new',lead_id:'TEST-lead',source_type:'sales_record',source_id:'new-log',contract_version:'fixture-no-requests',created_at:at,input:{text:'本次原文',profilePolicyVersion:AI_PROFILE_POLICY,recordedAt:at,occurredAt:at,baseVersions:Object.fromEntries(Object.entries(profile.profileFieldMeta||{}).map(([k,v]:any)=>[k,v.revision||0])),explicitFields:[],...extra}};
 const c={query:async(sql:string,params:any[]=[])=>{calls.push({sql,params});if(sql.startsWith('SELECT profile'))return {rows:[{profile:structuredClone(current)}]};if(sql.startsWith('SELECT status'))return {rows:[{status}]};if(sql.includes("kind='profile.fields_updated'"))return {rows:[{id:'old-field-fact',data:{sourceRecordId:'original-log'}}]};if(sql.startsWith('UPDATE portal_leads'))current=structuredClone(params[1]);if(sql.startsWith('UPDATE crm_ai_extractions'))status='completed';return {rows:[],rowCount:1};}};
 return {c,job,calls,get current(){return current;},run:(observations:any[])=>applyExtractionOutput(c,job,{observations,model:'fixture'})};
}
const meta=(type='sales_edit',extra:any={})=>({revision:1,sourceType:type,effectiveAt:earlier,recordedAt:earlier,sourceFactIds:['old-field-fact'],...extra});
const base=()=>({id:'TEST-lead',city:'Jakarta',owner:'Robert',currentStage:'progress:needs',tier:'Hot',phone:'+12025550199',email:'test@example.invalid',commitments:[{id:'agreement'}],latestAssessment:{score:15},profileFieldMeta:{city:meta()}});
test('a newer explicit fact may update an old manually entered value; ordinary contradictions cannot',async()=>{
 const f=fixture(base());const out=await f.run([observation()]);assert.equal(f.current.city,'Surabaya');assert.equal(out.observations[0].decision,'apply');const changes=f.calls.filter(c=>c.sql.startsWith('INSERT INTO crm_facts')&&c.params[2]==='profile.fields_updated');assert.equal(changes[0].params[4].changes[0].before,'Jakarta');
 for(const field of ['owner','currentStage','tier','phone','email','commitments','latestAssessment'])assert.deepEqual(f.current[field],base()[field]);
 const g=fixture(base());assert.equal((await g.run([observation('city','Bandung',{change:'state'})])).observations[0].decision,'difference');assert.equal(g.current.city,'Jakarta');
});
test('current plain progress uses its recording order without inventing a contact occurrence time',async()=>{
 const f=fixture(base(),{occurredAt:null});await f.run([observation()]);assert.equal(f.current.city,'Surabaya');assert.equal(f.current.profileFieldMeta.city.effectiveAt,null);assert.equal(f.current.profileFieldMeta.city.sourceRecordedAt,at);
});
test('a same-source correction updates its AI interpretation, but never a later independent manual value',async()=>{
 const amendment={kind:'correction',targetFactId:'original-fact'},sourceRoot={type:'sales_record',id:'original-log',occurredAt:earlier};
 const f=fixture({...base(),profileFieldMeta:{city:meta('ai_sales_text')}},{amendment,sourceRoot,occurredAt:earlier});assert.equal((await f.run([observation('city','Bandung',{change:'correction'})])).observations[0].decision,'apply');assert.equal(f.current.city,'Bandung');
 const g=fixture({...base(),city:'Surabaya',profileFieldMeta:{city:meta('sales_edit',{revision:2,sourceFactIds:['later-manual-fact']})}},{amendment,sourceRoot,occurredAt:earlier});assert.equal((await g.run([observation('city','Bandung',{change:'correction'})])).observations[0].decision,'difference');assert.equal(g.current.city,'Surabaya');
});
test('a concurrent manual save after extraction was queued remains protected',async()=>{const f=fixture(base(),{baseVersions:{city:0}});assert.equal((await f.run([observation()])).observations[0].decision,'difference');assert.equal(f.current.city,'Jakarta');});
test('a supplement can fill an empty field but cannot overwrite an unrelated existing field',async()=>{
 const f=fixture({...base(),profileFieldMeta:{city:meta('ai_sales_text')}},{amendment:{kind:'supplement',targetFactId:'original-fact'},sourceRoot:{type:'sales_record',id:'original-log'},occurredAt:earlier});assert.equal((await f.run([observation('city','Bandung',{change:'state'})])).observations[0].decision,'apply');
 const g=fixture(base(),{amendment:{kind:'supplement',targetFactId:'other-fact'}});assert.equal((await g.run([observation()])).observations[0].decision,'difference');
});
test('every protected field and an unknown future field are refused at both extraction and write boundaries',async()=>{
 for(const field of [...Object.keys(aiProtectedFieldLabels),'newUnclassifiedField']){
  assert.throws(()=>validateExtraction({observations:[observation(field,'value')]},'本次原文'));
  assert.throws(()=>applyProfileFields(base(),{[field]:'value'},null,{actor:'ai',sourceType:'ai_sales_text',recordedAt:at}));
  const f=fixture(base());await assert.rejects(f.run([observation(field,'value')]));assert.equal(f.calls.length,0);
 }
 assert.equal(Object.keys(aiProfileFieldLabels).length,12);
});
test('protected claims remain visible as human-review evidence and never mutate profile metadata',async()=>{
 const f=fixture(base());const out=await f.run([observation('email','new@example.invalid',{kind:'protected_field'})]);assert.equal(out.observations[0].decision,'review');assert.deepEqual(f.current,base());assert.equal(f.calls.some(c=>c.sql.startsWith('INSERT INTO crm_facts')&&c.params[2]==='profile.fields_updated'),false);
 const group:any={id:'g',log:{},events:[],extractions:[{...f.job,status:'completed',output:out}]};
 const html=renderToStaticMarkup(React.createElement(CrmUiProvider,{lang:'zh',children:React.createElement(CrmHistoryInformation,{group})}));assert.match(html,/电子邮件/);assert.match(html,/需人工确认，未自动修改/);assert.match(html,/new@example.invalid/);assert.match(html,/定位原文/);assert.equal(historyInformation(group)[0].citations[0].quote,'本次原文');
});
test('lists add independent items, remove explicit exact items, and preserve other-source members during old corrections',async()=>{
 const p={...base(),goals:['工作'],profileFieldMeta:{goals:meta('ai_sales_text')}};
 const f=fixture(p);let out=await f.run([observation('goals',['留学'],{operation:'add',change:'state'})]);assert.deepEqual(f.current.goals,['工作','留学']);assert.deepEqual(out.observations[0].appliedValue,['工作','留学']);
 const g=fixture(f.current);g.job.id='another-job';g.job.input.recordedAt='2026-10-30T05:00:00Z';g.job.input.occurredAt='2026-10-30T05:00:00Z';out=await g.run([observation('goals',['留学'],{operation:'remove',temporality:'negated'})]);assert.deepEqual(g.current.goals,['工作']);
 const h=fixture({...base(),goals:['其他来源','误记目标'],profileFieldMeta:{goals:meta('ai_sales_text',{aiListOrigins:{'"其他来源"':'sales_record:another-log','"误记目标"':'sales_record:original-log'}})}},{amendment:{kind:'correction',targetFactId:'original-fact'},sourceRoot:{type:'sales_record',id:'original-log'},occurredAt:earlier});await h.run([observation('goals',['正确目标'],{operation:'replace',change:'correction'})]);assert.deepEqual(h.current.goals,['其他来源','正确目标']);
 const rendered=historyInformation({id:'g',log:{},events:[],extractions:[{...f.job,status:'completed',output:out}]} as any);assert.ok(rendered.length);
});
test('contradictory list operations and ambiguous scalar statements do not write a winner',async()=>{
 const f=fixture({...base(),concerns:['价格']});const out=await f.run([observation('concerns',['价格'],{operation:'add'}),observation('concerns',['价格'],{operation:'remove',temporality:'negated'})]);assert.ok(out.observations.every((o:any)=>o.decision!=='apply'));assert.deepEqual(f.current.concerns,['价格']);
 const g=fixture(base());assert.ok((await g.run([observation(),observation('city','Bandung')])).observations.every((o:any)=>o.decision==='difference'));
});
test('unknown time, hypothetical/third-party facts and withdrawn values are not manufactured into current facts',()=>{
 for(const patch of [{temporality:'conditional'},{temporality:'uncertain'},{temporality:'past'},{temporality:'future'},{subject:'sales'},{value:null}])assert.notEqual(extractionDecision(observation('city','Surabaya',patch) as any,base(),{city:1},at,'本次原文',{version:AI_PROFILE_POLICY,recordedAt:at}).decision,'apply');
 assert.equal(extractionDecision(observation() as any,base(),{city:1},null,'本次原文',{version:AI_PROFILE_POLICY}).decision,'difference');
});
test('one new source can add one list item and explicitly withdraw another without self-conflicting on its own write',async()=>{
 const f=fixture({...base(),goals:['旧目标'],profileFieldMeta:{goals:meta()}});
 const out=await f.run([observation('goals',['新目标'],{operation:'add'}),observation('goals',['旧目标'],{operation:'remove',temporality:'negated'})]);
 assert.deepEqual(f.current.goals,['新目标']);assert.ok(out.observations.every((o:any)=>o.decision==='apply'));
});
test('human-review labels and policy reasons have aligned English and Indonesian copy, without translating source content',()=>{
 const labels=['需人工确认，未自动修改','受保护信息，需在对应业务入口人工确认，未自动修改','关联补充／修正仅更新同源资料，原值和历史保留','采用较新的明确当前事实，保留原值和依据','按明确的补充或撤回更新当前列表，保留历史','直接编辑客户资料请到“客户资料”页签。'];
 for(const lang of ['en','id'])for(const label of labels)assert.notEqual(crmUiText(label,lang),label);
});
test('schema extensions are sent only for new-policy jobs, keeping legacy pending sources on their original schema',async()=>{
 const {extractWithAI}=await import('../server/portal/aiExtraction');
 for(const enabled of [false,true]){
  let instruction='';
  const request=async(_url:any,options:any)=>{
   instruction=JSON.parse(options.body).messages[0].content;
   return {ok:true,json:async()=>({model:'fixture',choices:[{message:{content:JSON.stringify({observations:[]})}}]})};
  };
  await extractWithAI('TEST普通资料说明',{profile:{},...(enabled?{profilePolicyVersion:AI_PROFILE_POLICY}:{})},request as any,[{model:'fixture',key:'fixture-only',url:'https://example.invalid'}]);
  assert.equal(instruction.includes('SCHEMA EXTENSION:'),enabled);
 }
});
