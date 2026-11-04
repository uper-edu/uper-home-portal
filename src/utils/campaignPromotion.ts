import type {CampaignPromotionLink} from '../types/crmCampaign.ts';
import {promotionLandingPaths, promotionKindForMedium, promotionCodePattern} from './promotionNavigation';

export const PROMOTION_EXPERIENCE = 'questionnaire_assessment_consultation';
export const PROMOTION_EXPERIENCE_LABEL = 'Questionnaire → assessment when applicable → AI consultation';
export const PROMOTION_SOURCES = ['instagram','facebook','youtube','tiktok','google','whatsapp','uper_newsletter'];
export const PROMOTION_MEDIA = ['paid_social','social','cpc','messaging','group_message','direct_message','email','poster','flyer','table_card','referral'];
export const PROMOTION_MEDIUM_LABELS: Record<string,string> = {paid_social:'Paid social ad',social:'Organic social post',cpc:'Paid search ad',messaging:'Messaging',group_message:'Group message',direct_message:'Direct message',email:'Email',poster:'Poster',flyer:'Flyer',table_card:'Table card',referral:'Referral'};
export function promotionInput(input: any) {
 const source=typeof input.source==='string'?input.source.trim().toLowerCase():'';
 const medium=typeof input.medium==='string'?input.medium.trim().toLowerCase():'';
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(source)||!PROMOTION_MEDIA.includes(medium)||!['en','id','zh'].includes(input.language)||input.experience!==PROMOTION_EXPERIENCE||name.length>120)
  throw Object.assign(Error('Select a source, medium, language and supported entry experience. Source codes use letters, numbers, underscores or hyphens.'),{status:400});
 const landingPath = input.landingPath === undefined ? undefined : promotionLandingPaths.find(path => path === input.landingPath);
 const promotionKind = input.promotionKind ?? promotionKindForMedium(medium);
 const content = typeof input.content === 'string' ? input.content.trim() : input.content;
 if ((input.landingPath !== undefined && !landingPath) ||
     !['paid', 'unpaid', 'unclassified'].includes(promotionKind) ||
     (input.promotionKind !== undefined && promotionKind === 'unclassified') ||
     (promotionKindForMedium(medium) !== 'unclassified' && promotionKind !== promotionKindForMedium(medium)) ||
     (content !== undefined && content !== '' && (typeof content !== 'string' || !promotionCodePattern.test(content))))
  throw Object.assign(Error('Check the landing page, promotion type and placement code.'), {status:400});
 return {...(landingPath ? {landingPath} : {}), ...(input.promotionKind !== undefined ? {promotionKind} : {}), ...(content ? {content} : {}), name:name||`${source} · ${medium} · ${input.language}`,source,medium,language:input.language as 'en'|'id'|'zh',experience:PROMOTION_EXPERIENCE as typeof PROMOTION_EXPERIENCE};
}
export function campaignPromotionUrl(link:CampaignPromotionLink,origin:string) {
 const url=new URL(promotionLandingPaths.find(path => path === link.landingPath) ?? '/chat',origin);
 url.searchParams.set('p',link.id);
 return url.toString();
}

export function promotionIdPrefix(values: ReturnType<typeof promotionInput>) {
 const landing = values.landingPath === '/' ? 'home' : (values.landingPath ?? '/chat').slice(1);
 const kind = values.promotionKind ?? promotionKindForMedium(values.medium);
 return [values.source.slice(0,20), kind,
   (values.content || values.medium).toLowerCase().slice(0,24), landing, values.language]
   .join('-').replaceAll('_','-');
}
