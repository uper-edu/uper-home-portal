import assert from 'node:assert/strict';
import {test} from 'node:test';
import {enrollmentSettingsLegacyLocation,enrollmentSettingsPath,notificationTopics,resolveEnrollmentSettingsTopic,resolveOperationTopic} from '../src/components/crm/operationsSections';
import {enrollmentSettingsReturnPath} from '../src/utils/crmEnrollmentManagement';

test('operations resolves notification deep links for both authorised workspaces',()=>{
  for(const {id} of notificationTopics){
    const params=new URLSearchParams({policyTopic:id});
    assert.equal(resolveOperationTopic(params,true,true),id);
    assert.equal(resolveOperationTopic(params,false,true),id);
    assert.equal(resolveOperationTopic(params,true,false),'permissions');
  }
});

test('sales operations preserves other deep links and falls back to permissions',()=>{
  assert.equal(resolveOperationTopic(new URLSearchParams({policyTopic:'schedule'}),true,true),'schedule');
  assert.equal(resolveOperationTopic(new URLSearchParams({policyTopic:'retry'}),true,true),'permissions');
});

test('old course, class and rules links resolve to their own workspace',()=>{
  for(const id of ['courses','enrollment-classes']){
    const params=new URLSearchParams({tab:'policy',policyTopic:id});
    assert.equal(resolveEnrollmentSettingsTopic(params),id);
    assert.equal(enrollmentSettingsLegacyLocation(params),'/academics?policyTopic='+id);
  }
  const lookup=new URLSearchParams({tab:'policy',enrollmentClass:'class-1'});
  assert.match(enrollmentSettingsLegacyLocation(lookup)!,/^\/academics\?/);
  assert.equal(resolveEnrollmentSettingsTopic(lookup),'enrollment-classes');
  assert.equal(enrollmentSettingsLegacyLocation(new URLSearchParams({tab:'policy'})),undefined);
});

test('class settings return preserves safe roster and list filters',()=>{
  const origin='/crm?tab=enrollment-management&classId=class-1&classPage=2&classSort=latest&rosterStatus=history&rosterClosure=payment_timeout';
  const route=new URLSearchParams(enrollmentSettingsPath('enrollment-classes',{classId:'class-1',returnTo:origin}).split('?')[1]);
  assert.equal(route.get('tab'),null);
  assert.equal(route.get('enrollmentClass'),'class-1');
  const back=new URLSearchParams(enrollmentSettingsReturnPath(route.get('enrollmentReturn'))?.split('?')[1]);
  for(const [key,value] of new URLSearchParams(origin.split('?')[1]))assert.equal(back.get(key),value);
  assert.equal(back.get('resumeRosterSettings'),'1');
  assert.equal(enrollmentSettingsReturnPath('https://example.test/crm?tab=enrollment-management'),undefined);
  assert.equal(enrollmentSettingsReturnPath('/crm?tab=payments'),undefined);
});


test('legacy academic deep links retain records, language, and return location',()=>{
  const params=new URLSearchParams({tab:'enrollment-settings',policyTopic:'faculty',facultyId:'mock-teacher',lang:'zh',enrollmentReturn:'/crm?tab=enrollment-management'});
  const destination=new URL(enrollmentSettingsLegacyLocation(params,'#details')!,'http://localhost');
  assert.equal(destination.pathname,'/academics');
  assert.equal(destination.hash,'#details');
  for(const [name,value] of params)if(name!=='tab')assert.equal(destination.searchParams.get(name),value);

});


test('old admissions and enrollment rules links resolve to separate permission-scoped destinations',()=>{
  for(const tab of ['enrollment-settings','policy']){
    const oldMail=new URLSearchParams({tab,policyTopic:'enrollment-mail',lang:'zh'});
    assert.equal(enrollmentSettingsLegacyLocation(oldMail),'/system?tab=mail&mailView=admissions&lang=zh');
  }
  const returnTo='/crm?tab=enrollment-management&classPage=2';
  const oldRules=new URLSearchParams({tab:'enrollment-settings',policyTopic:'enrollment-rules',enrollmentReturn:returnTo});
  assert.equal(enrollmentSettingsLegacyLocation(oldRules),enrollmentSettingsPath('enrollment-rules',{returnTo}));
  oldRules.set('tab','policy');
  assert.equal(enrollmentSettingsLegacyLocation(oldRules),undefined);
  assert.equal(resolveOperationTopic(oldRules,true,false),'enrollment-rules');
  assert.equal(resolveOperationTopic(oldRules,false,true),'notification-rules');
});
