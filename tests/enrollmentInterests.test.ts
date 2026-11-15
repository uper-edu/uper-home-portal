import assert from 'node:assert/strict';
import test from 'node:test';
import { demandMatches, parseDemand } from '../src/utils/enrollmentInterests';
import {sortEnrollmentRecords} from '../src/utils/enrollmentRecordOrder';

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
