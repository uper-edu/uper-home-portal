import "./helpers/mockPortalDatabase.mjs";

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mountEnrollmentResolution} from '../server/portal/enrollmentResolution.ts';

const requestId='4b32b77e-63ca-49d8-80ec-453d805bef52';
const orderId='sample-order';
const missing=(error:any)=>error.status===404;
const forbidden=(error:any)=>error.status===403;

function fixture() {
  const routes=new Map<string,Function>();
  const reads:{sql:string;args:unknown[]}[]=[];
  let receipt:any;
  let financeAllowed=true;
  let salesOwner='Sales';
  const manager={id:'Manager',roles:['crm_leader'],permissions:['crm.read','crm.followup'],scope:'all'};
  const sales={id:'Sales',roles:['sales'],permissions:['crm.read','crm.followup'],scope:'own'};
  const finance={id:'Finance'};
  const client={query:async(sql:string,args:unknown[])=>{
    assert.match(sql,/^SELECT /);
    reads.push({sql,args});
    if(sql.includes('canonical.profile'))return {rows:[{profile:{id:'customer-1',owner:salesOwner}}]};
    return {rows:receipt&&args[0]===receipt.actor?[{result:receipt.result}]:[]};
  }};
  mountEnrollmentResolution({get:(path:string,handler:Function)=>routes.set(path,handler)} as any,{
    wrap:fn=>fn as any,post:()=>{},read:fn=>fn(client),
    financeActor:async()=>{if(!financeAllowed)throw Object.assign(Error('Denied'),{status:403});return finance;},
    supportActor:async(q:any)=>(q.query.manager?manager:sales) as any,
  } as Parameters<typeof mountEnrollmentResolution>[1]);
  return {
    reads,setReceipt:(actor:string,result:any)=>{receipt={actor,result};},
    setFinanceAllowed:(value:boolean)=>{financeAllowed=value;},
    setSalesOwner:(value:string)=>{salesOwner=value;},
    async read(scope:'aftercare'|'finance',operation:string,id=orderId,isManager=false) {
      let response:any;
      const handler=routes.get('/api/crm/enrollment/'+scope+'/:id/results/:operation/:requestId');
      assert.ok(handler);
      const res={set(name:string,value:string){assert.equal(name,'Cache-Control');assert.equal(value,'no-store');return this;},
        json(data:any){response=data;}};
      await handler({params:{id,operation,requestId},query:{manager:isManager}},res);
      return response;
    },
  };
}

test('finance result checks permission, order and exact command and returns only a receipt',async()=>{
  const f=fixture();
  const operations=[['receipts','enrollment.receipt'],['refunds','enrollment.refund.payment'],['refund-returns','enrollment.refund.return']];
  for(const [operation,kind] of operations){
    f.setReceipt('Finance',{operationKind:kind,leadId:'enrollment:'+orderId,bankReference:'not returned'});
    assert.deepEqual(await f.read('finance',operation),{operationKind:kind,orderId,requestId});
    assert.deepEqual(f.reads.at(-1)?.args,['Finance',requestId]);
    await assert.rejects(f.read('finance',operation,'another-order'),missing);
  }
  await assert.rejects(f.read('finance','receipts'),missing);
  f.setFinanceAllowed(false);
  await assert.rejects(f.read('finance','refund-returns'),forbidden);
});

test('aftercare result checks current ownership, manager role, and original actor',async()=>{
  const f=fixture();
  const replyBy='2026-12-01T00:00:00Z';
  f.setReceipt('Sales',{leadId:'enrollment:'+orderId,operationKind:'enrollment.transfer.invite',replyBy});
  assert.deepEqual(await f.read('aftercare','invitations'),{orderId,requestId,operationKind:'enrollment.transfer.invite',replyBy});
  await assert.rejects(f.read('aftercare','invitations',orderId,true),missing);
  f.setSalesOwner('Other');
  await assert.rejects(f.read('aftercare','invitations'),forbidden);
  f.setReceipt('Manager',{leadId:'enrollment:'+orderId,operationKind:'enrollment.refund.intake',expected:50000});
  await assert.rejects(f.read('aftercare','refund'),forbidden);
  assert.deepEqual(await f.read('aftercare','refund',orderId,true),{orderId,requestId,operationKind:'enrollment.refund.intake'});
});
