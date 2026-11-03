import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {MAX_PAYMENT_IMAGES,MAX_PAYMENT_IMAGE_BYTES,MAX_PAYMENT_IMAGE_TOTAL,paymentImageTypes,type PaymentImage,type PaymentImageUpload} from '../../src/utils/crmPaymentMethods.ts';
import {invalid} from './trustWorkflow.ts';
export async function validatePaymentImages(raw:unknown){
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>MAX_PAYMENT_IMAGES)invalid('payment_images_limit');
 let total=0,storedTotal=0;const hashes=new Set<string>(),result:Array<{meta:PaymentImage;data:string}>=[];
 for(const value of raw){
  if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['name','type','data'].includes(k))||typeof value.name!=='string'||value.name.length>240||!paymentImageTypes.includes(value.type)||typeof value.data!=='string'||value.data.length>Math.ceil(MAX_PAYMENT_IMAGE_BYTES/3)*4||!value.data.length||value.data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.data))invalid('payment_image_invalid');
  const file=value as PaymentImageUpload,bytes=Buffer.from(file.data,'base64');total+=bytes.length;
  if(!bytes.length||bytes.length>MAX_PAYMENT_IMAGE_BYTES||total>MAX_PAYMENT_IMAGE_TOTAL)invalid('payment_images_limit');
  if(bytes.toString('base64')!==file.data)invalid('payment_image_invalid');
  let encoded:Buffer;
  try {
   const image=sharp(bytes,{limitInputPixels:25000000,failOn:'warning'});
   const {format,width,height,pages}=await image.metadata();
   const mime=format==='jpeg'?'image/jpeg':format==='png'?'image/png':format==='webp'?'image/webp':null;
   if(mime!==file.type||!width||!height||(pages||1)>1)invalid('payment_image_invalid');
   // Sharp strips metadata by default. Apply EXIF orientation before stripping it.
   encoded=await image.rotate().toFormat(format as 'jpeg'|'png'|'webp').toBuffer();
  } catch {
   invalid('payment_image_invalid');
  }
  storedTotal+=encoded.length;
  if(encoded.length>MAX_PAYMENT_IMAGE_BYTES||storedTotal>MAX_PAYMENT_IMAGE_TOTAL)invalid('payment_images_limit');
  const sha256=createHash('sha256').update(encoded).digest('hex');if(hashes.has(sha256))invalid('payment_image_duplicate');hashes.add(sha256);
  const name=(file.name.split(/[\\/]/).pop()||'receipt').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,160)||'receipt';
  result.push({meta:{id:randomUUID(),name,mime:file.type,bytes:encoded.length,sha256},data:encoded.toString('base64')});
 }
 return result;
}
export async function storePaymentImages(c:any,leadId:string,actorId:string,entryId:string,uploads:Awaited<ReturnType<typeof validatePaymentImages>>){
 for(const {meta,data} of uploads)await c.query('INSERT INTO crm_payment_images(id,lead_id,entry_id,created_by,name,mime,bytes,sha256,content) VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,FROM_BASE64(:p9))',[meta.id,leadId,entryId,actorId,meta.name,meta.mime,meta.bytes,meta.sha256,data]);
 return uploads.map(u=>u.meta);
}
