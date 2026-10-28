import test from 'node:test';import assert from 'node:assert/strict';
import {validateSelection,isAiAdministrator,probeModel} from '../server/portal/aiServiceConfig';
import {aiServiceText} from '../src/utils/aiServiceLanguage';
const permissions=['access.read','access.users','access.roles','access.sessions','access.audit'];
test('only complete System Administrator can manage AI, not CRM Manager or Sales',()=>{
 assert.equal(isAiAdministrator({roles:['access_admin'],permissions}),true);
 for(const roles of [['sales'],['leader'],[]])assert.equal(isAiAdministrator({roles,permissions}),false);
 assert.equal(isAiAdministrator({roles:['access_admin'],permissions:permissions.slice(1)}),false);
});
test('model selection is allowlisted, different and strips unexpected properties',()=>{
 assert.deepEqual(validateSelection({primary:'gpt-6.1-sol',fallback:'deepseek-chat',key:'not retained'}),{primary:'gpt-6.1-sol',fallback:'deepseek-chat'});
 for(const value of [null,{}, {primary:'gpt-4o',fallback:'gpt-4o'},{primary:'arbitrary',fallback:'deepseek-chat'}])assert.throws(()=>validateSelection(value));
});
test('all AI interface messages have three nonempty languages',()=>{for(const v of Object.values(aiServiceText)){assert.equal(v.length,3);assert.ok(v.every(s=>s.trim().length));}});
test('missing key cannot pass model checks or fall back',async()=>{const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;try{assert.deepEqual(await probeModel('gpt-6.1-sol'),{model:'gpt-6.1-sol',ok:false,error:'key_missing'});}finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}});
test('known provider alias is explicit, never accepts another OpenAI model',async()=>{const {acceptedModel}=await import('../server/portal/aiServiceConfig');assert.equal(acceptedModel('deepseek-chat','deepseek-flash'),true);assert.equal(acceptedModel('gpt-4o','gpt-4o-2024-08-06'),true);assert.equal(acceptedModel('gpt-6.1-sol','deepseek-flash'),false);assert.equal(acceptedModel('gpt-6.1-sol','gpt-4o'),false);});
test('activation binds successful unexpired checks to actor, revision and restore target',async()=>{const {activationCheck}=await import('../server/portal/aiServiceConfig');const selection={primary:'gpt-6.1-sol',fallback:'deepseek-chat'},check={id:'ok',actor:'Robert',revision:2,ok:true,expiresAt:200,selection},s={revision:2,checks:[check],previous:selection},body={revision:2,checkId:'ok',restore:true};assert.equal(activationCheck(s,body,'Robert',100),check);for(const [state,input,actor,now] of [[s,body,'Sales',100],[s,body,'Robert',201],[s,{...body,revision:1},'Robert',100],[{...s,checks:[{...check,ok:false}]},body,'Robert',100],[{...s,previous:{primary:'gpt-4o'}},body,'Robert',100]] as any[])assert.throws(()=>activationCheck(state,input,actor,now));});
