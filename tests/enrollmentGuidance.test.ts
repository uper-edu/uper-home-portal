import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrollmentClassComparison,enrollmentDemandPrefill,enrollmentGuideHref,enrollmentGuideRows,matchEnrollmentGuidance,normalizeEnrollmentIntent,repeatedEnrollmentCards,resolveConsultationRecommendation} from '../src/utils/enrollmentGuidance';
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

test('limit recommendation count without weakening earlier availability, and never swap a referenced class',()=>{
  const {constraints}=resolveConsultationRecommendation({
    kind:'recommend',level:'HSK 1',period:'weekend',days:[6,7],latestEnd:'16:00',
  },undefined,'');
  const {value}=resolveConsultationRecommendation({kind:'recommend',maxRecommendations:1},constraints,'只推荐一个');
  const first=sample();
  const alternative=sample({id:'fixture-b',firstLesson:'2026-12-26T15:00'});
  const tooLate=sample({id:'fixture-c',weeklySchedule:{days:[6,7],start:'15:00',startByDay:{6:'15:00',7:'15:30'},lessons:1}});
  const action=matchEnrollmentGuidance(normalizeEnrollmentIntent(value)!,[first,alternative,tooLate]);
  assert.deepEqual(action.rows?.map(row=>row.id),[first.id]);
  const focus=matchEnrollmentGuidance(normalizeEnrollmentIntent({...value as object,referenceIds:[tooLate.id]})!,[first,alternative,tooLate]);
  assert.equal(focus.kind,'demand');
  assert.deepEqual(focus.scheduleConflict,{day:7,start:'15:30',end:'16:15'});
  assert.equal(focus.rows,undefined);
  const gone=matchEnrollmentGuidance(normalized({referenceIds:['withdrawn']}),[first]);
  assert.equal(gone.referenceUnavailable,true);
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

test('a matching class answers the schedule and budget in text before relying on a card',async()=>{
  const {enrollmentReply}=await import('../server/portal/chatEnrollment');
  const intent=normalizeEnrollmentIntent({kind:'recommend',level:'HSK 3',period:'mixed',fields:['weekly'],referenceIds:['requested']})!;
  const mixed=sample({id:'requested',level:'HSK 3',period:'mixed',sessions:42,price:4158000,firstLesson:'2026-12-18T19:00',
    weeklySchedule:{days:[5,6],start:'19:00',startByDay:{5:'19:00',6:'15:00'},lessons:2}});
  const schedule=matchEnrollmentGuidance(intent,[{...mixed,id:'earlier',firstLesson:'2026-11-27T19:00'},mixed]);
  assert.deepEqual(schedule.rows?.map(row=>row.id),['requested']);
  assert.match(enrollmentReply(schedule,'zh'),/^下方班次的每周课表符合你给出的时间。[\s\S]*五 19:00–20:30；周六 15:00–16:30 WIB.*每次 2 节，共 90 分钟/);
  assert.match(enrollmentReply(schedule,'en'),/Fri 19:00–20:30 \/ Sat 15:00–16:30 WIB/);
  assert.match(enrollmentReply(schedule,'id'),/Jum 19:00–20:30 \/ Sab 15:00–16:30 WIB/);
  const budget=matchEnrollmentGuidance(normalized({maximumTotal:1000000}),[sample(),sample({id:'over-budget',price:1100000})]);
  assert.deepEqual(budget.rows?.map(row=>row.id),['fixture-a']);
  assert.match(enrollmentReply(budget,'zh'),/^.*可以先看 HSK 1.*标准班.*Rp 1,000,000 以内[\s\S]*实付总价 Rp 920,000/);
  assert.match(enrollmentReply({...budget,question:'starting_point'},'zh'),/^按你的预算.*标准班.*Rp 1,000,000/);
});

test('current questions are answered using verified facts, allowed actions and destinations',async()=>{
  const {enrollmentReply}=await import('../server/portal/chatEnrollment');
  const classAction=matchEnrollmentGuidance(normalized(),[sample({availability:'limited'})]);
  assert.match(enrollmentReply({...classAction,question:'reserve'},'zh'),/^我无法在聊天里帮你锁位。[\s\S]*余位不多[\s\S]*验证邮箱/);
  assert.doesNotMatch(enrollmentReply({...classAction,question:'reserve',intakePaused:true},'zh'),/提交申请/);
  const full=matchEnrollmentGuidance(normalized({question:'reserve'}),[sample({availability:'full'})]);
  assert.match(enrollmentReply(full,'zh'),/^我无法在聊天里帮你锁位。[\s\S]*已满[\s\S]*候补/);
  assert.match(enrollmentReply({...classAction,question:'period_unit',detailFields:['price']},'zh'),
    /^报价按一节 45 分钟计算。[\s\S]*每节 Rp 40,000/);
  assert.match(enrollmentReply({...classAction,detailFields:['price']},'zh'),/实付总价 Rp 920,000.*标准总价 Rp 1,150,000.*每节 Rp 40,000/);
  assert.match(enrollmentReply({...classAction,question:'view_without_contact',detailFields:['weekly']},'zh'),
    /^可以。查看公开课表、学费和余位无需填电话或验证邮箱。[\s\S]*15:00–15:45 WIB/);
  assert.match(enrollmentReply({...classAction,question:'apply',inspection:true,detailFields:['duration','price']},'zh'),
    /共 23 节，每节 45 分钟[\s\S]*实付总价 Rp 920,000[\s\S]*验证邮箱并提交/);
  assert.match(enrollmentReply({...classAction,question:'starting_point'},'zh'),/^如果你从零开始.*HSK 1.*打开一个班次.*每周时间/);
  const appointment={kind:'quote' as const,question:'appointment' as const,quotes:[{id:'private-a',level:'HSK 1',format:'one-on-one',periods:23,minutes:45,
    actual:350000,unitPriced:true}]};
  assert.match(enrollmentReply(appointment,'zh'),/^一对一由 UPER 顾问约课。[\s\S]*每节 Rp 350,000/);
  assert.doesNotMatch(enrollmentReply({...appointment,kind:'appointment'},'zh'),/Rp/);
  assert.match(enrollmentGuideHref(appointment,'zh','ai_chat'),/^\/enrollment\/help\/one-on-one\?.*appointment=private-a/);
  const records={kind:'records' as const};
  const unpaid=normalizeEnrollmentIntent({kind:'records',question:'unpaid_enrollment_status'})?.question;
  assert.equal(enrollmentReply({...records,question:unpaid},'zh'),
    '还没转账、也没上传凭证，报名尚未成功。可在「我的报名」验证报名邮箱，查看是否已有待付款订单。');
  assert.match(enrollmentReply({...records,question:'cancel_unpaid'},'zh'),/^订单仍在付款期限内[\s\S]*自行取消/);
  assert.match(enrollmentReply({...records,question:'avoid_duplicate_payment'},'zh'),/^不用再付.*另一个账户/);
  assert.match(enrollmentReply({...records,question:'original_transfer_proof'},'zh'),/^请用原转账回单.*流水号[\s\S]*入口已关闭/);
  assert.match(enrollmentReply({...records,question:'cancelled_transfer_payment_and_proof'},'en'),/^Do not pay again[\s\S]*original transfer receipt/);
  assert.match(enrollmentReply({...records,question:'proof_after_cancellation'},'zh'),/暂勿再次付款[\s\S]*如果订单仍有[\s\S]*如果入口已关闭/);
  assert.match(enrollmentReply({...records,question:'refund'},'zh'),/^退款须先获批/);
  assert.match(enrollmentGuideHref(records,'zh','ai_chat'),/^\/enrollment\/mine\?/);
  assert.equal(normalizeEnrollmentIntent({kind:'records',question:'invented_action'})?.question,undefined);
});

test('identical class facts are stated once and first dates and differences stay tied to the right class',async()=>{
  const {enrollmentReply}=await import('../server/portal/chatEnrollment');
  const second=sample({id:'fixture-b',batchNumber:2,firstLesson:'2027-01-02T15:00'});
  const first=sample({batchNumber:1});
  const same=matchEnrollmentGuidance(normalized(),[second,first]);
  const reply=enrollmentReply(same,'zh');
  assert.equal(reply.split('15:00–15:45').length-1,1);
  assert.equal(reply.split('Rp 920,000').length-1,1);
  assert.match(reply,/第 1 期.*2026-12-19/);
  assert.match(reply,/第 2 期.*2027-01-02/);
  assert.deepEqual(same.rows?.map(row=>row.id),['fixture-a','fixture-b']);
  const different=matchEnrollmentGuidance(normalized({fields:['weekly','price','first']}),[first,{
    ...second,price:1000000,weeklySchedule:{days:[6,7],start:'16:00',lessons:1},
  }]);
  assert.match(enrollmentReply(different,'zh'),/第 1 期.*15:00–15:45.*Rp 920,000/);
  assert.match(enrollmentReply(different,'zh'),/第 2 期.*16:00–16:45.*Rp 1,000,000/);
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
  const classPriceReply=enrollmentReply(classPrice,'zh');
  assert.ok(classPriceReply.startsWith(unit));
  assert.match(classPriceReply,/实付总价 Rp 920,000.*标准总价 Rp 1,150,000.*每节 Rp 40,000/);
});

test('a follow-up about quoted amounts uses the previous tuition and maps each amount to its unit',async()=>{
  const {previousTuitionReply}=await import('../server/portal/chatEnrollment');
  const old=matchEnrollmentGuidance(normalized({fields:['price']}),[sample()]);
  assert.match(previousTuitionReply(old,[],'zh'),/Rp 920,000 是整班实付总价（共 23 节），Rp 40,000 是每节 45 分钟的单价/);
  assert.doesNotMatch(previousTuitionReply(old,[],'zh'),/Rp 1,150,000/);
  assert.match(previousTuitionReply(old,['other-record'],'zh'),/^你指的是哪项报价/);
  const quote={kind:'quote' as const,quotes:[
    {id:'small',level:'HSK 1',format:'small',periods:23,minutes:45,actual:2760000,unitPriced:false},
    {id:'private',level:'HSK 1',format:'one-on-one',periods:23,minutes:45,actual:350000,unitPriced:true},
  ]};
  assert.match(previousTuitionReply(quote,['private'],'zh'),/Rp 350,000 是每节 45 分钟的单价，Rp 8,050,000 是按 23 节估算的整级参考价/);
  assert.doesNotMatch(previousTuitionReply(quote,['private'],'zh'),/整班实付|Rp 2,760,000/);
  assert.match(previousTuitionReply({ ...quote, question:'period_unit' },[],'zh'),/^你指的是哪项报价/);
  assert.match(previousTuitionReply({...quote,question:'group_overview'},[],'zh'),/Rp 2,760,000 是整班实付总价，Rp 120,000 是每节 45 分钟的折合单价/);
});

test('navigation turns address the specific request while the enrollment state stays intact',async()=>{
  const {enrollmentReply}=await import('../server/portal/chatEnrollment');
  const form=matchEnrollmentGuidance(normalizeEnrollmentIntent({kind:'demand',level:'HSK 2',question:'link_only'})!,[]);
  assert.equal(enrollmentReply(form,'zh'),'选课需求表在下方。');
  assert.match(enrollmentGuideHref(form,'zh','ai_chat'),/^\/enrollment\/interest\?.*level=2/);
  const other=matchEnrollmentGuidance(normalizeEnrollmentIntent({kind:'demand',level:'HSK 6'})!,[]);
  assert.match(enrollmentReply(other,'zh'),/「其他」。请在备注填写你想学的级别/);
  assert.doesNotMatch(enrollmentReply(other,'zh'),/不确定我的级别/);
  assert.match(enrollmentGuideHref(other,'zh','ai_chat'),/level=other/);
  const records={kind:'records' as const};
  assert.equal(enrollmentReply({...records,question:'records_location'},'zh'),'进入「我的报名」，验证报名邮箱后打开原订单。');
  assert.match(enrollmentReply({...records,question:'expired_unpaid'},'zh'),/超过付款期限后订单会终止，席位会释放/);
  assert.doesNotMatch(enrollmentReply({kind:'paused',question:'link_only'},'zh'),/选课需求表在下方/);
});

test('public class answers use advertised size and give repeat cards only when the visible status changes',async()=>{
  const {enrollmentReply}=await import('../server/portal/chatEnrollment');
  const rows=enrollmentGuideRows([sample({classSize:{usualMinimum:10,maximum:15},teacher:'安老师',learningOutcomes:'练习自我介绍'})]);
  const action={kind:'class' as const,inspection:true,rows,detailFields:['class_size','teacher','outcomes','seats']};
  assert.match(enrollmentReply(action,'zh'),/10–15 人.*上限 15 人.*安老师.*自我介绍.*查询时有余位/);
  const question=normalizeEnrollmentIntent({kind:'inspect',question:'private_seat_counts'})?.question;
  const counts={...action,question,detailFields:[]};
  assert.match(enrollmentReply(counts,'zh'),/^占席人数、实收人数和开班门槛均不公开。[\s\S]*查询时有余位/);
  assert.match(enrollmentReply(counts,'en'),/^We don’t publish[\s\S]*Seats available when checked/);
  assert.match(enrollmentReply(counts,'id'),/tidak dipublikasikan[\s\S]*Tempat tersedia saat diperiksa/);
  assert.match(enrollmentReply({...counts,rows:[{...rows[0],availability:'full'}]},'zh'),/均不公开[\s\S]*已满/);
  assert.doesNotMatch(enrollmentReply({...action,detailFields:['seats']},'zh'),/均不公开/);
  assert.deepEqual(repeatedEnrollmentCards(action,[action]),['fixture-a']);
  const changed={...action,rows:[{...rows[0],availability:'full' as const}]};
  assert.deepEqual(repeatedEnrollmentCards(changed,[action]),[]);
  assert.match(enrollmentReply({...action,rows:[sample({availability:undefined})]},'zh'),/人数上限暂未公布.*姓名尚未公布.*成果暂未公布.*余位暂无法核实/);
});

test('class comparisons represent each level before limiting cards and name missing levels',async()=>{
  const {enrollmentReply}=await import('../server/portal/chatEnrollment');
  const records=[sample(),sample({id:'duplicate-level'}),sample({id:'level-2',level:'HSK 2'}),sample({id:'level-3',level:'HSK 3'})];
  const levels=['HSK 1','HSK 2','HSK 3','HSK 4'];
  const {rows,missingClassLevels}=enrollmentClassComparison(levels,records);
  assert.deepEqual(rows.map(row=>row.id),['fixture-a','level-2','level-3']);
  assert.deepEqual(missingClassLevels,['HSK 4']);
  assert.match(enrollmentReply({kind:'class',rows:enrollmentGuideRows(rows,levels.length),missingClassLevels,detailFields:['materials']},'zh'),
    /HSK 3[\s\S]*HSK 4 目前没有符合这些条件/);
  assert.match(enrollmentReply({kind:'unavailable',missingClassLevels:levels},'zh'),/HSK 1、HSK 2、HSK 3、HSK 4 目前没有/);
});

test('group overview answers size and tuition without selecting a particular batch',async()=>{
  const {enrollmentQuoteRows,enrollmentReply}=await import('../server/portal/chatEnrollment');
  const intent=normalizeEnrollmentIntent({kind:'quote',question:'group_overview',format:'small',level:'HSK 1'})!;
  const quotes=enrollmentQuoteRows(intent,[sample({format:'small',batchNumber:2,price:2760000,classSize:{usualMinimum:4,maximum:6}})],[]);
  const action={kind:'quote' as const,question:intent.question,level:intent.level,format:intent.format,quotes};
  const answer=enrollmentReply(action,'zh');
  assert.match(answer,/^HSK 1 小班为4–6 人。.*Rp 2,760,000.*Rp 120,000/);
  assert.doesNotMatch(answer,/第 2 期/);
  assert.match(enrollmentGuideHref(action,'zh','ai_chat'),/^\/enrollment\?.*format=small/);
});
