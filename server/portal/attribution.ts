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
