import {contentStatus} from './components/CmsContentStatus';
/** MySQL CMS reads are authoritative; never fall back to stale compiled content. */
export const client={projectId:'local',dataset:'mysql',async fetch<R=any>(query:string,params?:any):Promise<R>{
 try{
 const response=await fetch('/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,params}),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Content unavailable');contentStatus(query,false);return data.result as R;
 }catch(error){contentStatus(query,true);throw error;}
}};
/**
 * Pure TypeScript drop-in replacement for Sanity Image URL Builder
 * Converts any image source/ref to high-speed CDN or static asset URL
 */
export function urlFor(source: any) {
  let rawUrl = '';
  if (!source) {
    rawUrl = '';
  } else if (typeof source === 'string') {
    rawUrl = source;
  } else if (source.url) {
    rawUrl = source.url;
  } else if (source.asset?.url) {
    rawUrl = source.asset.url;
  } else if (source.asset?._ref) {
    const ref: string = source.asset._ref;
    // Format: image-<hash>-<width>x<height>-<ext>
    const parts = ref.split('-');
    if (parts.length >= 4) {
      const hash = parts[1];
      const dimensions = parts[2];
      const ext = parts[3];
      rawUrl = `https://cdn.sanity.io/images/xtbhepdi/production/${hash}-${dimensions}.${ext}`;
    }
  }

  const helper: any = {
    width: (w: number) => {
      if (rawUrl && !rawUrl.includes('w=')) {
        rawUrl += (rawUrl.includes('?') ? '&' : '?') + `w=${w}`;
      }
      return helper;
    },
    height: (h: number) => {
      if (rawUrl && !rawUrl.includes('h=')) {
        rawUrl += (rawUrl.includes('?') ? '&' : '?') + `h=${h}`;
      }
      return helper;
    },
    fit: () => helper,
    auto: () => {
      if (rawUrl && !rawUrl.includes('auto=')) {
        rawUrl += (rawUrl.includes('?') ? '&' : '?') + `auto=format`;
      }
      return helper;
    },
    quality: (q: number) => {
      if (rawUrl && !rawUrl.includes('q=')) {
        rawUrl += (rawUrl.includes('?') ? '&' : '?') + `q=${q}`;
      }
      return helper;
    },
    url: () => rawUrl || ''
  };

  return helper;
}

/**
 * Universal Image URL Optimizer
 */
export function optimizeImageUrl(url?: string, width: number = 800): string {
  if (!url) return '';
  if (url.includes('cdn.sanity.io')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}auto=format&q=82&w=${width}`;
  }
  return url;
}

/**
 * Drop-in stub for imageUrlBuilder(client)
 */
export default function imageUrlBuilder(_client?: any) {
  return {
    image: (source: any) => urlFor(source)
  };
}
