import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentWeekOf, latestDueEnrollmentWeek } from '../server/portal/enrollmentWeekly';
import { enrollmentEmailSubjects, renderEnrollmentEmail, type EnrollmentEmailKind } from '../server/portal/enrollmentEmail';
import { enrollmentCard } from '../server/portal/enrollmentCards';

test('Saturday 08:00 WIB switches to the prior Monday-to-Monday period',()=>{
  assert.equal(latestDueEnrollmentWeek(new Date('2026-11-14T00:59:59.999Z')),'2026-10-26');
  assert.equal(latestDueEnrollmentWeek(new Date('2026-11-14T01:00:00Z')),'2026-11-02');
  assert.equal(latestDueEnrollmentWeek(new Date('2026-11-16T01:00:00Z')),'2026-11-02');
  assert.deepEqual(enrollmentWeekOf('2026-11-02'),{
    weekStart:'2026-11-02',endDate:'2026-11-09',from:'2026-11-01 17:00:00',until:'2026-11-08 17:00:00',
  });
  for(const value of ['2026-11-01','2026-11-32','2026-02-30','2026-11-02T00:00:00Z']) assert.equal(enrollmentWeekOf(value),null);
});

test('each email template renders localized HTML and plain text and escapes saved names',()=>{
  for(const kind of Object.keys(enrollmentEmailSubjects) as EnrollmentEmailKind[]) {
    for(const language of ['zh','en','id']){
      const email=renderEnrollmentEmail(kind,{language,salutation:'<Santi> & Co',code:'123456',class:'HSK 1',
        firstLesson:'2026-12-19T15:00',schedule:'Sat & Sun',deadline:'2026-11-15T01:00:00Z',price:575000,
        received:575000,url:'/enrollment/mine?lang='+language,refunded:100000,installment:50000});
      assert.ok(email.subject.length>5);
      assert.match(email.html,new RegExp('<html lang="'+language+'">'));
      assert.match(email.html,/&lt;Santi&gt; &amp; Co/);
      assert.match(email.text,/<Santi> & Co/);
      assert.match(email.html,/https:\/\/uperedu\.com\/contact/);
      assert.equal(email.html.includes('123456'),kind==='otp_apply'||kind==='otp_mine');
    }
  }
});

test('three Lark buttons target the suite route without changing the authenticated origin',()=>{
  for(const [kind,key,id] of [['class','classId','hsk-1'],['payment','orderId','order-123'],['report','weekStart','2026-11-02']] as const){
    const payload=enrollmentCard(kind,id,'TEST',{数量:2});
    const url=new URL(payload.url);
    assert.equal(url.origin,'http://localhost:3000');
    assert.equal(url.pathname,'/crm');
    assert.equal(url.searchParams.get('view'),kind);
    assert.equal(url.searchParams.get(key),id);
    assert.equal(payload.card.body.elements[1].behaviors?.[0].default_url,payload.url);
  }
});
