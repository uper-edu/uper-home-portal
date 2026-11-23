import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {enrollmentLandingTimeoutMs} from '../src/services/enrollmentClassDetails';
import {matchesEnrollmentLanding,type EnrollmentLanding} from '../src/services/enrollmentLandingState';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const preload = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .find(([,script]) => script.includes('window.__uperEnrollmentLanding'))?.[1];
assert.ok(preload);

function initialRequests(url: string, online=true, window: {__uperEnrollmentLanding?:EnrollmentLanding} = {}) {
  const requests: string[] = [];
  runInNewContext(preload!, {
    location: new URL(url, 'https://example.invalid'),
    window, navigator:{onLine:online}, URLSearchParams, AbortController, performance, clearTimeout,
    setTimeout: (callback:()=>void, delay:number) => {
      assert.equal(delay, enrollmentLandingTimeoutMs);
      return setTimeout(callback, delay);
    },
    // Simulate a WebView without AbortSignal.any or AbortSignal.timeout.
    AbortSignal: {},
    fetch: async (path: string, options: RequestInit) => {
      assert.equal(options.cache, 'no-store');
      assert.equal(options.signal?.aborted, false);
      requests.push(path);
      return Response.json({});
    },
  });
  return requests;
}

test('a cached enrollment page opened offline skips startup requests',()=>{
  assert.deepEqual(initialRequests('/enrollment?lang=zh&p=fixture',false),[]);
});

test('direct catalog, class details and class application preload only their public data', () => {
  assert.deepEqual(initialRequests('/enrollment/?lang=id'), ['/api/enrollment/classes?view=summary','/api/enrollment/availability']);
  for (const path of ['/enrollment/demo%2Dclass?lang=en','/enrollment/demo-class?apply=1']) {
    assert.deepEqual(initialRequests(path), ['/api/enrollment/classes?classId=demo-class','/api/enrollment/availability']);
  }
});

test('preload skips support, private, preview, malformed and unrelated URLs', () => {
  for (const path of ['/chat','/link',
    '/enrollment/assist','/enrollment/mine/other/fixture','/enrollment/help/one-on-one',
    '/enrollment/demo-class?view=rules','/enrollment/demo-class?learnerPreview=fixture',
    '/enrollment/bad%2Fid','/enrollment/%Z']) {
    assert.deepEqual(initialRequests(path), [], path);
  }
});

test('direct course preference landing starts only public intake readiness', () => {
  assert.deepEqual(initialRequests('/enrollment/interest?level=2&p=fixture'), ['/api/enrollment/availability']);
});

test('direct one-to-one quote landing preloads only the selected appointment', () => {
  assert.deepEqual(initialRequests('/enrollment/help/one-on-one/?appointment=demo-quote&lang=zh&p=fixture'),
    ['/api/enrollment/classes?appointmentId=demo-quote']);
  for (const query of ['', '?appointment=bad%2Fid', '?appointment=demo&learnerPreview=private']) {
    assert.deepEqual(initialRequests('/enrollment/help/one-on-one'+query), []);
  }
});

test('payment and enrollment history preload the public service flag without sending private IDs', () => {
  for (const path of ['/enrollment/payment?order=private','/enrollment/mine','/enrollment/%6dine','/enrollment/demo-class?apply=1&order=private',
    '/enrollment/mine/waitlist/private-id?p=fixture','/enrollment/mine/demands/private-id/']) {
    assert.deepEqual(initialRequests(path), ['/api/enrollment/availability?scope=servicing']);
  }
  const window:{__uperEnrollmentLanding?:EnrollmentLanding}={};
  initialRequests('/enrollment/demo-class?apply=1&order=private',true,window);
  const landing=window.__uperEnrollmentLanding!;
  const url=(search:string)=>({pathname:'/enrollment/demo-class',search});
  assert.equal(matchesEnrollmentLanding(landing,url('?apply=1&order=private&lang=zh')),true);
  assert.equal(matchesEnrollmentLanding(landing,url('?apply=1')),false);
});

test('preload records when usable data arrived and leaves failed responses without a timestamp', async () => {
  const window: {__uperEnrollmentLanding?: Record<string, {response:Promise<unknown>;receivedAt?:number}>} = {};
  let now = 0;
  let resolveCatalog!: (response:Response) => void;
  runInNewContext(preload!, {
    location: new URL('https://example.invalid/enrollment'), window, navigator:{onLine:true}, URLSearchParams,
    AbortController, performance:{now:()=>now}, setTimeout, clearTimeout,
    fetch: (path:string) => path==='/api/enrollment/classes?view=summary'
      ? new Promise(resolve => { resolveCatalog = resolve; })
      : Promise.resolve(new Response(null, {status:503})),
  });
  const {classes, availability} = window.__uperEnrollmentLanding!;
  assert.equal(classes.receivedAt, undefined);
  now = 4100;
  resolveCatalog(Response.json({classes:[]}));
  assert.deepEqual(await classes.response, {classes:[]});
  assert.equal(classes.receivedAt, 4100);
  assert.equal(await availability.response, null);
  assert.equal(availability.receivedAt, undefined);
});
