import analytics from '../../src/data/analyticsEnvironments.json';
import type {DashboardDevice,DashboardLandingCounts,DashboardLandingPage,DashboardTraffic,DashboardTrafficChannel,DashboardTrafficDevice}
  from '../../src/utils/crmOperationsDashboard.ts';
import {dashboardReportingDates} from '../../src/utils/crmOperationsDashboard.ts';

type Environment=keyof typeof analytics.environments;
type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type ReportRow={dimensionValues:{value:string}[];metricValues:{value:string}[]};
type Report={
  dimensionHeaders?:{name:string}[];
  metricHeaders?:{name:string}[];
  rows?:ReportRow[];
  rowCount?:number;
  metadata?:{
    timeZone?:string;subjectToThresholding?:boolean;dataLossFromOtherRow?:boolean;
    samplingMetadatas?:unknown[];dataTruncationReasons?:unknown[];emptyReason?:string;
  };
};
type DayTraffic={
  date:string;fetchedAt:string;sessions:number;
  homepageClassified?:true;
  segments:{source:string;medium:string;landing:DashboardLandingPage;sessions:number}[];
  devices?:{device:DashboardDevice;landing:DashboardLandingPage;sessions:number}[];
};

export const trafficEnvironment=(value:string|undefined):Environment=>{
  if(value==='dev'||value==='test'||value==='prod')return value;
  throw Error('Select dev, test or prod explicitly');
};
const property=(environment:Environment)=>analytics.environments[environment];
const dayKey=(environment:Environment,date:string)=>`ga_traffic_v1:${environment}:${date}`;
const field=(fieldName:string,value:string)=>({filter:{fieldName,stringFilter:{matchType:'EXACT',value,caseSensitive:true}}});
const blankLandings=():DashboardLandingCounts=>({enrollment:0,chat:0,link:0,homepage:0,other:0,unknown:0});
const maxRows=10_000;

function landingGroup(value:string):DashboardLandingPage{
  if(value==='/')return 'homepage';
  const path=value.replace(/\/$/,'');
  if(path==='/enrollment'||path==='/chat'||path==='/link')return path.slice(1) as DashboardLandingPage;
  return value===''||value==='(not set)'?'unknown':'other';
}
function deviceGroup(value:string):DashboardDevice{
  if(value==='mobile'||value==='desktop'||value==='tablet')return value;
  return !value||value==='(not set)'?'unknown':'other';
}
function sourceLabel(value:string){
  if(['(direct)','(none)','(not set)','(other)'].includes(value))return value;
  const label=value.toLowerCase();
  return /^[a-z][a-z0-9_.-]{0,62}$/.test(label)&&!/[0-9]{7}/.test(label)?label:'(not set)';
}

function reportRows(report:Report,names:string[]){
  const meta=report.metadata;
  if(meta?.timeZone!=='Asia/Jakarta')throw Error('GA4 reporting time zone must match Asia/Jakarta');
  if(meta.subjectToThresholding||meta.dataLossFromOtherRow||meta.samplingMetadatas?.length||meta.dataTruncationReasons?.length)
    throw Error('GA4 marked the report as incomplete');
  if(report.metricHeaders?.length!==1||report.metricHeaders[0].name!=='sessions'||
    report.dimensionHeaders?.map(header=>header.name).join(',')!==names.join(','))
    throw Error('Unexpected GA4 report headers');
  const rows=report.rows??[];
  if(meta.emptyReason||(report.rowCount??0)!==rows.length||rows.length>maxRows)
    throw Error('GA4 did not return every report row');
  return rows.map(row=>{
    const values=row.dimensionValues?.map(value=>value.value);
    const raw=row.metricValues?.[0]?.value;
    const sessions=Number(raw);
    if(values?.length!==names.length||values.some(value=>typeof value!=='string')||
      row.metricValues?.length!==1||typeof raw!=='string'||!/^\d+$/.test(raw)||!Number.isSafeInteger(sessions))
      throw Error('Unexpected GA4 report row');
    return {values,sessions};
  });
}

export async function fetchGaTraffic(environment:Environment,from:string,to:string,token:string,now=Date.now(),request=fetch){
  const dates=dashboardReportingDates(from,to,now);
  const fetchedAt=new Date(now).toISOString();
  const {propertyId,streamId}=property(environment);
  const responseFor=async(dimensions:string[])=>{
    const response=await request(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(30_000),
      headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({
        dimensions:dimensions.map(name=>({name})),metrics:[{name:'sessions'}],
        dateRanges:[{startDate:from,endDate:to}],limit:String(maxRows+1),
        dimensionFilter:{andGroup:{expressions:[
          field('streamId',streamId),field('eventName','page_view'),
          field('customEvent:traffic_category',environment==='prod'?'customer':'internal_test'),
          field('customEvent:environment',environment==='prod'?'production':environment==='dev'?'development':'test'),
          {notExpression:field('customEvent:validation_mode','simulated')},
        ]}},
      }),
    });
    if(!response.ok)throw Error('GA4 reporting request failed with status '+response.status);
    return reportRows(await response.json() as Report,dimensions);
  };
  const [daily,detail,deviceDetail]=await Promise.all([
    responseFor(['date']),
    responseFor(['date','sessionSource','sessionMedium','landingPage']),
    responseFor(['date','deviceCategory','landingPage']),
  ]);
  const reports=new Map(dates.map(date=>[date,{date,fetchedAt,sessions:0,homepageClassified:true,segments:[],devices:[]} as Required<DayTraffic>]));
  const readDate=(raw:string)=>{
    const day=/^\d{8}$/.test(raw)&&reports.get(raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6));
    if(!day)throw Error('GA4 returned a date outside the requested range');
    return day;
  };
  const totalDays=new Set<string>();
  for(const {values:[raw],sessions} of daily){
    const day=readDate(raw);
    if(totalDays.has(day.date))throw Error('GA4 returned duplicate daily totals');
    totalDays.add(day.date);
    day.sessions=sessions;
  }
  const breakdown=new Map<string,DayTraffic['segments'][number]>();
  for(const {values:[raw,source,medium,page],sessions} of detail){
    const day=readDate(raw);
    if(!sessions)continue;
    const row={source:sourceLabel(source),medium:sourceLabel(medium),landing:landingGroup(page),sessions:0};
    const key=JSON.stringify([day.date,row.source,row.medium,row.landing]);
    if(!breakdown.has(key)){breakdown.set(key,row);day.segments.push(row);}
    breakdown.get(key)!.sessions+=sessions;
  }
  for(const {values:[raw,device,page],sessions} of deviceDetail){
    const day=readDate(raw);
    if(sessions)day.devices.push({device:deviceGroup(device),landing:landingGroup(page),sessions});
  }
  for(const day of reports.values()){
    if(day.segments.reduce((sum,row)=>sum+row.sessions,0)!==day.sessions)
      throw Error('GA4 source and landing rows do not reconcile with daily sessions');
    const landingTotals=(rows:{landing:DashboardLandingPage;sessions:number}[])=>rows.reduce((counts,row)=>{
      counts[row.landing]+=row.sessions;
      return counts;
    },blankLandings());
    const bySource=landingTotals(day.segments),byDevice=landingTotals(day.devices);
    if((Object.keys(bySource) as DashboardLandingPage[]).some(landing=>bySource[landing]!==byDevice[landing]))
      throw Error('GA4 device and source reports disagree on daily landing sessions');
  }
  return [...reports.values()];
}

export async function storeGaTraffic(db:Client,environment:Environment,reports:DayTraffic[]){
  for(const report of reports){
    // A report started before the saved one may finish later. Timestamp order protects refreshes.
    await db.query(`INSERT INTO portal_settings(id,value) VALUES(:p1,:p2)
      ON DUPLICATE KEY UPDATE value=IF(value->>'$.fetchedAt'<:p3,:p2,value)`,
    [dayKey(environment,report.date),report,report.fetchedAt]);
  }
}

export async function readGaTraffic(db:Client,environment:Environment,from:string,to:string,now=Date.now()):Promise<DashboardTraffic|null>{
  if(from>to)return null;
  const dates=dashboardReportingDates(from,to,now);
  const {rows}=await db.query('SELECT value FROM portal_settings WHERE id BETWEEN :p1 AND :p2',
    [dayKey(environment,from),dayKey(environment,to)]);
  const days=rows.map(row=>row.value as DayTraffic);
  if(!days.length)return null;
  const landings=blankLandings();
  const groups=new Map<string,DashboardTrafficChannel>();
  const byDevice=new Map<DashboardDevice,DashboardTrafficDevice>();
  let deviceDays=0,homepageDays=0,deviceHomepageDays=0;
  let sessions=0,fetchedAt=days[0].fetchedAt;
  for(const day of days){
    if(day.homepageClassified)homepageDays++;
    sessions+=day.sessions;
    if(day.fetchedAt<fetchedAt)fetchedAt=day.fetchedAt;
    for(const segment of day.segments){
      const key=JSON.stringify([segment.source,segment.medium]);
      const group=groups.get(key)??{source:segment.source,medium:segment.medium,sessions:0,landings:blankLandings()};
      group.sessions+=segment.sessions;
      group.landings[segment.landing]+=segment.sessions;
      landings[segment.landing]+=segment.sessions;
      groups.set(key,group);
    }
    if(day.devices){
      deviceDays++;
      if(day.homepageClassified)deviceHomepageDays++;
      for(const segment of day.devices){
        const group=byDevice.get(segment.device)??{device:segment.device,sessions:0,landings:blankLandings()};
        group.sessions+=segment.sessions;
        group.landings[segment.landing]+=segment.sessions;
        byDevice.set(segment.device,group);
      }
    }
  }
  const sorted=[...groups.values()].sort((left,right)=>right.sessions-left.sessions||
    left.source.localeCompare(right.source)||left.medium.localeCompare(right.medium));
  const otherChannels=sorted.length>12?{source:'',medium:'',sessions:0,landings:blankLandings()}:null;
  if(otherChannels)for(const row of sorted.slice(12)){
    otherChannels.sessions+=row.sessions;
    for(const page of Object.keys(row.landings) as DashboardLandingPage[])otherChannels.landings[page]+=row.landings[page];
  }
  const devices=deviceDays?{coveredDays:deviceDays,homepageCoveredDays:deviceHomepageDays,
    rows:[...byDevice.values()].sort((a,b)=>b.sessions-a.sessions||a.device.localeCompare(b.device))}:undefined;
  return {from,to,coveredDays:days.length,homepageCoveredDays:homepageDays,expectedDays:dates.length,fetchedAt,sessions,
    landings,channels:sorted.slice(0,12),otherChannels,devices};
}
