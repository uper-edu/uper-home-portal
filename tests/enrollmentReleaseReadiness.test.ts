import assert from 'node:assert/strict';
import test from 'node:test';
import {enrollmentServicePolicy} from '../server/portal/enrollmentRuntime.ts';
import {hasConfiguredEnrollmentBank} from '../server/portal/enrollmentBank.ts';

test('deployment and intake require separate opt-ins, so pausing intake preserves servicing',()=>{
  const prod={PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production'};
  assert.deepEqual(enrollmentServicePolicy({...prod,PORTAL_ENROLLMENT_ACCEPTING_NEW:'true'}),
    {simulation:false,servicing:false,acceptingNew:false});
  assert.deepEqual(enrollmentServicePolicy({...prod,PORTAL_ENROLLMENT_SERVICE_ENABLED:'true'}),
    {simulation:false,servicing:true,acceptingNew:false});
  const open={PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',PORTAL_ENROLLMENT_ACCEPTING_NEW:'true'};
  assert.deepEqual(enrollmentServicePolicy({...prod,...open}),{simulation:false,servicing:true,acceptingNew:true});
  assert.equal(enrollmentServicePolicy({...prod,...open,PORTAL_DEPLOYMENT:'remote-dev'}).servicing,false);
  assert.equal(enrollmentServicePolicy({PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',...open}).acceptingNew,true);
});

test('the protected local simulation can pause intake without losing existing order routes',()=>{
  const local={PORTAL_ENV:'dev',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',PORTAL_WORKER_ENABLED:'false',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'/tmp/test-mailbox',MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock'};
  assert.deepEqual(enrollmentServicePolicy(local),{simulation:true,servicing:true,acceptingNew:true});
  assert.deepEqual(enrollmentServicePolicy({...local,PORTAL_ENROLLMENT_ACCEPTING_NEW:'false'}),
    {simulation:true,servicing:true,acceptingNew:false});
});

test('Windows local development permits enrollment simulation only with approved loopback local CRM settings',()=>{
  const winLocal={
    PORTAL_ENV:'dev',APP_ENV:'local',PORTAL_DEPLOYMENT:'local-dev',
    TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',PORTAL_WORKER_ENABLED:'false',
    MYSQL_TRIAL_URL:'mysql://root:pass@127.0.0.1:3306/uper_local_crm',
    PORTAL_ENROLLMENT_SIMULATION_MAILBOX:'C:/tmp/test-mailbox',
  };
  assert.deepEqual(enrollmentServicePolicy(winLocal,'win32'),{simulation:true,servicing:true,acceptingNew:true});
  const disabled={simulation:false,servicing:false,acceptingNew:false};
  assert.deepEqual(enrollmentServicePolicy(winLocal,'darwin'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,PORTAL_DEPLOYMENT:'remote-dev'},'win32'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,PORTAL_DEPLOYMENT:''},'win32'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,MYSQL_TRIAL_URL:'mysql://root:pass@10.0.0.5:3306/uper_local_crm'},'win32'),disabled);
  assert.deepEqual(enrollmentServicePolicy({...winLocal,MYSQL_TRIAL_URL:'mysql://root:pass@127.0.0.1:3306/other_db'},'win32'),disabled);
});

test('a saved but partially replaced test bank is still ineligible for live payments',()=>{
  const bank={name:'Bank',accountName:'UPER',accountNumber:'12345678'};
  assert.equal(hasConfiguredEnrollmentBank({bank,revision:0}),false);
  for(const field of [{name:'TEST BANK'},{accountName:'UPER TEST ONLY'},{accountNumber:'TEST-0000000000'}]){
    assert.equal(hasConfiguredEnrollmentBank({bank:{...bank,...field},revision:1}),false);
  }
  assert.equal(hasConfiguredEnrollmentBank({bank,revision:1}),true);
});
