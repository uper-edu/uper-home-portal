import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {fingerprint} from './mysql-dump.mjs';

export function identityDifferences(accounts,snapshot){
 const discrepancies=[];
 for(const name of ['crm_users','access_roles','access_state']){
  const source=accounts[name],current=snapshot[name];
  if(!Array.isArray(source)||!source.length||!Array.isArray(current))throw Error('Missing identity data');
  if(source.length!==current.length)discrepancies.push({table:name,reason:'row-count',source:source.length,current:current.length});
  for(const row of source){
   const existing=current.find(x=>String(x.id)===String(row.id));
   if(!existing){discrepancies.push({table:name,reason:'missing-identity'});continue;}
   for(const [field,value] of Object.entries(row)){
    let expected=value,actual=existing[field];
    if(actual!==null&&typeof actual==='object'&&!Buffer.isBuffer(actual)&&typeof expected==='string'){try{expected=JSON.parse(expected);}catch{}}
    if(/(?:_at|expires_at)$/.test(field)&&typeof expected==='string'&&typeof actual==='string'){expected=expected.replace(/\.0+$/,'');actual=actual.replace(/\.0+$/,'');}
    if(typeof expected==='number'&&typeof actual==='string'&&String(expected)===actual)actual=expected;
    if(fingerprint(expected)!==fingerprint(actual))discrepancies.push({table:name,field,reason:'different-value'});
   }
  }
 }
 return discrepancies;
}

export function cmsChangeState(row,change){
 if(!row)return 'conflict';
 const current=row.items_text?JSON.parse(row.items_text):typeof row.items==='string'?JSON.parse(row.items):row.items;
 const revision=BigInt(row.revision),beforeRevision=BigInt(change.row.revision);
 if(revision===beforeRevision&&fingerprint(current)===fingerprint(change.before))return 'pending';
 if(revision===beforeRevision+1n&&fingerprint(current)===fingerprint(change.after))return 'applied';
 return 'conflict';
}

async function readExisting(file){try{return await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}

// Install a complete file without ever exposing partial bytes or replacing another artifact.
export async function writePrivateArtifact(file,value){
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(value),existing=await readExisting(file);
 if(existing){if(!existing.equals(bytes))throw Error('Existing artifact differs: '+path.basename(file));return;}
 await fs.mkdir(path.dirname(file),{recursive:true});
 const temporary=file+'.'+randomUUID()+'.tmp';
 await fs.writeFile(temporary,bytes,{flag:'wx',mode:0o600});
 try{try{await fs.link(temporary,file);}catch(error){if(error.code!=='EEXIST')throw error;const winner=await fs.readFile(file);if(!winner.equals(bytes))throw Error('Concurrent artifact conflict');}}
 finally{await fs.unlink(temporary);}
}

export async function replacePackageFile(file,value){
 const target=file instanceof URL?fileURLToPath(file):path.resolve(file);
 const original=await fs.readFile(target),temporary=target+'.'+randomUUID()+'.tmp';
 await fs.writeFile(temporary,value,{flag:'wx'});
 try{
  if(!(await fs.readFile(target)).equals(original))throw Error('Package changed while publishing');
  await fs.rename(temporary,target);
 }finally{await fs.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
