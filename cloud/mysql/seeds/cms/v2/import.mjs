import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readEnvironment} from '../../../../../server/environment.mjs';
import {openTrialDatabase,transaction} from '../../../database.mjs';
const root=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const bundle=await read('bundle.json');
const names=['admissionsList','campaigns','news','newsPage','partners','programGallery','studentStories','trendingPrograms'];
if(JSON.stringify(Object.keys(bundle.collections).sort())!==JSON.stringify(names))throw Error('Unexpected CMS collection set');
const media=new Map();
for(const {id,bytes} of bundle.media){
 if(!/^[a-f0-9]{64}$/.test(id)||media.has(id))throw Error('Invalid or duplicate media ID');
 const content=await fs.readFile(new URL('media/'+id+'.webp',root));
 if(content.length!==bytes||createHash('sha256').update(content).digest('hex')!==id)throw Error('Media checksum mismatch: '+id);
 media.set(id,content);
}
for(const [name,items] of Object.entries(bundle.collections)){
 if(!Array.isArray(items)||!items.length||items.some(x=>typeof x._id!=='string')||new Set(items.map(x=>x._id)).size!==items.length)throw Error('Invalid items: '+name);
 const text=JSON.stringify(items);
 if(/cdn\.sanity\.io\/images\/|"_ref":"image-/.test(text))throw Error('Remaining Sanity image dependency');
 for(const m of text.matchAll(/\/images\/uploads\/([a-f0-9]{64})\.webp/g))if(!media.has(m[1]))throw Error('Missing media: '+m[1]);
}
console.log({mode:process.argv[2]||'preview',...await read('preview.json')});
if(process.argv.length===2||process.argv[2]==='preview')process.exit(0);
if(process.argv[2]!=='import-empty'||process.argv.length!==3)throw Error('Use preview or import-empty');
const {values}=readEnvironment('dev');
if(values.TRIAL_DATASET!=='local-crm'||values.PORTAL_LOCAL_CUTOVER!=='true')throw Error('Only the approved local MySQL target is supported');
const db=await openTrialDatabase(values);
try{
 const outcome=await transaction(db,async c=>{
  const [rows]=await c.query('SELECT name,items,items_text FROM cms_collections WHERE name IN (?) ORDER BY name FOR UPDATE',[names]);
  if(rows.length!==names.length)throw Error('Initialize the CMS schema first');
  const current=new Map(rows.map(r=>[r.name,r.items_text!==null?JSON.parse(r.items_text):typeof r.items==='string'?JSON.parse(r.items):r.items]));
  const same=names.every(n=>JSON.stringify(current.get(n))===JSON.stringify(bundle.collections[n]));
  if(!same&&names.some(n=>!Array.isArray(current.get(n))||current.get(n).length))throw Error('Target contains CMS items; no overwrite or partial import');
  for(const [id,content] of media)await c.execute("INSERT INTO cms_media(id,mime,content,uploaded_by) VALUES(?,'image/webp',?,'cms-initialization') ON DUPLICATE KEY UPDATE id=id",[id,content]);
  if(!same)for(const n of names){
   const text=JSON.stringify(bundle.collections[n]);
   await c.execute('UPDATE cms_collections SET items=?,items_text=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE name=?',[text,text,n]);
  }
  return same?'already-initialized':'initialized';
 });
 console.log({outcome});
}finally{await db.end()}
