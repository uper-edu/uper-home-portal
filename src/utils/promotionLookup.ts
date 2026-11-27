import { promotionIdentity, promotionLandingPaths, promotionCodePattern, type PublicPromotion } from './promotionNavigation';
import { canonicalCampaignPromotionId } from './threadsPromotion';

type Lookup = { state: 'verified'; promotion: PublicPromotion } | { state: 'unverified' | 'unavailable' };
type CacheEntry = { lookup: Lookup | Promise<Lookup>; retryAfter?: number; timedOut?: boolean; offline?: boolean; languageRetry?: Promise<Lookup> };
const cache = new Map<string, CacheEntry>();
const failedLookupCooldownMs = 3000;
const validCode = (value:unknown) => typeof value==='string' && promotionCodePattern.test(value);

function requestPromotion(p:string, timeout:number, onTimeout?:()=>void):Promise<Lookup> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<Lookup>(resolve => {
    timer = setTimeout(() => {
      onTimeout?.();
      abort.abort();
      resolve({ state: 'unavailable' });
    }, timeout);
  });
  const request = (async (): Promise<Lookup> => {
    try {
      const response = await fetch('/api/promotion-links/' + encodeURIComponent(p), {
        signal: abort.signal,
      });
      if (response.status === 404 || response.status === 400) return { state: 'unverified' };
      if (!response.ok) return { state: 'unavailable' };
      const { promotion } = await response.json() as { promotion: PublicPromotion };
      if (promotion?.id === canonicalCampaignPromotionId(promotion?.campaignId,p) && promotionLandingPaths.includes(promotion.landingPath)
        && typeof promotion.campaignId==='string' && promotion.campaignId.trim()
        && validCode(promotion.source) && validCode(promotion.medium) && validCode(promotion.campaignCode)
        && ['unpaid','paid','unclassified'].includes(promotion.promotionKind)
        && ['en', 'id', 'zh'].includes(promotion.language)) {
        return { state: 'verified', promotion };
      }
      return { state: 'unavailable' };
    } catch {
      return { state: 'unavailable' };
    }
  })();
  return Promise.race([request, deadline]).finally(() => clearTimeout(timer));
}

export function lookupPromotion(params: URLSearchParams): Lookup | Promise<Lookup> | undefined {
  const {p,invalid}=promotionIdentity(params);
  if (invalid) return {state:'unverified'};
  if (!p) return;
  const offline=globalThis.navigator?.onLine===false;
  const previous=cache.get(p);
  if (previous&&(previous.languageRetry||previous.retryAfter===undefined||
    (previous.offline ? offline : performance.now()<previous.retryAfter))) return previous.lookup;
  if (previous) cache.delete(p);
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  if(offline){
    const lookup:Lookup={state:'unavailable'};
    cache.set(p,{lookup,offline:true,retryAfter:0});
    return lookup;
  }
  let timedOut=false;
  const lookup=requestPromotion(p,1500,()=>{timedOut=true;});
  const entry:CacheEntry={lookup};
  cache.set(p,entry);
  void lookup.then(result => {
    // A slow or offline lookup should not suppress attribution for the rest of the visit.
    entry.lookup=result;
    entry.timedOut=timedOut;
    entry.retryAfter=result.state==='unavailable'?performance.now()+failedLookupCooldownMs:undefined;
  });
  return lookup;
}

function retryPromotionLanguage(p:string,entry:CacheEntry) {
  if (entry.languageRetry) return entry.languageRetry;
  if (entry.lookup instanceof Promise || entry.lookup.state!=='unavailable') return Promise.resolve(entry.lookup);
  entry.offline=false;
  entry.timedOut=false;
  // Analytics keeps its short deadline. Only the language selector waits for this retry.
  entry.languageRetry=requestPromotion(p,5000).then(result=>{
    entry.languageRetry=undefined;
    entry.lookup=result;
    entry.retryAfter=result.state==='unavailable'?performance.now()+failedLookupCooldownMs:undefined;
    return result;
  });
  return entry.languageRetry;
}

/** A timed-out language lookup can recover on slow connections without blocking navigation. */
export function watchPromotionLanguage(params:URLSearchParams, onLanguage:(language:PublicPromotion['language'])=>void) {
  const {p,invalid}=promotionIdentity(params);
  if (!p||invalid) return;
  let active=true;
  let reconnected=false;
  let unavailable=false;
  let retried=false;
  const stopWatching=()=>window.removeEventListener('online',onOnline);
  const recover=()=>{
    if (!active||retried||!unavailable||navigator.onLine===false) return;
    const entry=cache.get(p);
    if (!entry||(!reconnected&&!entry.languageRetry&&!entry.timedOut)) return;
    retried=true;
    stopWatching();
    void retryPromotionLanguage(p,entry).then(apply);
  };
  const onOnline=()=>{reconnected=true;recover();};
  const apply=(result:Lookup|undefined)=>{
    if (active&&result?.state==='verified') onLanguage(result.promotion.language);
  };
  window.addEventListener('online',onOnline);
  void Promise.resolve(lookupPromotion(params)).then(result=>{
    if (!active) return;
    unavailable=result?.state==='unavailable';
    if (unavailable) recover();
    else { stopWatching(); apply(result); }
  });
  return ()=>{active=false;stopWatching();};
}
