import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readChatProviderReply} from '../server/portal/chatProviderReply';

type ProviderCall=Parameters<Parameters<typeof readChatProviderReply>[2]>[0];
const sse=(chunks:unknown[],done=true)=>new Response(
  chunks.map(payload=>`data: ${JSON.stringify(payload)}\n\n`).join('')+(done?'data: [DONE]':''),
  {headers:{'Content-Type':'text/event-stream'}},
);

test('metering reads usage-only streaming chunks alongside a complete reply',async()=>{
  const calls:ProviderCall[]=[];
  let content='';
  const response=sse([
    {model:'test-primary',choices:[{delta:{content:'{}'},finish_reason:'stop'}],usage:null},
    {model:'test-primary',choices:[],usage:{
      prompt_tokens:90,prompt_tokens_details:{cached_tokens:20,cache_write_tokens:10},
      completion_tokens:5,completion_tokens_details:{reasoning_tokens:4},
    }},
  ]);
  await readChatProviderReply(async()=>response,progress=>{content=progress.content;},call=>calls.push(call));
  assert.equal(content,'{}');
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].usage,{
    input:90,cached:20,cacheMiss:null,cacheWrite:10,cacheWrite30m:null,cacheWrite12h:null,output:5,reasoning:4,
  });
  assert.equal(calls[0].model,'test-primary');
  assert.equal(calls[0].status,'received');
});

test('JSON replies meter DeepSeek cache fields without estimating absent counters',async()=>{
  const calls:ProviderCall[]=[];
  const response=Response.json({model:'test-backup',choices:[{message:{content:'{}'},finish_reason:'stop'}],
    usage:{prompt_tokens:90,prompt_cache_hit_tokens:80,prompt_cache_miss_tokens:10,completion_tokens:2}});
  await readChatProviderReply(async()=>response,()=>{},call=>calls.push(call));
  assert.deepEqual(calls[0].usage,{
    input:90,cached:80,cacheMiss:10,cacheWrite:null,cacheWrite30m:null,cacheWrite12h:null,output:2,reasoning:null,
  });
});

test('an interrupted request records missing counters without guessing zeros',async()=>{
  const calls:ProviderCall[]=[];
  const response=sse([{choices:[{delta:{content:'partial'},finish_reason:'stop'}]}],false);
  await assert.rejects(readChatProviderReply(async()=>response,()=>{},call=>calls.push(call)),/Incomplete answer/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].status,'error');
  assert.equal(calls[0].usage.input,null);
  assert.equal(calls[0].usage.output,null);
});
