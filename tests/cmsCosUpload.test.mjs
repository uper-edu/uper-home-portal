import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadCmsMedia} from '../cloud/mysql/cms-media-upload.mjs';
import {cmsMediaUrl,mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';
const content=Buffer.from('converted-image'),digest=mediaDigest(content);
const uploaded={digest,url:cmsMediaUrl(digest),objectKey:'cms/'+digest+'.webp',mime:'image/webp',size:content.length};
const input={actor:'test-actor',key:'test-request',inputHash:'source-hash',content};
function fixture({existing=null,raced=null,failCommit=false}={}){
 const calls=[];
 const c={async query(){return [[]];},async beginTransaction(){calls.push('begin');},async commit(){calls.push('commit');if(failCommit)throw Error('commit failed');},async rollback(){calls.push('rollback');},release(){calls.push('release');},async execute(sql,params){
  if(sql.startsWith('SELECT data'))return [raced?[{data:raced}]:[]];
  if(sql.startsWith('INSERT INTO cms_media')){assert.match(sql,/NULL/);assert.equal(params.some(Buffer.isBuffer),false);calls.push('metadata');}
  if(sql.startsWith('INSERT INTO portal_audit'))calls.push('audit');
  return [[]];
 }};
 const db={async execute(){return [existing?[{data:existing}]:[]];},async getConnection(){return c;}};
 const storage={async upload(){assert.equal(calls.includes('begin'),false);calls.push('upload');return uploaded;}};
 return {db,storage,calls};
}

test('COS-11: upload happens outside locks and success follows database commit',async()=>{
 const f=fixture();const result=await uploadCmsMedia(f.db,f.storage,input);
 assert.equal(result.url,uploaded.url);assert.deepEqual(f.calls,['upload','begin','metadata','audit','commit','release']);
});

test('COS-12: completed requests return the saved result without a second upload',async()=>{
 const response={success:true,url:uploaded.url};const f=fixture({existing:{inputHash:input.inputHash,response}});
 assert.deepEqual(await uploadCmsMedia(f.db,f.storage,input),response);assert.deepEqual(f.calls,[]);
 const conflict=fixture({existing:{inputHash:'different',response}});
 await assert.rejects(uploadCmsMedia(conflict.db,conflict.storage,input),e=>e.status===409);assert.deepEqual(conflict.calls,[]);
});

test('COS-13: concurrent completion is rechecked under the actor lock',async()=>{
 const response={success:true,url:uploaded.url};const f=fixture({raced:{inputHash:input.inputHash,response}});
 assert.deepEqual(await uploadCmsMedia(f.db,f.storage,input),response);
 assert.deepEqual(f.calls,['upload','begin','commit','release']);
});

test('COS-14: database failure rolls back and does not delete a shared COS object',async()=>{
 const f=fixture({failCommit:true});await assert.rejects(uploadCmsMedia(f.db,f.storage,input),/commit failed/);
 assert.deepEqual(f.calls,['upload','begin','metadata','audit','commit','rollback','release']);
});

test('COS-15: COS failure or wrong returned URL never writes media metadata',async()=>{
 const f=fixture();f.storage.upload=async()=>{throw Error('COS unavailable');};
 await assert.rejects(uploadCmsMedia(f.db,f.storage,input),/COS unavailable/);assert.deepEqual(f.calls,[]);
 f.storage.upload=async()=>({...uploaded,url:cmsMediaUrl('a'.repeat(64))});
 await assert.rejects(uploadCmsMedia(f.db,f.storage,input),/verification failed/);assert.deepEqual(f.calls,[]);
});
