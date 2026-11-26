import analytics from '../../src/data/analyticsEnvironments.json';
import {dashboardDate,dashboardDay,dashboardReportingDates,enrollmentFunnelSteps,type DashboardEnrollmentFunnel,
  type EnrollmentFunnelCampaign,type EnrollmentFunnelChannel,type EnrollmentFunnelCounts} from '../../src/utils/crmOperationsDashboard.ts';
import type {trafficEnvironment} from './operationsDashboardTraffic.ts';

type Environment=ReturnType<typeof trafficEnvironment>;
type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type FunnelDay={date:string;fetchedAt:string;missingSessionViews:number;campaigns:EnrollmentFunnelCampaign[]};
const key=(environment:Environment,date:string)=>'ga_enrollment_funnel_v1:'+environment+':'+date;
const blank=():EnrollmentFunnelCounts=>({landed:0,viewedClass:0,started:0,reserved:0,savedProof:0});
const add=(to:EnrollmentFunnelCounts,from:EnrollmentFunnelCounts)=>{
  for(const step of enrollmentFunnelSteps)to[step]+=from[step];
};
const invalid=()=>{throw Error('Invalid GA4 enrollment funnel report');};
function object(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
  return value as Record<string,unknown>;
}
function count(value:unknown){
  const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>1_000_000_000)return invalid();
  return n;
}
function label(value:unknown,campaign=false){
  if(typeof value!=='string')return invalid();
  if(campaign&&value==='')return value;
  if(!campaign&&['(direct)','(none)','(not set)','(other)'].includes(value))return value;
  return /^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(value)?value.toLowerCase():invalid();
}

/** Accept only the aggregate output from the versioned BigQuery report. */
export function parseEnrollmentFunnelReport(input:unknown,environment:Environment,now=Date.now()):FunnelDay[]{
  if(!Array.isArray(input)||input.length<1||input.length>93)return invalid();
  const {streamId}=analytics.environments[environment];
  const dates=new Set<string>();
  return input.map(raw=>{
    const day=object(raw);
    if(String(day.version)!=='1'||day.environment!==environment||String(day.streamId)!==streamId||
      typeof day.date!=='string'||typeof day.fetchedAt!=='string'||!Array.isArray(day.campaigns)||day.campaigns.length>5000)
      return invalid();
    const {date,fetchedAt}=day;
    const extracted=Date.parse(fetchedAt);
    if(!Number.isFinite(extracted)||new Date(extracted).toISOString()!==fetchedAt||extracted>now||
      date>dashboardDate(extracted-2*dashboardDay)||dates.has(date))return invalid();
    dashboardReportingDates(date,date,now);
    dates.add(date);
    const segments=new Set<string>();
    const campaigns=day.campaigns.map(rawCampaign=>{
      const row=object(rawCampaign);
      const channel={source:label(row.source),medium:label(row.medium),campaignId:label(row.campaignId,true),campaign:label(row.campaign,true)};
      const counts=Object.fromEntries(enrollmentFunnelSteps.map(step=>[step,count(row[step])])) as EnrollmentFunnelCounts;
      if(!counts.landed||counts.viewedClass>counts.landed||counts.started>counts.landed||
        counts.reserved>counts.started||counts.savedProof>counts.reserved)return invalid();
      const segment=JSON.stringify(Object.values(channel));
      if(segments.has(segment))return invalid();
      segments.add(segment);
      return {...channel,...counts};
    });
    return {date,fetchedAt,missingSessionViews:count(day.missingSessionViews),campaigns};
  }).sort((a,b)=>a.date.localeCompare(b.date));
}

export async function storeEnrollmentFunnel(db:Client,environment:Environment,days:FunnelDay[]){
  for(const day of days)await db.query(`INSERT INTO portal_settings(id,value) VALUES(:p1,:p2)
      ON DUPLICATE KEY UPDATE value=IF(value->>'$.fetchedAt'<:p3,:p2,value)`,[key(environment,day.date),day,day.fetchedAt]);
}

export async function readEnrollmentFunnel(db:Client,environment:Environment,from:string,to:string,now:number):Promise<DashboardEnrollmentFunnel|null>{
  if(from>to)return null;
  const expectedDays=dashboardReportingDates(from,to,now).length;
  const {rows}=await db.query('SELECT value FROM portal_settings WHERE id BETWEEN :p1 AND :p2',[key(environment,from),key(environment,to)]);
  if(!rows.length)return null;
  const totals=blank();
  const channels=new Map<string,EnrollmentFunnelChannel>(),campaigns=new Map<string,EnrollmentFunnelCampaign>();
  let missingSessionViews=0,fetchedAt='',firstCovered='',lastCovered='';
  for(const {value:day} of rows as {value:FunnelDay}[]){
    missingSessionViews+=day.missingSessionViews;
    if(!firstCovered||day.date<firstCovered)firstCovered=day.date;
    if(day.date>lastCovered)lastCovered=day.date;
    if(!fetchedAt||day.fetchedAt<fetchedAt)fetchedAt=day.fetchedAt;
    for(const segment of day.campaigns){
      const {source,medium,campaignId,campaign}=segment;
      const channelKey=JSON.stringify([source,medium]),campaignKey=JSON.stringify([source,medium,campaignId,campaignId?'':campaign]);
      if(!channels.has(channelKey))channels.set(channelKey,{source,medium,...blank()});
      if(!campaigns.has(campaignKey))campaigns.set(campaignKey,{source,medium,campaignId,campaign,...blank()});
      const combined=campaigns.get(campaignKey)!;
      if(!combined.campaign&&campaign)combined.campaign=campaign;
      add(combined,segment);
      add(channels.get(channelKey)!,segment);
      add(totals,segment);
    }
  }
  const byVolume=(a:EnrollmentFunnelCounts,b:EnrollmentFunnelCounts)=>b.landed-a.landed;
  return {from,to,firstCovered,lastCovered,coveredDays:rows.length,expectedDays,fetchedAt,missingSessionViews,totals,
    channels:[...channels.values()].sort(byVolume).slice(0,40),campaigns:[...campaigns.values()].sort(byVolume).slice(0,30),
    campaignsOmitted:Math.max(0,campaigns.size-30)};
}
