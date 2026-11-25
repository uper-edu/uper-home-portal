import type {Express,Request,Response} from 'express';
import {dashboardScopes,readDashboardFilters,type DashboardCash,type DashboardChange,type DashboardCohort,type DashboardFilters,
  type DashboardMetrics,type DashboardMovementPage,type DashboardQueueAges,type DashboardReservationOutcome,type DashboardSnapshot,type DashboardSource,type DashboardSources,type DashboardTrend} from '../../src/utils/crmOperationsDashboard.ts';
import {enrollmentManagementScopes} from '../../src/utils/crmEnrollmentManagement.ts';
import {crmInstant} from '../../src/utils/crmOperatingTime.ts';
import {isWebsitePromotion} from '../../src/utils/promotionNavigation.ts';
import {readEnrollmentManagementSummaries} from './enrollmentManagement.ts';
import {readEnrollmentFinancePendingSummary} from './enrollmentFinanceWorklist.ts';
import type {Employee} from './identity.ts';
import {readGaTraffic,trafficEnvironment} from './operationsDashboardTraffic.ts';
import {readDashboardAdSpend} from './operationsDashboardAdSpend.ts';
import {readDashboardTeaching} from './operationsDashboardTeaching.ts';
import {tx} from './store.ts';
import {invalid} from './trustWorkflow.ts';

type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
const day=86_400_000, wib=7*3_600_000;
const date=(at:number)=>new Date(at+wib).toISOString().slice(0,10);
const marks=(at:number)=>new Date(at).toISOString().replace('T',' ').slice(0,-1);
const iso=(column:string)=>"DATE_FORMAT("+column+",'%Y-%m-%dT%H:%i:%s.%fZ')";
const instant=(value?:string|null)=>value?Date.parse(value):NaN;
type Window={start:number;end:number};
function dateStart(raw:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return NaN;
  const time=Date.parse(raw+'T00:00:00+07:00');
  return Number.isFinite(time)&&date(time)===raw?time:NaN;
}
function contains(window:Window,value:number){return value>=window.start&&value<window.end;}
export function dashboardWindows(filters:DashboardFilters,now:number){
  const today=dateStart(date(now));
  const monthStart=dateStart(date(now).slice(0,7)+'-01');
  let current:Window,compare:Window;
  if(filters.period==='month'){
    current={start:monthStart,end:now};
    const previousStart=dateStart(date(monthStart-day).slice(0,7)+'-01');
    compare={start:previousStart,end:Math.min(monthStart,previousStart+now-monthStart)};
  }else{
    const start=filters.period==='custom'?dateStart(filters.from):today-(Number(filters.period)-1)*day;
    const last=filters.period==='custom'?dateStart(filters.to):today;
    if(!Number.isFinite(start)||!Number.isFinite(last)||start>last||last>today||last-start>=93*day)
      invalid('dashboard_invalid_period');
    current={start,end:Math.min(now,last+day)};
    const duration=(last-start)+day;
    compare={start:start-duration,end:current.end-duration};
  }
  return {current,compare,today:{start:today,end:now},latest:{start:today-7*day,end:today}};
}
const rangeArgs=(window:Window)=>[marks(window.start),marks(window.end)];
const shortWindow=(window:Window)=>({from:date(window.start),to:date(Math.max(window.start,window.end-1))});
const periods=(windows:ReturnType<typeof dashboardWindows>)=>{
  const {from,to}=shortWindow(windows.current);
  const {from:compareFrom,to:compareTo}=shortWindow(windows.compare);
  return {from,to,compareFrom,compareTo};
};

type OrderFact={
  id:string;createdAt:string;paidAt:string|null;state:string;learnerId:string|null;
  level?:string;format?:string;
  firstPaidAt?:string;firstProofAt?:string|null;entry?:string;language?:string;
  orderSource:DashboardSource;learnerSource:DashboardSource;mode:'self'|'assisted'|'staff'|'unclassified';
};
export function classifyDashboardSource(trusted:boolean,source:unknown,medium:unknown,promotionId:unknown,campaignCode:unknown,id:unknown):DashboardSource{
  const campaignId=typeof id==='string'&&id&&campaignCode!=='organic'?id:undefined;
  const campaign=campaignId&&typeof campaignCode==='string'?campaignCode:undefined;
  if(trusted&&typeof source==='string'&&source&&source!=='null'&&typeof medium==='string'&&medium&&medium!=='null'){
    if((typeof promotionId==='string'&&isWebsitePromotion(promotionId))||(source==='website'&&medium==='internal')){
      return {key:'website',kind:'website',source:'',medium:''};
    }
    return {key:JSON.stringify([source,medium,campaign]),kind:'verified',source,medium,campaignId,campaignCode:campaign};
  }
  if(campaign)return {key:'campaign:'+campaign,kind:'campaign',source:'',medium:'',campaignId,campaignCode:campaign};
  return {key:'unknown',kind:'unknown',source:'',medium:''};
}
const confirmation="n.channel='email' AND n.kind IN ('payment_confirmed','payment_and_opening')";
const orderAttributionColumns=`a.attribution->>'$.source' AS orderSource,a.attribution->>'$.medium' AS orderMedium,
  a.attribution->>'$.campaignId' AS orderCampaign,a.attribution->>'$.verified' AS verified,
  a.attribution->>'$.promotionId' AS orderPromotionId,order_campaign.id AS orderCampaignId`;
function readOrderSource(row:Record<string,unknown>){
  return classifyDashboardSource(row.verified==='true'||row.verified===true,row.orderSource,row.orderMedium,
    row.orderPromotionId,row.orderCampaign,row.orderCampaignId);
}
const learnerProfile="customer.profile->>'$.identityLifecycle'";
const canonicalJoin=`
  LEFT JOIN enrollment_customer_records link ON link.kind='order' AND link.record_id=o.id
  LEFT JOIN portal_leads original ON original.id=link.lead_id
  LEFT JOIN portal_leads customer ON customer.id=COALESCE(NULLIF(original.profile->>'$.identityMergedInto','null'),original.id)`;
function orderFilters(){return "(:p3='' OR b.data->>'$.level'=:p3) AND (:p4='' OR b.data->>'$.format'=:p4)";}
async function orderFacts(c:Client,window:Window,filters:DashboardFilters,includeProofs:boolean):Promise<OrderFact[]>{
  const {rows}=await c.query(`SELECT o.id,b.data->>'$.level' AS level,b.data->>'$.format' AS format,${iso('o.created_at')} AS createdAt,
    (SELECT ${iso('MIN(n.recorded_at)')} FROM enrollment_notification_receipts n WHERE n.subject_id=o.id AND ${confirmation}) AS paidAt,
    CASE WHEN :p5=1 THEN (SELECT ${iso('MIN(p.created_at)')} FROM enrollment_proofs p
      WHERE p.order_id=o.id AND p.created_at>=o.created_at) END AS firstProofAt,
    CASE WHEN o.state='awaiting_payment' AND o.received=0 AND o.payment_due_at<UTC_TIMESTAMP(6)
      AND (o.upload_expires_at IS NULL OR o.upload_expires_at<UTC_TIMESTAMP(6)) THEN 'expired' ELSE o.state END AS state,
    CASE WHEN COALESCE(${learnerProfile},'')<>'pending' THEN customer.id END AS learnerId,
    customer.profile->>'$.promotionLinkStatus' AS promotionStatus,customer.profile->>'$.promotionSnapshot.source' AS firstSource,
    customer.profile->>'$.promotionSnapshot.medium' AS firstMedium,customer.profile->>'$.promotionLinkId' AS firstPromotionId,
    customer.profile->>'$.campaignId' AS firstCampaign,
    a.attribution->>'$.entry' AS entry,a.attribution->>'$.via' AS via,a.attribution->>'$.lang' AS language,
    ${orderAttributionColumns},first_campaign.id AS firstCampaignId,
    EXISTS(SELECT 1 FROM enrollment_assisted_applications team WHERE team.order_id=o.id AND team.confirmed_at IS NOT NULL) AS assisted,
    EXISTS(SELECT 1 FROM portal_audit entry WHERE entry.action='enrollment.order.insert' AND entry.data->>'$.orderId'=o.id) AS staff
    FROM enrollment_orders o JOIN enrollment_classes b ON b.id=o.class_id
    LEFT JOIN enrollment_record_attribution a ON a.kind='order' AND a.record_id=o.id
    ${canonicalJoin}
    LEFT JOIN trial_campaigns first_campaign ON first_campaign.code=customer.profile->>'$.campaignId'
    LEFT JOIN trial_campaigns order_campaign ON order_campaign.code=a.attribution->>'$.campaignId'
    WHERE ${orderFilters()} AND (o.created_at>=:p1 AND o.created_at<:p2 OR EXISTS (
      SELECT 1 FROM enrollment_notification_receipts n WHERE n.subject_id=o.id AND ${confirmation} AND n.recorded_at>=:p1 AND n.recorded_at<:p2
    ))`,[...rangeArgs(window),filters.level,filters.format,Number(includeProofs)]);
  const ids=[...new Set(rows.filter(r=>r.learnerId&&r.paidAt).map(r=>r.learnerId))];
  const first=new Map<string,string>();
  for(let i=0;i<ids.length;i+=200){
    const history=await c.query(`SELECT customer.id AS id,${iso('MIN(n.recorded_at)')} AS paidAt
      FROM enrollment_orders o ${canonicalJoin}
      JOIN enrollment_notification_receipts n ON n.subject_id=o.id AND ${confirmation}
      WHERE customer.id IN (:p1) AND COALESCE(${learnerProfile},'')<>'pending'
      GROUP BY customer.id`,[ids.slice(i,i+200)]);
    for(const row of history.rows)first.set(row.id,row.paidAt);
  }
  return rows.map(row=>({
    id:row.id,level:row.level,format:row.format,createdAt:row.createdAt,paidAt:row.paidAt,state:row.state,learnerId:row.learnerId,
    firstPaidAt:first.get(row.learnerId),firstProofAt:row.firstProofAt,
    entry:row.via==='ai_chat'||row.via==='whatsapp'?row.via:row.entry==='null'?undefined:row.entry,
    language:row.language==='en'||row.language==='id'||row.language==='zh'?row.language:'unknown',
    learnerSource:classifyDashboardSource(row.promotionStatus==='verified',row.firstSource,row.firstMedium,row.firstPromotionId,row.firstCampaign,row.firstCampaignId),
    orderSource:readOrderSource(row),
    mode:Number(row.assisted)?'assisted':Number(row.staff)?'staff':row.entry&&row.entry!=='null'?'self':'unclassified',
  }));
}

const closedPaidStates=['paid','recovered','refunding','refunded'];
const hasUnknownPaymentTime=(fact:OrderFact)=>!fact.paidAt&&closedPaidStates.includes(fact.state);

export function summarizeDashboardOrders(facts:OrderFact[],window:Window,now:number){
  const metrics:DashboardMetrics={orders:0,paid:0,first:0,identityUnknown:0,timingUnknown:0,paidWithinWindow:0,
    mature:0,observing:0,self:0,staff:0,assisted:0,unclassified:0,awaiting:0,partial:0,expired:0,cancelled:0,review:0};
  const sources=new Map<string,DashboardSources>();
  const entries=new Map<string,number>();
  const first=new Set<string>();
  const seen=new Set<string>();
  function sourceGroup(source:DashboardSource){
    const group=sources.get(source.key)??{...source,orders:0,first:0,mature:0,paidWithinWindow:0};
    sources.set(source.key,group);
    return group;
  }
  for(const fact of facts){
    if(seen.has(fact.id))continue;
    seen.add(fact.id);
    const created=instant(fact.createdAt),confirmed=instant(fact.paidAt);
    if(contains(window,created)){
      metrics.orders++;
      const source=sourceGroup(fact.orderSource);
      source.orders++;
      const entry=fact.entry||'unknown';
      entries.set(entry,(entries.get(entry)??0)+1);
      if(created+7*day<=now){
        if(hasUnknownPaymentTime(fact))metrics.timingUnknown++;
        else{
          metrics.mature++;
          source.mature++;
          if(confirmed>=created&&confirmed<=created+7*day){
            metrics.paidWithinWindow++;
            source.paidWithinWindow++;
          }
        }
      }else metrics.observing++;
      if(fact.state==='awaiting_payment')metrics.awaiting++;
      else if(fact.state==='partial')metrics.partial++;
      else if(fact.state==='expired')metrics.expired++;
      else if(fact.state==='ended')metrics.cancelled++;
      else if(fact.state==='proof_review')metrics.review++;
    }
    if(contains(window,confirmed)){
      metrics.paid++;
      metrics[fact.mode]++;
      if(!fact.learnerId||!fact.firstPaidAt)metrics.identityUnknown++;
      else if(fact.firstPaidAt===fact.paidAt&&!first.has(fact.learnerId)){
        first.add(fact.learnerId);
        sourceGroup(fact.learnerSource).first++;
      }
    }
  }
  metrics.first=first.size;
  return {metrics,sources:[...sources.values()].sort((a,b)=>b.first-a.first||b.orders-a.orders||a.key.localeCompare(b.key)),
    entries:[...entries].map(([entry,count])=>({entry,count})).sort((a,b)=>b.count-a.count)};
}

export function dashboardReservationOutcomes(facts:OrderFact[],window:Window,now:number){
  const entries=new Map<string,DashboardReservationOutcome>();
  const languages=new Map<string,DashboardReservationOutcome>();
  const seen=new Set<string>();
  function outcome(groups:Map<string,DashboardReservationOutcome>,key:string){
    const row=groups.get(key)??{key,orders:0,eligible:0,observing:0,timingUnknown:0,proof:0,paidAfterProof:0,paidWithoutPriorProof:0};
    groups.set(key,row);
    return row;
  }
  for(const fact of facts){
    const created=instant(fact.createdAt);
    if(!contains(window,created)||seen.has(fact.id))continue;
    seen.add(fact.id);
    const cutoff=created+7*day;
    const mature=cutoff<=now;
    const paid=instant(fact.paidAt),proof=instant(fact.firstProofAt);
    const within=(time:number)=>time>=created&&time<=cutoff;
    for(const row of [outcome(entries,fact.entry||'unknown'),outcome(languages,fact.language||'unknown')]){
      row.orders++;
      if(!mature)row.observing++;
      else if(hasUnknownPaymentTime(fact))row.timingUnknown++;
      else{
        row.eligible++;
        if(within(proof))row.proof++;
        if(within(paid)){
          if(within(proof)&&proof<=paid)row.paidAfterProof++;
          else row.paidWithoutPriorProof++;
        }
      }
    }
  }
  const ordered=(groups:Map<string,DashboardReservationOutcome>)=>[...groups.values()].sort((a,b)=>b.orders-a.orders||a.key.localeCompare(b.key));
  return {entries:ordered(entries),languages:ordered(languages)};
}

export function dashboardPaymentCohorts(facts:OrderFact[],window:Window,now:number):DashboardCohort[]{
  const groups=new Map<string,DashboardCohort>();
  const seen=new Set<string>();
  for(const fact of facts){
    const created=instant(fact.createdAt),paid=instant(fact.paidAt);
    if(!contains(window,created)||seen.has(fact.id))continue;
    seen.add(fact.id);
    const weekday=(new Date(created+wib).getUTCDay()+6)%7;
    const week=date(created-weekday*day);
    const cohort=groups.get(week)??{week,orders:0,windows:[1,3,7].map(days=>({days,confirmed:0,observed:0}))};
    cohort.orders++;
    const unknownTiming=hasUnknownPaymentTime(fact);
    for(const item of cohort.windows)if(!unknownTiming&&created+item.days*day<=now){
      item.observed++;
      if(paid>=created&&paid<=created+item.days*day)item.confirmed++;
    }
    groups.set(week,cohort);
  }
  return [...groups.values()].sort((a,b)=>a.week.localeCompare(b.week));
}

const cashRows=`SELECT r.order_id,r.created_at,r.amount,r.reference,'received' AS kind FROM enrollment_receipts r
    WHERE r.created_at>=:p1 AND r.created_at<:p2
  UNION ALL SELECT p.order_id,p.created_at,p.amount,p.reference,'refunded' FROM enrollment_refund_payments p
    WHERE p.created_at>=:p1 AND p.created_at<:p2
  UNION ALL SELECT p.order_id,t.created_at,t.amount,t.reference,'returned' FROM enrollment_refund_returns t
    JOIN enrollment_refund_payments p ON p.reference=t.refund_reference
    WHERE t.created_at>=:p1 AND t.created_at<:p2`;
type CashFact={at:string;kind:'received'|'refunded'|'returned';amount:number;level?:string;format?:string;orderSource?:DashboardSource};
async function cashFacts(c:Client,window:Window,filters:DashboardFilters):Promise<CashFact[]>{
  const {rows}=await c.query(`SELECT ${iso('t.created_at')} AS recordedAt,t.kind,t.amount,
    b.data->>'$.level' AS level,b.data->>'$.format' AS format,${orderAttributionColumns} FROM (${cashRows}) t
    JOIN enrollment_orders o ON o.id=t.order_id JOIN enrollment_classes b ON b.id=o.class_id
    LEFT JOIN enrollment_record_attribution a ON a.kind='order' AND a.record_id=o.id
    LEFT JOIN trial_campaigns order_campaign ON order_campaign.code=a.attribution->>'$.campaignId'
    WHERE ${orderFilters()}`,[...rangeArgs(window),filters.level,filters.format]);
  return rows.map(row=>({at:row.recordedAt,kind:row.kind,amount:Number(row.amount),level:row.level,format:row.format,orderSource:readOrderSource(row)}));
}
export function summarizeDashboardCash(rows:CashFact[],window:Window):DashboardCash{
  const amounts={received:0,refunded:0,returned:0,net:0};
  for(const row of rows)if(contains(window,instant(row.at)))amounts[row.kind]+=Number(row.amount);
  amounts.net=amounts.received-amounts.refunded+amounts.returned;
  return amounts;
}

type ActivityFact={level?:string;format?:string;orderSource?:DashboardSource};
type GroupTotal={paid:number;net:number};
type ActivitySummary=ReturnType<typeof summarizeDashboardActivity>;
const unknownSource:DashboardSource={key:'unknown',kind:'unknown',source:'',medium:''};
function contributionChannel(source=unknownSource):DashboardSource{
  const key=source.kind==='verified'?JSON.stringify([source.source,source.medium]):source.kind;
  return {key,kind:source.kind,source:source.source,medium:source.medium};
}
export function summarizeDashboardActivity(orders:(ActivityFact&{paidAt:string|null})[],movements:CashFact[]|null,window:Window){
  const days=new Map<string,DashboardTrend>();
  const byLevel=new Map<string,GroupTotal>(),byFormat=new Map<string,GroupTotal>();
  const bySource=new Map<string,GroupTotal&{source:DashboardSource}>();
  for(let start=window.start;start<window.end;start+=day){
    const at=date(start);
    days.set(at,{date:at,paid:0,cash:movements?{received:0,refunded:0,returned:0,net:0}:null});
  }
  function group(fact:ActivityFact,paid:number,net:number){
    const level=fact.level??'',format=fact.format??'',source=contributionChannel(fact.orderSource);
    const levelTotal=byLevel.get(level)??{paid:0,net:0};
    const formatTotal=byFormat.get(format)??{paid:0,net:0};
    const sourceTotal=bySource.get(source.key)??{source,paid:0,net:0};
    for(const total of [levelTotal,formatTotal,sourceTotal]){total.paid+=paid;total.net+=net;}
    byLevel.set(level,levelTotal);
    byFormat.set(format,formatTotal);
    bySource.set(source.key,sourceTotal);
  }
  for(const order of orders){
    const time=instant(order.paidAt);
    if(!contains(window,time))continue;
    days.get(date(time))!.paid++;
    group(order,1,0);
  }
  for(const movement of movements??[]){
    const time=instant(movement.at);
    if(!contains(window,time))continue;
    const cash=days.get(date(time))!.cash!;
    const net=movement.kind==='refunded'?-movement.amount:movement.amount;
    cash[movement.kind]+=movement.amount;
    cash.net+=net;
    group(movement,0,net);
  }
  return {trend:[...days.values()],byLevel,byFormat,bySource};
}

function compareActivity(current:ActivitySummary,previous:ActivitySummary,hasCash:boolean){
  function compare<T extends GroupTotal>(first:Map<string,T>,second:Map<string,T>){
    return [...new Map([...second,...first])].flatMap(([key,total])=>{
      const a=first.get(key),b=second.get(key);
      const change:DashboardChange={paid:a?.paid??0,previousPaid:b?.paid??0,
        net:hasCash?a?.net??0:null,previousNet:hasCash?b?.net??0:null};
      return change.paid||change.previousPaid||change.net||change.previousNet?[{key,change,total}]:[];
    });
  }
  return {
    contributions:compare(current.byLevel,previous.byLevel).map(({key,change})=>({...change,level:key})),
    formatContributions:compare(current.byFormat,previous.byFormat).map(({key,change})=>({...change,format:key})),
    channelContributions:compare(current.bySource,previous.bySource).map(({change,total})=>({...change,source:total.source})),
  };
}

async function cashDetails(c:Client,window:Window,filters:DashboardFilters,kind:string,page:number):Promise<DashboardMovementPage>{
  const pageSize=30;
  const {rows}=await c.query(`SELECT ${iso('t.created_at')} AS recordedAt,${iso('r.settled_at')} AS settledAt,
    t.kind,t.amount,t.reference,t.order_id AS orderId FROM (${cashRows}) t
    JOIN enrollment_orders o ON o.id=t.order_id JOIN enrollment_classes b ON b.id=o.class_id
    LEFT JOIN enrollment_receipts r ON t.kind='received' AND r.reference=t.reference
    WHERE ${orderFilters()} AND (:p5='' OR t.kind=:p5)
    ORDER BY t.created_at DESC,t.kind,t.reference LIMIT :p6 OFFSET :p7`,
  [...rangeArgs(window),filters.level,filters.format,kind,String(pageSize+1),String((page-1)*pageSize)]);
  return {rows:rows.slice(0,pageSize).map(({recordedAt,settledAt,kind,amount,orderId,reference})=>({
    at:recordedAt,settledAt,kind,amount:Number(amount),orderId,reference,
  })),more:rows.length>pageSize,page};
}

export function summarizeDashboardQueueAges(timestamps:(string|null)[],now:number):DashboardQueueAges{
  const ages={under24:0,under72:0,atLeast72:0,unknown:0};
  for(const timestamp of timestamps){
    const age=now-instant(timestamp);
    if(!Number.isFinite(age)||age<0)ages.unknown++;
    else if(age<day)ages.under24++;
    else if(age<3*day)ages.under72++;
    else ages.atLeast72++;
  }
  return ages;
}

async function financeQueue(c:Client,now:number){
  const {pending,oldest,submittedAt}=await readEnrollmentFinancePendingSummary(c);
  const {rows:[r]}=await c.query(`SELECT COUNT(*) AS refunds,
    COUNT(CASE WHEN f.created_at>:p2 AND f.created_at<=:p1 THEN 1 END) AS under24,
    COUNT(CASE WHEN f.created_at>:p3 AND f.created_at<=:p2 THEN 1 END) AS under72,
    COUNT(CASE WHEN f.created_at<=:p3 THEN 1 END) AS atLeast72,
    COUNT(CASE WHEN f.created_at IS NULL OR f.created_at>:p1 THEN 1 END) AS ageUnknown,
    COALESCE(SUM(GREATEST(0,CAST(f.expected AS SIGNED)
      -CAST(COALESCE((SELECT SUM(p.amount) FROM enrollment_refund_payments p WHERE p.order_id=f.order_id),0) AS SIGNED)
      +CAST(COALESCE((SELECT SUM(t.amount) FROM enrollment_refund_returns t JOIN enrollment_refund_payments p
        ON p.reference=t.refund_reference WHERE p.order_id=f.order_id),0) AS SIGNED))),0) AS outstanding,
    (SELECT COALESCE(SUM(GREATEST(0,CAST(o.price AS SIGNED)-CAST(o.received AS SIGNED))),0)
      FROM enrollment_orders o JOIN enrollment_classes b ON b.id=o.class_id
      WHERE b.state='published' AND (o.state IN ('proof_review','partial') OR
        o.state='awaiting_payment' AND (o.received>0 OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.upload_expires_at>=UTC_TIMESTAMP(6)))) AS receivable
    FROM enrollment_refund_cases f JOIN enrollment_orders o ON o.id=f.order_id WHERE o.state='refunding'`,
  [marks(now),marks(now-day),marks(now-3*day)]);
  return {pending,oldest,refunds:Number(r.refunds),refundOutstanding:Number(r.outstanding),receivable:Number(r.receivable),
    reviewAges:summarizeDashboardQueueAges(submittedAt,now),refundAges:{
      under24:Number(r.under24),under72:Number(r.under72),atLeast72:Number(r.atLeast72),unknown:Number(r.ageUnknown),
    }};
}
async function followupQueue(c:Client){
  const {rows:[row]}=await c.query(`SELECT COUNT(*) AS open,
    COALESCE(SUM(t.due_at<UTC_TIMESTAMP(6)),0) AS overdue
    FROM followup_tasks t JOIN portal_leads l ON l.id=t.lead_id
    WHERE t.kind='consultation' AND t.status='open' AND COALESCE(l.profile->>'$.identityLifecycle','')<>'pending'
      AND l.profile->>'$.identityMergedInto' IS NULL`);
  return {open:Number(row.open),overdue:Number(row.overdue)};
}
async function demandSummary(c:Client){
  const {rows}=await c.query(`SELECT level,period,format,demand_state AS state,COUNT(*) AS count FROM
    (SELECT criteria->>'$.level' AS level,criteria->>'$.period' AS period,COALESCE(criteria->>'$.format','') AS format,
      CASE WHEN JSON_TYPE(criteria->'$.appointment.confirmation')='OBJECT' THEN 'confirmed' ELSE state END AS demand_state
      FROM enrollment_demands) d GROUP BY level,period,format,demand_state`);
  return rows.map(row=>({...row,count:Number(row.count)}));
}

export async function readOperationsDashboardSnapshot(c:Client,actor:Employee,filters:DashboardFilters,now:number,
  reportTopic:'acquisition'|'wallboard'|'teaching'|'economics'|null=null):Promise<DashboardSnapshot>{
  const scope=dashboardScopes(actor),windows=dashboardWindows(filters,now);
  const selected={start:windows.compare.start,end:windows.current.end};
  const independent=selected.end<windows.latest.start;
  const bounds={start:Math.min(selected.start,windows.latest.start),end:independent?selected.end:now};
  const recent={start:windows.latest.start,end:now};
  const includeProofs=reportTopic==='acquisition';
  let orders=await orderFacts(c,bounds,filters,includeProofs);
  if(independent){
    const newer=await orderFacts(c,recent,filters,includeProofs);
    orders=[...new Map([...orders,...newer].map(order=>[order.id,order])).values()];
  }
  const current=summarizeDashboardOrders(orders,windows.current,now);
  const compare=summarizeDashboardOrders(orders,windows.compare,now);
  const today=summarizeDashboardOrders(orders,windows.today,now);
  const latest=summarizeDashboardOrders(orders,windows.latest,now);
  const movements=scope.finance?await cashFacts(c,bounds,filters):null;
  if(independent&&movements)movements.push(...await cashFacts(c,recent,filters));
  const activity=summarizeDashboardActivity(orders,movements,windows.current);
  const previousActivity=summarizeDashboardActivity(orders,movements,windows.compare);
  const changes=compareActivity(activity,previousActivity,movements!==null);
  const memberships=enrollmentManagementScopes(actor);
  const classRows=await readEnrollmentManagementSummaries(c,actor,memberships,null);
  const upcoming=classRows.filter(row=>{
    const begins=crmInstant(row.firstLessonAt)?.getTime()??NaN;
    return row.status!=='cancelled'&&begins>=now&&begins<now+14*day&&
      (!filters.level||row.level===filters.level)&&(!filters.format||row.format===filters.format);
  }).sort((a,b)=>Number(a.status==='opened')-Number(b.status==='opened')||
    a.firstLessonAt.localeCompare(b.firstLessonAt)||a.id.localeCompare(b.id));
  const queue=scope.finance?await financeQueue(c,now):null;
  const followup=scope.followup?await followupQueue(c):null;
  const demand=scope.operations?await demandSummary(c):null;
  const {rows:[assists]}=await c.query(`SELECT COUNT(*) AS offered,COALESCE(SUM(a.order_id IS NOT NULL),0) AS confirmed
    FROM enrollment_assisted_applications a JOIN enrollment_classes b ON b.id=a.class_id
    WHERE a.created_at>=:p1 AND a.created_at<:p2 AND ${orderFilters()}`,[...rangeArgs(windows.current),filters.level,filters.format]);
  const selectedWindow=reportTopic==='wallboard'?windows.latest:windows.current;
  const from=date(selectedWindow.start),to=date(Math.min(selectedWindow.end,windows.today.start)-1);
  const environment=trafficEnvironment(process.env.PORTAL_ENV??'dev');
  const traffic=reportTopic==='acquisition'||reportTopic==='wallboard'?await readGaTraffic(c,environment,from,to,now):undefined;
  const adSpend=reportTopic==='acquisition'&&scope.marketing?await readDashboardAdSpend(c,environment,from,to,now):undefined;
  const economicsView=reportTopic==='economics'&&scope.operations&&scope.finance;
  const teachingView=reportTopic==='teaching'&&scope.operations;
  const lessonReport=teachingView||economicsView?await readDashboardTeaching(c,environment,{from,to,level:filters.level,format:filters.format,now},economicsView):null;
  return {asOf:new Date(now).toISOString(),period:periods(windows),trafficPeriod:shortWindow(windows.latest),traffic,adSpend,
    teaching:teachingView?lessonReport?.teaching:undefined,economics:economicsView?lessonReport?.economics:undefined,
    current:current.metrics,compare:compare.metrics,today:today.metrics,
    sources:current.sources,compareSources:compare.sources,latestSources:latest.sources,entries:current.entries,latestEntries:latest.entries,
    reservationOutcomes:includeProofs?dashboardReservationOutcomes(orders,windows.current,now):{entries:[],languages:[]},
    upcoming,demand,queue,followup,trend:activity.trend,compareTrend:previousActivity.trend,...changes,
    cohorts:dashboardPaymentCohorts(orders,windows.current,now),
    cash:movements?{current:summarizeDashboardCash(movements,windows.current),compare:summarizeDashboardCash(movements,windows.compare),
      today:summarizeDashboardCash(movements,windows.today)}:null,
    assists:{offered:Number(assists.offered),confirmed:Number(assists.confirmed)}};
}

export function mountOperationsDashboard(app:Express,wrap:(fn:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>void,
  staff:(q:Request,permission:string)=>Promise<Employee>){
  app.get('/api/crm/operations-dashboard',wrap(async(q,r)=>{
    const actor=await staff(q,'crm.read');
    if(!dashboardScopes(actor).view)invalid('dashboard_forbidden',403);
    const params=new URL('http://localhost'+q.originalUrl).searchParams;
    const filters=readDashboardFilters(params);
    const topic=params.get('dashboardTopic');
    const now=Date.now();
    dashboardWindows(filters,now);
    r.set('Cache-Control','private, no-store').json(await tx(c=>readOperationsDashboardSnapshot(c,actor,filters,now,
      topic==='acquisition'||topic==='wallboard'||topic==='teaching'||topic==='economics'?topic:null)));
  }));
  app.get('/api/crm/operations-dashboard/cash',wrap(async(q,r)=>{
    const actor=await staff(q,'crm.read');
    if(!dashboardScopes(actor).finance)invalid('dashboard_forbidden',403);
    const params=new URL('http://localhost'+q.originalUrl).searchParams;
    const filters=readDashboardFilters(params);
    const kind=params.get('kind')??'';
    const page=Number(params.get('page')??'1');
    if(!['','received','refunded','returned'].includes(kind)||!Number.isSafeInteger(page)||page<1||page>1_000)
      invalid('dashboard_invalid_detail');
    const period=dashboardWindows(filters,Date.now()).current;
    r.set('Cache-Control','private, no-store').json(await tx(c=>cashDetails(c,period,filters,kind,page)));
  }));
}
