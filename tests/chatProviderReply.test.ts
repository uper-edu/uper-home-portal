import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readChatProviderReply,runChatProviderAttempts} from '../server/portal/chatProviderReply';
import {renderConsultationReply} from '../server/portal/coursePrices';

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

const providers = [
  {provider:'openai',model:'gpt-6-luna',key:'mock-openai',url:'https://openai.invalid',reasoningEffort:'medium' as const},
  {provider:'deepseek',model:'deepseek-v4-pro',key:'mock-deepseek',url:'https://deepseek.invalid'},
];
const messages = [{role:'user',content:'Can I see a course?'}];
const validReply = '{"reply":"You can browse the catalogue.","catalogue":null}';

test('provider attempts preserve per-call model parameters and retry a blank backup stream on the same deadline', async () => {
  const requests: {url: string; init: RequestInit}[] = [];
  const events: unknown[] = [];
  const fetchReply: typeof fetch = async (url, init) => {
    requests.push({url:String(url),init:init!});
    if (requests.length === 1) return new Response('', {status:429});
    if (requests.length === 2) return sse(' ');
    return Response.json({model:'deepseek-v4-pro-version',choices:[{message:{content:validReply},finish_reason:'stop'}],
      usage:{prompt_tokens:40,prompt_cache_hit_tokens:25,completion_tokens:12}});
  };
  await runChatProviderAttempts(providers, async attempt => {
    await attempt.request('turn_language',messages,180);
    assert.equal(attempt.content,validReply);
    assert.equal(attempt.actualModel,'deepseek-v4-pro-version');
  }, {
    blankStreamRetry: async attempt => { events.push(['retry',attempt.role,attempt.content]); },
    call: (attempt,purpose,call) => {
      events.push([attempt.role,purpose,call.status,call.retry,call.usage.input,call.usage.cached]);
    },
    failed: async (attempt,error) => { events.push(['failure',attempt.role,(error as Error).message,attempt.content]); },
  }, fetchReply);
  assert.deepEqual(requests.map(({url})=>url),[providers[0].url,providers[1].url,providers[1].url]);
  assert.deepEqual(requests.map(({init})=>JSON.parse(String(init.body))),[
    {model:'gpt-6-luna',messages,response_format:{type:'json_object'},max_completion_tokens:720,reasoning_effort:'medium',stream:true,stream_options:{include_usage:true}},
    {model:'deepseek-v4-pro',messages,response_format:{type:'json_object'},max_tokens:180,thinking:{type:'disabled'},stream:true,stream_options:{include_usage:true}},
    {model:'deepseek-v4-pro',messages,response_format:{type:'json_object'},max_tokens:180,thinking:{type:'disabled'},stream:false},
  ]);
  assert.equal(new Headers(requests[1].init.headers).get('Authorization'),'Bearer mock-deepseek');
  assert.equal(requests[1].init.signal,requests[2].init.signal);
  assert.notEqual(requests[0].init.signal,requests[1].init.signal);
  assert.deepEqual(events,[
    ['primary','turn_language','error',false,null,null],
    ['failure','primary','Provider HTTP 429',''],
    ['fallback','turn_language','blank',false,null,null],
    ['retry','fallback',' '],
    ['fallback','turn_language','received',true,40,25],
  ]);
});

test('consultation validation and incomplete streams switch slots without retrying or reusing prior partial text', async () => {
  for (const [primary,error,partial] of [
    [sse('partial','stop',false),'Missing provider stream end marker','partial'],
    [sse('cut off','length'),'Answer truncated','cut off'],
    [sse('{"reply":"Example","catalogue":{"detail":"invalid","courses":"all"}}'),'Invalid catalogue selection',
      '{"reply":"Example","catalogue":{"detail":"invalid","courses":"all"}}'],
  ] as const) {
    const paths: string[] = [];
    const failures: unknown[] = [];
    const replies: string[] = [];
    await runChatProviderAttempts(providers, async attempt => {
      assert.equal(attempt.content,'');
      await attempt.request('consultation',messages);
      replies.push(renderConsultationReply(attempt.content,{courses:[]},'en').reply);
    }, {
      blankStreamRetry: async () => assert.fail('Unexpected non-stream retry'),
      call: () => {},
      failed: async (attempt,reason) => { failures.push([attempt.role,(reason as Error).message,attempt.content]); },
    }, async (url,init) => {
      paths.push(String(url));
      const body=JSON.parse(String(init?.body));
      assert.equal(body.stream,true);
      assert.equal(body.max_completion_tokens ?? body.max_tokens,url===providers[0].url?4800:1200);
      return url===providers[0].url?primary:sse(validReply);
    });
    assert.deepEqual(paths,providers.map(provider=>provider.url));
    assert.deepEqual(failures,[['primary',error,partial]]);
    assert.deepEqual(replies,['You can browse the catalogue.']);
  }
});

test('a confirmed reply stops the loop and a missing primary key leaves the backup in its original slot', async () => {
  for (const primaryAvailable of [true,false]) {
    const slots: string[] = [];
    const configured = primaryAvailable ? providers : [{...providers[0],key:undefined},providers[1]];
    await runChatProviderAttempts(configured, async attempt => {
      await attempt.request('consultation',messages);
      assert.equal(attempt.content,validReply);
      assert.equal(attempt.actualModel,attempt.provider.model);
    }, {
      blankStreamRetry: async () => assert.fail('Unexpected non-stream retry'),
      call: attempt => { slots.push(attempt.role); },
      failed: async (_attempt,error) => { throw error; },
    }, async () => sse(validReply));
    assert.deepEqual(slots,[primaryAvailable?'primary':'fallback']);
  }
});
