import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {enrollmentServicePolicy} from '../server/portal/enrollmentRuntime.ts';
import {hasConfiguredEnrollmentBank} from '../server/portal/enrollmentBank.ts';
import {enrollmentVisitorDigest} from '../server/portal/enrollmentVisitorSession.ts';
import type {Express, Request, Response} from 'express';
import {readEnrollmentAftercare} from '../src/utils/enrollmentAftercare';
import {hasEnrollmentBankPlaceholder,parseEnrollmentBank} from '../src/utils/enrollmentBank';

test('aftercare distinguishes unavailable details from empty lists and historical optional fields',()=>{
  const course={firstLesson:'2027-01-04T19:00'};
  const valid={originalClassState:'cancelled',currentClass:course,
    transfers:[],invitations:[],transferHistory:[],refund:{mode:'unavailable'},refundProgress:null};
  assert.deepEqual(readEnrollmentAftercare(valid),valid);
  for(const details of [
    {...valid,transferHistory:[null]},
    {...valid,transfers:[{id:'class-1',firstLesson:123}]},
    {...valid,invitations:[{...course,id:'offer-1',state:'offered'}]},
    {...valid,refundProgress:{expected:90000,refunded:0,sendBy:'invalid-date'}},
  ]) assert.equal(readEnrollmentAftercare(details),undefined);
});

test('assisted enrollment preview only includes private details for the verified recipient',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {enrollmentAssistancePreview}=await import('../server/portal/enrollmentApplication.ts');
  const ownEmail='learner@example.invalid', otherEmail='other@example.invalid';
  const token='a'.repeat(64), owner='b'.repeat(64), other='c'.repeat(64);
  const cookies=(visitor:string)=>`uper_visitor=${visitor}; uper_enrollment_session=v2.${token}`;
  const sessions=new Map([[enrollmentVisitorDigest(token,owner),ownEmail],[enrollmentVisitorDigest(token,other),otherEmail]]);
  const c={query:async(sql:string,params?:unknown[])=>{
    assert.match(sql,/FROM enrollment_email_sessions/);
    const email=sessions.get(String(params?.[0]));
    return {rows:email?[{email}]:[]};
  }};
  const offer={class_id:'fixture-class',email:ownEmail,active:1,order_id:'fixture-order',data:{quote:{price:1000},name:'Fixture',phone:'+6281234567890'}};
  const preview={classId:offer.class_id,quote:offer.data.quote};
  const publicPreview={...preview,maskedEmail:'l•••@example.invalid'};
  assert.deepEqual(await enrollmentAssistancePreview(c,offer,'if-verified',undefined),publicPreview);
  assert.deepEqual(await enrollmentAssistancePreview(c,offer,'if-verified',cookies(other)),publicPreview);
  assert.deepEqual(await enrollmentAssistancePreview(c,offer,'if-verified',cookies(owner),otherEmail),publicPreview);
  assert.deepEqual(await enrollmentAssistancePreview(c,offer,false,cookies(owner)),publicPreview);
  assert.deepEqual(await enrollmentAssistancePreview(c,offer,'if-verified',cookies(owner)),
    {...preview,name:offer.data.name,phone:offer.data.phone,email:ownEmail,orderId:offer.order_id});
  await assert.rejects(enrollmentAssistancePreview(c,offer,true,undefined),/enrollment_verification_required/);
  await assert.rejects(enrollmentAssistancePreview(c,offer,true,cookies(other)),/enrollment_assistance_email/);
  await assert.rejects(enrollmentAssistancePreview(c,{...offer,active:0},'if-verified',undefined),
    {status:404,message:'enrollment_assistance_unavailable'});
  assert.deepEqual(await enrollmentAssistancePreview(c,{...offer,active:0},'if-verified',cookies(owner)),
    {...preview,name:offer.data.name,phone:offer.data.phone,email:ownEmail,orderId:offer.order_id});
});

test('assistance OTP uses the bound recipient and existing resend, expiry and verification rules',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');
  const {operationContext}=await import('../server/portal/operationContext.ts');
  const mailbox=await mkdtemp(join(tmpdir(),'uper-assistance-otp-'));
  const previous=process.env;
  try{
    const host='enrollment.example.invalid';
    process.env={...previous,PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',
      UPER_PORTAL_PUBLIC_ORIGIN:'https://'+host,PORTAL_ENROLLMENT_SIMULATION_DATABASE:'uper_trial_mock_fixture',
      PORTAL_ENROLLMENT_SIMULATION_MAILBOX:mailbox};
    type Handler=(request:Request,response:Response)=>Promise<unknown>;
    const routes=new Map<string,Handler>();
    const app={get:()=>{},post:(path:string,handler:Handler)=>routes.set(path,handler)} as unknown as Express;
    mountEnrollmentApplication(app,{wrap:fn=>fn,staff:async()=>assert.fail('Public route'),visitor:async()=>({id:'b'.repeat(64)})});
    const email='learner@example.invalid',applicationId='530c315b-2933-4217-9e36-f2b5ad8d0f7e';
    let offerActive=1,codeActive=1,blocked=0,challengeId='',digest='',attempts=0,used=false,sessionEmail='';
    const client={transactionIsolation:'READ COMMITTED',query:async(sql:string,args:unknown[]=[])=>{
      if(sql.includes('FROM enrollment_assisted_applications')){
        assert.deepEqual(args,[null,applicationId]);
        return {rows:[{email,active:offerActive}]};
      }
      if(sql.includes('enrollment_mail_configuration'))return {rows:[{revision:0,config:{delivery:{mode:'simulation',generation:'fixture'}}}]};
      if(sql.includes('GET_LOCK'))assert.deepEqual(args,['enrollment-email:'+email]);
      else if(sql.includes('SELECT resend_at'))return {rows:[{blocked,locked:0}]};
      else if(sql.includes('SET challenge_id=')){assert.equal(args[2],email);[challengeId,digest]=[String(args[0]),String(args[1])];}
      else if(sql.includes('SELECT *,expires_at')){assert.deepEqual(args,[email]);return {rows:[{challenge_id:challengeId,digest,active:codeActive,attempts,used}]};}
      else if(sql.includes('SET attempts=')){assert.equal(args[1],email);attempts=Number(args[0]);}
      else if(sql.includes('SET used=TRUE')){assert.deepEqual(args,[email]);used=true;}
      else if(sql.includes('INSERT INTO enrollment_email_sessions'))sessionEmail=String(args[1]);
      else assert.ok(sql.includes('enrollment_rules')||sql.includes('INSERT INTO enrollment_email_challenges'),sql);
      return {rows:[]};
    }};
    let result:unknown,cookieSet=false;
    const response={set:()=>response,json:(data:unknown)=>{result=data;},cookie:()=>{cookieSet=true;}} as unknown as Response;
    const post=(action:'request'|'verify',body:object={})=>operationContext.run(client,()=>routes.get('/api/enrollment/assistance/email/'+action)!({
      body:{applicationId,email:'different@example.invalid',...body},headers:{origin:'https://'+host},
      protocol:'https',get:(name:string)=>name==='host'?host:undefined,is:()=>true,
    } as unknown as Request,response));
    await post('request',{language:'zh'});
    assert.deepEqual(result,{challengeId});
    const letters=await readdir(mailbox);
    assert.deepEqual(letters,[challengeId+'.json']);
    const message=JSON.parse(await readFile(join(mailbox,letters[0]),'utf8'));
    assert.equal(message.email,email);
    blocked=1;
    await assert.rejects(post('request'),{status:429});
    assert.deepEqual(await readdir(mailbox),letters);
    const wrong=message.code==='000000'?'111111':'000000';
    await assert.rejects(post('verify',{challengeId,code:wrong}),{status:401,message:'enrollment_invalid_code'});
    assert.equal(attempts,1);
    codeActive=0;
    await assert.rejects(post('verify',{challengeId,code:message.code}),{status:401,message:'enrollment_invalid_code'});
    codeActive=1;
    offerActive=0;
    await assert.rejects(post('request'),{status:404});
    await assert.rejects(post('verify',{challengeId,code:message.code}),{status:404});
    assert.equal(cookieSet,false);
    offerActive=1;
    await post('verify',{challengeId,code:message.code});
    assert.deepEqual(result,{verified:true});
    assert.equal(sessionEmail,email);
    assert.equal(cookieSet,true);
    await assert.rejects(post('verify',{challengeId,code:message.code}),{status:401});
  }finally{
    process.env=previous;
    await rm(mailbox,{recursive:true,force:true});
  }
});

test('only approved deployments can opt in to enrollment servicing',()=>{
  const prod={PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production'};
  const enabled={PORTAL_ENROLLMENT_SERVICE_ENABLED:'true'};
  assert.deepEqual(enrollmentServicePolicy(prod),{simulation:false,servicing:false,maintenance:false});
  assert.deepEqual(enrollmentServicePolicy({...prod,...enabled}),{simulation:false,servicing:true,maintenance:true});
  assert.equal(enrollmentServicePolicy({...prod,...enabled,PORTAL_DEPLOYMENT:'remote-dev'}).servicing,false);
  assert.equal(enrollmentServicePolicy({PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',...enabled}).servicing,true);
});

test('existing order pages can read just the mounted service policy without storage', async () => {
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentApplication} = await import('../server/portal/enrollmentApplication.ts');
  const previous = process.env;
  try {
    for (const servicing of [true, false]) {
      process.env = {...previous, PORTAL_ENV:'test', PORTAL_DEPLOYMENT:'company-trial',
        PORTAL_ENROLLMENT_SERVICE_ENABLED:String(servicing)};
      const routes = new Map<string, (request:Request,response:Response)=>Promise<unknown>>();
      const app = { get: (path:string, handler:(request:Request,response:Response)=>Promise<unknown>) => routes.set(path, handler),
        post: () => {} } as unknown as Express;
      const unexpected = async () => { throw Error('This public check must not access a staff or visitor identity'); };
      mountEnrollmentApplication(app, {wrap: fn => fn, staff: unexpected, visitor: unexpected});
      const read = routes.get('/api/enrollment/availability');
      assert.ok(read);
      let result:unknown;
      const response = {set(header:string,value:string){assert.equal(header,'Cache-Control');assert.equal(value,'no-store');return this;},
        json(data:unknown){result=data;}} as unknown as Response;
      await read({query:{scope:'servicing'}} as unknown as Request,response);
      assert.deepEqual(result,{accepting:false,servicing,reasons:servicing?[]:['service_disabled']});
      if(!servicing){
        // The fixture has no reachable database. Full intake status should still be definitive.
        await read({query:{}} as unknown as Request,response);
        assert.deepEqual(result,{accepting:false,servicing:false,reasons:['service_disabled']});
      }
    }
  } finally {
    process.env = previous;
  }
});

test('anonymous enrollment reads keep their response contract without entering a database transaction',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');
  const {operationContext}=await import('../server/portal/operationContext.ts');
  const previous=process.env;
  try{
    process.env={...previous,PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',
      UPER_PORTAL_PUBLIC_ORIGIN:'https://enrollment.example.invalid'};
    type Handler=(request:Request,response:Response)=>Promise<unknown>;
    const routes=new Map<string,Handler>();
    const app={get:(path:string,handler:Handler)=>routes.set('GET '+path,handler),
      post:(path:string,handler:Handler)=>routes.set('POST '+path,handler)} as unknown as Express;
    const unexpected=async()=>assert.fail('Anonymous enrollment reads must not query storage or resolve another identity');
    mountEnrollmentApplication(app,{wrap:fn=>fn,staff:unexpected,visitor:unexpected});
    const host='enrollment.example.invalid';
    const request=(cookie:string|undefined,body:object={})=>({body,headers:{cookie,origin:'https://'+host},
      protocol:'https',get:(name:string)=>name==='host'?host:undefined,is:()=>true}) as unknown as Request;
    let result:unknown;
    const response={set:()=>response,json:(data:unknown)=>{result=data;}} as unknown as Response;
    const session=routes.get('POST /api/enrollment/email/session')!;
    await operationContext.run({query:unexpected},async()=>{
      // The incompatible isolation level also rejects any attempted transaction before SQL can run.
      for(const cookie of [undefined,'uper_enrollment_session=invalid','uper_enrollment_session=v2.'+'a'.repeat(64)]){
        await session(request(cookie),response);
        assert.deepEqual(result,{verifiedEmail:null});
        await session(request(cookie,{email:'learner@example.invalid'}),response);
        assert.deepEqual(result,{verified:false});
        for(const path of ['/orders','/orders/:id','/interests']){
          await assert.rejects(routes.get('GET /api/enrollment'+path)!(request(cookie),response),
            {status:401,message:'enrollment_verification_required'});
        }
      }
    });
    const token='a'.repeat(64),visitor='b'.repeat(64),email='learner@example.invalid';
    const cookie='uper_enrollment_session=v2.'+token+'; uper_visitor='+visitor;
    await operationContext.run({transactionIsolation:'READ COMMITTED',query:async(sql:string,params:unknown[])=>{
      assert.match(sql,/enrollment_email_sessions WHERE digest=:p1 AND expires_at>UTC_TIMESTAMP.*FOR SHARE/);
      assert.deepEqual(params,[enrollmentVisitorDigest(token,visitor)]);
      return {rows:[{email}]};
    }},async()=>{
      await session(request(cookie),response);
      assert.deepEqual(result,{verifiedEmail:email});
      await session(request(cookie,{email:'other@example.invalid'}),response);
      assert.deepEqual(result,{verified:false});
      await assert.rejects(session(request(undefined,{email:'invalid'}),response),{status:400});
    });
  }finally{process.env=previous;}
});

const local={PORTAL_ENV:'dev',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',
  MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock'};

test('normal local startup serves existing orders without enabling mail simulation or automatic maintenance',()=>{
  assert.deepEqual(enrollmentServicePolicy(local),{simulation:false,servicing:true,maintenance:false});
  assert.equal(enrollmentServicePolicy({...local,PORTAL_DEPLOYMENT:'remote-dev'}).servicing,false);
  assert.equal(enrollmentServicePolicy({...local,MYSQL_TRIAL_SOCKET:'/tmp/other.sock'}).servicing,false);
});

test('local mail simulation is independent of the CRM worker',()=>{
  const simulation={...local,PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/tmp/test-mailbox'};
  assert.deepEqual(enrollmentServicePolicy(simulation,'simulation'),{simulation:true,servicing:true,maintenance:false});
  assert.deepEqual(enrollmentServicePolicy({...simulation,PORTAL_ENROLLMENT_SERVICE_ENABLED:'true'},'simulation'),
    {simulation:true,servicing:true,maintenance:true});
  for(const transport of ['smtp','disabled'] as const){
    assert.deepEqual(enrollmentServicePolicy(simulation,transport),
      {simulation:false,servicing:true,maintenance:false});
  }
});

test('the company mailbox is opt-in and tied to the isolated test database',()=>{
  const testEnv={PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',TRIAL_DATASET:'synthetic',
    PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/private/simulated-mail',
    PORTAL_ENROLLMENT_SIMULATION_DATABASE:'uper_trial_enrollment_review',
    MYSQL_TRIAL_URL:'mysql://fixture:fixture@mysql/uper_trial_enrollment_review'};
  assert.deepEqual(enrollmentServicePolicy(testEnv,'simulation'),{simulation:true,servicing:true,maintenance:false});
  assert.deepEqual(enrollmentServicePolicy(testEnv,'disabled'),{simulation:false,servicing:true,maintenance:false});
  for(const override of [{PORTAL_ENV:'prod'},{PORTAL_DEPLOYMENT:'remote-dev'},
    {TRIAL_DATASET:'local-crm'},
    {PORTAL_ENROLLMENT_SIMULATION_DATABASE:''},{MYSQL_TRIAL_URL:'mysql://mysql/uper_trial_other'},
    {PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'relative'}]){
    assert.equal(enrollmentServicePolicy({...testEnv,...override},'simulation').simulation,false);
  }
});

test('production cannot use the private simulation mailbox',()=>{
  const production={PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production',PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/private/simulated-mail'};
  assert.deepEqual(enrollmentServicePolicy(production,'simulation'),{simulation:false,servicing:true,maintenance:true});
});

test('Windows local development permits enrollment simulation only with approved loopback local CRM settings',()=>{
  const winLocal={
    PORTAL_ENV:'dev',APP_ENV:'local',PORTAL_DEPLOYMENT:'local-dev',
    TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',PORTAL_WORKER_ENABLED:'false',
    MYSQL_TRIAL_URL:'mysql://root:pass@127.0.0.1:3306/uper_local_crm',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/tmp/test-mailbox',
  };
  assert.deepEqual(enrollmentServicePolicy(winLocal,'simulation','win32'),{simulation:true,servicing:true,maintenance:false});
  const disabled={simulation:false,servicing:false,maintenance:false};
  assert.deepEqual(enrollmentServicePolicy(winLocal,'simulation','darwin'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,PORTAL_DEPLOYMENT:'remote-dev'},'simulation','win32'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,PORTAL_DEPLOYMENT:''},'simulation','win32'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,MYSQL_TRIAL_URL:'mysql://root:pass@10.0.0.5:3306/uper_local_crm'},'simulation','win32'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,MYSQL_TRIAL_URL:'mysql://root:pass@127.0.0.1:3306/other_db'},'simulation','win32'),disabled);
});

test('a saved but partially replaced test bank is still ineligible for live payments',()=>{
  const bank={name:'Bank',accountName:'UPER',accountNumber:'12345678'};
  assert.equal(hasConfiguredEnrollmentBank({bank,revision:0}),false);
  for(const field of [{name:'TEST BANK'},{accountName:'UPER TEST ONLY'},{accountNumber:'TEST-0000000000'}]){
    assert.equal(hasConfiguredEnrollmentBank({bank:{...bank,...field},revision:1}),false);
    assert.equal(hasEnrollmentBankPlaceholder({...bank,...field}),true);
  }
  assert.equal(hasConfiguredEnrollmentBank({bank,revision:1}),true);
  assert.equal(hasEnrollmentBankPlaceholder(bank),false);
  assert.deepEqual(parseEnrollmentBank({...bank,accountNumber:' 12345678 '}),bank);
  for(const accountNumber of [undefined,12345678,{},'','123\n456','1'.repeat(65)]) {
    assert.equal(parseEnrollmentBank({...bank,accountNumber}),null);
  }
});

test('live intake requires bank and OTP readiness while serving existing orders',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {enrollmentReadiness}=await import('../server/portal/enrollmentApplication.ts');
  const bank={name:'Bank',accountName:'UPER',accountNumber:'12345678'};
  const client=(configured:boolean)=>({query:async(sql:string)=>{
    if(sql.includes('enrollment_mail_configuration'))return {rows:[]};
    assert.match(sql,/enrollment_bank/);
    return {rows:configured?[{value:{bank,revision:1}}]:[]};
  }});
  const servicing={servicing:true,simulation:false,maintenance:false};
  assert.deepEqual(await enrollmentReadiness(client(false),servicing),
    {accepting:false,servicing:true,reasons:['bank_required','mail_required']});
  assert.deepEqual(await enrollmentReadiness(client(true),servicing),
    {accepting:false,servicing:true,reasons:['mail_required']});
  assert.deepEqual(await enrollmentReadiness(client(false),{...servicing,simulation:true}),
    {accepting:true,servicing:true,reasons:[]});
  assert.deepEqual(await enrollmentReadiness(client(false),{...servicing,servicing:false}),
    {accepting:false,servicing:false,reasons:['service_disabled']});
});

test('readiness uses a single saved mail configuration per call',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {enrollmentReadiness}=await import('../server/portal/enrollmentApplication.ts');
  const runtime={PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production',PORTAL_ENROLLMENT_SERVICE_ENABLED:'true'};
  const previous=Object.fromEntries(Object.keys(runtime).map(key=>[key,process.env[key]]));
  Object.assign(process.env,runtime);
  try {
    let mailReads=0;
    const client={query:async(sql:string)=>{
      if(sql.includes('enrollment_mail_configuration')){
        mailReads++;
        return {rows:[{revision:0,config:{delivery:{mode:'smtp',generation:'fixture'}}}]};
      }
      assert.match(sql,/enrollment_bank/);
      return {rows:[]};
    }};
    assert.deepEqual(await enrollmentReadiness(client),
      {accepting:false,servicing:true,reasons:['bank_required','mail_required']});
    assert.equal(mailReads,1);
    assert.equal((await enrollmentReadiness(client)).accepting,false);
    assert.equal(mailReads,2);
  } finally {
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
  }
});

test('seat reservation checks and stores the same bank settings with one mail configuration read',async t=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');
  const {operationContext}=await import('../server/portal/operationContext.ts');
  const previous=process.env;
  const origin='http://localhost:3000';
  process.env={...previous,PORTAL_ENV:'dev',PORTAL_DEPLOYMENT:'',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',
    MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock',PORTAL_ENROLLMENT_SERVICE_ENABLED:'false',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/tmp/unused-enrollment-fixture-mailbox',PORTAL_PUBLIC_ORIGIN:origin,
    PORTAL_ENROLLMENT_SMTP_FIXTURE:'fixture-only',ACCESS_ALLOWED_ORIGINS:''};
  t.after(()=>{process.env=previous;});
  const classId='fixture-class',email='seat-learner@example.invalid';
  const host='localhost:3000';
  const bank={name:'Fixture Bank',accountName:'Fixture',accountNumber:'12345678'};
  const sender={address:'sender@example.invalid',enabled:true,host:'smtp.gmail.com',port:587,secure:false,secret:'PORTAL_ENROLLMENT_SMTP_FIXTURE'};
  const beforeInsert=Error('Fixture stops at the write boundary');
  let mode='smtp',hasBank=true,mailReads=0,bankReads=0,insertAttempts=0;
  const client={transactionIsolation:'READ COMMITTED',query:async(sql:string,args:unknown[])=>{
    if(sql.includes('enrollment_mail_configuration')){
      mailReads++;
      return {rows:[{revision:1,config:{delivery:{mode,generation:'fixture'},accounts:[sender],selectedPool:'fixture',
        pools:[{id:'fixture',name:'Fixture',enabled:true,members:[sender.address]}]}}]};
    }
    if(sql.includes('enrollment_bank')){
      bankReads++;
      return {rows:hasBank?[{value:{bank,revision:1}}]:[]};
    }
    if(sql.includes('enrollment_email_sessions'))return {rows:[{email}]};
    if(sql.includes('FROM enrollment_classes WHERE id=:p1 FOR UPDATE'))
      return {rows:[{id:classId,course_id:'fixture-course',state:'published',accepting:1,course_active:1,data:{price:1000000,capacity:15}}]};
    if(sql.includes('FROM crm_courses WHERE id=:p1 FOR SHARE'))return {rows:[{value:{active:true}}]};
    if(sql.startsWith('SELECT (SELECT COUNT(*)'))return {rows:[{count:0}]};
    if(sql.startsWith('INSERT INTO enrollment_orders')){
      insertAttempts++;
      assert.deepEqual((args[6] as {bank:unknown}).bank,bank);
      throw beforeInsert;
    }
    if(sql.includes('GET_LOCK')||sql.includes('FROM integration_credentials')||sql.includes('enrollment_rules')||
      sql.startsWith("UPDATE enrollment_orders SET state='expired'")||sql.startsWith('SELECT * FROM enrollment_orders'))
      return {rows:[]};
    assert.fail('Unexpected reservation query: '+sql);
  }};
  type Handler=(request:Request,response:Response)=>Promise<unknown>;
  const posts=new Map<string,Handler>();
  const unexpected=async()=>assert.fail('Public seat reservation should only check the verified enrollment session');
  await operationContext.run(client,async()=>{
    mountEnrollmentApplication({get:()=>{},post:(path:string,handler:Handler)=>posts.set(path,handler)} as unknown as Express,
      {wrap:handler=>handler,staff:unexpected,visitor:unexpected});
    await new Promise(resolve=>setImmediate(resolve));
    mailReads=0;
    const submit=()=>posts.get('/api/enrollment/applications')!({
      body:{classId,name:'Fixture Learner',phone:'081234567890',priority:false,requestId:'00000000-0000-4000-8000-000000000001'},
      headers:{origin,cookie:'uper_enrollment_session='+'a'.repeat(64)},protocol:'http',is:()=>true,
      get:(name:string)=>name==='host'?host:undefined,
    } as unknown as Request,{set(){return this;}} as unknown as Response);
    await assert.rejects(submit(),error=>error===beforeInsert);
    assert.deepEqual([mailReads,bankReads,insertAttempts],[1,1,1]);
    mode='simulation';
    await assert.rejects(submit(),error=>error===beforeInsert);
    assert.deepEqual([mailReads,bankReads,insertAttempts],[2,2,2]);
    mode='smtp';
    hasBank=false;
    await assert.rejects(submit(),{status:503,message:'enrollment_intake_bank_required'});
    assert.deepEqual([mailReads,bankReads,insertAttempts],[3,3,2]);
  });
});

test('finance order details keep each learner declaration with its own proof',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');
  const {operationContext}=await import('../server/portal/operationContext.ts');
  const previous=process.env;
  try{
    process.env={...previous,PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',PORTAL_ENROLLMENT_SERVICE_ENABLED:'true'};
    type Handler=(request:Request,response:Response)=>Promise<unknown>;
    const routes=new Map<string,Handler>();
    const app={get:(path:string,handler:Handler)=>routes.set(path,handler),post:()=>{}} as unknown as Express;
    let scope='all';
    mountEnrollmentApplication(app,{wrap:fn=>fn,staff:async(_request,permission)=>{
      assert.equal(permission,'crm.payments.verify');
      return {id:'fixture-finance',scope,permissions:['crm.read','crm.payments.verify']} as never;
    },visitor:async()=>assert.fail('Finance must not use a learner session')});
    const read=routes.get('/api/crm/enrollment/finance')!;
    const proofRows=[
      {id:'new-pdf',mime:'application/pdf',submittedAt:'2027-01-02T00:00:00.000000Z',transfer:{amount:120000,reference:'NEW-REF'}},
      {id:'old-image',mime:'image/png',submittedAt:'2027-01-01T00:00:00.000000Z',transfer:null},
    ];
    const order={id:'fixture-order',state:'proof_review',class_state:'published',data:{name:'Fixture'},
      price:200000,received:0,payment_due_at:'2027-01-03 00:00:00',proof_id:'new-pdf',proof_mime:'application/pdf'};
    const original={name:'Original Bank',accountName:'UPER Original',accountNumber:'12345678'};
    const current={name:'Current Bank',accountName:'UPER Current',accountNumber:'87654321'};
    let configured:unknown={bank:current,revision:1};
    let orderBank:unknown=original;
    const reads:string[]=[];
    const client={transactionIsolation:'READ COMMITTED',query:async(sql:string,args:unknown[])=>{
      reads.push(sql);
      if(sql.includes('SELECT o.*,e.state'))return {rows:[{...order,data:{...order.data,bank:orderBank}}]};
      if(sql.includes("id='enrollment_bank'"))return {rows:configured?[{value:configured}]:[]};
      if(sql.includes('transfer_details AS transfer')){
        assert.deepEqual(args,['fixture-order']);
        assert.match(sql,/ORDER BY created_at DESC,id DESC/);
        assert.doesNotMatch(sql,/SELECT proof[, ]/);
        return {rows:proofRows};
      }
      assert.match(sql,/FROM enrollment_(receipts|payment_credits)/);
      return {rows:[]};
    }};
    const request={query:{order:'fixture-order'}} as unknown as Request;
    let payload:any;
    const response={set:()=>response,json:(data:unknown)=>{payload=data;}} as unknown as Response;
    await operationContext.run(client,()=>read(request,response));
    assert.deepEqual(payload.orders[0].proofs,proofRows);
    assert.equal(payload.orders[0].received,0);
    assert.equal(reads.filter(sql=>sql.includes('transfer_details AS transfer')).length,1);
    assert.deepEqual(payload.orders[0].receivingAccounts,[
      {source:'current',bankName:current.name,accountName:current.accountName,accountSuffix:'4321',receiptAccount:'Current Bank · 87654321'},
      {source:'order',bankName:original.name,accountName:original.accountName,accountSuffix:'5678',receiptAccount:'Original Bank · 12345678'},
    ]);
    orderBank={...current,name:'CURRENT BANK',accountNumber:'8765-4321'};
    await operationContext.run(client,()=>read(request,response));
    assert.deepEqual(payload.orders[0].receivingAccounts.map((account:{source:string})=>account.source),['current']);
    configured=undefined;
    orderBank=original;
    await operationContext.run(client,()=>read(request,response));
    assert.deepEqual(payload.orders[0].receivingAccounts.map((account:{source:string})=>account.source),['order']);
    orderBank=undefined;
    await operationContext.run(client,()=>read(request,response));
    assert.deepEqual(payload.orders[0].receivingAccounts,[]);
    scope='own';
    const priorReads=reads.length;
    await assert.rejects(operationContext.run(client,()=>read(request,response)),{status:403});
    assert.equal(reads.length,priorReads);
  }finally{process.env=previous;}
});
