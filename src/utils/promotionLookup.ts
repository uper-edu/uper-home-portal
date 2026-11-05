import { promotionIdentity, promotionLandingPaths, promotionCodePattern, type PublicPromotion } from './promotionNavigation';

type Lookup = { state: 'verified'; promotion: PublicPromotion } | { state: 'unverified' | 'unavailable' };
const cache = new Map<string, Lookup | Promise<Lookup>>();

export function lookupPromotion(params: URLSearchParams): Lookup | Promise<Lookup> | undefined {
  const { p, invalid } = promotionIdentity(params);
  if (invalid) return { state: 'unverified' };
  if (!p) return;
  const key = p;
  const previous = cache.get(key);
  if (previous) return previous;
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<Lookup>(resolve => {
    timer = setTimeout(() => {
      abort.abort();
      resolve({ state: 'unavailable' });
    }, 1500);
  });
  const request = (async (): Promise<Lookup> => {
    try {
      const response = await fetch('/api/promotion-links/' + encodeURIComponent(p), {
        signal: abort.signal,
      });
      if (response.status === 404 || response.status === 400) return { state: 'unverified' };
      if (!response.ok) return { state: 'unavailable' };
      const { promotion } = await response.json() as { promotion: PublicPromotion };
      if (promotion?.id === p && promotionLandingPaths.includes(promotion.landingPath)
        && promotionCodePattern.test(promotion.source) && promotionCodePattern.test(promotion.medium)
        && promotionCodePattern.test(promotion.campaignCode) && ['en', 'id', 'zh'].includes(promotion.language)) {
        return { state: 'verified', promotion };
      }
      return { state: 'unavailable' };
    } catch {
      return { state: 'unavailable' };
    }
  })();
  const lookup = Promise.race([request, deadline]).finally(() => clearTimeout(timer));
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(key, lookup);
  void lookup.then(result => { if (cache.get(key) === lookup) cache.set(key, result); });
  return lookup;
}
