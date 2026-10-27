import test from 'node:test';import assert from 'node:assert/strict';
import {applyProfileFields,dynamicProfileHints} from '../src/utils/crmDynamicProfile';
import {profileFieldResults} from '../src/utils/crmProfileSaveResult';
const old:any={city:'雅加达',availability:'周六',tier:'Warm-Online',owner:'sales-a',currentStage:'progress:discovery',commitments:[{id:'keep'}],profileFieldMeta:{city:{revision:2,sourceType:'questionnaire',sourceFactIds:['original-city'],effectiveAt:'2026-10-25T01:00:00Z',pendingDifferences:[{value:'万隆',sourceFactId:'other-city',effectiveAt:null}]},availability:{revision:1,sourceType:'sales_contact',sourceFactIds:['original-time'],effectiveAt:'2026-10-25T01:00:00Z'}}};
const context={sourceType:'sales_edit',sourceFactId:'new-edit',actor:'sales-a',occurredAt:null,recordedAt:'2026-10-26T01:00:00Z',adopt:true};
test('direct sales edit adopts selected undated values and retains previous evidence in history',()=>{
 const before=JSON.stringify(old);const r=applyProfileFields(old,{city:'泗水',availability:'周日'},{city:2,availability:1},context);
 assert.equal(r.profile.city,'泗水');assert.equal(r.profile.availability,'周日');assert.equal(r.changes.length,2);
 assert.deepEqual(r.changes[0].previousEvidence,old.profileFieldMeta.city);assert.equal(r.changes[0].before,'雅加达');
 assert.equal(r.profile.profileFieldMeta.city.effectiveAt,null);assert.equal(r.profile.profileFieldMeta.city.recordedAt,context.recordedAt);
 assert.deepEqual(r.profile.profileFieldMeta.city.pendingDifferences,[]);assert.equal(dynamicProfileHints(r.profile).filter(h=>h.kind==='difference').length,0);
 for(const key of ['tier','owner','currentStage','commitments'])assert.deepEqual(r.profile[key],old[key]);assert.equal(JSON.stringify(old),before);
 assert.deepEqual(profileFieldResults({city:'泗水',availability:'周日'},r.changes,r.profile).map(r=>r.status),['applied','applied']);
});
test('explicit adoption never bypasses field revision or validation',()=>{
 assert.throws(()=>applyProfileFields(old,{city:'泗水'},{city:1},context),(e:any)=>e.status===409);
 assert.throws(()=>applyProfileFields(old,{tier:'Hot'},{tier:0},context));
 assert.throws(()=>applyProfileFields(old,{city:''},{city:2},context));
 const r=applyProfileFields(old,{city:null},{city:2},context);assert.equal(r.profile.city,null);assert.equal(r.profile.availability,'周六');
});
test('AI and questionnaire paths do not gain explicit sales adoption',()=>{
 for(const sourceType of ['ai_customer_text','ai_sales_text','questionnaire','sales_contact']){
 const r=applyProfileFields(old,{city:'泗水'},{city:2},{...context,sourceType});assert.equal(r.profile.city,'雅加达');assert.equal(r.changes[0].applied,false);
 }
});
test('separate field concurrent updates merge, stale same-field writes fail, same values are unchanged',()=>{
 const a=applyProfileFields(old,{city:'泗水'},{city:2},context);
 const b=applyProfileFields(a.profile,{availability:'周日'},{availability:1},{...context,sourceFactId:'second'});
 assert.equal(b.profile.city,'泗水');assert.equal(b.profile.availability,'周日');
 assert.throws(()=>applyProfileFields(b.profile,{city:'万隆'},{city:2},context),(e:any)=>e.status===409);
 assert.equal(applyProfileFields(b.profile,{city:'泗水'},{city:3},context).changes.length,0);
});
