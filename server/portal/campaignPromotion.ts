import {randomUUID, createHash} from 'node:crypto';
import {auditLog} from './audit.ts';
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
  await insertPromotionIndex(db, link.id, campaignId);
  const campaign={...row.config,promotionLinks:[...(row.config.promotionLinks||[]),link],updatedAt:link.createdAt};
  await db.query('UPDATE trial_campaigns SET config=:p2 WHERE id=:p1',[campaignId,campaign]);
  await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.promotion.create',:p2)",[actor,{campaignId,requestId:input.requestId,fingerprint,link}]);
  auditLog(actor,'campaign.promotion.create',{requestId:input.requestId});
  return {campaign,link};
 });
}

export async function insertPromotionIndex(db: any, p: string, campaignId: string) {
 return db.query('INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(:p1,:p2)', [p, campaignId]);
}

export {resolvePromotion, publicPromotion, promotionAttribution} from './attribution.ts';
