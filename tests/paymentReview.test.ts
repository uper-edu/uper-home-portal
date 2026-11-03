import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import sharp from 'sharp';
import {storePaymentImages,validatePaymentImages} from '../server/portal/paymentImages.ts';
import {reservePaymentReference} from '../server/portal/payments.ts';

test('stored receipt JPEG strips GPS EXIF, rotates pixels and describes stored bytes',async()=>{
 const original=await sharp({create:{width:24,height:12,channels:3,background:'white'}})
  .jpeg().withMetadata({orientation:6}).withExifMerge({IFD3:{GPSLatitudeRef:'N',GPSLatitude:'51/1 30/1 0/1'}}).toBuffer();
 const originalMetadata=await sharp(original).metadata();
 assert.equal(originalMetadata.orientation,6);
 assert.ok(originalMetadata.exif?.includes(Buffer.from([0x25,0x88])));
 const uploads=await validatePaymentImages([{name:'receipt.jpg',type:'image/jpeg',data:original.toString('base64')}]);
 let stored:Buffer|undefined;
 const [meta]=await storePaymentImages({query:async(_sql:string,values:any[])=>{stored=Buffer.from(values[8],'base64');}},'lead','finance','receipt',uploads);
 assert.ok(stored);
 const decoded=await sharp(stored).metadata();
 assert.equal(decoded.format,'jpeg');
 assert.equal(decoded.exif,undefined);
 assert.deepEqual([decoded.width,decoded.height],[12,24]);
 assert.equal(meta.bytes,stored.length);
 assert.equal(meta.sha256,createHash('sha256').update(stored).digest('hex'));
});

const legacy={method:'legacy transfer',account:' COMPANY-1 ',reference:' REF-1 '};
const modern={method:'bank_transfer',provider:'BCA',methodName:'',account:'company-1',reference:'ref-1'};
for(const [label,first,second,count] of [
 ['modern then legacy',modern,legacy,2],
 ['legacy then modern',legacy,modern,1],
] as const){
 test(label+' rejects duplicate verification across customers',async()=>{
  const reservations=new Set<string>();
  const db={query:async(_sql:string,[fingerprint]:string[])=>{
   if(reservations.has(fingerprint))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});
   reservations.add(fingerprint);
  }};
  await reservePaymentReference(db,'lead-a','receipt-a',first);
  assert.equal(reservations.size,count);
  await assert.rejects(reservePaymentReference(db,'lead-b','receipt-b',second),{message:'payment_duplicate_reference',status:409});
  assert.equal(reservations.size,count);
 });
}
