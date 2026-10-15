import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {build,transform} from 'esbuild';
import {environmentName,frontendEnvironment} from '../server/environment.mjs';
import {buildIdentity,sourceIdentity} from '../server/runtimeVersion.mjs';
export async function buildPortalPackage({environment='dev',directory}={}) {
const root=process.cwd();
const target=environmentName(environment);
const out=path.resolve(root,directory||path.join('build',target));
if(![path.join(root,'.local-backups')+path.sep,path.join(root,'build')+path.sep].some(p=>out.startsWith(p)))throw Error('Build output must be in an ignored build or local-backups directory');
await fs.mkdir(out,{recursive:true});
const identity=buildIdentity(target,root,frontendEnvironment(target));
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode',target,'--outDir',path.join(out,'web')],{stdio:'inherit',env:{...process.env,UPER_BUILD_IDENTITY:JSON.stringify(identity)}});
// Preserve ESM module boundaries: a single bundle changes import.meta.url and async cycle semantics.
const graph=await build({entryPoints:['server.ts','cloud/mysql/access-recovery.mjs','cloud/company-trial/maintenance.mjs','cloud/mysql/retire-test-policy.mjs'],outdir:path.join(out,'graph-only'),bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',write:false,metafile:true});
const inputs=Object.keys(graph.metafile.inputs);
const runtime=path.join(out,'runtime');await fs.rm(runtime,{recursive:true,force:true});await fs.mkdir(runtime,{recursive:true});
const compiled=f=>f.replace(/\.(ts|tsx|js)$/u,'.mjs');
for(const file of inputs){
 if(file.startsWith('node_modules/')||!(/^(server\.ts|server\/|cloud\/mysql\/|cloud\/company-trial\/|src\/)/.test(file)))throw Error('Unexpected runtime input: '+file);
 const dest=path.join(runtime,compiled(file));await fs.mkdir(path.dirname(dest),{recursive:true});
 if(file.endsWith('.json')){await fs.copyFile(file,dest);continue;}
 let source=await fs.readFile(file,'utf8');
 source=source.replace(/((?:from\s*|import\s*\(\s*|import\s*)["'])(\.[^"']+)(["'])/g,(all,prefix,spec,suffix)=>{
  const base=path.resolve(path.dirname(file),spec),resolved=inputs.find(f=>path.resolve(f)===base)||inputs.find(f=>path.resolve(f).replace(/\.(ts|tsx|mjs|js)$/,'')===base);
  if(!resolved)return all;
  let relative=path.relative(path.dirname(path.resolve(compiled(file))),path.resolve(compiled(resolved))).split(path.sep).join('/');if(!relative.startsWith('.'))relative='./'+relative;
  return prefix+relative+suffix;
 });
 const {code}=await transform(source,{loader:file.endsWith('.tsx')?'tsx':file.endsWith('.ts')?'ts':'js',format:'esm',target:'node24',jsx:'automatic',sourcemap:false});
 await fs.writeFile(dest,code.replace(/(\bfrom\s+["'][^"']+\.json["'])(?!\s+with\b)/g,'$1 with { type: "json" }'));
}
for(const f of ['schema.sql','schema-v2.sql'])await fs.copyFile('cloud/mysql/'+f,path.join(runtime,'cloud/mysql',f));
for(const f of ['package.json','package-lock.json'])await fs.copyFile(f,path.join(out,f));
const dockerfile=await fs.readFile('cloud/company-trial/Dockerfile','utf8');
await fs.writeFile(path.join(out,'Dockerfile'),dockerfile+'\nENV PORTAL_ENV='+target+' PORTAL_PACKAGE_ENV='+target+' PORTAL_ENV_SOURCE=injected\n');
// Remove stale artifacts from a previous one-file packaging experiment.
for(const f of ['server.mjs','schema.sql','schema-v2.sql'])await fs.rm(path.join(out,f),{force:true});
const forbidden=[];
async function walk(dir){for(const f of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.name.startsWith('.env')||['.git','node_modules','.local-backups'].includes(f.name)||p===path.join(out,'data')||/\.(ts|tsx|map)$/.test(f.name))forbidden.push(p);if(f.isDirectory())await walk(p);}}
await walk(out);if(forbidden.length)throw Error('Forbidden deployment payload entries: '+forbidden.join(','));
const after=sourceIdentity(root);if(after.sourceDigest!==identity.sourceDigest||after.gitCommit!==identity.gitCommit||after.dirty!==identity.dirty)throw Error('Source changed during build; rebuild before release');
await fs.writeFile(path.join(runtime,'portal-build.json'),JSON.stringify(identity,null,2));
await fs.writeFile(path.join(out,'web/portal-build.json'),JSON.stringify(identity,null,2));
const metadata={...identity,gitCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),environment:target,envFile:'.env.'+target,deployed:false,compiledModules:inputs.length};
await fs.writeFile(path.join(out,'.uper-release.json'),JSON.stringify(metadata,null,2));
console.log(JSON.stringify({packageReady:true,...metadata,directory:out}));
return {directory:out,...metadata};
}
