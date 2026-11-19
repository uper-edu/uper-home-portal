import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { enrollmentGuideHref, enrollmentDemandPrefill } from '../src/utils/enrollmentGuidance';
import { resolveMetadata } from '../src/utils/siteMetadata';

const suite=JSON.parse(readFileSync(new URL('./fixtures/chat-consultation-v1.json',import.meta.url),'utf8'));
const baseline=JSON.parse(readFileSync(new URL('./fixtures/chat-consultation-baseline.json',import.meta.url),'utf8'));

test('consultation baseline includes the original cases, independent retests and holdouts',()=>{
  assert.equal(baseline.firstBlindRun.modelReplies,42);
  assert.ok(suite.cases.length>=30);
  assert.equal(new Set(suite.cases.map((entry:{id:string})=>entry.id)).size,suite.cases.length);
  assert.ok(suite.cases.every((entry:{turns:string[];expected:string[]})=>
    entry.turns.length>=3&&entry.turns.length<=5&&entry.expected.length>=2));
  assert.ok(suite.cases.some((entry:{source?:string})=>entry.source==='homepage_widget'));
  assert.ok(suite.cases.some((entry:{holdout?:boolean})=>entry.holdout));
  assert.equal(suite.thresholds.severeFailures,0);
});

test('each consultation next step uses a known route and strips private data from its URL',()=>{
  const source=new URLSearchParams('p=sample&phone=123&email=not-used@example.invalid');
  const target=(kind:'demand'|'waitlist'|'quote'|'advisor'|'appointment'|'records')=>new URL(enrollmentGuideHref(
    {kind,level:'HSK 1',period:'weekend',format:'standard',classId:'fixture-class',offline:true},'zh','ai_chat',source),'https://example.invalid');
  assert.deepEqual(enrollmentDemandPrefill(target('demand').searchParams),{level:'HSK 1',period:'weekend',format:'standard',notes:'',phone:''});
  assert.equal(target('demand').pathname,'/enrollment/interest');
  assert.equal(target('waitlist').searchParams.get('apply'),'1');
  assert.equal(target('advisor').searchParams.get('mode'),'offline');
  assert.equal(target('records').pathname,'/enrollment/mine');
  for(const kind of ['demand','waitlist','quote','advisor','appointment','records'] as const){
    const url=target(kind);
    assert.equal(url.searchParams.get('p'),'sample');
    assert.equal(url.searchParams.get('lang'),'zh');
    assert.equal(url.searchParams.has('phone')||url.searchParams.has('email'),false);
    assert.equal(resolveMetadata(url.pathname,'zh').status,200);
  }
  assert.equal(resolveMetadata('/enrollment/help/consultation','zh').indexable,false);
  assert.equal(resolveMetadata('/enrollment/help/random','zh').status,404);
});

test('a human handoff retains known public course preferences without placing personal data in its URL',()=>{
  const next=new URL(enrollmentGuideHref({kind:'advisor',level:'HSK 2',period:'weekend',format:'one-on-one'},
    'zh','ai_chat',new URLSearchParams('phone=123&email=guest@example.invalid&message=private')), 'https://example.invalid');
  assert.equal(next.pathname,'/enrollment/help/consultation');
  assert.equal(next.searchParams.get('level'),'2');
  assert.equal(next.searchParams.get('period'),'weekend');
  assert.equal(next.searchParams.get('format'),'one-on-one');
  assert.ok(['phone','email','message'].every(field=>!next.searchParams.has(field)));
});

test('reply language validation falls back safely and the standard suite covers language overrides',async()=>{
  const {enrollmentReplyLanguage}=await import('../src/utils/enrollmentGuidance');
  assert.equal(enrollmentReplyLanguage('id','en'),'id');
  assert.equal(enrollmentReplyLanguage('zh','en'),'zh');
  assert.equal(enrollmentReplyLanguage('en','zh'),'en');
  assert.equal(enrollmentReplyLanguage('unsupported','zh'),'zh');
  assert.equal(suite.cases.find((entry:{id:string})=>entry.id==='37')?.interfaceLanguage,'en');
});
