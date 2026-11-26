import assert from 'node:assert/strict';
import {test} from 'node:test';
import {enrollmentCatalogUrl,intakeReadinessUrl,parseEnrollmentCatalog,parseEnrollmentReadiness,preloadEnrollmentNavigation,readEnrollmentClassDetails,readEnrollmentLandingData,servicingReadinessUrl} from '../src/services/enrollmentClassDetails';
import {cancelUnmatchedEnrollmentPreload} from '../src/services/enrollmentLandingState';
import {watchReadReconnect} from '../src/services/readReconnect';

test('landing reads schedule recovery in either event order and discard it on navigation',t=>{
  const browser=new EventTarget();
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const retry=t.mock.fn();
  const online=()=>browser.dispatchEvent(new Event('online'));

  const catalog=watchReadReconnect(retry);
  online();
  assert.equal(retry.mock.callCount(),0);
  assert.equal(catalog.failed(),true);
  online();
  assert.equal(retry.mock.callCount(),1);
  catalog.stop();

  const readiness=watchReadReconnect(retry);
  assert.equal(readiness.failed(),false);
  online();
  online();
  assert.equal(retry.mock.callCount(),2);
  assert.equal(readiness.failed(),false);
  online();
  assert.equal(retry.mock.callCount(),2);
  readiness.stop();

  const left=watchReadReconnect(retry);
  assert.equal(left.failed(),false);
  left.stop();
  online();
  assert.equal(retry.mock.callCount(),2);
});

test('a hidden chat preserves its one reconnect retry until the card is visible again',t=>{
  const browser=new EventTarget();
  const page=Object.assign(new EventTarget(),{hidden:true});
  for(const [key,value] of [['window',browser],['document',page]] as const){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  const retry=t.mock.fn();
  const online=()=>browser.dispatchEvent(new Event('online'));
  const visible=()=>{page.hidden=false;page.dispatchEvent(new Event('visibilitychange'));};

  for(const onlineFirst of [false,true]){
    page.hidden=true;
    const reconnect=watchReadReconnect(retry,{foregroundOnly:true});
    const calls=retry.mock.callCount();
    if(onlineFirst)online();
    assert.equal(reconnect.failed(),false);
    online();
    assert.equal(retry.mock.callCount(),calls);
    visible();
    online();
    assert.equal(retry.mock.callCount(),calls+1);
  }

  page.hidden=true;
  const foregroundOnly=watchReadReconnect(retry,{foregroundOnly:true});
  foregroundOnly.failed();
  visible();
  assert.equal(retry.mock.callCount(),3);
  online();
  assert.equal(retry.mock.callCount(),3);

  page.hidden=true;
  const closed=watchReadReconnect(retry,{foregroundOnly:true});
  closed.failed();
  online();
  closed.stop();
  visible();
  assert.equal(retry.mock.callCount(),3);
});

test('public enrollment navigation reads only the catalog or chosen class and readiness',async t=>{
  const origin='https://example.invalid';
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  const browser={location:new URL(origin+'/chat')} as unknown as Window;
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const calls:string[]=[];
  const signals:AbortSignal[]=[];
  t.mock.method(globalThis,'fetch',async(path:string,init:RequestInit)=>{
    calls.push(path);
    assert.equal(init.cache,'no-store');
    assert.ok(init.signal);
    signals.push(init.signal);
    return path.includes('/classes') ? Response.json({classes:[]}) : new Response(null,{status:503});
  });
  for(const path of ['/enrollment/mine/other/fixture','/enrollment/assist','/enrollment/a?view=rules',
    '/enrollment/a?learnerPreview=private','/enrollment/a%2Fb','https://another.invalid/enrollment/demo']){
    preloadEnrollmentNavigation(new URL(path,origin));
  }
  assert.deepEqual(calls,[]);
  preloadEnrollmentNavigation(new URL('/enrollment/demo?email=private&apply=1&p=fixture',origin));
  assert.deepEqual(calls,['/api/enrollment/classes?classId=demo','/api/enrollment/availability']);
  const entry=browser.__uperEnrollmentLanding!;
  assert.equal(entry.pathname,'/enrollment/demo');
  assert.equal(entry.application,true);
  assert.deepEqual(await entry.classes!.response,{classes:[]});
  assert.equal(typeof entry.classes?.receivedAt,'number');
  assert.equal(await entry.availability!.response,null);
  preloadEnrollmentNavigation(new URL('/enrollment?lang=id&level=1&period=weekend&p=fixture',origin));
  assert.deepEqual(calls.slice(2),['/api/enrollment/classes?view=summary','/api/enrollment/availability']);
  assert.ok(signals.slice(0,2).every(signal=>signal.aborted));
  const catalog=browser.__uperEnrollmentLanding;
  assert.equal(catalog?.pathname,'/enrollment');
  preloadEnrollmentNavigation(new URL('/enrollment?lang=zh&format=standard&p=fixture',origin));
  assert.equal(browser.__uperEnrollmentLanding,catalog);
  assert.equal(calls.length,4);
  assert.ok(signals.slice(2).every(signal=>!signal.aborted));
  for (const path of ['/enrollment/mine','/enrollment/payment?order=private','/enrollment/demo-class?order=private',
    '/enrollment/mine/waitlist/private-id','/enrollment/mine/demands/private-id/?p=fixture']) {
    calls.length=0;
    preloadEnrollmentNavigation(new URL(path,origin));
    assert.deepEqual(calls,[servicingReadinessUrl]);
    assert.equal(browser.__uperEnrollmentLanding?.classes,undefined);
    assert.equal(browser.__uperEnrollmentLanding?.pathname,new URL(path,origin).pathname);
  }
  calls.length=0;
  preloadEnrollmentNavigation(new URL('/enrollment/interest?level=2&p=fixture',origin));
  assert.deepEqual(calls,[intakeReadinessUrl]);
  assert.equal(browser.__uperEnrollmentLanding?.classes,undefined);
  calls.length=0;
  const appointment=new URL('/enrollment/interest?appointment=private-1&p=fixture',origin);
  const snapshot={id:'private-1',data:{classes:[],appointments:[]},receivedAt:performance.now()};
  preloadEnrollmentNavigation(appointment,snapshot);
  preloadEnrollmentNavigation(appointment,snapshot);
  assert.deepEqual(calls,[servicingReadinessUrl]);
  assert.equal(browser.__uperEnrollmentLanding?.appointmentId,'private-1');
  calls.length=0;
  // Open a new destination so coalescing the prior target cannot affect the assertion.
  preloadEnrollmentNavigation(new URL('/enrollment/interest?appointment=private-2',origin),snapshot);
  assert.deepEqual(calls,['/api/enrollment/classes?appointmentId=private-2',servicingReadinessUrl]);
  calls.length=0;
  preloadEnrollmentNavigation(appointment,{...snapshot,receivedAt:performance.now()-9000});
  assert.deepEqual(calls,['/api/enrollment/classes?appointmentId=private-1',servicingReadinessUrl]);
});

test('leaving a destination before its page mounts cancels both public preloads',async t=>{
  const origin='https://example.invalid';
  const browser={location:new URL(origin+'/chat')} as unknown as Window;
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const signals:AbortSignal[]=[];
  t.mock.method(globalThis,'fetch',(_url:string,{signal}:RequestInit)=>{
    assert.ok(signal);
    signals.push(signal);
    return new Promise<Response>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  });
  preloadEnrollmentNavigation(new URL('/enrollment/demo?apply=1',origin));
  browser.location.href=origin+'/enrollment/demo?apply=1&lang=id';
  const landing=browser.__uperEnrollmentLanding!;
  cancelUnmatchedEnrollmentPreload();
  assert.equal(browser.__uperEnrollmentLanding,landing);
  assert.ok(signals.every(signal=>!signal.aborted));

  browser.location.href=origin+'/enrollment/demo?apply=1&order=fixture';
  cancelUnmatchedEnrollmentPreload();
  assert.equal(browser.__uperEnrollmentLanding,undefined);
  assert.ok(signals.every(signal=>signal.aborted));
  preloadEnrollmentNavigation(new URL(browser.location.href));
  const payment=browser.__uperEnrollmentLanding!;
  assert.equal(payment.classes,undefined);
  assert.equal(payment.availability?.url,servicingReadinessUrl);
  browser.location.search='?apply=1&order=fixture&lang=zh';
  cancelUnmatchedEnrollmentPreload();
  assert.equal(browser.__uperEnrollmentLanding,payment);

  browser.location.href=origin+'/chat';
  cancelUnmatchedEnrollmentPreload();
  assert.equal(browser.__uperEnrollmentLanding,undefined);
  assert.ok(signals.every(signal=>signal.aborted));
  assert.deepEqual(await Promise.all([landing.classes!.response,landing.availability!.response]),[null,null]);
  assert.equal(await payment.availability!.response,null);
});

test('one-to-one navigation reuses only its own selected quote and aborts when the appointment changes',async t=>{
  const origin='https://example.invalid';
  const browser={location:new URL(origin+'/chat')} as unknown as Window;
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const signals:AbortSignal[]=[];
  const request=t.mock.method(globalThis,'fetch',async(path:string,init:RequestInit)=>{
    signals.push(init.signal!);
    return Response.json({classes:[],appointments:[{id:new URL(path,origin).searchParams.get('appointmentId'),
      level:'HSK 1',course:'Test',price:99000,lessons:1,minutes:45}]});
  });
  const pathname='/enrollment/help/one-on-one';
  const first=new URL(pathname+'?appointment=first&email=private&p=fixture',origin);
  preloadEnrollmentNavigation(first);
  preloadEnrollmentNavigation(first);
  browser.location.href=first.href;
  const data=await readEnrollmentLandingData('/api/enrollment/classes?appointmentId=first',new AbortController().signal,parseEnrollmentCatalog,'classes');
  assert.equal(data.appointments[0].id,'first');
  assert.deepEqual(request.mock.calls.map(call=>call.arguments[0]),['/api/enrollment/classes?appointmentId=first']);

  preloadEnrollmentNavigation(first);
  browser.location.href=origin+pathname+'?appointment=second';
  cancelUnmatchedEnrollmentPreload();
  assert.equal(signals[1].aborted,true);
  assert.equal(browser.__uperEnrollmentLanding,undefined);
  const next=await readEnrollmentLandingData('/api/enrollment/classes?appointmentId=second',new AbortController().signal,parseEnrollmentCatalog,'classes');
  assert.equal(next.appointments[0].id,'second');
});

test('same-path class details and application do not share a pending preload',async t=>{
  const url='/api/enrollment/classes?classId=demo';
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  const browser={location:new URL('https://example.invalid/enrollment/demo?apply=1')} as unknown as Window;
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const entry={url,response:Promise.resolve({classes:[]}),receivedAt:performance.now(),cancel:()=>{}};
  browser.__uperEnrollmentLanding={pathname:'/enrollment/demo',application:false,classes:entry};
  const row={id:'demo',level:'HSK 1',price:100,availability:'full'};
  const request=t.mock.method(globalThis,'fetch',async()=>Response.json({classes:[row]}));
  const signal=new AbortController().signal;
  assert.deepEqual((await readEnrollmentLandingData(url,signal,parseEnrollmentCatalog,'classes')).classes,[row]);
  assert.equal(request.mock.callCount(),1);
  browser.__uperEnrollmentLanding={pathname:'/enrollment/demo',application:true,classes:entry};
  assert.deepEqual((await readEnrollmentLandingData(url,signal,parseEnrollmentCatalog,'classes')).classes,[]);
  assert.equal(request.mock.callCount(),1);
});

test('leaving a class view or timing out discards its pending preload before retry',async t=>{
  const url='/api/enrollment/classes?classId=demo';
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  const location=new URL('https://example.invalid/enrollment/demo');
  const browser={location} as unknown as Window;
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({classes:[]}));
  for(const leave of [true,false]){
    const controller=new AbortController();
    // The consumer must stop waiting even if the transport is still settling.
    const response=new Promise<null>(()=>{});
    const cancel=t.mock.fn();
    browser.__uperEnrollmentLanding={pathname:location.pathname,classes:{url,response,cancel}};
    const read=readEnrollmentLandingData(url,controller.signal,parseEnrollmentCatalog,'classes');
    if(leave)location.search='?apply=1';
    controller.abort(new DOMException('Read interrupted',leave?'AbortError':'TimeoutError'));
    await assert.rejects(read,{name:leave?'AbortError':'TimeoutError'});
    assert.equal(cancel.mock.callCount(),1);
    assert.equal(browser.__uperEnrollmentLanding.classes,undefined);
    location.search='';
  }
  assert.equal(fetch.mock.callCount(),0);
  assert.deepEqual(await readEnrollmentLandingData(url,new AbortController().signal,parseEnrollmentCatalog,'classes'),
    {classes:[],appointments:[]});
  assert.equal(fetch.mock.callCount(),1);
});

test('an aborted same-page reader leaves its request available for the replacement reader',async t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  const location=new URL('https://example.invalid/enrollment');
  const browser={location} as unknown as Window;
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({classes:[]}));
  const cancel=t.mock.fn();
  let finish!:(data:unknown)=>void;
  const entry={url:enrollmentCatalogUrl,response:new Promise<unknown>(resolve=>{finish=resolve;}),receivedAt:performance.now(),cancel};
  browser.__uperEnrollmentLanding={pathname:location.pathname,classes:entry};
  const controller=new AbortController();
  const read=readEnrollmentLandingData(enrollmentCatalogUrl,controller.signal,parseEnrollmentCatalog,'classes');
  controller.abort();
  await assert.rejects(read,{name:'AbortError'});
  assert.equal(browser.__uperEnrollmentLanding.classes,entry);
  const replacement=readEnrollmentLandingData(enrollmentCatalogUrl,new AbortController().signal,parseEnrollmentCatalog,'classes');
  const row={id:'demo',level:'HSK 1',price:100,availability:'full'};
  finish({classes:[row]});
  assert.deepEqual((await replacement).classes,[row]);
  assert.equal(cancel.mock.callCount(),0);
  assert.equal(fetch.mock.callCount(),0);
});

test('catalog data distinguishes an empty result from malformed class or appointment rows', () => {
  assert.deepEqual(parseEnrollmentCatalog({ classes: [] }), { classes: [], appointments: [] });
  const row = { id: 'sample-class', level: 'HSK 1', price: 0 };
  assert.deepEqual(parseEnrollmentCatalog({ classes: [row] }).classes, [row]);
  assert.throws(() => parseEnrollmentCatalog({ classes: [null] }), /Invalid enrollment classes/);
  assert.throws(() => parseEnrollmentCatalog({ classes: [{ ...row, level: null }] }), /Invalid enrollment classes/);
  for (const fields of [{ schedule: { text: 'Monday' } }, { learningOutcomes: ['HSK 1'] },
    { material: {} }, { resources: {} }, { teacher: 5 }, { availability: 'unknown' },
    {firstLesson:{toString:1}}, {format:[]}, {period:{}}, {sessions:'12'},
    {minutes:{}}, {classSize:{maximum:null}}, {standardPrice:'999'}]) {
    assert.throws(() => parseEnrollmentCatalog({ classes: [{ ...row, ...fields }] }), /Invalid enrollment classes/);
  }
  assert.deepEqual(parseEnrollmentCatalog({ classes: [{ ...row, availability: 'full', schedule: '' }] }).classes,
    [{ ...row, availability: 'full', schedule: '' }]);
  assert.throws(() => parseEnrollmentCatalog({ classes: [], appointments: [{ id: 'one', course: 'HSK' }] }),
    /Invalid enrollment appointments/);
  const appointment={id:'one',level:'HSK 1',course:'HSK',teacherType:'local',lessons:1,minutes:45,price:99000,standardPrice:120000};
  assert.deepEqual(parseEnrollmentCatalog({classes:[],appointments:[appointment]}).appointments,[appointment]);
  assert.throws(()=>parseEnrollmentCatalog({classes:[],appointments:[{...appointment,teacherType:{}}]}),/Invalid enrollment appointments/);
});

test('readiness data preserves existing order access and rejects malformed flags and reasons', () => {
  assert.deepEqual(parseEnrollmentReadiness({ accepting: false, servicing: true, reasons: ['bank_missing'] }),
    { accepting: false, servicing: true, reasons: ['bank_missing'] });
  assert.deepEqual(parseEnrollmentReadiness({ accepting: true }),
    { accepting: true, servicing: true, reasons: ['check_failed'] });
  for (const value of [{}, { accepting: 'true' }, { accepting: true, servicing: 'false' },
    { accepting: false, reasons: 'bank_missing' }, { accepting: false, reasons: [null] }]) {
    assert.throws(() => parseEnrollmentReadiness(value), /Invalid enrollment readiness/);
  }
});

test('invalid enrollment preloads use one validated fresh read without repeating valid or canceled reads', async t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  const browser={location:new URL('https://example.invalid/enrollment')} as unknown as Window;
  Object.defineProperty(globalThis,'window',{configurable:true,value:browser});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
  const entry=(url:string,data:unknown)=>({url,response:Promise.resolve(data),receivedAt:performance.now(),cancel:()=>{}});
  browser.__uperEnrollmentLanding={pathname:'/enrollment',classes:entry(enrollmentCatalogUrl,{classes:[]}),
    availability:entry(intakeReadinessUrl,{accepting:'true'})};
  const signal=new AbortController().signal;
  const request=t.mock.method(globalThis,'fetch',async (path:string,init:RequestInit)=>{
    assert.equal(path,intakeReadinessUrl);
    assert.equal(init.cache,'no-store');
    assert.equal(init.signal,signal);
    return Response.json({accepting:false,servicing:true,reasons:['bank_missing']});
  });
  assert.deepEqual(await readEnrollmentLandingData(enrollmentCatalogUrl,signal,parseEnrollmentCatalog,'classes'),{classes:[],appointments:[]});
  assert.equal(request.mock.callCount(),0);
  assert.deepEqual(await readEnrollmentLandingData(intakeReadinessUrl,signal,parseEnrollmentReadiness,'availability'),
    {accepting:false,servicing:true,reasons:['bank_missing']});
  assert.equal(request.mock.callCount(),1);
  browser.__uperEnrollmentLanding.availability=entry(intakeReadinessUrl,{accepting:'true'});
  await assert.rejects(readEnrollmentLandingData(intakeReadinessUrl,AbortSignal.abort(),parseEnrollmentReadiness,'availability'),{name:'AbortError'});
  assert.equal(request.mock.callCount(),1);
  request.mock.mockImplementation(async()=>Response.json({accepting:'true'}));
  await assert.rejects(readEnrollmentLandingData(intakeReadinessUrl,signal,parseEnrollmentReadiness,'availability'),/Invalid enrollment readiness/);
  assert.equal(request.mock.callCount(),2);
});

test('a failed preload does not issue another request while offline and can read after reconnect',async t=>{
  const browser={location:new URL('https://example.invalid/enrollment')} as unknown as Window;
  const network={onLine:false};
  for(const [key,value] of [['window',browser],['navigator',network]] as const){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  const request=t.mock.method(globalThis,'fetch',async()=>Response.json({classes:[]}));
  preloadEnrollmentNavigation(browser.location as unknown as URL);
  assert.equal(request.mock.callCount(),0);
  const entry={url:enrollmentCatalogUrl,response:Promise.resolve(null),cancel:()=>{}};
  browser.__uperEnrollmentLanding={pathname:'/enrollment',classes:entry};
  const read=()=>readEnrollmentLandingData(enrollmentCatalogUrl,new AbortController().signal,parseEnrollmentCatalog,'classes');
  await assert.rejects(read());
  assert.equal(request.mock.callCount(),0);
  assert.equal(browser.__uperEnrollmentLanding.classes,undefined);
  network.onLine=true;
  assert.deepEqual(await read(),{classes:[],appointments:[]});
  assert.equal(request.mock.callCount(),1);
});

test('class-detail batches deduplicate IDs and retain usable rows when one batch fails',async t=>{
  const ids=Array.from({length:41},(_,index)=>'class-'+index);
  const row={id:ids[0],level:'HSK 1',price:300000};
  const signal=new AbortController().signal;
  const batches:string[][]=[];
  t.mock.method(globalThis,'fetch',async (path:string,init?:RequestInit)=>{
    const requested=new URL(path,'http://localhost').searchParams.getAll('classId');
    batches.push(requested);
    assert.equal(init?.signal,signal);
    return requested.length===40
      ? Response.json({classes:[row,row,null,{id:ids[1]},{...row,id:ids[2],schedule:{}},{...row,id:'unrequested'}]})
      : new Response(null,{status:503});
  });
  assert.deepEqual(await readEnrollmentClassDetails([...ids,ids[0]],signal),[row]);
  assert.deepEqual(batches,[ids.slice(0,40),ids.slice(40)]);
});

test('class reads report only recoverable failures to reconnect callers',async t=>{
  const fetcher=t.mock.method(globalThis,'fetch',async()=>Response.json({}, {status:503}));
  const controller=new AbortController();
  const failures:string[][]=[];
  const options={onTemporaryFailure:(ids:readonly string[])=>{failures.push([...ids]);}};
  const read=()=>readEnrollmentClassDetails(['fixture'],controller.signal,options);
  assert.deepEqual(await read(),[]);
  assert.equal(failures.length,1);
  fetcher.mock.mockImplementation(async()=>{throw new TypeError('offline');});
  assert.deepEqual(await read(),[]);
  assert.equal(failures.length,2);
  for(const response of [()=>Response.json({}, {status:404}),()=>Response.json({classes:[]}),()=>new Response('<html>')]){
    fetcher.mock.mockImplementation(async()=>response());
    assert.deepEqual(await read(),[]);
  }
  assert.equal(failures.length,2);
  fetcher.mock.mockImplementation(async()=>Response.json({classes:null}));
  assert.deepEqual(await read(),[]);
  assert.equal(failures.length,3);
  const valid={id:'fixture',level:'HSK 1',price:300000};
  fetcher.mock.mockImplementation(async()=>Response.json({classes:[valid,{id:'malformed',price:null}]}));
  assert.deepEqual(await readEnrollmentClassDetails(['fixture','malformed'],controller.signal,options),[valid]);
  assert.equal(failures.length,4);
  assert.deepEqual(failures.at(-1),['malformed']);
  fetcher.mock.mockImplementation(async()=>new Response('{"classes":[',{headers:{'Content-Type':'application/json; charset=utf-8'}}));
  assert.deepEqual(await read(),[]);
  assert.equal(failures.length,5);
  fetcher.mock.mockImplementation(async()=>{controller.abort();throw new DOMException('Canceled','AbortError');});
  assert.deepEqual(await read(),[]);
  assert.equal(failures.length,5);
  const deadline=new AbortController();
  fetcher.mock.mockImplementation(async()=>{deadline.abort(new DOMException('Timed out','TimeoutError'));throw deadline.signal.reason;});
  assert.deepEqual(await readEnrollmentClassDetails(['fixture'],deadline.signal,options),[]);
  assert.deepEqual(failures,[['fixture'],['fixture'],['fixture'],['malformed'],['fixture'],['fixture']]);
});

test('a completed class batch is available before another batch times out', async t => {
  const ids = Array.from({ length: 41 }, (_, index) => 'class-' + index);
  const row = { id: ids[0], level: 'HSK 1', price: 300000 };
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (path: string) => {
    const query = new URL(path, 'http://localhost').searchParams;
    assert.equal(query.get('availability'), '0');
    if (query.get('classId') === ids[0]) return Response.json({ classes: [row] });
    return new Promise<Response>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    });
  });
  const batches: unknown[][] = [];
  const result = readEnrollmentClassDetails(ids, controller.signal, {
    includeAvailability: false,
    onBatch: rows => batches.push(rows),
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(batches, [[row]]);
  controller.abort(new DOMException('Timed out', 'TimeoutError'));
  assert.deepEqual(await result, [row]);
  assert.deepEqual(batches, [[row]]);
});

test('the public catalog reader skips seat counts only for scoped metadata requests',async t=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentCatalog}=await import('../server/portal/enrollmentCatalog');
  const {operationContext}=await import('../server/portal/operationContext');
  type Handler=(request:{query:Record<string,unknown>},response:unknown)=>Promise<void>;
  const routes=new Map<string,Handler>();
  mountEnrollmentCatalog({get:(path:string,handler:Handler)=>routes.set(path,handler),post:()=>{}} as never,
    {wrap:handler=>handler,staff:async()=>({id:'fixture'})});
  const handler=routes.get('/api/enrollment/classes')!;
  const calls:unknown[][]=[];
  let teaching:unknown;
  const descriptions={learningOutcomes:'Fixture outcomes',material:'Fixture materials',resources:'Fixture resources',teacher:'Fixture teacher'};
  const client={query:async(sql:string,parameters:unknown[])=>{
    calls.push(parameters);
    if(sql.includes('template, c.value'))return {rows:[]};
    assert.match(sql,/CASE WHEN :p3=1/);
    assert.match(sql,/CASE WHEN :p4=1 THEN JSON_REMOVE\(e\.data,'\$\.learningOutcomes','\$\.material','\$\.resources','\$\.teacher'\)/);
    return {rows:[{id:'class-fixture',data:{level:'HSK 1',format:'standard',capacity:15,...(parameters[3]===1?{}:descriptions)},opened:1,
      seats:parameters[2]===1?13:null,teaching:parameters[3]===0?teaching:null}]};
  }};
  const handle=async(query:Record<string,unknown>)=>{
    let payload!: {classes:{availability?:string}[];appointments:unknown[]};
    await handler({query},{
      set:(name:string,value:string)=>{
        assert.equal(name,'Cache-Control');assert.equal(value,'no-store');
        return {json:(data:typeof payload)=>{payload=data;}};
      },
    });
    return payload;
  };
  const invoke=(query:Record<string,unknown>)=>operationContext.run(client,()=>handle(query));
  assert.equal((await invoke({classId:['class-fixture','class-fixture'],availability:'0'})).classes[0].availability,undefined);
  assert.deepEqual(calls.splice(0),[[1,['class-fixture'],0,0]]);
  const detail=(await invoke({classId:'class-fixture',view:'summary'})).classes[0];
  assert.equal(detail.availability,'limited');
  for(const [key,value] of Object.entries(descriptions))assert.equal(Reflect.get(detail,key),value);
  assert.deepEqual(calls.splice(0),[[1,['class-fixture'],1,0]]);
  const all=(await invoke({availability:'0'})).classes[0];
  assert.equal(all.availability,'limited');
  for(const [key,value] of Object.entries(descriptions))assert.equal(Reflect.get(all,key),value);
  assert.deepEqual(calls.splice(0),[[null,[],1,0],['enrollment\\_template:%',null]]);
  const summary=(await invoke({view:'summary'})).classes[0];
  assert.equal(summary.availability,'limited');
  for(const key of Object.keys(descriptions))assert.equal(Object.hasOwn(summary,key),false);
  assert.equal(Reflect.get(summary,'opened'),true);
  assert.deepEqual(Reflect.get(summary,'classSize'),{maximum:15,usualMinimum:10});
  assert.deepEqual(calls.splice(0),[[null,[],1,1],['enrollment\\_template:%',null]]);
  assert.deepEqual((await invoke({appointmentId:'fixture'})).classes,[]);
  assert.deepEqual(calls.splice(0),[['enrollment\\_template:%','enrollment_template:fixture']]);
  await assert.rejects(invoke({classId:'class-fixture',appointmentId:'fixture'}),/enrollment_template_invalid/);
  assert.equal(calls.length,0);


  teaching={level:'HSK 1',material:'Live textbook',knowledge:'Live topics',learningOutcomes:'Live outcomes',
    resources:'Live practice',introduction:{en:{audience:'Beginners'},id:{audience:'Pemula'}}};
  const courseDetail=(await invoke({classId:'class-fixture'})).classes[0];
  assert.deepEqual(Reflect.get(courseDetail,'introduction'),{en:{audience:'Beginners'},id:{audience:'Pemula'}});
  assert.equal(Reflect.get(courseDetail,'learningOutcomes'),'Live outcomes');
  assert.equal(Reflect.get(courseDetail,'material'),'Live textbook\nLive topics');
  assert.equal(Object.hasOwn((await invoke({view:'summary'})).classes[0],'introduction'),false);
  teaching={...teaching as object,level:'HSK 2'};
  assert.equal(Object.hasOwn((await invoke({classId:'class-fixture'})).classes[0],'introduction'),false);
  calls.splice(0);

  const {nativePool}=await import('../cloud/mysql/runtime.mjs');
  const steps:string[]=[];
  let unavailable=false;
  t.mock.method(nativePool,'getConnection',async()=>({
    query:async(sql:string)=>{assert.equal(sql,"SET time_zone='+00:00'");steps.push('connection setup');},
    execute:async(sql:string,parameters:unknown[])=>{
      const appointment=sql.includes('template, c.value');
      steps.push(appointment?'appointment select':'class select');
      assert.ok(parameters.includes(appointment?'enrollment_template:fixture':'class-fixture'));
      if(unavailable)throw Error('fixture read failed');
      return [[]];
    },
    beginTransaction:async()=>{steps.push('begin');},
    commit:async()=>{steps.push('commit');},
    rollback:async()=>{steps.push('rollback');},
    release:()=>steps.push('release'),
  }));
  assert.deepEqual((await handle({classId:'class-fixture'})).classes,[]);
  assert.deepEqual(steps.splice(0),['connection setup','class select','release']);
  assert.deepEqual((await handle({appointmentId:'fixture'})).appointments,[]);
  assert.deepEqual(steps.splice(0),['connection setup','appointment select','release']);
  unavailable=true;
  await assert.rejects(handle({classId:'class-fixture'}),/fixture read failed/);
  assert.deepEqual(steps,['connection setup','class select','release']);
});
