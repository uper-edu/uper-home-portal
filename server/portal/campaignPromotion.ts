import {randomUUID, createHash} from 'node:crypto';
import {tx} from './store.ts';
import {promotionInput} from '../../src/utils/campaignPromotion.ts';
import {assertEditableCampaign} from '../../src/utils/organicCampaign.ts';

export async function addCampaignPromotion(campaignId:string,input:any,actor:string) {
 if(typeof input.requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(input.requestId))throw Object.assign(Error('A request ID is required.'),{status:400});
 const values=promotionInput(input);
 const fingerprint=createHash('sha256').update(JSON.stringify({campaignId,...values})).digest('hex');
 return tx(async(db:any)=>{
  const row=(await db.query('SELECT config FROM trial_campaigns WHERE id=:p1 FOR UPDATE',[campaignId])).rows[0];
  if(!row)throw Object.assign(Error('Campaign not found.'),{status:404});
  assertEditableCampaign({...row.config,id:campaignId});
  const prior=(await db.query("SELECT data FROM portal_audit WHERE actor=:p1 AND action='campaign.promotion.create' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",[actor,input.requestId])).rows[0]?.data;
  if(prior){if(prior.fingerprint!==fingerprint)throw Object.assign(Error('Request already used with different values.'),{status:409});return {campaign:row.config,link:prior.link};}
  const link={id:'p_'+randomUUID().replaceAll('-',''),...values,createdAt:new Date().toISOString()};
  const campaign={...row.config,promotionLinks:[...(row.config.promotionLinks||[]),link],updatedAt:link.createdAt};
  await db.query('UPDATE trial_campaigns SET config=:p2 WHERE id=:p1',[campaignId,campaign]);
  await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.promotion.create',:p2)",[actor,{campaignId,requestId:input.requestId,fingerprint,link}]);
  return {campaign,link};
 });
}

/** Resolve c/p together. Unknown or mismatched p never borrows another campaign's settings. */
export async function resolvePromotion(db:any,code:string,p:string) {
 const row=(await db.query('SELECT config FROM trial_campaigns WHERE id=:p1 OR code=:p1',[code])).rows[0]?.config;
 const link=row?.promotionLinks?.find((link:any)=>link.id===p);
 return link?{campaign:row,link}:null;
}
export async function promotionAttribution(db:any,existing:any,input:any) {
 // Preserve the original attribution as a unit, including an originally unrecorded p.
 if(existing.campaignId||existing.campaign)return {};
 if(!input.promotionLinkId)return {};
 if(typeof input.promotionLinkId!=='string'||input.promotionLinkId.length>100)throw Object.assign(Error('Invalid promotion link ID.'),{status:400});
 const code=String(input.campaignId||input.campaign||'').trim();
 const resolved=await resolvePromotion(db,code,input.promotionLinkId);
 if(!resolved)return {rawPromotionLinkId:input.promotionLinkId,promotionLinkStatus:'unverified',placement:'unrecorded',entryPoint:'unverified_source',hookType:'hsk_assessment',hookContext:'website'};
 const {link,campaign}=resolved;
 return {campaignId:campaign.code,campaign:campaign.name,promotionLinkId:link.id,promotionLinkStatus:'verified',promotionSnapshot:{...link},placement:link.medium,entryPoint:link.source,hookType:'hsk_assessment',hookContext:'website'};
}
