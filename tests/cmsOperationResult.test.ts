import test from 'node:test';import assert from 'node:assert/strict';
import {cmsOperationResult} from '../cloud/mysql/cms-operation-result.mjs';
test('saved content lookup is scoped to actor, kind, request and collection',async()=>{
 const db={execute:async(_sql:string,args:any[])=>{assert.deepEqual(args,['robert','cms.mutation','request-1']);return [[{data:{collection:'news',responseText:JSON.stringify({success:true,item:{_id:'test',_cmsVersion:2}})}}]];}};
 const input={actor:'robert',requestId:'request-1',kind:'save',collection:'news'};
 assert.equal((await cmsOperationResult(db,input)).result.item._cmsVersion,2);
 assert.deepEqual(await cmsOperationResult(db,{...input,collection:'partners'}),{state:'not_found'});
});
test('no committed evidence is not reported as failed',async()=>assert.deepEqual(await cmsOperationResult({execute:async()=>[[]]},{actor:'robert',requestId:'request-2',kind:'save',collection:'news'}),{state:'not_found'}));
test('upload query returns confirmed resource metadata from scoped audit',async()=>{
 const result=await cmsOperationResult({execute:async(_s:string,a:any[])=>{assert.equal(a[1],'cms.upload');return [[{data:{response:{success:true,url:'/images/uploads/test.webp',mime:'image/webp',size:123}}}]];}},{actor:'robert',requestId:'upload-1',kind:'upload'});
 assert.equal(result.result.size,123);assert.equal(result.result.content,undefined);
});
