import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentClassTitle,enrollmentTeacherLabel,enrollmentInstant, enrollmentOpeningNotice, enrollmentScheduleDefaults, isEnrollmentInsertionWindow, publicEnrollmentClass, validateEnrollmentClass } from '../src/utils/enrollmentCatalog';
import {previewEnrollmentClassSchedule} from '../src/utils/enrollmentClassSchedule';

const sample = {
  courseId: 'hsk1', level: 'HSK 1', format: 'standard', period: 'weekend',
  firstLesson: '2026-12-19T15:00', decisionAt: '2026-12-17T17:00', enrollmentCloses: '2026-12-19T00:00',
  schedule: 'Saturday and Sunday, 15:00–15:45 WIB', sessions: 23, minutes: 45, minimumPaid: 13, capacity: 20,
  price: 575000, standardPrice: null, learningOutcomes: 'Introduction and greetings',
  material: 'Sample materials', resources: 'Sample practice', teacher: 'Sample teacher',
};

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
  assert.deepEqual(config, sample);
  assert.equal(enrollmentInstant(config.firstLesson)?.toISOString(), '2026-12-19T08:00:00.000Z');
  assert.equal(validateEnrollmentClass({ ...sample, enrollmentCloses: '2026-12-18T10:00' }).enrollmentCloses, '2026-12-18T10:00');
  for (const change of [
    { firstLesson: '2026-02-30T15:00' }, { enrollmentCloses: '2026-12-20T00:00' }, { enrollmentCloses: '2026-12-19T00:01' },
    { decisionAt: '2026-12-20T00:00' }, { minimumPaid: 21 }, { price: 575000.5 }, { format: 'one-on-one' },
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

test('class opening notice changes at the expected WIB time without inferring a class outcome',()=>{
  const decisionAt='2026-12-17T17:00';
  assert.deepEqual(enrollmentScheduleDefaults('2027-01-01T15:00'),{enrollmentCloses:'2027-01-01T00:00',decisionAt:'2026-12-30T17:00'});
  const exact=Date.parse('2026-12-17T10:00:00Z');
  assert.match(enrollmentOpeningNotice(decisionAt,'zh',exact-1),/预计.*通知开班结果/);
  assert.equal(enrollmentOpeningNotice(decisionAt,'zh',exact),'开班结果待确认');
  assert.equal(enrollmentOpeningNotice(decisionAt,'en',exact+1),'Class opening still to be confirmed');
  assert.equal(enrollmentOpeningNotice(decisionAt,'id',exact+1),'Pembukaan kelas masih menunggu konfirmasi');
  assert.equal(enrollmentOpeningNotice(undefined,'zh',exact),'');
});

test('first session weekday and time must match the recurring schedule in WIB',()=>{
  const weeklySchedule={days:[6,7],start:'15:00',lessons:2};
  assert.equal(validateEnrollmentClass({...sample,weeklySchedule}).firstLesson,'2026-12-19T15:00');
  for(const firstLesson of ['2026-12-19T14:00','2026-12-16T15:00','2026-12-16T14:00']){
    assert.throws(()=>validateEnrollmentClass({...sample,firstLesson,decisionAt:'2026-12-14T17:00',
      enrollmentCloses:'2026-12-15T00:00',weeklySchedule}),/enrollment_class_schedule_mismatch/);
  }
  const midnight={...sample,period:'weekday-evening',firstLesson:'2026-12-21T00:00',decisionAt:'2026-12-19T17:00',
    enrollmentCloses:'2026-12-21T00:00',weeklySchedule:{days:[1],start:'00:00',lessons:1}};
  assert.equal(validateEnrollmentClass(midnight).firstLesson,midnight.firstLesson);
  assert.throws(()=>validateEnrollmentClass({...sample,weeklySchedule:{...weeklySchedule,days:[]}}),/enrollment_class_invalid/);
});


test('time slots match all scheduled weekdays, including mixed day selections',()=>{
  const dated={...sample,firstLesson:'2026-12-21T15:00',decisionAt:'2026-12-19T17:00',enrollmentCloses:'2026-12-21T00:00'};
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
  assert.equal(enrollmentTeacherLabel('foreign','zh'),'外教');
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
    const empty=enrollmentScheduleErrors({...draft,templateId:'example',period:'',firstLesson:'',decisionAt:'',enrollmentCloses:'',weeklySchedule:{days:[],start:'',lessons:0}},lang);
    for(const field of ['period','firstLesson','decisionAt','enrollmentCloses','days','start','lessons'])assert.ok(empty[field]);
    const mismatch=enrollmentScheduleErrors({...next,firstLesson:'2026-12-19T16:00'},lang);
    assert.match(mismatch.start,/15:00/);assert.match(mismatch.start,/16:00/);
    assert.ok(enrollmentScheduleErrors({...next,weeklySchedule:{...next.weeklySchedule,days:[7]}},lang).days);
    assert.ok(enrollmentScheduleErrors({...next,weeklySchedule:{...next.weeklySchedule,start:'23:30',lessons:2}},lang).start);
  }
});
