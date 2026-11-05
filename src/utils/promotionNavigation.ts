import evergreenLinks from '../data/evergreenPromotionLinks.json';

export const promotionParameters = ['p', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'] as const;
export const promotionEvidenceKeys = ['p', 'lang', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'entry_point'] as const;
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
export function promotionIdentity(params: URLSearchParams) {
  const promotions = params.getAll('p');
  return {
    p: promotions[0] || undefined,
    invalid: promotions.length > 0 && (new Set(promotions).size > 1 || !promotionIdPattern.test(promotions[0])),
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

export function isWebsitePromotion(id: string) {
  return evergreenLinks.some(link => link.id === id && link.source === 'website');
}

export function websitePromotionUrl(target: '/link' | '/chat', input: URLSearchParams, entry: PromotionEntryPoint, language?: string) {
  const preset = evergreenLinks.find(link => link.source === 'website' && link.landingPath === target);
  const destination = !promotionIdentity(input).tagged && preset
    ? target + '?' + new URLSearchParams({p:preset.id, ...(/^(en|id|zh)(?:-|$)/i.test(language || '') ? {lang:language!.slice(0,2).toLowerCase()} : {})})
    : target;
  return promotionJourneyUrl(destination, input, entry);
}
