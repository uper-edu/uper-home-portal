/** Read-only, allowlisted evidence. Do not recreate a URL or infer missing marketing facts. */
const keys=['c','cid','campaign','p','lang','utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const text=(v:unknown)=>typeof v==='string'?v:null;
export function campaignSourceEvidence(profile:any,conversations:any[],rawCode:string){
 const entries=conversations.flatMap(row=>{
  const page=text(row.attribution?.page);if(!page)return [];
  try{
   const url=new URL(page,'https://saved-entry.invalid');
   if(!['http:','https:'].includes(url.protocol))return [];
   const code=url.searchParams.get('c')||url.searchParams.get('cid')||url.searchParams.get('campaign');
   if(!code||code.trim().toLowerCase()!==rawCode.trim().toLowerCase())return [];
   const parameters=keys.flatMap(key=>url.searchParams.getAll(key).map(value=>({key,value})));
   return [{conversationId:String(row.id),lastActivityAt:row.updated_at instanceof Date?row.updated_at.toISOString():text(row.updated_at),surface:text(row.source),path:url.pathname,parameters,possiblyTruncated:page.length>=300}];
  }catch{return [];}
 });
 return {
  leadField:profile.campaignId?'campaignId':'campaign',
  campaignCode:text(profile.campaignId)||text(profile.campaign),
  promotionLinkId:text(profile.rawPromotionLinkId)||text(profile.promotionLinkId),
  promotionLinkStatus:text(profile.promotionLinkStatus),
  entryPoint:text(profile.entryPoint),
  placement:text(profile.placement),
  language:text(profile.communicationLanguage)||text(profile.language)||text(profile.lang),
  entries,
 };
}
