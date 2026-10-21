import type {CampaignPromotionLink} from '../types/crmCampaign.ts';

export const PROMOTION_EXPERIENCE = 'questionnaire_assessment_consultation';
export const PROMOTION_EXPERIENCE_LABEL = 'Questionnaire → assessment when applicable → AI consultation';
export const PROMOTION_SOURCES = ['instagram','facebook','tiktok','google','whatsapp','uper_newsletter'];
export const PROMOTION_MEDIA = ['paid_social','social','cpc','group_message','direct_message','email','poster','flyer','table_card','referral'];
export const PROMOTION_MEDIUM_LABELS: Record<string,string> = {paid_social:'Paid social ad',social:'Organic social post',cpc:'Paid search ad',group_message:'Group message',direct_message:'Direct message',email:'Email',poster:'Poster',flyer:'Flyer',table_card:'Table card',referral:'Referral'};
export function promotionInput(input: any) {
 const source=typeof input.source==='string'?input.source.trim().toLowerCase():'';
 const medium=typeof input.medium==='string'?input.medium.trim().toLowerCase():'';
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(source)||!PROMOTION_MEDIA.includes(medium)||!['en','id','zh'].includes(input.language)||input.experience!==PROMOTION_EXPERIENCE||name.length>120)
  throw Object.assign(Error('Select a source, medium, language and supported entry experience. Source codes use letters, numbers, underscores or hyphens.'),{status:400});
 return {name:name||`${source} · ${medium} · ${input.language}`,source,medium,language:input.language as 'en'|'id'|'zh',experience:PROMOTION_EXPERIENCE as typeof PROMOTION_EXPERIENCE};
}
export function campaignPromotionUrl(code:string,link:CampaignPromotionLink,origin:string) {
 const url=new URL('/chat',origin);
 for(const [key,value] of Object.entries({c:code,p:link.id,lang:link.language,utm_campaign:code,utm_source:link.source,utm_medium:link.medium}))url.searchParams.set(key,value);
 return url.toString();
}
