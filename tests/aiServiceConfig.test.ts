import test from 'node:test';import assert from 'node:assert/strict';
import {aiModels,validateSelection,isAiAdministrator,probeModel,providerFor} from '../server/portal/aiServiceConfig';
import {aiServiceText} from '../src/utils/aiServiceLanguage';
const permissions=['access.read','access.users','access.roles','access.sessions','access.audit'];
test('only complete System Administrator can manage AI, not CRM Manager or Sales',()=>{
 assert.equal(isAiAdministrator({roles:['access_admin'],permissions}),true);
 for(const roles of [['sales'],['leader'],[]])assert.equal(isAiAdministrator({roles,permissions}),false);
 assert.equal(isAiAdministrator({roles:['access_admin'],permissions:permissions.slice(1)}),false);
});
test('model selection is allowlisted, different and strips unexpected properties',()=>{
 assert.deepEqual(aiModels,['gpt-6.2-sol','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','gpt-4o','deepseek-v4-pro','deepseek-chat']);
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
  assert.deepEqual(providerFor('deepseek-v4-pro'),{model:'deepseek-v4-pro',provider:'deepseek',key:overrides.DEEPSEEK_API_KEY,url:overrides.DEEPSEEK_API_BASE_URL});
 }finally{
  for(const [key,value] of Object.entries(prior))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
