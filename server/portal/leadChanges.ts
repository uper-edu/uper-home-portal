import crypto from 'node:crypto';
import {allowed, type Employee} from './identity.ts';
/** No transcripts or global activity watermark cross the authorization boundary. */
export async function leadChanges(db:any, employee:Employee) {
  const rows=(await db.query("SELECT id,profile->>'$.owner' AS owner,MD5(CAST(profile AS CHAR)) AS revision FROM portal_leads ORDER BY id")).rows;
  const visible=rows.filter((row:any)=>allowed(employee,{owner:row.owner==='null'?null:row.owner}));
  const ids=visible.map((row:any)=>row.id);
  const base={employee:employee.id,grants:employee.grants,scope:employee.scope,roles:employee.roles,leads:visible};
  let activity:any[]=[],tasks:any[]=[],requests:any[]=[];
  if(ids.length) {
    const slots=ids.map((_:any,i:number)=>':p'+(i+1)).join(',');
    tasks=(await db.query(`SELECT lead_id,COUNT(*) AS n,SUM(CRC32(CONCAT(id,status,COALESCE(owner_id,''),due_at,COALESCE(scheduled_at,''),revision,CAST(details AS CHAR)))) AS revision FROM followup_tasks WHERE lead_id IN (${slots}) GROUP BY lead_id ORDER BY lead_id`,ids)).rows;
    activity=(await db.query(`SELECT c.lead_id,COUNT(*) AS n,MAX(m.id) AS last_id,MAX(m.created_at) AS last_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.lead_id IN (${slots}) AND m.role='user' GROUP BY c.lead_id ORDER BY c.lead_id`,ids)).rows;
    requests=(await db.query(`SELECT lead_id,COUNT(*) AS n,SUM(CRC32(CONCAT(id,state,COALESCE(task_id,''),version))) AS revision FROM crm_engagements WHERE kind='task_request' AND lead_id IN (${slots}) GROUP BY lead_id ORDER BY lead_id`,ids)).rows;

  }
  return {cursor:crypto.createHash('sha256').update(JSON.stringify({...base,tasks,activity,requests})).digest('hex')};
}
