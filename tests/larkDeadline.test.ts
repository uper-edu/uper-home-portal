import test from 'node:test';import assert from 'node:assert/strict';
import {notificationDeadlineStatus} from '../src/utils/larkNotificationContent.ts';
import {standardLarkCard} from '../server/portal/notificationDelivery.ts';
const reference='2030-01-06T07:00:00Z';
test('deadline status keeps exact boundary, offsets, date-only and invalid timestamps distinct',()=>{
 assert.equal(notificationDeadlineStatus('2030-01-06T09:30:00Z',reference,'zh'),'还剩2小时30分钟');
 assert.equal(notificationDeadlineStatus('2030-01-06T05:00:00Z',reference,'zh'),'已逾期2小时');
 assert.equal(notificationDeadlineStatus(reference,reference,'zh'),'已到期');
 assert.equal(notificationDeadlineStatus('2030-01-06T07:00:20Z',reference,'zh'),'还剩不足1分钟');
 assert.equal(notificationDeadlineStatus('2030-01-06T16:30:00+07:00',reference,'zh'),'还剩2小时30分钟');
 assert.equal(notificationDeadlineStatus('2030-01-06 09:30:00',reference,'zh'),'还剩2小时30分钟');
 for(const value of [undefined,'','invalid','2030-01-06',' 2030-01-06 '])assert.equal(notificationDeadlineStatus(value,reference,'zh'),undefined);
 assert.equal(notificationDeadlineStatus(reference,undefined,'zh'),undefined);
});
test('card uses the actual send attempt time, not stale preview time, in all three languages',()=>{
 for(const language of ['zh','en','id'] as const){
  const input={kind:'task.overdue' as const,language,name:'Maya',due:'2030-01-06 09:30',dueAt:'2030-01-06T09:30:00Z',asOf:'2020-01-01T00:00:00Z'};
  const before=standardLarkCard(input,'lead-a',undefined,new Date(reference)).card.elements[0].text.content;
  const delayed=standardLarkCard(input,'lead-a',undefined,new Date('2030-01-06T10:30:00Z')).card.elements[0].text.content;
  assert.ok(before.includes('2030-01-06 09:30'));assert.ok(delayed.includes('2030-01-06 09:30'));
  assert.ok(before.includes(language==='zh'?'还剩2小时30分钟':language==='en'?'2h 30m remaining':'Tersisa 2 jam 30 menit'));
  assert.ok(delayed.includes(language==='zh'?'已逾期1小时':language==='en'?'Overdue 1h':'Terlambat 1 jam'));
  const dateOnly=standardLarkCard({...input,due:'2030-01-06',dueAt:'2030-01-06'},'lead-a',undefined,new Date(reference));
  assert.ok(!dateOnly.card.elements[0].text.content.includes(language==='zh'?'期限状态':language==='en'?'Deadline status':'Status tenggat'));
 }
});
