const threadsIds = new Map([
  ['threads-social-profile-bio-261110092327', 'bio-th'],
  ['threads-social-profile-bio-261110093006', 'chat-th'],
]);

const currentIds = new Set(threadsIds.values());

export function threadsPromotionId(id: string): string | undefined {
  return threadsIds.get(id) ?? (currentIds.has(id) ? id : undefined);
}

export function canonicalCampaignPromotionId(campaignId: string, id: string): string {
  return campaignId === 'social-bio' ? threadsPromotionId(id) ?? id : id;
}
