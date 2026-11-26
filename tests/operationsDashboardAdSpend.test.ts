import assert from 'node:assert/strict';
import test from 'node:test';
import {parseDashboardAdSpend,readDashboardAdSpend,storeDashboardAdSpend,summarizeDashboardAdSpendImport} from '../server/portal/operationsDashboardAdSpend.ts';
import {dashboardAdSpendScale} from '../src/utils/crmOperationsDashboard.ts';

const now=Date.parse('2026-11-25T03:00:00Z');
const report={
  version:1,environment:'dev',timeZone:'Asia/Jakarta',metric:'spend',platform:'meta',accountId:'123459',currency:'IDR',
  extractedAt:'2026-11-25T01:00:00.000Z',from:'2026-11-22',to:'2026-11-23',
  days:[
    {date:'2026-11-22',total:'90.25',campaigns:[
      {campaignId:'100',name:'Opening campaign',spend:'80.125'},{campaignId:'200',spend:'10.125'},
    ]},
    {date:'2026-11-23',total:'0',campaigns:[]},
  ],
  mappings:[{campaignId:'100',promotionId:'hsk-paid'}],
};

function fixtureDatabase(){
  const saved=new Map<string,{extractedAt:string}>();
  const database={async query(sql:string,args:unknown[]=[]){
    if(sql.includes('JOIN trial_campaigns')){
      assert.deepEqual(args,[['hsk-paid']]);
      return {rows:[{p:'hsk-paid',id:'c-id',code:'hsk-nov',config:{promotionLinks:[
        {id:'hsk-paid',source:'google',medium:'cpc'},
      ]}}]};
    }
    if(sql.startsWith('INSERT')){
      const [key,day,extractedAt]=args as [string,{extractedAt:string},string];
      assert.match(sql,/IF\(value->>'\$\.extractedAt'<:p3/);
      if(!saved.has(key)||saved.get(key)!.extractedAt<extractedAt)saved.set(key,day);
      return {rows:[]};
    }
    assert.match(sql,/WHERE id>=:p1 AND id<:p2/);
    const [first,end]=args as string[];
    return {rows:[...saved].filter(([key])=>key>=first&&key<end).map(([,value])=>({value}))};
  }};
  return {database,saved};
}

test('valid spend reconciles precisely and previews unmapped amounts',()=>{
  const parsed=parseDashboardAdSpend(report,'dev',now);
  assert.equal(parsed.days[0].total,902_500);
  assert.equal(parsed.days[1].total,0);
  assert.deepEqual(summarizeDashboardAdSpendImport(parsed),{platform:'meta',accountId:'123459',currency:'IDR',
    from:'2026-11-22',to:'2026-11-23',days:2,amount:90.25,withoutMappingProposal:10.125});
});

test('imports reject mixed environments, unsupported dates or currency, duplicates and incomplete reports',()=>{
  assert.throws(()=>parseDashboardAdSpend(report,'prod',now),/environment/);
  assert.throws(()=>parseDashboardAdSpend({...report,timeZone:'America/Los_Angeles'},'dev',now),/Jakarta/);
  assert.throws(()=>parseDashboardAdSpend({...report,currency:'$'},'dev',now),/currency/);
  assert.throws(()=>parseDashboardAdSpend({...report,days:report.days.slice(0,1)},'dev',now),/every report date/);
  assert.throws(()=>parseDashboardAdSpend({...report,days:[{...report.days[0],total:'0'},report.days[1]]},'dev',now),/reconcile/);
  assert.throws(()=>parseDashboardAdSpend({...report,days:[{...report.days[0],campaigns:[
    report.days[0].campaigns[0],report.days[0].campaigns[0],
  ]},report.days[1]]},'dev',now),/Duplicate/);
  assert.throws(()=>parseDashboardAdSpend({...report,mappings:[{campaignId:'999',promotionId:'invalid'}]},'dev',now),/unique campaign/);
});

test('mappings are checked before any writes and only existing paid promotion links are accepted',async()=>{
  const parsed=parseDashboardAdSpend(report,'dev',now);
  for(const links of [[],[{id:'hsk-paid',medium:'social'}]]){
    const writes:string[]=[];
    const database={async query(sql:string){
      if(sql.startsWith('INSERT'))writes.push(sql);
      return {rows:[{p:'hsk-paid',config:{promotionLinks:links}}]};
    }};
    await assert.rejects(storeDashboardAdSpend(database,'dev',parsed),/existing paid/);
    assert.deepEqual(writes,[]);
  }
});

test('currency and account totals stay separate and reimport replaces a day only with a newer report',async()=>{
  const {database,saved}=fixtureDatabase();
  const parsed=parseDashboardAdSpend(report,'dev',now);
  await storeDashboardAdSpend(database,'dev',parsed);
  await storeDashboardAdSpend(database,'dev',parsed);
  const dollars=parseDashboardAdSpend({...report,accountId:'ABC',platform:'tiktok',currency:'USD',mappings:[]},'dev',now);
  await storeDashboardAdSpend(database,'dev',dollars);
  await storeDashboardAdSpend(database,'test',parsed);
  assert.equal(saved.size,6);
  const newFirst={...parsed,days:[{...parsed.days[0],total:100_000,campaigns:[{campaignId:'100',name:'Corrected',amount:100_000}]}],
    extractedAt:'2026-11-25T02:00:00.000Z'};
  await storeDashboardAdSpend(database,'dev',newFirst);
  await storeDashboardAdSpend(database,'dev',parsed);
  const reportView=await readDashboardAdSpend(database,'dev','2026-11-22','2026-11-24',now);
  assert.deepEqual(reportView?.currencies,[{currency:'IDR',amount:10*dashboardAdSpendScale,mapped:10*dashboardAdSpendScale},
    {currency:'USD',amount:902_500,mapped:0}]);
  assert.deepEqual(reportView?.accounts.map(row=>row.days),[2,2]);
  assert.equal(reportView?.expectedDays,3);
  assert.equal(reportView?.campaigns.find(row=>row.currency==='IDR')?.mapping?.campaignId,'c-id');
  assert.deepEqual(reportView?.campaigns.find(row=>row.currency==='IDR')?.channel,{source:'google',medium:'cpc'});
  assert.equal(reportView?.campaigns.some(row=>row.currency==='IDR'&&row.campaignId==='200'),false);
  assert.equal(await readDashboardAdSpend(database,'prod','2026-11-22','2026-11-24',now),null);
});
