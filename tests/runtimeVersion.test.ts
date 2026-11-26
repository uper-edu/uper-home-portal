import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import express from 'express';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {execFileSync} from 'node:child_process';
import {runtimeEnvironment,buildIdentity,createRuntimeVersion,mountRuntimeVersion,publicBuildIdentity,verifyFrontendBuildIdentity} from '../server/runtimeVersion.mjs';
import {mountSite} from '../cloud/mysql/site.mjs';
import {VersionDetails,versionTime} from '../src/components/RuntimeVersionStatus';
function fixture(t:any){const root=fs.mkdtempSync(path.join(process.cwd(),'.local-backups/version-fixture-'));fs.mkdirSync(path.join(root,'src'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('Version identity follows source and public build config, excludes private files and records dirty state',t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'src/main.ts'),'export const value=1');const a=buildIdentity('test',root,{VITE_LABEL:'TEST'});assert.equal(a.dirty,true);assert.ok(Number.isFinite(Date.parse(a.gitCommittedAt)));
 fs.writeFileSync(path.join(root,'.env.test'),'OPENAI_API_KEY=TEST-PRIVATE');fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'data/customer.json'),'TEST-PRIVATE-CUSTOMER');assert.equal(buildIdentity('test',root,{VITE_LABEL:'TEST'}).buildId,a.buildId);
 fs.writeFileSync(path.join(root,'src/main.ts'),'export const value=2');assert.notEqual(buildIdentity('test',root,{VITE_LABEL:'TEST'}).buildId,a.buildId);assert.notEqual(buildIdentity('test',root,{VITE_LABEL:'OTHER'}).buildId,buildIdentity('test',root,{VITE_LABEL:'TEST'}).buildId);assert.notEqual(buildIdentity('dev',root,{VITE_LABEL:'TEST'}).buildId,a.buildId);
 assert.ok(!JSON.stringify(publicBuildIdentity({...a,password:'TEST-PRIVATE',serverPath:'/private/test'})).includes('TEST-PRIVATE'));
});
test('Build identity includes bundled assessment archives, including files Git has not tracked yet', t=>{
 const root=fixture(t);
 const original=buildIdentity('dev',root);
 const archiveDirectory=path.join(root,'src','data','hskVersions');
 fs.mkdirSync(archiveDirectory,{recursive:true});
 const archive=path.join(archiveDirectory,'example.json');
 fs.writeFileSync(archive,'{"examVersion":"example","questions":[]}');
 const added=buildIdentity('dev',root);
 assert.notEqual(added.buildId,original.buildId);
 fs.writeFileSync(archive,'{"examVersion":"example","questions":[{"id":"fixture"}]}');
 assert.notEqual(buildIdentity('dev',root).buildId,added.buildId);
});
test('The frontend rejects a release identity for different public configuration or another environment', t=>{
 const root=fixture(t);
 const identity=buildIdentity('test',root,{VITE_ALPHA:'example',VITE_ZULU:'fixture'});
 assert.deepEqual(verifyFrontendBuildIdentity(identity,'test',{VITE_ZULU:'fixture',VITE_ALPHA:'example'}),identity);
 assert.throws(()=>verifyFrontendBuildIdentity(identity,'test',{VITE_ALPHA:'changed'}),/public configuration changed/);
 assert.throws(()=>verifyFrontendBuildIdentity(identity,'dev',{VITE_ALPHA:'example',VITE_ZULU:'fixture'}),/environment does not match/);
});
test('Packaged front/back/environment mismatches fail startup; source mode is not mislabeled as a packaged release',t=>{
 const root=fixture(t),web=path.join(root,'web');fs.mkdirSync(web);const id=buildIdentity('test',root);fs.writeFileSync(path.join(root,'portal-build.json'),JSON.stringify(id));fs.writeFileSync(path.join(web,'portal-build.json'),JSON.stringify(id));
 const version=createRuntimeVersion({root,frontend:web,env:{PORTAL_ENV:'test'}});assert.equal(version.backend.buildId,version.frontend.buildId);assert.equal(version.consistent,true);assert.equal(version.mode,'package');
 assert.throws(()=>createRuntimeVersion({root,frontend:web,env:{PORTAL_ENV:'dev'}}),/environment mismatch/);fs.writeFileSync(path.join(web,'portal-build.json'),JSON.stringify(buildIdentity('dev',root)));assert.throws(()=>createRuntimeVersion({root,frontend:web,env:{PORTAL_ENV:'test'}}),/build mismatch/);
 fs.unlinkSync(path.join(root,'portal-build.json'));assert.equal(createRuntimeVersion({root,frontend:web,env:{APP_ENV:'local',TRIAL_DATASET:'local-crm'}}).mode,'source');assert.equal(runtimeEnvironment({PORTAL_LOCAL_CUTOVER:'true'}),'dev');assert.equal(runtimeEnvironment({PORTAL_DEPLOYMENT:'company-trial',NODE_ENV:'production'}),'test');assert.equal(runtimeEnvironment({PORTAL_ENV:'prod'}),'prod');assert.equal(runtimeEnvironment({}),'unknown');
});
test('A packaged launch cannot fall back to source when the backend identity is missing',t=>{
 const root=fixture(t);
 const web=path.join(root,'web');
 fs.mkdirSync(web);
 fs.writeFileSync(path.join(web,'portal-build.json'),JSON.stringify(buildIdentity('test',root)));
 assert.throws(()=>createRuntimeVersion({
  root,frontend:web,env:{PORTAL_ENV:'test',PORTAL_PACKAGE_ENV:'test'},
 }),/Missing backend build identity/);
 assert.equal(createRuntimeVersion({root,frontend:web,env:{PORTAL_ENV:'test'}}).mode,'source');
});
test('The server entry rejects an incomplete package before loading the database application',()=>{
 const script=`
  import assert from 'node:assert/strict';
  import {registerHooks} from 'node:module';
  const fixture=registerHooks({resolve(specifier,context,next){
   assert.notEqual(specifier,'./server/mysqlApplication.ts','Database application imported before validating release');
   return next(specifier,context);
  }});
  try {
   await assert.rejects(import('./server.ts'),/Missing backend build identity for packaged runtime/);
  } finally {
   fixture.deregister();
  }
 `;
 execFileSync(process.execPath,['--import','tsx','--input-type=module','--eval',script],{
  env:{PATH:process.env.PATH,PORTAL_ENV:'dev',PORTAL_PACKAGE_ENV:'dev',PORTAL_ENV_SOURCE:'injected'},
 });
});
test('Version endpoint/headers expose the same captured identity, never credentials',async t=>{
 const root=fixture(t);const version=createRuntimeVersion({root,env:{PORTAL_ENV:'test',MYSQL_TRIAL_URL:'mysql://TEST-secret@localhost/private'}});const app=express();mountRuntimeVersion(app,version);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const response=await fetch('http://127.0.0.1:'+(server.address() as any).port+'/api/version');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-uper-environment'),'test');const text=await response.text();assert.ok(!text.includes('TEST-secret'));assert.deepEqual(JSON.parse(text),version);
});
for(const lang of ['en','id','zh'] as const)test('Shared version status communicates mismatch and dirty build in '+lang,()=>{
 const html=renderToStaticMarkup(React.createElement(VersionDetails,{lang,frontend:{buildId:'old',dirty:false,environment:'test'},version:{environment:'test',backend:{buildId:'new',dirty:true}}}));assert.match(html,/role="alert"/);assert.match(html,/new/);if(lang!=='zh')assert.doesNotMatch(html,/[\u4e00-\u9fff]/);
});

test('Health reports local-crm/dev instead of hard-coded synthetic and never emits private configuration',async t=>{
 const saved={PORTAL_ENV:process.env.PORTAL_ENV,TRIAL_DATASET:process.env.TRIAL_DATASET};process.env.PORTAL_ENV='dev';process.env.TRIAL_DATASET='local-crm';
 t.after(()=>{for(const[k,v]of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const app=express();await mountSite(app,{db:{execute:async()=>[[]],query:async()=>[[{ok:1}]]},platform:{}});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));const response=await fetch('http://127.0.0.1:'+(server.address() as any).port+'/api/health');const health=await response.json();assert.equal(health.environment,'dev');assert.equal(health.dataset,'local-crm');assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(health).includes('MYSQL'));
});

for(const lang of ['en','id','zh'] as const)test('Code links to the canonical commit independently from Build in '+lang,()=>{
 const commit='a'.repeat(40);const html=renderToStaticMarkup(React.createElement(VersionDetails,{lang,version:{environment:'test',backend:{gitCommit:commit,buildId:'test-package',dirty:false}}}));
 assert.match(html,/<h3>Code<\/h3>/);assert.match(html,/<h3>Build<\/h3>/);assert.ok(html.includes('https://github.com/uper-edu/uper-home-portal/commit/'+commit));assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/test-package/);assert.ok(html.includes(lang==='zh'?'无未提交改动':lang==='id'?'Tanpa perubahan yang belum dikomit':'No uncommitted changes'));
 const unknown=renderToStaticMarkup(React.createElement(VersionDetails,{lang,failed:true,version:{environment:'unknown',backend:{gitCommit:'javascript:bad',dirty:null}}}));assert.doesNotMatch(unknown,/<a /);assert.doesNotMatch(unknown,/javascript:/);
 const source=renderToStaticMarkup(React.createElement(VersionDetails,{lang,version:{mode:'source',environment:'dev',backend:{gitCommit:commit,dirty:false}}}));assert.ok(source.includes(lang==='zh'?'启动时无未提交改动':lang==='id'?'saat mulai':'at startup'));assert.ok(html.includes(lang==='zh'?'构建时无未提交改动':lang==='id'?'saat build':'at build'));
});

test('Commit and build times remain separate, use explicit UTC and never infer missing dates',()=>{
 for(const lang of ['en','id','zh'] as const){assert.equal(versionTime('2026-10-15T03:00:00-07:00',lang),'2026-10-15 10:00:00 UTC');assert.equal(versionTime('2026-10-15T03:00:00-07:00',lang,true),'2026-10-15 10:00 UTC');const html=renderToStaticMarkup(React.createElement(VersionDetails,{lang,version:{environment:'test',backend:{gitCommit:'a'.repeat(40),gitCommittedAt:'2026-10-15T01:00:00Z',builtAt:'2026-10-15T02:00:00Z',buildId:'build-id',dirty:false}}}));assert.ok(html.includes('2026-10-15 01:00:00 UTC'));assert.ok(html.includes('2026-10-15 02:00:00 UTC'));assert.ok(!versionTime(null,lang).includes('1970'));}
});
