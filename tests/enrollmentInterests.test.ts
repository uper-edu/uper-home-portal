import assert from 'node:assert/strict';
import test from 'node:test';
import { demandMatches, parseDemand } from '../src/utils/enrollmentInterests';

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
