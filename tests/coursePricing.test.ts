import {test} from 'node:test';import assert from 'node:assert/strict';
import {courseDiscount,enrollmentQuoteError} from '../src/utils/crmCoursePricing';
import {renderConsultationReply} from '../server/portal/coursePrices';

const book = {courses:[
  {id:'HSK 5B',sessions:55,total:2750000},
  {id:'HSK 2',sessions:24,total:1200000},
  {id:'HSK 3',sessions:42,total:2100000},
  {id:'HSK 5A',sessions:55,total:2750000},
]};
const render = (courses: 'all' | string[], detail = 'price') =>
  renderConsultationReply(JSON.stringify({reply:'Rp 99,999 for 5 classes',catalogue:{courses,detail}}),book,'zh').reply;

test('all and selected catalogue replies render only published courses, amounts and hours',()=>{
  assert.match(render('all'),/HSK 2.*24 节课.*1\.200\.000[\s\S]*HSK 5B.*55 节课.*2\.750\.000/);
  assert.match(render(['HSK 5A','HSK 5B']),/HSK 5A.*55 节课.*2\.750\.000[\s\S]*HSK 5B.*55 节课.*2\.750\.000/);
  assert.doesNotMatch(render(['HSK 5A','HSK 5B']),/HSK 2|99,999/);
  assert.match(render(['HSK 2','HSK 3']),/HSK 2.*1\.200\.000[\s\S]*HSK 3.*42 节课.*2\.100\.000/);
  assert.doesNotMatch(render('all','offerings'),/Rp|99,999/);
  assert.match(render(['HSK 2','not published']),/HSK 2.*1\.200\.000[\s\S]*暂无已发布资料/);
  assert.doesNotMatch(render(['not published']),/Rp|99,999/);
  assert.doesNotMatch(renderConsultationReply('{"reply":"","catalogue":{"courses":"all","detail":"price"}}',{courses:[]},'zh').reply,/Rp/);
});

test('ordinary replies pass through the structured contract and malformed outputs fail',()=>{
  assert.deepEqual(renderConsultationReply('{"reply":"可以继续问课程安排。","catalogue":null}',book,'zh'),{reply:'可以继续问课程安排。',catalogueUsed:false});
  assert.throws(()=>renderConsultationReply('{"reply":"Rp 99,999"}',book,'zh'),/Invalid catalogue selection/);
});
const course={id:'c',revision:1,name:'HSK 2',sessions:22,price:2000000,active:true,maxDiscountBps:500,maxDiscountAmount:100000};
test('percentage and absolute allowance both apply; zero discount is explicit and integer rupiah are retained',()=>{assert.deepEqual(courseDiscount(course,'percent','5'),{discountAmount:100000,finalAmount:1900000});assert.equal(courseDiscount({...course,price:4000000},'amount','100000').finalAmount,3900000);assert.throws(()=>courseDiscount({...course,price:4000000},'percent','5'),/exceeded/);assert.equal(courseDiscount({...course,maxDiscountBps:0},'none','').finalAmount,2000000);assert.equal(courseDiscount({...course,price:99999},'percent','0.01').discountAmount,9);});
test('reject negative, exponent, over-limit, double-field and free-by-discount inputs; free published course remains explicit',()=>{for(const [mode,v]of [['percent','-1'],['percent','1e2'],['percent','101'],['amount','1.5'],['amount','100001'],['other','0']])assert.throws(()=>courseDiscount(course,mode,v));assert.throws(()=>courseDiscount({...course,maxDiscountBps:10000,maxDiscountAmount:null},'percent','100'));assert.equal(courseDiscount({...course,price:0},'none','').finalAmount,0);});
test('enrollment requires a versioned course and explicit final total confirmation',()=>{assert.equal(enrollmentQuoteError({}),'course_required');assert.equal(enrollmentQuoteError({courseId:'c',courseRevision:1}),'course_total_confirmation_required');assert.equal(enrollmentQuoteError({courseId:'c',courseRevision:1,confirmed:true}),'');});
test('unpublished drafts preserve reference consultation; publishing activates managed prices and retirement never revives the old price',async()=>{const {publishedCourseBook}=await import('../src/utils/crmCoursePricing');const row={value:{name:'HSK 2',price:2400000,sessions:22,active:false,history:[] as any[]}};assert.equal(publishedCourseBook([row]),undefined);row.value.active=true;assert.equal(publishedCourseBook([row])!.courses[0].total,2400000);row.value.active=false;row.value.history=[{before:{active:true},after:{active:false}}];assert.deepEqual(publishedCourseBook([row])!.courses,[]);});
