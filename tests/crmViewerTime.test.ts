import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCrmOperatingTime,crmInstant,validateLocalInstant} from '../src/utils/crmOperatingTime';
import {campaignViewerSchedule,campaignStoredSchedule} from '../src/utils/campaignScheduleInput';
import {agreementTime} from '../src/utils/crmProgressDetails';
import {presentAgreement} from '../src/utils/crmAgreementPresentation';
import {prepareTaskInput} from '../src/utils/crmTaskInput';
import {prepareProgressDraft} from '../src/utils/crmProgressDraft';
const zone='America/Vancouver';
test('UTC database instants render locally with date rollover and no suffix',()=>{
 assert.equal(crmInstant('2026-10-28 01:00:00')!.toISOString(),'2026-10-28T01:00:00.000Z');
 assert.equal(formatCrmOperatingTime('2026-10-28 01:00:00',zone),'2026-10-27 18:00:00');
 assert.equal(agreementTime({at:'2026-10-28T01:00:00Z',timezone:'Asia/Jakarta'},zone,'zh'),'2026-10-27 18:00:00');
});
test('date-only agreements retain their date and original calendar boundary',()=>{
 const a={date:'2026-10-28',timezone:'Asia/Jakarta'};
 assert.equal(agreementTime(a,zone,'zh',true),'2026-10-28');
 assert.equal(presentAgreement(a,zone,Date.parse('2026-10-27T18:00:00Z')).status,'today');
});
test('campaign viewer input round-trips to unchanged canonical operating wall clock',()=>{
 const shown=campaignViewerSchedule('2026-10-28','08:00',zone);
 assert.deepEqual(shown,{date:'2026-10-27',time:'18:00'});
 assert.deepEqual(campaignStoredSchedule(shown.date,shown.time,zone),{date:'2026-10-28',time:'08:00'});
 assert.deepEqual(campaignViewerSchedule('2026-10-28','',zone),{date:'2026-10-28',time:''});
});
test('task creation and edit interpret local wall clock; untouched edit never replaces original deadline',()=>{
 const input={command:'create',action:'TEST',purpose:'',reason:'',timing:'appointment',date:'2026-10-27T18:00'};
 assert.equal(prepareTaskInput(input,zone,Date.parse('2026-10-26T00:00:00Z')).dueAt,'2026-10-28T01:00:00.000Z');
 assert.deepEqual(prepareTaskInput({...input,command:'edit',originalDate:input.date},zone),{dueAt:undefined});
});
test('contact and exact agreement input share viewer-zone conversion; date-only stays original',()=>{
 const d=prepareProgressDraft({recordKind:'contact',occurrenceMode:'specified',contactLocal:'2026-10-27T18:00',agreementIntent:'new',agreementTiming:'date',commitmentAction:'TEST',commitmentDate:'2026-10-28'},zone);
 assert.equal(d.occurredAt,'2026-10-28T01:00:00.000Z');assert.equal(d.commitment.date,'2026-10-28');assert.equal(d.commitment.at,undefined);
});
test('DST gaps and repeated times are rejected, normal winter time is preserved',()=>{
 assert.throws(()=>campaignStoredSchedule('2026-03-08','02:30','America/New_York'));
 assert.throws(()=>campaignStoredSchedule('2026-11-01','01:30','America/New_York'));
 assert.deepEqual(campaignStoredSchedule('2026-11-02','09:00','America/New_York'),{date:'2026-11-02',time:'21:00'});
});
