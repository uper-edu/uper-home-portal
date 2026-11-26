import assert from 'node:assert/strict';
import test from 'node:test';
import {parseEnrollmentFunnelReport,readEnrollmentFunnel,storeEnrollmentFunnel} from '../server/portal/operationsDashboardEnrollmentFunnel.ts';

const now=Date.parse('2026-11-26T04:00:00.000Z');
const from='2026-11-20',to='2026-11-24';
const fetchedAt='2026-11-26T03:00:00.000Z';
const campaign={source:'instagram',medium:'paid_social',campaignId:'fall-hsk',campaign:'fall-hsk-1',
  landed:'10',viewedClass:'4',started:'6',reserved:'3',savedProof:'1'};
const day={version:'1',environment:'dev',streamId:'16251883595',date:from,fetchedAt,missingSessionViews:'2',campaigns:[campaign]};

test('enrollment funnel keeps the optional class view independent and accepts explicit zero days',()=>{
  const [first,zero]=parseEnrollmentFunnelReport([{...day,date:to,campaigns:[]},day],'dev',now);
  assert.equal(first.date,from);
  assert.equal(first.missingSessionViews,2);
  assert.equal(first.campaigns[0].started,6);
  assert.equal(first.campaigns[0].viewedClass,4);
  assert.deepEqual(zero.campaigns,[]);
});

test('enrollment funnel rejects mismatched streams, incomplete days, duplicate rows and invalid sequences',()=>{
  for(const report of [
    [{...day,streamId:'16252453328'}],
    [{...day,environment:'test'}],
    [{...day,date:'2026-11-25'}],
    [{...day,date:'2026-11-31'}],
    [{...day,fetchedAt:'2026-11-26T05:00:00.000Z'}],
    [day,day],
    [{...day,campaigns:[campaign,{...campaign,source:'INSTAGRAM'}]}],
    [{...day,campaigns:[{...campaign,source:'hidden@example.com'}]}],
    [{...day,campaigns:[{...campaign,viewedClass:11}]}],
    [{...day,campaigns:[{...campaign,reserved:7}]}],
    [{...day,campaigns:[{...campaign,savedProof:4}]}],
  ])assert.throws(()=>parseEnrollmentFunnelReport(report,'dev',now),/Invalid GA4 enrollment funnel report|valid YYYY-MM-DD dates/);
});

test('enrollment funnel aggregates by environment, keeps coverage gaps and ignores older extracts',async()=>{
  type Day=ReturnType<typeof parseEnrollmentFunnelReport>[number];
  const saved=new Map<string,Day>();
  const db={async query(sql:string,parameters:unknown[]=[]){
    if(sql.startsWith('INSERT')){
      const [key,value,at]=parameters as [string,Day,string];
      if(!saved.has(key)||saved.get(key)!.fetchedAt<at)saved.set(key,value);
      return {rows:[]};
    }
    const [first,last]=parameters as string[];
    return {rows:[...saved].filter(([key])=>key>=first&&key<=last).map(([,value])=>({value}))};
  }};
  const ingest=(input:unknown)=>storeEnrollmentFunnel(db,'dev',parseEnrollmentFunnelReport(input,'dev',now));
  await ingest([day,{...day,date:'2026-11-22',campaigns:[{...campaign,campaign:'fall-hsk-2'}]},
    {...day,date:to,missingSessionViews:0,campaigns:[]}]);
  await ingest([{...day,fetchedAt:'2026-11-26T01:00:00.000Z',campaigns:[]}]);
  const report=await readEnrollmentFunnel(db,'dev',from,to,now);
  assert.equal(report?.coveredDays,3);
  assert.equal(report?.expectedDays,5);
  assert.deepEqual([report?.firstCovered,report?.lastCovered],[from,to]);
  assert.equal(report?.missingSessionViews,4);
  assert.deepEqual(report?.totals,{landed:20,viewedClass:8,started:12,reserved:6,savedProof:2});
  assert.equal(report?.campaigns.length,1);
  assert.equal(report?.channels[0].landed,20);
  assert.equal((await readEnrollmentFunnel(db,'dev',to,to,now))?.totals.landed,0);
  assert.equal(await readEnrollmentFunnel(db,'dev','2026-11-21','2026-11-21',now),null);
  assert.equal(await readEnrollmentFunnel(db,'test',from,to,now),null);
});
