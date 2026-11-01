import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LarkApp} from '../server/portal/larkApp.ts';
const env={LARK_APP_ID:'cli_test',LARK_APP_SECRET:'synthetic-secret'};
test('credentials remain server side; token is cached and email resolves to stable open ID',async()=>{
 const calls:any[]=[];
 const app=new LarkApp(env,async(url,options)=>{calls.push({url,options});return Response.json(calls.length===1?{code:0,tenant_access_token:'synthetic-token',expire:7200}:{code:0,data:{user_list:[{user_id:'ou_sales'}]}});});
 assert.deepEqual(await app.lookup('maya@example.com'),{appId:'cli_test',openId:'ou_sales',email:'maya@example.com'});
 await app.lookup('arif@example.com');assert.equal(calls.length,3);assert.ok(!String(calls[2].options.body).includes('synthetic-secret'));
});
test('personal sending requires explicit enablement and never calls network by default',async()=>{
 let calls=0;const app=new LarkApp(env,async()=>{calls++;throw Error('network');});
 await assert.rejects(app.send('ou_sales',{},'job'),/disabled/);assert.equal(calls,0);
});
test('enabled sending uses app token, stable idempotency key and private recipient',async()=>{
 const bodies:any[]=[];const app=new LarkApp({...env,LARK_PERSONAL_DELIVERY_ENABLED:'true'},async(_url,o)=>{bodies.push(JSON.parse(String(o?.body)));return Response.json(bodies.length===1?{code:0,tenant_access_token:'token',expire:7200}:{code:0,data:{message_id:'msg'}});});
 await app.send('ou_sales',{msg_type:'interactive',card:{header:{}}},'stable-job');
 assert.deepEqual(bodies[1],{receive_id:'ou_sales',msg_type:'interactive',content:'{"header":{}}',uuid:'stable-job'});
});
test('provider errors do not expose credentials or response details',async()=>{
 const app=new LarkApp(env,async()=>Response.json({code:999,msg:'private provider content'}));
 await assert.rejects(app.token(),/^Error: lark_app_auth_failed$/);
});
test('invalid email and missing identity are rejected',async()=>{
 const app=new LarkApp(env,async(url)=>Response.json(String(url).includes('/auth/')?{code:0,tenant_access_token:'token',expire:7200}:{code:0,data:{user_list:[]}}));
 await assert.rejects(app.lookup('invalid'),/invalid/);await assert.rejects(app.lookup('maya@example.com'),/not_found/);
});
test('directory permission error is safe and actionable',async()=>{
 const app=new LarkApp(env,async(url)=>Response.json(String(url).includes('/auth/')?{code:0,tenant_access_token:'token',expire:7200}:{code:99991672,msg:'private upstream text'}));
 await assert.rejects(app.lookup('maya@example.com'),/^Error: lark_directory_permission_missing$/);
});
test('unknown diagnostic never exposes upstream content',async()=>{
 const {larkPublicError}=await import('../server/portal/larkApp.ts');
 assert.equal(larkPublicError(Error('secret provider response')),'lark_connection_failed');
 assert.equal(larkPublicError(Error('lark_email_invalid')),'lark_email_invalid');
});
test('phone lookup sends only mobiles and preserves canonical identifier',async()=>{
 const requests:any[]=[];const app=new LarkApp(env,async(url,o)=>{requests.push(JSON.parse(String(o?.body)));return Response.json(String(url).includes('/auth/')?{code:0,tenant_access_token:'token',expire:7200}:{code:0,data:{user_list:[{user_id:'ou_phone'}]}});});
 assert.deepEqual(await app.lookup('+6281234567890','mobile'),{appId:'cli_test',openId:'ou_phone',mobile:'+6281234567890'});
 assert.deepEqual(requests[1],{mobiles:['+6281234567890'],include_resigned:false});
});
test('phone format and mixed/unknown lookup methods fail before network',async()=>{
 const {larkLookupInput}=await import('../server/portal/larkApp.ts');
 const app=new LarkApp(env,async()=>{throw Error('Network must not run');});
 for(const phone of ['081234567890','+62 81234567890','+',''])await assert.rejects(app.lookup(phone,'mobile'),/lark_mobile_invalid/);
 assert.throws(()=>larkLookupInput({method:'other',email:'maya@example.com'}),/method_invalid/);
 assert.throws(()=>larkLookupInput({method:'mobile',mobile:'+6281234567890',email:'maya@example.com'}),/method_invalid/);
 assert.deepEqual(larkLookupInput({method:'mobile',mobile:'+6281234567890'}),{method:'mobile',value:'+6281234567890'});
});
test('email-only provider result is not a successful identity match',async()=>{
 const app=new LarkApp(env,async(url)=>Response.json(String(url).includes('/auth/')?{code:0,tenant_access_token:'token',expire:7200}:{code:0,data:{user_list:[{email:'maya@example.com'}]}}));
 await assert.rejects(app.lookup('maya@example.com'),/lark_user_not_found/);
});
