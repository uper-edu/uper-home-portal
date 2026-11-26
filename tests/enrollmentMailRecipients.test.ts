import assert from 'node:assert/strict';
import test from 'node:test';
import {smtpRecipientPolicy} from '../server/portal/enrollmentMailRecipientPolicy.ts';

test('local and test SMTP route a new email to the learner address and skip older queued mail',async t=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const [{dispatchEnrollmentMail},{operationContext},{mailAccountDefaults},{default:nodemailer},{orderNotice}]=await Promise.all([
    import('../server/portal/enrollmentMail.ts'),import('../server/portal/operationContext.ts'),
    import('../src/utils/enrollmentMailConfig.ts'),import('nodemailer'),import('../server/portal/enrollmentNotices.ts'),
  ]);
  const learner='learner+enrollment@example.invalid';
  const sent:string[]=[];
  t.mock.method(nodemailer,'createTransport',()=>({
    sendMail:async ({to}:{to:string})=>{sent.push(to);return {accepted:[to]};},
  }));
  const delivery={mode:'smtp',generation:'current'};
  const sender={...mailAccountDefaults,address:'fixture-sender@example.invalid',host:'smtp.gmail.com',port:587,secret:'PORTAL_ENROLLMENT_SMTP_TEST_GMAIL'};
  const config={delivery,accounts:[sender],sticky:false,selectedPool:'fixture',pools:[
    {id:'fixture',name:'Fixture',enabled:true,members:[sender.address],transport:'smtp',dailyLimit:null,dailyRecipientLimit:null,strategy:'balanced'},
  ]};
  const mail={subject:'Fixture',text:'Fixture',html:'<p>Fixture</p>',language:'en'};
  for(const environment of ['dev','test']){
    const env={PORTAL_ENV:environment,PORTAL_PUBLIC_ORIGIN:'https://example.invalid',PORTAL_ENROLLMENT_MAIL_TRANSPORT:'smtp',
      TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',PORTAL_DEPLOYMENT:environment==='test'?'company-trial':'',
      MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock',PORTAL_ENROLLMENT_SMTP_TEST_GMAIL:'fixture-only'};
    const original=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
    Object.assign(process.env,env);
    try{
      let queuedPayload:unknown;
      const client={transactionIsolation:'READ COMMITTED',query:async(sql:string,args?:unknown[])=>{
        if(sql.includes('SELECT revision,config'))return {rows:[{revision:1,config}]};
        if(sql.includes('FROM enrollment_orders o JOIN'))return {rows:[{
          email:learner,data:{name:'Learner'},state:'paid',class_data:{level:'HSK 1',format:'standard',period:'weekend'},
        }]};
        if(sql.startsWith('INSERT INTO enrollment_notification_receipts')){
          assert.equal(args?.[5],'queued');
          queuedPayload=args?.[4];
        }
        if(sql.includes('SELECT kind,subject_id,payload'))return {rows:[{
          kind:'payment_confirmed',payload:args?.[0]==='old'?{delivery}:queuedPayload,
        }]};
        if(sql.includes('AS now_ms'))return {rows:[{now_ms:Date.now()}]};
        if(sql.startsWith('SELECT COUNT(*) AS total'))return {rows:[{total:0}]};
        return {rows:[]};
      }};
      const result=await operationContext.run(client,async()=>{
        await orderNotice(client,'payment_confirmed','order-fixture');
        const payload=queuedPayload as {smtpRecipientPolicy?:string;delivery?:{recipientPolicy?:string}};
        assert.equal(payload.delivery?.recipientPolicy,smtpRecipientPolicy);
        assert.equal(payload.smtpRecipientPolicy,undefined);
        assert.equal((await dispatchEnrollmentMail('old',learner,mail,{queueKey:'old'})).state,'waiting');
        assert.deepEqual(await dispatchEnrollmentMail('invalid','a@example.invalid,b@example.invalid',mail),
          {state:'rejected',reason:'invalid_recipient'});
        return dispatchEnrollmentMail('new',learner,mail,{queueKey:'new'});
      });
      assert.equal(result.state,'accepted');
    } finally {
      for(const [key,value] of Object.entries(original)) {
        if(value===undefined)delete process.env[key];
        else process.env[key]=value;
      }
    }
  }
  assert.deepEqual(sent,[learner,learner]);
});
