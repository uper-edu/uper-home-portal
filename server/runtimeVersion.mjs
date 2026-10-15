import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function runtimeEnvironment(env=process.env){
 if(['dev','test','prod'].includes(env.PORTAL_ENV))return env.PORTAL_ENV;
 if(env.PORTAL_DEPLOYMENT==='company-trial'||env.APP_ENV==='test')return 'test';
 if(env.APP_ENV==='local'||env.PORTAL_LOCAL_CUTOVER==='true')return 'dev';
 return 'unknown';
}
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
export function sourceIdentity(root=process.cwd()){
 const paths=[];function visit(relative){const file=path.join(root,relative);if(!fs.existsSync(file))return;const stat=fs.lstatSync(file);if(stat.isSymbolicLink())return;if(stat.isDirectory()){for(const name of fs.readdirSync(file).sort())if(!name.startsWith('.')&&!['node_modules','data','build','dist'].includes(name))visit(path.posix.join(relative,name));}else if(!path.basename(relative).startsWith('.env')&&!relative.endsWith('.md'))paths.push(relative);}
 for(const entry of ['src','server','public','cloud/mysql','cloud/company-trial','scripts','server.ts','index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json'])visit(entry);paths.sort();
 const hash=crypto.createHash('sha256');for(const name of paths){const file=path.join(root,name);hash.update(name+'\0');if(fs.existsSync(file)&&fs.statSync(file).isFile())hash.update(fs.readFileSync(file));else hash.update('deleted');hash.update('\0');}
 return {gitCommit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['-C',root,'status','--porcelain'],{encoding:'utf8'}).trim(),sourceDigest:hash.digest('hex')};
}
export function buildIdentity(environment,root=process.cwd(),publicConfig={}){
 const source=sourceIdentity(root),publicConfigDigest=sha(JSON.stringify(Object.fromEntries(Object.entries(publicConfig).sort())));
 return {schema:1,...source,environment,publicConfigDigest,buildId:source.gitCommit.slice(0,12)+'-'+sha(source.sourceDigest+environment+publicConfigDigest).slice(0,16),builtAt:new Date().toISOString()};
}
export function validBuildIdentity(value){
 return value?.schema===1&&/^[a-f0-9]{40}$/.test(value.gitCommit)&&typeof value.dirty==='boolean'&&/^[a-f0-9]{64}$/.test(value.sourceDigest)&&/^[a-f0-9]{64}$/.test(value.publicConfigDigest)&&/^[a-f0-9]{12}-[a-f0-9]{16}$/.test(value.buildId)&&['dev','test','prod'].includes(value.environment)&&Number.isFinite(Date.parse(value.builtAt));
}
export function publicBuildIdentity(v){if(!validBuildIdentity(v))throw Error('Invalid build identity');return Object.fromEntries(['schema','gitCommit','dirty','sourceDigest','publicConfigDigest','environment','buildId','builtAt'].map(k=>[k,v[k]]));}
export function readBuildIdentity(file){return publicBuildIdentity(JSON.parse(fs.readFileSync(file,'utf8')));}
export function createRuntimeVersion({env=process.env,root=fileURLToPath(new URL('../',import.meta.url)),frontend=env.TRIAL_FRONTEND_DIRECTORY}={}){
 const packaged=fs.existsSync(path.join(root,'portal-build.json'));let backend;
 if(packaged){backend=readBuildIdentity(path.join(root,'portal-build.json'));if(backend.environment!==runtimeEnvironment(env))throw Error('Build and runtime environment mismatch');}
 else{try{backend={...sourceIdentity(root),buildId:null,builtAt:null,environment:runtimeEnvironment(env)};}catch{backend={gitCommit:null,dirty:null,sourceDigest:null,buildId:null,builtAt:null,environment:runtimeEnvironment(env)};}}
 let browser=null;try{browser=readBuildIdentity(path.resolve(frontend,'portal-build.json'));}catch{if(packaged)throw Error('Missing or invalid frontend build identity');}
 if(packaged&&browser.buildId!==backend.buildId)throw Error('Frontend and backend build mismatch');
 // Never accept a path/URL/secret from a deployment environment variable as version metadata.
 return Object.freeze({environment:runtimeEnvironment(env),mode:packaged?'package':'source',backend,frontend:browser,consistent:packaged?true:null});
}
export function mountRuntimeVersion(app,version){
 app.use((_q,r,next)=>{r.set('X-UPER-Environment',version.environment);r.set('X-UPER-Build',version.backend.buildId||'source-unversioned');next();});
 app.get('/api/version',(_q,r)=>{r.set('Cache-Control','no-store');r.json(version);});
}
