import test from 'node:test';import assert from 'node:assert/strict';
import {defaultCrmModule} from '../src/utils/crmLanding';
const employee=(permissions:string[],roles=['custom'])=>({id:'synthetic',active:true,permissions,roles,teams:[],grants:{}});
test('finance-only CRM duties land on payment verification using actual capabilities, including custom roles',()=>{
 for(const roles of [['finance'],['renamed-finance']])assert.equal(defaultCrmModule(employee(['crm.read','crm.payments.verify'],roles)),'payments');
 assert.equal(defaultCrmModule(employee(['crm.read','crm.payments.verify','cms.manage','access.read'])),'payments');
});
test('sales/manager duties retain the sales landing and role names cannot grant financial landing',()=>{
 for(const additional of ['crm.followup','crm.assign','crm.operations.manage','notifications.manage','notifications.read'])assert.equal(defaultCrmModule(employee(['crm.read','crm.payments.verify',additional])),'leads');
 assert.equal(defaultCrmModule(employee(['crm.read'],['finance'])),'leads');assert.equal(defaultCrmModule(employee(['crm.payments.verify'])),'leads');assert.equal(defaultCrmModule({...employee(['crm.read','crm.payments.verify']),active:false}),'leads');
});
