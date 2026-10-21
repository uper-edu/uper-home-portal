export type CampaignFilters={search:string;type:string;status:string};
function withFilters(href:string,filters:CampaignFilters){
 const url=new URL(href);url.hash='';url.searchParams.set('tab','campaigns');
 for(const [key,value] of [['campaignSearch',filters.search],['campaignType',filters.type],['campaignStatus',filters.status]]){
  if(value&&value!=='All')url.searchParams.set(key,value);else url.searchParams.delete(key);
 }
 return url;
}
/** Keep the exact catalogue/detail context independently of the source-review route. */
export function campaignReviewReturnUrl(href:string,filters:CampaignFilters){
 const url=withFilters(href,filters);
 for(const key of ['campaignArea','sourceIssue','sourceCampaign'])url.searchParams.delete(key);
 return url.href;
}
export function campaignReviewUrl(href:string,filters:CampaignFilters,campaignId?:string){
 const url=new URL(campaignReviewReturnUrl(href,filters));
 for(const key of ['campaign','campaignView','lead','leadView'])url.searchParams.delete(key);
 url.searchParams.set('campaignArea','sources');
 if(campaignId){url.searchParams.set('sourceIssue','promotions');url.searchParams.set('sourceCampaign',campaignId);}
 return url.href;
}
export type SourceReviewState={pending:boolean;loading:boolean;unavailable:boolean};
/** Categories have different units. Expose presence and availability, never a misleading summed count. */
export function sourceReviewState(unknownPending:boolean|null,promotions:{available:boolean;counts:Record<string,number>},loading:boolean):SourceReviewState{
 return {pending:unknownPending===true||promotions.available&&Object.values(promotions.counts).some(n=>n>0),loading,unavailable:!loading&&(unknownPending===null||!promotions.available)};
}
