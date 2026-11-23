import assert from 'node:assert/strict';
import test from 'node:test';
import {enrollmentServicePolicy} from '../server/portal/enrollmentRuntime.ts';
import {hasConfiguredEnrollmentBank} from '../server/portal/enrollmentBank.ts';

test('only approved deployments can opt in to enrollment servicing',()=>{
  const prod={PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production'};
  const enabled={PORTAL_ENROLLMENT_SERVICE_ENABLED:'true'};
  assert.deepEqual(enrollmentServicePolicy(prod),{simulation:false,servicing:false,maintenance:false});
  assert.deepEqual(enrollmentServicePolicy({...prod,...enabled}),{simulation:false,servicing:true,maintenance:true});
  assert.equal(enrollmentServicePolicy({...prod,...enabled,PORTAL_DEPLOYMENT:'remote-dev'}).servicing,false);
  assert.equal(enrollmentServicePolicy({PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',...enabled}).servicing,true);
});

const local={PORTAL_ENV:'dev',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',PORTAL_WORKER_ENABLED:'true',
  MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock'};

test('normal local startup serves existing orders without enabling mail simulation or automatic maintenance',()=>{
  assert.deepEqual(enrollmentServicePolicy(local),{simulation:false,servicing:true,maintenance:false});
  assert.equal(enrollmentServicePolicy({...local,PORTAL_DEPLOYMENT:'remote-dev'}).servicing,false);
  assert.equal(enrollmentServicePolicy({...local,MYSQL_TRIAL_SOCKET:'/tmp/other.sock'}).servicing,false);
});

test('local mail simulation is independent of the CRM worker',()=>{
  const simulation={...local,PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/tmp/test-mailbox'};
  assert.deepEqual(enrollmentServicePolicy(simulation,'simulation'),{simulation:true,servicing:true,maintenance:false});
  assert.deepEqual(enrollmentServicePolicy({...simulation,PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',PORTAL_WORKER_ENABLED:'false'},'simulation'),
    {simulation:true,servicing:true,maintenance:true});
  for(const transport of ['smtp','disabled'] as const){
    assert.deepEqual(enrollmentServicePolicy(simulation,transport),
      {simulation:false,servicing:true,maintenance:false});
  }
});

test('the company mailbox is opt-in and tied to the isolated test database',()=>{
  const testEnv={PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',TRIAL_DATASET:'synthetic',
    PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',PORTAL_WORKER_ENABLED:'false',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/private/simulated-mail',
    PORTAL_ENROLLMENT_SIMULATION_DATABASE:'uper_trial_enrollment_review',
    MYSQL_TRIAL_URL:'mysql://fixture:fixture@mysql/uper_trial_enrollment_review'};
  assert.deepEqual(enrollmentServicePolicy(testEnv,'simulation'),{simulation:true,servicing:true,maintenance:false});
  assert.deepEqual(enrollmentServicePolicy(testEnv,'disabled'),{simulation:false,servicing:true,maintenance:false});
  for(const override of [{PORTAL_ENV:'prod'},{PORTAL_DEPLOYMENT:'remote-dev'},
    {TRIAL_DATASET:'local-crm'},{PORTAL_WORKER_ENABLED:'true'},
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

test('a saved but partially replaced test bank is still ineligible for live payments',()=>{
  const bank={name:'Bank',accountName:'UPER',accountNumber:'12345678'};
  assert.equal(hasConfiguredEnrollmentBank({bank,revision:0}),false);
  for(const field of [{name:'TEST BANK'},{accountName:'UPER TEST ONLY'},{accountNumber:'TEST-0000000000'}]){
    assert.equal(hasConfiguredEnrollmentBank({bank:{...bank,...field},revision:1}),false);
  }
  assert.equal(hasConfiguredEnrollmentBank({bank,revision:1}),true);
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
