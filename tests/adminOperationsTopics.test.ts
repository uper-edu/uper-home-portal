import assert from 'node:assert/strict';
import {test} from 'node:test';
import {notificationTopics,resolveOperationTopic} from '../src/components/crm/operationsSections';

test('operations resolves notification deep links for both authorised workspaces',()=>{
  for(const {id} of notificationTopics){
    const params=new URLSearchParams({policyTopic:id});
    assert.equal(resolveOperationTopic(params,true,true),id);
    assert.equal(resolveOperationTopic(params,false,true),id);
    assert.equal(resolveOperationTopic(params,true,false),'courses');
  }
});

test('operations preserves class lookups and falls back from hidden topics',()=>{
  assert.equal(resolveOperationTopic(new URLSearchParams({enrollmentClass:'class-1'}),true,true),'enrollment-classes');
  assert.equal(resolveOperationTopic(new URLSearchParams({policyTopic:'schedule'}),true,true),'schedule');
  assert.equal(resolveOperationTopic(new URLSearchParams({policyTopic:'retry'}),true,true),'courses');
  assert.equal(resolveOperationTopic(new URLSearchParams({policyTopic:'enrollment-classes'}),false,true),'notification-rules');
});
