import campaigns from './campaigns.ts';
import access from './access.ts';
import notifications from './notifications.ts';
import sales from './sales.ts';
import courses from './courses.ts';
import ai from './ai.ts';

export {campaigns, access, notifications, sales, courses, ai};

/**
 * Shared data registry for database initialization and runtime fallbacks.
 * Category files own the default values. Passwords, keys and runtime customer data stay outside this registry.
 * The compatibility fields below retain the existing initializer and CMS bootstrap interfaces.
 */
export default {
  campaigns,
  finance: access.roles.finance,
  crmLarkBot: notifications.groupChannel,
  larkPersonalChannel: notifications.personalChannel,
};
