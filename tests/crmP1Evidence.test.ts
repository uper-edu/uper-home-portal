import test from 'node:test';import assert from 'node:assert/strict';
import {questionnaireOptions,validateQuestionnaireAnswers} from '../src/utils/crmQuestionnaire';
import {compatibleProfileValue} from '../src/utils/crmFieldValues';
import {extractionDecision} from '../src/utils/crmExtractionContract';
import {questionnaireBasicSources} from '../src/utils/crmQuestionnaireSources';
import {applyProfileFields} from '../src/utils/crmDynamicProfile';
import {extractWithAI,needsResidenceReview} from '../server/portal/aiExtraction';
test('formal questionnaire options: every supplied enum accepted, display labels and retired/arbitrary codes rejected without defaults',()=>{
 for(const [field,values] of Object.entries(questionnaireOptions))for(const value of values)assert.doesNotThrow(()=>validateQuestionnaireAnswers({[field]:value}));
 for(const value of [{buyingSignals:['课程学费与付款方案']},{currentStatus:'Employee'},{goal:'Career development'},{city:'Bandung'},{mode:'线上直播'},{goals:['自定义']},{buyingSignal:'Ready to enroll'},{buyingSignals:'Asked price'},{reportedLevel:null}])assert.throws(()=>validateQuestionnaireAnswers(value),(e:any)=>e.status===400);
 const empty={};validateQuestionnaireAnswers(empty);assert.deepEqual(empty,{});validateQuestionnaireAnswers({goals:[],buyingSignals:[]});
});
test('compatible refinements preserve both sources while real differences remain differences',()=>{
 for(const [field,a,b] of [['goal','Work at a Chinese or China-Indonesia joint venture company in Indonesia','学习职场中文'],['goal','Study in China or scholarship','申请中国大学奖学金'],['availability','周二与周四晚上七点半','周二和周四晚上']]){assert.equal(compatibleProfileValue(field,a,b),true);assert.equal(compatibleProfileValue(field,b,a),true);}
 for(const [field,a,b] of [['goal','Work in China','Work at a Chinese or China-Indonesia joint venture company in Indonesia'],['goal','Study in China or scholarship','Work in China'],['goal','考HSK1','考HSK3'],['goal','Prepare for HSK certification','不考HSK'],['availability','周六晚上','周日晚上'],['availability','周六晚上七点半','周六晚上八点半'],['availability','周六晚上','不能周六晚上'],['budgetAmount',100,200],['city','Jakarta','Bandung']])assert.equal(compatibleProfileValue(field,a,b),false,String(a));
 const o:any={kind:'field',field:'goal',value:'学习职场中文',quote:'学习职场中文',subject:'customer',temporality:'current',change:'state'};
 const current={goal:'Work at a Chinese or China-Indonesia joint venture company in Indonesia',tier:'Hot'};const snapshot=JSON.stringify(current);assert.equal(extractionDecision(o,current,{},'2026-10-26T00:00:00Z').decision,'evidence');assert.equal(JSON.stringify(current),snapshot);
});
test('basic questionnaire provenance records supplied values without widening AI field privileges',()=>{
 const r=applyProfileFields({id:'a',fullName:'Maya Putri',tier:'Hot'},{fullName:'Maya Putri',currentStatus:'Working professional'},null,{sourceType:'questionnaire',sourceFactId:'q',actor:'visitor',recordedAt:'2026-10-26T00:00:00Z',occurredAt:'2026-10-26T00:00:00Z'});assert.equal(r.profile.tier,'Hot');assert.deepEqual(r.profile.profileFieldMeta.fullName.sourceFactIds,['q']);assert.equal(r.profile.currentStatus,'Working professional');
 assert.throws(()=>applyProfileFields({}, {fullName:'AI invented'},null,{sourceType:'ai_sales_text',sourceFactId:'x',actor:'ai',recordedAt:'2026-10-26T00:00:00Z'}));
});
test('source projection uses only exact same-customer answers, preserves manual metadata, and never mutates raw facts',()=>{
 const lead={id:'a',fullName:'Maya Putri',currentStatus:'Working professional',profileFieldMeta:{currentStatus:{sourceType:'sales_edit',sourceFactIds:['manual'],revision:2}}};const facts=[{id:'q',lead_id:'a',kind:'questionnaire.submitted',created_at:'2026-10-26 12:00:00',data:{answers:{fullName:'Maya Putri',currentStatus:'Working professional'}}}];const raw=JSON.stringify({lead,facts});const projected=questionnaireBasicSources(lead,facts);assert.deepEqual(projected.profileFieldMeta.fullName.sourceFactIds,['q']);assert.equal(projected.profileFieldMeta.currentStatus.sourceType,'sales_edit');assert.equal(JSON.stringify({lead,facts}),raw);
 assert.equal(questionnaireBasicSources({...lead,id:'other'},facts).profileFieldMeta.fullName,undefined);assert.equal(questionnaireBasicSources({...lead,fullName:'Maya Dewi'},facts).profileFieldMeta.fullName,undefined);
 assert.equal(questionnaireBasicSources(lead,[...facts,{id:'edit',lead_id:'a',kind:'profile.fields_updated',data:{changes:[{field:'fullName'}]}}]).profileFieldMeta.fullName,undefined);
});
const text='客户说长期居住地是雅加达，主要目标是申请中国大学奖学金';const goal={kind:'field',field:'goal',value:'申请中国大学奖学金',quote:'主要目标是申请中国大学奖学金',subject:'customer',temporality:'current',change:'state'};const city={kind:'field',field:'city',value:'Jakarta',quote:'客户说长期居住地是雅加达',subject:'customer',temporality:'current',change:'state'};
const response=(observations:any[])=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({observations})}}]}));
test('AI city coverage review recovers omitted field with exact source; conflicts, negation and uncertainty never become adopted facts',async()=>{
 const saved={key:process.env.OPENAI_API_KEY,secondary:process.env.DEEPSEEK_API_KEY};process.env.OPENAI_API_KEY='unit-only';delete process.env.DEEPSEEK_API_KEY;
 try{let calls=0;const request:any=async(_url:any,options:any)=>{calls++;if(calls===2)assert.match(JSON.parse(options.body).messages[0].content,/Coverage review/);return response(calls===1?[goal]:[city]);};const out=await extractWithAI(text,{},request);assert.equal(calls,2);assert.equal(out.coverageReview.recovered,1);const c=out.observations.find(x=>x.field==='city')!;assert.equal(text.slice(c.start,c.end),c.quote);assert.equal(c.value,'Jakarta');
 const current={city:'Bandung',profileFieldMeta:{city:{revision:1,effectiveAt:'2026-10-25T00:00:00Z'}}};assert.equal(extractionDecision(c,current,{city:1},'2026-10-26T00:00:00Z').decision,'difference');
 for(const temporality of ['negated','uncertain','future','past'])assert.equal(extractionDecision({...c,temporality} as any,current,{city:1},'2026-10-26T00:00:00Z').decision,'evidence');assert.equal(extractionDecision({...c,subject:'sales'},current,{city:1},'2026-10-26T00:00:00Z').decision,'evidence');
 let incomplete=0;await assert.rejects(()=>extractWithAI(text,{},(async()=>{incomplete++;return response([])}) as any));assert.equal(incomplete,2);
 assert.equal(needsResidenceReview('客户想去雅加达旅游',[]),false);assert.equal(needsResidenceReview(text,[city]),false);assert.equal(needsResidenceReview('我作为销售住在雅加达，客户没有说明住在哪里',[]),false);
 }finally{if(saved.key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=saved.key;if(saved.secondary===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=saved.secondary;}
});
