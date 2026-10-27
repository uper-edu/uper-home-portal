export type CampaignScheduleParts = {date:string;time:string};

// These are wall-clock values in the campaign's operating timezone, not browser-local instants.
export function splitCampaignDateTime(value:string):CampaignScheduleParts|null {
 if(!value)return {date:'',time:''};
 const match=/^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
 if(!match)return null;
 const [,date,time]=match;
 const parsed=new Date(`${date}T00:00:00Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return null;
 return {date,time};
}

export function campaignDateTimeValue(date:string,time:string):string {
 const value=`${date}T${time}`;
 return date&&time&&splitCampaignDateTime(value)?value:'';
}

// Campaign storage retains its existing operational wall clock. Conversion belongs
// only at the UI boundary; partial/date-only records must not invent a timestamp.
import {calendarSample} from './workCalendar';
import {formatCrmOperatingTime, viewerTimeZone, validateLocalInstant} from './crmOperatingTime';
export const CAMPAIGN_SCHEDULE_ZONE='Asia/Jakarta';
export function convertCampaignSchedule(date:string,time:string,from:string,to:string):CampaignScheduleParts {
 if(!campaignDateTimeValue(date,time))return {date,time};
 const instant=calendarSample(date,time,from);
 // Reject invalid dates and nonexistent local times instead of silently normalizing.
 if(formatCrmOperatingTime(instant.toISOString(),from).slice(0,16).replace(' ','T')!==`${date}T${time}`)throw Error('Invalid local date and time');
 const value=formatCrmOperatingTime(instant.toISOString(),to);
 return {date:value.slice(0,10),time:value.slice(11,16)};
}
export function campaignViewerSchedule(date='',time='',zone=viewerTimeZone()){
 try{return convertCampaignSchedule(date,time,CAMPAIGN_SCHEDULE_ZONE,zone);}catch{return {date,time};}
}
export function campaignStoredSchedule(date:string,time:string,zone=viewerTimeZone()){
 if(date&&time)validateLocalInstant(`${date}T${time}`,calendarSample(date,time,zone),zone);
 return convertCampaignSchedule(date,time,zone,CAMPAIGN_SCHEDULE_ZONE);
}
