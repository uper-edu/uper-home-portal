import {test} from 'node:test';import assert from 'node:assert/strict';import {platform,allowed} from '../server/portal/identity';
test('platform adapter fails closed; browser headers cannot choose employee or permissions',async()=>{
 const saved={mode:process.env.PLATFORM_MODE,id:process.env.MOCK_EMPLOYEE_ID};const request=(host='localhost:3000',headers:any={})=>({headers:{host,...headers},socket:{remoteAddress:'127.0.0.1'}} as any);
 try{
  delete process.env.PLATFORM_MODE;assert.equal(await platform.authenticate(request()),null);
  process.env.PLATFORM_MODE='real';assert.equal(await platform.authenticate(request()),null);
  process.env.PLATFORM_MODE='mock';process.env.MOCK_EMPLOYEE_ID='test-sales';const employee=await platform.authenticate(request('localhost:3000',{'x-employee-id':'test-admin','x-permissions':'notifications.manage'}));assert.equal(employee?.id,'test-sales');assert.ok(!employee?.permissions.includes('notifications.manage'));
  assert.equal(allowed(employee!,{owner:'test-sales'}),true);assert.equal(allowed(employee!,{owner:'test-admin'}),false);
  for(const headers of [{'x-forwarded-for':'1.2.3.4'},{'x-forwarded-host':'localhost'},{'cf-connecting-ip':'1.2.3.4'}])assert.equal(await platform.authenticate(request('localhost:3000',headers)),null);
  assert.equal(await platform.authenticate(request('public.example.invalid')),null);
  process.env.MOCK_EMPLOYEE_ID='unknown';assert.equal(await platform.authenticate(request()),null);
  process.env.MOCK_EMPLOYEE_ID='test-admin';const admin=await platform.authenticate(request());assert.ok(admin?.permissions.includes('crm.assign'));assert.equal(allowed(admin!,{owner:'test-sales'}),true);
 }finally{if(saved.mode)process.env.PLATFORM_MODE=saved.mode;else delete process.env.PLATFORM_MODE;if(saved.id)process.env.MOCK_EMPLOYEE_ID=saved.id;else delete process.env.MOCK_EMPLOYEE_ID;}
});
