import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentWeekOf, latestDueEnrollmentWeek } from '../server/portal/enrollmentWeekly';
import { enrollmentAssistanceLink,enrollmentEmailWhatsAppDestination,enrollmentEmailWhatsAppPath,enrollmentOrderEmailPath,enrollmentEmailSubjects,renderEnrollmentEmail,type EnrollmentEmailKind } from '../server/portal/enrollmentEmail';
import { enrollmentCard } from '../server/portal/enrollmentCards';
import { proofTransferDetails,summarizeEnrollmentProofs } from '../server/portal/enrollmentProofTotals';
import { workingDayDeadline } from '../src/utils/workCalendar';

test('enrollment notices enqueue with one consistent mail configuration read',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {orderNotice,sendAssistanceMail,proofNotices}=await import('../server/portal/enrollmentNotices');
  const {smtpRecipientPolicy}=await import('../server/portal/enrollmentMailRecipientPolicy');
  const learner='notice-learner@example.invalid';
  const quote={level:'HSK 1',format:'standard',period:'weekend',firstLesson:'2027-01-09T09:00',schedule:'Sat 09:00'};
  const expiresAt='2027-01-02T09:00:00Z';
  let mode:'smtp'|'disabled'='smtp',revision=1,reads=0;
  const receipts:unknown[][]=[];
  const client={query:async(sql:string,args:unknown[] = [])=>{
    if(sql.includes('enrollment_mail_configuration')){
      reads++;
      return {rows:[{revision,config:{accounts:[],delivery:{mode,generation:'fixture-generation'}}}]};
    }
    if(sql.includes('FROM enrollment_orders'))return {rows:[{email:learner,data:{name:'Fixture'},class_data:quote,deadline:expiresAt}]};
    if(sql.includes('INSERT INTO enrollment_notification_receipts')){receipts.push(args);return {rows:[]};}
    if(sql.includes('FROM enrollment_notification_receipts'))return {rows:[{state:receipts.at(-1)?.[5]}]};
    assert.fail('Unexpected query: '+sql);
  }};
  await orderNotice(client,'seat_reserved','fixture-order');
  assert.equal(reads,1);
  assert.equal(receipts[0][5],'queued');
  assert.deepEqual((receipts[0][4] as {delivery:unknown}).delivery,
    {mode:'smtp',generation:'fixture-generation',recipientPolicy:smtpRecipientPolicy});

  assert.deepEqual(await sendAssistanceMail(client,{
    id:'fixture-assistance',email:learner,data:{name:'Fixture',lang:'en',quote},expiresAt,
  },'fixture-attempt'),{state:'queued'});
  assert.equal(reads,2);
  assert.deepEqual((receipts[1][4] as {delivery:unknown}).delivery,(receipts[0][4] as {delivery:unknown}).delivery);

  mode='disabled';
  await proofNotices(client,'fixture-order','fixture-class','fixture-proof','HSK 1');
  assert.equal(reads,3);
  assert.deepEqual(receipts.slice(-2).map(row=>[row[1],row[5]]),[['email','simulated'],['lark','simulated']]);
  assert.equal(Object.hasOwn(receipts[2][4] as object,'delivery'),false);

  mode='smtp';
  revision=0;
  await orderNotice(client,'seat_reserved','unconfigured-fixture-order');
  assert.equal(reads,4);
  assert.equal(receipts.at(-1)?.[5],'simulated');
});

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
      const contactLink=email.text.split('\n\n').at(-1)!.split(' ').at(-1)!;
      const contact=new URL(contactLink);
      assert.equal(contact.pathname,enrollmentEmailWhatsAppPath);
      const supportMessage=contact.searchParams.get('text')!;
      assert.ok(supportMessage.includes('UPER'));
      assert.ok(email.html.includes(contactLink));
      assert.doesNotMatch(supportMessage,/123456|Santi/);
      const otp=kind==='otp_apply'||kind==='otp_mine';
      const index=['zh','en','id'].indexOf(language);
      const hasSchedule=!otp&&!['payment_confirmed','refund_accepted','refund_recorded'].includes(kind);
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
      assert.equal(email.text.includes('Sat & Sun'),hasSchedule);
      assert.equal(email.text.split('Best regards,')[0].split('Salam hormat,')[0].split('谢谢！')[0].includes('WIB'),hasSchedule);
      assert.ok(email.text.includes(['谢谢！','Best regards,','Salam hormat,'][index]+'\n'));
      assert.ok(email.html.includes(['标准班','Standard class','Kelas standar'][index])===!otp);
    }
  }
});

test('enrollment email footer follows the current public origin and puts Chat third in HTML and text',()=>{
  for(const [environment,origin] of [
    ['dev','http://localhost:3000'],
    ['test','https://home.prototype.uperedu.com'],
    ['prod','https://uperedu.com'],
  ]){
    for(const language of ['zh','en','id']){
      const env={PORTAL_ENV:environment,PORTAL_PUBLIC_ORIGIN:origin};
      const email=renderEnrollmentEmail('seat_reserved',{language,url:'/enrollment/payment?order=qa'},env);
      const hrefs=[...email.html.matchAll(/href="([^"]+)"/g)].map(match=>new URL(match[1]));
      assert.ok(hrefs.every(link=>link.origin===origin));
      assert.deepEqual(hrefs.map(link=>link.pathname),[
        '/enrollment/payment','/','/enrollment','/chat',enrollmentEmailWhatsAppPath,
      ]);
      assert.ok(hrefs.slice(1,4).every(link=>link.searchParams.get('lang')===language));
      const foot=email.text.split('\n\n').slice(-4).map(line=>new URL(line.split(' ').at(-1)!));
      assert.deepEqual(foot.map(String),hrefs.slice(1).map(String));
      const target=new URL(enrollmentEmailWhatsAppDestination(foot[3].searchParams.get('text')));
      assert.equal(target.origin,'https://wa.me');
      assert.equal(target.pathname,'/6281116612062');
      assert.equal(target.searchParams.get('text'),foot[3].searchParams.get('text'));
    }
  }
  const misconfigured=renderEnrollmentEmail('otp_apply',{language:'zh',code:'123456'},{PORTAL_ENV:'test'});
  assert.doesNotMatch(misconfigured.html,/href=|localhost|uperedu\.com/);
});

test('payment confirmation leaves class arrangements to staff and has no separate opening email',()=>{
  assert.ok(!('payment_and_opening' in enrollmentEmailSubjects));
  assert.ok(!('class_confirmed' in enrollmentEmailSubjects));
  for(const language of ['zh','en','id']){
    const email=renderEnrollmentEmail('payment_confirmed',{language,class:'HSK 1',received:575000,
      firstLesson:'2026-12-19T15:00',schedule:'QA planned schedule'});
    assert.match(email.text,/575[.,]000/);
    assert.doesNotMatch(email.text,/QA planned schedule|WIB/);
    assert.match(email.text,/会在首课前联系|will contact you before your first session|akan menghubungi Anda sebelum pertemuan pertama/);
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
  assert.match(email.text,/New first session[^\n]*15:00[^\n]*WIB/);
  assert.match(email.text,/New class weekly schedule · Mon and Wed/);
  assert.match(email.text,/Reply deadline[^\n]*17:00[^\n]*WIB/);
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

test('assisted enrollment confirmation emails use the same link supplied by the CRM server',()=>{
  const id='87654321-aaaa-4bbb-8ccc-123456789abc';
  for(const [environment,publicOrigin] of [['dev','http://localhost:3000'],['test','https://home.example.invalid'],['prod','https://www.example.invalid']]){
    const env={PORTAL_ENV:environment,PORTAL_PUBLIC_ORIGIN:publicOrigin};
    for(const language of ['zh','en','id']){
      const link=enrollmentAssistanceLink(id,language,env);
      assert.equal(link,publicOrigin+'/enrollment/assist?lang='+language+'#a='+id);
      const email=renderEnrollmentEmail('assistance_confirmation',{language,assistanceId:id},env);
      assert.ok(email.html.includes('href="'+link+'"'));
      assert.ok(email.text.includes(link!));
    }
  }
  const invalidTest={PORTAL_ENV:'test',PORTAL_PUBLIC_ORIGIN:'http://localhost:3000'};
  assert.equal(enrollmentAssistanceLink(id,'en',invalidTest),undefined);
  const email=renderEnrollmentEmail('assistance_confirmation',{language:'en',assistanceId:id},invalidTest);
  assert.doesNotMatch(email.html,/localhost|#a=/);
});

test('assistance mail retries only the latest failed attempt and creates one simulated queue record',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {retryAssistanceMail}=await import('../server/portal/enrollmentNotices');
  const offer={id:'fixture-assistance',email:'learner@example.invalid',expiresAt:'2027-01-03T00:00:00Z',
    data:{name:'Fixture',lang:'en',quote:{level:'HSK 1'}}};
  const initial={id:'attempt-a',state:'failed'};
  let latest:{id:string;state:string}|undefined;
  let queued=0;
  const client={query:async(sql:string,args:unknown[] = [])=>{
    if(sql.includes('FROM enrollment_notification_receipts'))return {rows:latest?[latest]:[]};
    if(sql.includes('enrollment_mail_configuration'))return {rows:[{revision:1,config:{
      accounts:[],delivery:{mode:'smtp',generation:'fixture-generation'},
    }}]};
    if(sql.includes('INSERT INTO enrollment_notification_receipts')){
      assert.equal(args[5],'queued');
      queued++;
      latest={id:String(args[0]),state:'queued'};
      return {rows:[]};
    }
    assert.fail('Unexpected query: '+sql);
  }};
  for(const state of ['accepted','queued','unknown','simulated','cancelled']){
    latest={...initial,state};
    assert.equal(await retryAssistanceMail(client,offer,initial.id),latest);
  }
  latest=undefined;
  assert.equal(await retryAssistanceMail(client,offer,null),undefined);
  latest=initial;
  assert.equal(await retryAssistanceMail(client,offer,'old-attempt'),initial);
  assert.equal(queued,0);
  const retry=await retryAssistanceMail(client,offer,initial.id);
  assert.equal(retry?.state,'queued');
  assert.notEqual(retry?.id,initial.id);
  assert.deepEqual(await retryAssistanceMail(client,offer,initial.id),retry);
  assert.equal(queued,1);
});

test('email times and schedules use WIB and 24-hour times in each language',()=>{
  for(const language of ['zh','en','id']){
    const email=renderEnrollmentEmail('seat_reserved',{language,firstLesson:'2026-12-19T15:00',
      weeklySchedule:{days:[6,7],start:'15:00',lessons:2},minutes:45,
      schedule:'原始中文课表',deadline:'2026-12-18T17:00:00Z'});
    assert.match(email.text,/15:00–16:30 WIB/);
    assert.doesNotMatch(email.text,/AM|PM|原始中文课表/);
    assert.match(email.text,/00[:.]00 WIB/);
    assert.equal(email.subject.split('UPER').length-1,1);
  }
});

test('transfer invitation collapses identical schedules and retains distinct schedules',()=>{
  const facts={language:'en',class:'HSK 1',targetClass:'HSK 1',firstLesson:'2026-12-19T15:00',
    targetFirstLesson:'2026-12-26T15:00',minutes:45,targetMinutes:45,
    weeklySchedule:{days:[6,7],start:'15:00',lessons:1},
    targetWeeklySchedule:{days:[7,6],start:'15:00',lessons:1}};
  const same=renderEnrollmentEmail('transfer_invitation',facts);
  assert.equal(same.text.split('15:00–15:45 WIB').length-1,1);
  assert.match(same.text,/Original first session/);
  const different=renderEnrollmentEmail('transfer_invitation',{...facts,
    targetWeeklySchedule:{days:[1,3],start:'18:00',lessons:2}});
  assert.match(different.text,/Original weekly schedule/);
  assert.match(different.text,/18:00–19:30 WIB/);
});

test('refund assessment and dispatch are explicit and keep zero-refund emails free of payout promises',()=>{
  for(const language of ['zh','en','id']){
    const facts={language,expected:200000,installment:50000,refunded:150000,sendBy:'2026-12-15T10:00:00Z',
      schedule:'SCHEDULE NOT NEEDED',firstLesson:'2026-12-19T15:00'};
    const accepted=renderEnrollmentEmail('refund_accepted',facts);
    const zero=renderEnrollmentEmail('refund_accepted',{...facts,expected:0});
    const sent=renderEnrollmentEmail('refund_recorded',facts);
    assert.doesNotMatch(accepted.text,/SCHEDULE NOT NEEDED/);
    assert.doesNotMatch(sent.text,/SCHEDULE NOT NEEDED/);
    assert.match(sent.text,/50[.,]000/);
    assert.match(sent.text,/150[.,]000/);
    assert.doesNotMatch(zero.text,/17[:.]00 WIB/);
    assert.doesNotMatch(zero.subject,/Refund approved|disetujui|退款已获批/);
  }
});

test('demand match includes tuition when supplied and avoids empty labels for legacy payloads',()=>{
  const details=renderEnrollmentEmail('demand_match',{language:'en',price:2277000});
  assert.match(details.text,/Current tuition · Rp 2,277,000/);
  assert.match(details.text,/latest price and availability/);
  assert.doesNotMatch(renderEnrollmentEmail('demand_match',{language:'en'}).text,/Current tuition/);
});

test('cancelled class instructions follow the existing payment state',()=>{
  for(const language of ['zh','en','id']){
    const paid=renderEnrollmentEmail('class_cancelled',{language,orderState:'paid'}).text;
    const pending=renderEnrollmentEmail('class_cancelled',{language,orderState:'proof_review'}).text;
    const partial=renderEnrollmentEmail('class_cancelled',{language,orderState:'partial'}).text;
    const unpaid=renderEnrollmentEmail('class_cancelled',{language,orderState:'awaiting_payment'}).text;
    assert.match(paid,/可转班次|class transfer options|opsi pindah kelas/);
    assert.match(pending,/继续核对|continue reviewing|tetap memeriksa/);
    assert.equal(partial,pending);
    assert.match(unpaid,/请勿再转账|Please do not transfer|Jangan transfer/);
  }
});

test('legacy free-text schedules retain their original content',()=>{
  const email=renderEnrollmentEmail('seat_reserved',{language:'en',schedule:'Original staff-entered schedule'});
  assert.match(email.text,/Original staff-entered schedule/);
  const otp=renderEnrollmentEmail('otp_apply',{language:'en',codeMinutes:1});
  assert.match(otp.text,/expires in 1 minute\./);
});
