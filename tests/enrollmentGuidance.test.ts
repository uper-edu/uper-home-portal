import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrollmentDemandPrefill,enrollmentGuideHref,matchEnrollmentGuidance,normalizeEnrollmentIntent,resolveConsultationRecommendation} from '../src/utils/enrollmentGuidance';
import type {PublicEnrollmentClass} from '../src/utils/enrollmentCatalog';

const sample=(overrides:Partial<PublicEnrollmentClass>={}):PublicEnrollmentClass=>({
  id:'fixture-a',level:'HSK 1',format:'standard',period:'weekend',firstLesson:'2026-12-19T15:00',
  price:920000,standardPrice:1150000,availability:'available',
  weeklySchedule:{days:[6,7],start:'15:00',lessons:1},schedule:'',minutes:45,sessions:23,
  learningOutcomes:'',material:'',resources:'',teacher:'',...overrides,
});
const normalized=(overrides:Record<string,unknown>={})=>normalizeEnrollmentIntent({
  kind:'recommend',level:'HSK 1',period:'weekend',days:[6,7],earliest:'12:00',latest:'17:59',...overrides,
})!;

test('prefer at most two eligible seats ordered by the first session',()=>{
  const action=matchEnrollmentGuidance(normalized(),[
    sample({id:'late',firstLesson:'2027-01-16T15:00'}),
    sample({id:'full',availability:'full'}),
    sample({id:'middle',firstLesson:'2026-12-26T15:00',sessions:24}),
    sample({id:'early'}),
  ]);
  assert.equal(action.kind,'class');
  assert.deepEqual(action.rows?.map(row=>row.id),['early','middle']);
  assert.deepEqual(action.rows?.map(row=>[row.sessions,row.minutes]),[[23,45],[24,45]]);
});

test('check every selected weekly day and fall back separately for full, missing and incomplete schedules',()=>{
  const classWithEvening=sample({weeklySchedule:{days:[6,7],start:'15:00',startByDay:{6:'15:00',7:'19:00'},lessons:1}});
  assert.equal(matchEnrollmentGuidance(normalized(),[classWithEvening]).kind,'demand');
  assert.equal(matchEnrollmentGuidance(normalized(),[sample({availability:'full'})]).kind,'waitlist');
  assert.equal(matchEnrollmentGuidance(normalized(),[sample({weeklySchedule:undefined})]).kind,'unavailable');
  assert.equal(matchEnrollmentGuidance(normalized({days:[0]}),[sample()]).kind,'catalog');
  assert.equal(matchEnrollmentGuidance(normalized({needsReview:true}),[sample()]).kind,'catalog');
  assert.equal(matchEnrollmentGuidance(normalized({kind:'advisor'}),[sample()]).kind,'advisor');
});

test('preserve promotion and language, pass safe filters, and leave contact fields blank',()=>{
  const source=new URLSearchParams('p=sample&utm_source=ig&entry_point=linkhub&email=unwanted@example.invalid');
  const href=enrollmentGuideHref({kind:'demand',level:'HSK 1',period:'weekend',format:'standard'},'id','ai_chat',source);
  const url=new URL(href,'https://example.invalid');
  assert.equal(url.pathname,'/enrollment/interest');
  assert.equal(url.searchParams.get('p'),'sample');
  assert.equal(url.searchParams.get('entry_point'),'linkhub');
  assert.equal(url.searchParams.get('enrollment_via'),'ai_chat');
  assert.equal(url.searchParams.get('lang'),'id');
  assert.equal(url.searchParams.has('email'),false);
  assert.deepEqual(enrollmentDemandPrefill(url.searchParams),{level:'HSK 1',period:'weekend',format:'standard',notes:'',phone:''});
  const waitlist=enrollmentGuideHref({kind:'waitlist',classId:'fixture-a'},'zh','whatsapp');
  assert.match(waitlist,/^\/enrollment\/fixture-a\?.*apply=1$/);
  assert.doesNotMatch(waitlist,/join=/);
});

test('chat distinguishes paused intake, catalogue read failures and an explicit opt-out',async()=>{
  const settings={
    MYSQL_TRIAL_URL:'mysql://unused:unused@localhost/uper_local_crm',
    PORTAL_ENV:'dev',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',
    MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock',PORTAL_WORKER_ENABLED:'false',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/private/tmp/guide-unit-test',PORTAL_DEPLOYMENT:'',
    PORTAL_GA_API_SECRET:'',PORTAL_ENROLLMENT_ACCEPTING_NEW:'false',
  };
  const original=Object.fromEntries(Object.keys(settings).map(key=>[key,process.env[key]]));
  Object.assign(process.env,settings);
  let reads=0;
  const client={query:async()=>{reads++;throw Error('Simulated catalogue unavailable');}};
  try{
    const {chatEnrollmentAction}=await import('../server/portal/chatEnrollment');
    assert.equal((await chatEnrollmentAction(client,normalized(),false,false))?.kind,'paused');
    assert.equal(reads,0);
    process.env.PORTAL_ENROLLMENT_ACCEPTING_NEW='true';
    assert.equal((await chatEnrollmentAction(client,normalized(),false,false))?.kind,'unavailable');
    assert.equal(reads,1);
    assert.equal(await chatEnrollmentAction(client,null,true,false),undefined);
  }finally{
    for(const [key,value] of Object.entries(original)){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
  }
});

test('match every teaching day against the latest start and end window, budget, and first date',()=>{
  const mixed=sample({id:'h3-mixed',level:'HSK 3',period:'mixed',sessions:42,price:4158000,firstLesson:'2026-11-27T19:00',
    weeklySchedule:{days:[5,6],start:'19:00',startByDay:{5:'19:00',6:'15:00'},lessons:2}});
  const friday={day:5,earliest:'19:00',latestEnd:'21:00'};
  const saturday={day:6,earliest:'15:00',latestEnd:'17:00'};
  const intent=normalizeEnrollmentIntent({kind:'recommend',level:'HSK 3',windows:[friday,saturday]})!;
  assert.equal(matchEnrollmentGuidance(intent,[mixed]).kind,'class');
  assert.equal(matchEnrollmentGuidance({...intent,maximumTotal:4100000},[mixed]).kind,'demand');
  assert.equal(matchEnrollmentGuidance({...intent,earliestDate:'2026-11-28'},[mixed]).kind,'demand');
  const revised={...intent,windows:[friday,{...saturday,latestEnd:'15:30'}]};
  assert.deepEqual(matchEnrollmentGuidance(revised,[mixed]).scheduleConflict,{day:6,start:'15:00',end:'16:30'});
  assert.equal(normalizeEnrollmentIntent({kind:'recommend',windows:[friday,friday]})?.needsReview,true);
});

test('explicit demand and current quote rendering use verified prices and clarify units',async()=>{
  const {enrollmentQuoteRows,enrollmentReply}=await import('../server/portal/chatEnrollment');
  const intent=normalizeEnrollmentIntent({kind:'quote',level:'HSK 1',formats:['standard','small','one-on-one']})!;
  const groups=[sample(),sample({id:'b',price:920000}),sample({id:'c',format:'small',price:2760000,standardPrice:undefined})];
  const appointments=[{id:'private-a',level:'HSK 1',course:'HSK 1',teacherType:'local' as const,lessons:23,minutes:45,price:350000,standardPrice:400000}];
  const quotes=enrollmentQuoteRows(intent,groups,appointments);
  assert.equal(quotes.length,3);
  const reply=enrollmentReply({kind:'quote',quotes,requestedPeriods:4},'zh');
  assert.match(reply,/实付总价 Rp 920,000（标准总价 Rp 1,150,000） · 每节 Rp 40,000/);
  assert.match(reply,/实付总价 Rp 2,760,000 · 每节 Rp 120,000/);
  assert.match(reply,/整级参考 Rp 8,050,000，4 节参考 Rp 1,400,000.*每节 Rp 350,000/);
  const request=matchEnrollmentGuidance(normalizeEnrollmentIntent({kind:'demand',format:'small'})!,[]);
  assert.equal(request.explicitDemand,true);
  assert.doesNotMatch(enrollmentReply(request,'zh'),/没有符合/);
  assert.match(enrollmentReply(request,'zh'),/无需付款.*不会占用席位/);
  assert.match(enrollmentGuideHref(request,'zh','ai_chat'),/^\/enrollment\/interest\?/);
});

test('following up cannot silently relax a prior availability limit or add a narrower format',()=>{
  const original={kind:'recommend',level:'HSK 3',windows:[{day:6,earliest:'15:00',latestEnd:'15:30'}]};
  const first=resolveConsultationRecommendation(original,undefined,'周六只能上到15:30');
  const previous=JSON.parse(JSON.stringify(first.constraints));
  const drift={...original,format:'small',windows:[{day:6,earliest:'15:00',latestEnd:'17:00'}]};
  const stable=resolveConsultationRecommendation(drift,previous,'具体哪个课冲突？');
  assert.deepEqual(stable.constraints?.windows,previous.windows);
  assert.equal(normalizeEnrollmentIntent(stable.value)?.format,undefined);
  const changed=resolveConsultationRecommendation({...drift,constraintEvidence:'可以上到17:00'},previous,'我现在周六可以上到17:00');
  assert.equal(changed.constraints?.windows?.[0].latestEnd,'17:00');
  assert.equal(normalizeEnrollmentIntent({kind:'recommend',windows:[{day:5,earliest:'19:00',latest:'19:00'}]})?.windows?.[0].latestStart,'19:00');
});

test('an explicitly requested level absent from the catalogue does not fall back to another level',()=>{
  const intent=normalizeEnrollmentIntent({kind:'browse',level:'HSK 6'})!;
  assert.equal(matchEnrollmentGuidance(intent,[sample()]).levelUnavailable,true);
  const demand=matchEnrollmentGuidance({...intent,kind:'demand'},[]);
  const goal=new URL(enrollmentGuideHref(demand,'zh','ai_chat'),'https://example.invalid');
  assert.equal(enrollmentDemandPrefill(goal.searchParams).level,'other');
  assert.equal(goal.pathname,'/enrollment/interest');
});

test('clarifying the price unit does not repeat tuition unless the learner requests the amount',async()=>{
  const {enrollmentReply}=await import('../server/portal/chatEnrollment');
  const quote={kind:'quote' as const,question:'period_unit' as const,quotes:[
    {id:'group',level:'HSK 3',format:'standard' as const,periods:42,minutes:45,actual:4158000,unitPriced:false},
    {id:'private',level:'HSK 3',format:'one-on-one' as const,periods:42,minutes:45,actual:750000,unitPriced:true},
  ]};
  const unit='报价按一节 45 分钟计算。一次上课如果安排两节，就计两节。';
  assert.equal(enrollmentReply(quote,'zh'),unit);
  assert.match(enrollmentReply({...quote,detailFields:['price']},'zh'),/^报价按一节 45 分钟计算。[^\n]*\n\n- [\s\S]*Rp/);
  const compound=normalizeEnrollmentIntent({kind:'quote',question:'period_unit',fields:['appointment']})!;
  const withAppointment={...quote,detailFields:compound.detailFields,classId:'group'};
  const compoundReply=enrollmentReply(withAppointment,'zh');
  assert.ok(compoundReply.startsWith(unit));
  assert.match(compoundReply,/一对一由 UPER 顾问约课/);
  assert.doesNotMatch(compoundReply,/Rp/);
  const href=new URL(enrollmentGuideHref(withAppointment,'zh','ai_chat'),'https://example.invalid');
  assert.equal(href.pathname,'/enrollment/help/one-on-one');
  assert.equal(href.searchParams.get('appointment'),'private');
  const classAction=matchEnrollmentGuidance(normalized({question:'period_unit'}),[sample()]);
  assert.equal(enrollmentReply(classAction,'zh'),unit);
  const classPrice=matchEnrollmentGuidance(normalized({question:'period_unit',fields:['price']}),[sample()]);
  assert.match(enrollmentReply(classPrice,'zh'),/报价按一节 45 分钟计算。[^\n]*\n[^\n]*Rp 920,000/);
});
