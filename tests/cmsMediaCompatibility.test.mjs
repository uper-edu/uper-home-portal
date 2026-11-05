import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSite} from '../cloud/mysql/site.mjs';
import {cmsMediaUrl} from '../cloud/mysql/cms-media-storage.mjs';

async function readMedia(row,asset='a'.repeat(64)+'.webp'){
 const routes=new Map(),queries=[];
 const app={get(route,...handlers){routes.set(route,handlers);},post(){},delete(){},use(){}};
 const db={async execute(sql,args){queries.push({sql,args});if(sql.startsWith('INSERT INTO cms_collections'))return [{}];if(sql.startsWith('SELECT mime,content,cos_url FROM cms_media'))return [row?[row]:[]];throw Error('Unexpected query');}};
 await mountSite(app,{db,platform:{},mediaStorage:{}});
 const response={statusCode:200,headers:{},set(headers){Object.assign(this.headers,headers);return this;},status(status){this.statusCode=status;return this;},send(body){this.body=body;return this;},json(body){this.body=body;return this;},redirect(status,url){this.statusCode=status;this.location=url;return this;}};
 await routes.get('/images/uploads/:asset')[0]({params:{asset}},response);
 return {response,queries};
}
test('COS-MERGE-14: legacy BLOB URLs still return original bytes even with COS metadata',async()=>{
 const content=Buffer.from('legacy-image');
 const {response}=await readMedia({content,mime:'image/webp',cos_url:cmsMediaUrl('a'.repeat(64))});
 assert.equal(response.statusCode,200);assert.equal(response.body,content);assert.equal(response.location,undefined);
 const legacy=await readMedia({content,mime:'image/webp',cos_url:null},'old-name.webp');
 assert.ok(legacy.queries.some(q=>q.sql.includes('WHERE legacy_name=?')));assert.equal(legacy.response.body,content);
});
test('COS-MERGE-15: URL-only media redirects only to trusted permanent COS addresses',async()=>{
 const url=cmsMediaUrl('a'.repeat(64));
 const good=await readMedia({content:null,mime:'image/webp',cos_url:url});assert.equal(good.response.statusCode,302);assert.equal(good.response.location,url);
 for(const cos_url of [null,'https://invalid.example/image.webp',url+'?signature=temporary']){
  const bad=await readMedia({content:null,mime:'image/webp',cos_url});assert.equal(bad.response.statusCode,404);assert.equal(bad.response.location,undefined);
 }
 assert.equal((await readMedia(null)).response.statusCode,404);
});
