import {interactionInstant} from './crmInteractionTimeline';
/** Relative presentation uses this event's occurrence only, never recording time. */
export function interactionElapsedLabel(at:unknown,lang='zh',now=Date.now()){
 const instant=interactionInstant(at);if(!instant||Date.parse(instant)>now)return '';
 const m=Math.floor((now-Date.parse(instant))/60000),h=Math.floor(m/60),d=Math.floor(h/24);
 if(lang==='zh')return m<1?'不到1分钟前':d?`${d}天${h%24}小时前`:h?`${h}小时${m%60}分钟前`:`${m}分钟前`;
 return lang==='id'?(d?`${d} hari ${h%24} jam lalu`:h?`${h} jam ${m%60} menit lalu`:`${m} menit lalu`):(d?`${d}d ${h%24}h ago`:h?`${h}h ${m%60}m ago`:`${m}m ago`);
}

/** Compact worklist labels deliberately show one unit for quick scanning. */
export function shortInteractionElapsedLabel(at:unknown,lang='zh',now=Date.now()){
 const instant=interactionInstant(at);if(!instant||Date.parse(instant)>now)return '';
 const minutes=Math.floor((now-Date.parse(instant))/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
 if(lang==='zh')return days?`${days}天前`:hours?`${hours}小时前`:minutes?`${minutes}分钟前`:'刚刚';
 if(lang==='id')return days?`${days} hari lalu`:hours?`${hours} jam lalu`:minutes?`${minutes} menit lalu`:'Baru saja';
 return days?`${days}d ago`:hours?`${hours}h ago`:minutes?`${minutes}m ago`:'Just now';
}
