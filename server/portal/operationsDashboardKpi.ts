import {createHash,randomUUID} from 'node:crypto';
import {dashboardDate,dashboardKpiCumulativeKeys,dashboardKpiKeys,dashboardKpiShiftMonth,type DashboardKpiEditorPlan,
  type DashboardKpiCumulativeKey,type DashboardKpiValues,type DashboardKpiPlan,type DashboardKpiTarget,type DashboardKpiList} from '../../src/utils/crmOperationsDashboard.ts';
import type {trafficEnvironment} from './operationsDashboardTraffic.ts';

const record=(value:unknown):Record<string,unknown>=>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const cumulativeKeys=dashboardKpiCumulativeKeys;
type CumulativeKey=DashboardKpiCumulativeKey;
type Environment=ReturnType<typeof trafficEnvironment>;
type PlanClient={query:(sql:string,args:unknown[])=>Promise<{rows:{id?:string;value:unknown}[]}>};
type PlanEditor={id:string;displayName?:string;finance:boolean};
const settingsKey=(environment:Environment,month:string)=>'dashboard_monthly_kpi_v1:'+environment+':'+month;
const kpiError=(code:string,status=400):never=>{throw Object.assign(Error('dashboard_kpi_'+code),{status});};

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
  const targets=parseTargets(record(value.targets));
  if(!Object.keys(targets).length)throw Error('Provide at least one approved monthly target');
  const milestones:Record<string,Partial<Record<CumulativeKey,number>>>={};
  if(value.milestones!==undefined&&(value.milestones===null||typeof value.milestones!=='object'||Array.isArray(value.milestones)))
    throw Error('Cumulative milestones must be keyed by date');
  for(const date of Object.keys(record(value.milestones)).sort()){
    if(!monthDate(date,month))throw Error('Milestone dates must be in the selected WIB month');
    const entries=Object.entries(record(record(value.milestones)[date])).sort(([a],[b])=>a.localeCompare(b));
    if(!entries.length)throw Error('Provide a cumulative milestone value');
    milestones[date]={};
    for(const [key,amount] of entries){
      if(!cumulativeKeys.includes(key as CumulativeKey)||targets[key as CumulativeKey]===undefined||!count(amount))
        throw Error('Milestones need a monthly target and a valid cumulative value');
      milestones[date][key as CumulativeKey]=amount;
    }
  }
  return {version:1,environment,month,approvedAt,targets,milestones};
}

function parseTargets(input:Record<string,unknown>):DashboardKpiValues['targets']{
  const targets:DashboardKpiValues['targets']={};
  for(const [key,amount] of Object.entries(input).sort(([a],[b])=>a.localeCompare(b))){
    if(key==='paymentRate'){
      if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1)throw Error('Payment rate target must be between 0 and 1');
      targets.paymentRate=amount;
    }else{
      if(!cumulativeKeys.includes(key as CumulativeKey)||!count(amount)||amount===0)throw Error('Invalid cumulative KPI target');
      targets[key as CumulativeKey]=amount;
    }
  }
  return targets;
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

function validatedMonth(month:string,now:number){
  const current=dashboardDate(now).slice(0,7);
  if(!monthDate(month+'-01',month)||month>dashboardKpiShiftMonth(current,1))kpiError('month');
  return current;
}

function projectedTargets(rawTargets:Record<string,unknown>,finance:boolean){
  const targets:DashboardKpiValues['targets']={};
  for(const key of dashboardKpiKeys){
    const amount=rawTargets[key];
    if(key==='net'&&!finance)continue;
    if(typeof amount==='number'&&Number.isFinite(amount))targets[key]=amount;
  }
  return targets;
}
function planMetadata(value:Record<string,unknown>){
  return {updatedAt:typeof value.approvedAt==='string'?value.approvedAt:null,
    updatedBy:typeof value.updatedBy==='string'?value.updatedBy:null};
}

function editorPlan(input:unknown,month:string,currentMonth:string,finance:boolean):DashboardKpiEditorPlan{
  const value=record(input);
  const revision=typeof value.revision==='string'?value.revision:
    Object.keys(value).length?createHash('sha256').update(JSON.stringify(value)).digest('hex'):null;
  return {targets:projectedTargets(record(value.targets),finance),...planMetadata(value),
    month,currentMonth,finance,readOnly:month<currentMonth,revision};
}

export async function readDashboardKpiList(db:PlanClient,environment:Environment,finance:boolean,now:number):Promise<DashboardKpiList>{
  const currentMonth=dashboardDate(now).slice(0,7),next=dashboardKpiShiftMonth(currentMonth,1);
  const prefix=settingsKey(environment,'');
  const {rows}=await db.query('SELECT id,value FROM portal_settings WHERE id BETWEEN :p1 AND :p2 ORDER BY id DESC',
    [prefix+'0001-01',prefix+next]);
  const plans:DashboardKpiList['plans']=[];
  for(const row of rows){
    if(!row.id?.startsWith(prefix))continue;
    const month=row.id.slice(prefix.length),value=record(row.value);
    if(!monthDate(month+'-01',month)||month>next||!Object.keys(value).length)continue;
    plans.push({month,targets:projectedTargets(record(value.targets),finance),...planMetadata(value)});
  }
  return {currentMonth,finance,plans};
}

export async function readDashboardKpiEditorPlan(db:PlanClient,environment:Environment,month:string,finance:boolean,now:number){
  const currentMonth=validatedMonth(month,now);
  const {rows:[row]}=await db.query('SELECT value FROM portal_settings WHERE id=:p1',[settingsKey(environment,month)]);
  return editorPlan(row?.value,month,currentMonth,finance);
}

export async function saveDashboardKpiEditorPlan(db:PlanClient,environment:Environment,month:string,input:unknown,actor:PlanEditor,clock=Date.now){
  if(month<validatedMonth(month,clock()))kpiError('readonly',403);
  const body=record(input),targets=record(body.targets);
  if(!Object.hasOwn(body,'revision')||(body.revision!==null&&(typeof body.revision!=='string'||body.revision.length>64))||
    body.targets!==targets||Object.keys(body).some(key=>key!=='revision'&&key!=='targets'))kpiError('invalid');
  if(!actor.finance&&Object.hasOwn(targets,'net'))kpiError('forbidden',403);
  const incoming=(()=>{
    try{return parseTargets(targets);}
    catch{return kpiError('invalid');}
  })();

  const key=settingsKey(environment,month);
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE id=id',[key,{}]);
  const {rows:[row]}=await db.query('SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE',[key]);
  const now=clock(),currentMonth=validatedMonth(month,now);
  if(month<currentMonth)kpiError('readonly',403);
  const prior=editorPlan(row.value,month,currentMonth,actor.finance);
  const projected=projectedTargets(incoming,actor.finance);
  if(!prior.revision&&!Object.keys(projected).length)kpiError('invalid');
  if(JSON.stringify(projected)===JSON.stringify(prior.targets))return prior;
  if(body.revision!==prior.revision)kpiError('conflict',409);
  const existing=record(row.value);
  if(!actor.finance){
    const net=projectedTargets(record(existing.targets),true).net;
    if(net!==undefined)projected.net=net;
  }
  const revision=randomUUID();
  const next={...existing,targets:projected,version:1,environment,month,revision,
    approvedAt:new Date(now).toISOString(),updatedBy:actor.displayName||actor.id};
  await db.query('UPDATE portal_settings SET value=:p2 WHERE id=:p1',[key,next]);
  const historyKey='dashboard_monthly_kpi_revision_v1:'+environment+':'+month+':'+revision;
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2)',
    [historyKey,{actor:actor.id,before:row.value,after:next}]);
  await db.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',
    [actor.id,'dashboard.kpi.save',{month,revision}]);
  return editorPlan(next,month,currentMonth,actor.finance);
}

export function dashboardKpiPlan(input:unknown,finance:boolean):DashboardKpiPlan{
  const targets=record(record(input).targets);
  function cumulative(key:CumulativeKey):DashboardKpiTarget|undefined{
    const target=targets[key];
    if(count(target)&&target>0)return {target};
  }
  const rate=targets.paymentRate;
  return {first:cumulative('first'),paid:cumulative('paid'),net:finance?cumulative('net'):undefined,
    paymentRate:typeof rate==='number'&&rate>=0&&rate<=1?rate:undefined};
}

export async function readDashboardKpiPlan(client:PlanClient,environment:Environment,now:number,finance:boolean){
  const today=dashboardDate(now);
  const {rows:[row]}=await client.query('SELECT value FROM portal_settings WHERE id=:p1',
    [settingsKey(environment,today.slice(0,7))]);
  return dashboardKpiPlan(row?.value,finance);
}
