import test from 'node:test';import assert from 'node:assert/strict';import {frontendCacheControl,frontendStaticCompression,frontendStaticOptions} from '../server/staticCache';import{mountMetadataHeaders,mountMetadataHtml}from'../server/siteMetadata';
import express from 'express';
import {once} from 'node:events';
import {get} from 'node:http';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const immutable='public, max-age=31536000, immutable';
test('Vite hashed public resources are immutable, unversioned public files require revalidation',()=>{
 for(const f of ['assets/index-C4nLjRUs.js','assets/vendor-ui-Cpbcv5MD.js','assets/index-BBfucEee.css','assets/font-12345678.woff2','assets\\photo-Abc_d-12.webp'])assert.equal(frontendCacheControl(f),immutable);
 for(const f of ['images/logo.png','images/photo.jpg','favicon.svg','assets/main.js','assets/style.css','robots.txt','sitemap.xml','link-assets/uper-handbook-2026.pdf'])assert.equal(frontendCacheControl(f),'public, no-cache');
});

test('public landing HTML and versioned assets compress while the handbook revalidates with its ETag',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'uper-static-'));
 const body='/* public fixture */\n'.repeat(512);
 let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
 try{
  await mkdir(join(dir,'assets'));
  await mkdir(join(dir,'link-assets'));
  await writeFile(join(dir,'index.html'),'<html lang="id"><!-- UPER_METADATA_START --><!-- UPER_METADATA_END -->'+body+'</html>');
  await writeFile(join(dir,'link-assets','uper-handbook-2026.pdf'),body);
  for(const file of ['index-12345678.js','index-12345678.mjs','index-12345678.css','service-worker.js','config-12345678.json']){
   await writeFile(join(dir,'assets',file),body);
  }
  const app=express();
  app.get('/api/fixture',(_request,response)=>response.type('js').send(body));
  app.use(frontendStaticCompression);
  app.use(express.static(dir,frontendStaticOptions(dir)));
  mountMetadataHtml(app,dir,{execute:()=>assert.fail('Unexpected public landing database read')});
  server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const address=server.address();
  assert.ok(address&&typeof address==='object');
  const read=(path:string,headers:Record<string,string>)=>fetch(`http://127.0.0.1:${address.port}${path}`,{headers});
  for(const ext of ['js','mjs','css']){
   const target='/assets/index-12345678.'+ext;
   for(const encoding of ['br','gzip','identity']){
    const response=await read(target,{'Accept-Encoding':encoding});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-encoding'),encoding==='identity'?null:encoding);
    assert.equal(response.headers.get('vary'),'Accept-Encoding');
    assert.equal(response.headers.get('cache-control'),immutable);
    assert.equal(await response.text(),body);
   }
   const partial=await read(target,{'Accept-Encoding':'br',Range:'bytes=0-15'});
   assert.equal(partial.status,206);
   assert.equal(partial.headers.get('content-encoding'),null);
   assert.equal(await partial.text(),body.slice(0,16));
  }
  for(const target of ['/api/fixture','/assets/service-worker.js','/assets/config-12345678.json']){
   const response=await read(target,{'Accept-Encoding':'br'});
   assert.equal(response.headers.get('content-encoding'),null);
   await response.arrayBuffer();
  }
  for(const landing of ['/enrollment','/chat','/link']){
   const plain=await read(landing+'?lang=zh',{'Accept-Encoding':'identity'});
   const packed=await read(landing+'?lang=zh',{'Accept-Encoding':'gzip'});
   assert.equal(packed.status,200);
   assert.equal(packed.headers.get('content-encoding'),'gzip');
   assert.equal(packed.headers.get('vary'),'Accept-Encoding');
   assert.equal(packed.headers.get('cache-control'),'private, no-store');
   assert.equal(await packed.text(),await plain.text());
  }
  const privatePage=await read('/crm?lang=zh',{'Accept-Encoding':'gzip'});
  assert.equal(privatePage.headers.get('content-encoding'),null);
  await privatePage.arrayBuffer();
  const handbook='/link-assets/uper-handbook-2026.pdf';
  const first=await read(handbook,{});
  const etag=first.headers.get('etag');
  assert.equal(first.headers.get('cache-control'),'public, no-cache');
  assert.equal(await first.text(),body);
  assert.ok(etag);
  // Fetch may add request no-cache headers for a manually supplied conditional.
  const conditional=async()=>{
   const response=await new Promise<import('node:http').IncomingMessage>((resolve,reject)=>{
    get(`http://127.0.0.1:${address.port}${handbook}`,{headers:{'If-None-Match':etag}},resolve).on('error',reject);
   });
   response.setEncoding('utf8');
   let text='';
   for await(const part of response)text+=part;
   return {status:response.statusCode,text};
  };
  assert.deepEqual(await conditional(),{status:304,text:''});
  const range=await read(handbook,{Range:'bytes=0-15'});
  assert.equal(range.status,206);
  assert.equal(await range.text(),body.slice(0,16));
  await writeFile(join(dir,'link-assets','uper-handbook-2026.pdf'),body+'updated');
  assert.deepEqual(await conditional(),{status:200,text:body+'updated'});
 }finally{
  server?.closeAllConnections();
  if(server?.listening)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));
  await rm(dir,{recursive:true,force:true});
 }
});
test('HTML, runtime metadata, service workers and unknown files never gain public caching',()=>{
 for(const f of ['index.html','assets/index-12345678.html','portal-build.json','assets/profile-12345678.json','manifest.webmanifest','service-worker.js','sw.js','assets/main-12345678.js.map','exports/private.csv','exports/private.pdf','link-assets/other.pdf','../private.png','assets/../../private.js'])assert.equal(frontendCacheControl(f),'private, no-store');
});
test('company indexing default remains, actual public file overrides only its cache header',()=>{
 const old=process.env.PORTAL_DEPLOYMENT;process.env.PORTAL_DEPLOYMENT='company-trial';
 try{let middleware:any;mountMetadataHeaders({use:(f:any)=>{middleware=f}} as any);
 const headers:Record<string,string>={};const response:any={setHeader:(k:string,v:string)=>{headers[k]=v}};
 middleware({path:'/assets/index-C4nLjRUs.js'},response,()=>{});assert.equal(headers['Cache-Control'],'private, no-store');
 const options=frontendStaticOptions('/test/web');options.setHeaders(response,'/test/web/assets/index-C4nLjRUs.js');assert.equal(headers['Cache-Control'],immutable);assert.equal(headers['X-Robots-Tag'],'noindex, nofollow, noarchive');assert.equal(options.cacheControl,false);assert.equal(options.etag,true);assert.equal(options.lastModified,true);
 options.setHeaders(response,'/test/web/index.html');assert.equal(headers['Cache-Control'],'private, no-store');
 const apiHeaders:Record<string,string>={'Cache-Control':'private, no-store'};middleware({path:'/api/crm/leads'},{setHeader:(k:string,v:string)=>{apiHeaders[k]=v}},()=>{});assert.equal(apiHeaders['Cache-Control'],'private, no-store');
 }finally{if(old===undefined)delete process.env.PORTAL_DEPLOYMENT;else process.env.PORTAL_DEPLOYMENT=old;}
});
