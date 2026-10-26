import type {Employee} from './identity.ts';
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
/** Campaign receipts use the current campaign business grant, never notification grants or role names. */
export async function ownCampaignSaveResult(db:any,employee:Employee|null,requestId:unknown){
 if(!employee)fail(401,'Education platform authentication required');
 if(employee.active===false||!employee.permissions.includes('crm.read')||!employee.permissions.includes('campaigns.manage'))fail(403,'Campaign management permission required');
 if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(requestId))fail(400,'Invalid request ID');
 const row=(await db.query("SELECT data FROM portal_audit WHERE action='campaign.save' AND actor=:p1 AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",[employee.id,requestId])).rows[0];
 if(!row?.data?.result)fail(404,'Saved result not found');
 return {campaign:row.data.result};
}
/** Dependency injection permits testing the actual handler without listeners, role writes or auth bypasses. */
export function campaignSaveResultHandler(db:any,authenticate:(request:any)=>Promise<Employee|null>){
 return async(req:any,res:any)=>{
  const employee=await authenticate(req);
  const result=await ownCampaignSaveResult(db,employee,req.params.requestId);
  res.set('Cache-Control','no-store').json(result);
 };
}
