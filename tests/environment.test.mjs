import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {environmentName,readEnvironment,frontendEnvironment,loadPortalEnvironment,portalWorkerEnabled} from '../server/environment.mjs';
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
 const directory=fixture(t);fs.writeFileSync(path.join(directory,'.env.test'),'PORTAL_ENV=test\nOPENAI_API_KEY=synthetic-private\nMYSQL_TRIAL_URL=mysql://private\nVITE_TEST_PUBLIC=TEST-PUBLIC');
 assert.deepEqual(frontendEnvironment('test',directory),{VITE_TEST_PUBLIC:'TEST-PUBLIC'});
 fs.appendFileSync(path.join(directory,'.env.test'),'\nVITE_OPENAI_API_KEY=synthetic-private');assert.throws(()=>frontendEnvironment('test',directory),/Server credentials/);
});
test('injected container and isolated fixtures preserve supplied environment without local files',()=>{
 const env={PORTAL_ENV:'test',PORTAL_ENV_SOURCE:'injected',PORTAL_PACKAGE_ENV:'test',MYSQL_TRIAL_URL:'mysql://fixture'};
 assert.equal(loadPortalEnvironment({env,directory:'/nonexistent'}).injected,true);assert.equal(env.MYSQL_TRIAL_URL,'mysql://fixture');
 const legacy={MYSQL_TRIAL_URL:'mysql://fixture',APP_ENV:'test'};loadPortalEnvironment({env:legacy,directory:'/nonexistent'});assert.equal(legacy.MYSQL_TRIAL_URL,'mysql://fixture');
});

test('normal environments default to running the worker and honor an explicit pause',()=>{
 const environments=[
  {TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true'},
  {PORTAL_DEPLOYMENT:'company-trial',PORTAL_ENV:'test',TRIAL_DATASET:'synthetic'},
  {PORTAL_DEPLOYMENT:'production',PORTAL_ENV:'prod',TRIAL_DATASET:'synthetic'},
 ];
 for(const env of environments){
  assert.equal(portalWorkerEnabled(env),true);
  assert.equal(portalWorkerEnabled({...env,PORTAL_WORKER_ENABLED:'false'}),false);
  assert.throws(()=>portalWorkerEnabled({...env,PORTAL_WORKER_ENABLED:''}),/must be true or false/);
 }
});
test('remote development cannot start a worker and standalone fixtures still opt in',()=>{
 const remote={PORTAL_DEPLOYMENT:'remote-dev',PORTAL_ENV:'dev',TRIAL_DATASET:'synthetic'};
 assert.equal(portalWorkerEnabled(remote),false);
 assert.equal(portalWorkerEnabled({...remote,PORTAL_WORKER_ENABLED:'false'}),false);
 assert.throws(()=>portalWorkerEnabled({...remote,PORTAL_WORKER_ENABLED:'true'}),/Remote development/);
 assert.equal(portalWorkerEnabled({TRIAL_DATASET:'synthetic'}),false);
 assert.equal(portalWorkerEnabled({TRIAL_DATASET:'synthetic',PORTAL_WORKER_ENABLED:'true'}),true);
});

test('explicit environment preparation creates only the selected file and preserves existing values', t => {
  const directory = fixture(t);
  const command = fileURLToPath(new URL('../scripts/prepare-environment.mjs', import.meta.url));
  const targetDirectory = path.join(directory, 'config');
  fs.mkdirSync(targetDirectory);
  for (const target of ['dev', 'test', 'prod']) {
    fs.writeFileSync(path.join(directory, '.env.' + target + '.example'),
      'PORTAL_ENV=' + target + '\nOPENAI_API_KEY=\nPORTAL_WORKER_ENABLED=true\nOPENAI_MODEL=example-model\n');
  }
  const prepare = target => JSON.parse(execFileSync(process.execPath, [command, target, targetDirectory],
    {cwd: directory, encoding: 'utf8'}));
  const testFile = path.join(targetDirectory, '.env.test');
  const devFile = path.join(targetDirectory, '.env.dev');
  const prodFile = path.join(targetDirectory, '.env.prod');
  const devContents = 'PORTAL_ENV=dev\nOPENAI_API_KEY=fixture-dev\n';
  fs.writeFileSync(devFile, devContents);
  assert.equal(prepare('test').created, true);
  assert.equal(fs.statSync(testFile).mode & 0o777, 0o600);
  assert.equal(readEnvironment('test', targetDirectory).values.OPENAI_API_KEY, '');
  assert.equal(fs.readFileSync(devFile, 'utf8'), devContents);
  assert.equal(fs.existsSync(prodFile), false);

  const existing = 'PORTAL_ENV=test\nOPENAI_API_KEY="fixture#key"\nPORTAL_WORKER_ENABLED=\n';
  fs.writeFileSync(testFile, existing);
  assert.deepEqual(prepare('test'), {environment: 'test', created: false, added: ['OPENAI_MODEL']});
  const updated = fs.readFileSync(testFile, 'utf8');
  assert.ok(updated.startsWith(existing));
  const {values} = readEnvironment('test', targetDirectory);
  assert.equal(values.OPENAI_API_KEY, 'fixture#key');
  assert.equal(values.PORTAL_WORKER_ENABLED, '');
  assert.equal(values.OPENAI_MODEL, 'example-model');
  const modified = fs.statSync(testFile).mtimeMs;
  assert.deepEqual(prepare('test'), {environment: 'test', created: false, added: []});
  assert.equal(fs.readFileSync(testFile, 'utf8'), updated);
  assert.equal(fs.statSync(testFile).mtimeMs, modified);
  assert.equal(fs.readFileSync(devFile, 'utf8'), devContents);
  assert.equal(fs.existsSync(prodFile), false);
});

test('UPER_PORTAL names load for local files and injected environments', t => {
 const directory=fixture(t);
 fs.writeFileSync(path.join(directory,'.env.dev'),'UPER_PORTAL_ENV=dev\nUPER_PORTAL_LOCAL_CUTOVER=true\nUPER_PORTAL_WORKER_ENABLED=false\nTRIAL_DATASET=local-crm');
 const env={UPER_PORTAL_PUBLIC_ORIGIN:'stale'};
 assert.equal(loadPortalEnvironment({env,directory,target:'dev'}).target,'dev');
 assert.equal(env.PORTAL_PUBLIC_ORIGIN,undefined);
 assert.equal(env.UPER_PORTAL_PUBLIC_ORIGIN,undefined);
 assert.equal(env.PORTAL_LOCAL_CUTOVER,'true');
 assert.equal(env.PORTAL_DATABASE_DRIVER,'mysql');
 assert.equal(portalWorkerEnabled(env),false);

 const injected={UPER_PORTAL_ENV:'test',UPER_PORTAL_ENV_SOURCE:'injected',PORTAL_PACKAGE_ENV:'test'};
 assert.equal(loadPortalEnvironment({env:injected}).target,'test');
 assert.equal(injected.PORTAL_DATABASE_DRIVER,'mysql');
 assert.throws(()=>loadPortalEnvironment({env:{...injected,UPER_PORTAL_ENV:'prod'}}),/Conflicting environment settings/);
 assert.throws(()=>loadPortalEnvironment({env:{...injected,PORTAL_DATABASE_DRIVER:'sqlite'}}),/Only MySQL/);
 fs.appendFileSync(path.join(directory,'.env.dev'),'\nUPER_PORTAL_DATABASE_DRIVER=sqlite');
 assert.throws(()=>readEnvironment('dev',directory),/Only MySQL/);
});

test('development template preparation recognizes already configured legacy names', t => {
 const directory=fixture(t);
 fs.writeFileSync(path.join(directory,'.env.dev.example'),'UPER_PORTAL_ENV=dev\nUPER_PORTAL_PUBLIC_ORIGIN=https://example.invalid\nUPER_PORTAL_WORKER_ENABLED=false\n');
 const existing='PORTAL_ENV=dev\nPORTAL_PUBLIC_ORIGIN=http://localhost:3000\n';
 fs.writeFileSync(path.join(directory,'.env.dev'),existing);
 const command=fileURLToPath(new URL('../scripts/prepare-environment.mjs',import.meta.url));
 const result=JSON.parse(execFileSync(process.execPath,[command,'dev'],{cwd:directory,encoding:'utf8'}));
 assert.deepEqual(result.added,['UPER_PORTAL_WORKER_ENABLED']);
 assert.equal(readEnvironment('dev',directory).values.PORTAL_PUBLIC_ORIGIN,'http://localhost:3000');
 assert.equal(readEnvironment('dev',directory).values.PORTAL_WORKER_ENABLED,'false');
});
