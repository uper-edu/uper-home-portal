/** Defaults for new configuration only. Explicit saved policy/channel values win. */
import {notifications} from '../data/system-defaults/index.ts';
export const LARK_DEFAULT_LANGUAGE = notifications.language as 'en' | 'id' | 'zh';
export const LARK_DEFAULT_MAX_PER_HOUR = notifications.maxPerHour;
