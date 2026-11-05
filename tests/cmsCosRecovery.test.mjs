import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {identityDifferences,cmsChangeState,writePrivateArtifact} from '../scripts/lib/bootstrap-safety.mjs';
import {publishCmsSeed} from '../scripts/cms-seed-publish.mjs';
import {cmsSeedNames} from '../cloud/mysql/cms-seed.mjs';
import {mediaDigest,cmsMediaUrl} from '../cloud/mysql/cms-media-storage.mjs';

test('COS-19: source identity differences cannot be hidden by a matching live snapshot',()=>{
 const accounts={crm_users:[{id:'one',password_hash:'original',roles:'["cms"]',active:1}],access_roles:[{id:'cms',config:'{"permissions":["cms.manage"]}'}],access_state:[{id:'policy',value:'{"initialized":true}'}]};
 const snapshot={crm_users:[{id:'one',password_hash:'original',roles:['cms'],active:1}],access_roles:[{id:'cms',config:{permissions:['cms.manage']}}],access_state:[{id:'policy',value:{initialized:true}}]};
 assert.deepEqual(identityDifferences(accounts,snapshot),[]);
 snapshot.crm_users[0].password_hash='changed';
 assert.deepEqual(identityDifferences(accounts,snapshot),[{table:'crm_users',field:'password_hash',reason:'different-value'}]);
});

test('COS-20: committed CMS changes are recognized without a second version increment',()=>{
 const change={row:{revision:'9007199254740993'},before:[{_id:'one',image:{url:'/old'}}],after:[{_id:'one',image:{url:'https://example.test/new'},_cmsVersion:1}]};
 assert.equal(cmsChangeState({revision:'9007199254740993',items:change.before},change),'pending');
 assert.equal(cmsChangeState({revision:'9007199254740994',items:change.after},change),'applied');
 assert.equal(cmsChangeState({revision:'9007199254740995',items:change.after},change),'conflict');
 assert.equal(cmsChangeState({revision:'9007199254740994',items:[{_id:'user-edit'}]},change),'conflict');
});

test('COS-21: private artifacts are complete, repeatable and never overwrite different bytes',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cms-artifact-test-'));
 try{const file=path.join(directory,'initial.sql');await writePrivateArtifact(file,'original');await writePrivateArtifact(file,'original');
  await assert.rejects(writePrivateArtifact(file,'different'),/differs/);assert.equal(await fs.readFile(file,'utf8'),'original');
  assert.deepEqual(await fs.readdir(directory),['initial.sql']);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('COS-22: interrupted package finalization resumes without reuploading verified objects',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cms-publish-test-'));
 try{
  const root=pathToFileURL(directory+path.sep),bytes=Buffer.from('fixture'),id=mediaDigest(bytes),receipt=path.join(directory,'receipt.json'),credentials=path.join(directory,'.env');
  await fs.mkdir(path.join(directory,'media'));await fs.writeFile(path.join(directory,'media',id+'.webp'),bytes);
  const bundle={collections:Object.fromEntries(cmsSeedNames.map(name=>[name,[{_id:name,program:'hsk',image:{url:'/images/uploads/'+id+'.webp'}}]])),media:[{id,bytes:bytes.length}]};
  await fs.writeFile(path.join(directory,'bundle.json'),JSON.stringify(bundle));await fs.writeFile(path.join(directory,'preview.json'),'{}');await fs.writeFile(path.join(directory,'import.mjs'),'// fixture');await fs.writeFile(path.join(directory,'SHA256SUMS'),'');await fs.writeFile(credentials,'');
  let uploads=0;const storageFactory=()=>({async upload(){uploads++;return {url:cmsMediaUrl(id),size:bytes.length};}});
  await assert.rejects(publishCmsSeed({credentials,receipt,root,storageFactory}),e=>e.code==='ENOENT');
  assert.equal(uploads,1);assert.equal(JSON.parse(await fs.readFile(path.join(directory,'bundle.json'),'utf8')).media[0].url,cmsMediaUrl(id));
  await fs.writeFile(path.join(directory,'README.md'),'fixture');
  await publishCmsSeed({credentials,receipt,root,storageFactory});await publishCmsSeed({credentials,receipt,root,storageFactory});
  assert.equal(uploads,1);assert.equal(JSON.parse(await fs.readFile(receipt,'utf8')).resources.length,1);
  await fs.writeFile(receipt+'.progress.jsonl','{"id":');
  await publishCmsSeed({credentials,receipt,root,storageFactory});
  assert.equal(uploads,2);assert.equal(JSON.parse((await fs.readFile(receipt+'.progress.jsonl','utf8')).trim()).id,id);
  await fs.writeFile(receipt+'.progress.jsonl','not-json\n');
  await assert.rejects(publishCmsSeed({credentials,receipt,root,storageFactory}),SyntaxError);
  assert.equal((await fs.readdir(directory)).some(x=>x.endsWith('.tmp')),false);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
