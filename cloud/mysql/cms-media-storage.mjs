import {createHash} from 'node:crypto';

export const CMS_COS_BUCKET='uper-portal-public-20261104191752-1433456541';
export const CMS_COS_REGION='ap-jakarta';
const hashPattern=/^[a-f0-9]{64}$/;
export const mediaDigest=content=>createHash('sha256').update(content).digest('hex');

export function cmsMediaConfiguration(env=process.env){
 const bucket=env.PORTAL_COS_BUCKET||CMS_COS_BUCKET,region=env.PORTAL_COS_REGION||CMS_COS_REGION;
 const prefix=env.PORTAL_COS_PREFIX||'cms/';
 if(bucket!==CMS_COS_BUCKET||region!==CMS_COS_REGION||prefix!=='cms/')throw Error('Unapproved CMS object storage target');
 return {bucket,region,prefix,baseUrl:`https://${bucket}.cos.${region}.myqcloud.com/${prefix}`};
}
export function cmsMediaUrl(digest,env=process.env){
 if(!hashPattern.test(digest))throw Error('Invalid CMS media digest');
 return cmsMediaConfiguration(env).baseUrl+digest+'.webp';
}
export function trustedCmsMediaUrl(value,env=process.env){
 if(typeof value!=='string')return false;
 const base=cmsMediaConfiguration(env).baseUrl;
 return value.startsWith(base)&&/^[a-f0-9]{64}\.webp$/.test(value.slice(base.length));
}
export function validCmsImageUrl(value,env=process.env){
 return typeof value==='string'&&(/^\/images\/uploads\/[a-f0-9]{64}\.webp$/.test(value)||trustedCmsMediaUrl(value,env));
}

export async function verifyPublicCmsMedia({url,digest,bytes},fetcher=fetch){
 if(!trustedCmsMediaUrl(url)||url!==cmsMediaUrl(digest))throw Error('Untrusted CMS media URL');
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
   if(response.status>=500){await response.body?.cancel();throw Object.assign(Error('CMS public service unavailable'),{retryable:true});}
   if(!response.ok){await response.body?.cancel();throw Error('CMS media is not publicly readable');}
   if(Number(response.headers.get('content-length')||bytes)>bytes){await response.body?.cancel();throw Error('CMS media length mismatch');}
   const content=Buffer.from(await response.arrayBuffer());
   if(content.length!==bytes||mediaDigest(content)!==digest)throw Error('CMS public media checksum mismatch');
   return true;
  }catch(error){
   if(attempt===2||!(error.retryable||['TimeoutError','AbortError','TypeError'].includes(error.name)))throw error;
   await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
  }
 }
 throw Error('CMS public verification failed');
}

export function createCmsMediaStorage({env=process.env,client,verify=verifyPublicCmsMedia}={}){
 let sdk=client;
 const getClient=async()=>{
  if(sdk)return sdk;
  if(!env.PORTAL_COS_SECRET_ID||!env.PORTAL_COS_SECRET_KEY)throw Error('CMS object storage credentials are missing');
  const {default:COS}=await import('cos-nodejs-sdk-v5');
  sdk=new COS({SecretId:env.PORTAL_COS_SECRET_ID,SecretKey:env.PORTAL_COS_SECRET_KEY,
   ...(env.PORTAL_COS_SECURITY_TOKEN?{SecurityToken:env.PORTAL_COS_SECURITY_TOKEN}:{}),
   Protocol:'https:',Timeout:30000,MaxRetryTimes:2});
  return sdk;
 };
 const invoke=async(method,parameters)=>{
  const sdkClient=await getClient();
  return new Promise((resolve,reject)=>sdkClient[method](parameters,(error,result)=>error?reject(error):resolve(result)));
 };
 return {
  async upload(content){
   if(!Buffer.isBuffer(content)||!content.length)throw Error('CMS media bytes required');
   const digest=mediaDigest(content),{bucket,region,prefix}=cmsMediaConfiguration(env);
   const objectKey=prefix+digest+'.webp',url=cmsMediaUrl(digest,env),parameters={Bucket:bucket,Region:region,Key:objectKey};
   const checkExisting=async()=>{
    const result=await invoke('getObject',parameters);
    const body=Buffer.isBuffer(result.Body)?result.Body:Buffer.from(result.Body);
    if(body.length!==content.length||mediaDigest(body)!==digest)throw Error('CMS object checksum conflict');
   };
   try{await checkExisting();}catch(error){
    if(error.statusCode!==404)throw Error('CMS object verification failed');
    try{await invoke('putObject',{...parameters,Body:content,ContentLength:content.length,ContentType:'image/webp',
      CacheControl:'public, max-age=31536000, immutable',Headers:{'x-cos-forbid-overwrite':'true','x-cos-meta-sha256':digest}});
    }catch(error){
     if(error.statusCode!==409&&error.statusCode!==412)throw Error('CMS object upload failed');
     await checkExisting();
    }
   }
   await verify({url,digest,bytes:content.length});
   return {url,digest,mime:'image/webp',size:content.length,objectKey};
  }
 };
}
