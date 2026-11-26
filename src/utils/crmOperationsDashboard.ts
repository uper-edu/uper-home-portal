import {permittedRecord,type AccessEmployee} from './accessControl';
import type {EnrollmentClassSummary} from './crmEnrollmentManagement';
import {enrollmentLevels} from './enrollmentCatalog';

export const dashboardTopics=['overview','acquisition','sales','classes','finance','teaching','economics','wallboard'] as const;
export type DashboardTopic=typeof dashboardTopics[number];
export const dashboardPeriods=['month','7','30','custom'] as const;
export const dashboardLevels=enrollmentLevels;
export const dashboardFormats=['standard','small'] as const;
export type DashboardFilters={
  period:typeof dashboardPeriods[number];
  from:string;
  to:string;
  level:typeof dashboardLevels[number]|'';
  format:typeof dashboardFormats[number]|'';
};

export function canManageDashboardKpi(actor:AccessEmployee){
  return permittedRecord(actor,{},'crm.read')&&permittedRecord(actor,{},'crm.dashboard.kpi.manage');
}

export function dashboardScopes(actor:AccessEmployee){
  const all=(permission:string)=>permittedRecord(actor,{},permission);
  const finance=all('crm.read')&&all('crm.payments.verify');
  const operations=all('crm.read')&&all('crm.operations.manage');
  const marketing=all('crm.read')&&all('campaigns.manage');
  return {
    view:finance||operations||marketing||canManageDashboardKpi(actor)||all('crm.read')&&all('crm.assign'),
    finance,
    operations,
    marketing,
    followup:all('crm.read')&&all('crm.followup'),
  };
}

export function readDashboardFilters(params:URLSearchParams):DashboardFilters{
  const date=(key:string)=>params.get(key)?.slice(0,10)??'';
  return {
    period:dashboardPeriods.find(p=>p===params.get('dashboardPeriod'))??'month',
    from:date('dashboardFrom'),to:date('dashboardTo'),
    level:dashboardLevels.find(v=>v===params.get('dashboardLevel'))??'',
    format:dashboardFormats.find(v=>v===params.get('dashboardFormat'))??'',
  };
}

export function dashboardPath(topic:DashboardTopic,filter:DashboardFilters){
  const p=new URLSearchParams({tab:'dashboard'});
  if(topic!=='overview')p.set('dashboardTopic',topic);
  if(filter.period!=='month')p.set('dashboardPeriod',filter.period);
  if(filter.period==='custom'){
    p.set('dashboardFrom',filter.from);
    p.set('dashboardTo',filter.to);
  }
  if(filter.level)p.set('dashboardLevel',filter.level);
  if(filter.format)p.set('dashboardFormat',filter.format);
  return '/crm?'+p;
}

export type DashboardCash={received:number;refunded:number;returned:number;net:number};
export type DashboardMetrics={
  orders:number; paid:number; first:number; identityUnknown:number; timingUnknown:number;
  paidWithinWindow:number; mature:number; observing:number;
  self:number; assisted:number; staff:number; unclassified:number;
  awaiting:number; partial:number; expired:number; cancelled:number; review:number;
};
export type DashboardSource={
  key:string;
  kind:'verified'|'website'|'campaign'|'unknown';
  source:string;
  medium:string;
  campaignId?:string;
  campaignCode?:string;
};
export function dashboardChannelKey(source:DashboardSource){
  return source.kind==='verified'?JSON.stringify([source.source,source.medium]):source.kind;
}
export type DashboardSources=DashboardSource&{orders:number;first:number;mature:number;paidWithinWindow:number};
export type DashboardReservationOutcome={
  key:string;orders:number;eligible:number;observing:number;timingUnknown:number;
  proof:number;paidAfterProof:number;paidWithoutPriorProof:number;
};
export type DashboardChannelOutcome=DashboardReservationOutcome&{source:DashboardSource;unpaidWithProof:number};
export type DashboardTrend={date:string;paid:number;cash:DashboardCash|null};
export type DashboardFollowup={open:number;overdue:number};
export type DashboardQueueAges={under24:number;under72:number;atLeast72:number;unknown:number};
export type DashboardFinanceQueue={
  pending:number;oldest:string|null;refunds:number;refundOutstanding:number;receivable:number;
  reviewAges:DashboardQueueAges;refundAges:DashboardQueueAges;
  pendingByClass?:Record<string,number>;
};
export type DashboardDemand={level:string;period:string;format:string;state:string;count:number};
export type DashboardSupply={
  level:string;period:string;waiting:number;requests:number;seats:number;physicalSeats:number;
};
export function dashboardSupply(classes:readonly EnrollmentClassSummary[],demand:readonly DashboardDemand[]|null){
  const groups=new Map<string,DashboardSupply>();
  const group=(level:string,period:string)=>{
    const key=JSON.stringify([level,period]);
    const row=groups.get(key)??{level,period,waiting:0,requests:0,seats:0,physicalSeats:0};
    groups.set(key,row);
    return row;
  };
  for(const row of classes){
    const supply=group(row.level,row.period);
    supply.waiting+=row.counts.waiting;
    supply.physicalSeats+=row.available;
    if(row.accepting)supply.seats+=row.available;
  }
  for(const row of demand??[]){
    if(row.state==='active'&&row.format!=='one-on-one')group(row.level,row.period).requests+=row.count;
  }
  return [...groups.values()];
}

export const dashboardRateComparisonMinimum=20;
export function dashboardPaymentSampleIssue(metrics:Pick<DashboardMetrics,'mature'|'observing'|'timingUnknown'>){
  if(metrics.mature)return null;
  if(metrics.timingUnknown)return 'missingTime';
  if(metrics.observing)return 'tvKpiObserving';
  return 'tvKpiNoSample';
}

export function dashboardChannelLeaders(
  rows:readonly {identified:boolean;sessions?:number;eligible:number;paid:number;first:number}[],
  completeTraffic:boolean,
){
  const eligibleRate=(row:typeof rows[number])=>row.eligible>=dashboardRateComparisonMinimum?row.paid/row.eligible:undefined;
  const eligibleRows=rows.filter(row=>row.identified);
  const first=Math.max(0,...eligibleRows.map(row=>row.first));
  const rate=Math.max(0,...eligibleRows.map(row=>eligibleRate(row)??0));
  const sessions=completeTraffic?Math.max(0,...eligibleRows.map(row=>row.sessions??0)):0;
  return rows.map(row=>({
    first:row.identified&&first>0&&row.first===first,
    rate:row.identified&&rate>0&&eligibleRate(row)===rate,
    sessions:row.identified&&sessions>0&&row.sessions===sessions,
  }));
}
export type DashboardMovement={
  orderId:string;reference:string;at:string;settledAt:string|null;kind:'received'|'refunded'|'returned';amount:number;
};
export type DashboardMovementPage={rows:DashboardMovement[];page:number;more:boolean};
export type DashboardChange={paid:number;previousPaid:number;net:number|null;previousNet:number|null};
export type DashboardContribution=DashboardChange&{level:string};
export type DashboardFormatContribution=DashboardChange&{format:string};
export type DashboardChannelContribution=DashboardChange&{source:DashboardSource};
export type DashboardCohort={week:string;orders:number;windows:{days:number;confirmed:number;observed:number}[]};
export const dashboardLandingPages=['enrollment','chat','link','homepage','other','unknown'] as const;
export type DashboardLandingPage=typeof dashboardLandingPages[number];
export type DashboardLandingCounts=Record<DashboardLandingPage,number>;
export type DashboardTrafficChannel={
  source:string;medium:string;sessions:number;landings:DashboardLandingCounts;
};
export const dashboardDevices=['mobile','desktop','tablet','other','unknown'] as const;
export type DashboardDevice=typeof dashboardDevices[number];
export type DashboardTrafficDevice={device:DashboardDevice;sessions:number;landings:DashboardLandingCounts};
export type DashboardTraffic={
  from:string;to:string;coveredDays:number;expectedDays:number;fetchedAt:string;sessions:number;
  homepageCoveredDays?:number;
  landings:DashboardLandingCounts;channels:DashboardTrafficChannel[];otherChannels:DashboardTrafficChannel|null;
  devices?:{coveredDays:number;homepageCoveredDays?:number;rows:DashboardTrafficDevice[]};
};
export const enrollmentFunnelSteps=['landed','viewedClass','started','reserved','savedProof'] as const;
export type EnrollmentFunnelCounts=Record<typeof enrollmentFunnelSteps[number],number>;
export type EnrollmentFunnelChannel=EnrollmentFunnelCounts&{source:string;medium:string};
export type EnrollmentFunnelCampaign=EnrollmentFunnelChannel&{campaignId:string;campaign:string};
export type DashboardEnrollmentFunnel={
  from:string;to:string;firstCovered:string;lastCovered:string;coveredDays:number;expectedDays:number;fetchedAt:string;
  missingSessionViews:number;totals:EnrollmentFunnelCounts;channels:EnrollmentFunnelChannel[];
  campaigns:EnrollmentFunnelCampaign[];campaignsOmitted:number;
};
export const dashboardDay=86_400_000;
export const dashboardDate=(time:number)=>new Date(time+7*3_600_000).toISOString().slice(0,10);
export function dashboardReportingDates(from:string,to:string,now=Date.now()){
  function parse(date:string){
    const time=Date.parse(date+'T00:00:00+07:00');
    if(!Number.isFinite(time)||dashboardDate(time)!==date)throw Error('Use valid YYYY-MM-DD dates');
    return time;
  }
  const start=parse(from),end=parse(to);
  if(start>end||end-start>=93*dashboardDay||to>=dashboardDate(now))
    throw Error('Select up to 93 complete Jakarta dates');
  return Array.from({length:(end-start)/dashboardDay+1},(_,index)=>dashboardDate(start+index*dashboardDay));
}
export const dashboardAdSpendScale=10_000;
export type DashboardAdSpendMapping={promotionId:string;campaignId:string;campaignCode:string};
export type DashboardAdSpendChannel={source:string;medium:string};
export type DashboardAdSpendRow={
  platform:string;accountId:string;currency:string;campaignId:string;name:string;amount:number;mapping:DashboardAdSpendMapping|null;
  channel?:DashboardAdSpendChannel;
};
export type DashboardAdSpend={
  from:string;to:string;expectedDays:number;
  accounts:{platform:string;accountId:string;currency:string;days:number;asOf:string}[];
  currencies:{currency:string;amount:number;mapped:number}[];
  campaigns:DashboardAdSpendRow[];
};
export const dashboardTeachingFormats=['standard','small','one-on-one'] as const;
export type DashboardTeachingFormat=typeof dashboardTeachingFormats[number];
export type DashboardTeachingRow={
  kind:'class'|'appointment';referenceId:string;level:string;format:DashboardTeachingFormat;
  days:number;lessons:number;minutes:number;rosterLessons:number;expected:number;recorded:number;present:number;
};
export type DashboardEconomicsRow=DashboardTeachingRow&{
  currency:string|null;costedLessons:number;teacherCost:number|null;revenue:number|null;directCost:number|null;contribution:number|null;
};
export type DashboardTeaching<T extends DashboardTeachingRow=DashboardTeachingRow>={
  from:string;to:string;expectedDays:number;asOf:string;cohorts:T[];
};
export const dashboardKpiCumulativeKeys=['net','paid','first'] as const;
export const dashboardKpiKeys=[...dashboardKpiCumulativeKeys,'paymentRate'] as const;
export type DashboardKpiCumulativeKey=typeof dashboardKpiCumulativeKeys[number];
export type DashboardKpiKey=typeof dashboardKpiKeys[number];
export type DashboardKpiValues={
  targets:Partial<Record<DashboardKpiKey,number>>;
};
export type DashboardKpiEditorPlan=DashboardKpiValues&{
  month:string;currentMonth:string;finance:boolean;readOnly:boolean;
  revision:string|null;updatedAt:string|null;updatedBy:string|null;
};
export type DashboardKpiListRow=Pick<DashboardKpiEditorPlan,'month'|'targets'|'updatedAt'|'updatedBy'>;
export type DashboardKpiList={currentMonth:string;finance:boolean;plans:DashboardKpiListRow[]};
export function dashboardKpiShiftMonth(month:string,offset:number){
  const start=new Date(month+'-01T00:00:00.000Z');
  start.setUTCMonth(start.getUTCMonth()+offset);
  return start.toISOString().slice(0,7);
}
export function dashboardKpiMonthProgress(asOf:number){
  const month=dashboardDate(asOf).slice(0,7);
  const start=Date.parse(month+'-01T00:00:00+07:00');
  const end=Date.parse(dashboardKpiShiftMonth(month,1)+'-01T00:00:00+07:00');
  return (asOf-start)/(end-start);
}
export type DashboardKpiTarget={target:number};
export type DashboardKpiPlan={
  first?:DashboardKpiTarget;paid?:DashboardKpiTarget;net?:DashboardKpiTarget;paymentRate?:number;
};
export type DashboardWallboard={
  priorDay:{orders:number;paid:number;net:number|null};
  dailyPaid:{date:string;paid:number;previous:number;net:number|null;previousNet:number|null}[];
  traffic:DashboardTraffic|null;
  enrollmentFunnel?:DashboardEnrollmentFunnel|null;
  channels:DashboardChannelOutcome[];
  kpiPlan?:DashboardKpiPlan;
};
export type DashboardSnapshot={
  asOf:string;
  period:{from:string;to:string;compareFrom:string;compareTo:string};
  trafficPeriod:{from:string;to:string};
  traffic?:DashboardTraffic|null;
  enrollmentFunnel?:DashboardEnrollmentFunnel|null;
  adSpend?:DashboardAdSpend|null;
  wallboard?:DashboardWallboard;
  teaching?:DashboardTeaching|null;
  economics?:DashboardTeaching<DashboardEconomicsRow>|null;
  current:DashboardMetrics;
  compare:DashboardMetrics;
  today:DashboardMetrics;
  sources:DashboardSources[];
  compareSources:DashboardSources[];
  latestSources:DashboardSources[];
  entries:{entry:string;count:number}[];
  reservationOutcomes:{entries:DashboardReservationOutcome[];languages:DashboardReservationOutcome[]};
  latestEntries:{entry:string;count:number}[];
  trend:DashboardTrend[];
  compareTrend:DashboardTrend[];
  contributions:DashboardContribution[];
  formatContributions:DashboardFormatContribution[];
  channelContributions:DashboardChannelContribution[];
  cohorts:DashboardCohort[];
  cash:{current:DashboardCash;compare:DashboardCash;today:DashboardCash}|null;
  queue:DashboardFinanceQueue|null;
  followup:DashboardFollowup|null;
  upcoming:EnrollmentClassSummary[];
  demand:DashboardDemand[]|null;
  assists:{offered:number;confirmed:number};
};
