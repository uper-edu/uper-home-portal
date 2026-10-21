export const leadDetailTabs=['activities','profile','assessment','chat'] as const;
export type LeadDetailTab=typeof leadDetailTabs[number];
export function leadDetailTab(value:string|null|undefined):LeadDetailTab{return leadDetailTabs.includes(value as LeadDetailTab)?value as LeadDetailTab:'activities';}
/** Only identity/navigation parameters change; filters remain permission-neutral. */
export function leadDetailUrl(href:string,id?:string,tab:LeadDetailTab='activities'){
 const url=new URL(href);url.hash='';url.searchParams.set('tab','leads');
 for(const key of ['campaign','campaignView','campaignArea'])url.searchParams.delete(key);
 if(id){url.searchParams.set('lead',id);url.searchParams.set('leadView',tab);}else{url.searchParams.delete('lead');url.searchParams.delete('leadView');}
 return url.href;
}
