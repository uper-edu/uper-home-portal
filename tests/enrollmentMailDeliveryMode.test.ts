import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesEnrollmentMailDelivery,type EnrollmentMailDelivery} from '../src/utils/enrollmentMailMode.ts';

test('queued mail can only use the delivery generation and mode recorded when queued',()=>{
  const smtp:EnrollmentMailDelivery={mode:'smtp',generation:'new'};
  assert.equal(matchesEnrollmentMailDelivery(undefined,smtp),false);
  assert.equal(matchesEnrollmentMailDelivery({mode:'simulation',generation:'new'},smtp),false);
  assert.equal(matchesEnrollmentMailDelivery({mode:'smtp',generation:'previous'},smtp),false);
  assert.equal(matchesEnrollmentMailDelivery(smtp,smtp),true);
});

test('migration and CRM mode changes apply immediately and cannot replay old queues',async t=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const [{dispatchEnrollmentMail,enrollmentMailDelivery,enrollmentMailReadiness,initializeEnrollmentMailDelivery,mountEnrollmentMail},
    {operationContext},{mailAccountDefaults},{smtpRecipientPolicy},{default:nodemailer},fs,os,path]=await Promise.all([
    import('../server/portal/enrollmentMail.ts'),import('../server/portal/operationContext.ts'),
    import('../src/utils/enrollmentMailConfig.ts'),import('../server/portal/enrollmentMailRecipientPolicy.ts'),
    import('nodemailer'),import('node:fs/promises'),import('node:os'),import('node:path'),
  ]);
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'uper-mail-mode-'));
  const env={PORTAL_ENV:'dev',PORTAL_DEPLOYMENT:'',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',
    MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock',PORTAL_PUBLIC_ORIGIN:'http://localhost:3000',
    UPER_PORTAL_ENROLLMENT_MAIL_TRANSPORT:'smtp',PORTAL_ENROLLMENT_MAIL_TRANSPORT:'disabled',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:directory,PORTAL_WORKER_ENABLED:'true',
    PORTAL_ENROLLMENT_SMTP_TEST_GMAIL:'fixture-only',ACCESS_ALLOWED_ORIGINS:''};
  const original=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
  Object.assign(process.env,env);
  t.after(async()=>{
    for(const [key,value] of Object.entries(original)){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
    await fs.rm(directory,{recursive:true,force:true});
  });

  const sender={...mailAccountDefaults,address:'fixture-sender@example.invalid',host:'smtp.gmail.com',port:587,secret:'PORTAL_ENROLLMENT_SMTP_TEST_GMAIL'};
  const legacy={accounts:[sender],sticky:false,selectedPool:'fixture',pools:[
    {id:'fixture',name:'Fixture',enabled:true,members:[sender.address],transport:'smtp',dailyLimit:null,dailyRecipientLimit:null,strategy:'balanced'},
  ]};
  let config:{delivery?:EnrollmentMailDelivery} & typeof legacy=structuredClone(legacy);
  let revision=3,migrationWrites=0,credentialReads=0;
  let configurationReads=0;
  const audit:unknown[]=[];
  const queuedRows=new Map<string,{delivery?:EnrollmentMailDelivery & {recipientPolicy?:string};smtpRecipientPolicy?:string}>([['legacy',{smtpRecipientPolicy}]]);
  const client={transactionIsolation:'READ COMMITTED',query:async(sql:string,args?:unknown[])=>{
    if(sql.includes('FROM integration_credentials'))credentialReads++;
    if(sql.startsWith('SELECT revision,config')){
      configurationReads++;
      return {rows:[{revision,config:structuredClone(config)}]};
    }
    if(sql.includes(' AS blocked,locked_until'))return {rows:[{blocked:0,locked:0}]};
    if(sql.startsWith('UPDATE enrollment_mail_configuration')){
      if(sql.includes('revision=revision+1'))revision++;
      else migrationWrites++;
      config=structuredClone(args?.[1] as typeof config);
    }
    if(sql.startsWith('INSERT INTO portal_audit'))audit.push(args?.[1]);
    if(sql.startsWith('SELECT kind,subject_id,payload')){
      const payload=queuedRows.get(String(args?.[0]));
      return {rows:payload?[{kind:'payment_confirmed',payload}]:[]};
    }
    if(sql.includes('AS now_ms'))return {rows:[{now_ms:Date.now()}]};
    if(sql.startsWith('SELECT COUNT(*) AS total'))return {rows:[{total:0}]};
    return {rows:[]};
  }};
  const sent:string[]=[];
  t.mock.method(nodemailer,'createTransport',()=>({
    sendMail:async ({to}:{to:string})=>{sent.push(to);return {accepted:[to]};},
  }));
  const modePath='/api/crm/enrollment/mail';
  const handlers=new Map<string,Function>();
  const routes=Object.fromEntries(['get','put','post'].map(method=>[method,(url:string,handler:Function)=>handlers.set(method+' '+url,handler)]));
  const operations={id:'operations',roles:['crm_manager'],permissions:['crm.operations.manage']};
  const fullPermissions=['access.read','access.users','access.roles','access.sessions','access.audit'];
  const admin={id:'admin',roles:['access_admin'],permissions:[...operations.permissions,...fullPermissions]};
  mountEnrollmentMail(routes as any,{
    wrap:(handler)=>handler,
    staff:async(q,permission)=>{
      const actor=(q as any).actor as typeof admin;
      if(!actor.permissions.includes(permission))throw Object.assign(Error('forbidden'),{status:403});
      return actor;
    },
  });
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');
  const unexpectedIdentity=async()=>assert.fail('Sending a code does not use staff or visitor lookup');
  mountEnrollmentApplication(routes as any,{wrap:handler=>handler,staff:unexpectedIdentity,visitor:unexpectedIdentity});
  const call=(method:'get'|'put',actor=admin,body?:object)=>handlers.get(method+' '+modePath+(method==='put'?'/pool':''))!(
    {actor,body,headers:{origin:'http://localhost:3000'},protocol:'http',get:()=> 'localhost:3000',is:()=>true},
    {set(){return this;},json(value:unknown){return value;}},
  );
  const save=(mode:string)=>call('put',admin,{mode,revision,pool:'fixture',sticky:false});
  const learner='learner@example.invalid',mail={subject:'Fixture',text:'Fixture',html:'<p>Fixture</p>',language:'en'};
  const dispatch=(key:string)=>dispatchEnrollmentMail(key,learner,mail,{queueKey:key,deliveryId:key});
  await operationContext.run(client,async()=>{
    await initializeEnrollmentMailDelivery();
    const imported=await enrollmentMailDelivery();
    assert.equal(imported.mode,'smtp');
    assert.ok(imported.generation);
    assert.deepEqual(config,{...legacy,delivery:imported});
    assert.equal(revision,3);
    process.env.UPER_PORTAL_ENROLLMENT_MAIL_TRANSPORT='disabled';
    await initializeEnrollmentMailDelivery();
    assert.deepEqual(await enrollmentMailDelivery(),imported);
    assert.equal(migrationWrites,1);

    assert.equal((await call('get',operations)).canEditMode,false);
    assert.equal((await call('get',admin)).canEditMode,true);
    for(const actor of [operations,{...operations,permissions:[...operations.permissions,...fullPermissions]}]){
      await assert.rejects(()=>call('put',actor,{mode:'simulation',revision,pool:'fixture'}),{status:403});
    }
    await assert.rejects(()=>call('get',{...operations,permissions:[]}),{status:403});
    await assert.rejects(()=>save('invalid'),{status:400});
    await assert.rejects(()=>call('put',admin,{mode:'simulation',revision:revision-1,pool:'fixture'}),{status:409});
    assert.equal(audit.length,0);

    assert.equal((await save('simulation')).settings.mode,'simulation');
    assert.deepEqual((await call('get')).deliveryReasons,[]);
    const simulation=await enrollmentMailDelivery();
    queuedRows.set('simulated-now',{delivery:simulation});
    assert.equal((await dispatch('simulated-now')).state,'simulated');
    assert.equal(JSON.parse(await fs.readFile(path.join(directory,'simulated-now.json'),'utf8')).email,learner);
    assert.deepEqual(sent,[]);

    const previousRevision=revision;
    revision=0;
    const readsBeforeCode=configurationReads;
    let challengeId='';
    await handlers.get('post /api/enrollment/email/request')!(
      {body:{email:learner,language:'en',purpose:'apply'},headers:{origin:'http://localhost:3000'},protocol:'http',get:()=> 'localhost:3000',is:()=>true},
      {set(){return this;},json:(value:{challengeId:string})=>{challengeId=value.challengeId;}},
    );
    revision=previousRevision;
    assert.equal(configurationReads-readsBeforeCode,1);
    assert.ok(challengeId);
    const delivered=JSON.parse(await fs.readFile(path.join(directory,challengeId+'.json'),'utf8'));
    assert.equal(delivered.email,learner);
    assert.match(delivered.code,/^[0-9]{6}$/);
    assert.deepEqual(sent,[]);

    assert.equal((await save('disabled')).settings.mode,'disabled');
    assert.deepEqual((await call('get')).deliveryReasons,['delivery_disabled']);
    assert.equal((await dispatchEnrollmentMail('disabled',learner,mail)).state,'waiting');

    assert.equal((await save('smtp')).settings.mode,'smtp');
    assert.equal((await call('get')).mode,'smtp');
    assert.deepEqual((await call('get')).deliveryReasons,[]);
    const smtp=await enrollmentMailDelivery();
    process.env.PORTAL_WORKER_ENABLED='false';
    const readsBefore=credentialReads;
    assert.equal(await (await enrollmentMailReadiness(client)).smtpReady(),false);
    assert.equal(credentialReads,readsBefore);
    assert.deepEqual((await call('get')).deliveryReasons,['mail_worker_required']);
    assert.ok(credentialReads>readsBefore);
    process.env.PORTAL_WORKER_ENABLED='true';
    assert.equal(await (await enrollmentMailReadiness(client)).smtpReady(),true);
    assert.notEqual(smtp.generation,imported.generation);
    queuedRows.set('previous-smtp',{delivery:{...imported,recipientPolicy:smtpRecipientPolicy}});
    queuedRows.set('missing-policy',{delivery:smtp});
    for(const key of ['legacy','previous-smtp','simulated-now','missing-policy'])assert.equal((await dispatch(key)).state,'waiting',key);
    assert.deepEqual(sent,[]);
    queuedRows.set('smtp-now',{delivery:{...smtp,recipientPolicy:smtpRecipientPolicy}});
    assert.equal((await dispatch('smtp-now')).state,'accepted');
    assert.deepEqual(sent,[learner]);
    await call('put',operations,{revision,pool:'fixture',sticky:true});
    assert.deepEqual(await enrollmentMailDelivery(),smtp);
    await initializeEnrollmentMailDelivery();
    assert.deepEqual(await enrollmentMailDelivery(),smtp);
    assert.equal(migrationWrites,1);
    assert.equal(audit.length,4);

    for(const legacyMode of ['simulation','disabled'] as const){
      config=structuredClone(legacy);
      delete process.env.UPER_PORTAL_ENROLLMENT_MAIL_TRANSPORT;
      process.env.PORTAL_ENROLLMENT_MAIL_TRANSPORT=legacyMode;
      await initializeEnrollmentMailDelivery();
      assert.equal((await enrollmentMailDelivery()).mode,legacyMode);
    }
  });
});
