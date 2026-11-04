import {createHash} from 'node:crypto';
import {promotionIdPattern, promotionKindForMedium, promotionLandingPaths} from '../../src/utils/promotionNavigation.ts';
import {canonicalCampaignId} from '../../src/utils/organicCampaign.ts';
/** Marketing attribution is first-touch metadata, never an identity or permission grant. */
export function firstTouchAttribution(
  existing: Record<string, any>,
  input: Record<string, any>,
) {
  const result: Record<string, string> = {};
  const hasExistingCampaign=!!(existing.campaignId||existing.campaign);
  const incomingId=canonicalCampaignId(input.campaignId||input.campaign);
  for (const key of [
    "campaign",
    "campaignId",
    "placement",
    "hookType",
    "hookContext",
  ]) {
    if(key==='campaignId' && existing.campaign && !existing.campaignId)continue;
    const value = existing[key] || input[key];
    if (typeof value === "string" && value.trim())
      result[key] = value.trim().slice(0, key === "campaign" ? 200 : 100);
  }
  if(!hasExistingCampaign){result.campaignId=incomingId;if(incomingId==='organic')result.campaign='organic';}
  return result;
}

export const sourceKey = (code: string) =>
  createHash('sha256').update(code.trim().toLowerCase()).digest('hex');

export async function readCampaignAlias(db: any, code: string) {
  return (await db.query(
    "SELECT campaign_id FROM campaign_source_reviews WHERE id=:p1 AND status='linked'",
    [sourceKey(code)],
  )).rows[0]?.campaign_id || null;
}

async function campaignForCode(db: any, code: string) {
 if (!code || code.length > 191) return null;
 const alias = await readCampaignAlias(db, code);
 return (await db.query('SELECT id,code,config FROM trial_campaigns WHERE id=:p1 OR code=:p1', [alias || code])).rows[0] || null;
}

/** A supplied legacy campaign must agree with the globally indexed owner. */
export async function resolvePromotion(db: any, code: string, p: string) {
 if (!promotionIdPattern.test(p)) return null;
 const index = (await db.query('SELECT campaign_id FROM campaign_promotion_index WHERE p=:p1', [p])).rows[0];
 if (!index) return null;
 const row = (await db.query('SELECT id,code,config FROM trial_campaigns WHERE id=:p1', [index.campaign_id])).rows[0];
 if (!row || (code && (await campaignForCode(db, code))?.id !== row.id)) return null;
 const link = row.config?.promotionLinks?.find((item: any) => item.id === p);
 return link ? {campaign: {...row.config, id:row.id, code:row.code}, link} : null;
}

export function publicPromotion(resolved: NonNullable<Awaited<ReturnType<typeof resolvePromotion>>>) {
 const {campaign, link} = resolved;
 return {
  id: link.id, campaignId: campaign.id, campaignCode: campaign.code,
  source: link.source, medium: link.medium, promotionKind: link.promotionKind ?? promotionKindForMedium(link.medium),
  content: link.content,
  landingPath: promotionLandingPaths.find(path => path === link.landingPath) ?? '/chat',
  language: link.language,
 };
}

export async function promotionAttribution(db: any, existing: any, input: any) {
 // Preserve the original attribution as a unit, including an originally unrecorded p.
 if (existing.campaignId || existing.campaign || existing.promotionLinkStatus) return {};
 const rawCampaign = typeof input.campaignId === 'string' ? input.campaignId.trim() : '';
 const rawPromotion = typeof input.promotionLinkId === 'string' ? input.promotionLinkId.slice(0, 100) : '';
 if (input.promotionLinkId !== undefined || input.promotionParametersInvalid === true) {
  const resolved = input.promotionParametersInvalid !== true && typeof input.promotionLinkId === 'string'
    ? await resolvePromotion(db, rawCampaign, input.promotionLinkId) : null;
  if (!resolved) return {
   rawCampaignCode: rawCampaign.slice(0,191) || undefined, rawPromotionLinkId: rawPromotion || undefined,
   promotionLinkStatus:'unverified', placement:'unrecorded', entryPoint:'unverified_source',
   hookType:'hsk_assessment', hookContext:'website',
   ...(!rawCampaign ? {campaignSourceStatus:'pending'} : {}),
  };
  const {link, campaign} = resolved;
  return {
   campaignId:campaign.code, campaign:campaign.name, rawCampaignCode:rawCampaign || undefined,
   rawPromotionLinkId:rawPromotion, promotionLinkId:link.id, promotionLinkStatus:'verified',
   promotionSnapshot:{...link}, placement:link.medium, entryPoint:link.source, hookType:'hsk_assessment', hookContext:'website',
  };
 }
 if (!rawCampaign && typeof input.utmCampaign === 'string' && input.utmCampaign.length <= 191) {
  const campaign = await campaignForCode(db, canonicalCampaignId(input.utmCampaign));
  if (campaign) return {campaignId:campaign.code,campaign:campaign.config.name,rawCampaignCode:input.utmCampaign};
 }
 return {};
}
