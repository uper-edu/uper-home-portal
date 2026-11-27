import './helpers/mockPortalDatabase.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {builtInRoles,canManageEnrollmentFinance,projectEmployee} from '../src/utils/accessControl';
import {availableWorkspaces} from '../src/utils/adminWorkspace';
import {enrollmentPaymentPath,financeView,legacyPaymentLocation} from '../src/utils/financeNavigation';
import {resolveMetadata} from '../src/utils/siteMetadata';
import {mountEnrollmentApplication} from '../server/portal/enrollmentApplication';

const roles=Object.entries(builtInRoles).map(([id,config])=>({id,config,enabled:true}));
const employee=(role:string)=>projectEmployee({id:'mock-staff',roles:[role],teams:[],active:true},roles);
const bankEndpoint='/api/crm/enrollment/bank';

test('finance workspace and enrollment bank permissions follow effective grants',()=>{
  const finance=employee('finance');
  assert.ok(availableWorkspaces(finance).includes('finance'));
  assert.equal(canManageEnrollmentFinance({...finance,roles:['renamed-finance']}),true);
  const scoped:typeof finance={...finance,grants:{...finance.grants,'crm.payments.verify':['own']}};
  assert.equal(canManageEnrollmentFinance(scoped),false);
  assert.ok(availableWorkspaces(scoped).includes('finance'));
  for(const role of ['crm_leader','sales','academic_admin','access_admin']){
    assert.equal(availableWorkspaces(employee(role)).includes('finance'),false,role);
    assert.equal(canManageEnrollmentFinance(employee(role)),false,role);
  }
  assert.equal(canManageEnrollmentFinance({...finance,active:false}),false);
});

test('every bank configuration endpoint requires full finance grants before using the database',async()=>{
  const handlers=new Map<string,(req:unknown,res:unknown)=>Promise<unknown>>();
  let actor=employee('crm_leader');
  const app=Object.fromEntries(['get','post','put','delete','patch'].map(method=>[method,(path:string,handler:(req:unknown,res:unknown)=>Promise<unknown>)=>handlers.set(method+' '+path,handler)]));
  mountEnrollmentApplication(app as never,{
    wrap:handler=>handler,
    staff:async(_req,permission)=>{
      assert.equal(permission,'crm.payments.verify');
      if(!actor.permissions.includes(permission))throw Object.assign(Error('Permission denied'),{status:403});
      return actor;
    },
    visitor:async()=>{throw Error('Unexpected visitor access');},
  });
  const req={headers:{host:'localhost:3000',origin:'http://localhost:3000'},protocol:'http',get:()=> 'localhost:3000',is:()=>true};
  for(const projected of [employee('crm_leader'),employee('sales'),employee('academic_admin'),{
    ...employee('finance'),grants:{'crm.read':['all'],'crm.payments.verify':['own']} as typeof actor.grants,
  }]){
    actor=projected;
    for(const key of ['get '+bankEndpoint,'post '+bankEndpoint,'get '+bankEndpoint+'/results/:requestId']){
      const handler=handlers.get(key);
      assert.ok(handler,key);
      await assert.rejects(handler(req,{}),{status:403,message:actor.permissions.includes('crm.payments.verify')?'enrollment_finance_forbidden':'Permission denied'},key);
    }
  }
  actor=employee('finance');
  const edit=handlers.get('post '+bankEndpoint);
  assert.ok(edit);
  await assert.rejects(edit(req,{}),{message:'enrollment_bank_invalid'});
});

test('legacy payment URLs preserve order, historical filters and originating records',()=>{
  const rosterReturn='/crm?tab=enrollment-management&classId=class-1';
  const path=enrollmentPaymentPath('order-1',{rosterReturn});
  const target=new URL(path,'https://example.test');
  assert.equal(target.pathname,'/finance');
  assert.equal(target.searchParams.get('rosterReturn'),rosterReturn);
  assert.equal(financeView(target.searchParams),'enrollment');
  const enrollment=new URL(legacyPaymentLocation(new URLSearchParams('tab=payments'+target.search.replace('?','&')))!,'https://example.test');
  assert.equal(financeView(enrollment.searchParams),'enrollment');
  assert.equal(enrollment.searchParams.get('enrollmentOrder'),'order-1');
  assert.equal(enrollment.searchParams.get('rosterReturn'),rosterReturn);
  const history=new URL(legacyPaymentLocation(new URLSearchParams('tab=payments&paymentLead=lead-1&paymentEntry=entry-1&paymentState=verified&lang=zh'),'#details')!,'https://example.test');
  assert.equal(financeView(history.searchParams),'historical');
  assert.equal(history.searchParams.get('paymentLead'),'lead-1');
  assert.equal(history.searchParams.get('paymentEntry'),'entry-1');
  assert.equal(history.searchParams.get('paymentState'),'verified');
  assert.equal(history.searchParams.get('lang'),'zh');
  assert.equal(history.hash,'#details');
});

test('finance is a private staff workspace with account configuration metadata',()=>{
  for(const lang of ['en','id','zh'] as const){
    const payments=resolveMetadata('/finance',lang);
    const bank=resolveMetadata('/finance',lang,{module:'enrollment-bank'});
    assert.equal(payments.indexable,false);
    assert.equal(bank.indexable,false);
    assert.notEqual(bank.title,payments.title);
  }
});
