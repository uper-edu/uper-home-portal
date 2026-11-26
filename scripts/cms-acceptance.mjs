import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {portalWorkerEnabled,readEnvironment} from '../server/environment.mjs';
import {approvedRemoteDevelopment} from '../cloud/mysql/transport.mjs';
import {openTrialDatabase} from '../cloud/mysql/database.mjs';
import {cmsMediaUrl,mediaDigest} from '../cloud/mysql/cms-media-storage.mjs';
import {writePrivateArtifact} from './lib/bootstrap-safety.mjs';

export async function finalizeCmsAcceptance(report,{logout,persist}){
 let failure;
 if(logout){
  try{
   const result=await logout();report.logoutStatus=result.response.status;
   if(report.logoutStatus!==200)throw Error('CMS logout failed: HTTP '+report.logoutStatus);
  }catch(error){report.passed=false;report.logoutFailure=error.message;failure=error;}
 }
 await persist(report);
 if(failure)throw failure;
}

export async function acceptCms({credentials,image,output}){
 const {values}=readEnvironment('dev');
 if(!approvedRemoteDevelopment(values)||values.PORT!=='3000'||portalWorkerEnabled(values))throw Error('Approved dev3000 without a notification worker required');
 const account=JSON.parse(await fs.readFile(credentials,'utf8'));
 if(!account.loginId.startsWith('cms-cos-qa-'))throw Error('Dedicated authorized acceptance account required');
 const report={target:'http://localhost:3000',scenarios:[]};
 let cookie;
 const call=async(route,{method='GET',body,origin='http://localhost:3000',authenticated=true}={})=>{
  const response=await fetch(report.target+route,{method,redirect:'error',signal:AbortSignal.timeout(120000),headers:{...(authenticated&&cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data;try{data=await response.json();}catch{data=null;}
  return {response,data};
 };
 const check=(name,actual,expected)=>{assert.equal(actual,expected,name);report.scenarios.push({name,actual,expected,passed:true});};
 try{
  const health=await call('/api/health',{authenticated:false});check('Local3000 health',health.response.status,200);check('Development runtime',health.data.environment,'dev');
  const login=await call('/api/crm/auth/login',{method:'POST',body:account,authenticated:false});check('Real staff password login',login.response.status,200);
  const header=login.response.headers.getSetCookie().find(x=>x.startsWith('uper_crm_session_3000='));assert.ok(header,'Real server session cookie required');cookie=header.split(';')[0];
  const identity=await call('/api/cms/identity');check('CMS identity',identity.data.id,account.loginId);
  const collections={news:20,newsPage:7,partners:54,trendingPrograms:8,studentStories:5,campaigns:2,admissionsList:1,programGallery:10};
  for(const [name,count] of Object.entries(collections)){const result=await call('/api/cms/content/'+name);check('Read '+name,result.response.status,200);check('Count '+name,result.data.items.length,count);}
  const admin=await call('/api/admin/access/lark-bindings');check('CMS-only account cannot read access management',admin.response.status,403);
  const content=await fs.readFile(image),data='data:image/png;base64,'+content.toString('base64'),requestId='cms-cos-acceptance-'+randomUUID();
  const uploaded=await call('/api/cms/upload',{method:'POST',body:{data,requestId}});check('Actual image upload',uploaded.response.status,200);
  const expected=await sharp(content,{limitInputPixels:16000000}).rotate().webp({quality:85}).toBuffer();check('Permanent URL digest',uploaded.data.url,cmsMediaUrl(mediaDigest(expected)));
  const repeated=await call('/api/cms/upload',{method:'POST',body:{data,requestId}});check('Repeat request status',repeated.response.status,200);assert.deepEqual(repeated.data,uploaded.data);report.scenarios.push({name:'Repeat request returns identical result',passed:true});
  const operation=await call('/api/cms/operations/'+requestId+'?kind=upload');check('Committed upload result query',operation.data.state,'committed');assert.deepEqual(operation.data.result,uploaded.data);
  const changed=await sharp({create:{width:8,height:8,channels:3,background:'#c026d3'}}).png().toBuffer();
  const conflict=await call('/api/cms/upload',{method:'POST',body:{data:'data:image/png;base64,'+changed.toString('base64'),requestId}});check('Request ID conflict',conflict.response.status,409);
  const wrongOrigin=await call('/api/cms/upload',{method:'POST',origin:'https://invalid.example',body:{data,requestId:'bad-origin-'+randomUUID()}});check('Cross-origin upload rejected',wrongOrigin.response.status,403);
  const anonymous=await call('/api/cms/upload',{method:'POST',authenticated:false,body:{data,requestId:'anonymous-'+randomUUID()}});check('Anonymous upload rejected',anonymous.response.status,401);
  const bad=await call('/api/cms/upload',{method:'POST',body:{data:'data:image/png;base64,bm90LWFuLWltYWdl',requestId:'bad-image-'+randomUUID()}});check('Invalid image rejected',bad.response.status,400);
  const huge=await call('/api/cms/upload',{method:'POST',body:{data:'data:image/png;base64,'+Buffer.alloc(2097153).toString('base64'),requestId:'too-large-'+randomUUID()}});check('Image above 2 MiB rejected',huge.response.status,413);
  const gallery=await call('/api/cms/content/programGallery');const test=gallery.data.items.find(x=>x.title==='CMS COS 临时验收 20261104 已编辑');assert.ok(test,'Browser-created test record required');
  const malicious=await call('/api/cms/content/programGallery',{method:'POST',body:{requestId:'invalid-url-'+randomUUID(),item:{...test,image:{url:'https://invalid.example/image.webp'}}}});check('Untrusted gallery URL rejected',malicious.response.status,400);
  const stale=await call('/api/cms/content/programGallery',{method:'POST',body:{requestId:'stale-version-'+randomUUID(),item:{...test,_cmsVersion:Number(test._cmsVersion)-1}}});check('Stale edit rejected',stale.response.status,409);
  const after=await call('/api/cms/content/programGallery');assert.deepEqual(after.data.items.find(x=>x._id===test._id),test);report.scenarios.push({name:'Rejected writes preserve saved content',passed:true});
  const db=await openTrialDatabase(values);try{
   const [audits]=await db.execute("SELECT COUNT(*) AS total FROM portal_audit WHERE actor=? AND action='cms.upload' AND data->>'$.requestId'=?",[account.loginId,requestId]);check('One upload audit for idempotent request',Number(audits[0].total),1);
   const [media]=await db.execute('SELECT storage_type,cos_url,content IS NULL AS noBlob FROM cms_media WHERE id=?',[uploaded.data.digest]);check('URL-only database storage',Number(media[0].noBlob),1);check('Database COS URL matches response',media[0].cos_url,uploaded.data.url);
  }finally{await db.end();}
  report.upload={requestId,url:uploaded.data.url,digest:uploaded.data.digest};report.passed=true;
 }catch(error){report.passed=false;report.failure=error.message;throw error;}
 finally{
  await finalizeCmsAcceptance(report,{
   logout:cookie?()=>call('/api/crm/auth/logout',{method:'POST',body:{}}):undefined,
   persist:result=>writePrivateArtifact(output,JSON.stringify(result,null,2)),
  });
 }
 console.log(JSON.stringify({passed:report.passed,scenarios:report.scenarios.length,receipt:output}));
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [credentials,image,output]=process.argv.slice(2);if(!output)throw Error('Usage: cms-acceptance.mjs PRIVATE_QA_CREDENTIALS QA_PNG PRIVATE_RECEIPT');
 acceptCms({credentials,image,output}).catch(error=>{console.error(JSON.stringify({error:'CMS_ACCEPTANCE_FAILED',message:error.message}));process.exitCode=1;});
}
