import {test} from 'node:test';import assert from 'node:assert/strict';
import {noResponseAttempt,type NoResponsePolicy} from '../src/utils/crmNoResponse';
import {clearSequence} from '../server/portal/noResponse';
const policy:NoResponsePolicy={threshold:3,intervalMs:4*3600000,calendar:{timezone:'UTC',days:[0,1,2,3,4,5,6],start:'00:00',end:'23:59'}};
const at=(h:number)=>new Date(`2026-10-19T${String(h).padStart(2,'0')}:00:00Z`);
test('638 first attempt included; early attempts leave evidence but restart spacing; snapshot and final window',()=>{
 let s=noResponseAttempt(undefined,'No Response',policy,at(9));assert.equal(s.count,1);
 s=noResponseAttempt(s,'No Response',{...policy,threshold:1},at(10));assert.equal(s.count,1);assert.equal(s.lastOutcome,'too_soon');
 s=noResponseAttempt(s,'No Response',policy,at(13));assert.equal(s.count,1);
 s=noResponseAttempt(s,'No Response',policy,at(17));assert.equal(s.count,2);
 s=noResponseAttempt(s,'No Response',policy,at(21));assert.equal(s.count,3);assert.equal(s.status,'waiting');assert.equal(s.policy?.threshold,3);assert.equal(s.waitUntil,'2026-10-20T01:00:00.000Z');
});
test('638 working-calendar roll, wrong number, zero threshold, no historical total reuse',()=>{
 const work={...policy,calendar:{...policy.calendar,days:[1,2,3,4,5],start:'09:00',end:'17:00'}};
 let s=noResponseAttempt(undefined,'No Response',work,at(13));assert.equal(s.nextEligibleAt,'2026-10-20T09:00:00.000Z');
 s=noResponseAttempt(s,'No Response',work,at(18));assert.equal(s.count,1);assert.equal(s.lastOutcome,'too_soon');
 const wrong=noResponseAttempt(s,'Wrong Number',work,at(19));assert.equal(wrong.count,1);
 const disabled=noResponseAttempt(undefined,'No Response',{...policy,threshold:0},at(9));assert.equal(disabled.count,1);assert.equal(disabled.status,'counting');
});
test('638 clear restores only known R6-owned group; later decisions and manual confirmation protected',()=>{
 const base:any={id:'test',tier:'Cold-Nurture',tierSource:'behaviour_override',tierUpdatedAt:at(21).toISOString(),noResponseSequence:{schema:1,revision:3,count:3,status:'nurtured',startedAt:at(9).toISOString(),appliedAt:at(21).toISOString(),beforeTier:{tier:'Unqualified',tierSource:null,tierUpdatedAt:null,flag:null}}};
 let p=clearSequence(base,'customer-message',new Date('2026-10-20T09:00Z'));assert.equal(p.tier,'Unqualified');assert.equal(p.tierSource,undefined);assert.equal(p.noResponseSequence.count,0);
 p=clearSequence({...base,tierConfirmed:true},'customer-message',at(22));assert.equal(p.tier,'Cold-Nurture');assert.equal(p.noResponseSequence.count,0);
 p=clearSequence({...base,tier:'Hot',tierSource:'buying_signal'},'customer-message',at(22));assert.equal(p.tier,'Hot');assert.equal(p.noResponseSequence.needsGroupReview,true);
 p=clearSequence({tier:'Cold-Nurture',tierSource:'behaviour_override'},'staff-reply',at(22));assert.equal(p.tier,'Cold-Nurture');assert.equal(p.noResponseSequence.needsGroupReview,true);
});

test('638 a connected real attempt resets count but still anchors minimum retry spacing',()=>{
 const connected=clearSequence({id:'connected'},'human_connected',at(9));
 const early=noResponseAttempt(connected.noResponseSequence,'No Response',policy,at(10));assert.equal(early.count,0);assert.equal(early.lastOutcome,'too_soon');
});
