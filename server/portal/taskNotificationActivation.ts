import {CRM_BOT_CHANNEL, TASK_NOTICE_EVENTS, validate} from './policy.ts';

/** Run inside a transaction. Explicit activation only, never an automatic startup migration. */
export async function activateTaskNotifications(c: any, actor: string, apply = false) {
  const channel=(await c.query('SELECT id FROM notification_channels WHERE id=:p1',[CRM_BOT_CHANNEL])).rows[0];
  if(!channel)throw Error('CRM Bot channel required');
  const rows=(await c.query('SELECT * FROM notification_rules WHERE id IN (:p1) ORDER BY id FOR UPDATE',[[...TASK_NOTICE_EVENTS]])).rows;
  if(rows.length!==TASK_NOTICE_EVENTS.length)throw Error('All three task notification rules required');
  // Validate the entire plan before the first write; never erase custom filters or review flags.
  const plan=rows.map((r:any)=>{
    if(r.config.event!==r.id || r.config.recipient!=='owner' || r.config.team || r.config.teams?.length || r.config.requiresRoutingReview)
      throw Error('Task notification routing requires explicit review');
    const config={...r.config,group:CRM_BOT_CHANNEL};validate(config);
    return {id:r.id,from:r.config.group,to:CRM_BOT_CHANNEL,changed:!r.enabled||r.config.group!==CRM_BOT_CHANNEL,version:r.version,config};
  });
  for(const p of plan){
    if(!apply||!p.changed)continue;
    await c.query('UPDATE notification_rules SET enabled=true,config=:p2,version=version+1,effective_at=UTC_TIMESTAMP(6) WHERE id=:p1',[p.id,p.config]);
    await c.query('INSERT INTO rule_versions(id,version,config) VALUES(:p1,:p2,:p3)',[p.id,p.version+1,p.config]);
    await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'task.notifications.enabled',:p2)",[actor,{ruleId:p.id,from:p.from,to:p.to,version:p.version+1,historicalReplay:false}]);
  }
  return plan.map(p=>({id:p.id,from:p.from,to:p.to,version:p.version+(apply&&p.changed?1:0),changed:p.changed,applied:apply&&p.changed}));
}
