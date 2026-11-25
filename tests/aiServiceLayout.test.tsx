import React from 'react';import test from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';import {AiServiceContent} from '../src/components/AiServicePanel';import{testAndSaveAi}from'../src/utils/aiServiceSubmit';
const selection={primary:'gpt-6.2-sol',fallback:'deepseek-v4-pro'},noop=()=>{};
const data={current:selection,previous:{primary:'gpt-4o',fallback:'deepseek-chat'},models:['gpt-6.2-sol','deepseek-v4-pro','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','gpt-4o','deepseek-chat'],keys:{openai:true,deepseek:true},attempts:[{model:'TEST-ACTUAL',ok:true,at:'2026-10-28T07:00:00Z'}],extractions:[],history:[]};
const render=(extra:any={})=>renderToStaticMarkup(<AiServiceContent lang="zh" isLight data={data} selection={selection} check={null} busy={false} notice="" unresolved={false}
 renderHeading={actions=><header>{actions}</header>} onSelect={noop} onSubmit={noop} onQuery={noop} onDiagnose={noop} onTestCurrent={noop} onCloseDiagnostics={noop}
 {...extra}><section>供应商凭证</section></AiServiceContent>);
test('model configuration is immediately editable and provider credentials have an independent section',()=>{
 const html=render();
 assert.match(html,/模型配置/);
 assert.match(html,/gpt-6\.2-sol/);
 assert.match(html,/deepseek-v4-pro/);
 assert.equal((html.match(/role="combobox"/g)||[]).length,3);
 assert.match(html,/<button[^>]*type="submit"[^>]*disabled=""/);
 assert.ok(html.indexOf('</form>')<html.indexOf('供应商凭证'));
 assert.ok(html.indexOf('供应商凭证')<html.indexOf('诊断与历史'));
 assert.match(html.match(/<h3[^>]*>模型配置<\/h3>([\s\S]*?)<\/header>/)?.[1]??'',/测试当前配置/);
 assert.equal((html.match(/<details/g)||[]).length,4);
 assert.doesNotMatch(html,/<details[^>]*\sopen|data-editor="drawer"|当前生效配置/);
});
test('Claude selections display in the shared model controls with independent effort fields',()=>{
 const selection={primary:'claude-haiku-5-5',fallback:'claude-sonnet-5-5'};
 const html=render({selection,data:{...data,models:[...data.models,...Object.values(selection)]}});
 assert.match(html,/claude-haiku-5-5/);
 assert.match(html,/claude-sonnet-5-5/);
 assert.match(html,/主模型推理强度/);
 assert.match(html,/备用模型推理强度/);
});
test('editing has one test-and-save action and unknown activation replaces it with result lookup',()=>{
 const editing={selection:{...selection,fallback:'deepseek-chat'}};
 const html=render(editing);
 assert.equal((html.match(/type="submit"/g)||[]).length,1);
 assert.doesNotMatch(html,/<button[^>]*type="submit"[^>]*disabled=""/);
 assert.doesNotMatch(render({...editing,unresolved:true}),/type="submit"/);
 assert.match(render({...editing,unresolved:true}),/核对本次结果/);
 assert.match(render({...editing,busy:true}),/aria-busy="true"/);
});
test('failed test is explicit and language variants preserve the same layout',()=>{
 const check={ok:false,results:[{model:selection.primary,ok:false}]};
 assert.match(render({check}),/当前生效配置保持不变/);
 for(const lang of ['en','id','zh'])assert.equal((render({lang}).match(/<details/g)||[]).length,4);
});
test('single action uses server check token for exact selection and revision, activates once',async()=>{const calls:any[]=[];const check={id:'server-check',ok:true};const r=await testAndSaveAi({selection,revision:3,requestId:'request-123',onChecked:noop,beforeActivate:noop,call:async(path,body)=>{calls.push({path,body});return path==='/test'?check:{revision:4};}});assert.equal(r.saved,true);assert.deepEqual(calls,[{path:'/test',body:{selection,revision:3}},{path:'/activate',body:{revision:3,checkId:'server-check',requestId:'request-123'}}]);});
test('failed or unavailable test never activates; lost activation response is not retried',async()=>{for(const mode of ['failed','test-error','activate-error']){let activated=0,called=0;const run=()=>testAndSaveAi({selection,revision:1,requestId:'request-123',onChecked:noop,beforeActivate:noop,call:async(path)=>{called++;if(path==='/test'){if(mode==='test-error')throw Error('timeout');return{id:'test',ok:mode!=='failed'};}activated++;throw Error('response lost');}});if(mode==='failed')assert.equal((await run()).saved,false);else await assert.rejects(run);assert.equal(activated,mode==='activate-error'?1:0);assert.equal(called,mode==='activate-error'?2:1);}});
test('testing unchanged configuration does not rotate the previous configuration or create an activation',async()=>{let activated=false;const result=await testAndSaveAi({selection,current:selection,revision:2,requestId:'request-123',onChecked:noop,beforeActivate:()=>{activated=true},call:async()=>({ok:true,id:'passed'})});assert.equal(result.unchanged,true);assert.equal(activated,false);});
test('effort selectors belong to the supported model and a non-default effort is a configuration change',async()=>{
 const candidate={...selection,fallback:'gpt-6-luna',fallbackEffort:'medium' as const};
 const html=render({selection:candidate});
 assert.match(html,/主模型推理强度/);
 assert.match(html,/备用模型推理强度/);
 assert.match(html,/gpt-6-luna/);
 assert.doesNotMatch(render(),/备用模型推理强度/);
 const requests:string[]=[];
 await testAndSaveAi({selection:candidate,current:{...candidate,fallbackEffort:'low'},revision:2,requestId:'request-123',onChecked:noop,beforeActivate:noop,call:async(path,body)=>{requests.push(path);if(path==='/test')assert.equal(body.selection.fallbackEffort,'medium');return {ok:true,id:'passed'};}});
 assert.deepEqual(requests,['/test','/activate']);
});
