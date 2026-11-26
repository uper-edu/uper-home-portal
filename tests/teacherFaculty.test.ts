import test from 'node:test';
import assert from 'node:assert/strict';
import {assignedFaculty,listFacultyChoices,readFacultyFile,readFacultyProfile,readFacultyRateDetails,readFacultyRates,saveFacultyProfile,saveFacultyRates} from '../server/portal/faculty.ts';
import {quoteTeacherSettlement,readTeacherSettlements,saveTeacherSettlement} from '../server/portal/operationsDashboardTeacherSettlements.ts';
import {facultyEffectiveDate,facultyFields,facultyLanguages,facultyRateOn,type FacultyTerm} from '../src/utils/crmFaculty.ts';
import {previewEnrollmentClassSchedule} from '../src/utils/enrollmentClassSchedule.ts';
import {summarizeTeacherSettlements,teacherSettlementLineAmount} from '../src/utils/crmTeacherSettlements.ts';

const start='2026-01-31';
const teacher='mock-faculty',second='mock-local';
const original=' 原文\n\n  Multilingual	';
const content=Object.fromEntries(facultyLanguages.map(lang=>[lang,{name:'模拟 '+lang,...Object.fromEntries(Object.keys(facultyFields).map(field=>[field,original+lang+field]))}]));
const profile={revision:0,category:'foreign',active:true,content};
const rate=(overrides:Partial<FacultyTerm>={}):FacultyTerm=>({
  contractStart:start,monthsAfterStart:0,currency:'CNY',kind:'lesson',amountMinor:12_345,note:original,...overrides
});
const example=(stage:Partial<FacultyTerm>={})=>({revision:0,source:original,terms:[rate(),rate({monthsAfterStart:3,amountMinor:20_000,...stage})]});
const fixtures=[
  {id:'mock-class',level:'HSK 1',format:'standard',teacher:'模拟 zh',teacher_id:teacher,minutes:45},
  {id:'mock-booking',level:'HSK 1',format:'one-on-one',teacher:'模拟 id',teacher_id:second,minutes:45},
];

function harness(){
  const map=new Map<string,unknown>(),audit:unknown[][]=[];
  const db={async query(sql:string,args:unknown[]){
    const key=String(args[0]),result=(rows:unknown[]=[])=>({rows:structuredClone(rows)});
    if(sql.includes('FROM enrollment_classes')||sql.includes('FROM enrollment_demands'))
      return result(fixtures.filter(row=>row.id===key));
    if(sql.includes(' WHERE id LIKE ')){
      const prefix=key.replaceAll('=_','_').slice(0,-1);
      return result([...map].filter(([id])=>id.startsWith(prefix)).map(([,value])=>({value})));
    }
    if(sql.startsWith('SELECT value'))return result(map.has(key)?[{value:map.get(key)}]:[]);
    if(sql.includes('ON DUPLICATE KEY UPDATE id=id')){
      if(!map.has(key))map.set(key,structuredClone(args[1]));
    }else if(sql.startsWith('INSERT INTO portal_settings')||sql.startsWith('UPDATE portal_settings'))map.set(key,structuredClone(args[1]));
    else if(sql.startsWith('DELETE FROM portal_settings'))map.delete(key);
    else if(sql.startsWith('INSERT INTO portal_audit'))audit.push(structuredClone(args));
    else throw Error('Unexpected SQL: '+sql);
    return result();
  }};
  return {db,audit};
}

test('all workbook dimensions and independent original text round-trip for three languages',async()=>{
  const {db,audit}=harness();
  const first=await saveFacultyProfile(db,teacher,profile,'mock-ops');
  assert.deepEqual((await readFacultyProfile(db,teacher))?.content,content);
  assert.equal(Object.keys(first.content.id!).length,Object.keys(facultyFields).length+1);
  assert.equal((await listFacultyChoices(db))[0].names.en,'模拟 en');
  assert.deepEqual(Object.keys((await listFacultyChoices(db))[0]).sort(),['active','category','id','names']);
  assert.deepEqual(await saveFacultyProfile(db,teacher,profile,'mock-ops'),first);
  await assert.rejects(saveFacultyProfile(db,teacher,{...profile,active:false},'mock-ops'),{status:409});
  assert.equal(audit.length,1);
});

test('photo and CV are validated, stored privately and projected as metadata',async()=>{
  const {db}=harness();
  const photo=Buffer.from([0xff,0xd8,0xff,...Array(27).fill(0)]).toString('base64');
  const cv=Buffer.from('%PDF-1.4 mock content').toString('base64');
  const files={photo:{name:'mock.jpg',type:'image/jpeg',data:photo},cv:{name:'mock.pdf',type:'application/pdf',data:cv}};
  const saved=await saveFacultyProfile(db,teacher,{...profile,files},'mock-ops');
  assert.deepEqual(Object.keys(saved.files.photo!).sort(),['name','size','type']);
  assert.equal((await readFacultyFile(db,teacher,'cv'))?.data,cv);
  await assert.rejects(saveFacultyProfile(db,teacher,{...profile,revision:1,files:{photo:files.cv}},'mock-ops'),{message:'faculty_file'});
});

test('published plans inherit one active teacher through holidays and the same choice is used by private confirmation',async()=>{
  const {db}=harness();
  await saveFacultyProfile(db,teacher,profile,'mock-ops');
  const chosen=await assignedFaculty(db,teacher,'foreign');
  const plan=previewEnrollmentClassSchedule({firstLesson:'2026-11-25T19:00',weeklySchedule:{days:[3],start:'19:00',lessons:2},
    sessions:5,minutes:45,...chosen},['2026-12-02']);
  assert.deepEqual(plan?.meetings.map(({date,periods,teacherId})=>[date,periods,teacherId]),
    [['2026-11-25',2,teacher],['2026-12-09',2,teacher],['2026-12-16',1,teacher]]);
  await assert.rejects(assignedFaculty(db,teacher,'local'),{status:409});
  await saveFacultyProfile(db,teacher,{...profile,revision:1,active:false},'mock-ops');
  assert.equal((await listFacultyChoices(db)).length,0);
  await assert.rejects(assignedFaculty(db,teacher),{status:409});
  assert.equal(plan?.meetings[0].teacherId,teacher);
});

test('contract dates set phases with calendar-month clamping and finance preserves original compensation wording',async()=>{
  const {db}=harness();
  await saveFacultyProfile(db,teacher,profile,'mock-ops');
  const saved=await saveFacultyRates(db,teacher,example(),'mock-finance');
  assert.equal(facultyEffectiveDate(saved.terms[1]),'2026-04-30');
  assert.equal(facultyRateOn(saved.terms,'2026-04-29')?.amountMinor,12_345);
  assert.equal(facultyRateOn(saved.terms,'2026-04-30')?.amountMinor,20_000);
  assert.equal((await readFacultyRates(db,teacher)).source,original);
  await assert.rejects(saveFacultyRates(db,teacher,{revision:1,source:'',terms:[rate({monthsAfterStart:3})]},'f'),{message:'faculty_rate_phases'});
  await assert.rejects(saveFacultyRates(db,teacher,{revision:0,source:'changed',terms:[rate()]},'f'),{status:409});
});

test('undated structured terms do not price lessons and rate edits retain before and after once',async()=>{
  const {db,audit}=harness();
  await saveFacultyProfile(db,teacher,profile,'mock-ops');
  const pending=[rate({contractStart:'',currency:'IDR',amountMinor:90_000}),
    rate({contractStart:'',currency:'IDR',amountMinor:100_000,monthsAfterStart:3})];
  const input={revision:0,terms:pending,source:'',reason:'Workbook import'};
  const saved=await saveFacultyRates(db,teacher,input,'finance','Mock Finance');
  assert.deepEqual(await saveFacultyRates(db,teacher,input,'finance','Mock Finance'),saved);
  assert.equal(facultyRateOn(saved.terms,start),undefined);
  assert.deepEqual(await quoteTeacherSettlement(db,'class','mock-class',start,start),{kind:'missing'});
  const dated=pending.map(term=>({...term,contractStart:start}));
  await saveFacultyRates(db,teacher,{revision:1,terms:dated,reason:'Date confirmed'},'finance','Mock Finance');
  const {history}=await readFacultyRateDetails(db,teacher);
  assert.deepEqual(history.map(row=>[row.revision,row.reason,row.before,row.after]),[
    [2,'Date confirmed',pending,dated],[1,'Workbook import',[],pending],
  ]);
  assert.equal(history[0].actor,'Mock Finance');
  assert.equal(audit.length,3);
  await saveFacultyProfile(db,second,{...profile,category:'local'},'mock-ops');
  const unknown=rate({contractStart:'',kind:'monthly',currency:null,amountMinor:null,note:'Fulltime'});
  assert.deepEqual((await saveFacultyRates(db,second,{revision:0,terms:[unknown]},'finance')).terms,[unknown]);
  await assert.rejects(saveFacultyRates(db,second,{revision:1,terms:[{...unknown,amountMinor:1}]},'finance'),{status:400});
});

test('settlement freezes approved CNY fee and IDR conversion, rejects cross-stage ranges and overlapping service',async()=>{
  const {db}=harness();
  await saveFacultyProfile(db,teacher,profile,'mock-ops');
  await saveFacultyRates(db,teacher,example(),'mock-finance');
  const before='2026-04-29',after='2026-04-30';
  assert.deepEqual(await quoteTeacherSettlement(db,'class','mock-class',before,after),{kind:'split'});
  const quote=await quoteTeacherSettlement(db,'class','mock-class',before,before);
  assert.equal(quote.kind==='lesson'&&quote.amountMinor,12_345);
  const line={kind:'class',referenceId:'mock-class',lessons:2,lessonFee:0,
    service:{from:before,to:before,rateRevision:1,convertedIDR:555_000,basis:'模拟折算记录'}};
  const other={...line,service:{...line.service,from:after,to:after,convertedIDR:900_000}};
  const draft={number:'MOCK/1',month:'2026-04',revision:null,reason:'',lines:[line,other]};
  const save=(body:unknown)=>saveTeacherSettlement(db,'dev',body,'mock-finance');
  await assert.rejects(save({...draft,lines:[line,line]}),{message:'teacher_settlement_lines_duplicate'});
  await assert.rejects(save({...draft,lines:[{...line,service:{...line.service,to:after}}]}),{message:'teacher_settlement_rate_split'});
  await assert.rejects(save({...draft,lines:[{...line,service:{from:before,to:before,rateRevision:1}}]}),{status:400});
  const record=await save(draft);
  assert.equal((await save(draft)).revision,record.revision);
  assert.equal(record.lines[0].rate?.kind==='lesson'&&record.lines[0].rate.amountMinor,12_345);
  await saveFacultyRates(db,teacher,{revision:1,source:'新协议',terms:[rate({amountMinor:50_000})]},'mock-finance');
  await assert.rejects(save({...draft,number:'MOCK/2',lines:[line]}),
    {message:'teacher_settlement_already_recorded',status:409,number:record.number});
  await assert.rejects(save({...draft,number:'MOCK/2',lines:[{...line,service:{...line.service,to:'2026-04-28',from:'2026-04-28'}}]}),
    {message:'teacher_settlement_rate_changed'});
  const history=await save({...draft,revision:record.revision,reason:'模拟更正折算依据',lines:[{...line,service:{...line.service,basis:'更新凭据'}},other]});
  assert.equal(history.lines[0].rate?.kind==='lesson'&&history.lines[0].rate.amountMinor,12_345);
  assert.equal(summarizeTeacherSettlements((await readTeacherSettlements(db,'dev','2026-04')).records).IDR,1_455_000);
});

test('IDR hours are priced per lesson and monthly contracts are preserved as unallocated',async()=>{
  const {db}=harness();
  await saveFacultyProfile(db,second,{...profile,category:'local'},'mock-ops');
  await saveFacultyRates(db,second,{revision:0,source:'模拟按课时转月薪',terms:[
    rate({currency:'IDR',amountMinor:300_000}),rate({currency:'IDR',kind:'monthly',monthsAfterStart:3,amountMinor:null})
  ]},'mock-finance');
  const line={kind:'appointment',referenceId:'mock-booking',lessons:2,lessonFee:0};
  const inPeriod=(date:string)=>({...line,service:{from:date,to:date,rateRevision:1}});
  const saved=await saveTeacherSettlement(db,'dev',{number:'MOCK-SALARY',month:'2026-04',revision:null,reason:'',
    lines:[inPeriod('2026-04-29'),inPeriod('2026-04-30')]},'mock-finance');
  assert.equal(teacherSettlementLineAmount(saved.lines[0]),600_000);
  assert.equal(teacherSettlementLineAmount(saved.lines[1]),null);
  assert.deepEqual(summarizeTeacherSettlements([saved]),{IDR:600_000,class:0,appointment:600_000,lessons:2,pending:1});
});
