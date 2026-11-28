import assert from 'node:assert/strict';
import test from 'node:test';
import {syncTestEnrollmentFunnel,testEnrollmentFunnelBigQuery,testFunnelProject} from '../server/portal/operationsDashboardEnrollmentFunnelSync.ts';

function harness(reportDate='2026-11-29',environment:'dev'|'test'='test'){
  let now=Date.parse(reportDate+'T08:00:00.000Z');
  const tableRevisions=new Map<string,string>();
  const saved=new Map<string,{date:string;sourceRevision:string}>();
  const queries:string[][]=[];
  const inspected:string[]=[];
  let mismatched=false;
  const client={async query(sql:string,args:unknown[]=[]){
    if(sql.startsWith('INSERT')){
      const day=args[1] as {date:string;sourceRevision:string};
      saved.set(day.date,day);
      return {rows:[]};
    }
    return {rows:[...saved.values()].map(value=>({value}))};
  }};
  function run(preview=false){
    return syncTestEnrollmentFunnel({db:client,transaction:work=>work(client)},{
      async tableRevision(day){inspected.push(day);return tableRevisions.get(day)??null;},
      async readReport(from,to){
        queries.push([from,to]);
        return [...tableRevisions.keys()].sort().filter(day=>day>=from&&day<=to).map(day=>({
          version:'1',date:day,environment,streamId:(environment==='dev')!==mismatched?'16251883595':'16252453328',
          fetchedAt:new Date(now).toISOString(),missingSessionViews:'0',campaigns:[],
        }));
      },
    },{clock:()=>now,preview,environment});
  }
  return {tableRevisions,saved,queries,inspected,run,rejectOtherStream(){mismatched=true;},
    advance(){now+=86_400_000;}};
}

test('a new daily table is observed before the following-day window and is never imported early',async()=>{
  const h=harness('2026-11-28');
  h.tableRevisions.set('2026-11-26','before-start');
  h.tableRevisions.set('2026-11-27','first');
  assert.deepEqual(await h.run(),{observed:['2026-11-27'],pending:[],synced:[],preview:false});
  assert.deepEqual(h.inspected,['2026-11-27']);
  h.advance();
  assert.deepEqual((await h.run()).pending,['2026-11-27']);
  assert.deepEqual(h.queries,[]);
  assert.equal(h.saved.size,0);
});

test('only changed complete cohorts in the three-day window are saved, including late next-day events',async()=>{
  const h=harness('2026-12-01');
  for(const day of ['26','27','28','29','30'])h.tableRevisions.set('2026-11-'+day,day);
  const days=['2026-11-27','2026-11-28','2026-11-29'];
  assert.deepEqual((await h.run(true)).synced,days);
  assert.equal(h.saved.size,0);
  assert.deepEqual((await h.run()).synced,days);
  assert.deepEqual([...h.saved.keys()],days);
  assert.deepEqual((await h.run()).synced,[]);
  assert.equal(h.queries.length,2);
  h.tableRevisions.set('2026-11-30','late-revision');
  assert.deepEqual((await h.run()).synced,['2026-11-29']);
  assert.deepEqual(h.queries.at(-1),['2026-11-29','2026-11-29']);
  assert.equal(h.saved.get('2026-11-29')?.sourceRevision,'29/late-revision');
});

test('a report from UPER Local is rejected before writing against company test',async()=>{
  const h=harness();
  h.tableRevisions.set('2026-11-27','1');
  h.tableRevisions.set('2026-11-28','2');
  h.rejectOtherStream();
  await assert.rejects(h.run(),/Invalid GA4 enrollment funnel report/);
  assert.equal(h.saved.size,0);
});

test('BigQuery checks the named daily table and queries only the test project and UPER Staging stream',async()=>{
  const requests:{url:string;init?:RequestInit}[]=[];
  const mock=async (url:string,init?:RequestInit)=>{
    requests.push({url,init});
    if(url.includes('/tables/'))return new Response('{"tableReference":{"projectId":"'+testFunnelProject+'","datasetId":"analytics_561827503","tableId":"events_20261127"},"type":"TABLE","lastModifiedTime":"1","etag":"a"}');
    return new Response(JSON.stringify({jobComplete:true,schema:{fields:[{name:'date',type:'STRING'}]},rows:[{f:[{v:'2026-11-27'}]}]}));
  };
  const api=testEnrollmentFunnelBigQuery('fake-token','SELECT 1 FROM ANALYTICS_DATASET',mock as typeof fetch);
  assert.equal(await api.tableRevision('2026-11-27'),'1::a');
  assert.deepEqual(await api.readReport('2026-11-27','2026-11-27'),[{date:'2026-11-27'}]);
  assert.ok(requests.every(({url,init})=>url.startsWith('https://bigquery.googleapis.com/bigquery/v2/projects/'+testFunnelProject+'/')&&init?.redirect==='error'));
  const request=JSON.parse(String(requests[1].init?.body));
  assert.equal(request.maximumBytesBilled,'50000000');
  assert.ok(request.query.includes(testFunnelProject+'.analytics_561827503'));
  assert.equal(request.queryParameters.find((p:{name:string})=>p.name==='streamId').parameterValue.value,'16252453328');
});

test('UPER Local imports the latest eligible day and revisits changed revisions',async()=>{
  const h=harness('2026-11-28','dev');
  h.tableRevisions.set('2026-11-26','first');
  h.tableRevisions.set('2026-11-27','overnight');
  assert.deepEqual((await h.run()).synced,['2026-11-26']);
  assert.deepEqual((await h.run()).synced,[]);
  h.tableRevisions.set('2026-11-27','updated');
  assert.deepEqual((await h.run()).synced,['2026-11-26']);
  assert.equal(h.saved.get('2026-11-26')?.sourceRevision,'first/updated');
});
