import assert from 'node:assert/strict';
import test from 'node:test';
import {readDashboardKpiEditorPlan,readDashboardKpiList,readDashboardKpiPlan,saveDashboardKpiEditorPlan} from '../server/portal/operationsDashboardKpi.ts';
import {canManageDashboardKpi,dashboardScopes} from '../src/utils/crmOperationsDashboard.ts';

const now=Date.parse('2026-11-25T03:00:00Z');
const clock=()=>now;
const month='2026-11';
const operations={id:'ops',displayName:'Operations',finance:false};
const finance={id:'finance',displayName:'Finance',finance:true};
const storedMonth='dashboard_monthly_kpi_v1:dev:'+month;
const initial={version:1,environment:'dev',month,approvedAt:'2026-11-24T04:00:00.000Z',
  targets:{paid:40,first:25,net:5_000_000,paymentRate:.6},
  milestones:{'2026-11-05':{net:1_000_000},'2026-11-12':{net:2_000_000,paid:20}}};

function harness(seed:unknown=initial){
  const state=new Map<string,unknown>([[storedMonth,structuredClone(seed)]]);
  const audit:unknown[][]=[];
  let tail:Promise<unknown>=Promise.resolve();
  let failAudit=false;
  const db={async query(sql:string,args:unknown[]){
    const key=String(args[0]);
    if(sql.startsWith('SELECT'))return {rows:state.has(key)?[{value:structuredClone(state.get(key))}]:[]};
    if(sql.startsWith('INSERT INTO portal_settings')&&sql.includes('ON DUPLICATE')){
      if(!state.has(key))state.set(key,structuredClone(args[1]));
    }else if(sql.startsWith('UPDATE portal_settings')||sql.startsWith('INSERT INTO portal_settings')){
      state.set(key,structuredClone(args[1]));
    }else if(sql.startsWith('INSERT INTO portal_audit')){
      if(failAudit)throw Error('audit unavailable');
      audit.push(structuredClone(args));
    }else throw Error('unexpected statement '+sql);
    return {rows:[]};
  }};
  function transaction<T>(run:()=>Promise<T>){
    const operation=tail.then(async()=>{
      const before=structuredClone(state);
      try{return await run();}
      catch(error){
        state.clear();for(const [key,value] of before)state.set(key,value);
        throw error;
      }
    });
    tail=operation.catch(()=>{});
    return operation;
  }
  return {db,state,audit,transaction,failAudit:()=>{failAudit=true;}};
}

test('KPI administration requires an explicit all-CRM permission and leaves finance grants independent',()=>{
  const permission='crm.dashboard.kpi.manage';
  const editor={id:'ops',permissions:['crm.read',permission],scope:'all' as const};
  assert.equal(canManageDashboardKpi(editor),true);
  assert.equal(dashboardScopes(editor).view,true);
  assert.equal(dashboardScopes(editor).finance,false);
  assert.equal(canManageDashboardKpi({...editor,permissions:['crm.read','crm.operations.manage','crm.payments.verify']}),false);
  assert.equal(canManageDashboardKpi({...editor,grants:{'crm.read':['own'],[permission]:['all']}}),false);
});

test('KPI list returns stored periods inside the permitted environment and horizon with finance projection',async()=>{
  const old={...initial,month:'2026-10'};
  const db={async query(sql:string,args:unknown[]){
    assert.equal(sql,'SELECT id,value FROM portal_settings WHERE id BETWEEN :p1 AND :p2 ORDER BY id DESC');
    assert.deepEqual(args,['dashboard_monthly_kpi_v1:dev:0001-01','dashboard_monthly_kpi_v1:dev:2026-12']);
    const keyed=(month:string,value:unknown)=>({id:'dashboard_monthly_kpi_v1:dev:'+month,value});
    return {rows:[
      keyed('2027-01',initial),
      keyed('2026-12',{}),
      keyed('2026-11',{...initial,updatedBy:'Ops'}),
      keyed('2026-10',old),
      {id:'dashboard_monthly_kpi_v1:test:2026-11',value:initial},
      {id:'dashboard_monthly_kpi_revision_v1:dev:2026-11:one',value:initial},
    ]};
  }};
  const readable=await readDashboardKpiList(db,'dev',false,now);
  assert.deepEqual(readable.plans.map(plan=>plan.month),['2026-11','2026-10']);
  assert.equal(readable.currentMonth,'2026-11');
  assert.equal(readable.plans[0].updatedBy,'Ops');
  assert.deepEqual(readable.plans[0].targets,{paid:40,first:25,paymentRate:.6});
  assert.equal(Object.hasOwn(readable.plans[0],'milestones'),false);
  const financial=await readDashboardKpiList(db,'dev',true,now);
  assert.equal(financial.plans[0].targets.net,5_000_000);
});

test('operations can update enrollment goals while retaining finance targets and stored legacy milestones',async()=>{
  const f=harness();
  const read=await readDashboardKpiEditorPlan(f.db,'dev',month,false,now);
  assert.deepEqual(read.targets,{paid:40,first:25,paymentRate:.6});
  assert.equal(Object.hasOwn(read,'milestones'),false);
  const save=await f.transaction(()=>saveDashboardKpiEditorPlan(f.db,'dev',month,
    {revision:read.revision,targets:{paid:55,paymentRate:0}},operations,clock));
  assert.deepEqual(save.targets,{paid:55,paymentRate:0});
  assert.equal(save.updatedBy,'Operations');
  assert.equal(Object.hasOwn(save,'milestones'),false);
  const refreshed=await readDashboardKpiEditorPlan(f.db,'dev',month,true,now);
  assert.equal(refreshed.targets.net,5_000_000);
  assert.deepEqual((f.state.get(storedMonth) as typeof initial).milestones,initial.milestones);
  const [audit]=f.audit;
  assert.deepEqual(audit,['ops','dashboard.kpi.save',{month,revision:save.revision}]);
  const history=f.state.get('dashboard_monthly_kpi_revision_v1:dev:'+month+':'+save.revision);
  assert.deepEqual(history,{actor:'ops',before:initial,after:f.state.get(storedMonth)});
});

test('operations cannot submit net targets and the editor rejects legacy milestone input',async()=>{
  const f=harness();
  const {revision}=await readDashboardKpiEditorPlan(f.db,'dev',month,false,now);
  await assert.rejects(saveDashboardKpiEditorPlan(f.db,'dev',month,{revision,targets:{net:100}},operations,clock),
    {status:403,message:'dashboard_kpi_forbidden'});
  await assert.rejects(saveDashboardKpiEditorPlan(f.db,'dev',month,
    {revision,targets:{},milestones:{'2026-11-05':{net:0}}},operations,clock),{status:400,message:'dashboard_kpi_invalid'});
  assert.deepEqual(f.state.get(storedMonth),initial);
  assert.equal(f.audit.length,0);
});

test('concurrent writes to the same month have one winner and do not overwrite a subsequently published revision',async()=>{
  const f=harness();
  const {revision}=await readDashboardKpiEditorPlan(f.db,'dev',month,true,now);
  const change=(paid:number,base=revision)=>f.transaction(()=>saveDashboardKpiEditorPlan(f.db,'dev',month,
    {revision:base,targets:{...initial.targets,paid}},finance,clock));
  const [a,b]=await Promise.allSettled([change(50),change(65)]);
  assert.equal(a.status,'fulfilled');
  assert.equal(b.status,'rejected');
  if(b.status==='rejected')assert.equal(b.reason.status,409);
  const latest=await readDashboardKpiEditorPlan(f.db,'dev',month,true,now);
  assert.equal(latest.targets.paid,50);
  const retry=await change(50);
  assert.equal(retry.revision,latest.revision);
  assert.equal(f.audit.length,1);
  const reviewed=await change(65,latest.revision);
  assert.equal(reviewed.targets.paid,65);
  assert.equal(f.audit.length,2);
});

test('WIB month limits are checked before saving, and the next plan activates at local midnight',async()=>{
  const f=harness();
  const {revision}=await readDashboardKpiEditorPlan(f.db,'dev',month,true,now);
  const payload={revision,targets:{paid:60,net:4_000_000}};
  await assert.rejects(saveDashboardKpiEditorPlan(f.db,'dev','2026-10',payload,finance,clock),{status:403});
  assert.equal((await readDashboardKpiEditorPlan(f.db,'dev','2026-10',true,now)).readOnly,true);
  await assert.rejects(readDashboardKpiEditorPlan(f.db,'dev','2027-01',true,now),{status:400});
  await assert.rejects(f.transaction(()=>saveDashboardKpiEditorPlan(f.db,'dev','2026-12',
    {revision:null,targets:{}},finance,clock)),{status:400,message:'dashboard_kpi_invalid'});
  assert.equal(f.state.has('dashboard_monthly_kpi_v1:dev:2026-12'),false);
  const result=await f.transaction(()=>saveDashboardKpiEditorPlan(f.db,'dev',month,payload,finance,clock));
  assert.deepEqual(result.targets,payload.targets);
  assert.deepEqual((f.state.get(storedMonth) as typeof initial).milestones,initial.milestones);
  await f.transaction(()=>saveDashboardKpiEditorPlan(f.db,'dev','2026-12',
    {revision:null,targets:{paid:70,net:6_000_000}},finance,clock));
  const midnight=Date.parse('2026-11-30T17:00:00Z');
  const [before,after,sales]=await Promise.all([
    readDashboardKpiPlan(f.db,'dev',midnight-1,true),
    readDashboardKpiPlan(f.db,'dev',midnight,true),
    readDashboardKpiPlan(f.db,'dev',midnight,false),
  ]);
  assert.equal(before.paid?.target,60);
  assert.deepEqual(after.paid,{target:70});
  assert.equal(after.net?.target,6_000_000);
  assert.equal(sales.net,undefined);
});

test('a failed audit rolls back both the new settings and revision in the shared transaction',async()=>{
  const f=harness();
  const {revision}=await readDashboardKpiEditorPlan(f.db,'dev',month,true,now);
  f.failAudit();
  await assert.rejects(f.transaction(()=>saveDashboardKpiEditorPlan(f.db,'dev',month,
    {revision,targets:{paid:70}},finance,clock)),/audit unavailable/);
  assert.deepEqual(f.state.get(storedMonth),initial);
  assert.equal(f.state.size,1);
});
