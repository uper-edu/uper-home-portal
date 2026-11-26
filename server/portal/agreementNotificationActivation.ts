import {validate} from './policy.ts';
import {LARK_GROUP,LARK_PERSONAL,notificationGroupIds,policyDeliveryChannels} from '../../src/utils/notificationGroupTargets.ts';
import {auditLog} from './audit.ts';
import {findSystemLarkGroup} from './larkSystemChannels.ts';
/** Explicit activation only. No startup migration and no replay of old events. */
export async function activateAgreementNotifications(c:any,actor:string){
 const group = findSystemLarkGroup((await c.query("SELECT id,config FROM notification_channels ORDER BY id FOR SHARE")).rows, []);
 if(!group)throw Error('CRM Bot channel required');
 const row=(await c.query('SELECT * FROM notification_rules WHERE id=:p1 FOR UPDATE',['commitment.due'])).rows[0];
 if(!row||row.config.event!=='commitment.due'||row.config.recipient!=='owner'||row.config.teams?.length||row.config.requiresRoutingReview)throw Error('Agreement routing requires review');
 const choices = policyDeliveryChannels(row.config);
 const channels = row.config.channels.includes('lark') ? row.config.channels :
   [...new Set([...choices, LARK_GROUP, ...(!choices.includes(LARK_GROUP) && !choices.includes(LARK_PERSONAL) ? [LARK_PERSONAL] : [])])];
 const config={...row.config,group:row.config.groupIds ? '' : group.id,channels};
 if(row.config.groupIds)config.groupIds=[...new Set([...notificationGroupIds(config),group.id])];
 validate(config);
 if(row.enabled&&JSON.stringify(config)===JSON.stringify(row.config))return {changed:false,version:row.version};
 await c.query('UPDATE notification_rules SET enabled=true,config=:p2,version=version+1,effective_at=UTC_TIMESTAMP(6) WHERE id=:p1',[row.id,config]);
 await c.query('INSERT INTO rule_versions(id,version,config) VALUES(:p1,:p2,:p3)',[row.id,row.version+1,config]);
 await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'agreement.notifications.enabled',:p2)",[actor,{ruleId:row.id,version:row.version+1,historicalReplay:false}]);
 auditLog(actor,'agreement.notifications.enabled');
 return {changed:true,version:row.version+1};
}
