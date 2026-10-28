import test from 'node:test';import assert from 'node:assert/strict';import {frontendCacheControl,frontendStaticOptions} from '../server/staticCache';import{mountMetadataHeaders}from'../server/siteMetadata';
const immutable='public, max-age=31536000, immutable';
test('Vite hashed public resources are immutable, unversioned public files require revalidation',()=>{
 for(const f of ['assets/index-C4nLjRUs.js','assets/vendor-ui-Cpbcv5MD.js','assets/index-BBfucEee.css','assets/font-12345678.woff2','assets\\photo-Abc_d-12.webp'])assert.equal(frontendCacheControl(f),immutable);
 for(const f of ['images/logo.png','images/photo.jpg','favicon.svg','assets/main.js','assets/style.css','robots.txt','sitemap.xml'])assert.equal(frontendCacheControl(f),'public, no-cache');
});
test('HTML, runtime metadata, service workers and unknown files never gain public caching',()=>{
 for(const f of ['index.html','assets/index-12345678.html','portal-build.json','assets/profile-12345678.json','manifest.webmanifest','service-worker.js','sw.js','assets/main-12345678.js.map','exports/private.csv','../private.png','assets/../../private.js'])assert.equal(frontendCacheControl(f),'private, no-store');
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
