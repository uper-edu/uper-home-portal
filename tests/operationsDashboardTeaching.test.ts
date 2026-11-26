import assert from 'node:assert/strict';
import test from 'node:test';
import {parseDashboardTeaching,readDashboardTeaching,storeDashboardTeaching} from '../server/portal/operationsDashboardTeaching.ts';

const now=Date.parse('2026-11-25T03:00:00Z');
const range={from:'2026-11-22',to:'2026-11-23',level:'',format:'',now};
const finance={currency:'IDR',costedLessons:2,teacherCost:200_000,revenue:500_000,directCost:250_000};
const fullDay={date:range.from,lessons:[
  {id:'lesson-1',minutes:45,attendance:{expected:10,recorded:8,present:7}},
  {id:'lesson-2',minutes:50,attendance:null},
],finance};
const source={version:1,environment:'dev',timeZone:'Asia/Jakarta',from:range.from,to:range.to,
  extractedAt:'2026-11-25T00:00:00.000Z',binding:{kind:'class',referenceId:'group-1'},
  days:[fullDay,{date:range.to,lessons:[]}]};

function memoryDb(){
  const days=new Map<string,any>();
  const statements:string[]=[];
  const db={async query(sql:string,args:unknown[]=[]){
    statements.push(sql);
    if(sql.includes('FROM enrollment_classes'))return {rows:args[0]==='group-1'?[{level:'HSK 1',format:'small'}]:[]};
    if(sql.includes('FROM enrollment_demands'))return {rows:args[0]==='confirmed-1'?[{level:'HSK 2',format:'one-on-one'}]:[]};
    if(sql.startsWith('INSERT')){
      const [key,day,observed]=args as [string,any,string];
      if(!days.has(key)||days.get(key).extractedAt<observed)days.set(key,day);
      return {rows:[]};
    }
    const [start,end,withFinance]=args as [string,string,number];
    return {rows:[...days].filter(([key])=>start<=key&&key<end).map(([,day])=>
      ({value:JSON.stringify({...day,finance:withFinance?day.finance:undefined})}))};
  }};
  return {days,db,statements};
}

test('teaching data separates registered attendance, known eligible rosters and missing days',async()=>{
  const {db,statements}=memoryDb();
  const report=parseDashboardTeaching(source,'dev',now);
  await storeDashboardTeaching(db,report);
  const view=await readDashboardTeaching(db,'dev',range,false);
  assert.equal(view.economics,null);
  assert.deepEqual(view.teaching?.cohorts,[{kind:'class',referenceId:'group-1',level:'HSK 1',format:'small',
    days:2,lessons:2,minutes:95,rosterLessons:1,expected:10,recorded:8,present:7}]);
  assert.match(statements.at(-1)??'',/JSON_REMOVE\(value,'\$\.finance'\)/);
  assert.equal((await readDashboardTeaching(db,'test',range,false)).teaching,null);
});

test('registered one-to-one delivery binds to a confirmed appointment and filters separately',async()=>{
  const {db,days}=memoryDb();
  const parsed=parseDashboardTeaching({...source,binding:{kind:'appointment',referenceId:'confirmed-1'}},'dev',now);
  await storeDashboardTeaching(db,parsed);
  const view=await readDashboardTeaching(db,'dev',{...range,level:'HSK 2',format:'one-on-one'},false);
  assert.equal(view.teaching?.cohorts[0].format,'one-on-one');
  assert.equal((await readDashboardTeaching(db,'dev',{...range,format:'small'},false)).teaching,null);
  await assert.rejects(storeDashboardTeaching(db,{...parsed,binding:{kind:'appointment',referenceId:'unconfirmed'}}),/confirmed appointment/);
  assert.equal(days.size,2);
});

test('finance reports verified cost coverage and withhold incomplete contribution',async()=>{
  const {db,days}=memoryDb();
  const parsed=parseDashboardTeaching(source,'dev',now);
  await storeDashboardTeaching(db,parsed);
  await storeDashboardTeaching(db,parsed);
  assert.equal(days.size,2);
  const read=async(to:string)=>(await readDashboardTeaching(db,'dev',{...range,to},true)).economics?.cohorts[0];
  assert.equal((await read(range.to))?.contribution,250_000);
  assert.equal((await read(range.to))?.directCost,250_000);
  assert.equal((await read('2026-11-24'))?.contribution,null);
  const partial=parseDashboardTeaching({...source,extractedAt:'2026-11-25T01:30:00.000Z',days:[
    {...fullDay,finance:{...finance,costedLessons:1,teacherCost:100_000,directCost:null}},source.days[1],
  ]},'dev',now);
  await storeDashboardTeaching(db,partial);
  await storeDashboardTeaching(db,parsed);
  const cleaned=await read(range.to);
  assert.equal(cleaned?.teacherCost,100_000);
  assert.equal(cleaned?.costedLessons,1);
  assert.equal(cleaned?.revenue,500_000);
  assert.equal(cleaned?.directCost,null);
  assert.equal(cleaned?.contribution,null);
});

test('bad attendance, duplicate lessons, mismatched scope and unofficial finance values are rejected',()=>{
  assert.throws(()=>parseDashboardTeaching(source,'prod',now),/requested environment/);
  assert.throws(()=>parseDashboardTeaching({...source,days:[fullDay]},'dev',now),/every date/);
  const fromDay=fullDay.lessons[0];
  assert.throws(()=>parseDashboardTeaching({...source,days:[fullDay,{date:range.to,lessons:[fromDay]}]},'dev',now),/Duplicate delivered lesson/);
  assert.throws(()=>parseDashboardTeaching({...source,days:[{...fullDay,finance:{...finance,currency:'USD'}},source.days[1]]},'dev',now),/IDR/);
  const badAttendance={...fromDay,attendance:{expected:2,recorded:3,present:1}};
  assert.throws(()=>parseDashboardTeaching({...source,days:[{...fullDay,lessons:[badAttendance]},source.days[1]]},'dev',now),/registered learner lessons/);
});
