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
