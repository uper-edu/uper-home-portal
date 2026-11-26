import {larkApplication} from './integrationCredentialTargets.ts';
import {resolveRecipients} from './notificationDelivery.ts';
import type {Employee} from './identity.ts';
import type {Rule} from './policy.ts';
import {normalizePersonalPreferences,personalNotificationTypes} from '../../src/utils/personalNotificationPreferences.ts';
import {LARK_PERSONAL,policyDeliveryChannels} from '../../src/utils/notificationGroupTargets.ts';
import {personalLarkChannel} from './larkChannelModes.ts';
export {personalNotificationAllowed,personalNotificationLanguage} from '../../src/utils/personalNotificationPreferences.ts';
export async function personalNotificationPreferences(db:any,employeeId:string){
 const all=(await db.query("SELECT value FROM access_state WHERE id='notification_preferences'")).rows[0]?.value||{};
 return normalizePersonalPreferences(all[employeeId]);
}
export async function personalNotificationAvailability(db:any,employee:Employee){
 const rows=(await db.query('SELECT config FROM notification_rules WHERE enabled=true AND effective_at<=UTC_TIMESTAMP(6)')).rows;
 const visibleTypes=personalNotificationTypes.map(t=>t[0]).filter(type=>type!=='notification.failed'&&resolveRecipients({event:type} as Rule,{owner:employee.id},[employee],'own-notification-preview').ids.includes(employee.id));
 const app=(await personalLarkChannel(db)).mode==='live'?await larkApplication(db):undefined;
 return {visibleTypes,personalDeliveryEnabled:Boolean(app?.appId&&app.key),systemTypes:personalNotificationTypes.map(t=>t[0]).filter(type=>visibleTypes.includes(type)&&rows.some((r:any)=>r.config.event===type&&policyDeliveryChannels(r.config).includes(LARK_PERSONAL)&&!r.config.requiresRoutingReview&&!r.config.teams?.length))};
}
