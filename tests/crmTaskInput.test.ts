import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTaskInput} from '../src/utils/crmTaskInput';
const valid={command:'create',action:'Send requested timetable',purpose:'Answer customer request',reason:'Customer asked for the schedule',timing:'response',date:'2026-10-24T09:00'};
const now=Date.parse('2026-10-22T18:00:00Z');
test('new task converts the displayed operating time rather than the browser timezone',()=>{
 assert.deepEqual(prepareTaskInput(valid,'Asia/Jakarta',now),{dueAt:'2026-10-24T02:00:00.000Z'});
});
test('the reported save failure identifies past operating time and keeps the future-time rule',()=>{
 for(const date of ['2026-10-22T15:01','2026-10-23T01:00'])assert.deepEqual(prepareTaskInput({...valid,date},'Asia/Jakarta',now),{error:'Choose a future time in the operating timezone',field:'date'});
});
test('required task fields each have a specific error',()=>{
 for(const [field,key] of [['action','action'],['timing','timing'],['date','date']])assert.equal(prepareTaskInput({...valid,[field]:''},'Asia/Jakarta',now).field,key);
 assert.equal(prepareTaskInput({...valid,date:'not a date'},'Asia/Jakarta',now).field,'date');
});
test('existing request evidence and supplements do not require inventing a future deadline',()=>{
 assert.deepEqual(prepareTaskInput({...valid,command:'create_request',date:''},'Asia/Jakarta',now),{dueAt:undefined});
 assert.deepEqual(prepareTaskInput({...valid,command:'supplement',action:'',purpose:'',timing:'',date:''},'Asia/Jakarta',now),{dueAt:undefined});
});

test('new tasks need no purpose or note, but changes still require a reason',()=>{
 assert.ok(prepareTaskInput({...valid,purpose:'',reason:''},'Asia/Jakarta',now).dueAt);
 for(const command of ['cancel','reschedule','replace'])assert.equal(prepareTaskInput({...valid,command,reason:''},'Asia/Jakarta',now).field,'reason');
});
