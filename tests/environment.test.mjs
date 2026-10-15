import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {environmentName,readEnvironment,frontendEnvironment,loadPortalEnvironment} from '../server/environment.mjs';
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'uper-env-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}
test('environment selection never falls back to .env or mixes dev and test credentials',t=>{
 const directory=fixture(t);
 fs.writeFileSync(path.join(directory,'.env'),'MYSQL_TRIAL_URL=mysql://legacy:legacy@wrong/legacy\nVITE_LABEL=legacy');
 fs.writeFileSync(path.join(directory,'.env.dev'),'PORTAL_ENV=dev\nMYSQL_TRIAL_URL=mysql://dev:synthetic@localhost/uper_local_crm\nVITE_LABEL=local');
 fs.writeFileSync(path.join(directory,'.env.test'),'PORTAL_ENV=test\nMYSQL_TRIAL_URL=mysql://trial:synthetic@mysql/uper_trial_home\nVITE_LABEL=cloud');
 const env={PATH:'/safe',MYSQL_TRIAL_URL:'mysql://stale:stale@wrong/stale',OPENAI_API_KEY:'synthetic-stale-secret',TRIAL_MODEL_STUB:'true',PORTAL_LOCAL_CUTOVER:'true'};
 loadPortalEnvironment({env,directory,target:'test'});
 assert.match(env.MYSQL_TRIAL_URL,/@mysql\/uper_trial_home$/);assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.TRIAL_MODEL_STUB,undefined);assert.equal(env.PORTAL_LOCAL_CUTOVER,undefined);assert.equal(env.PATH,'/safe');
 assert.deepEqual(frontendEnvironment('test',directory),{VITE_LABEL:'cloud'});
 assert.throws(()=>readEnvironment('prod',directory),/Missing/);
});
test('environment target errors and unprovisioned production fail before database access',t=>{
 const directory=fixture(t);assert.throws(()=>environmentName('production'),/dev, test or prod/);
 fs.writeFileSync(path.join(directory,'.env.test'),'PORTAL_ENV=dev');assert.throws(()=>readEnvironment('test',directory),/mismatch/);
 fs.writeFileSync(path.join(directory,'.env.prod'),'PORTAL_ENV=prod\nPORTAL_PRODUCTION_READY=false');
 assert.throws(()=>loadPortalEnvironment({env:{},directory,target:'prod'}),/not been provisioned/);
 assert.throws(()=>loadPortalEnvironment({env:{PORTAL_ENV:'test',PORTAL_ENV_SOURCE:'injected',PORTAL_PACKAGE_ENV:'prod'}}),/mismatch/);
});
test('frontend configuration excludes private values and rejects secret VITE names',t=>{
 const directory=fixture(t);fs.writeFileSync(path.join(directory,'.env.test'),'PORTAL_ENV=test\nOPENAI_API_KEY=synthetic-private\nMYSQL_TRIAL_URL=mysql://private\nVITE_UPER_MEASUREMENT_ID=TEST-PUBLIC');
 assert.deepEqual(frontendEnvironment('test',directory),{VITE_UPER_MEASUREMENT_ID:'TEST-PUBLIC'});
 fs.appendFileSync(path.join(directory,'.env.test'),'\nVITE_OPENAI_API_KEY=synthetic-private');assert.throws(()=>frontendEnvironment('test',directory),/Server credentials/);
});
test('injected container and isolated fixtures preserve supplied environment without local files',()=>{
 const env={PORTAL_ENV:'test',PORTAL_ENV_SOURCE:'injected',PORTAL_PACKAGE_ENV:'test',MYSQL_TRIAL_URL:'mysql://fixture'};
 assert.equal(loadPortalEnvironment({env,directory:'/nonexistent'}).injected,true);assert.equal(env.MYSQL_TRIAL_URL,'mysql://fixture');
 const legacy={MYSQL_TRIAL_URL:'mysql://fixture',APP_ENV:'test'};loadPortalEnvironment({env:legacy,directory:'/nonexistent'});assert.equal(legacy.MYSQL_TRIAL_URL,'mysql://fixture');
});
