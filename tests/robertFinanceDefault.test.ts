import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from '../src/data/system-defaults/index.ts';
import {builtInRoles,projectEmployee} from '../src/utils/accessControl';
import {canVerifyPayments} from '../src/utils/crmPaymentWorklist';
test('Suki and Robert receive the explicit financial role in initial account defaults without expanding the manager template',()=>{
 const accountSeeds=access.accounts as [string,string[]][];
 const roles=Object.entries(builtInRoles).map(([id,config])=>({id,config,enabled:true}));
 const robert=accountSeeds.find(([id])=>id==='Robert')!;
 assert.deepEqual(robert[1],['crm_leader','cms_admin','finance']);
 assert.deepEqual(accountSeeds.filter(([,ids])=>(ids as readonly string[]).includes('finance')).map(([id])=>id),['Suki','Robert']);
 const account=projectEmployee({id:'Robert',roles:robert[1],teams:[],display_name:'Robert Hui',active:true},roles);
 assert.equal(canVerifyPayments(account),true);
 assert.ok(account.permissions.includes('crm.assign'));
 assert.ok(account.permissions.includes('cms.manage'));
 assert.ok(!builtInRoles.crm_leader.grants['crm.payments.verify']);
 assert.deepEqual(Object.keys(builtInRoles.finance.grants).sort(),['crm.payments.verify','crm.read']);
});
