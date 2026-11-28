import assert from 'node:assert/strict';
import test from 'node:test';
import {hasPublicSalesWallboard,shareWallboardSnapshot} from '../server/portal/publicSalesWallboard.ts';
import {salesWallboardSnapshot} from '../src/utils/salesWallboard.ts';
import type {DashboardSnapshot} from '../src/utils/crmOperationsDashboard.ts';
import {resolveMetadata} from '../src/utils/siteMetadata.ts';

test('the retired comparison route returns not-found metadata',()=>{
  const metadata=resolveMetadata('/sales-new','zh');
  assert.equal(metadata.indexable,false);
  assert.equal(metadata.status,404);
});

test('anonymous sales wallboard is available in company test and local CRM and excluded from search indexing',()=>{
  assert.equal(hasPublicSalesWallboard({PORTAL_ENV:'test',PORTAL_DEPLOYMENT:'company-trial'}),true);
  assert.equal(hasPublicSalesWallboard({PORTAL_ENV:'test'}),false);
  assert.equal(hasPublicSalesWallboard({PORTAL_ENV:'prod',PORTAL_DEPLOYMENT:'production'}),false);
  assert.equal(hasPublicSalesWallboard({PORTAL_ENV:'dev',PORTAL_DEPLOYMENT:'company-trial'}),false);
  const local={PORTAL_ENV:'dev',TRIAL_DATASET:'local-crm',PORTAL_LOCAL_CUTOVER:'true',
    MYSQL_TRIAL_SOCKET:'/private/tmp/uper-crm-mysql-local3000.sock'};
  assert.equal(hasPublicSalesWallboard(local),true);
  assert.equal(hasPublicSalesWallboard({...local,PORTAL_DEPLOYMENT:'remote-dev'}),false);
  assert.equal(hasPublicSalesWallboard({...local,PORTAL_LOCAL_CUTOVER:'false'}),false);
  const metadata=resolveMetadata('/sales','zh');
  assert.equal(metadata.indexable,false);
  assert.equal(metadata.status,200);
  assert.match(metadata.title,/销售大屏/);
});

test('public projection keeps the chart values and omits internal record and account fields',()=>{
  const data={
    asOf:'2026-11-30T02:00:00.000Z',
    current:{first:3},compare:{first:1},today:{orders:2},period:{from:'2026-11-01',to:'2026-11-30'},
    reservationOutcomes:{entries:[{key:'website',orders:2}],languages:[{key:'zh'}]},
    upcoming:[{id:'class-1',level:'HSK 1',schedule:'not-rendered',teacherId:'teacher-private',insertionPrice:729,
      counts:{paid:2,waiting:1,history:4}}],
    queue:{pending:2,oldest:'private-queue-timestamp',pendingByClass:{'class-1':2}},
    adSpend:{accounts:[{accountId:'private-account'}],currencies:[{currency:'IDR',amount:7,mapped:7}],
      campaigns:[{currency:'IDR',amount:7,campaignId:'private-campaign',mapping:{promotionId:'private-promotion'},
        channel:{source:'meta',medium:'paid_social'}},{currency:'IDR',amount:9}]},
    wallboard:{channels:[{orders:2}],enrollmentFunnel:{lastCovered:'2026-11-27',expectedDays:28,coveredDays:1,
      channels:[{source:'meta',landed:3}],campaigns:[{campaign:'private-funnel-campaign'}]}},
    teaching:{teacher:'private-teacher'},cohorts:[],latestSources:[],contributions:[{level:'HSK 1',paid:2}],
    trend:[{date:'2026-11-26'}],compareTrend:[],
  } as unknown as DashboardSnapshot;
  const board=salesWallboardSnapshot(data);
  assert.deepEqual(board.upcoming[0].counts,{paid:2,waiting:1});
  assert.equal(board.wallboard?.enrollmentFunnel?.lastCovered,'2026-11-27');
  assert.equal(board.wallboard?.enrollmentFunnel?.channels[0].landed,3);
  assert.deepEqual(board.adSpend?.campaigns,[{currency:'IDR',amount:7,mapping:true,channel:{source:'meta',medium:'paid_social'}}]);
  assert.equal(board.queue?.pendingByClass?.['class-1'],2);
  assert.equal(board.reservationOutcomes.entries[0].orders,2);
  assert.doesNotMatch(JSON.stringify(board),/private-|not-rendered|insert(ion)?Price|languages|accounts/);
});

test('concurrent public requests share one read, and a failed refresh can be retried',async()=>{
  let now=0;
  let calls=0;
  const read=shareWallboardSnapshot(async()=>{
    calls++;
    if(calls===2)throw Error('temporary read failure');
    return calls;
  },()=>now);
  assert.deepEqual(await Promise.all([read(),read(),read()]),[1,1,1]);
  now=59_999;
  assert.equal(await read(),1);
  now=60_000;
  await assert.rejects(read(),/temporary read failure/);
  assert.equal(await read(),3);
});
