import {createHash} from 'node:crypto';
import {auditLog} from './audit.ts';
import {tx} from './store.ts';
import {promotionInput,promotionIdPrefix} from '../../src/utils/campaignPromotion.ts';
import {assertEditableCampaign,isEvergreenCampaign} from '../../src/utils/organicCampaign.ts';
import {allocatePromotionShortCode,presetPromotionOwner} from '../../cloud/mysql/promotion-short-links.mjs';
import type {CampaignPromotionLink} from '../../src/types/crmCampaign.ts';

export async function promotionShortCodes(db:any) {
 const {rows}=await db.query('SELECT p,short_code FROM campaign_promotion_short_links');
 return new Map<string,string>(rows.map(({p,short_code}: {p:string;short_code:string})=>[p,short_code]));
}

export function attachPromotionShortCodes<T extends {promotionLinks?:CampaignPromotionLink[]}>(campaign:T,codes:ReadonlyMap<string,string>):T {
 if(!campaign.promotionLinks?.length)return campaign;
 return {...campaign,promotionLinks:campaign.promotionLinks.map(link=>({...link,shortCode:codes.get(link.id)}))};
}

export async function addCampaignPromotion(campaignId:string,input:any,actor:string) {
 if(typeof input.requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(input.requestId))throw Object.assign(Error('A request ID is required.'),{status:400});
 const values=promotionInput(input);
 const fingerprint=createHash('sha256').update(JSON.stringify({campaignId,...values})).digest('hex');
 return tx(async(db:any)=>{
  const row=(await db.query('SELECT config FROM trial_campaigns WHERE id=:p1 FOR UPDATE',[campaignId])).rows[0];
  if(!row)throw Object.assign(Error('Campaign not found.'),{status:404});
  if (!isEvergreenCampaign({...row.config,id:campaignId})) assertEditableCampaign({...row.config,id:campaignId});
  const prior=(await db.query("SELECT data FROM portal_audit WHERE actor=:p1 AND action='campaign.promotion.create' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",[actor,input.requestId])).rows[0]?.data;
  if(prior){
   if(prior.fingerprint!==fingerprint)throw Object.assign(Error('Request already used with different values.'),{status:409});
   if(!row.config.promotionLinks?.some((link:CampaignPromotionLink)=>link.id===prior.link.id))
    throw Object.assign(Error('This promotion link was deleted.'),{status:410});
   const codes=await promotionShortCodes(db);
   return {campaign:attachPromotionShortCodes(row.config,codes),link:{...prior.link,shortCode:codes.get(prior.link.id)}};
  }
  const link=await createIndexedPromotion(db,campaignId,values);
  const shortCode=await allocatePromotionShortCode(link.id,(code:string,p:string)=>db.query(
   'INSERT INTO campaign_promotion_short_links(short_code,p) VALUES(:p1,:p2)',[code,p],
  ));
  const campaign={...row.config,promotionModel:'multiple',promotionLinks:[...(row.config.promotionLinks||[]),link],updatedAt:link.createdAt};
  await db.query('UPDATE trial_campaigns SET config=:p2 WHERE id=:p1',[campaignId,campaign]);
  await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.promotion.create',:p2)",[actor,{campaignId,requestId:input.requestId,fingerprint,link}]);
  auditLog(actor,'campaign.promotion.create',{requestId:input.requestId});
  return {campaign:attachPromotionShortCodes(campaign,await promotionShortCodes(db)),link:{...link,shortCode}};
 });
}

export async function hasPromotionCustomerAttribution(db:any, linkId:string) {
 const linked=(await db.query("SELECT id FROM portal_leads WHERE profile->>'$.promotionLinkId'=:p1 OR profile->>'$.promotionReview.linkId'=:p1 OR JSON_CONTAINS(JSON_EXTRACT(profile,'$.identitySources[*].promotionLinkId'),JSON_QUOTE(:p1)) LIMIT 1",[linkId])).rows.length>0;
 return linked || (await db.query("SELECT id FROM portal_audit WHERE action='campaign.promotion.review' AND (data->>'$.before.linkId'=:p1 OR data->>'$.after.linkId'=:p1) LIMIT 1",[linkId])).rows.length>0;
}

export async function removePromotionIndexes(db:any, campaignId:string, linkId:string) {
 await db.query('DELETE FROM campaign_promotion_short_links WHERE p=:p1',[linkId]);
 await db.query('DELETE FROM campaign_promotion_index WHERE p=:p1 AND campaign_id=:p2',[linkId,campaignId]);
}

export async function deleteCampaignPromotion(campaignId:string, linkId:string, actor:string) {
 const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
 return tx(async(db:any)=>{
  // Registration and manual review take the same campaign lock before recording attribution.
  const row=(await db.query('SELECT config FROM trial_campaigns WHERE id=:p1 FOR UPDATE',[campaignId])).rows[0];
  const links:CampaignPromotionLink[]=row?.config?.promotionLinks ?? [];
  if(!links.some(link=>link.id===linkId))fail(404,'Promotion link not found.');
  if(presetPromotionOwner(linkId)===campaignId)fail(409,'System preset links cannot be deleted.');
  if(await hasPromotionCustomerAttribution(db,linkId))fail(409,'This promotion link has customer attribution and cannot be deleted.');
  const promotionLinks=links.filter(link=>link.id!==linkId);
  await removePromotionIndexes(db,campaignId,linkId);
  await db.query('UPDATE trial_campaigns SET config=:p2 WHERE id=:p1',[campaignId,{...row.config,promotionLinks,updatedAt:new Date().toISOString()}]);
  await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.promotion.delete',:p2)",[actor,{campaignId,linkId}]);
  return {success:true};
 });
}

export async function insertPromotionIndex(db: any, p: string, campaignId: string) {
 return db.query('INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(:p1,:p2)', [p, campaignId]);
}

export {resolvePromotion, publicPromotion, promotionAttribution} from './attribution.ts';

export async function createIndexedPromotion(db: any, campaignId: string, values: ReturnType<typeof promotionInput>) {
 const prefix = promotionIdPrefix(values);
 const createdAt = new Date().toISOString();
 const timestamp = createdAt.slice(2,19).replace(/[-:T]/g,'');
 const baseId = prefix + '-' + timestamp;
 for (let sequence = 1; sequence <= 1000; sequence++) {
  const id = sequence === 1 ? baseId : baseId + '-' + sequence;
  const link = {id, ...values, createdAt};
  try {
   await insertPromotionIndex(db,link.id,campaignId);
   return link;
  } catch (error:any) {
   if (error.code !== 'ER_DUP_ENTRY') throw error;
  }
 }
 throw Object.assign(Error('Could not allocate promotion link ID.'), {status:503});
}
