import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const root = process.cwd();
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uper-failover-'));
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
for (const name of ['src', 'server', 'node_modules']) await fs.symlink(path.join(root, name), path.join(dir, name));
await fs.mkdir(path.join(dir, 'dist'));
await fs.writeFile(path.join(dir, 'dist/index.html'), '<title>Test</title>');
await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
await fs.writeFile(path.join(dir, '.env'), 'OPENAI_API_KEY=test\nDEEPSEEK_API_KEY=test\nDEFAULT_AI_PROVIDER=openai\nOPENAI_API_BASE_URL=https://mock.invalid/openai\n');
await fs.writeFile(path.join(dir, 'server.ts'), (await fs.readFile(path.join(root, 'server.ts'), 'utf8')).replace('const PORT = 3000;', `const PORT = ${port};`));
await fs.writeFile(path.join(dir, 'mock.mjs'), `
const nativeFetch = globalThis.fetch;
const encoder = new TextEncoder();
globalThis.fetch = async (url, options) => {
 if (!String(url).includes('mock.invalid') && !String(url).includes('api.deepseek.com')) return nativeFetch(url, options);
 const body = JSON.parse(options.body);
 const scenario = body.messages.at(-1).content;
 const primary = String(url).includes('mock.invalid');
 if (primary && /^(401|429|500)$/.test(scenario)) return new Response('{}', { status: Number(scenario) });
 if (primary && scenario === 'network') throw new TypeError('mock network failure');
 if (scenario === 'both-fail') return new Response('{}', {status:503});
 const text = primary ? 'PRIMARY reply that is long enough to emit partial content.' : 'BACKUP answer';
 if (!body.stream) {
  if(primary && scenario === 'legacy') return new Response('{}',{status:500});
  return Response.json({choices:[{message:{content:JSON.stringify({reply:text,suggestedPrompts:[]})}}]});
 }
 let step=0;
 return new Response(new ReadableStream({pull(controller){
  if(step++===0) {controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\\n\\n'));return;}
  if(primary && scenario==='partial') {controller.error(new Error('mock stream disconnect'));return;}
  if(!(primary && scenario==='truncated')) controller.enqueue(encoder.encode('data: [DONE]\\n\\n'));
  controller.close();
 }}),{headers:{'Content-Type':'text/event-stream'}});
};
`);
const child = spawn(process.execPath, ['--import', 'tsx', '--import', './mock.mjs', 'server.ts'], {cwd:dir, env:{...process.env,NODE_ENV:'production'}});
let logs='';
await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(new Error('Test server startup timed out')),10000);
 child.stdout.on('data',d=>{logs+=d;if(logs.includes('Server running')){clearTimeout(timer);resolve();}});
 child.on('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});
});
const endpoint = `http://127.0.0.1:${port}/api/chat`;
async function request(scenario, stream=true){
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stream,messages:[{role:'user',content:scenario}]})});
 if(!stream) return res.json();
 return (await res.text()).split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)));
}
try {
 for(const scenario of ['401','429','500','network','partial','truncated']) {
  await test('OpenAI '+scenario+' automatically falls back to DeepSeek', async()=>{
   const events=await request(scenario);let reply='';
   for(const e of events){if(e.reset)reply='';if(e.chunk)reply+=e.chunk;}
   assert.equal(reply,'BACKUP answer');
   assert.equal(events.at(-1).modelUsed,'deepseek-chat');
   assert.equal(events.at(-1).done,true);
   if(['partial','truncated'].includes(scenario)) assert.ok(events.some(e=>e.reset));
  });
 }
 await test('healthy primary remains OpenAI',async()=>{const events=await request('success');assert.equal(events.at(-1).modelUsed,'gpt-4o');assert.ok(!events.some(e=>e.reset));});
 await test('both providers failing gives explicit error, no claimed model success',async()=>{const events=await request('both-fail');assert.equal(events.at(-1).error,'all_providers_failed');assert.equal(events.at(-1).modelUsed,null);});
 await test('legacy JSON mode also falls back',async()=>{const result=await request('legacy',false);assert.equal(result.reply,'BACKUP answer');assert.equal(result.modelUsed,'deepseek-chat');});
} finally {
 child.kill();await new Promise(resolve=>child.once('exit',resolve));await fs.rm(dir,{recursive:true,force:true});
}
