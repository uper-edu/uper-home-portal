import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import {createCmsMediaStorage,cmsMediaUrl,mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';
import {loadCmsSeed,cmsSeedRoot,mapSeedMedia} from '../cloud/mysql/cms-seed.mjs';
import {replacePackageFile,writePrivateArtifact} from './lib/bootstrap-safety.mjs';
import {fingerprint} from './lib/mysql-dump.mjs';

export async function publishCmsSeed({credentials,receipt,root=cmsSeedRoot,storageFactory=createCmsMediaStorage}){
 const env=dotenv.parse(await fs.readFile(credentials));
 const {bundle,media,summary}=await loadCmsSeed({root,requireCos:false});
 const storage=storageFactory({env});
 await fs.mkdir(path.dirname(receipt),{recursive:true});
 const progress=receipt+'.progress.jsonl',completed=[];
 // The append-only receipt contains public identifiers only; interrupted runs can resume.
 let previous='';try{previous=await fs.readFile(progress,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 const complete=previous.endsWith('\n')?previous:previous.slice(0,previous.lastIndexOf('\n')+1);
 const saved=new Map(complete.split('\n').filter(Boolean).map(line=>{const row=JSON.parse(line);return [row.id,row];}));
 // A torn final append is unconfirmed work. Preserve all complete rows and reverify the rest.
 if(complete!==previous)await replacePackageFile(progress,complete);
 const pending=bundle.media.filter(item=>{
  const row=saved.get(item.id);
  if(row&&row.url===cmsMediaUrl(item.id)&&row.bytes===item.bytes){completed.push(row);return false;}return true;
 });
 let cursor=0,failed;
 await Promise.all(Array.from({length:4},async()=>{
  while(!failed&&cursor<pending.length){const item=pending[cursor++];
   try{
    const result=await storage.upload(media.get(item.id));
    const row={id:item.id,url:result.url,bytes:result.size};
    await fs.appendFile(progress,JSON.stringify(row)+'\n',{mode:0o600});completed.push(row);
    if(completed.length%20===0||completed.length===bundle.media.length)console.log(JSON.stringify({verified:completed.length,total:bundle.media.length}));
   }catch(error){failed=error;}
  }
 }));
 if(failed)throw failed;
 completed.sort((a,b)=>a.id.localeCompare(b.id));
 let evidence;try{evidence=JSON.parse(await fs.readFile(receipt,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(evidence&&fingerprint({summary:evidence.summary,resources:evidence.resources})!==fingerprint({summary,resources:completed}))throw Error('Existing publish receipt does not match this package');
 evidence??={verifiedAt:new Date().toISOString(),summary,resources:completed};
 bundle.collections=mapSeedMedia(bundle.collections,media);
 bundle.media=bundle.media.map(item=>({...item,url:cmsMediaUrl(item.id),objectKey:'cms/'+item.id+'.webp'}));
 await replacePackageFile(new URL('bundle.json',root),JSON.stringify(bundle,null,2)+'\n');
 await replacePackageFile(new URL('preview.json',root),JSON.stringify(summary,null,2)+'\n');
 await refreshChecksums(root);
 await writePrivateArtifact(receipt,JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({published:completed.length,receipt,rewritten:true}));
}
export async function refreshChecksums(root=cmsSeedRoot){
 const names=['README.md','bundle.json','import.mjs','preview.json'];
 for(const name of (await fs.readdir(new URL('media/',root))).sort())if(name.endsWith('.webp'))names.push('media/'+name);
 const lines=[];
 for(const name of names){
  const file=new URL(name,root);let bytes=await fs.readFile(file);
  if(!name.startsWith('media/')){
   const normalized=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
   if(!bytes.equals(normalized)){await replacePackageFile(file,normalized);bytes=normalized;}
  }
  lines.push(mediaDigest(bytes)+'  '+name);
 }
 await replacePackageFile(new URL('SHA256SUMS',root),lines.join('\n')+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [credentials,receipt]=process.argv.slice(2);
 if(!credentials||!receipt)throw Error('Usage: cms-seed-publish.mjs PRIVATE_ENV NEW_RECEIPT_PATH');
 publishCmsSeed({credentials,receipt}).catch(e=>{console.error(JSON.stringify({error:'CMS_PUBLISH_FAILED',message:e.message}));process.exitCode=1;});
}
