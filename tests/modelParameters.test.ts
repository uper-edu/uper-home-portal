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
