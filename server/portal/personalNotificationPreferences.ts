import {resolveRecipients} from './notificationDelivery.ts';
import type {Employee} from './identity.ts';
import type {Rule} from './policy.ts';
import {normalizePersonalPreferences,personalNotificationTypes} from '../../src/utils/personalNotificationPreferences.ts';
export {personalNotificationAllowed,personalNotificationLanguage} from '../../src/utils/personalNotificationPreferences.ts';
export async function personalNotificationPreferences(db:any,employeeId:string){
 const all=(await db.query("SELECT value FROM access_state WHERE id='notification_preferences'")).rows[0]?.value||{};
 return normalizePersonalPreferences(all[employeeId]);
}
export async function personalNotificationAvailability(db:any,employee:Employee){
 const rows=(await db.query('SELECT config FROM notification_rules WHERE enabled=true AND effective_at<=UTC_TIMESTAMP(6)')).rows;
 const visibleTypes=personalNotificationTypes.map(t=>t[0]).filter(type=>type!=='notification.failed'&&resolveRecipients({event:type} as Rule,{owner:employee.id},[employee],'own-notification-preview').ids.includes(employee.id));
 return {visibleTypes,personalDeliveryEnabled:process.env.LARK_PERSONAL_DELIVERY_ENABLED==='true',systemTypes:personalNotificationTypes.map(t=>t[0]).filter(type=>visibleTypes.includes(type)&&rows.some((r:any)=>r.config.event===type&&r.config.channels?.includes('lark')&&!r.config.requiresRoutingReview&&!r.config.teams?.length))};
}
