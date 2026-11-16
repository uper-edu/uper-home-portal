import assert from 'node:assert/strict';
import {test} from 'node:test';
import {enrollmentSettingsPath,isLegacyEnrollmentSettings,notificationTopics,resolveEnrollmentSettingsTopic,resolveOperationTopic} from '../src/components/crm/operationsSections';
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

test('old course, class and rules links resolve inside enrollment settings',()=>{
  for(const id of ['courses','enrollment-classes','enrollment-rules']){
    const params=new URLSearchParams({tab:'policy',policyTopic:id});
    assert.equal(isLegacyEnrollmentSettings(params),true);
    assert.equal(resolveEnrollmentSettingsTopic(params),id);
  }
  const lookup=new URLSearchParams({tab:'policy',enrollmentClass:'class-1'});
  assert.equal(isLegacyEnrollmentSettings(lookup),true);
  assert.equal(resolveEnrollmentSettingsTopic(lookup),'enrollment-classes');
  assert.equal(isLegacyEnrollmentSettings(new URLSearchParams({tab:'policy'})),false);
});

test('class settings return preserves safe roster and list filters',()=>{
  const origin='/crm?tab=enrollment-management&classId=class-1&classPage=2&classSort=latest&rosterStatus=history&rosterClosure=payment_timeout';
  const route=new URLSearchParams(enrollmentSettingsPath('enrollment-classes',{classId:'class-1',returnTo:origin}).split('?')[1]);
  assert.equal(route.get('tab'),'enrollment-settings');
  assert.equal(route.get('enrollmentClass'),'class-1');
  const back=new URLSearchParams(enrollmentSettingsReturnPath(route.get('enrollmentReturn'))?.split('?')[1]);
  for(const [key,value] of new URLSearchParams(origin.split('?')[1]))assert.equal(back.get(key),value);
  assert.equal(back.get('resumeRosterSettings'),'1');
  assert.equal(enrollmentSettingsReturnPath('https://example.test/crm?tab=enrollment-management'),undefined);
  assert.equal(enrollmentSettingsReturnPath('/crm?tab=payments'),undefined);
});
