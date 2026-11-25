import test from 'node:test';import assert from 'node:assert/strict';
import {aiModels,validateSelection,isAiAdministrator,probeModel,providerFor} from '../server/portal/aiServiceConfig';
import {aiServiceText} from '../src/utils/aiServiceLanguage';
import {compareGoals} from '../server/portal/goalReview';
const permissions=['access.read','access.users','access.roles','access.sessions','access.audit'];
test('runtime providers read each credential once per turn on the supplied connection',async()=>{
 const {runtimeProviders}=await import('../server/portal/aiServiceConfig');
 const keys=['MYSQL_TRIAL_URL','PORTAL_ENV','OPENAI_API_KEY','DEEPSEEK_API_KEY','ANTHROPIC_API_KEY'];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 Object.assign(process.env,{MYSQL_TRIAL_URL:'mysql://fixture.invalid/fixture',PORTAL_ENV:'test',OPENAI_API_KEY:'fixture-openai',DEEPSEEK_API_KEY:'fixture-deepseek',ANTHROPIC_API_KEY:'fixture-claude'});
 let selection={primary:'gpt-6-luna',primaryEffort:'medium',fallback:'gpt-6.2-sol'};
 let openaiRevoked=false;
 const reads:string[]=[];
 const db={query:async(sql:string,args?:any[])=>{
  if(sql.includes('portal_settings')){reads.push('settings');return {rows:[{value:{current:selection}}]};}
  assert.match(sql,/FROM integration_credentials/);
  assert.deepEqual(args?.slice(0,2),['test','ai']);
  reads.push(args?.[2]);
  return {rows:args?.[2]==='openai'&&openaiRevoked?[{state:{managed:true}}]:[]};
 }};
 try {
  const same=await runtimeProviders(db);
  assert.deepEqual(same.map(({model,key,reasoningEffort})=>[model,key,reasoningEffort]),[
   ['gpt-6-luna','fixture-openai','medium'],['gpt-6.2-sol','fixture-openai',undefined],
  ]);
  assert.deepEqual(reads.splice(0),['settings','openai']);
  selection={...selection,fallback:'deepseek-v4-pro'};
  openaiRevoked=true;
  assert.deepEqual((await runtimeProviders(db)).map(({key})=>key),[undefined,'fixture-deepseek']);
  assert.deepEqual(reads.splice(0),['settings','openai','deepseek']);
  selection={primary:'claude-haiku-5-5',primaryEffort:'medium',fallback:'claude-sonnet-5-5'};
  assert.deepEqual((await runtimeProviders(db)).map(({provider,key})=>[provider,key]),[['anthropic','fixture-claude'],['anthropic','fixture-claude']]);
  assert.deepEqual(reads,['settings','anthropic']);
 } finally {
  for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
test('only complete System Administrator can manage AI, not CRM Manager or Sales',()=>{
 assert.equal(isAiAdministrator({roles:['access_admin'],permissions}),true);
 for(const roles of [['sales'],['leader'],[]])assert.equal(isAiAdministrator({roles,permissions}),false);
 assert.equal(isAiAdministrator({roles:['access_admin'],permissions:permissions.slice(1)}),false);
});
test('model selection is allowlisted, different and strips unexpected properties',()=>{
 assert.deepEqual(aiModels,['gpt-6.2-sol','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','gpt-4o','MiniMax-M3.1-Flash','deepseek-v4-pro','deepseek-flash','deepseek-chat','claude-haiku-5-5','claude-sonnet-5-5']);
 for(const model of aiModels){
  const other=model==='gpt-6-luna'?'gpt-4o':'gpt-6-luna';
  assert.deepEqual(validateSelection({primary:model,fallback:other}),{primary:model,fallback:other});
  assert.deepEqual(validateSelection({primary:other,fallback:model}),{primary:other,fallback:model});
 }
 assert.deepEqual(validateSelection({primary:'gpt-6.1-sol',fallback:'deepseek-chat',key:'not retained'}),{primary:'gpt-6.1-sol',fallback:'deepseek-chat'});
 for(const value of [null,{}, {primary:'gpt-4o',fallback:'gpt-4o'},{primary:'arbitrary',fallback:'deepseek-chat'}])assert.throws(()=>validateSelection(value));
});
test('Luna and Sol can be tested with different efforts while legacy providers keep their existing parameters',async()=>{
 const {activationCheck}=await import('../server/portal/aiServiceConfig');
 const selection={primary:'gpt-6.2-sol',fallback:'gpt-6-luna',fallbackEffort:'medium'};
 assert.deepEqual(validateSelection({...selection,primaryEffort:'low'}),selection);
 assert.equal(providerFor('gpt-6-luna','medium').reasoningEffort,'medium');
 assert.throws(()=>validateSelection({...selection,primaryEffort:'arbitrary'}),/invalid_reasoning_effort/);
 assert.equal(providerFor('gpt-6.1-terra','high').reasoningEffort,'high');
 assert.throws(()=>validateSelection({...selection,fallback:'deepseek-chat'}),/invalid_reasoning_effort/);
 const check={selection,id:'check',actor:'admin',revision:2,ok:true,expiresAt:200};
 const body={revision:2,checkId:'check',restore:true};
 assert.equal(activationCheck({revision:2,checks:[check],previous:{...selection,primaryEffort:'low'}},body,'admin',100),check);
 assert.throws(()=>activationCheck({revision:2,checks:[check],previous:{...selection,fallbackEffort:'high'}},body,'admin',100),/conflict/);
});
test('all AI interface messages have three nonempty languages',()=>{for(const v of Object.values(aiServiceText)){assert.equal(v.length,3);assert.ok(v.every(s=>s.trim().length));}});
test('missing key cannot pass model checks or fall back',async()=>{const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;try{assert.deepEqual(await probeModel('gpt-6.1-sol'),{model:'gpt-6.1-sol',ok:false,error:'key_missing'});}finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}});

function claudeReply(model:string,value:object,stop='end_turn') {
 return Response.json({model,stop_reason:stop,content:[{type:'thinking',thinking:''},{type:'text',text:JSON.stringify(value)}]});
}

test('both Claude candidates pass simulated JSON, streaming and CRM extraction probes',async()=>{
 for(const model of ['claude-haiku-5-5','claude-sonnet-5-5']){
  const calls:string[]=[];
  const request:typeof fetch=async(url,init)=>{
   assert.equal(url,'https://api.anthropic.com/v1/messages');
   const headers=new Headers(init?.headers);
   assert.equal(headers.get('x-api-key'),'fake-claude');
   assert.equal(headers.get('authorization'),null);
   assert.equal(init?.redirect,'error');
   const body=JSON.parse(String(init?.body));
   assert.equal(body.model,model);
   assert.equal(body.output_config.effort,'medium');
   assert.equal(body.temperature,undefined);
   if(body.system.includes('You extract CRM evidence')){
    calls.push('extraction');
    return claudeReply(model,{observations:[{kind:'field',field:'budgetAmount',value:1500000,quote:'150万印尼盾',subject:'customer',temporality:'current',change:'state'}]});
   }
   assert.equal(body.thinking.type,model==='claude-haiku-5-5'?'disabled':'between_tools');
   assert.equal(body.max_tokens,600);
   if(!body.stream){calls.push('direct');return claudeReply(model,{ok:true});}
   calls.push('stream');
   const events=[
    {type:'message_start',message:{model,usage:{input_tokens:10,output_tokens:1}}},
    {type:'content_block_delta',delta:{type:'text_delta',text:'{"ok":true}'}},
    {type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:5}},
    {type:'message_stop'},
   ];
   return new Response(events.map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});
  };
  const result=await probeModel(model,'medium','fake-claude',request);
  assert.deepEqual(calls,['direct','stream','extraction']);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.actualModel,model);
 }
});

test('goal comparison rejects a truncated Claude result and uses the configured fallback',async()=>{
 const providers=['claude-sonnet-5-5','claude-haiku-5-5'].map(model=>({...providerFor(model),key:'fake-claude'}));
 const calls:string[]=[];
 const relations=await compareGoals('学习商务汉语',['用中文服务客户'],async(_url,init)=>{
  const body=JSON.parse(String(init?.body));
  calls.push(body.model);
  assert.match(body.system,/Compare a customer's currently adopted learning goal/);
  return body.model===providers[0].model
   ? claudeReply(body.model,{relations:['conflict']},'max_tokens')
   : claudeReply(body.model,{relations:['compatible']});
 },providers);
 assert.deepEqual(relations,['compatible']);
 assert.deepEqual(calls,providers.map(provider=>provider.model));
});
test('known provider alias is explicit, never accepts another OpenAI model',async()=>{const {acceptedModel}=await import('../server/portal/aiServiceConfig');assert.equal(acceptedModel('deepseek-chat','deepseek-flash'),true);assert.equal(acceptedModel('gpt-4o','gpt-4o-2024-08-06'),true);assert.equal(acceptedModel('gpt-6.1-sol','deepseek-flash'),false);assert.equal(acceptedModel('gpt-6.1-sol','gpt-4o'),false);});
test('activation binds successful unexpired checks to actor, revision and restore target',async()=>{const {activationCheck}=await import('../server/portal/aiServiceConfig');const selection={primary:'gpt-6.1-sol',fallback:'deepseek-chat'},check={id:'ok',actor:'Robert',revision:2,ok:true,expiresAt:200,selection},s={revision:2,checks:[check],previous:selection},body={revision:2,checkId:'ok',restore:true};assert.equal(activationCheck(s,body,'Robert',100),check);for(const [state,input,actor,now] of [[s,body,'Sales',100],[s,body,'Robert',201],[s,{...body,revision:1},'Robert',100],[{...s,checks:[{...check,ok:false}]},body,'Robert',100],[{...s,previous:{primary:'gpt-4o'}},body,'Robert',100]] as any[])assert.throws(()=>activationCheck(state,input,actor,now));});

// Check fallback precedence with injected storage; no model request or real database is used.
test('AI defaults use the confirmed primary while preserving environment and saved CRM selections', async () => {
 const {aiState}=await import('../server/portal/aiServiceConfig');
 const previous=process.env.OPENAI_MODEL;
 const empty={query:async()=>({rows:[]})};
 try {
  delete process.env.OPENAI_MODEL;
  assert.deepEqual((await aiState(empty)).current,{primary:'gpt-6-luna',primaryEffort:'medium',fallback:'deepseek-v4-pro'});
  assert.deepEqual(validateSelection((await aiState(empty)).current),(await aiState(empty)).current);
  process.env.OPENAI_MODEL='gpt-6.1-terra';
  assert.deepEqual((await aiState(empty)).current,{primary:'gpt-6.1-terra',fallback:'deepseek-v4-pro'});
  const saved={revision:3,current:{primary:'gpt-6-luna',fallback:'deepseek-chat'}};
  assert.deepEqual(await aiState({query:async()=>({rows:[{value:saved}]})}),saved);
 } finally {
  if(previous===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=previous;
 }
});

test('new model candidates use their own provider credentials and endpoints',()=>{
 const overrides={OPENAI_API_KEY:'mock-openai',DEEPSEEK_API_KEY:'mock-deepseek',
  OPENAI_API_BASE_URL:'https://openai.invalid/chat/completions',DEEPSEEK_API_BASE_URL:'https://deepseek.invalid/chat/completions'};
 const prior=Object.fromEntries(Object.keys(overrides).map(key=>[key,process.env[key]]));
 Object.assign(process.env,overrides);
 try{
  assert.deepEqual(providerFor('gpt-6.2-sol'),{model:'gpt-6.2-sol',provider:'openai',key:overrides.OPENAI_API_KEY,url:overrides.OPENAI_API_BASE_URL});
  assert.deepEqual(providerFor('MiniMax-M3.1-Flash','low'),{model:'MiniMax-M3.1-Flash',provider:'openai',key:overrides.OPENAI_API_KEY,url:overrides.OPENAI_API_BASE_URL,reasoningEffort:'low'});
  assert.deepEqual(providerFor('deepseek-v4-pro'),{model:'deepseek-v4-pro',provider:'deepseek',key:overrides.DEEPSEEK_API_KEY,url:overrides.DEEPSEEK_API_BASE_URL});
  assert.deepEqual(providerFor('deepseek-flash'),{model:'deepseek-flash',provider:'deepseek',key:overrides.DEEPSEEK_API_KEY,url:overrides.DEEPSEEK_API_BASE_URL});
  process.env.OPENAI_API_BASE_URL='https://gateway.invalid/v1';
  assert.equal(providerFor('gpt-6.2-sol').url,'https://gateway.invalid/v1/chat/completions');
  assert.equal(providerFor('MiniMax-M3.1-Flash').url,'https://gateway.invalid/v1/chat/completions');
 }finally{
  for(const [key,value] of Object.entries(prior))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
