import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {Request, Response} from 'express';
import {isEnrollmentProofAmount,proofTransferDetails} from '../server/portal/enrollmentProofTotals';
import {
  enrollmentProofAccept,
  enrollmentProofFileIssue,
  enrollmentProofSelectionIssue,
  enrollmentProofUploadTimeout,
  matchesEnrollmentProofSignature,
  maxEnrollmentProofBytes,
  prepareEnrollmentProofFile,
} from '../src/utils/enrollmentProofFile';

test('new proofs require a valid whole-rupiah amount and accept an absent reference', () => {
  for(const amount of [undefined,null,0,-1,1.5,'160000',NaN,Infinity,1_000_000_001]){
    assert.equal(isEnrollmentProofAmount(amount),false);
  }
  for(const amount of [1,160000,1_000_000_000]){
    assert.equal(isEnrollmentProofAmount(amount),true);
  }
  assert.deepEqual(proofTransferDetails(160000,undefined),{amount:160000,reference:undefined});
  assert.equal(proofTransferDetails(undefined,undefined),null);
});

test('proof upload keeps the normal deadline for small files and budgets for slow uploads at the size limit', () => {
  assert.equal(enrollmentProofUploadTimeout(64 * 1024, 'binary-v1'), 90_000);
  assert.equal(enrollmentProofUploadTimeout(64 * 1024), 90_000);
  assert.equal(enrollmentProofUploadTimeout(maxEnrollmentProofBytes, 'binary-v1'), 146_072);
  assert.equal(enrollmentProofUploadTimeout(maxEnrollmentProofBytes), 189_763);
});

test('enrollment proof preflight matches the server size and format rules', () => {
  assert.equal(enrollmentProofAccept, 'image/png,image/jpeg,application/pdf');
  assert.equal(enrollmentProofFileIssue(maxEnrollmentProofBytes, 'image/png'), undefined);
  assert.equal(enrollmentProofFileIssue(maxEnrollmentProofBytes + 1, 'image/png'), 'too_large');
  assert.equal(enrollmentProofFileIssue(15, 'image/png'), 'invalid');
  assert.equal(enrollmentProofFileIssue(16, ''), 'invalid');
  assert.equal(enrollmentProofFileIssue(16, 'image/gif'), 'invalid');

  for (const [mime, header] of [
    ['image/png', '89504e470d0a1a0a'],
    ['image/jpeg', 'ffd8ff'],
    ['application/pdf', '255044462d'],
  ]) {
    assert.equal(enrollmentProofFileIssue(16, mime), undefined);
    const bytes=Buffer.from(header, 'hex');
    assert.equal(matchesEnrollmentProofSignature(bytes, mime), true);
    assert.equal(matchesEnrollmentProofSignature(bytes.subarray(0, 2), mime), false);
    assert.equal(matchesEnrollmentProofSignature(bytes, 'image/gif'), false);
  }
  assert.equal(matchesEnrollmentProofSignature(Buffer.from('255044462d', 'hex'), 'image/png'), false);
});

test('the browser resolves a missing or generic file type from bytes before opening an upload',async()=>{
  const bytes=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(16)]);
  for(const type of ['','application/octet-stream']){
    const file=new File([bytes],'bank-proof.png',{type,lastModified:123});
    assert.equal(enrollmentProofSelectionIssue(file),undefined);
    const prepared=await prepareEnrollmentProofFile(file);
    assert.equal(prepared?.type,'image/png');
    assert.equal(prepared?.name,file.name);
    assert.equal(prepared?.lastModified,file.lastModified);
    assert.deepEqual(Buffer.from(await prepared!.arrayBuffer()),bytes);
  }
  const typed=new File([bytes],'bank-proof.png',{type:'image/png'});
  assert.equal(await prepareEnrollmentProofFile(typed),typed);
  assert.equal(await prepareEnrollmentProofFile(new File([bytes],'bank-proof.pdf',{type:'application/pdf'})),undefined);
  assert.equal(await prepareEnrollmentProofFile(new File([Buffer.alloc(32)],'bank-proof.png')),undefined);
  assert.equal(enrollmentProofSelectionIssue({size:maxEnrollmentProofBytes+1,type:''}),'too_large');
});

test('raw and legacy upload bodies produce identical proof bytes, digest and transfer metadata', async () => {
  await import('./helpers/mockPortalDatabase.mjs');
  const {proofContent,readProofSubmission}=await import('../server/portal/enrollmentApplication.ts');
  const bytes=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(24,0x80)]);
  const mime='image/png';
  const metadata={uploadId:'db464a5a-5e2c-4bcb-a385-b07808649b7a',reportedAmount:920000,bankReference:'TRF-测试'};
  const response={} as Response;
  const binary=(content:Buffer,type:string,header=encodeURIComponent(JSON.stringify(metadata)))=>Object.assign(Readable.from([content]),{
    headers:{'content-type':type,'content-length':String(content.length)},
    get:(key:string)=>key==='X-Enrollment-Proof'?header:undefined,
    is:(types:string[])=>types.includes(type)?type:false,
  }) as unknown as Request;
  const raw=await readProofSubmission(binary(bytes,mime),response);
  const legacy=await readProofSubmission({get:()=>undefined,body:{...metadata,mime,encoded:bytes.toString('base64')}} as unknown as Request,response);
  assert.deepEqual(raw,{...metadata,mime,content:bytes});
  assert.deepEqual(proofContent(raw.content,raw.mime),proofContent(legacy.content,legacy.mime));
  assert.throws(()=>proofContent(bytes,'image/jpeg'),/enrollment_invalid_proof/);
  assert.throws(()=>proofContent(legacy.content+'=',mime),/enrollment_invalid_proof/);
  const oversized=await readProofSubmission(binary(Buffer.alloc(maxEnrollmentProofBytes+1),mime),response);
  assert.throws(()=>proofContent(oversized.content,oversized.mime),/enrollment_invalid_proof/);
  const unsupported=await readProofSubmission(binary(bytes,'image/gif'),response);
  assert.throws(()=>proofContent(unsupported.content,unsupported.mime),/enrollment_invalid_proof/);
  await assert.rejects(readProofSubmission(binary(bytes,mime,'%'),response),/enrollment_invalid_proof/);
});

test('the browser sends the file bytes and the expected email with raw upload metadata', async t => {
  const {postEnrollmentProof}=await import('../src/services/enrollmentSession.ts');
  const file=new File([Buffer.alloc(32,0x80)],'fixture.png',{type:'image/png'});
  const metadata={uploadId:'fixture',reportedAmount:920000,bankReference:'TRF-测试'};
  t.mock.method(globalThis,'fetch',async (_url:string,init:RequestInit)=>{
    assert.equal(init.body,file);
    const headers=new Headers(init.headers);
    assert.equal(headers.get('Content-Type'),file.type);
    assert.equal(headers.get('X-Enrollment-Email'),'fixture@example.invalid');
    assert.deepEqual(JSON.parse(decodeURIComponent(headers.get('X-Enrollment-Proof')!)),metadata);
    return Response.json({status:'proof_review'});
  });
  assert.deepEqual(await postEnrollmentProof('/api/enrollment/orders/fixture/proofs/finish',file,metadata,
    'fixture@example.invalid',AbortSignal.timeout(1000)),{status:'proof_review'});
});

test('proof retry checks the old receipt under the order lock before replacing an expired upload',async t=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentApplication}=await import('../server/portal/enrollmentApplication.ts');
  const {operationContext}=await import('../server/portal/operationContext.ts');
  const env=process.env;
  const origin='https://enrollment.example.invalid';
  process.env={...env,PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial',PORTAL_ENROLLMENT_SERVICE_ENABLED:'true',
    PORTAL_PUBLIC_ORIGIN:origin,ACCESS_ALLOWED_ORIGINS:''};
  t.after(()=>{process.env=env;});
  const orderId='00000000-0000-4000-8000-000000000001',oldId='00000000-0000-4000-8000-000000000002';
  const email='proof-learner@example.invalid',other='other-learner@example.invalid',classId='fixture-class';
  const order={id:orderId,class_id:classId,email,state:'awaiting_payment',price:1000000,received:0,
    payment_due_at:'2027-01-09 09:00:00',data:{}};
  let verified=email,receipt=false,uploadId=oldId,uploadActive=false,beforeDue=true;
  const operations:string[]=[];
  const client={transactionIsolation:'READ COMMITTED',query:async(sql:string,args:unknown[])=>{
    if(sql.includes('enrollment_mail_configuration'))return {rows:[]};
    if(sql.includes('FROM enrollment_email_sessions'))return {rows:[{email:verified}]};
    if(sql.startsWith('SELECT o.*, b.state')){
      assert.deepEqual(args,[orderId,verified,oldId]);
      return {rows:verified===email?[{...order,class_state:'published',saved_proof:receipt?oldId:null,
        upload_active:uploadId===oldId&&uploadActive?1:0}]:[]};
    }
    if(sql.startsWith('SELECT id,class_id,email FROM enrollment_orders'))return {rows:[order]};
    if(sql.includes('FROM enrollment_classes WHERE id=:p1 FOR UPDATE'))return {rows:[{id:classId,state:'published'}]};
    if(sql.startsWith("UPDATE enrollment_orders SET state='expired'"))return {rows:[]};
    if(sql.includes('FROM enrollment_orders WHERE id=:p1 FOR UPDATE')){
      operations.push('lock order');
      return {rows:[{...order,upload_id:uploadId,upload_active:uploadActive?1:0,before_due:beforeDue?1:0}]};
    }
    if(sql.startsWith('SELECT id FROM enrollment_proofs')){
      operations.push('check receipt');
      assert.deepEqual(args,[oldId,orderId]);
      return {rows:receipt?[{id:oldId}]:[]};
    }
    if(sql.startsWith('SELECT order_id FROM enrollment_proofs')){
      operations.push('check saved proof');
      assert.deepEqual(args,[oldId]);
      return {rows:receipt?[{order_id:orderId}]:[]};
    }
    if(sql.startsWith('UPDATE enrollment_orders SET upload_id')){
      operations.push('reserve');
      assert.equal(args[1],orderId);
      uploadId=String(args[0]);
      uploadActive=true;
      return {rows:[]};
    }
    if(sql.startsWith('UPDATE enrollment_orders SET upload_expires_at')){
      operations.push('refresh');
      assert.deepEqual(args,[orderId,oldId]);
      assert.match(sql,/upload_expires_at<UTC_TIMESTAMP\(6\)\+INTERVAL 190 SECOND/);
      assert.match(sql,/payment_due_at>=UTC_TIMESTAMP\(6\)/);
      return {rows:[]};
    }
    assert.fail('Unexpected proof query: '+sql);
  }};
  type Handler=(q:Request,r:Response)=>Promise<unknown>;
  const routes=new Map<string,Handler>();
  const add=(method:string)=>(path:string,handler:Handler)=>routes.set(method+' '+path,handler);
  const unexpected=async()=>assert.fail('Proof recovery uses only the verified enrollment session');
  const path='/api/enrollment/orders/:id/proofs';
  const invoke=async(route:string,body:unknown={previousUploadId:oldId})=>{
    let result:unknown;
    await routes.get(route)!({headers:{cookie:'uper_enrollment_session='+'a'.repeat(64),origin},
      params:{id:orderId,uploadId:oldId},body,protocol:'https',
      is:()=>true,get:(name:string)=>name==='host'?'enrollment.example.invalid':name==='X-Enrollment-Email'?verified:undefined,
    } as unknown as Request,{
      set(){return this;},json(body:unknown){result=body;},
    } as unknown as Response);
    return result;
  };
  await operationContext.run(client,async()=>{
    mountEnrollmentApplication({post:add('POST'),get:add('GET')} as never,{wrap:handler=>handler,staff:unexpected,visitor:unexpected});
    const check='GET '+path+'/:uploadId/result',restart='POST '+path+'/start';
    assert.deepEqual(await invoke(check),{state:'unconfirmed',proofTransport:'binary-v1',uploadActive:false});
    receipt=true;
    const saved=await invoke(restart) as {state:string;order:{id:string};uploadId?:string};
    assert.deepEqual([saved.state,saved.order.id,saved.uploadId],['saved',orderId,undefined]);
    assert.deepEqual(operations.splice(0),['lock order','check receipt']);

    receipt=false;
    const fresh=await invoke(restart) as {uploadId:string;transport:string};
    assert.notEqual(fresh.uploadId,oldId);
    assert.equal(fresh.transport,'binary-v1');
    assert.deepEqual(operations.splice(0),['lock order','check receipt','reserve']);
    assert.deepEqual(await invoke(restart),fresh);
    assert.deepEqual(operations.splice(0),['lock order','check receipt']);

    uploadId=oldId;
    assert.deepEqual(await invoke(restart),{uploadId:oldId,transport:'binary-v1'});
    assert.deepEqual(operations.splice(0),['lock order','check receipt','refresh']);
    beforeDue=false;
    assert.deepEqual(await invoke(restart),{uploadId:oldId,transport:'binary-v1'});
    assert.deepEqual(operations.splice(0),['lock order','check receipt']);

    const finish='POST '+path+'/finish';
    const proof={uploadId:oldId,mime:'application/pdf',encoded:'unused'};
    for(const reportedAmount of [undefined,0,1.5,'160000']){
      await assert.rejects(invoke(finish,{...proof,reportedAmount}),{message:'enrollment_invalid_proof_amount'});
      assert.deepEqual(operations.splice(0),['lock order','check saved proof']);
    }
    assert.deepEqual(await invoke(check),{state:'unconfirmed',proofTransport:'binary-v1',uploadActive:true});
    receipt=true;
    assert.equal((await invoke(finish,proof) as {id:string}).id,orderId);
    assert.deepEqual(operations.splice(0),['lock order','check saved proof']);

    verified=other;
    await assert.rejects(invoke(restart),{status:404,message:'enrollment_order_not_found'});
    await assert.rejects(invoke(check),{status:404,message:'enrollment_order_not_found'});
    assert.deepEqual(operations,[]);
  });
});
