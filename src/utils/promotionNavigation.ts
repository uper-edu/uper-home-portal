export const promotionParameters = ['c', 'cid', 'campaign', 'p', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'] as const;
export const promotionLandingPaths = ['/chat', '/link', '/', '/hsk', '/csca', '/consultancy', '/tours'] as const;
export type PromotionLandingPath = typeof promotionLandingPaths[number];
export type PromotionKind = 'unpaid' | 'paid' | 'unclassified';
export type PublicPromotion = {
  id: string;
  campaignId: string;
  campaignCode: string;
  source: string;
  medium: string;
  promotionKind: PromotionKind;
  content?: string;
  landingPath: PromotionLandingPath;
  language: 'en' | 'id' | 'zh';
};

export const promotionIdPattern = /^[A-Za-z0-9_-]{1,100}$/;
export const promotionCodePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
export const promotionEntryPoints = ['linkhub', 'homepage_widget', 'website', 'direct'] as const;
export type PromotionEntryPoint = typeof promotionEntryPoints[number];
export function promotionEntryPoint(value: unknown): PromotionEntryPoint | undefined {
  return promotionEntryPoints.find(entry => entry === value);
}
export function promotionKindForMedium(medium: string): PromotionKind {
  if (medium === 'paid_social' || medium === 'cpc') return 'paid';
  return medium === 'social' ? 'unpaid' : 'unclassified';
}
declare const __UPER_PROMOTION_SHORT_LINKS__: boolean;
declare const __UPER_PROMOTION_BARE_INSTAGRAM__: boolean;
export const shortPromotionLinks = typeof __UPER_PROMOTION_SHORT_LINKS__ !== 'undefined' && __UPER_PROMOTION_SHORT_LINKS__;
export const bareInstagramFallback = typeof __UPER_PROMOTION_BARE_INSTAGRAM__ === 'undefined' || __UPER_PROMOTION_BARE_INSTAGRAM__;

export function promotionIdentity(params: URLSearchParams) {
  const campaigns = ['c', 'cid', 'campaign'].flatMap(key => params.getAll(key)).filter(Boolean);
  const promotions = params.getAll('p');
  return {
    campaign: campaigns[0] || undefined,
    p: promotions[0] || undefined,
    invalid: (promotions.length > 0 && (new Set(promotions).size > 1 || !promotionIdPattern.test(promotions[0])))
      || new Set(campaigns.map(value => value.toLowerCase())).size > 1,
    tagged: promotionParameters.some(key => params.has(key)),
  };
}

export function promotionJourneyUrl(target: string, input: URLSearchParams, entry?: PromotionEntryPoint) {
  const url = new URL(target, 'https://uperedu.com');
  for (const key of promotionParameters) {
    if (url.searchParams.has(key)) continue;
    for (const value of input.getAll(key)) url.searchParams.append(key, value);
  }
  if (entry) url.searchParams.set('entry_point', entry);
  else if (input.has('entry_point')) {
    const previous = promotionEntryPoint(input.get('entry_point'));
    if (previous) url.searchParams.set('entry_point', previous);
  }
  return url.pathname + url.search + url.hash;
}
