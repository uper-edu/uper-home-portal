import test from'node:test';import assert from'node:assert/strict';import{projectEmployee}from'../src/utils/accessControl';import{campaignSaveResultHandler,ownCampaignSaveResult}from'../server/portal/campaignSaveResults';
function employee(grants:Record<string,any>,id='owner',active=true,role='custom'){
 return projectEmployee({id,roles:[role],active,display_name:id,teams:[]},[{id:role,enabled:true,config:{names:['Custom','Kustom','自定义'],description:['','',''],grants}}]);
}
const records=[{actor:'owner',requestId:'request-owner-123',data:{result:{id:'campaign-a',name:'活动A'}}},{actor:'other',requestId:'request-other-456',data:{result:{id:'campaign-b',name:'活动B'}}}];
function fixture(){const calls:any[]=[];return {calls,query:async(sql:string,params:any[])=>{calls.push({sql,params});return {rows:records.filter(r=>r.actor===params[0]&&r.requestId===params[1])};}};}
for(const [name,grants,expected] of [
 ['缺少CRM基础读取权限时沿用原模型限制',{'campaigns.manage':'all'},403],
 ['活动管理和CRM读取但无通知权限',{'campaigns.manage':'all','crm.read':'all'},200],
 ['客户读取加通知读取仍不是活动权限',{'crm.read':'all','notifications.read':'all'},403],
 ['客户读取加通知管理仍不是活动权限',{'crm.read':'all','notifications.manage':'all'},403],
 ['只有客户读取',{'crm.read':'all'},403],
 ['只有客户跟进',{'crm.followup':'own'},403],
 ['无业务权限',{},403],
] as const){test('实际路由处理函数：'+name,async()=>{const db=fixture(),e=employee({...grants});let response:any,cache='';const handler=campaignSaveResultHandler(db,async()=>e);const res={set:(_:string,value:string)=>{cache=value;return res;},json:(d:any)=>{response=d;}};if(expected===200){await handler({params:{requestId:'request-owner-123'},query:{actor:'other'},body:{actor:'other'}},res);assert.equal(response.campaign.id,'campaign-a');assert.equal(cache,'no-store');assert.deepEqual(db.calls[0].params,['owner','request-owner-123']);}else{await assert.rejects(()=>handler({params:{requestId:'request-owner-123'}},res),(x:any)=>x.status===403);assert.equal(db.calls.length,0);}});}
test('角色名称不是绕过，停用与移除活动权限及时生效',async()=>{for(const e of [employee({},'owner',true,'access_admin'),employee({},'owner',true,'crm_leader'),employee({'crm.read':'all','campaigns.manage':'all'},'owner',false)])await assert.rejects(()=>ownCampaignSaveResult(fixture(),e,'request-owner-123'),(x:any)=>x.status===403);});
test('未登录、格式错误、未知请求、跨用户结果隔离',async()=>{const db=fixture();await assert.rejects(()=>ownCampaignSaveResult(db,null,'request-owner-123'),(x:any)=>x.status===401);await assert.rejects(()=>ownCampaignSaveResult(db,employee({'crm.read':'all','campaigns.manage':'all'}),'x'),(x:any)=>x.status===400);await assert.rejects(()=>ownCampaignSaveResult(db,employee({'crm.read':'all','campaigns.manage':'all'}),'request-other-456'),(x:any)=>x.status===404);await assert.rejects(()=>ownCampaignSaveResult(db,employee({'crm.read':'all','campaigns.manage':'all'},'other'),'request-owner-123'),(x:any)=>x.status===404);await assert.rejects(()=>ownCampaignSaveResult(db,employee({'crm.read':'all','campaigns.manage':'all'}),'unknown-request'),(x:any)=>x.status===404);});
test('业务授权从当前会话获取，不从查询参数或body指定用户',async()=>{const db=fixture(),handler=campaignSaveResultHandler(db,async()=>employee({'crm.read':'all','campaigns.manage':'all'},'other'));await assert.rejects(()=>handler({params:{requestId:'request-owner-123'},query:{actor:'owner'},body:{employeeId:'owner'}},{}),(x:any)=>x.status===404);});
