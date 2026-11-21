import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readChatProviderReply} from '../server/portal/chatProviderReply';

const sse = (content: string, finish = 'stop', done = true) => new Response(
  `data: ${JSON.stringify({choices:[{delta:{content},finish_reason:finish}]})}\n\n` + (done?'data: [DONE]':''),
  {headers:{'Content-Type':'text/event-stream'}},
);
const json = (content: string) => Response.json({choices:[{message:{content},finish_reason:'stop'}]});
function run(first: Response, second: Response, deepseek = true) {
  const calls: boolean[] = [];
  let content = '', retries = 0;
  const outcome = readChatProviderReply(async stream => {
    calls.push(stream);
    return stream ? first : second;
  }, deepseek, progress => { content = progress.content; }, async () => { retries++; });
  return {calls, outcome, get content(){return content;}, get retries(){return retries;}};
}
test('a blank completed DeepSeek stream is retried once without streaming', async () => {
  const result = run(sse('   '), json('{"replyLanguage":"id"}'));
  await result.outcome;
  assert.deepEqual(result.calls,[true,false]);
  assert.equal(result.retries,1);
  assert.equal(result.content,'{"replyLanguage":"id"}');

  const blank = run(sse(''), json('  '));
  await assert.rejects(blank.outcome,/Blank provider reply after non-stream retry/);
  assert.deepEqual(blank.calls,[true,false]);
});
test('stream loss, truncation, refusal, and blank non-stream responses do not retry', async () => {
  for (const [first,reason] of [
    [sse('', 'stop', false),/Missing provider stream end marker/],
    [sse(' ', 'length'),/Answer truncated/],
    [sse(' ', 'content_filter'),/finish_reason: content_filter/],
    [json(' '),/Blank provider reply/],
  ] as const) {
    const result = run(first,json('{}'));
    await assert.rejects(result.outcome,reason);
    assert.deepEqual(result.calls,[true]);
  }
  const other = run(sse(' '),json('{}'),false);
  await assert.rejects(other.outcome,/Blank provider reply/);
  assert.deepEqual(other.calls,[true]);
});
test('nonblank streams reach the existing JSON and catalogue validation without retry', async () => {
  const result = run(sse('{"catalogue":{"detail":"invalid"}}'),json('{}'));
  await result.outcome;
  assert.deepEqual(result.calls,[true]);
  assert.equal(result.content,'{"catalogue":{"detail":"invalid"}}');
});

test('metering reads usage-only streaming chunks and meters retries separately',async()=>{
  const calls:Parameters<NonNullable<Parameters<typeof readChatProviderReply>[4]>>[0][]=[];
  const first=new Response([
    {model:'test-primary',choices:[{delta:{content:''},finish_reason:'stop'}],usage:null},
    {model:'test-primary',choices:[],usage:{prompt_tokens:90,prompt_tokens_details:{cached_tokens:20,cache_write_tokens:10},completion_tokens:5,completion_tokens_details:{reasoning_tokens:4}}},
  ].map(value=>`data: ${JSON.stringify(value)}\n\n`).join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  const second=Response.json({model:'test-backup',choices:[{message:{content:'{}'},finish_reason:'stop'}],
    usage:{prompt_tokens:90,prompt_cache_hit_tokens:80,prompt_cache_miss_tokens:10,completion_tokens:2}});
  await readChatProviderReply(async stream=>stream?first:second,true,()=>{},async()=>{},call=>calls.push(call));
  assert.deepEqual(calls.map(c=>[c.stream,c.retry,c.status,c.model,c.usage.input,c.usage.cached,c.usage.cacheWrite,c.usage.output]),
    [[true,false,'blank','test-primary',90,20,10,5],[false,true,'received','test-backup',90,80,null,2]]);
  assert.equal(calls[0].usage.reasoning,4);
  assert.equal(calls[1].usage.cacheMiss,10);
  assert.equal(calls[1].usage.reasoning,null);
});

test('an interrupted request records missing counters without guessing zeros',async()=>{
  const calls:Parameters<NonNullable<Parameters<typeof readChatProviderReply>[4]>>[0][]=[];
  await assert.rejects(readChatProviderReply(async()=>sse('partial','stop',false),false,()=>{},async()=>{},call=>calls.push(call)),
    /Missing provider stream end marker/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].status,'error');
  assert.equal(calls[0].usage.input,null);
  assert.equal(calls[0].usage.output,null);
});
