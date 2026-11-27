import {dashboardDate,dashboardDay} from '../../src/utils/crmOperationsDashboard.ts';
import analytics from '../../src/data/analyticsEnvironments.json';
import {parseEnrollmentFunnelReport,readEnrollmentFunnelRevisions,storeEnrollmentFunnel} from './operationsDashboardEnrollmentFunnel.ts';

const firstFullWibDate='2026-11-27';
const streamId=analytics.environments.test.streamId;
export const testFunnelProject='uper-analytics-test-'+analytics.environments.test.propertyId;
const testFunnelDataset='analytics_'+analytics.environments.test.propertyId;
const projectUrl='https://bigquery.googleapis.com/bigquery/v2/projects/'+testFunnelProject;
const location='asia-southeast1';
const maxBytes=50_000_000;

type TableRevision=(day:string)=>Promise<string|null>;
type ReadReport=(from:string,to:string)=>Promise<unknown>;
type FunnelClient=Parameters<typeof storeEnrollmentFunnel>[0];
type Store={
  db:FunnelClient;
  transaction:(work:(db:FunnelClient)=>Promise<void>)=>Promise<unknown>;
};

const nextDay=(day:string)=>new Date(Date.parse(day+'T00:00:00Z')+dashboardDay).toISOString().slice(0,10);

export async function syncTestEnrollmentFunnel(
  {db,transaction}:Store,
  {tableRevision,readReport}:{tableRevision:TableRevision;readReport:ReadReport},
  {clock=Date.now,preview=false}={},
){
  const now=clock();
  const yesterday=dashboardDate(now-dashboardDay);
  const cohorts=[4,3,2].map(days=>dashboardDate(now-days*dashboardDay)).filter(day=>day>=firstFullWibDate);
  const tableDays=[...new Set([...cohorts,...cohorts.map(nextDay),yesterday].filter(day=>day>=firstFullWibDate))].sort();
  const tables=new Map(await Promise.all(tableDays.map(async day=>[day,await tableRevision(day)] as const)));
  const available=cohorts.filter(day=>tables.get(day)&&tables.get(nextDay(day)));
  const pending=cohorts.filter(day=>!available.includes(day));
  const observed=tableDays.filter(day=>tables.get(day));
  if(!available.length)return {observed,pending,synced:[],preview};

  const versions=new Map(available.map(day=>[day,tables.get(day)+'/'+tables.get(nextDay(day))]));
  const saved=await readEnrollmentFunnelRevisions(db,'test',available[0],available.at(-1)!);
  const changed=available.filter(day=>saved.get(day)!==versions.get(day));
  if(!changed.length)return {observed,pending,synced:[],preview};

  const [from,to]=[changed[0],changed.at(-1)!];
  const expected=available.filter(day=>day>=from&&day<=to);
  const days=parseEnrollmentFunnelReport(await readReport(from,to),'test',clock());
  if(days.length!==expected.length||days.some(({date},index)=>date!==expected[index]))
    throw Error('BigQuery enrollment coverage changed during sync');

  const changedDays=days.filter(({date})=>changed.includes(date)).map(day=>({...day,sourceRevision:versions.get(day.date)!}));
  if(!preview)await transaction(c=>storeEnrollmentFunnel(c,'test',changedDays));
  return {observed,pending,synced:changed,preview};
}

type Field={name:string;type:string;mode?:string;fields?:Field[]};
type Cell={v:any};
function record(fields:Field[],row:{f:Cell[]}):Record<string,unknown>{
  return Object.fromEntries(fields.map((field,index)=>{
    const convert=(v:any):unknown=>field.type==='RECORD'&&v!==null?record(field.fields!,v):v;
    const v=row.f[index].v;
    return [field.name,field.mode==='REPEATED'?v.map((item:Cell)=>convert(item.v)):convert(v)];
  }));
}

export function testEnrollmentFunnelBigQuery(token:string,sql:string,request=fetch){
  const headers={Authorization:'Bearer '+token};
  const get=(path:string,init?:RequestInit)=>request(projectUrl+path,{
    ...init,headers:{...headers,...init?.headers},redirect:'error',signal:AbortSignal.timeout(20_000),
  });
  const checked=async(response:Response)=>{
    if(!response.ok)throw Error('BigQuery request failed (HTTP '+response.status+')');
    return response.json();
  };
  return {
    async tableRevision(day:string){
      const id='events_'+day.replaceAll('-','');
      if(!/^events_20\d{6}$/.test(id))throw Error('Invalid daily BigQuery table');
      const response=await get('/datasets/'+testFunnelDataset+'/tables/'+id+'?view=STORAGE_STATS');
      if(response.status===404)return null;
      const table=await checked(response);
      if(table.type!=='TABLE'||table.tableReference?.projectId!==testFunnelProject||
        table.tableReference?.datasetId!==testFunnelDataset||table.tableReference?.tableId!==id||
        typeof table.lastModifiedTime!=='string'||!/^\d+$/.test(table.lastModifiedTime))
        throw Error('Unexpected GA4 daily table metadata');
      return [table.lastModifiedTime,table.numRows??'',table.etag??''].join(':');
    },
    async readReport(from:string,to:string){
      const response=await get('/queries',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          query:sql.replaceAll('ANALYTICS_DATASET',testFunnelProject+'.'+testFunnelDataset),
          useLegacySql:false,location,maximumBytesBilled:String(maxBytes),timeoutMs:15_000,parameterMode:'NAMED',
          queryParameters:[
            ['from','DATE',from],['to','DATE',to],['streamId','STRING',streamId],['environment','STRING','test'],
          ].map(([name,type,value])=>({name,parameterType:{type},parameterValue:{value}})),
        }),
      });
      const report=await checked(response);
      if(!report.jobComplete||report.pageToken||report.errors?.length||!report.schema?.fields||!Array.isArray(report.rows))
        throw Error('BigQuery enrollment query did not return a complete report');
      return report.rows.map((row:{f:Cell[]})=>record(report.schema.fields,row));
    },
  };
}
