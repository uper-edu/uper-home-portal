export function matchesCampaign(
  lead: { campaign?: string; campaignId?: string; attributionCampaignId?: string; campaignSourceStatus?: string; promotionReview?: {status: string; campaignId: string | null} },
  campaign: { id: string; code: string; name: string; nameEn?: string },
) {
  if (lead.promotionReview?.status === 'linked') return lead.promotionReview.campaignId === campaign.id;
  if(lead.campaignSourceStatus==='invalid'||(lead.campaignSourceStatus==='pending'&&!lead.attributionCampaignId))return false;
  const value = (lead.attributionCampaignId || lead.campaignId || lead.campaign || "").trim().toLowerCase();
  return (
    !!value &&
    [
      campaign.id,
      campaign.code,
      ...(lead.campaignId ? [] : [campaign.name, campaign.nameEn]),
    ].some((v) => v?.trim().toLowerCase() === value)
  );
}
