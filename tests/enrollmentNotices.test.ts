import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentWeekOf, latestDueEnrollmentWeek } from '../server/portal/enrollmentWeekly';
import { enrollmentOrderEmailPath, enrollmentEmailSubjects, renderEnrollmentEmail, type EnrollmentEmailKind } from '../server/portal/enrollmentEmail';
import { enrollmentCard } from '../server/portal/enrollmentCards';
import { proofTransferDetails,summarizeEnrollmentProofs } from '../server/portal/enrollmentProofTotals';
import { workingDayDeadline } from '../src/utils/workCalendar';

test('refund deadline counts configured working dates across a weekend',()=>{
  const calendar={timezone:'Asia/Jakarta',workDays:[1,2,3,4,5],endTime:'17:00'};
  assert.equal(workingDayDeadline(new Date('2026-11-13T08:00:00Z'),3,calendar),'2026-11-18T10:00:00.000Z');
  assert.equal(workingDayDeadline(new Date('2026-11-15T18:00:00Z'),1,calendar),'2026-11-17T10:00:00.000Z');
  assert.equal(workingDayDeadline(new Date('2026-11-13T08:00:00Z'),1,calendar),'2026-11-16T10:00:00.000Z');
  assert.throws(()=>workingDayDeadline(new Date(),3,{...calendar,workDays:[]}));
});

test('pending transfer totals deduplicate proof and reference while keeping unknown and verified amounts separate',()=>{
  const proof=(orderId:string,digest:string,details:any,verified=0,matched=0)=>({orderId,digest,details,verified,matched});
  const results=summarizeEnrollmentProofs([
    proof('a','image',{amount:250000,reference:'REF-1'},100000,100000),
    proof('a','image',null,100000),
    proof('a','another-image',{reference:'REF-1'},100000,100000),
    proof('a','second-transfer',{amount:100000,reference:'REF-2'},100000),
    proof('b','legacy',null),
    proof('c','unmatched',{amount:300000},50000),
    proof('d','matched',{reference:'REF-3'},50000,50000),
    proof('e','shared',{amount:50000,reference:'REUSED'}),
    proof('f','shared',{amount:50000,reference:'REUSED'}),
  ]);
  assert.deepEqual(results,{pending:6,pendingParticipants:5,pendingUnknownCount:4,pendingAmount:250000});
  assert.deepEqual(proofTransferDetails(undefined,undefined),null);
  assert.deepEqual(proofTransferDetails(575000,' bank-01 '),{amount:575000,reference:'BANK-01'});
  assert.throws(()=>proofTransferDetails('575000',undefined),/amount/);
});

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
      const email=renderEnrollmentEmail(kind,{language,salutation:'<Santi> & Co',code:'123456',class:'HSK 1',format:'standard',period:'weekend',
        firstLesson:'2026-12-19T15:00',schedule:'Sat & Sun',deadline:'2026-11-15T01:00:00Z',price:575000,
        received:575000,orderId:'QA-123',url:'/enrollment/mine?lang='+language,refunded:100000,installment:50000});
      assert.match(email.subject,/\bUPER\b/);
      assert.doesNotMatch(email.html,/<h1\b/);
      assert.ok(!email.text.startsWith(email.subject));
      assert.match(email.html,new RegExp('<html lang="'+language+'">'));
      assert.match(email.html,/&lt;Santi&gt; &amp; Co/);
      assert.match(email.text,/<Santi> & Co/);
      const contactMatch=email.text.match(/https:\/\/wa\.me\/6281116612062\?text=\S+/);
      assert.ok(contactMatch);
      const supportMessage=new URL(contactMatch[0]).searchParams.get('text')!;
      assert.ok(supportMessage.includes('UPER'));
      assert.ok(email.html.includes(contactMatch[0]));
      assert.doesNotMatch(supportMessage,/123456|Santi/);
      const otp=kind==='otp_apply'||kind==='otp_mine';
      const index=['zh','en','id'].indexOf(language);
      const opening=email.text.split('\n\n')[1];
      assert.ok(opening);
      assert.doesNotMatch(opening,/HSK 1|123456|WIB/);
      const openingPosition=email.html.indexOf(opening.replaceAll('&','&amp;').replaceAll("'",'&#39;'));
      assert.ok(openingPosition>=0&&openingPosition<email.html.indexOf(otp?'123456':'HSK 1'));
      assert.equal(supportMessage.includes('QA-123'),!otp);
      assert.equal(supportMessage.includes('HSK 1'),!otp);
      assert.equal(email.html.includes('123456'),otp);
      assert.equal(email.html.includes('/enrollment/mine?lang='),!otp);
      assert.equal(email.html.includes('HSK 1'),!otp);
      assert.equal(email.text.includes('Sat & Sun'),!otp&&kind!=='payment_confirmed');
      assert.equal(email.text.includes('WIB'),!otp&&kind!=='payment_confirmed');
      assert.ok(email.text.includes(['谢谢！','Best regards,','Salam hormat,'][index]+'\n'));
      assert.ok(email.html.includes(['标准班','Standard class','Kelas standar'][index])===!otp);
    }
  }
});

test('payment confirmation leaves class arrangements to staff and has no separate opening email',()=>{
  assert.ok(!('payment_and_opening' in enrollmentEmailSubjects));
  assert.ok(!('class_confirmed' in enrollmentEmailSubjects));
  for(const language of ['zh','en','id']){
    const email=renderEnrollmentEmail('payment_confirmed',{language,class:'HSK 1',received:575000,
      firstLesson:'2026-12-19T15:00',schedule:'QA planned schedule'});
    assert.match(email.text,/575[.,]000/);
    assert.doesNotMatch(email.text,/QA planned schedule|WIB/);
    assert.match(email.text,/会在首课前联系|will contact you before your first lesson|akan menghubungi Anda sebelum pertemuan pertama/);
  }
});

test('refund and availability emails state the outcome before the class details',()=>{
  const facts={language:'zh',class:'HSK 1',expected:575000,installment:50000,refunded:150000};
  const refundAccepted=renderEnrollmentEmail('refund_accepted',facts).text;
  assert.match(refundAccepted.split('\n\n')[1],/报名已取消.*退款申请/);
  assert.match(refundAccepted,/退款金额[^\n]*575[.,]000/);
  assert.doesNotMatch(renderEnrollmentEmail('refund_accepted',{...facts,expected:0}).text,/退款将按原付款方式退回/);
  const refundRecorded=renderEnrollmentEmail('refund_recorded',facts).text;
  assert.match(refundRecorded.split('\n\n')[1],/本次退款发出/);
  assert.match(refundRecorded,/本次退款金额[^\n]*50[.,]000/);
  assert.match(refundRecorded,/累计已发出退款金额[^\n]*150[.,]000/);
  assert.match(refundRecorded,/尚待发出的退款金额[^\n]*425[.,]000/);
  assert.match(renderEnrollmentEmail('waitlist_vacancy',facts).text.split('\n\n')[1],/候补的班次已有空位/);
  assert.match(renderEnrollmentEmail('demand_match',facts).text.split('\n\n')[1],/符合您选课需求且有空位/);
});

test('transfer email distinguishes both classes and omits an absent date or name',()=>{
  const email=renderEnrollmentEmail('transfer_invitation',{language:'en',salutation:'  ',class:'HSK 1',
    format:'standard',period:'weekend',targetClass:'HSK 1',targetFormat:'small',targetPeriod:'weekday-evening',
    targetFirstLesson:'2026-12-19T15:00',targetSchedule:'Mon and Wed',replyBy:'2026-12-16T10:00:00Z'});
  assert.match(email.text,/Hello,/);
  assert.match(email.text,/Original class · HSK 1 · Standard class · Weekend/);
  assert.doesNotMatch(email.text,/Originally scheduled first class/);
  assert.match(email.text,/New class · HSK 1 · Small group · Weekday evening/);
  assert.match(email.text,/New class first lesson[^\n]*3:00[^\n]*WIB/);
  assert.match(email.text,/New class weekly schedule · Mon and Wed/);
  assert.match(email.text,/Reply deadline[^\n]*5:00[^\n]*WIB/);
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

test('order emails link to the existing payment, invitation, and refund views',()=>{
  for(const [kind,path,view,target] of [
    ['seat_reserved','/enrollment/payment',null,null],
    ['transfer_invitation','/enrollment/mine','invitation','test-invite'],
    ['refund_accepted','/enrollment/mine','refund',null],
    ['proof_received','/enrollment/mine',null,null],
  ] as const){
    const url=enrollmentOrderEmailPath(kind,'id','test-order',target??'');
    const destination=new URL(url,'http://localhost:3000');
    assert.equal(destination.pathname,path);
    assert.equal(destination.searchParams.get('order'),'test-order');
    assert.equal(destination.searchParams.get('lang'),'id');
    assert.equal(destination.searchParams.get('view'),view);
    assert.equal(destination.searchParams.get('target'),target);
    assert.ok(renderEnrollmentEmail(kind,{language:'id',url}).html.includes(url.replaceAll('&','&amp;')));
  }
});
