import assert from 'node:assert/strict';
import test from 'node:test';
import {selectVisitorScope} from '../src/services/visitorScope.ts';
import {enrollmentCodeInput,readEnrollmentEmailAddress,readEnrollmentEmailVerification,readEnrollmentOperation,readEnrollmentOrderResponse,readEnrollmentOrdersResponse,recoverEnrollmentOperation,requestEnrollmentEmailCode,signOutEnrollmentEmail,submitEnrollmentInterest,verifyEnrollmentEmail} from '../src/services/enrollmentSession.ts';
import {readEnrollmentDraft,readVisitorContact,writeEnrollmentDraft} from '../src/services/visitorContact.ts';
import {rememberVisitorContact} from '../src/services/rememberVisitorContact.ts';
import {readPendingDemand,sameDemandDraft,submitPendingDemand,type PendingDemand} from '../src/services/enrollmentDemandSubmission.ts';
import {enrollmentVisitorDigest,readEnrollmentSessionDigest,readEnrollmentEmailSession,revokeEnrollmentEmailSession} from '../server/portal/enrollmentVisitorSession.ts';

test('the same visitor can resume an in-flight code send without sending another email',async t=>{
  selectVisitorScope('code-owner');
  t.after(()=>selectVisitorScope(''));
  const pending:Array<(response:Response)=>void>=[];
  const fetcher=t.mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>pending.push(resolve)));
  const sent=requestEnrollmentEmailCode('learner@example.invalid','zh','apply');
  const resumed=requestEnrollmentEmailCode(' Learner@example.invalid ','zh','apply');
  const otherAddress=requestEnrollmentEmailCode('another@example.invalid','zh','apply');
  const otherPurpose=requestEnrollmentEmailCode('learner@example.invalid','zh','mine');
  const requests=fetcher.mock.callCount();
  for(const [i,finish] of pending.entries())finish(Response.json({challengeId:'challenge-'+i}));
  const ids=await Promise.all([sent,resumed,otherAddress,otherPurpose]);
  assert.equal(requests,3);
  assert.deepEqual(ids,['challenge-0','challenge-0','challenge-1','challenge-2']);
  const resend=requestEnrollmentEmailCode('learner@example.invalid','zh','apply');
  pending.at(-1)!(Response.json({challengeId:'new-challenge'}));
  assert.equal(await resend,'new-challenge');
  assert.equal(fetcher.mock.callCount(),4);
});

test('receipt recovery only reads the original request and stops after reconnect, expiry, or cleanup',async t=>{
  const browser=new EventTarget();
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{
    if(descriptor)Object.defineProperty(globalThis,'window',descriptor);
    else Reflect.deleteProperty(globalThis,'window');
  });
  const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
  const online=()=>browser.dispatchEvent(new Event('online'));
  const path='/api/enrollment/applications/results/original';
  const email='learner@example.invalid';
  let reply=Response.json({}, {status:503});
  let delayed:Promise<Response>|undefined;
  const request=t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
    assert.equal(url,path);
    assert.equal(options.method,undefined);
    assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),email);
    return delayed??reply;
  });
  const results:string[]=[];
  const checking:boolean[]=[];
  const start=(waitForConnection:boolean)=>recoverEnrollmentOperation({path,email,waitForConnection,isCurrent:()=>true,
    matchesOrder:(order:{id:string})=>order.id==='original',
    onResult:result=>results.push(result.state),onVerificationRequired:()=>results.push('expired'),
    onChecking:value=>checking.push(value)});
  let stop=start(true);
  assert.equal(request.mock.callCount(),0);
  assert.deepEqual(checking,[]);
  online();
  await tick();
  online();
  assert.equal(request.mock.callCount(),1);
  assert.deepEqual(results,[]);
  stop();
  reply=Response.json({state:'saved',order:{id:'different-order'}});
  stop=start(false);
  online();
  reply=Response.json({state:'saved',order:{id:'original'}});
  await tick();
  assert.equal(request.mock.callCount(),3);
  assert.deepEqual(results,['saved']);
  stop();
  reply=Response.json({}, {status:401});
  stop=start(false);
  await tick();
  online();
  assert.equal(request.mock.callCount(),4);
  assert.deepEqual(results,['saved','expired']);
  stop();
  stop=start(true);
  stop();
  online();
  assert.equal(request.mock.callCount(),4);
  let finish!:(response:Response)=>void;
  delayed=new Promise(resolve=>{finish=resolve;});
  stop=start(false);
  const [,options]=request.mock.calls[4].arguments;
  stop();
  assert.equal(options.signal?.aborted,true);
  finish(Response.json({state:'saved',order:{id:'original'}}));
  await tick();
  assert.deepEqual(results,['saved','expired']);
  assert.deepEqual(checking,[true,false,true,false,true,false,true,false,true,false]);
});

test('email session reads distinguish a revoked session from a temporary or malformed response', async t => {
  const address = 'learner@example.invalid';
  const signal = new AbortController().signal;
  const request = t.mock.method(globalThis, 'fetch', async (_path: string, init: RequestInit) => {
    assert.equal(init.signal, signal);
    return Response.json(JSON.parse(String(init.body)).email ? { verified: true } : { verifiedEmail: address });
  });
  assert.equal(await readEnrollmentEmailAddress(signal), address);
  assert.equal(await readEnrollmentEmailVerification(address, signal), true);

  request.mock.mockImplementation(async () => Response.json({ verifiedEmail: null, verified: false }));
  assert.equal(await readEnrollmentEmailAddress(signal), null);
  assert.equal(await readEnrollmentEmailVerification(address, signal), false);
  request.mock.mockImplementation(async () => Response.json({ error: 'session expired' }, { status: 401 }));
  assert.equal(await readEnrollmentEmailAddress(signal), null);
  assert.equal(await readEnrollmentEmailVerification(address, signal), false);
  request.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  assert.equal(await readEnrollmentEmailAddress(signal), null);
  assert.equal(await readEnrollmentEmailVerification(address, signal), false);

  for (const response of [() => Response.json({}, { status: 503 }), () => Response.json(null),
    () => Response.json({ verifiedEmail: 'invalid', verified: 'false' })]) {
    request.mock.mockImplementation(async () => response());
    assert.equal(await readEnrollmentEmailAddress(signal), undefined);
    assert.equal(await readEnrollmentEmailVerification(address, signal), undefined);
  }
});

test('a pending enrollment result uses a read and distinguishes a missing receipt from a saved order',async t=>{
  const path='/api/enrollment/applications/results/fixture';
  selectVisitorScope('fixture');
  t.after(()=>selectVisitorScope(''));
  const request=t.mock.method(globalThis,'fetch',async()=>{
    return Response.json({state:'unconfirmed'});
  });
  assert.deepEqual(await readEnrollmentOperation(path,'mock@example.test'),{state:'unconfirmed'});
  const [url,options]=request.mock.calls[0].arguments as unknown as [string,RequestInit];
  assert.equal(url,path);
  assert.equal(options.method,undefined);
  assert.equal(options.cache,'no-store');
  assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),'mock@example.test');
  request.mock.mockImplementation(async()=>Response.json({state:'saved',order:{id:'fixture-order'}}));
  assert.deepEqual(await readEnrollmentOperation(path),{state:'saved',order:{id:'fixture-order'}});
  const proof='/api/enrollment/orders/fixture-order/proofs/fixture-upload/result';
  request.mock.mockImplementation(async()=>Response.json({state:'unconfirmed',proofTransport:'binary-v1'}));
  assert.deepEqual(await readEnrollmentOperation(proof),{state:'unconfirmed',proofTransport:'binary-v1'});
  request.mock.mockImplementation(async()=>Response.json({state:'unconfirmed',proofTransport:'binary-v1',uploadActive:false}));
  assert.deepEqual(await readEnrollmentOperation(proof),{state:'unconfirmed',proofTransport:'binary-v1',uploadActive:false});
  request.mock.mockImplementation(async()=>Response.json({state:'unconfirmed',uploadActive:'false'}));
  await assert.rejects(readEnrollmentOperation(proof),/enrollment_operation_unconfirmed/);
  request.mock.mockImplementation(async()=>new Response('<html>unavailable</html>'));
  await assert.rejects(readEnrollmentOperation(path),/enrollment_operation_unconfirmed/);
});

test('the order list retries once when a network failure arrives after reconnection',async t=>{
  const email='learner@example.invalid';
  for(const {first,reconnect,abort,switchVisitor,second,attempts,result} of [
    {first:503,reconnect:true,second:200,attempts:2,result:200},
    {first:408,reconnect:true,second:503,attempts:2,result:503},
    {first:503,reconnect:false,attempts:1,result:503},
    {first:401,reconnect:true,attempts:1,result:401},
    {first:200,reconnect:true,attempts:1,result:200},
    {first:503,reconnect:true,abort:true,attempts:1},
    {first:503,reconnect:true,switchVisitor:true,attempts:1},
  ]){
    selectVisitorScope('order-reader');
    try{
      const controller=new AbortController();
      let revision=0,reads=0;
      t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
        assert.equal(url,'/api/enrollment/orders');
        assert.equal(options.method,undefined);
        assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),email);
        assert.ok(options.signal);
        if(++reads===1){
          if(reconnect)revision++;
          if(abort)controller.abort();
          if(switchVisitor)selectVisitorScope('another-reader');
          return Response.json({}, {status:first});
        }
        return Response.json({}, {status:second});
      });
      const response=await readEnrollmentOrdersResponse(email,controller.signal,()=>revision);
      assert.equal(response?.status,result);
      assert.equal(reads,attempts);
    }finally{
      t.mock.restoreAll();
      selectVisitorScope('');
    }
  }
});

test('offline enrollment order and result reads preserve uncertainty without starting requests',async t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const connection={onLine:false};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:connection});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'navigator',previous);else Reflect.deleteProperty(globalThis,'navigator');});
  const calls:string[]=[];
  const orderPath='/api/enrollment/orders/fixture-order';
  const resultPath=orderPath+'/proofs/fixture-upload/result';
  const order={id:'fixture-order'};
  t.mock.method(globalThis,'fetch',async (url:string,options:RequestInit)=>{
    assert.equal(options.method,undefined);
    calls.push(url);
    return Response.json(url===orderPath ? order : {state:'saved',order});
  });
  const email='learner@example.invalid';
  const signal=new AbortController().signal;
  const readOrder=()=>readEnrollmentOrderResponse(orderPath,email,signal,()=>0,()=>true);
  assert.equal(await readOrder(),null);
  await assert.rejects(readEnrollmentOperation(resultPath,email,signal),/enrollment_operation_unconfirmed/);
  assert.deepEqual(calls,[]);

  connection.onLine=true;
  assert.deepEqual((await readOrder())?.data,order);
  assert.deepEqual(await readEnrollmentOperation(resultPath,email,signal),{state:'saved',order});
  assert.deepEqual(calls,[orderPath,resultPath]);
});

test('the order list retries an interrupted response body when the connection already recovered',async t=>{
  selectVisitorScope('order-reader');
  t.after(()=>selectVisitorScope(''));
  let revision=0;
  let reads=0;
  let body!:ReadableStreamDefaultController<Uint8Array>;
  const response=new Response(new ReadableStream<Uint8Array>({start:controller=>{body=controller;}}));
  const fetcher=t.mock.method(globalThis,'fetch',async()=>++reads===1
    ?response:Response.json({orders:[]}));
  const read=readEnrollmentOrdersResponse('learner@example.invalid',new AbortController().signal,()=>revision);
  body.enqueue(new TextEncoder().encode('{"orders":'));
  revision++;
  body.error(new TypeError('Connection closed after receiving headers'));
  const result=await read;
  assert.equal(result?.status,200);
  assert.deepEqual(result?.data,{orders:[]});
  assert.equal(fetcher.mock.callCount(),2);
});

test('payment order recovery uses the replacement response date and respects foreground retry eligibility',async t=>{
  selectVisitorScope('payment-reader');
  t.after(()=>selectVisitorScope(''));
  const path='/api/enrollment/orders/synthetic-order';
  const email='learner@example.invalid';
  const serverDate='Mon, 23 Nov 2026 18:00:00 GMT';
  const order={id:'synthetic-order',status:'awaiting_payment'};
  for(const canRetry of [true,false]){
    let revision=0;
    let reads=0;
    let body!:ReadableStreamDefaultController<Uint8Array>;
    let started!:()=>void;
    const reading=new Promise<void>(resolve=>{started=resolve;});
    const interrupted=new Response(new ReadableStream<Uint8Array>({
      start:controller=>{body=controller;},
      pull:()=>started(),
    },{highWaterMark:0}),{headers:{Date:'Mon, 23 Nov 2026 17:59:00 GMT'}});
    const fetcher=t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
      assert.equal(url,path);
      assert.equal(options.method,undefined);
      assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),email);
      return ++reads===1?interrupted:Response.json(order,{headers:{Date:serverDate}});
    });
    const read=readEnrollmentOrderResponse(path,email,new AbortController().signal,()=>revision,()=>canRetry);
    await reading;
    body.enqueue(new TextEncoder().encode('{"id":'));
    revision++;
    body.error(new TypeError('Connection closed after receiving headers'));
    const result=await read;
    assert.equal(fetcher.mock.callCount(),canRetry?2:1);
    if(canRetry){
      assert.deepEqual(result?.data,order);
      assert.equal(result?.headers.get('Date'),serverDate);
    }else assert.equal(result,null);
    t.mock.restoreAll();
  }
});

test('result read discards a response when the visitor changes while the browser decodes it',async t=>{
  selectVisitorScope('original-visitor');
  t.after(()=>selectVisitorScope(''));
  const response=Response.json({state:'saved',order:{id:'fixture-order'}});
  t.mock.method(response,'json',async()=>{
    selectVisitorScope('replacement-visitor');
    return {state:'saved',order:{id:'fixture-order'}};
  });
  t.mock.method(globalThis,'fetch',async()=>response);
  await assert.rejects(readEnrollmentOperation('/api/enrollment/applications/results/fixture'),/enrollment_verification_required/);
});

test('a proof receipt can recover from reconnection without writing or retrying a definite response',async t=>{
  const path='/api/enrollment/orders/fixture-order/proofs/fixture-upload/result';
  const email='learner@example.invalid';
  let revision=0;
  let calls=0;
  let first:'lost'|'unconfirmed'|'expired'='lost';
  t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
    assert.equal(url,path);
    assert.equal(options.method,undefined);
    assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),email);
    if(++calls===1){
      revision++;
      if(first==='lost')throw new TypeError('Connection interrupted');
      if(first==='expired')return new Response(null,{status:401});
      return Response.json({state:'unconfirmed'});
    }
    return Response.json({state:'saved',order:{id:'fixture-order'}});
  });
  const signal=new AbortController().signal;
  const read=()=>readEnrollmentOperation(path,email,signal,()=>revision);
  assert.deepEqual(await read(),{state:'saved',order:{id:'fixture-order'}});
  assert.equal(calls,2);
  calls=0;first='unconfirmed';
  assert.deepEqual(await read(),{state:'unconfirmed'});
  assert.equal(calls,1);
  calls=0;first='expired';
  await assert.rejects(read,/enrollment_verification_required/);
  assert.equal(calls,1);
});

test('verification with a lost response checks the same email session without resending the code',async t=>{
  const calls:string[]=[];
  let verified=true;
  t.mock.method(globalThis,'fetch',async (path:string,options:RequestInit)=>{
    calls.push(path);
    assert.ok(options.signal);
    if(path.endsWith('/verify'))throw new DOMException('Timed out','TimeoutError');
    assert.deepEqual(JSON.parse(String(options.body)),{email:'learner@example.invalid'});
    return Response.json({verified});
  });
  await verifyEnrollmentEmail('learner@example.invalid','fixture','123456');
  assert.deepEqual(calls,['/api/enrollment/email/verify','/api/enrollment/email/session']);
  verified=false;
  await assert.rejects(verifyEnrollmentEmail('learner@example.invalid','fixture','123456'),/enrollment_email_verification_unconfirmed/);
  assert.deepEqual(calls.slice(2),calls.slice(0,2));
});

test('sign-out is bounded and an unknown reply checks only the original email before reporting success',async t=>{
  const email='learner@example.invalid';
  const calls:string[]=[];
  let logout:'saved'|'lost'|'rejected'='saved';
  let verification:boolean|undefined=false;
  t.mock.method(globalThis,'fetch',async (path:string,options:RequestInit)=>{
    calls.push(path);
    assert.ok(options.signal);
    if(path.endsWith('/logout')){
      assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),email);
      if(logout==='saved')return Response.json({signedOut:true});
      if(logout==='rejected')return Response.json({error:'enrollment_verification_required'},{status:401});
      throw new DOMException('Timed out','TimeoutError');
    }
    assert.equal(path,'/api/enrollment/email/session');
    assert.deepEqual(JSON.parse(String(options.body)),{email});
    return verification===undefined?new Response(null,{status:503}):Response.json({verified:verification});
  });
  const logoutPath='/api/enrollment/email/logout',sessionPath='/api/enrollment/email/session';
  await signOutEnrollmentEmail(email);
  assert.deepEqual(calls.splice(0),[logoutPath]);
  logout='lost';
  await signOutEnrollmentEmail(email);
  assert.deepEqual(calls.splice(0),[logoutPath,sessionPath]);
  for(const result of [true,undefined]){
    verification=result;
    await assert.rejects(signOutEnrollmentEmail(email),/enrollment_email_signout_unconfirmed/);
    assert.deepEqual(calls.splice(0),[logoutPath,sessionPath]);
  }
  logout='rejected';
  await assert.rejects(signOutEnrollmentEmail(email),/enrollment_verification_required/);
  assert.deepEqual(calls,[logoutPath]);
});

test('email code requests preserve throttling and require a confirmed challenge without retrying automatically',async t=>{
  const email='learner@example.invalid';
  const request=t.mock.method(globalThis,'fetch',async (path:string,options:RequestInit)=>{
    assert.equal(path,'/api/enrollment/email/request');
    assert.ok(options.signal);
    assert.deepEqual(JSON.parse(String(options.body)),{email,language:'zh',purpose:'apply'});
    throw new DOMException('Timed out','TimeoutError');
  });
  const send=()=>requestEnrollmentEmailCode(email,'zh','apply');
  const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  try {
    await assert.rejects(send(),/enrollment_code_offline/);
    assert.equal(request.mock.callCount(),0);
  } finally {
    if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);
    else Reflect.deleteProperty(globalThis,'navigator');
  }
  await assert.rejects(send(),/enrollment_code_send_unconfirmed/);
  assert.equal(request.mock.callCount(),1);
  request.mock.mockImplementation(async()=>Response.json({error:'enrollment_code_wait'},{status:429}));
  await assert.rejects(send(),{message:'enrollment_code_wait',status:429});
  request.mock.mockImplementation(async()=>new Response('<html>Too Many Requests</html>',{status:429}));
  await assert.rejects(send(),{message:'enrollment_code_wait',status:429});
  request.mock.mockImplementation(async()=>new Response(null,{status:502}));
  await assert.rejects(send(),/enrollment_code_send_unconfirmed/);
  request.mock.mockImplementation(async()=>Response.json({error:'enrollment_email_unavailable'},{status:503}));
  await assert.rejects(send(),{message:'enrollment_email_unavailable',status:503});
  request.mock.mockImplementation(async()=>Response.json({}));
  await assert.rejects(send(),/enrollment_code_send_unconfirmed/);
  request.mock.mockImplementation(async()=>Response.json({challengeId:'confirmed-fixture'}));
  assert.equal(await send(),'confirmed-fixture');
  assert.equal(request.mock.callCount(),7);
});

test('formatted or autofilled verification codes keep all six digits without truncating longer values',()=>{
  assert.equal(enrollmentCodeInput(' 123 456 ','12'),'123456');
  assert.equal(enrollmentCodeInput('012-345',''),'012345');
  assert.equal(enrollmentCodeInput('123 4567','12'),'12');
  assert.equal(enrollmentCodeInput('1234567',''),'');
  assert.equal(enrollmentCodeInput('','123456'),'');
});

test('public interest submissions distinguish transport uncertainty from a business rejection',async t=>{
  const email='learner@example.invalid';
  const body={id:'fixture',revision:0};
  const submit=()=>submitEnrollmentInterest('demands',body,email);
  const request=t.mock.method(globalThis,'fetch',async (path:string,options:RequestInit)=>{
    assert.equal(path,'/api/enrollment/demands');
    assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),email);
    assert.ok(options.signal);
    assert.deepEqual(JSON.parse(String(options.body)),body);
    throw new DOMException('Timed out','TimeoutError');
  });
  await assert.rejects(submit(),/enrollment_interest_unconfirmed/);
  assert.equal(request.mock.callCount(),1);
  request.mock.mockImplementation(async()=>Response.json({error:'enrollment_demand_conflict'},{status:409}));
  await assert.rejects(submit(),{message:'enrollment_demand_conflict',status:409});
  request.mock.mockImplementation(async()=>Response.json({}));
  await assert.rejects(submit(),/enrollment_interest_unconfirmed/);
  request.mock.mockImplementation(async()=>Response.json({id:'fixture',revision:1}));
  await submit();
});

test('demand recovery preserves the original request across a draft edit and requires its matching receipt',async t=>{
  const owner='demand-visitor',email='learner@example.invalid';
  const tab=new Map<string,string>();
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:{
    getItem:(key:string)=>tab.get(key)??null,
    setItem:(key:string,value:string)=>tab.set(key,value),
    removeItem:(key:string)=>tab.delete(key),
  }}});
  t.after(()=>{
    selectVisitorScope('');
    if(descriptor)Object.defineProperty(globalThis,'window',descriptor);
    else Reflect.deleteProperty(globalThis,'window');
  });
  selectVisitorScope(owner);
  const original:PendingDemand={id:'fixture-demand',revision:0,source:'lang=zh&p=campaign',forAnother:true,name:'Ayu',
    criteria:{level:'HSK 1',period:'weekend',format:'small',notes:'',phone:'081234567890'}};
  const {forAnother:_,...expected}=original;
  let response:unknown;
  let releaseReceipt:(()=>void)|undefined;
  let holdReceipt=false;
  const request=t.mock.method(globalThis,'fetch',async (path:string,options:RequestInit)=>{
    assert.equal(path,'/api/enrollment/demands');
    assert.equal(new Headers(options.headers).get('X-Enrollment-Email'),email);
    assert.deepEqual(JSON.parse(String(options.body)),expected);
    if(!response)throw new TypeError('Response lost');
    if(holdReceipt)await new Promise<void>(resolve=>{releaseReceipt=resolve;});
    return response instanceof Response?response:Response.json(response);
  });
  await assert.rejects(submitPendingDemand(owner,email,original,false),/enrollment_interest_unconfirmed/);
  const recovered=readPendingDemand(owner,email);
  assert.deepEqual(recovered,original);
  assert.ok(recovered&&typeof recovered==='object');
  assert.equal(sameDemandDraft(recovered,{...original,id:'new-tab-form-id'},true),true);
  assert.equal(sameDemandDraft(recovered,{...original,criteria:{...original.criteria,notes:'Updated preference'}},true),false);
  assert.equal(sameDemandDraft(recovered,{...original,name:'Maya'},true),false);
  assert.equal(sameDemandDraft(recovered,original,false),false);
  const laterDraft={...original,id:'new-demand',criteria:{...original.criteria,notes:'New preference'}};
  await assert.rejects(submitPendingDemand(owner,email,laterDraft,false),/enrollment_demand_previous_unconfirmed/);
  assert.deepEqual(readPendingDemand(owner,email),original);
  assert.equal(readPendingDemand(owner,'other@example.invalid'),undefined);
  selectVisitorScope('different-visitor');
  assert.equal(readPendingDemand(owner,email),undefined);
  selectVisitorScope(owner);
  response={id:original.id,revision:2};
  await assert.rejects(submitPendingDemand(owner,email,recovered,true),/enrollment_interest_unconfirmed/);
  response={id:'different-demand',revision:1};
  await assert.rejects(submitPendingDemand(owner,email,recovered,true),/enrollment_interest_unconfirmed/);
  assert.deepEqual(readPendingDemand(owner,email),original);
  response={id:original.id,revision:1};
  holdReceipt=true;
  const beforeRetry=request.mock.callCount();
  const firstRetry=submitPendingDemand(owner,email,recovered,true);
  const reopenedFormRetry=submitPendingDemand(owner,email,original,true);
  await assert.rejects(submitPendingDemand(owner,email,laterDraft,false),/enrollment_demand_previous_unconfirmed/);
  assert.deepEqual(readPendingDemand(owner,email),original);
  assert.equal(request.mock.callCount()-beforeRetry,1);
  releaseReceipt!();
  await Promise.all([firstRetry,reopenedFormRetry]);
  holdReceipt=false;
  assert.equal(readPendingDemand(owner,email),undefined);
  response=Response.json({error:'enrollment_invalid_demand'},{status:400});
  await assert.rejects(submitPendingDemand(owner,email,original,false),/enrollment_invalid_demand/);
  assert.equal(readPendingDemand(owner,email),undefined);
  assert.equal(request.mock.callCount(),5);
  selectVisitorScope('different-visitor');
  await assert.rejects(submitPendingDemand(owner,email,original,true),/enrollment_verification_required/);
  assert.equal(request.mock.callCount(),5);
});

test('verification preserves a definite rejection and discards recovery after a visitor switch',async t=>{
  selectVisitorScope('original-visitor');
  t.after(()=>selectVisitorScope(''));
  const request=t.mock.method(globalThis,'fetch',async ()=>Response.json({error:'enrollment_invalid_code'},{status:401}));
  await assert.rejects(verifyEnrollmentEmail('learner@example.invalid','fixture','123456'),/enrollment_invalid_code/);
  assert.equal(request.mock.callCount(),1);
  request.mock.mockImplementation(async(path:string)=>{
    if(path.endsWith('/verify'))throw new TypeError('Network error');
    selectVisitorScope('replacement-visitor');
    return Response.json({verified:true});
  });
  await assert.rejects(verifyEnrollmentEmail('learner@example.invalid','fixture','123456'),/enrollment_verification_required/);
});

test('confirmed details are scoped, and an email-only confirmation never mixes people',t=>{
  const local=new Map<string,string>(),tab=new Map<string,string>();
  const storage=(values:Map<string,string>)=>({
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,value),
    removeItem:(key:string)=>values.delete(key),
  });
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{
    localStorage:storage(local),sessionStorage:storage(tab),dispatchEvent:()=>true,
  }});
  t.after(()=>{
    selectVisitorScope('');
    if(descriptor)Object.defineProperty(globalThis,'window',descriptor);
    else Reflect.deleteProperty(globalThis,'window');
  });
  selectVisitorScope('first');
  rememberVisitorContact('first',{email:' LEARNER@example.invalid ',fullName:'Maya',whatsapp:'+6281234567890'});
  assert.deepEqual(readVisitorContact('first'),{email:'learner@example.invalid',fullName:'Maya',whatsapp:'+6281234567890'});
  writeEnrollmentDraft('first','apply:A',{phone:''});
  assert.deepEqual(readEnrollmentDraft('first','apply:A'),{phone:''});
  assert.equal(readEnrollmentDraft('first','waitlist:A'),undefined);
  rememberVisitorContact('first',{email:'different@example.invalid'});
  assert.deepEqual(readVisitorContact('first'),{email:'different@example.invalid'});
  selectVisitorScope('second');
  rememberVisitorContact('first',{email:'late@example.invalid'});
  assert.equal(readVisitorContact('first'),undefined);
  assert.equal(readVisitorContact('second'),undefined);
  assert.equal(readEnrollmentDraft('first','apply:A'),undefined);
  selectVisitorScope('first');
  assert.deepEqual(readVisitorContact('first'),{email:'different@example.invalid'});
});

test('unwritable session storage retains the current draft and hides a failed clear',t=>{
  const owner='draft-owner';
  const oldValue={name:'old'};
  let saved:string|null=JSON.stringify({value:oldValue,expiresAt:Date.now()+60_000});
  let writable=false;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  const sessionStorage={
    getItem:()=>saved,
    setItem:(_key:string,value:string)=>{if(!writable)throw Error('Storage unavailable');saved=value;},
    removeItem:()=>{if(!writable)throw Error('Storage unavailable');saved=null;},
  };
  Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage}});
  t.after(()=>{
    selectVisitorScope('');
    if(descriptor)Object.defineProperty(globalThis,'window',descriptor);
    else Reflect.deleteProperty(globalThis,'window');
  });
  selectVisitorScope(owner);
  assert.deepEqual(readEnrollmentDraft(owner,'apply:A'),oldValue);
  writeEnrollmentDraft(owner,'apply:A',{name:'new',applicationRequestId:'current-request'});
  assert.deepEqual(readEnrollmentDraft(owner,'apply:A'),{name:'new',applicationRequestId:'current-request'});
  selectVisitorScope('replacement');
  assert.equal(readEnrollmentDraft(owner,'apply:A'),undefined);
  selectVisitorScope(owner);
  writeEnrollmentDraft(owner,'apply:A');
  assert.equal(readEnrollmentDraft(owner,'apply:A'),undefined);
  assert.equal(JSON.parse(saved!).value.name,'old');
  writable=true;
  writeEnrollmentDraft(owner,'apply:A',{name:'persisted'});
  assert.deepEqual(readEnrollmentDraft(owner,'apply:A'),{name:'persisted'});
  assert.equal(JSON.parse(saved!).value.name,'persisted');
});

test('a newly issued enrollment verification cannot authorize another visitor',()=>{
  const token='a'.repeat(64),first='b'.repeat(64),second='c'.repeat(64);
  const digest=enrollmentVisitorDigest(token,first);
  const cookie='uper_enrollment_session=v2.'+token;
  assert.equal(readEnrollmentSessionDigest(cookie+'; uper_visitor='+first),digest);
  assert.notEqual(readEnrollmentSessionDigest(cookie+'; uper_visitor='+second),digest);
  assert.equal(readEnrollmentSessionDigest(cookie),undefined);
  assert.equal(readEnrollmentSessionDigest('uper_enrollment_session='+token+'; uper_visitor='+first),enrollmentVisitorDigest(token));
});

test('enrollment reuses only the unexpired email belonging to the current visitor and cookie',async()=>{
  const token='a'.repeat(64),visitor='b'.repeat(64),other='c'.repeat(64);
  const email='learner@example.invalid';
  let active=true;
  const digest=enrollmentVisitorDigest(token,visitor);
  const client={async query(sql:string,values?:unknown[]){
    assert.match(sql,/expires_at>UTC_TIMESTAMP/);
    return {rows:active&&values?.[0]===digest?[{email}]:[]};
  }};
  const cookie=(scope:string)=>'uper_enrollment_session=v2.'+token+'; uper_visitor='+scope;
  assert.equal(await readEnrollmentEmailSession(client,cookie(visitor),' Learner@EXAMPLE.INVALID '),email);
  assert.equal(await readEnrollmentEmailSession(client,cookie(visitor),'someone-else@example.invalid'),undefined);
  assert.equal(await readEnrollmentEmailSession(client,cookie(other),email),undefined);
  assert.equal(await readEnrollmentEmailSession(client,undefined,email),undefined);
  active=false;
  assert.equal(await readEnrollmentEmailSession(client,cookie(visitor),email),undefined);
});

test('logout revokes only the presented visitor session and an old tab cannot sign out a replacement email',async()=>{
  const token='a'.repeat(64),visitor='b'.repeat(64),otherVisitor='c'.repeat(64);
  const source=enrollmentVisitorDigest(token,visitor),other=enrollmentVisitorDigest(token,otherVisitor);
  const rows=new Map([[source,{email:'current@example.invalid'}],[other,{email:'current@example.invalid'}]]);
  const client={async query(sql:string,args?:unknown[]){
    const digest=String(args?.[0]);
    if(sql.startsWith('DELETE')) {
      rows.delete(digest);
      return {rows:[]};
    }
    const row=rows.get(digest);
    return {rows:row?[row]:[]};
  }};
  const cookies='uper_enrollment_session=v2.'+token+'; uper_visitor='+visitor;
  assert.equal(await revokeEnrollmentEmailSession(client,cookies,'old@example.invalid'),false);
  assert.equal(rows.size,2);
  assert.equal(await revokeEnrollmentEmailSession(client,cookies,'current@example.invalid'),true);
  assert.equal(await readEnrollmentEmailSession(client,cookies),undefined);
  assert.equal(await revokeEnrollmentEmailSession(client,cookies,'current@example.invalid'),true);
  assert.equal(rows.has(other),true);
});

test('enrollment session watcher coalesces focus checks and ignores a superseded result',async t=>{
  const {watchEnrollmentEmailSession}=await import('../src/services/enrollmentSession');
  const win=new EventTarget();
  const doc=Object.assign(new EventTarget(),{hidden:false});
  for(const [key,value] of [['window',win],['document',doc]] as const){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  let release!:()=>void;
  const applied:number[]=[];
  let checks=0;
  let activeSignal!:AbortSignal;
  let latest!:()=>boolean;
  const changes:boolean[]=[];
  const stop=watchEnrollmentEmailSession(async (isLatest,signal,sessionChanged)=>{
    activeSignal=signal;
    latest=isLatest;
    changes.push(sessionChanged);
    const n=++checks;
    await new Promise<void>(resolve=>{release=resolve;});
    if(isLatest())applied.push(n);
  },true);
  win.dispatchEvent(new Event('focus'));
  doc.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks,1);
  win.dispatchEvent(new Event('focus'));
  assert.equal(latest(),true);
  win.dispatchEvent(Object.assign(new Event('storage'),{key:'uper:enrollment-email-session-change'}));
  assert.equal(activeSignal.aborted,true);
  for(let i=0;i<4;i++)win.dispatchEvent(new Event('focus'));
  release();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks,2);
  assert.deepEqual(changes,[false,true]);
  assert.deepEqual(applied,[]);
  win.dispatchEvent(new Event('focus'));
  doc.dispatchEvent(new Event('visibilitychange'));
  release();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(applied,[2]);
  win.dispatchEvent(new Event('focus'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks,3);
  assert.deepEqual(changes,[false,true,false]);
  doc.hidden=true;
  doc.dispatchEvent(new Event('visibilitychange'));
  doc.hidden=false;
  win.dispatchEvent(new Event('focus'));
  doc.dispatchEvent(new Event('visibilitychange'));
  release();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks,4);
  assert.deepEqual(applied,[2]);
  assert.equal(activeSignal.aborted,false);
  stop();
  assert.equal(activeSignal.aborted,true);
  release();
  win.dispatchEvent(new Event('focus'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks,4);
  assert.deepEqual(applied,[2]);
});

test('enrollment email session recovers when reconnection comes before or after a failed read',async t=>{
  const {watchEnrollmentEmailSession}=await import('../src/services/enrollmentSession');
  const win=new EventTarget();
  const doc=Object.assign(new EventTarget(),{hidden:false});
  const connection={onLine:true};
  let stop:(()=>void)|undefined;
  t.after(()=>stop?.());
  for(const [key,value] of [['window',win],['document',doc],['navigator',connection]] as const){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const address='returning@example.invalid';
  const responses:((response:Response)=>void)[]=[];
  const request=t.mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>responses.push(resolve)));
  const fail=()=>responses.shift()!(new Response(null,{status:503}));
  const succeed=(email:string|null)=>responses.shift()!(Response.json({verifiedEmail:email}));
  const online=()=>win.dispatchEvent(new Event('online'));
  const applied:(string|null)[]=[];
  stop=watchEnrollmentEmailSession(async(isLatest,signal)=>{
    const result=await readEnrollmentEmailAddress(signal);
    if(result===undefined)return false;
    if(isLatest())applied.push(result);
    return true;
  },true);

  await tick();
  fail();
  await tick();
  assert.equal(request.mock.callCount(),1);
  online();
  await tick();
  succeed(address);
  await tick();
  assert.deepEqual(applied,[address]);
  online();
  await tick();
  assert.equal(request.mock.callCount(),2);

  win.dispatchEvent(new Event('focus'));
  await tick();
  online();
  fail();
  await tick();
  assert.equal(request.mock.callCount(),4);
  fail();
  await tick();
  assert.equal(request.mock.callCount(),4);
  assert.deepEqual(applied,[address]);

  doc.hidden=true;
  doc.dispatchEvent(new Event('visibilitychange'));
  online();
  await tick();
  assert.equal(request.mock.callCount(),4);
  doc.hidden=false;
  doc.dispatchEvent(new Event('visibilitychange'));
  await tick();
  succeed(null);
  await tick();
  assert.deepEqual(applied,[address,null]);

  connection.onLine=false;
  win.dispatchEvent(new Event('focus'));
  await tick();
  assert.equal(request.mock.callCount(),5);
  assert.deepEqual(applied,[address,null]);
  connection.onLine=true;
  online();
  await tick();
  assert.equal(request.mock.callCount(),6);
  succeed(address);
  await tick();
  assert.deepEqual(applied,[address,null,address]);
  stop();
  stop=undefined;
  online();
  await tick();
  assert.equal(request.mock.callCount(),6);
});
