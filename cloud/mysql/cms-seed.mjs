import fs from 'node:fs/promises';
import {cmsMediaUrl,mediaDigest,trustedCmsMediaUrl} from './cms-media-storage.mjs';

export const cmsSeedNames=['admissionsList','campaigns','news','newsPage','partners','programGallery','studentStories','trendingPrograms'];
export const cmsSeedRoot=new URL('./seeds/cms/v2/',import.meta.url);
export function mapSeedMedia(value,ids){
 if(typeof value==='string')return value.replace(/\/images\/uploads\/([a-f0-9]{64})\.webp/g,(url,id)=>{
  if(!ids.has(id))throw Error('Unlisted seed media reference');return cmsMediaUrl(id);
 });
 if(Array.isArray(value))return value.map(x=>mapSeedMedia(x,ids));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,mapSeedMedia(v,ids)]));
 return value;
}
export function seedBusinessContent(items){
 return items.map(item=>{const {_updatedAt,_cmsVersion,...content}=item;return content;});
}
export async function loadCmsSeed({root=cmsSeedRoot,requireCos=true}={}){
 const bundle=JSON.parse(await fs.readFile(new URL('bundle.json',root),'utf8'));
 if(JSON.stringify(Object.keys(bundle.collections).sort())!==JSON.stringify(cmsSeedNames))throw Error('Unexpected CMS collection set');
 const media=new Map();
 for(const item of bundle.media){
  if(!/^[a-f0-9]{64}$/.test(item.id)||media.has(item.id))throw Error('Invalid or duplicate media ID');
  const content=await fs.readFile(new URL('media/'+item.id+'.webp',root));
  if(content.length!==item.bytes||mediaDigest(content)!==item.id)throw Error('Media checksum mismatch');
  if(requireCos&&(item.url!==cmsMediaUrl(item.id)||item.objectKey!=='cms/'+item.id+'.webp'))throw Error('Invalid seed COS metadata');
  media.set(item.id,content);
 }
 for(const [name,items] of Object.entries(bundle.collections)){
  if(!Array.isArray(items)||!items.length||items.some(x=>typeof x._id!=='string')||new Set(items.map(x=>x._id)).size!==items.length)throw Error('Invalid items: '+name);
  const text=JSON.stringify(items);
  if(/cdn\.sanity\.io\/images\/|"_ref":"image-/.test(text))throw Error('Remaining Sanity image dependency');
  for(const match of text.matchAll(/\/images\/uploads\/([a-f0-9]{64})\.webp/g))if(requireCos||!media.has(match[1]))throw Error('Unexpected local seed media');
  for(const match of text.matchAll(/https:\/\/[^"\s]+\.myqcloud\.com\/cms\/[^"\s]+/g)){
   if(!trustedCmsMediaUrl(match[0])||!media.has(match[0].slice(-69,-5)))throw Error('Unlisted COS media');
  }
 }
 const collections=Object.fromEntries(Object.entries(bundle.collections).map(([name,items])=>[name,items.length]));
 const programGallery=Object.fromEntries(['hsk','csca','consultancy','tours'].map(program=>[program,bundle.collections.programGallery.filter(x=>x.program===program).length]));
 return {bundle,media,summary:{collections,content:Object.values(collections).reduce((sum,n)=>sum+n,0),media:media.size,bytes:[...media.values()].reduce((sum,b)=>sum+b.length,0),programGallery}};
}
export async function saveCmsMediaMetadata(c,item,actor='cms-initialization'){
 if(item.url!==cmsMediaUrl(item.id)||item.objectKey!=='cms/'+item.id+'.webp')throw Error('Invalid seed metadata');
 await c.execute("INSERT INTO cms_media(id,mime,content,uploaded_by,storage_type,cos_url,object_key,byte_size) VALUES(?,'image/webp',NULL,?,'cos',?,?,?) ON DUPLICATE KEY UPDATE storage_type='cos',cos_url=VALUES(cos_url),object_key=VALUES(object_key),byte_size=VALUES(byte_size)",[item.id,actor,item.url,item.objectKey,item.bytes]);
}
