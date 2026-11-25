import assert from 'node:assert/strict';
import test from 'node:test';
import {fetchGaTraffic,readGaTraffic,storeGaTraffic,trafficEnvironment} from '../server/portal/operationsDashboardTraffic.ts';
import {dashboardReportingDates} from '../src/utils/crmOperationsDashboard.ts';

const now=Date.parse('2026-11-25T03:00:00Z');
const from='2026-11-21',to='2026-11-23';
const makeRow=(sessionCount:number,...values:string[])=>({dimensionValues:values.map(value=>({value})),
  metricValues:[{value:String(sessionCount)}]});
const daily=[makeRow(10,'20261121'),makeRow(5,'20261122')];
const detail=[
  makeRow(6,'20261121','instagram','paid_social','/enrollment'),
  makeRow(4,'20261121','(direct)','(none)','/chat/'),
  makeRow(1,'20261122','instagram','paid_social','/link'),
  makeRow(2,'20261122','hidden@example.com','referral','/enrollment/payment'),
  makeRow(2,'20261122','(not set)','(not set)','(not set)'),
];

function fakeGa({
  totals=daily,entries=detail,deviceEntries,meta={},rowCount,
}: {totals?:typeof daily;entries?:typeof detail;deviceEntries?:typeof detail;meta?:object;rowCount?:number}={}){
  const requests:{url:string;filter:any;headers:any}[]=[];
  const request:typeof fetch=async (url,init)=>{
    const body=JSON.parse(String(init?.body));
    requests.push({url:String(url),filter:body.dimensionFilter,headers:init?.headers});
    const rows=body.dimensions.length===1?totals:body.dimensions.length===4?entries:deviceEntries??
      entries.map(({dimensionValues,metricValues},index)=>makeRow(Number(metricValues[0].value),
        dimensionValues[0].value,index===0?'mobile':'desktop',dimensionValues[3].value));
    return Response.json({dimensionHeaders:body.dimensions,metricHeaders:[{name:'sessions'}],
      rows,rowCount:rowCount??rows.length,metadata:{timeZone:'Asia/Jakarta',...meta}});
  };
  return {requests,request};
}

test('GA4 snapshot uses the selected property, stream and event scope and reconciles daily traffic',async()=>{
  const ga=fakeGa();
  const days=await fetchGaTraffic('prod',from,to,'fixture',now,ga.request);
  assert.deepEqual(days.map(day=>[day.date,day.sessions]),[[from,10],['2026-11-22',5],[to,0]]);
  assert.equal(days[1].segments[1].source,'(not set)');
  assert.equal(days[1].segments[1].landing,'other');
  assert.equal(days[1].segments[2].landing,'unknown');
  assert.deepEqual(days[0].devices,[{device:'mobile',landing:'enrollment',sessions:6},{device:'desktop',landing:'chat',sessions:4}]);
  assert.ok(ga.requests.every(({url})=>url.endsWith('/543450253:runReport')));
  const filters=ga.requests[0].filter.andGroup.expressions;
  assert.deepEqual(filters.slice(0,4).map(({filter})=>[filter.fieldName,filter.stringFilter.value]),[
    ['streamId','15159406809'],['eventName','page_view'],['customEvent:traffic_category','customer'],
    ['customEvent:environment','production'],
  ]);
  assert.equal(filters[4].notExpression.filter.stringFilter.value,'simulated');
  const testGa=fakeGa();
  await fetchGaTraffic('test',from,to,'fixture',now,testGa.request);
  assert.ok(testGa.requests.every(({url})=>url.endsWith('/561827503:runReport')));
  assert.equal(testGa.requests[0].filter.andGroup.expressions[0].filter.stringFilter.value,'16252453328');
  assert.equal(testGa.requests[0].filter.andGroup.expressions[2].filter.stringFilter.value,'internal_test');
});

test('GA4 rejects timezone mismatch, truncated data, unbalanced dimensions and partial current days',async()=>{
  for(const [meta,message] of [
    [{timeZone:'UTC'},/Asia\/Jakarta/],
    [{subjectToThresholding:true},/incomplete/],
    [{samplingMetadatas:[{}]},/incomplete/],
    [{dataTruncationReasons:[{}]},/incomplete/],
  ] as const){
    await assert.rejects(fetchGaTraffic('dev',from,to,'fixture',now,fakeGa({meta}).request),message);
  }
  await assert.rejects(fetchGaTraffic('dev',from,to,'fixture',now,fakeGa({rowCount:99}).request),/every report row/);
  await assert.rejects(fetchGaTraffic('dev',from,to,'fixture',now,fakeGa({entries:detail.slice(1)}).request),/reconcile/);
  await assert.rejects(fetchGaTraffic('dev',from,to,'fixture',now,fakeGa({deviceEntries:[
    makeRow(6,'20261121','mobile','/chat'),makeRow(4,'20261121','desktop','/enrollment'),
  ]}).request),/device and source reports disagree/);
  await assert.rejects(fetchGaTraffic('dev',from,to,'fixture',now,async()=>new Response('private',{status:403})),/status 403/);
  assert.throws(()=>dashboardReportingDates('2026-11-24','2026-11-25',now),/complete Jakarta/);
  assert.throws(()=>dashboardReportingDates('2026-02-30','2026-03-02',now),/valid YYYY-MM-DD/);
  assert.throws(()=>trafficEnvironment(undefined),/explicitly/);
});

test('traffic snapshots scope storage by environment and distinguish partial days, known zero and no snapshot',async()=>{
  const days=await fetchGaTraffic('dev',from,to,'fixture',now,fakeGa().request);
  const saved=new Map<string,typeof days[number]>();
  const statements:string[]=[];
  const db={async query(sql:string,parameters:unknown[]=[]){
    statements.push(sql);
    if(sql.startsWith('INSERT')){
      const [key,day,fetchedAt]=parameters as [string,typeof days[number],string];
      if(!saved.has(key)||saved.get(key)!.fetchedAt<fetchedAt)saved.set(key,day);
      return {rows:[]};
    }
    const [first,last]=parameters as string[];
    return {rows:[...saved].filter(([key])=>key>=first&&key<=last).map(([,value])=>({value}))};
  }};
  await storeGaTraffic(db,'dev',days.slice(1));
  await storeGaTraffic(db,'dev',[{...days[1],fetchedAt:'2026-11-24T01:00:00Z',sessions:99}]);
  await storeGaTraffic(db,'test',days);
  assert.match(statements[0],/ON DUPLICATE KEY UPDATE value=IF\(value->>'\$\.fetchedAt'<:p3/);
  const report=await readGaTraffic(db,'dev',from,to,now);
  assert.equal(report?.coveredDays,2);
  assert.equal(report?.expectedDays,3);
  assert.equal(report?.sessions,5);
  assert.deepEqual(report?.landings,{enrollment:0,chat:0,link:1,other:2,unknown:2});
  assert.deepEqual(report?.devices,{coveredDays:2,rows:[{device:'desktop',sessions:5,landings:{enrollment:0,chat:0,link:1,other:2,unknown:2}}]});
  assert.equal((await readGaTraffic(db,'dev',to,to,now))?.sessions,0);
  assert.equal(await readGaTraffic(db,'prod',from,to,now),null);
  assert.equal((await readGaTraffic(db,'test',from,to,now))?.sessions,15);
});

test('a prior GA4 snapshot retains overall sessions without implying zero device usage',async()=>{
  const [day]=await fetchGaTraffic('dev',from,to,'fixture',now,fakeGa().request);
  const {devices,...prior}=day;
  const report=await readGaTraffic({async query(){return {rows:[{value:prior},{value:{...day,date:'2026-11-22'}}]};}},'dev',from,to,now);
  assert.equal(report?.sessions,20);
  assert.equal(report?.devices?.coveredDays,1);
  assert.equal(report?.devices?.rows.reduce((sum,row)=>sum+row.sessions,0),10);
});

test('traffic report keeps overall and landing totals when long-tail sources are grouped',async()=>{
  const entries=Array.from({length:15},(_,index)=>makeRow(1,'20261121','source'+index,'referral','/link'));
  const days=await fetchGaTraffic('test',from,from,'fixture',now,fakeGa({entries,totals:[makeRow(15,'20261121')]}).request);
  const report=await readGaTraffic({async query(){return {rows:days.map(value=>({value}))};}},'test',from,from,now);
  assert.equal(report?.channels.length,12);
  assert.equal(report?.otherChannels?.sessions,3);
  assert.equal(report?.otherChannels?.landings.link,3);
  assert.equal(report?.landings.link,15);
});
