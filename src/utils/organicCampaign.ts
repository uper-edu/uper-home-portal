import {campaigns} from '../data/system-defaults/index.ts';
export const ORGANIC_CAMPAIGN_ID='organic';
export function canonicalCampaignId(value?:string|null){const key=(value||'').trim();return !key||['home','organic'].includes(key.toLowerCase())?ORGANIC_CAMPAIGN_ID:key;}
export function isOrganicCampaign(c:{id?:string;code?:string}){return [c.id,c.code].some(v=>v?.toLowerCase()==='organic');}
export function organicCampaignName(lang:string){return lang==='zh'?'非活动来源':lang==='id'?'Sumber non-kampanye':'Non-campaign source';}
export function isEvergreenCampaign(input:{id?:string;code?:string}) {
  return [input.id,input.code].some(value=>value?.trim().toLowerCase()==='social-bio');
}
export function assertEditableCampaign(input:{id?:string;code?:string;systemManaged?:boolean}){if(isEvergreenCampaign(input)||[input.id,input.code].some(v=>v&&['home','organic'].includes(v.trim().toLowerCase())))throw Object.assign(Error('System organic campaign is permanent and read-only'),{status:403});}
export function organicCampaignRecord(at=new Date().toISOString()){
  const preset = campaigns.find(record => record.id === ORGANIC_CAMPAIGN_ID)!;
  return {...structuredClone(preset), createdAt:at, updatedAt:at};
}
