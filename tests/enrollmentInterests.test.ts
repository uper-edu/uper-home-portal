import assert from 'node:assert/strict';
import test from 'node:test';
import { demandMatches, enrollmentPhone, parseDemand } from '../src/utils/enrollmentInterests';
import {sortEnrollmentRecords} from '../src/utils/enrollmentRecordOrder';
import {enrollmentInterestStillAvailable} from '../server/portal/enrollmentInterestDelivery';

test('queued availability mail checks current seats, vacancy round and demand preferences',async()=>{
  const recipient='learner@example.test',classId='hsk1-weekend',subject_id='interest-id';
  const cohort={data:{capacity:6,level:'HSK 1',period:'weekend',format:'small'},occupied:5};
  const mail={kind:'waitlist_vacancy',subject_id,payload:{classId}};
  const event='email:waitlist_vacancy:'+subject_id+':'+classId+':3';
  const waitlistClient=(occupied:number,waiting:boolean)=>({async query(sql:string,args?:unknown[]){
    if(sql.includes('FROM enrollment_classes'))return {rows:[{...cohort,occupied}]};
    assert.deepEqual(args,[subject_id,recipient,classId,'3']);
    return {rows:waiting?[{id:subject_id}]:[]};
  }});
  assert.equal(await enrollmentInterestStillAvailable(waitlistClient(5,true),event,recipient,mail),true);
  assert.equal(await enrollmentInterestStillAvailable(waitlistClient(6,true),event,recipient,mail),false);
  assert.equal(await enrollmentInterestStillAvailable(waitlistClient(5,false),event,recipient,mail),false);
  const demand={...mail,kind:'demand_match',payload:{}};
  const legacyEvent='email:demand_match:'+subject_id+':'+classId+':0';
  const demandClient=(period:string)=>({async query(sql:string){
    return {rows:sql.includes('FROM enrollment_classes')?[cohort]:[{criteria:{level:'HSK 1',period,format:'small'}}]};
  }});
  assert.equal(await enrollmentInterestStillAvailable(demandClient('any'),legacyEvent,recipient,demand),true);
  assert.equal(await enrollmentInterestStillAvailable(demandClient('weekday-evening'),legacyEvent,recipient,demand),false);
});

test('other needs an explanation and stays for human review; any can match a published cohort', () => {
  const input = { level: 'HSK 4', period: 'any', format: 'small', notes: '', phone: '+628111234567' };
  const criteria = parseDemand(input);
  assert.ok(criteria);
  assert.equal(demandMatches(criteria, { level:'HSK 4A', period:'weekend', format:'small' }),true);
  assert.equal(demandMatches(criteria, { level:'HSK 4B', period:'weekday-evening', format:'standard' }),false);
  assert.equal(parseDemand({...input,period:'other',notes:'  '}),null);
  assert.equal(demandMatches(parseDemand({...input,period:'other',notes:'Sunday evening'})!,
    { level:'HSK 4A', period:'weekend', format:'small' }),false);
  assert.equal(parseDemand({...input,phone:'+123'}),null);
});
test('my enrollments ranks actionable records first, then interleaves all categories by update time',()=>{
  const records=[
    {key:'order-awaiting',needsAction:true,updatedAt:'2026-11-14T00:00:00.000001Z'},
    {key:'order-verified',needsAction:false,updatedAt:'2026-11-15T00:00:00.000001Z'},
    {key:'demand-match',needsAction:true,updatedAt:'2026-11-15T00:00:00.000002Z'},
    {key:'waitlist-full',needsAction:false,updatedAt:'2026-11-15T00:00:00.000002Z'},
    {key:'demand-older',needsAction:false},
  ];
  assert.deepEqual(sortEnrollmentRecords(records).map(row=>row.key),
    ['demand-match','order-awaiting','waitlist-full','order-verified','demand-older']);
  assert.equal(records[0].key,'order-awaiting');
});

test('enrollment intake uses the shared country numbering rules', () => {
  const invalidNumber = '+6280650713191';
  const validNumber = '0812-5071-3191';
  assert.equal(enrollmentPhone(invalidNumber), null);
  assert.equal(enrollmentPhone(' '+validNumber+' '), validNumber);
  assert.equal(parseDemand({level:'HSK 1',period:'any',format:'any',notes:'',phone:invalidNumber}), null);
});
