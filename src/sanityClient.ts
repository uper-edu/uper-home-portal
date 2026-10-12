import admissionsListJson from './data/content/admissionsList.json';
import campaignsJson from './data/content/campaigns.json';
import newsJson from './data/content/news.json';
import newsPageJson from './data/content/newsPage.json';
import partnersJson from './data/content/partners.json';
import studentStoriesJson from './data/content/studentStories.json';
import trendingProgramsJson from './data/content/trendingPrograms.json';

/**
 * High-performance, zero-dependency Content Client
 * Replaces external Sanity API with instant local in-memory data
 */
export const client = {
  projectId: 'xtbhepdi',
  dataset: 'production',
  async fetch<R = any>(query: string, params?: any): Promise<R> {
    const q = query.toLowerCase();

    // 1. Admissions List
    if (q.includes('admissionslist')) {
      return (admissionsListJson as unknown) as R;
    }

    // 2. Campaigns
    if (q.includes('campaign')) {
      const campaigns = campaignsJson as any[];
      if (params?.slug || q.includes('slug.current')) {
        const targetSlug = params?.slug;
        const found = campaigns.find(c => c.slug?.current === targetSlug || c.slug === targetSlug);
        return (found || campaigns[0] || null) as unknown as R;
      }
      if (q.includes('isactive == true')) {
        return (campaigns.filter(c => c.isActive !== false)) as unknown as R;
      }
      return (campaigns as unknown) as R;
    }

    // 3. News Pages Config
    if (q.includes('newspage')) {
      const sorted = [...(newsPageJson as any[])].sort((a, b) => (a.order || 0) - (b.order || 0));
      return (sorted as unknown) as R;
    }

    // 4. News Articles
    if (q.includes('news')) {
      const allNews = newsJson as any[];
      // Single article query by slug: *[_type == "news" && slug.current == $slug][0]
      if (params?.slug || q.includes('slug.current')) {
        const targetSlug = params?.slug;
        const found = allNews.find(n => n.slug?.current === targetSlug || n.slug === targetSlug);
        return (found || null) as unknown as R;
      }

      // Check for limit: [0...8]
      const limitMatch = query.match(/\[0\.\.\.(\d+)\]/);
      if (limitMatch) {
        const count = parseInt(limitMatch[1], 10);
        return (allNews.slice(0, count) as unknown) as R;
      }

      return (allNews as unknown) as R;
    }

    // 5. Partners
    if (q.includes('partner')) {
      let partners = partnersJson as any[];
      if (q.includes('isactive == true')) {
        partners = partners.filter(p => p.isActive !== false);
      }
      return (partners as unknown) as R;
    }

    // 6. Student Stories
    if (q.includes('studentstory')) {
      const stories = studentStoriesJson as any[];
      const limitMatch = query.match(/\[0\.\.\.(\d+)\]/);
      if (limitMatch) {
        const count = parseInt(limitMatch[1], 10);
        return (stories.slice(0, count) as unknown) as R;
      }
      return (stories as unknown) as R;
    }

    // 7. Trending Programs
    if (q.includes('trendingprogram')) {
      let programs = trendingProgramsJson as any[];
      if (q.includes('isactive == true')) {
        programs = programs.filter(p => p.isActive !== false);
      }
      return (programs as unknown) as R;
    }

    console.warn('[CONTENT CLIENT] Unmatched query pattern:', query);
    return ([] as unknown) as R;
  }
};

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
