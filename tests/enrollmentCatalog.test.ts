import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import { enrollmentClassTitle,enrollmentTeacherLabel,enrollmentInstant, enrollmentScheduleDefaults, enrollmentScheduleLabel, enrollmentWeeklyScheduleText, isEnrollmentInsertionWindow, publicEnrollmentClass, validateEnrollmentClass } from '../src/utils/enrollmentCatalog';
import {enrollmentScheduledMeetingStart,previewEnrollmentClassSchedule} from '../src/utils/enrollmentClassSchedule';
import {allowedEnrollmentClassDate,updateEnrollmentDraftFirst} from '../src/utils/enrollmentClassDraft';
import {compareEnrollmentTemplates,enrollmentTemplateClassFields,type EnrollmentTeachingCourse,type EnrollmentTemplate} from '../src/utils/enrollmentTemplates';
import {parseEnrollmentCourseIntroduction} from '../src/utils/enrollmentCourseIntroduction';
import {formatCrmOperatingTime} from '../src/utils/crmOperatingTime';
import {enrollmentDateFormatter} from '../src/utils/enrollmentDateFormat';
import {enrollmentClassDateFilter,formatEnrollmentClassStart} from '../src/utils/crmEnrollmentManagement';
import {enrollmentCoursePresets} from '../src/data/system-defaults/courses';

const sample = {
  courseId: 'hsk1', level: 'HSK 1', format: 'standard', period: 'weekend',
  firstLesson: '2026-12-19T15:00', enrollmentCloses: '2026-12-19T00:00',
  schedule: 'Saturday and Sunday, 15:00–15:45 WIB', sessions: 23, minutes: 45, minimumPaid: 13, capacity: 20,
  price: 575000, standardPrice: null, learningOutcomes: 'Introduction and greetings',
  material: 'Sample materials', resources: 'Sample practice', teacher: 'Sample teacher',
};

test('class templates sort by HSK level, class type, teacher type and natural name order',()=>{
  const course=(id:string,level:NonNullable<EnrollmentTeachingCourse['teaching']>['level']):EnrollmentTeachingCourse=>({
    id,name:id,active:true,sessions:23,teaching:{level,minutes:45,material:'',knowledge:'',learningOutcomes:'',resources:''},
  });
  const template=(id:string,fields:Partial<EnrollmentTemplate>={}):EnrollmentTemplate=>({
    id,name:'Template '+id,revision:1,courseId:'hsk2',format:'standard',teacherType:'local',
    minimumPaid:10,capacity:15,standardUnitPrice:50000,saleUnitPrice:40000,...fields,
  });
  const rows=[
    template('unknown',{courseId:'missing'}),
    template('4b',{courseId:'hsk4b'}),
    template('small',{format:'small'}),
    template('foreign',{teacherType:'foreign'}),
    template('10'),
    template('2'),
  ];
  const courses=[course('hsk4b','HSK 4B'),course('hsk2','HSK 2')];
  assert.deepEqual([...rows].sort(compareEnrollmentTemplates(courses,'zh')).map(row=>row.id),
    ['2','10','foreign','small','4b','unknown']);
  assert.deepEqual([...rows].sort(compareEnrollmentTemplates(courses,'zh','name-desc')).map(row=>row.id),
    ['unknown','small','foreign','10','4b','2']);
});

test('CRM displays and filters class starts on the WIB calendar',()=>{
  const now=Date.parse('2026-11-26T17:30:00Z'); // 27 November, 00:30 WIB
  const starts=enrollmentInstant('2026-11-27T19:00');
  assert.equal(formatEnrollmentClassStart(starts),'2026-11-27 19:00');
  const nextSeven=enrollmentClassDateFilter('7',now);
  assert.equal(nextSeven(starts),true);
  assert.equal(nextSeven(enrollmentInstant('2026-11-27T00:29')),false);
  assert.equal(nextSeven(enrollmentInstant('2026-12-03T23:59')),true);
  assert.equal(nextSeven(enrollmentInstant('2026-12-04T00:00')),false);
  const nextThirty=enrollmentClassDateFilter('30',now);
  assert.equal(nextThirty(enrollmentInstant('2026-12-26T23:59')),true);
  assert.equal(nextThirty(enrollmentInstant('2026-12-27T00:00')),false);
  const past=enrollmentClassDateFilter('past',now);
  assert.equal(past(enrollmentInstant('2026-11-27T00:29')),true);
  assert.equal(past(enrollmentInstant('2026-11-27T00:30')),false);
});

test('WAT classes use their own calendar and the same occurrence crosses into Saturday in Asia',()=>{
  const raw={...sample,timeZone:'Africa/Lagos',period:'weekday-evening',firstLesson:'2026-11-27T19:00',
    enrollmentCloses:'2026-11-27T00:00',weeklySchedule:{days:[5],start:'19:00',lessons:1}};
  const cohort={...validateEnrollmentClass(raw),weeklySchedule:raw.weeklySchedule};
  assert.equal(validateEnrollmentClass(sample).timeZone,'Asia/Jakarta');
  assert.throws(()=>validateEnrollmentClass({...raw,timeZone:'America/Vancouver'}),/enrollment_class_invalid/);
  assert.throws(()=>validateEnrollmentClass({...raw,enrollmentCloses:'2026-11-27T00:01'}),/enrollment_class_invalid/);
  assert.equal(cohort.timeZone,'Africa/Lagos');
  assert.equal(publicEnrollmentClass({...cohort,id:'fixture',revision:1,state:'published'}).timeZone,'Africa/Lagos');
  assert.equal(enrollmentScheduleLabel(cohort,'zh'),'每周五 19:00–19:45 WAT');
  const schedule=previewEnrollmentClassSchedule(cohort,['2026-12-04'])!;
  assert.deepEqual(schedule.meetings.slice(0,2).map(row=>row.date),['2026-11-27','2026-12-11']);
  const first=enrollmentScheduledMeetingStart(cohort,schedule.meetings[0].date)!;
  assert.equal(first.toISOString(),'2026-11-27T18:00:00.000Z');
  assert.equal(formatEnrollmentClassStart(first,cohort.timeZone),'2026-11-27 19:00');
  assert.equal(formatCrmOperatingTime(first.toISOString(),'Asia/Jakarta').slice(0,16),'2026-11-28 01:00');
  assert.equal(formatCrmOperatingTime(first.toISOString(),'Asia/Shanghai').slice(0,16),'2026-11-28 02:00');
  assert.equal(isEnrollmentInsertionWindow(cohort,Date.parse('2026-11-26T22:59:59Z')),false);
  assert.equal(isEnrollmentInsertionWindow(cohort,Date.parse('2026-11-26T23:00:00Z')),true);

  const within7=enrollmentClassDateFilter('7',Date.parse('2026-11-26T17:30:00Z'));
  assert.equal(within7(enrollmentInstant('2026-12-02T23:59',cohort.timeZone),cohort.timeZone),true);
  assert.equal(within7(enrollmentInstant('2026-12-03T00:00',cohort.timeZone),cohort.timeZone),false);
  assert.equal(within7(enrollmentInstant('2026-12-03T23:59')),true);
});

test('a new class uses course and template terms without copying teaching descriptions',()=>{
  const teaching={level:'HSK 1' as const,minutes:45,material:'Textbook',knowledge:'Topics',learningOutcomes:'Goals',resources:'Practice'};
  const template={id:'tpl',revision:1,name:'Standard',courseId:sample.courseId,format:'standard' as const,
    teacherType:'local' as const,capacity:20,minimumPaid:13,standardUnitPrice:25000,saleUnitPrice:25000};
  const derived=enrollmentTemplateClassFields(template,{id:sample.courseId,name:'Course',active:true,sessions:23,teaching});
  assert.ok(derived);
  for(const field of ['material','knowledge','learningOutcomes','resources','introduction'])assert.equal(Reflect.has(derived,field),false);
  const config=validateEnrollmentClass({...derived,period:sample.period,firstLesson:sample.firstLesson,
    enrollmentCloses:sample.enrollmentCloses,schedule:sample.schedule,teacher:''});
  assert.equal(config.material,'');
});

test('the HSK 1 sample provides all introduction fields in each supported language',()=>{
  const sample=JSON.parse(readFileSync(new URL('../src/data/system-defaults/hsk1-course-introduction.json',import.meta.url),'utf8'));
  assert.deepEqual(parseEnrollmentCourseIntroduction(sample),sample);
  assert.deepEqual(Object.keys(sample),['en','id','zh']);
  for(const language of ['en','id','zh']){
    assert.deepEqual(Object.keys(sample[language]),['audience','outcomes','topics','practice']);
    assert.equal(sample[language].outcomes.split('\n').length,10);
    const textbookSummary=sample[language].topics.split('\n')[1];
    for(const count of ['400','300','40','20'])assert.match(textbookSummary,new RegExp(`\\b${count}\\b`));
  }
});

test('course introductions retain supported translations and reject malformed public content',()=>{
  const content={en:{audience:' Beginners ',practice:'   '},id:{audience:'Pemula'},zh:{audience:'零基础学员'}};
  assert.deepEqual(parseEnrollmentCourseIntroduction(content),{
    en:{audience:'Beginners'},id:{audience:'Pemula'},zh:{audience:'零基础学员'},
  });
  assert.throws(()=>parseEnrollmentCourseIntroduction({en:{audience:['Beginner']}}));
  assert.throws(()=>parseEnrollmentCourseIntroduction({en:{audience:'a'.repeat(321)}}));
  assert.throws(()=>parseEnrollmentCourseIntroduction({fr:{audience:'Débutants'}}));
  assert.throws(()=>parseEnrollmentCourseIntroduction({en:{stages:{'4C':{audience:'Unknown stage'}}}}));
  assert.throws(()=>parseEnrollmentCourseIntroduction({en:{stages:{'4A':{outcomes:['Invalid list']}}}}));
  assert.deepEqual(parseEnrollmentCourseIntroduction({en:{stages:{'4A':{audience:'  '},'4B':{audience:' Stage B '}}}}),
    {en:{stages:{'4B':{audience:'Stage B'}}}});
});

test('HSK 2 through 4 presets preserve each translated outcome and both HSK 4 stages',()=>{
  const [hsk1,hsk2,hsk3,hsk4]=enrollmentCoursePresets.map(course=>course.config.teaching.introduction);
  for(const introduction of [hsk2,hsk3,hsk4]){
    assert.ok(introduction);
    assert.deepEqual(parseEnrollmentCourseIntroduction(introduction),introduction);
    assert.deepEqual(Object.keys(introduction),['en','id','zh']);
  }
  for(const language of ['en','id','zh'] as const){
    const sharedResources=hsk1?.[language]?.practice?.split('\n').slice(1);
    assert.equal(sharedResources?.length,3);
    for(const introduction of [hsk2,hsk3,hsk4]){
      assert.deepEqual(introduction?.[language]?.practice?.split('\n').slice(-3),sharedResources);
    }
    assert.equal(hsk2?.[language]?.outcomes?.split('\n').length,10);
    assert.equal(hsk3?.[language]?.outcomes?.split('\n').length,10);
    const stages=hsk4?.[language]?.stages;
    assert.ok(stages?.['4A']&&stages['4B']);
    assert.equal(stages['4A'].outcomes?.split('\n').length,8);
    assert.equal(stages['4B'].outcomes?.split('\n').length,8);
    assert.match(stages['4A'].topics??'',/579[\s\S]*303[\s\S]*40/);
    assert.match(stages['4B'].topics??'',/600[\s\S]*200[\s\S]*40/);
    assert.match(stages['4B'].outcomes??'',/CSC/);
  }
});

test('class break preview keeps the period total and uses later sessions on the same weekly schedule',()=>{
  const config={...sample,firstLesson:'2026-12-10T20:00',sessions:5,weeklySchedule:{days:[2,4],start:'20:00',lessons:2}};
  const preview=previewEnrollmentClassSchedule(config,['2026-12-10','2026-12-15','2026-12-16','2027-01-05']);
  assert.deepEqual(preview?.originalDates,['2026-12-10','2026-12-15','2026-12-17']);
  assert.deepEqual(preview?.skippedDates,['2026-12-10','2026-12-15']);
  assert.deepEqual(preview?.unneededDates,['2026-12-16','2027-01-05']);
  assert.deepEqual(preview?.makeupDates,['2026-12-22','2026-12-24']);
  assert.deepEqual(preview?.meetings.map(({periods})=>periods),[2,2,1]);
  assert.equal(preview?.first,'2026-12-17');
  assert.equal(preview?.end,'2026-12-24');
  assert.equal(config.firstLesson,'2026-12-10T20:00');
  assert.equal(config.enrollmentCloses,sample.enrollmentCloses);
});

test('class break preview skips a selected date in the extended schedule across a new year',()=>{
  const config={...sample,firstLesson:'2026-12-31T20:00',sessions:2,weeklySchedule:{days:[2,4],start:'20:00',lessons:1}};
  const dates=['2027-01-05','2027-01-07'];
  const preview=previewEnrollmentClassSchedule(config,dates);
  assert.deepEqual(preview?.skippedDates,dates);
  assert.deepEqual(preview?.makeupDates,['2027-01-12']);
  assert.equal(preview?.end,'2027-01-12');
  assert.equal(previewEnrollmentClassSchedule({...config,firstLesson:'2027-01-01T20:00'},dates),null);
});

test('the first class uses WIB with an explicit cutoff and decision time', () => {
  const config = validateEnrollmentClass(sample);
  assert.deepEqual(config, {...sample,timeZone:'Asia/Jakarta'});
  assert.equal(enrollmentInstant(config.firstLesson)?.toISOString(), '2026-12-19T08:00:00.000Z');
  assert.equal(validateEnrollmentClass({ ...sample, enrollmentCloses: '2026-12-18T10:00' }).enrollmentCloses, '2026-12-18T10:00');
  for (const change of [
    { firstLesson: '2026-02-30T15:00' }, { enrollmentCloses: '2026-12-20T00:00' }, { enrollmentCloses: '2026-12-19T00:01' },
    { minimumPaid: 21 }, { price: 575000.5 }, { format: 'one-on-one' },
    { standardPrice: 575000 },
  ]) {
    assert.throws(() => validateEnrollmentClass({ ...sample, ...change }), /enrollment_class_invalid/);
  }
});

test('only public class fields are returned to visitors', () => {
  const admin = { ...validateEnrollmentClass(sample), id: 'sample-hsk1', revision: 2, state: 'published' as const };
  const view = publicEnrollmentClass(admin);
  assert.equal(view.id, admin.id);
  assert.equal(view.price, 575000);
  assert.equal(view.teacher, 'Sample teacher');
  for (const key of ['capacity', 'minimumPaid', 'courseId', 'revision', 'state', 'enrollmentCloses']) {
    assert.equal(Object.hasOwn(view, key), false);
  }
});

test('the class teacher can be assigned later or cleared without affecting the price', () => {
  for (const [teacher, expected] of [['  Dewi Tan  ', 'Dewi Tan'], ['', ''], ['   ', '']]) {
    const config = validateEnrollmentClass({ ...sample, teacher });
    assert.equal(config.teacher, expected);
    assert.equal(config.price, sample.price);
  }
  for (const teacher of [null, 12, 'x'.repeat(2501)]) {
    assert.throws(() => validateEnrollmentClass({ ...sample, teacher }), /enrollment_class_invalid/);
  }
});

test('staff insertion starts on the first class day in WIB after self-service closes', () => {
  const midnight = Date.parse('2026-12-18T17:00:00Z');
  const legacy = { ...sample, enrollmentCloses: '2026-12-19T09:00' };
  assert.equal(isEnrollmentInsertionWindow(legacy, midnight - 1), false);
  assert.equal(isEnrollmentInsertionWindow(legacy, midnight), true);
  assert.equal(isEnrollmentInsertionWindow(legacy, Date.parse('2026-12-20T08:00:00Z')), true);
  assert.equal(isEnrollmentInsertionWindow({ firstLesson: '2026-02-30T15:00' }, midnight), false);
});

test('signup cutoff defaults to midnight WIB; the old notice date does not affect class validation or public output',()=>{
  assert.deepEqual(enrollmentScheduleDefaults('2027-01-01T15:00'),{enrollmentCloses:'2027-01-01T00:00'});
  assert.deepEqual(validateEnrollmentClass({...sample,decisionAt:'legacy-invalid'}),validateEnrollmentClass(sample));
  const publicClass=publicEnrollmentClass({...validateEnrollmentClass(sample),decisionAt:'2026-12-17T17:00',
    id:'legacy',revision:1,state:'published'});
  assert.ok(!('decisionAt' in publicClass));
});

test('class drafts use the selected class calendar and link the weekly start and automatic cutoff to the first session',()=>{
  const config={...validateEnrollmentClass(sample),timeZone:'Africa/Lagos' as const,
    firstLesson:'',enrollmentCloses:'',enrollmentClosesMode:'automatic' as const};
  assert.equal(allowedEnrollmentClassDate('weekend','2026-12-18'),false);
  assert.equal(allowedEnrollmentClassDate('weekday-evening','2026-12-19'),false);
  assert.equal(allowedEnrollmentClassDate('mixed','2026-12-18'),true);
  assert.equal(allowedEnrollmentClassDate('mixed','2026-12-19'),true);
  assert.equal(allowedEnrollmentClassDate('weekend','2026-02-30'),false);
  const date=updateEnrollmentDraftFirst(config,'2026-12-19T');
  assert.equal(date.config.enrollmentCloses,'2026-12-19T00:00');
  assert.deepEqual(date.config.weeklySchedule.days,[6]);
  const withTime=updateEnrollmentDraftFirst(date.config,'2026-12-19T19:00',date.autoFirstDay);
  assert.equal(withTime.config.weeklySchedule.start,'19:00');
  const sunday=updateEnrollmentDraftFirst(withTime.config,'2026-12-20T20:30',withTime.autoFirstDay);
  assert.deepEqual(sunday.config.weeklySchedule.days,[7]);
  assert.equal(sunday.config.weeklySchedule.start,'20:30');
  assert.equal(enrollmentInstant(sunday.config.enrollmentCloses,sunday.config.timeZone)?.toISOString(),'2026-12-19T23:00:00.000Z');
});

test('a saved manual cutoff and another weekday’s custom start survive first-session changes',()=>{
  const custom=validateEnrollmentClass({...sample,enrollmentClosesMode:'custom'});
  const legacy=validateEnrollmentClass(sample);
  assert.equal(custom.enrollmentClosesMode,'custom');
  assert.equal('enrollmentClosesMode' in legacy,false);
  assert.throws(()=>validateEnrollmentClass({...sample,enrollmentClosesMode:'unknown'}),/enrollment_class_invalid/);
  const plan={days:[5,6,7],start:'15:00',lessons:2,startByDay:{5:'19:00',6:'15:00',7:'17:00'}};
  const next=updateEnrollmentDraftFirst({...custom,period:'mixed',weeklySchedule:plan},'2026-12-20T16:00');
  assert.equal(next.config.enrollmentCloses,'2026-12-19T00:00');
  assert.deepEqual(next.config.weeklySchedule.startByDay,{5:'19:00',6:'15:00',7:'16:00'});
  assert.equal(updateEnrollmentDraftFirst(legacy,'2026-12-20T16:00').config.enrollmentCloses,legacy.enrollmentCloses);
  assert.equal('enrollmentClosesMode' in publicEnrollmentClass({...custom,id:'fixture',revision:1,state:'published'}),false);
});

test('the class save route persists the custom cutoff and clears an explicitly removed legacy teacher',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentCatalog}=await import('../server/portal/enrollmentCatalog');
  const {operationContext}=await import('../server/portal/operationContext');
  type Handler=(request:unknown,response:unknown)=>Promise<void>;
  const posts=new Map<string,Handler>();
  mountEnrollmentCatalog({get:()=>{},post:(path:string,handler:Handler)=>posts.set(path,handler)} as never,
    {wrap:handler=>handler,staff:async()=>({id:'fixture'})});
  const template={id:'fixture-template',courseId:sample.courseId,revision:1,name:'Fixture',format:'standard',
    teacherType:'foreign',capacity:20,minimumPaid:13,saleUnitPrice:25_000,standardUnitPrice:30_000};
  const course={name:'Fixture course',active:true,sessions:23,teaching:{level:'HSK 1',minutes:45}};
  let saved:Record<string,unknown>|undefined;
  const client={query:async(sql:string,parameters:unknown[]=[])=>{
    if(sql.includes('SELECT revision,state,data FROM enrollment_classes'))return {rows:[{revision:1,state:'draft',data:sample}]};
    if(sql.includes('SELECT value FROM portal_settings')&&parameters[0]==='enrollment_template:fixture-template')return {rows:[{value:template}]};
    if(sql.includes('SELECT value FROM crm_courses'))return {rows:[{value:course}]};
    if(sql.startsWith('UPDATE enrollment_classes'))saved=parameters[5] as Record<string,unknown>;
    return {rows:[]};
  }};
  const handler=posts.get('/api/crm/enrollment/classes')!;
  await operationContext.run(client,()=>handler({
    body:{id:'fixture-class',revision:1,state:'draft',requestId:'fixture-class-write',config:{
      ...sample,templateId:template.id,templateRevision:template.revision,teacherId:'',enrollmentClosesMode:'custom',
      weeklySchedule:{days:[6],start:'15:00',lessons:1},
    }},
    headers:{origin:'http://localhost:3000'},protocol:'http',get:()=> 'localhost:3000',is:()=>true,
  },{json:()=>{}}));
  assert.equal(saved?.enrollmentClosesMode,'custom');
  assert.equal(saved?.enrollmentCloses,sample.enrollmentCloses);
  assert.equal(saved?.teacher,'');
  assert.equal(saved?.teacherId,undefined);
});

test('first session weekday and time must match the recurring schedule in WIB',()=>{
  const weeklySchedule={days:[6,7],start:'15:00',lessons:2};
  assert.equal(validateEnrollmentClass({...sample,weeklySchedule}).firstLesson,'2026-12-19T15:00');
  for(const firstLesson of ['2026-12-19T14:00','2026-12-16T15:00','2026-12-16T14:00']){
    assert.throws(()=>validateEnrollmentClass({...sample,firstLesson,
      enrollmentCloses:'2026-12-15T00:00',weeklySchedule}),/enrollment_class_schedule_mismatch/);
  }
  const midnight={...sample,period:'weekday-evening',firstLesson:'2026-12-21T00:00',
    enrollmentCloses:'2026-12-21T00:00',weeklySchedule:{days:[1],start:'00:00',lessons:1}};
  assert.equal(validateEnrollmentClass(midnight).firstLesson,midnight.firstLesson);
  assert.throws(()=>validateEnrollmentClass({...sample,weeklySchedule:{...weeklySchedule,days:[]}}),/enrollment_class_invalid/);
});


test('time slots match all scheduled weekdays, including mixed day selections',()=>{
  const dated={...sample,firstLesson:'2026-12-21T15:00',enrollmentCloses:'2026-12-21T00:00'};
  for(const days of [[1],[1,3],[5,6],[7,1]]) {
    assert.throws(()=>validateEnrollmentClass({...dated,weeklySchedule:{days,start:'15:00',lessons:1}}),
      /enrollment_class_timeslot_mismatch/);
  }
  for(const days of [[6],[7],[6,7]]) {
    assert.throws(()=>validateEnrollmentClass({...sample,period:'weekday-evening',weeklySchedule:{days,start:'15:00',lessons:1}}),
      /enrollment_class_timeslot_mismatch/);
  }
  assert.equal(validateEnrollmentClass({...sample,weeklySchedule:{days:[6,7],start:'15:00',lessons:2}}).period,'weekend');
  assert.equal(validateEnrollmentClass({...dated,period:'weekday-evening',weeklySchedule:{days:[1,3,5],start:'15:00',lessons:2}}).period,'weekday-evening');
});


test('automatic titles use class type, time slot and immutable batch in all three languages',()=>{
  const row={...sample,batchNumber:3,teacherType:'local' as const};
  assert.equal(enrollmentClassTitle(row,'zh'),'HSK 1 · 标准班 · 周末班 · 第 3 期');
  assert.equal(enrollmentClassTitle(row,'en'),'HSK 1 · Standard Class · Weekend · Batch 3');
  assert.equal(enrollmentClassTitle(row,'id'),'HSK 1 · Kelas Standar · Akhir Pekan · Angkatan 3');
  assert.equal(enrollmentTeacherLabel('local','en'),'Indonesian Teacher');
  assert.equal(enrollmentTeacherLabel('local','id'),'Pengajar Lokal');
  assert.equal(enrollmentTeacherLabel('foreign','zh'),'中国外教');
  assert.equal(enrollmentTeacherLabel('foreign','en'),'Teacher from China');
  assert.equal(enrollmentTeacherLabel('foreign','id'),'Pengajar dari Tiongkok');
  assert.equal(enrollmentClassTitle({...row,period:'weekday-evening'},'en'),'HSK 1 · Standard Class · Weekday Evening · Batch 3');
  assert.equal(enrollmentClassTitle({...row,batchNumber:undefined},'zh'),'HSK 1 · 标准班 · 周末班');
  const view=publicEnrollmentClass({...row,id:'demo',state:'published',revision:1});
  assert.equal(view.batchNumber,3);
  assert.equal(view.teacherType,'local');
  assert.equal('templateId' in view,false);
  assert.equal(validateEnrollmentClass({...sample,batchNumber:999}).batchNumber,undefined);
});

test('first session seeds only blank recurring fields and keeps manual choices',async()=>{
  const {enrollmentAutofillStart,enrollmentScheduleErrors}=await import('../src/utils/enrollmentCatalog');
  const draft={...sample,teacher:'Keep teacher',weeklySchedule:{days:[6,7],start:'',lessons:2}};
  const next=enrollmentAutofillStart(draft,'2026-12-19T15:00');
  assert.equal(next.weeklySchedule.start,'15:00');
  assert.deepEqual(next.weeklySchedule.days,[6,7]);
  assert.equal(next.weeklySchedule.lessons,2);
  assert.equal(next.teacher,'Keep teacher');
  assert.equal(draft.weeklySchedule.start,'');
  assert.match(next.schedule,/15:00–16:30/);
  const blankWeek={...draft,weeklySchedule:{days:[],start:'',lessons:2}};
  assert.deepEqual(enrollmentAutofillStart(blankWeek,'2026-12-19T15:00').weeklySchedule,{days:[6],start:'15:00',lessons:2});
  assert.deepEqual(enrollmentAutofillStart({...blankWeek,weeklySchedule:{days:[],start:'17:00',lessons:2}},'2026-12-20T15:00').weeklySchedule,
    {days:[7],start:'17:00',lessons:2});
  assert.equal(enrollmentAutofillStart(next,'2026-12-19T16:00').weeklySchedule.start,'15:00');
  assert.equal(enrollmentAutofillStart(draft,'').weeklySchedule.start,'');
  assert.deepEqual(enrollmentScheduleErrors({...next,templateId:'example'},'zh'),{});
  for(const lang of ['zh','en','id'] as const){
    const empty=enrollmentScheduleErrors({...draft,templateId:'example',period:'',firstLesson:'',enrollmentCloses:'',weeklySchedule:{days:[],start:'',lessons:0}},lang);
    for(const field of ['period','firstLesson','enrollmentCloses','days','start','lessons'])assert.ok(empty[field]);
    const mismatch=enrollmentScheduleErrors({...next,firstLesson:'2026-12-19T16:00'},lang);
    assert.match(mismatch.start,/15:00/);assert.match(mismatch.start,/16:00/);
    assert.ok(enrollmentScheduleErrors({...next,weeklySchedule:{...next.weeklySchedule,days:[7]}},lang).days);
    assert.ok(enrollmentScheduleErrors({...next,weeklySchedule:{...next.weeklySchedule,start:'23:30',lessons:2}},lang).start);
  }
});

test('drafts retain unresolved weekly schedules and conflicts while published classes require a matching plan', () => {
  for (const weeklySchedule of [
    {days:[],start:'19:00',lessons:2},
    {days:[6,7],start:'',lessons:2},
    {days:[5,6],start:'19:00',lessons:2},
    {days:[6,7],start:'17:00',lessons:2},
  ]) {
    const config={...sample,weeklySchedule,schedule:''};
    assert.equal(validateEnrollmentClass(config,true).schedule,'');
    assert.throws(()=>validateEnrollmentClass({...config,schedule:sample.schedule}),/enrollment_class_(invalid|timeslot_mismatch|schedule_mismatch)/);
  }
  assert.throws(()=>validateEnrollmentClass({...sample,weeklySchedule:{days:[8],start:'19:00',lessons:2}},true),/enrollment_class_invalid/);
});

test('partially selected hours and minutes cannot be saved as weekly start times',()=>{
  for(const time of ['19:',':30']){
    assert.throws(()=>validateEnrollmentClass({...sample,weeklySchedule:{days:[6,7],start:time,lessons:1}},true),
      /enrollment_class_invalid/);
    assert.throws(()=>validateEnrollmentClass({...sample,weeklySchedule:{days:[6,7],start:'15:00',lessons:1,
      startByDay:{6:'15:00',7:time}}},true),/enrollment_class_invalid/);
  }
});

test('mixed schedules keep the actual weekday times and validate the first session against its own day', () => {
  const plan={days:[5,6],start:'',startByDay:{5:'19:00',6:'15:00'},lessons:2};
  const config={...sample,period:'mixed',firstLesson:'2026-12-18T19:00',enrollmentCloses:'2026-12-18T00:00',
    weeklySchedule:plan};
  assert.equal(validateEnrollmentClass(config).period,'mixed');
  assert.throws(()=>validateEnrollmentClass({...config,firstLesson:'2026-12-18T15:00'}),/enrollment_class_schedule_mismatch/);
  assert.throws(()=>validateEnrollmentClass({...config,period:'weekday-evening'}),/enrollment_class_timeslot_mismatch/);
  assert.throws(()=>validateEnrollmentClass({...config,weeklySchedule:{...plan,startByDay:{5:'19:00'}}}),/enrollment_class_invalid/);
  assert.equal(previewEnrollmentClassSchedule(config,['2026-12-19'])?.skippedDates[0],'2026-12-19');
  assert.equal(enrollmentWeeklyScheduleText(plan,45,'zh'),'每周五 19:00–20:30；周六 15:00–16:30 WIB');
  assert.equal(enrollmentWeeklyScheduleText(plan,45,'en'),'Fri 19:00–20:30 / Sat 15:00–16:30 WIB');
  assert.equal(enrollmentWeeklyScheduleText(plan,45,'id'),'Jum 19:00–20:30 / Sab 15:00–16:30 WIB');
});


test('learner schedule uses the current language while preserving legacy text-only records',()=>{
  const schedule='每周一、三 19:00–19:45 WIB';
  const row={schedule,minutes:45,weeklySchedule:{days:[1,3],start:'19:00',lessons:1}};
  assert.equal(enrollmentScheduleLabel(row,'en'),'Mon, Wed 19:00–19:45 WIB');
  assert.equal(enrollmentScheduleLabel(row,'id'),'Sen, Rab 19:00–19:45 WIB');
  assert.equal(enrollmentScheduleLabel(row,'zh'),schedule);
  assert.equal(enrollmentScheduleLabel({schedule},'id'),schedule);
  assert.equal(enrollmentScheduleLabel({...row,weeklySchedule:{...row.weeklySchedule,days:[]}},'en'),schedule);
});
test('learner date formatting reuses each locale and style while preserving the Jakarta day boundary',()=>{
  const nearMidnight = new Date('2026-12-31T17:15:00Z');
  for(const [language,locale] of [['zh','zh-CN'],['en','en-GB'],['id','id-ID']] as const){
    const withYear=enrollmentDateFormatter(language,'shortDayWithYear');
    assert.equal(withYear,enrollmentDateFormatter(language,'shortDayWithYear'));
    assert.match(withYear.format(nearMidnight),/2027/);
    assert.equal(enrollmentDateFormatter(language,'time').format(nearMidnight),
      new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'}).format(nearMidnight));
  }
});
