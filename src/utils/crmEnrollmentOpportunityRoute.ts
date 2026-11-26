export const opportunityFilterDefaults={
  opportunityStatus:'active',opportunityQuery:'',opportunityOwner:'mine',opportunityLevel:'',opportunityStage:'',opportunityState:'',opportunityFollowup:'',
};
export type OpportunityFilters=typeof opportunityFilterDefaults;

export function opportunityListPath(filters:OpportunityFilters,customerId?:string|null) {
  const query=new URLSearchParams({tab:'opportunities',...filters});
  if(customerId)query.set('customerId',customerId);
  return '/crm?'+query.toString();
}

/** Rebuild the return link from list filters. A finance URL cannot redirect elsewhere. */
export function enrollmentOpportunityReturnPath(value:string|null) {
  if(!value?.startsWith('/crm?'))return null;
  const query=new URLSearchParams(value.slice(5));
  if(query.get('tab')!=='opportunities')return null;
  const filters=Object.fromEntries(Object.entries(opportunityFilterDefaults)
    .map(([key,fallback])=>[key,query.get(key)??fallback])) as OpportunityFilters;
  return opportunityListPath(filters,query.get('customerId'))+'&resumeOpportunityList=1';
}
