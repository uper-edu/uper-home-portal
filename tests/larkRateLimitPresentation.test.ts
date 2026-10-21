import {test} from 'node:test';import assert from 'node:assert/strict';
import {crmDeliveryResult} from '../src/utils/crmLanguage';
test('BUG604 trilingual rate-limit retry / exhaustion / historical failure summaries remain distinct',()=>{
 for(const lang of ['en','id','zh'] as const){
  const retry=crmDeliveryResult('HTTP 200; code 11232','pending',lang);
  const terminal=crmDeliveryResult('HTTP 200; code 11232; retry limit reached','failed',lang);
  const historical=crmDeliveryResult('HTTP 200; code 11232','failed',lang);
  const unknown=crmDeliveryResult('TEST timeout','unknown',lang);
  assert.ok(retry&&terminal&&historical&&unknown);assert.notEqual(retry,terminal);assert.notEqual(terminal,historical);assert.notEqual(unknown,retry);
  assert.doesNotMatch(retry,/^HTTP/);
 }
});
