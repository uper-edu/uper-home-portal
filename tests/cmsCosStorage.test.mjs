import test from 'node:test';
import assert from 'node:assert/strict';
import {createCmsMediaStorage,cmsMediaUrl,mediaDigest,trustedCmsMediaUrl,validCmsImageUrl,verifyPublicCmsMedia} from '../cloud/mysql/cms-media-storage.mjs';
import {mapSeedMedia,seedBusinessContent} from '../cloud/mysql/cms-seed.mjs';
import {splitSql,parseInsert,withoutForeignKeys} from '../scripts/lib/mysql-dump.mjs';
const bytes=Buffer.from('test-webp-bytes'),digest=mediaDigest(bytes),url=cmsMediaUrl(digest);

test('COS-03: permanent URL validation rejects suffixes, alternate hosts and signed URLs',()=>{
 assert.equal(trustedCmsMediaUrl(url),true);assert.equal(validCmsImageUrl('/images/uploads/'+digest+'.webp'),true);
 for(const value of [url+'?token=secret',url+'#fragment',url.replace('.myqcloud.com/','.myqcloud.com.evil/'),url.replace('/cms/','/cms/../'),url.replace('https:','http:'),null])assert.equal(trustedCmsMediaUrl(value),false);
});

test('COS-04: new object uses guarded write, digest metadata and public verification',async()=>{
 let writes=0,verified=0;
 const client={getObject(_p,cb){cb({statusCode:404});},putObject(p,cb){writes++;assert.equal(p.Headers['x-cos-forbid-overwrite'],'true');assert.equal(p.Headers['x-cos-meta-sha256'],digest);assert.equal(p.ContentType,'image/webp');assert.deepEqual(p.Body,bytes);cb(null,{});}};
 const storage=createCmsMediaStorage({client,verify:async value=>{verified++;assert.equal(value.url,url);}});
 assert.deepEqual(await storage.upload(bytes),{url,digest,mime:'image/webp',size:bytes.length,objectKey:'cms/'+digest+'.webp'});
 assert.equal(writes,1);assert.equal(verified,1);
});

test('COS-05: existing content is verified and never overwritten',async()=>{
 const storage=createCmsMediaStorage({client:{getObject(_p,cb){cb(null,{Body:bytes});},putObject(){assert.fail('Unexpected write');}},verify:async()=>true});
 assert.equal((await storage.upload(bytes)).url,url);
 const bad=createCmsMediaStorage({client:{getObject(_p,cb){cb(null,{Body:Buffer.from('wrong')});}},verify:async()=>true});
 await assert.rejects(bad.upload(bytes),/verification failed/);
});

test('COS-06: upload errors are redacted and never return success',async()=>{
 const storage=createCmsMediaStorage({client:{getObject(_p,cb){cb({statusCode:404});},putObject(_p,cb){cb({statusCode:403,message:'SECRET'});}}});
 await assert.rejects(storage.upload(bytes),error=>error.message==='CMS object upload failed');
});

test('COS-07: concurrent creation checks the winning object before success',async()=>{
 let reads=0;
 const storage=createCmsMediaStorage({client:{getObject(_p,cb){reads++;reads===1?cb({statusCode:404}):cb(null,{Body:bytes});},putObject(_p,cb){cb({statusCode:409});}},verify:async()=>true});
 assert.equal((await storage.upload(bytes)).digest,digest);assert.equal(reads,2);
});

test('COS-08: anonymous verification checks bytes, digest and status',async()=>{
 const object={url,digest,bytes:bytes.length};
 assert.equal(await verifyPublicCmsMedia(object,async()=>new Response(bytes)),true);
 await assert.rejects(verifyPublicCmsMedia(object,async()=>new Response('wrong')),/checksum/);
 await assert.rejects(verifyPublicCmsMedia(object,async()=>new Response(null,{status:403})),/publicly readable/);
});

test('COS-09: media conversion preserves content and edit metadata',()=>{
 const before=[{_id:'one',title:'unchanged',_cmsVersion:3,_updatedAt:'2026-11-04',image:{url:'/images/uploads/'+digest+'.webp'}}];
 const after=mapSeedMedia(before,new Map([[digest,bytes]]));
 assert.equal(after[0].image.url,url);assert.equal(after[0].title,'unchanged');assert.equal(after[0]._cmsVersion,3);
 assert.deepEqual(seedBusinessContent(before),[{_id:'one',title:'unchanged',image:before[0].image}]);
 assert.throws(()=>mapSeedMedia(before,new Map()),/Unlisted/);
});

test('COS-10: SQL parser preserves escaped literals and rejects expressions',()=>{
 const sql="-- comment\nINSERT INTO `users` (`id`,`value`) VALUES ('a','semi;colon'),\n('b','it\\'s'),('c',NULL); /* comment */ SET NAMES utf8mb4;";
 const statements=splitSql(sql);assert.equal(statements.length,2);
 assert.deepEqual(parseInsert(statements[0]).rows,[{id:'a',value:'semi;colon'},{id:'b',value:"it's"},{id:'c',value:null}]);
 assert.throws(()=>parseInsert("INSERT INTO `users` (`id`) VALUES (NOW())"),/expression/);
 assert.throws(()=>splitSql("INSERT INTO x VALUES ('bad"),/Incomplete/);
 const ddl='CREATE TABLE `a` (\n `id` int,\n KEY `parent` (`id`),\n CONSTRAINT `fk` FOREIGN KEY (`id`) REFERENCES `b` (`id`)\n) ENGINE=InnoDB';
 assert.doesNotMatch(withoutForeignKeys(ddl),/FOREIGN KEY|REFERENCES|,\s*\)/);
 assert.match(withoutForeignKeys(ddl),/KEY `parent`/);
});
