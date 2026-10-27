import {eligibleOwner,permittedRecord} from '../../src/utils/accessControl.ts';
import {isCrmManager} from '../../src/utils/crmOutreach.ts';
const bad=(s:string,status=400):never=>{throw Object.assign(Error(s),{status});};
const keys=new Set(['owner','expectedOwner','expectedOwnerChangedAt','ownerChangeReason','ownerChangeRequestId']);
export const ownerAssignmentBody=(body:any)=>Object.hasOwn(body||{},'owner')&&Object.keys(body).every(k=>keys.has(k));
export function authorizeOwnerChange(actor:any,current:any,managerOnly=false){
 if(!actor||actor.active===false||!actor.permissions?.includes('crm.assign')||!permittedRecord(actor,current,'crm.assign')||!permittedRecord(actor,current,'crm.read'))bad('没有分配客户负责人的权限',403);
 if(managerOnly&&!isCrmManager(actor))bad('只有CRM经理可以分配负责人',403);
}
export function ownerChangeInput(body:any){
 if(!ownerAssignmentBody(body)||typeof body.owner!=='string'||!body.owner.trim())bad('请选择接收销售');
 if(!Object.hasOwn(body,'expectedOwner')||!Object.hasOwn(body,'expectedOwnerChangedAt'))bad('请刷新客户信息后再分配');
 if(body.expectedOwner!==null&&typeof body.expectedOwner!=='string'||body.expectedOwnerChangedAt!==null&&typeof body.expectedOwnerChangedAt!=='string')bad('负责人版本无效');
 if(typeof body.ownerChangeRequestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(body.ownerChangeRequestId))bad('缺少有效保存编号');
 if(typeof body.ownerChangeReason!=='string'||body.ownerChangeReason.length>2000)bad('交接说明过长');
 return {owner:body.owner,expectedOwner:body.expectedOwner||null,expectedOwnerChangedAt:body.expectedOwnerChangedAt||null,reason:body.ownerChangeReason.trim(),requestId:body.ownerChangeRequestId};
}
export const ownerReceiptSql="SELECT data FROM portal_audit WHERE action='lead.owner_change' AND actor=:p1 AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.id'))=:p2 AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p3 ORDER BY id DESC LIMIT 1";
export async function ownerReceipt(c:any,actor:any,current:any,requestId:string,managerOnly=false){
 authorizeOwnerChange(actor,current,managerOnly);
 if(!/^[-a-zA-Z0-9]{8,100}$/.test(requestId))bad('保存编号无效');
 const saved=(await c.query(ownerReceiptSql,[actor.id,current.id,requestId])).rows[0]?.data;
 if(!saved)bad('未查到保存结果',404);return saved;
}
/** Caller holds the existing lead row lock. Only owner and assignment metadata change. */
export async function changeLeadOwner(c:any,{actor,current,body,directory,managerOnly,pendingIdentity,fact,event}:any){
 authorizeOwnerChange(actor,current,managerOnly);const input=ownerChangeInput(body);
 const prior=(await c.query(ownerReceiptSql,[actor.id,current.id,input.requestId])).rows[0]?.data;
 if(prior){if(!Object.keys(input).every(key=>prior.input?.[key]===input[key as keyof typeof input]))bad('保存编号已用于其他修改',409);return {lead:current,receipt:prior.receipt};}
 if((current.owner||null)!==input.expectedOwner||(current.ownerChangedAt||null)!==input.expectedOwnerChangedAt)bad('负责人已被其他人修改，请刷新后核对',409);
 if(current.owner===input.owner)bad('请选择不同的接收销售');
 if(current.owner&&!input.reason)bad('请填写交接说明');
 if(pendingIdentity)bad('请先完成客户身份核对',409);
 const target=directory.find((p:any)=>p.id===input.owner&&p.active===true&&eligibleOwner(p));
 const next={...current,owner:input.owner,ownerChangedAt:new Date().toISOString()};
 if(!target||!permittedRecord(target,next,'crm.read')||!permittedRecord(target,next,'crm.followup'))bad('接收销售无权查看或跟进此客户');
 const previous=directory.find((p:any)=>p.id===current.owner);
 await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[current.id,next]);
 await c.query("UPDATE followup_tasks SET owner_id=:p2 WHERE lead_id=:p1 AND status IN ('open','overdue','migration_hold')",[current.id,next.owner]);
 const receipt={requestId:input.requestId,before:current.owner||null,after:next.owner,changedAt:next.ownerChangedAt};
 await fact(c,current.id,'owner.changed',actor.id,{before:receipt.before,after:receipt.after,beforeName:previous?.displayName||receipt.before||'未分配',afterName:target.displayName||target.id,reason:input.reason,changedAt:receipt.changedAt,requestId:input.requestId});
 await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[actor.id,'lead.owner_change',{id:current.id,requestId:input.requestId,input,receipt}]);
 await event(c,'conversation.updated',current.id,{source:'crm_assignment',assignmentChanged:true});
 return {lead:next,receipt};
}
