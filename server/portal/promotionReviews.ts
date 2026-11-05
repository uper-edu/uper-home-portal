import {canReviewSourceAttribution,assertSourceAttributionReviewer} from './crmAccessControls.ts';
import {auditLog} from './audit.ts';
import crypto from 'node:crypto';
import {pool,tx} from './store.ts';
import {allowed} from './identity.ts';
import {campaignSourceEvidence} from './campaignSourceEvidence.ts';
import {matchesCampaign} from '../../src/utils/crmCampaignLink.ts';
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
const permitted=(employee:any,profile?:any)=>{if(!employee||employee.active===false||!employee.permissions?.includes('campaigns.manage')||(profile&&!allowed(employee,profile)))fail(403,'Permission denied.');};
function reviewContext(profile: any) {
  if (profile.promotionLinkStatus !== 'unverified' && !profile.promotionReview) return null;
  const originalP = String(profile.rawPromotionLinkId ?? profile.promotionLinkId ?? '');
  const rawCampaign = String(profile.rawCampaignCode ??
    (profile.campaignSourceStatus === 'pending' ? '' : profile.campaignId || profile.campaign || ''));
  const current = profile.promotionReview ?? null;
  return { rawCampaign, originalP, current };
}

async function campaignCatalogue(db: any) {
  const { rows } = await db.query('SELECT id,code,config FROM trial_campaigns');
  return rows.map((row: any) => ({...row.config, id:row.id, code:row.code}));
}

export async function listPromotionReviews(employee:any){
 permitted(employee);const canReview=await canReviewSourceAttribution(pool,employee);const campaigns=await campaignCatalogue(pool);
 const candidates = (await pool.query('SELECT id,profile FROM portal_leads')).rows.flatMap((row: any) => {
  if (!allowed(employee, row.profile)) return [];
  const context = reviewContext(row.profile);
  if (!context) return [];
  const matchingCampaigns = campaigns.filter((campaign: any) => matchesCampaign(row.profile, campaign));
  const campaign = matchingCampaigns.length === 1 ? matchingCampaigns[0] : null;
  return [{...row, ...context, campaign}];
 });
 if(!candidates.length)return [];
 const ids=JSON.stringify(candidates.map((r:any)=>r.id));
 const entries=(await pool.query('SELECT id,lead_id,source,attribution,updated_at FROM conversations WHERE JSON_CONTAINS(:p1,JSON_QUOTE(lead_id)) ORDER BY updated_at,id',[ids])).rows;
 const audits=(await pool.query("SELECT actor,data,created_at FROM portal_audit WHERE action='campaign.promotion.review' AND JSON_CONTAINS(:p1,JSON_QUOTE(JSON_UNQUOTE(JSON_EXTRACT(data,'$.leadId')))) ORDER BY id DESC",[ids])).rows;
 return candidates.map((r:any)=>({
  canReview,leadId:r.id,name:r.profile.fullName||r.profile.name||r.id,rawCode:r.rawCampaign,rawPromotionLinkId:r.originalP,
  campaignId:r.campaign?.id ?? null,campaignName:r.campaign?.name ?? null,
  exception:r.profile.promotionException ?? 'unverified_p',status:r.current?.status||'pending',revision:r.current?.revision||0,
  resolution:r.current||null,
  evidence:campaignSourceEvidence(r.profile,entries.filter((e:any)=>e.lead_id===r.id),r.rawCampaign),
  history:audits.filter((a:any)=>a.data.leadId===r.id).slice(0,20).map((a:any)=>({actor:a.actor,at:a.created_at,...a.data})),
 }));
}
const fingerprint=(leadId:string,b:any)=>crypto.createHash('sha256').update(JSON.stringify([leadId,b.action,b.reason,b.revision,b.campaignId,b.rawCode,b.rawPromotionLinkId,b.linkId])).digest('hex');
export async function promotionReviewResult(leadId:string,requestId:string,employee:any){
 permitted(employee);const lead=(await pool.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0]?.profile;if(!lead)fail(404,'Customer not found.');permitted(employee,lead);
 const row=(await pool.query("SELECT data FROM portal_audit WHERE actor=:p1 AND action='campaign.promotion.review' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",[employee.id,requestId])).rows[0];
 if(!row||row.data.leadId!==leadId)fail(404,'No confirmed result for this request.');return row.data.result;
}
export async function reviewPromotion(leadId:string,b:any,employee:any){
 permitted(employee);b=b||{};
 if(!['link','campaign','defer','invalid'].includes(b.action)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000||typeof b.requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(b.requestId)||!Number.isSafeInteger(b.revision)||b.revision<0)fail(400,'Choose an action and provide a review reason.');
 const hash=fingerprint(leadId,b);
 return tx(async(db:any)=>{
  await assertSourceAttributionReviewer(db,employee);
  const row=(await db.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[leadId])).rows[0];if(!row)fail(404,'Customer not found.');permitted(employee,row.profile);
  const prior=(await db.query("SELECT data FROM portal_audit WHERE actor=:p1 AND action='campaign.promotion.review' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",[employee.id,b.requestId])).rows[0]?.data;
  if(prior){if(prior.fingerprint!==hash)fail(409,'Request ID already used with different input.');return prior.result;}
  const context = reviewContext(row.profile);
  if (!context) fail(409, 'This source no longer needs promotion review. Refresh the list.');
  if (b.rawCode !== context.rawCampaign || b.rawPromotionLinkId !== context.originalP
      || (context.current?.revision || 0) !== b.revision) {
   fail(409, 'Source or review changed. Refresh before saving.');
  }
  let target: any;
  let selected: any;
  if (b.action === 'link' || b.action === 'campaign') {
   if (typeof b.campaignId !== 'string' || !b.campaignId) fail(400, 'Choose a campaign.');
   const targetRow = (await db.query('SELECT id,code,config FROM trial_campaigns WHERE id=:p1 FOR UPDATE', [b.campaignId])).rows[0];
   if (!targetRow) fail(409, 'Campaign unavailable.');
   target = {...targetRow.config, id:targetRow.id, code:targetRow.code};
   if (b.action === 'link') {
    selected = target.promotionLinks?.find((link:any) => link.id === b.linkId);
    if (!selected) fail(400, 'Choose a promotion entry belonging to this campaign.');
   }
  }
  const status = b.action === 'defer' ? 'deferred' : b.action === 'invalid' ? 'invalid' : 'linked';
  const resolution = {
   status, revision:b.revision+1, rawCampaignCode:context.rawCampaign, rawPromotionLinkId:context.originalP,
   campaignId:target?.id ?? null, campaignName:target?.name, campaignCode:target?.code,
   linkId:selected?.id ?? null, snapshot:selected ?? null, actor:employee.id,
   at:new Date().toISOString(), reason:b.reason.trim(), scope:'this_customer_only',
  };
  // The original c/p, saved first-touch fields and all sales/notification data remain untouched.
  await db.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,{...row.profile,promotionReview:resolution}]);
  const result={leadId,...resolution,requestId:b.requestId};
  await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.promotion.review',:p2)",[employee.id,{leadId,requestId:b.requestId,fingerprint:hash,action:b.action,before:context.current,after:resolution,result}]);
  auditLog(employee.id,'campaign.promotion.review',{leadId,requestId:b.requestId});
  return result;
 });
}
