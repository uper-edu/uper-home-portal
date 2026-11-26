import assert from 'node:assert/strict';
import test from 'node:test';
import type {Express,Request,Response} from 'express';
import {dashboardChannelLeaders,dashboardPath,dashboardPaymentSampleIssue,dashboardRateComparisonMinimum,dashboardScopes,dashboardSupply,dashboardTopics,readDashboardFilters} from '../src/utils/crmOperationsDashboard.ts';
import {dashboardKpiPlan,parseDashboardKpiImport,readDashboardKpiPlan,storeDashboardKpiPlan} from '../server/portal/operationsDashboardKpi.ts';
import dashboardMetricsGuide from '../src/components/crm/dashboardMetricsGuide.json';
import type {EnrollmentClassSummary} from '../src/utils/crmEnrollmentManagement.ts';
import type {Employee} from '../server/portal/identity.ts';

// Module initialization creates a pool only. Each route test rejects before opening a connection.
process.env.TRIAL_DATASET='synthetic';
process.env.MYSQL_TRIAL_URL='mysql://unused:unused@localhost/uper_trial_dashboard_unit';
const {classifyDashboardSource,dashboardPaymentCohorts,dashboardReservationOutcomes,dashboardWindows,mountOperationsDashboard,summarizeDashboardActivity,summarizeDashboardCash,summarizeDashboardOrders,summarizeDashboardQueueAges}=await import('../server/portal/operationsDashboard.ts');

const now=Date.parse('2026-11-25T03:00:00Z');
const filters=readDashboardFilters(new URLSearchParams());
const finance:Employee={id:'finance',teams:['ops'],permissions:['crm.read','crm.payments.verify'],scope:'all'};
const sales:Employee={id:'sales',teams:['sales'],permissions:['crm.read','crm.followup'],scope:'own'};
const manager:Employee={id:'manager',teams:['ops'],permissions:['crm.read','crm.operations.manage','crm.followup'],scope:'all'};

test('supply uses only bookable seats and active group requests, retaining physical capacity and waitlists',()=>{
  const open={level:'HSK 1',period:'weekend',counts:{waiting:2},available:9,accepting:true} as EnrollmentClassSummary;
  const closed={...open,counts:{...open.counts,waiting:1},available:4,accepting:false};
  const group={level:open.level,period:open.period,format:'standard',state:'active',count:4};
  const supply=dashboardSupply([open,closed],[group,{...group,state:'withdrawn',count:8},
    {...group,format:'one-on-one',count:2},{...group,format:'one-on-one',state:'confirmed',count:3}]);
  assert.deepEqual(supply,[{level:'HSK 1',period:'weekend',waiting:3,requests:4,seats:9,physicalSeats:13}]);
});

test('channel ranking excludes small cohorts and partial traffic without hiding measured values',()=>{
  const rows=[
    {identified:true,sessions:120,eligible:1,paid:1,first:6},
    {identified:true,sessions:110,eligible:dashboardRateComparisonMinimum,paid:18,first:2},
    {identified:false,sessions:500,eligible:30,paid:29,first:20},
  ];
  assert.deepEqual(dashboardChannelLeaders(rows,true),[
    {sessions:true,rate:false,first:true},{sessions:false,rate:true,first:false},{sessions:false,rate:false,first:false},
  ]);
  assert.ok(dashboardChannelLeaders(rows,false).every(row=>!row.sessions));
  assert.equal(dashboardPaymentSampleIssue({mature:0,observing:6,timingUnknown:0}),'tvKpiObserving');
  assert.equal(dashboardPaymentSampleIssue({mature:0,observing:0,timingUnknown:1}),'missingTime');
  assert.equal(dashboardPaymentSampleIssue({mature:0,observing:0,timingUnknown:0}),'tvKpiNoSample');
  assert.equal(dashboardPaymentSampleIssue({mature:1,observing:0,timingUnknown:0}),null);
});

test('dashboard metric reference has stable anchors and covers the ranking rule in three languages',()=>{
  const {title,sections}=dashboardMetricsGuide;
  assert.equal(sections[0].key,'dashboard-metrics');
  assert.equal(new Set(sections.map(section=>section.key)).size,sections.length);
  assert.equal(title.length,3);
  assert.ok(sections.every(section=>section.title.length===3&&section.body.length===3&&section.body.every(Boolean)));
  assert.ok(sections.at(-1)!.body.every(body=>body.includes(String(dashboardRateComparisonMinimum))));
});

test('approved KPI revisions are validated for month and environment and stale or conflicting writes are rejected',async()=>{
  const source={version:1,environment:'dev',month:'2026-11',approvedAt:'2026-11-25T02:00:00.000Z',
    targets:{first:100,net:5000000,paymentRate:0},milestones:{'2026-11-15':{net:1800000,first:31}}};
  const plan=parseDashboardKpiImport(source,'dev',now);
  assert.throws(()=>parseDashboardKpiImport(source,'test',now),/environment/);
  assert.throws(()=>parseDashboardKpiImport({...source,month:'2026-13'},'dev',now),/month/);
  assert.throws(()=>parseDashboardKpiImport({...source,approvedAt:'2026-11-25T03:01:00.000Z'},'dev',now),/timestamp/);
  assert.throws(()=>parseDashboardKpiImport({...source,milestones:{'2026-11-31':{first:40}}},'dev',now),/Milestone dates/);
  assert.throws(()=>parseDashboardKpiImport({...source,milestones:{'2026-11-28':{paid:40}}},'dev',now),/monthly target/);
  let stored:unknown,updates=0;
  const db={async query(sql:string,[key,value]:unknown[]){
    assert.equal(key,'dashboard_monthly_kpi_v1:dev:2026-11');
    if(sql.startsWith('INSERT'))stored??=value;
    if(sql.startsWith('UPDATE')){stored=value;updates++;}
    return {rows:[{value:stored}]};
  }};
  await storeDashboardKpiPlan(db,plan);
  await storeDashboardKpiPlan(db,plan);
  assert.equal(updates,0);
  const newer=parseDashboardKpiImport({...source,approvedAt:'2026-11-25T02:10:00.000Z'},'dev',now);
  await storeDashboardKpiPlan(db,newer);
  assert.equal(updates,1);
  await assert.rejects(storeDashboardKpiPlan(db,plan),/newer KPI/);
  await assert.rejects(storeDashboardKpiPlan(db,{...newer,targets:{first:102}}),/newer KPI/);
  assert.deepEqual(stored,newer);
});

test('finance queue age counts each item once and preserves missing and future timestamps',()=>{
  const dates=['2026-11-25T03:00:00Z','2026-11-24T03:00:00.001Z',
    '2026-11-24T03:00:00Z','2026-11-22T03:00:00.001Z',
    '2026-11-22T03:00:00Z',null,'invalid','2026-11-25T03:00:00.001Z'];
  assert.deepEqual(summarizeDashboardQueueAges(dates,now),{under24:2,under72:2,atLeast72:1,unknown:3});
});

test('dashboard preserves narrow grants and makes the wallboard its final child',()=>{
  assert.equal(dashboardTopics.at(-1),'wallboard');
  assert.deepEqual(dashboardScopes(finance),{view:true,finance:true,operations:false,marketing:false,followup:false});
  assert.deepEqual(dashboardScopes(manager),{view:true,finance:false,operations:true,marketing:false,followup:true});
  assert.equal(dashboardScopes({...manager,permissions:['crm.read','campaigns.manage']}).marketing,true);
  assert.equal(dashboardScopes({...manager,permissions:['crm.read','campaigns.manage'],grants:{'campaigns.manage':['own']}}).marketing,false);
  assert.equal(dashboardScopes(sales).view,false);
  assert.equal(dashboardScopes({...finance,active:false}).view,false);
  assert.equal(dashboardScopes({...finance,grants:{'crm.read':['all'],'crm.payments.verify':['own']}}).finance,false);
  const filter={...filters,period:'custom' as const,from:'2026-11-23',to:'2026-11-24',level:'HSK 4B' as const,format:'small' as const};
  const url=new URL(dashboardPath('classes',filter),'http://localhost');
  assert.equal(url.searchParams.get('dashboardTopic'),'classes');
  assert.deepEqual(readDashboardFilters(url.searchParams),filter);
});

test('operating periods cut at Jakarta midnight and compare the same portion of the previous month',()=>{
  const periods=dashboardWindows(filters,now);
  assert.equal(new Date(periods.current.start).toISOString(),'2026-10-31T17:00:00.000Z');
  assert.equal(new Date(periods.compare.end).toISOString(),'2026-10-25T03:00:00.000Z');
  assert.equal(new Date(periods.latest.end).toISOString(),'2026-11-24T17:00:00.000Z');
  assert.throws(()=>dashboardWindows({...filters,period:'custom',from:'2026-02-30',to:'2026-03-03'},now),/dashboard_invalid_period/);
  assert.throws(()=>dashboardWindows({...filters,period:'custom',from:'2026-01-01',to:'2026-11-01'},now),/dashboard_invalid_period/);
  assert.throws(()=>dashboardWindows({...filters,period:'custom',from:'2026-11-25',to:'2026-11-26'},now),/dashboard_invalid_period/);
});

test('wallboard keeps approved monthly targets and selects the latest eligible checkpoint for each metric',()=>{
  const saved={targets:{first:260,paid:320,net:280_000_000,paymentRate:.62},milestones:{
    '2026-10-25':{first:500,net:500},
    '2026-11-23':{first:220,paid:290,net:242_000_000},
    '2026-11-25':{first:226,paid:-1},
    '2026-11-26':{first:229,paid:299,net:285_000_000},
  }};
  const plan=dashboardKpiPlan(saved,'2026-11-25',true);
  assert.deepEqual(plan,{
    first:{target:260,planned:{date:'2026-11-25',value:226}},
    paid:{target:320,planned:{date:'2026-11-23',value:290}},
    net:{target:280_000_000,planned:{date:'2026-11-23',value:242_000_000}},
    paymentRate:.62,
  });
  assert.deepEqual(dashboardKpiPlan(saved,'2026-11-25',false),{...plan,net:undefined});
  assert.deepEqual(dashboardKpiPlan({targets:{first:0,paid:1.5,net:'300',paymentRate:62}},'2026-11-25',true),
    {first:undefined,paid:undefined,net:undefined,paymentRate:undefined});
  assert.deepEqual(dashboardKpiPlan({targets:{paid:320,paymentRate:0}},'2026-11-25',true),
    {first:undefined,paid:{target:320},net:undefined,paymentRate:0});
});

test('wallboard reads the current WIB monthly plan within the active environment',async()=>{
  const now=Date.parse('2026-11-30T17:00:00Z');
  const plan=await readDashboardKpiPlan({async query(sql,args){
    assert.match(sql,/^SELECT\b/);
    assert.deepEqual(args,['dashboard_monthly_kpi_v1:dev:2026-12']);
    return {rows:[{value:{targets:{first:260},milestones:{'2026-12-01':{first:0}}}}]};
  }},'dev',now,true);
  assert.deepEqual(plan.first,{target:260,planned:{date:'2026-12-01',value:0}});
});

test('known confirmations are unique by purchase and first payment is unique by verified learner',()=>{
  const window=dashboardWindows(filters,now).current;
  const unknown={key:'unknown',kind:'unknown' as const,source:'',medium:''};
  const attributed={key:'google',kind:'verified' as const,source:'google',medium:'organic'};
  const base={createdAt:'2026-11-10T02:00:00Z',paidAt:'2026-11-12T02:00:00Z',state:'paid',learnerId:'A',
    firstPaidAt:'2026-11-12T02:00:00Z',entry:'ai_chat',orderSource:unknown,learnerSource:attributed,mode:'self' as const};
  const {metrics,sources}=summarizeDashboardOrders([
    {...base,id:'first-purchase'},
    {...base,id:'first-purchase'},
    {...base,id:'second-purchase',paidAt:'2026-11-20T02:00:00Z',mode:'assisted'},
    {...base,id:'another-purchase',paidAt:'2026-11-16T02:00:00Z'},
    {...base,id:'ambiguous-identity',learnerId:null},
    {...base,id:'legacy-without-time',state:'paid',paidAt:null},
    {...base,id:'expired',state:'expired',paidAt:null},
    {...base,id:'new',state:'awaiting_payment',paidAt:null,createdAt:'2026-11-24T02:00:00Z'},
  ],window,now);
  assert.equal(metrics.paid,4);
  assert.equal(metrics.first,1);
  assert.equal(metrics.identityUnknown,1);
  assert.equal(metrics.timingUnknown,1);
  assert.equal(metrics.mature,5);
  assert.equal(metrics.paidWithinWindow,3);
  assert.equal(metrics.observing,1);
  assert.equal(metrics.assisted,1);
  assert.equal(metrics.expired,1);
  assert.equal(sources.find(row=>row.key==='google')?.first,1);
  assert.equal(sources.find(row=>row.key==='unknown')?.orders,7);
  assert.equal(sources.find(row=>row.key==='unknown')?.paidWithinWindow,3);
  assert.equal(sources.find(row=>row.key==='unknown')?.mature,5);
  assert.equal(sources.find(row=>row.key==='google')?.mature,0);
});

test('external source coverage excludes website entries, partial attribution and unresolved evidence',()=>{
  assert.equal(classifyDashboardSource(true,'website','internal','home-chat','social-bio','id').kind,'website');
  assert.equal(classifyDashboardSource(true,'website','internal',null,'social-bio','id').kind,'website');
  const social=classifyDashboardSource(true,'tiktok','social','chat-tt','social-bio','id');
  const paid=classifyDashboardSource(true,'tiktok','paid_social','tt-ad-01','november','paid-id');
  assert.equal(social.kind,'verified');
  assert.equal(paid.kind,'verified');
  assert.notEqual(social.key,paid.key);
  assert.equal(classifyDashboardSource(false,'tiktok','paid_social','unverified','november','paid-id').kind,'campaign');
  assert.equal(classifyDashboardSource(false,'tiktok','paid_social','invalid','guessed',null).kind,'unknown');
  assert.equal(classifyDashboardSource(false,null,null,null,'organic','organic-id').kind,'unknown');
});

test('cash keeps each bank movement independent and applies refund returns with the correct sign',()=>{
  const window=dashboardWindows(filters,now).today;
  assert.deepEqual(summarizeDashboardCash([
    {kind:'received',amount:450_000,at:'2026-11-24T18:00:00Z'},
    {kind:'received',amount:470_000,at:'2026-11-25T01:00:00Z'},
    {kind:'refunded',amount:200_000,at:'2026-11-25T01:30:00Z'},
    {kind:'returned',amount:80_000,at:'2026-11-25T02:59:00Z'},
    {kind:'received',amount:120_000,at:'2026-11-24T16:59:59Z'},
    {kind:'refunded',amount:100_000,at:'2026-11-25T03:00:00Z'},
  ],window),{received:920_000,refunded:200_000,returned:80_000,net:800_000});
});

test('reservation paths share the observed order cohort and split payments around the first proof',()=>{
  const window=dashboardWindows(filters,now).current;
  const source={key:'unknown',kind:'unknown' as const,source:'',medium:''};
  const base={id:'a',createdAt:'2026-11-10T02:00:00Z',paidAt:'2026-11-12T02:00:00Z',
    firstProofAt:'2026-11-11T02:00:00Z',state:'paid',learnerId:null,entry:'ai_chat',language:'en',
    orderSource:source,learnerSource:source,mode:'self' as const};
  const facts=[
    base,base,{...base,id:'b',firstProofAt:'2026-11-13T02:00:00Z'},
    {...base,id:'c',entry:'website',language:'id',firstProofAt:null},
    {...base,id:'d',paidAt:null},
    {...base,id:'e',createdAt:'2026-11-24T02:00:00Z',paidAt:null,state:'awaiting_payment'},
    {...base,id:'f',paidAt:'2026-11-22T02:00:00Z',firstProofAt:'2026-11-20T02:00:00Z',entry:undefined,language:undefined},
  ];
  const {entries,languages,channels}=dashboardReservationOutcomes(facts,window,now);
  assert.deepEqual(entries[0],{key:'ai_chat',orders:4,eligible:2,observing:1,timingUnknown:1,proof:2,
    paidAfterProof:1,paidWithoutPriorProof:1});
  assert.equal(entries.find(row=>row.key==='website')?.paidWithoutPriorProof,1);
  assert.equal(languages.find(row=>row.key==='id')?.proof,0);
  assert.equal(languages.find(row=>row.key==='unknown')?.eligible,1);
  const {metrics}=summarizeDashboardOrders(facts,window,now);
  for(const group of [entries,languages,channels]){
    assert.equal(group.reduce((sum,row)=>sum+row.orders,0),metrics.orders);
    assert.equal(group.reduce((sum,row)=>sum+row.eligible,0),metrics.mature);
    assert.equal(group.reduce((sum,row)=>sum+row.paidAfterProof+row.paidWithoutPriorProof,0),metrics.paidWithinWindow);
  }
});

test('wallboard groups different campaigns by source and medium and reconciles the three payment outcomes',()=>{
  const {current,sameTimeLastWeek,previousWeek}=dashboardWindows(filters,now);
  assert.equal(new Date(sameTimeLastWeek.end).toISOString(),'2026-11-18T03:00:00.000Z');
  assert.equal(new Date(previousWeek.end).toISOString(),'2026-11-17T17:00:00.000Z');
  const source=(campaign:string)=>classifyDashboardSource(true,'meta','paid_social','ad-'+campaign,campaign,campaign);
  const order={state:'awaiting_payment',createdAt:'2026-11-10T02:00:00Z',paidAt:null,
    learnerId:null,orderSource:source('a'),learnerSource:source('a'),mode:'self' as const};
  const {channels}=dashboardReservationOutcomes([
    {...order,id:'proof-after-paid',paidAt:'2026-11-11T02:00:00Z',firstProofAt:'2026-11-12T02:00:00Z'},
    {...order,id:'proof-no-pay',orderSource:source('b'),firstProofAt:'2026-11-12T02:00:00Z'},
    {...order,id:'late-proof-no-pay',firstProofAt:'2026-11-20T02:00:00Z'},
    {...order,id:'immature',createdAt:'2026-11-24T02:00:00Z'},
  ],current,now);
  assert.equal(channels.length,1);
  assert.equal(channels[0].eligible,3);
  assert.equal(channels[0].paidWithoutPriorProof,1);
  assert.equal(channels[0].unpaidWithProof,1);
  assert.equal(channels[0].observing,1);
  assert.equal(channels[0].source.campaignId,undefined);
});

test('overview splits WIB days and reconciles order-source, format and level change groups',()=>{
  const {current}=dashboardWindows({...filters,period:'custom',from:'2026-11-24',to:'2026-11-25'},now);
  const ads=classifyDashboardSource(true,'instagram','paid_social','ad-a','nov','nov-id');
  const adsAnotherCampaign=classifyDashboardSource(true,'instagram','paid_social','ad-b','other','other-id');
  const known={level:'HSK 1',format:'standard',orderSource:ads};
  const unattributed={level:'HSK 2',format:'small'};
  const orders=[
    {...known,paidAt:'2026-11-24T16:59:00Z'},{...known,paidAt:'2026-11-24T17:00:00Z'},
    {...unattributed,paidAt:'2026-11-25T03:00:00Z'},{...unattributed,paidAt:null},
  ];
  const summary=summarizeDashboardActivity(orders,[
    {...known,kind:'received',at:'2026-11-24T16:30:00Z',amount:1_000_000},
    {...known,orderSource:adsAnotherCampaign,kind:'refunded',at:'2026-11-24T17:00:00Z',amount:200_000},
    {...unattributed,kind:'returned',at:'2026-11-25T02:55:00Z',amount:50_000},
  ],current);
  assert.deepEqual(summary.trend,[
    {date:'2026-11-24',paid:1,cash:{received:1_000_000,refunded:0,returned:0,net:1_000_000}},
    {date:'2026-11-25',paid:1,cash:{received:0,refunded:200_000,returned:50_000,net:-150_000}},
  ]);
  assert.deepEqual(summary.byLevel.get('HSK 1'),{paid:2,net:800_000});
  assert.deepEqual(summary.byFormat.get('small'),{paid:0,net:50_000});
  const external=[...summary.bySource.values()].find(row=>row.source.kind==='verified');
  assert.deepEqual({paid:external?.paid,net:external?.net},{paid:2,net:800_000});
  assert.deepEqual(summary.bySource.get('unknown')?.net,50_000);
  assert.ok(summarizeDashboardActivity(orders,null,current).trend.every(row=>row.cash===null));
});

test('dashboard routes reject unauthorized aggregate and financial reads before storage is touched',async()=>{
  const handlers=new Map<string,(q:Request,r:Response)=>Promise<unknown>>();
  const app={get(path:string,handler:(q:Request,r:Response)=>Promise<unknown>){handlers.set(path,handler);}} as unknown as Express;
  let actor=sales;
  mountOperationsDashboard(app,handler=>handler,async()=>actor);
  const res={} as Response;
  await assert.rejects(handlers.get('/api/crm/operations-dashboard')!({} as Request,res),{status:403});
  actor=manager;
  await assert.rejects(handlers.get('/api/crm/operations-dashboard/cash')!({} as Request,res),{status:403});
  actor=finance;
  await assert.rejects(handlers.get('/api/crm/operations-dashboard/cash')!({originalUrl:'/api/crm/operations-dashboard/cash?page=-1'} as Request,res),{status:400});
});

test('payment heatmap uses a separate observation cutoff for each WIB cohort and payment window',()=>{
  const window=dashboardWindows(filters,now).current;
  const source={key:'unknown',kind:'unknown' as const,source:'',medium:''};
  const payment={id:'a',createdAt:'2026-11-15T17:30:00Z',paidAt:'2026-11-18T17:30:00Z',
    state:'paid',learnerId:'learner',orderSource:source,learnerSource:source,mode:'self' as const};
  const rows=dashboardPaymentCohorts([
    payment,payment,{...payment,id:'new',createdAt:'2026-11-24T02:00:00Z',paidAt:null,state:'awaiting_payment'},
    {...payment,id:'no-time',paidAt:null},
  ],window,now);
  assert.equal(rows[0].week,'2026-11-16');
  assert.equal(rows[0].orders,2);
  assert.deepEqual(rows[0].windows.map(entry=>[entry.observed,entry.confirmed]),[[1,0],[1,1],[1,1]]);
  assert.deepEqual(rows[1].windows.map(entry=>[entry.observed,entry.confirmed]),[[1,0],[0,0],[0,0]]);
});
