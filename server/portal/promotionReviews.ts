import {canReviewSourceAttribution,assertSourceAttributionReviewer} from './crmAccessControls.ts';
import crypto from 'node:crypto';
import {pool,tx} from './store.ts';
import {allowed} from './identity.ts';
import {sourceKey} from './campaignSources.ts';
import {campaignSourceEvidence} from './campaignSourceEvidence.ts';
import {matchesCampaign} from '../../src/utils/crmCampaignLink.ts';
import {promotionInput} from '../../src/utils/campaignPromotion.ts';
import {assertEditableCampaign} from '../../src/utils/organicCampaign.ts';
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
const permitted=(employee:any,profile?:any)=>{if(!employee||employee.active===false||!employee.permissions?.includes('campaigns.manage')||(profile&&!allowed(employee,profile)))fail(403,'Permission denied.');};
const rawId=(p:any)=>String(p.rawPromotionLinkId||p.promotionLinkId||'');
function context(profile:any,campaigns:any[],reviews:any[]){
 const rawCampaign=String(profile.campaignId||profile.campaign||'');const originalP=rawId(profile);
 if(!originalP)return null; // A legacy campaign-only link is not an error.
 const review=reviews.find((r:any)=>r.id===sourceKey(rawCampaign));
 const effective={...profile,...(review?{campaignSourceStatus:review.status,...(review.status==='linked'?{attributionCampaignId:review.campaign_id}:{})}:{})};
 const matches=campaigns.filter(c=>matchesCampaign(effective,c));if(matches.length!==1)return null;
 const campaign=matches[0];const valid=campaign.promotionLinks?.some((p:any)=>p.id===originalP);
 if(valid&&profile.promotionLinkStatus!=='unverified'&&!profile.promotionReview)return null;
 const prior=profile.promotionReview;
 const current=prior?.rawCampaignCode===rawCampaign&&prior?.rawPromotionLinkId===originalP&&prior?.campaignId===campaign.id?prior:null;
 return {rawCampaign,originalP,campaign,current};
}
async function catalogs(db:any){return {
 campaigns:(await db.query('SELECT id,code,config FROM trial_campaigns')).rows.map((r:any)=>({...r.config,id:r.id,code:r.code})),
 reviews:(await db.query('SELECT * FROM campaign_source_reviews')).rows,
};}
export async function listPromotionReviews(employee:any){
 permitted(employee);const canReview=await canReviewSourceAttribution(pool,employee);const {campaigns,reviews}=await catalogs(pool);
 const candidates=(await pool.query('SELECT id,profile FROM portal_leads')).rows.filter((r:any)=>allowed(employee,r.profile)).flatMap((r:any)=>{const c=context(r.profile,campaigns,reviews);return c?[{...r,...c}]:[];});
 if(!candidates.length)return [];
 const ids=JSON.stringify(candidates.map((r:any)=>r.id));
 const entries=(await pool.query('SELECT id,lead_id,source,attribution,updated_at FROM conversations WHERE JSON_CONTAINS(:p1,JSON_QUOTE(lead_id)) ORDER BY updated_at,id',[ids])).rows;
 const audits=(await pool.query("SELECT actor,data,created_at FROM portal_audit WHERE action='campaign.promotion.review' AND JSON_CONTAINS(:p1,JSON_QUOTE(JSON_UNQUOTE(JSON_EXTRACT(data,'$.leadId')))) ORDER BY id DESC",[ids])).rows;
 return candidates.map((r:any)=>({
  canReview,leadId:r.id,name:r.profile.fullName||r.profile.name||r.id,rawCode:r.rawCampaign,rawPromotionLinkId:r.originalP,
  campaignId:r.campaign.id,campaignCode:r.campaign.code,campaignName:r.campaign.name,
  links:r.campaign.promotionLinks||[],status:r.current?.status||'pending',revision:r.current?.revision||0,
  resolution:r.current||null,
  evidence:campaignSourceEvidence(r.profile,entries.filter((e:any)=>e.lead_id===r.id),r.rawCampaign),
  history:audits.filter((a:any)=>a.data.leadId===r.id).slice(0,20).map((a:any)=>({actor:a.actor,at:a.created_at,...a.data})),
 }));
}
const fingerprint=(leadId:string,b:any)=>crypto.createHash('sha256').update(JSON.stringify([leadId,b.action,b.reason,b.revision,b.campaignId,b.rawCode,b.rawPromotionLinkId,b.linkId,b.entry])).digest('hex');
export async function promotionReviewResult(leadId:string,requestId:string,employee:any){
 permitted(employee);const lead=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0]?.profile;if(!lead)fail(404,'Customer not found.');permitted(employee,lead);
 const row=(await pool.query("SELECT data FROM portal_audit WHERE actor=:p1 AND action='campaign.promotion.review' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",[employee.id,requestId])).rows[0];
 if(!row||row.data.leadId!==leadId)fail(404,'No confirmed result for this request.');return row.data.result;
}
export async function reviewPromotion(leadId:string,b:any,employee:any){
 permitted(employee);b=b||{};
 if(!['link','create','defer','invalid'].includes(b.action)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000||typeof b.requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(b.requestId)||!Number.isSafeInteger(b.revision)||b.revision<0)fail(400,'Choose an action and provide a review reason.');
 const hash=fingerprint(leadId,b);
 return tx(async(db:any)=>{
  await assertSourceAttributionReviewer(db,employee);
  const row=(await db.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[leadId])).rows[0];if(!row)fail(404,'Customer not found.');permitted(employee,row.profile);
  const prior=(await db.query("SELECT data FROM portal_audit WHERE actor=:p1 AND action='campaign.promotion.review' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",[employee.id,b.requestId])).rows[0]?.data;
  if(prior){if(prior.fingerprint!==hash)fail(409,'Request ID already used with different input.');return prior.result;}
  const {campaigns,reviews}=await catalogs(db);const c=context(row.profile,campaigns,reviews);
  if(!c)fail(409,'This source no longer needs promotion review. Refresh the list.');
  if(b.rawCode!==c.rawCampaign||b.rawPromotionLinkId!==c.originalP||b.campaignId!==c.campaign.id||(c.current?.revision||0)!==b.revision)fail(409,'Source or review changed. Refresh before saving.');
  let selected:any=null;
  if(b.action==='link'||b.action==='create'){
   const target=(await db.query('SELECT config FROM trial_campaigns WHERE id=:p1 FOR UPDATE',[c.campaign.id])).rows[0]?.config;if(!target)fail(409,'Campaign unavailable.');
   if(b.action==='link'){
    selected=target.promotionLinks?.find((link:any)=>link.id===b.linkId);if(!selected)fail(400,'Choose a promotion entry belonging to this campaign.');
   }else{
    assertEditableCampaign({...target,id:c.campaign.id});
    const values=promotionInput(b.entry||{});selected={id:'p_'+crypto.randomUUID().replaceAll('-',''),...values,createdAt:new Date().toISOString()};
    await db.query('UPDATE trial_campaigns SET config=:p2 WHERE id=:p1',[c.campaign.id,{...target,promotionModel:'multiple',promotionLinks:[...(target.promotionLinks||[]),selected],updatedAt:selected.createdAt}]);
   }
  }
  const status=b.action==='defer'?'deferred':b.action==='invalid'?'invalid':'linked';
  const resolution={status,revision:b.revision+1,rawCampaignCode:c.rawCampaign,rawPromotionLinkId:c.originalP,campaignId:c.campaign.id,linkId:selected?.id||null,snapshot:selected?{...selected}:null,actor:employee.id,at:new Date().toISOString(),reason:b.reason.trim(),scope:'this_customer_only'};
  // The original c/p, saved first-touch fields and all sales/notification data remain untouched.
  await db.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,{...row.profile,promotionReview:resolution}]);
  const result={leadId,...resolution,createdLink:b.action==='create',requestId:b.requestId};
  await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.promotion.review',:p2)",[employee.id,{leadId,requestId:b.requestId,fingerprint:hash,action:b.action,before:c.current||null,after:resolution,result}]);
  return result;
 });
}
