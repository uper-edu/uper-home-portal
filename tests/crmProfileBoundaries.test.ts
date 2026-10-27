import {test} from 'node:test';import assert from 'node:assert/strict';
import {applyProfileFields,validateProfileUpdates} from '../src/utils/crmDynamicProfile';
import {saveProfileUpdates} from '../server/portal/dynamicProfile';
const lead:any={id:'maya',fullName:'Maya Putri',city:'Jakarta',goal:'工作交流',tier:'Hot',owner:'sales-a',currentStage:'progress:discovery',commitments:[{id:'keep'}],profileFieldMeta:{city:{revision:2,sourceType:'questionnaire',sourceFactIds:['original'],effectiveAt:'2026-10-25T00:00:00Z'}}};
const context={sourceType:'sales_edit',sourceFactId:'edit',actor:'sales-a',occurredAt:null,recordedAt:'2026-10-26T00:00:00Z',adopt:true};
test('basic edit uses explicit manual path; AI and default validators cannot mutate identity',()=>{
 assert.throws(()=>validateProfileUpdates({fullName:'Maya Sari'}));
 assert.throws(()=>applyProfileFields(lead,{fullName:'Maya Sari'},{fullName:0},{...context,sourceType:'ai_sales_text'}));
 const r=applyProfileFields(lead,{fullName:'Maya Sari',currentStatus:'Working professional'},{fullName:0,currentStatus:0},context);
 assert.equal(r.profile.fullName,'Maya Sari');assert.equal(r.changes[0].before,'Maya Putri');
 for(const k of ['tier','owner','currentStage','commitments'])assert.deepEqual(r.profile[k],lead[k]);
 assert.throws(()=>applyProfileFields(r.profile,{fullName:'Maya Dewi'},{fullName:0},context),(e:any)=>e.status===409);
 assert.throws(()=>applyProfileFields(lead,{fullName:null},{fullName:0},context));
 for(const k of ['whatsapp','email','tier','currentStage','reportedLevel','quizScore'])assert.throws(()=>applyProfileFields(lead,{[k]:'changed'},{[k]:0},context));
});
test('scope whitelist and cross-customer evidence are rejected before any write',async()=>{
 let writes=0;const c={query:async(sql:string)=>{if(sql.includes('SELECT profile'))return {rows:[{profile:lead}]};if(sql.startsWith('SELECT id'))return {rows:[]};writes++;return{rows:[]};}};
 for(const b of [{scope:'basic',updates:{goal:'new'}},{scope:'needs',updates:{fullName:'new'}},{scope:'invalid',updates:{city:'new'}},{scope:'needs',updates:{city:'Bandung'},basisFactIds:['other-customer']}])await assert.rejects(()=>saveProfileUpdates(c,'maya','sales-a',{reason:'客户说明',versions:{city:2},...b},()=>true));
 assert.equal(writes,0);
});
test('source, old value and pending alternatives stay in history on explicit adoption',()=>{
 const old={...lead,profileFieldMeta:{city:{...lead.profileFieldMeta.city,pendingDifferences:[{value:'Surabaya',sourceFactId:'different'}]}}};
 const r=applyProfileFields(old,{city:'Bandung'},{city:2},context);
 assert.equal(r.profile.city,'Bandung');assert.equal(r.profile.profileFieldMeta.city.effectiveAt,null);
 assert.deepEqual(r.changes[0].previousEvidence,old.profileFieldMeta.city);
 assert.equal(old.city,'Jakarta');assert.equal(old.profileFieldMeta.city.pendingDifferences.length,1);
});
test('contact preferences move to basic editing without changing manual adoption, versions or protected business fields',async()=>{
 let profile:any={...lead},writes:any[]=[];const c={query:async(sql:string,args:any[])=>{if(sql.includes('SELECT profile'))return {rows:[{profile}]};if(sql.startsWith('SELECT'))return {rows:[]};writes.push([sql,args]);if(sql.startsWith('UPDATE portal_leads'))profile=args[1];return {rows:[]};}};
 const result=await saveProfileUpdates(c,'maya','sales-a',{scope:'basic',requestId:'contact-basic-0001',updates:{communicationLanguage:'id',preferredChannel:'WhatsApp'},versions:{communicationLanguage:0,preferredChannel:0},reason:'客户明确希望以印尼语通过WhatsApp联系。',occurredAt:null},()=>true,new Date('2026-10-26T00:00:00Z'));
 assert.equal(result.lead.communicationLanguage,'id');assert.equal(result.lead.preferredChannel,'WhatsApp');assert.equal(result.lead.profileFieldMeta.communicationLanguage.sourceType,'sales_edit');assert.equal(result.lead.profileFieldMeta.communicationLanguage.revision,1);for(const k of ['owner','tier','currentStage','commitments'])assert.deepEqual(result.lead[k],lead[k]);assert.ok(writes.some(([sql])=>sql.startsWith('INSERT INTO crm_facts')));assert.ok(!writes.some(([sql])=>sql.includes('followup_tasks')));
 await assert.rejects(()=>saveProfileUpdates(c,'maya','sales-a',{scope:'basic',requestId:'contact-basic-0002',updates:{communicationLanguage:'zh'},versions:{communicationLanguage:0},reason:'过期版本',occurredAt:null},()=>true),e=>(e as any).status===409);
});
