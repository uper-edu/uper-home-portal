import test from 'node:test';
import assert from 'node:assert/strict';
import {modelParameters} from '../server/portal/modelParameters';
test('Sol requests use reasoning-compatible budget without unsupported sampling', () => {
  assert.deepEqual(modelParameters('gpt-6.1-sol',1200), {max_completion_tokens:4800,reasoning_effort:'low'});
  assert.deepEqual(modelParameters('gpt-6.1-sol',2400,0), {max_completion_tokens:9600,reasoning_effort:'low'});
});
test('legacy OpenAI and DeepSeek request contracts remain unchanged', () => {
  for (const model of ['gpt-4o','deepseek-chat']) {
    assert.deepEqual(modelParameters(model,1200),{max_tokens:1200});
    assert.deepEqual(modelParameters(model,2400,0),{max_tokens:2400,temperature:0});
  }
});
test('Luna and Terra use supported reasoning request options',()=>{for(const model of ['gpt-6-luna','gpt-6.1-terra'])assert.deepEqual(modelParameters(model,2400,0),{max_completion_tokens:9600,reasoning_effort:'low'});});
test('each selectable reasoning effort reaches the request parameters',()=>{
  for(const model of ['gpt-6.2-sol','gpt-6.1-terra','gpt-6-luna','MiniMax-M3.1-Flash']){
    for(const effort of ['low','medium','high'] as const){
      assert.deepEqual(modelParameters(model,1200,0,effort),{max_completion_tokens:4800,reasoning_effort:effort});
    }
  }
});

test('new default models send provider-compatible parameters',()=>{
  assert.deepEqual(modelParameters('gpt-6.2-sol',1200,0),{max_completion_tokens:4800,reasoning_effort:'low'});
  assert.deepEqual(modelParameters('MiniMax-M3.1-Flash',1200,0),{max_completion_tokens:4800,reasoning_effort:'low'});
  assert.deepEqual(modelParameters('deepseek-v4-pro',1200,0),{max_tokens:1200,thinking:{type:'disabled'},temperature:0});
  assert.deepEqual(modelParameters('deepseek-flash',1200),{max_tokens:1200,thinking:{type:'disabled'}});
  assert.deepEqual(modelParameters('deepseek-flash',2400,0),{max_tokens:2400,thinking:{type:'disabled'},temperature:0});
});
