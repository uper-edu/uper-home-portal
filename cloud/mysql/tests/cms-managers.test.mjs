import test from 'node:test';
import assert from 'node:assert/strict';
function client() {
 const base='http://127.0.0.1:4412',cookies=new Map();
 return async(path,body) => {
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:[...cookies].map(([key,value])=>key+'='+value).join(';')},body:body===undefined?undefined:JSON.stringify(body)});
  for(const header of response.headers.getSetCookie()){const [key,value]=header.split(';')[0].split('=');cookies.set(key,value);}
  return {status:response.status,json:await response.json()};
 };
}
test('Ethan and Monite have CMS Operator and CRM Manager access without Sales assignment eligibility',{skip:!process.env.MYSQL_ACCOUNT_ADDITIONS_TEST},async()=>{
 assert.equal(process.env.TRIAL_DATASET,'synthetic');
 for(const name of ['Ethan','Monite']) {
  const call=client(),login=await call('/api/crm/auth/login',{loginId:name.toLowerCase(),password:name});
  assert.equal(login.status,200);assert.deepEqual(login.json.employee.roles,['crm_leader','cms_admin']);assert.equal(login.json.employee.scope,'all');
  for(const permission of ['cms.manage','crm.read','crm.assign','crm.export','notifications.manage'])assert.ok(login.json.employee.permissions.includes(permission));
  assert.equal(login.json.employee.roles.includes('sales'),false);
  assert.equal((await call('/api/cms/content/news')).status,200);
  const customers=await call('/api/crm/leads');assert.equal(customers.status,200);assert.equal(customers.json.dataScope,'all');
  assert.equal((await call('/api/crm/notification-rules')).status,200);
  const directory=await call('/api/portal/employees');assert.equal(directory.status,200);
  for(const id of ['Ethan','Monite'])assert.ok(directory.json.some(user=>user.id===id&&user.roles.includes('cms_admin')&&user.roles.includes('crm_leader')));
  assert.ok(!JSON.stringify(directory.json).includes('password'));
  assert.equal((await call('/api/crm/auth/logout',{})).status,200);
  assert.equal((await call('/api/crm/leads')).status,401);
 }
});
