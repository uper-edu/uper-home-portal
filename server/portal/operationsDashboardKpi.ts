import {dashboardDate,type DashboardKpiPlan,type DashboardKpiTarget} from '../../src/utils/crmOperationsDashboard.ts';
import type {trafficEnvironment} from './operationsDashboardTraffic.ts';

const record=(value:unknown):Record<string,unknown>=>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;

export function dashboardKpiPlan(input:unknown,asOf:string,finance:boolean):DashboardKpiPlan{
  const value=record(input),targets=record(value.targets),milestones=record(value.milestones);
  const month=asOf.slice(0,7);
  const dates=Object.keys(milestones).filter(date=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!date.startsWith(month+'-')||date>asOf)return false;
    const time=Date.parse(date+'T00:00:00+07:00');
    return Number.isFinite(time)&&dashboardDate(time)===date;
  }).sort().reverse();
  function cumulative(key:'first'|'paid'|'net'):DashboardKpiTarget|undefined{
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

export async function readDashboardKpiPlan(client:{query:(sql:string,args:unknown[])=>Promise<{rows:{value:unknown}[]}>},
  environment:ReturnType<typeof trafficEnvironment>,now:number,finance:boolean){
  const today=dashboardDate(now);
  const {rows:[row]}=await client.query('SELECT value FROM portal_settings WHERE id=:p1',
    ['dashboard_monthly_kpi_v1:'+environment+':'+today.slice(0,7)]);
  return dashboardKpiPlan(row?.value,today,finance);
}
