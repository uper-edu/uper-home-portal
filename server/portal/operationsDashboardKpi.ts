import {dashboardDate,type DashboardKpiPlan,type DashboardKpiTarget} from '../../src/utils/crmOperationsDashboard.ts';
import type {trafficEnvironment} from './operationsDashboardTraffic.ts';

const record=(value:unknown):Record<string,unknown>=>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const cumulativeKeys=['first','paid','net'] as const;
type CumulativeKey=typeof cumulativeKeys[number];
type Environment=ReturnType<typeof trafficEnvironment>;
type PlanClient={query:(sql:string,args:unknown[])=>Promise<{rows:{value:unknown}[]}>};
const settingsKey=(environment:Environment,month:string)=>'dashboard_monthly_kpi_v1:'+environment+':'+month;

function monthDate(date:string,month:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date.startsWith(month+'-')&&
    Number.isFinite(Date.parse(date+'T00:00:00+07:00'))&&dashboardDate(Date.parse(date+'T00:00:00+07:00'))===date;
}

export function parseDashboardKpiImport(input:unknown,environment:Environment,now=Date.now()){
  const value=record(input),month=value.month,approvedAt=value.approvedAt;
  if(value.version!==1||value.environment!==environment)throw Error('Use KPI plan version 1 for the selected environment');
  if(typeof month!=='string'||!monthDate(month+'-01',month))throw Error('Use a valid WIB month in YYYY-MM format');
  if(typeof approvedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approvedAt)||
    !Number.isFinite(Date.parse(approvedAt))||Date.parse(approvedAt)>now||new Date(approvedAt).toISOString()!==approvedAt)
    throw Error('Provide the approved revision time as an ISO UTC timestamp');
  const targets=record(value.targets);
  const validTargets:Partial<Record<CumulativeKey|'paymentRate',number>>={};
  for(const [key,amount] of Object.entries(targets).sort(([a],[b])=>a.localeCompare(b))){
    if(key==='paymentRate'){
      if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1)throw Error('Payment rate target must be between 0 and 1');
      validTargets.paymentRate=amount;
    }else{
      if(!cumulativeKeys.includes(key as CumulativeKey)||!count(amount)||amount===0)throw Error('Invalid cumulative KPI target');
      validTargets[key as CumulativeKey]=amount;
    }
  }
  if(!Object.keys(validTargets).length)throw Error('Provide at least one approved monthly target');
  const milestones:Record<string,Partial<Record<CumulativeKey,number>>>={};
  if(value.milestones!==undefined&&(value.milestones===null||typeof value.milestones!=='object'||Array.isArray(value.milestones)))
    throw Error('Cumulative milestones must be keyed by date');
  for(const date of Object.keys(record(value.milestones)).sort()){
    if(!monthDate(date,month))throw Error('Milestone dates must be in the selected WIB month');
    const entries=Object.entries(record(record(value.milestones)[date])).sort(([a],[b])=>a.localeCompare(b));
    if(!entries.length)throw Error('Provide a cumulative milestone value');
    milestones[date]={};
    for(const [key,amount] of entries){
      if(!cumulativeKeys.includes(key as CumulativeKey)||validTargets[key as CumulativeKey]===undefined||!count(amount))
        throw Error('Milestones need a monthly target and a valid cumulative value');
      milestones[date][key as CumulativeKey]=amount;
    }
  }
  return {version:1,environment,month,approvedAt,targets:validTargets,milestones};
}

export async function storeDashboardKpiPlan(db:PlanClient,plan:ReturnType<typeof parseDashboardKpiImport>){
  const key=settingsKey(plan.environment,plan.month);
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE id=id',[key,plan]);
  const {rows:[row]}=await db.query('SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE',[key]);
  const approvedAt=record(row.value).approvedAt;
  if(typeof approvedAt==='string'&&approvedAt>=plan.approvedAt){
    if(approvedAt===plan.approvedAt&&JSON.stringify(parseDashboardKpiImport(row.value,plan.environment))===JSON.stringify(plan))return;
    throw Error('An equal or newer KPI plan revision already exists');
  }
  await db.query('UPDATE portal_settings SET value=:p2 WHERE id=:p1',[key,plan]);
}

export function dashboardKpiPlan(input:unknown,asOf:string,finance:boolean):DashboardKpiPlan{
  const value=record(input),targets=record(value.targets),milestones=record(value.milestones);
  const month=asOf.slice(0,7);
  const dates=Object.keys(milestones).filter(date=>{
    return date<=asOf&&monthDate(date,month);
  }).sort().reverse();
  function cumulative(key:CumulativeKey):DashboardKpiTarget|undefined{
    const target=targets[key];
    if(!count(target)||target===0)return;
    for(const date of dates){
      const planned=record(milestones[date])[key];
      if(count(planned))return {target,planned:{date,value:planned}};
    }
    return {target};
  }
  const rate=targets.paymentRate;
  return {first:cumulative('first'),paid:cumulative('paid'),net:finance?cumulative('net'):undefined,
    paymentRate:typeof rate==='number'&&rate>=0&&rate<=1?rate:undefined};
}

export async function readDashboardKpiPlan(client:PlanClient,environment:Environment,now:number,finance:boolean){
  const today=dashboardDate(now);
  const {rows:[row]}=await client.query('SELECT value FROM portal_settings WHERE id=:p1',
    [settingsKey(environment,today.slice(0,7))]);
  return dashboardKpiPlan(row?.value,today,finance);
}
