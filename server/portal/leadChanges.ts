import crypto from 'node:crypto';
import {allowed, type Employee} from './identity.ts';
/** No transcripts or global activity watermark cross the authorization boundary. */
export async function leadChanges(db:any, employee:Employee) {
  const rows=(await db.query("SELECT id,profile->>'$.owner' AS owner,MD5(CAST(profile AS CHAR)) AS revision FROM portal_leads ORDER BY id")).rows;
  const visible=rows.filter((row:any)=>allowed(employee,{owner:row.owner==='null'?null:row.owner}));
  const ids=visible.map((row:any)=>row.id);
  const base={employee:employee.id,grants:employee.grants,scope:employee.scope,roles:employee.roles,leads:visible};
  let activity:any[]=[],tasks:any[]=[],marks:any[]=[];
  if(ids.length) {
    const slots=ids.map((_:any,i:number)=>':p'+(i+1)).join(',');
    tasks=(await db.query(`SELECT lead_id,COUNT(*) AS n,SUM(CRC32(CONCAT(id,status,COALESCE(owner_id,''),due_at,CAST(details AS CHAR)))) AS revision FROM followup_tasks WHERE lead_id IN (${slots}) GROUP BY lead_id ORDER BY lead_id`,ids)).rows;
    activity=(await db.query(`SELECT a.lead_id,COUNT(*) AS n,MAX(a.activity_id) AS last_id,MAX(a.activity_at) AS last_at,
      SUM(a.activity_at>COALESCE(r.seen_at,'1000-01-01')) AS unread_count FROM (
        SELECT c.lead_id,m.id AS activity_id,m.created_at AS activity_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.lead_id IN (${slots}) AND m.role='user' AND m.status='saved' AND TRIM(m.content)<>''
        UNION ALL SELECT lead_id,id,created_at FROM outbox WHERE lead_id IN (${slots}) AND type IN ('lead.created','assessment.completed','conversation.reactivated','handoff.requested','booking.requested','enrollment.requested')
      ) a LEFT JOIN lead_read_marks r ON r.lead_id=a.lead_id AND r.employee_id=:p${ids.length+1} GROUP BY a.lead_id ORDER BY a.lead_id`,[...ids,employee.id])).rows;
    marks=(await db.query(`SELECT lead_id,seen_at FROM lead_read_marks WHERE lead_id IN (${slots}) AND employee_id=:p${ids.length+1} ORDER BY lead_id`,[...ids,employee.id])).rows;
  }
  return {cursor:crypto.createHash('sha256').update(JSON.stringify({...base,tasks,activity,marks})).digest('hex'),unreadCustomers:activity.filter(row=>Number(row.unread_count)>0).length};
}
