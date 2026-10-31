import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyDigestPreview} from '../src/utils/larkDailyDigest.ts';
import {dailyDigestCard} from '../server/portal/notificationDelivery.ts';
test('daily summary uses reporting-day new customer counts and explicit current-stage scope in all languages',()=>{
 for(const language of ['zh','en','id'] as const){
 const input={language,date:'2030-01-06',timezone:'Asia/Jakarta',counts:[{stage:'progress:unreached',count:'8'},{stage:'progress:discovery',count:3},{stage:'progress:proposal',count:1}]};
 const preview=dailyDigestPreview(input);assert.equal(preview.rows[1].value,'12');assert.equal(preview.rows.length,5);
 const card=dailyDigestCard(input,undefined,new Date());assert.ok(card.card.elements[0].text.content.includes('12'));assert.ok(!card.card.elements[0].text.content.includes('"stage"'));assert.ok(!card.card.elements[1].actions[0].url.includes('lead='));assert.ok(preview.note);
 }
});
test('legacy stages are never guessed; invalid statistics never imply a valid zero',()=>{
 const legacy=dailyDigestPreview({language:'zh',counts:[{stage:'Enrolled',count:2}]});assert.equal(legacy.rows[1].label,'阶段未明确');
 const empty=dailyDigestPreview({language:'zh',counts:[]});assert.equal(empty.rows[0].value,'0');
 for(const counts of [undefined,[{stage:'progress:unreached',count:-1}],[{count:'oops'}]]){const p=dailyDigestPreview({language:'zh',counts});assert.equal(p.rows.length,0);assert.match(p.note,/不完整/);}
});
