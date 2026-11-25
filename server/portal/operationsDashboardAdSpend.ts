import {dashboardAdSpendScale,dashboardDate,dashboardDay,dashboardReportingDates,
  type DashboardAdSpend,type DashboardAdSpendMapping,type DashboardAdSpendRow} from '../../src/utils/crmOperationsDashboard.ts';
import {promotionIdPattern,promotionKindForMedium} from '../../src/utils/promotionNavigation.ts';
import type {trafficEnvironment} from './operationsDashboardTraffic.ts';

type Environment=ReturnType<typeof trafficEnvironment>;
type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type AdCampaign={campaignId:string;name:string;amount:number};
type SpendDay={date:string;total:number;campaigns:AdCampaign[]};
type AdReport={
  platform:string;accountId:string;currency:string;extractedAt:string;
  days:SpendDay[];mappings:Map<string,string>;
};
type StoredDay={
  platform:string;accountId:string;currency:string;extractedAt:string;
  campaigns:(AdCampaign&{mapping:DashboardAdSpendMapping|null})[];
};

const prefix=(environment:Environment,date:string)=>`dashboard_ads_v1:${environment}:${date}:`;
function object(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected an advertising report object');
  return value as Record<string,unknown>;
}
function string(value:unknown,pattern:RegExp,field:string){
  if(typeof value!=='string'||!pattern.test(value))throw Error('Invalid advertising report field: '+field);
  return value;
}
const identifier=/^[A-Za-z0-9_-]{1,48}$/;
function amount(value:unknown){
  const decimal=string(value,/^\d{1,12}(?:\.\d{1,4})?$/,'decimal spend');
  const [whole,fraction='']=decimal.split('.');
  return checkedSum(Number(whole)*dashboardAdSpendScale,Number(fraction.padEnd(4,'0')));
}
function checkedSum(left:number,right:number){
  const sum=left+right;
  if(!Number.isSafeInteger(sum)||sum<0)throw Error('Advertising spend exceeds supported precision');
  return sum;
}

export function parseDashboardAdSpend(input:unknown,environment:Environment,now=Date.now()):AdReport{
  const report=object(input);
  if(report.version!==1||report.timeZone!=='Asia/Jakarta'||report.metric!=='spend')
    throw Error('Use version 1 daily spend with Asia/Jakarta report dates');
  if(report.environment!==environment)throw Error('Advertising report environment does not match the requested import');
  const platform=string(report.platform,/^[a-z][a-z0-9_-]{0,23}$/,'platform');
  const accountId=string(report.accountId,identifier,'accountId');
  const currency=string(report.currency,/^[A-Z]{3}$/,'currency');
  const extractedAt=string(report.extractedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,'extractedAt');
  const extracted=Date.parse(extractedAt);
  if(!Number.isFinite(extracted)||new Date(extracted).toISOString()!==extractedAt||extracted>now)
    throw Error('Invalid advertising export timestamp');
  const from=string(report.from,/^\d{4}-\d{2}-\d{2}$/,'from'),to=string(report.to,/^\d{4}-\d{2}-\d{2}$/,'to');
  const dates=dashboardReportingDates(from,to,extracted);
  if(!Array.isArray(report.days)||report.days.length!==dates.length)throw Error('Provide an account total for every report date');
  const daysByDate=new Map<string,SpendDay>();
  const knownCampaigns=new Set<string>();
  for(const value of report.days){
    const day=object(value);
    const date=string(day.date,/^\d{4}-\d{2}-\d{2}$/,'day date');
    if(daysByDate.has(date)||!Array.isArray(day.campaigns))throw Error('Invalid or duplicate advertising report day');
    const seen=new Set<string>();
    const campaigns=day.campaigns.map(value=>{
      const row=object(value);
      const campaignId=string(row.campaignId,identifier,'campaignId');
      if(seen.has(campaignId))throw Error('Duplicate advertising campaign on the same day');
      seen.add(campaignId);
      knownCampaigns.add(campaignId);
      const name=row.name===undefined?campaignId:string(row.name,/^[^\u0000-\u001f\u007f]{1,100}$/u,'campaign name').trim();
      return {campaignId,name:name||campaignId,amount:amount(row.spend)};
    });
    const total=amount(day.total);
    if(campaigns.reduce((sum,row)=>checkedSum(sum,row.amount),0)!==total)
      throw Error('Advertising campaigns do not reconcile with the account day total');
    daysByDate.set(date,{date,total,campaigns});
  }
  const days=dates.map(date=>{
    const day=daysByDate.get(date);
    if(!day)throw Error('Provide an account total for every report date');
    return day;
  });
  const mappings=new Map<string,string>();
  const map=report.mappings??[];
  if(!Array.isArray(map))throw Error('Invalid advertising mapping list');
  for(const entry of map){
    const row=object(entry);
    const id=string(row.campaignId,identifier,'mapped campaignId');
    const p=string(row.promotionId,promotionIdPattern,'promotionId');
    if(!knownCampaigns.has(id)||mappings.has(id))throw Error('Advertising mapping must refer to a unique campaign in the export');
    mappings.set(id,p);
  }
  return {platform,accountId,currency,extractedAt,days,mappings};
}

export function summarizeDashboardAdSpendImport(report:AdReport){
  let spend=0,mapped=0;
  for(const day of report.days){
    spend=checkedSum(spend,day.total);
    for(const row of day.campaigns)if(report.mappings.has(row.campaignId))mapped=checkedSum(mapped,row.amount);
  }
  return {platform:report.platform,accountId:report.accountId,currency:report.currency,from:report.days[0].date,
    to:report.days.at(-1)?.date,days:report.days.length,amount:spend/dashboardAdSpendScale,
    withoutMappingProposal:(spend-mapped)/dashboardAdSpendScale};
}

export async function storeDashboardAdSpend(db:Client,environment:Environment,report:AdReport){
  const links=new Map<string,DashboardAdSpendMapping>();
  const requested=[...new Set(report.mappings.values())];
  for(let start=0;start<requested.length;start+=150){
    const {rows}=await db.query(`SELECT i.p,c.id,c.code,c.config FROM campaign_promotion_index i
      JOIN trial_campaigns c ON c.id=i.campaign_id WHERE i.p IN (:p1)`,[requested.slice(start,start+150)]);
    for(const row of rows){
      const link=row.config?.promotionLinks?.find((candidate:{id:string})=>candidate.id===row.p);
      if(link&&(link.promotionKind??promotionKindForMedium(link.medium))==='paid')
        links.set(row.p,{promotionId:row.p,campaignId:row.id,campaignCode:row.code});
    }
  }
  if(requested.some(id=>!links.has(id)))throw Error('Every advertising mapping must reference an existing paid UPER promotion link');
  const {platform,accountId,currency,extractedAt}=report;
  for(const day of report.days){
    const stored:StoredDay={platform,accountId,currency,extractedAt,campaigns:day.campaigns.map(row=>{
      const promotionId=report.mappings.get(row.campaignId);
      return {...row,mapping:promotionId?links.get(promotionId)??null:null};
    })};
    await db.query(`INSERT INTO portal_settings(id,value) VALUES(:p1,:p2)
      ON DUPLICATE KEY UPDATE value=IF(value->>'$.extractedAt'<:p3,:p2,value)`,
    [prefix(environment,day.date)+platform+':'+Buffer.from(accountId).toString('hex'),stored,extractedAt]);
  }
}

export async function readDashboardAdSpend(db:Client,environment:Environment,from:string,to:string,
  now=Date.now()):Promise<DashboardAdSpend|null>{
  if(from>to)return null;
  const dates=dashboardReportingDates(from,to,now);
  const after=dashboardDate(Date.parse(to+'T00:00:00+07:00')+dashboardDay);
  const {rows}=await db.query('SELECT value FROM portal_settings WHERE id>=:p1 AND id<:p2',
    [prefix(environment,from),prefix(environment,after)]);
  if(!rows.length)return null;
  const accounts=new Map<string,DashboardAdSpend['accounts'][number]>();
  const currencies=new Map<string,DashboardAdSpend['currencies'][number]>();
  const campaigns=new Map<string,DashboardAdSpendRow&{extractedAt:string}>();
  for(const {value} of rows){
    const {platform,accountId,currency,extractedAt,campaigns:daily}=value as StoredDay;
    const scope=[platform,accountId,currency];
    const accountKey=JSON.stringify(scope);
    const account=accounts.get(accountKey)??{platform,accountId,currency,days:0,asOf:extractedAt};
    account.days++;
    if(extractedAt<account.asOf)account.asOf=extractedAt;
    accounts.set(accountKey,account);
    const summary=currencies.get(currency)??{currency,amount:0,mapped:0};
    for(const row of daily){
      summary.amount=checkedSum(summary.amount,row.amount);
      if(row.mapping)summary.mapped=checkedSum(summary.mapped,row.amount);
      const key=JSON.stringify([...scope,row.campaignId,row.mapping?.promotionId,row.mapping?.campaignId]);
      const group=campaigns.get(key)??{...row,platform,accountId,currency,extractedAt,amount:0};
      group.amount=checkedSum(group.amount,row.amount);
      if(extractedAt>group.extractedAt){group.extractedAt=extractedAt;group.name=row.name;}
      campaigns.set(key,group);
    }
    currencies.set(currency,summary);
  }
  return {from,to,expectedDays:dates.length,accounts:[...accounts.values()],
    currencies:[...currencies.values()].sort((left,right)=>left.currency.localeCompare(right.currency)),
    campaigns:[...campaigns.values()].sort((left,right)=>left.currency.localeCompare(right.currency)||
      right.amount-left.amount||left.campaignId.localeCompare(right.campaignId))
      .map(({extractedAt,...row})=>row)};
}
