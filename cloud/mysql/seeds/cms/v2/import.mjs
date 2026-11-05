import fs from 'node:fs/promises';
import {readEnvironment} from '../../../../../server/environment.mjs';
import {openTrialDatabase,transaction} from '../../../database.mjs';
import {approvedRemoteDevelopment} from '../../../transport.mjs';
import {loadCmsSeed,cmsSeedRoot,cmsSeedNames,saveCmsMediaMetadata} from '../../../cms-seed.mjs';
import {verifyPublicCmsMedia} from '../../../cms-media-storage.mjs';
const mode=process.argv[2]||'preview';
if(!['preview','import-empty'].includes(mode)||process.argv.length>3)throw Error('Use preview or import-empty');
const {bundle,summary}=await loadCmsSeed();
const baseline=JSON.parse(await fs.readFile(new URL('preview.json',cmsSeedRoot),'utf8'));
if(JSON.stringify(summary)!==JSON.stringify(baseline))throw Error('CMS preview baseline differs from package');
console.log({mode,...summary});
if(mode==='preview')process.exit(0);
const {values}=readEnvironment('dev');
if(!(values.TRIAL_DATASET==='local-crm'&&values.PORTAL_LOCAL_CUTOVER==='true')&&!approvedRemoteDevelopment(values))throw Error('Only an approved development MySQL target is supported');
for(const item of bundle.media)await verifyPublicCmsMedia({url:item.url,digest:item.id,bytes:item.bytes});
const db=await openTrialDatabase(values);
try{
 const outcome=await transaction(db,async c=>{
  const [rows]=await c.query('SELECT name,items,items_text FROM cms_collections WHERE name IN (?) ORDER BY name FOR UPDATE',[cmsSeedNames]);
  if(rows.length!==cmsSeedNames.length)throw Error('Initialize the CMS schema first');
  const current=new Map(rows.map(r=>[r.name,r.items_text!==null?JSON.parse(r.items_text):typeof r.items==='string'?JSON.parse(r.items):r.items]));
  const same=cmsSeedNames.every(n=>JSON.stringify(current.get(n))===JSON.stringify(bundle.collections[n]));
  if(!same&&cmsSeedNames.some(n=>!Array.isArray(current.get(n))||current.get(n).length))throw Error('Target contains CMS items; no overwrite or partial import');
  for(const item of bundle.media)await saveCmsMediaMetadata(c,item);
  if(!same)for(const n of cmsSeedNames){
   const text=JSON.stringify(bundle.collections[n]);
   await c.execute('UPDATE cms_collections SET items=?,items_text=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE name=?',[text,text,n]);
  }
  return same?'already-initialized':'initialized';
 });
 console.log({outcome});
}finally{await db.end()}
