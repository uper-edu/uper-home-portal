import {basicProfileFields} from './crmDynamicProfile';
import {sameProfileValue} from './crmFieldValues';
import {interactionInstant} from './crmInteractionTimeline';
/** Read projection from real, same-customer facts; never writes invented historical metadata. */
export function questionnaireBasicSources(lead:any,facts:any[]){
 const profile={...lead,profileFieldMeta:{...lead.profileFieldMeta}};
 const local=facts.filter(f=>f.lead_id===lead.id);
 for(const field of Object.keys(basicProfileFields)){
  if(profile.profileFieldMeta[field])continue;
  const candidate=local.filter(f=>f.kind==='questionnaire.submitted'&&Object.hasOwn(f.data?.answers||{},field)&&sameProfileValue(field,f.data.answers[field],lead[field])).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0];
  if(!candidate||local.some(f=>f.kind==='profile.fields_updated'&&(f.data?.changes||[]).some((c:any)=>c.field===field)))continue;
  const at=interactionInstant(candidate.created_at instanceof Date?candidate.created_at.toISOString():candidate.created_at);
  if(!at)continue;
  profile.profileFieldMeta[field]={revision:0,sourceType:'questionnaire',sourceFactIds:[candidate.id],effectiveAt:at,recordedAt:at,updatedBy:'visitor',valueState:'sourced',derivedFromOriginalAnswer:true};
 }
 return profile;
}
