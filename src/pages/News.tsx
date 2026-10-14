import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ArrowRight, Newspaper, Search, X } from 'lucide-react';
import { Link, useNavigationType } from 'react-router-dom';
import { client } from '../sanityClient';
import imageUrlBuilder from '../sanityClient';
import { Skeleton } from '../components/ui/Skeleton';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/SEO';
import { useDesignStyle } from '../utils/theme';

const builder = imageUrlBuilder(client);
function urlFor(source: any) {
  try {
    if (!source) {
      const emptyHelper: any = {
        width: () => emptyHelper,
        height: () => emptyHelper,
        fit: () => emptyHelper,
        auto: () => emptyHelper,
        url: () => ''
      };
      return emptyHelper;
    }
    if (typeof source === 'string') {
      const stringHelper: any = {
        width: () => stringHelper,
        height: () => stringHelper,
        fit: () => stringHelper,
        auto: () => stringHelper,
        url: () => source
      };
      return stringHelper;
    }
    if (!source.asset || !source.asset._ref) {
      const emptyHelper: any = {
        width: () => emptyHelper,
        height: () => emptyHelper,
        fit: () => emptyHelper,
        auto: () => emptyHelper,
        url: () => ''
      };
      return emptyHelper;
    }
    return builder.image(source);
  } catch (e) {
    const emptyHelper: any = {
      width: () => emptyHelper,
      height: () => emptyHelper,
      fit: () => emptyHelper,
      auto: () => emptyHelper,
      url: () => ''
    };
    return emptyHelper;
  }
}

const BannerCarousel = ({ carouselItems, isLoading, fallbackTitle, fallbackSubtitle }: { carouselItems: any[], isLoading: boolean, fallbackTitle: string, fallbackSubtitle: string }) => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!carouselItems || carouselItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselItems]);

  if (isLoading) {
    return (
      <div className="pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden bg-slate-950 rounded-[2.5rem] shadow-2xl flex flex-col justify-center items-center p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-pulse" />
          <div className="relative z-10 flex flex-col items-center max-w-2xl w-full text-center">
            <div className="h-10 md:h-12 w-3/4 bg-white/10 rounded-2xl mb-6 animate-pulse" />
            <div className="h-6 w-1/2 bg-white/5 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!carouselItems || carouselItems.length === 0) {
    return (
      <div className="pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden bg-slate-950 rounded-[2.5rem] shadow-2xl flex flex-col justify-center items-center p-8 text-center">
          <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200')` }} />
          <div className="absolute inset-0 bg-black/40 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
          <div className="relative z-10 max-w-4xl px-4 text-white">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight drop-shadow-lg text-white">
              {fallbackTitle}
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto drop-shadow-md">
              {fallbackSubtitle}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden bg-slate-900 rounded-[2.5rem] shadow-2xl">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img 
              src={urlFor(carouselItems[currentIndex]?.image)?.width(2000).url() || ''} 
              alt="Carousel Banner" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/20 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0 flex flex-col justify-center items-center z-10">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-center text-white px-4 max-w-4xl"
            >
              {/* Treat the last word of title as gradient for styling */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight drop-shadow-lg text-white">
                {carouselItems[currentIndex]?.title ? carouselItems[currentIndex].title.split(' ').map((word: string, i: number, arr: string[]) => 
                   i === arr.length - 1 ? <span key={i} className="text-gradient"> {word}</span> : word + ' '
                ) : fallbackTitle}
              </h1>
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto drop-shadow-md">
                {carouselItems[currentIndex]?.subtitle || fallbackSubtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {carouselItems.length > 1 && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20">
            {carouselItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-white' : 'w-4 bg-white/40 hover:bg-white/60'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FALLBACK_NEWS = [];

const FALLBACK_NEWS_PAGE = [];

export default function News() {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const navigationType = useNavigationType();

  const [news, setNews] = useState<any[]>([]);
  const [pageSettingsDocs, setPageSettingsDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Restore search query if it was a POP navigation (browser back or navigate(-1))
  const [searchQuery, setSearchQuery] = useState(() => {
    if (navigationType === 'POP') {
      return sessionStorage.getItem('news_searchQuery') || '';
    }
    return '';
  });

  const isRestoringRef = useRef(navigationType === 'POP');

  // Track scroll position in sessionStorage
  useEffect(() => {
    const handleScroll = () => {
      if (!isRestoringRef.current && window.location.pathname === '/news') {
        sessionStorage.setItem('news_scrollY', window.scrollY.toString());
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intercept user-initiated scrolling to abort auto-scrolling
  useEffect(() => {
    const abortRestoration = () => {
      isRestoringRef.current = false;
    };
    window.addEventListener('wheel', abortRestoration, { passive: true });
    window.addEventListener('touchstart', abortRestoration, { passive: true });
    window.addEventListener('keydown', abortRestoration, { passive: true });
    window.addEventListener('mousedown', abortRestoration, { passive: true });
    return () => {
      window.removeEventListener('wheel', abortRestoration);
      window.removeEventListener('touchstart', abortRestoration);
      window.removeEventListener('keydown', abortRestoration);
      window.removeEventListener('mousedown', abortRestoration);
    };
  }, []);

  // Save searchQuery changes
  useEffect(() => {
    sessionStorage.setItem('news_searchQuery', searchQuery);
  }, [searchQuery]);

  // Handle scroll restoration when loading is finished
  useEffect(() => {
    if (navigationType !== 'POP') {
      isRestoringRef.current = false;
      return;
    }

    if (!isLoading) {
      const savedScrollY = sessionStorage.getItem('news_scrollY');
      if (savedScrollY) {
        const targetY = parseInt(savedScrollY, 10);
        if (targetY <= 0) {
          isRestoringRef.current = false;
          return;
        }

        let attempts = 0;
        const maxAttempts = 30; // 3 seconds maximum at 100ms interval
        
        const tryScroll = () => {
          if (!isRestoringRef.current) return; // Aborted by user action
          
          const scrollHeight = document.documentElement.scrollHeight;
          const clientHeight = document.documentElement.clientHeight;
          const maxPossibleScroll = scrollHeight - clientHeight;
          const currentTarget = Math.min(targetY, maxPossibleScroll);
          
          window.scrollTo({ top: currentTarget, behavior: 'instant' as any });
          
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(tryScroll, 100);
          } else {
            isRestoringRef.current = false;
          }
        };

        tryScroll();
      } else {
        isRestoringRef.current = false;
      }
    }
  }, [isLoading, navigationType]);

  // Reset states on fresh navigation (PUSH)
  useEffect(() => {
    if (navigationType === 'PUSH') {
      sessionStorage.removeItem('news_searchQuery');
      sessionStorage.removeItem('news_scrollY');
      setSearchQuery('');
      isRestoringRef.current = false;
    }
  }, [navigationType]);

  const hotSearchTags = [
    { id: 'all', query: '', labelKey: 'news.tagAll', default: 'All Topics' },
    { id: 'china', query: 'China & STEM', labelKey: 'news.tagChina', default: 'China & STEM' },
    { id: 'scholarship', query: 'scholarship', labelKey: 'news.tagScholarship', default: 'Scholarships' },
    { id: 'mandarin', query: 'Mandarin', labelKey: 'news.tagMandarin', default: 'Mandarin' },
    { id: 'muhammadiyah', query: 'Muhammadiyah', labelKey: 'news.tagMuhammadiyah', default: 'Muhammadiyah' },
    { id: 'forum', query: 'Forums & Summits', labelKey: 'news.tagForum', default: 'Forums & Summits' }
  ];

  useEffect(() => {
    Promise.all([
      client.fetch(`*[_type == "news"] | order(publishedAt desc)`),
      client.fetch(`*[_type == "newsPage"] | order(order asc)`)
    ]).then(([newsData, pageData]) => {
      const validNews = (newsData || []).filter(Boolean);
      const validPage = (pageData || []).filter(Boolean);
      setNews(validNews.length > 0 ? validNews : FALLBACK_NEWS);
      setPageSettingsDocs(validPage.length > 0 ? validPage : FALLBACK_NEWS_PAGE);
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to fetch news data:', err);
      setNews(FALLBACK_NEWS);
      setPageSettingsDocs(FALLBACK_NEWS_PAGE);
      setIsLoading(false);
    });
  }, []);

  const filteredNews = news.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    // Split the query into distinct search terms
    const rawTerms = query
      .split(/[\s&|+,]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    if (rawTerms.length === 0) return true;

    // Filter out common stopwords ONLY if there are other, more specific terms
    const hasLongTerms = rawTerms.some(t => t.length > 2);
    const terms = rawTerms.filter(t => {
      if (hasLongTerms && (
        t === 'and' || t === 'or' || t === 'in' || t === 'at' || t === 'to' || 
        t === 'of' || t === 'dan' || t === 'di' || t === 'ke' || t === 'yang' ||
        t === 'with' || t === 'by' || t === 'for' || t === 'on' || t === 'the' || t === 'a' || t === 'an'
      )) {
        return false;
      }
      return true;
    });

    if (terms.length === 0) return true;

    // Verify if ALL search terms can be found somewhere in the news item (title, excerpt, or keywords)
    return terms.every(term => {
      // Check if this term matches the title
      if (item.title?.toLowerCase().includes(term)) return true;
      
      // Check if this term matches the excerpt
      if (item.excerpt?.toLowerCase().includes(term)) return true;
      
      // Check if this term matches the keywords
      if (Array.isArray(item.keywords)) {
        if (item.keywords.some((kw: string) => kw?.toLowerCase().includes(term))) return true;
      } else if (typeof item.keywords === 'string') {
        if (item.keywords.toLowerCase().includes(term)) return true;
      }
      
      // Stemming fallback for plural English terms ending with 's'
      if (term.endsWith('s') && term.length > 3) {
        const singular = term.slice(0, -1);
        if (item.title?.toLowerCase().includes(singular)) return true;
        if (item.excerpt?.toLowerCase().includes(singular)) return true;
        if (Array.isArray(item.keywords)) {
          if (item.keywords.some((kw: string) => kw?.toLowerCase().includes(singular))) return true;
        } else if (typeof item.keywords === 'string') {
          if (item.keywords.toLowerCase().includes(singular)) return true;
        }
      }
      
      return false;
    });
  });

  // Map the newsPage documents to carousel format
  const carouselItems = pageSettingsDocs.map(doc => ({
    image: doc.coverImage,
    title: doc.title,
    subtitle: doc.subtitle
  })).filter(item => item.image); // Only include those with an image

  // Remove early return to prevent blank page; fallbacks are now handled in the fetch effect


  return (
    <div className="pb-16 min-h-screen">
      <SEO 
        title={t('meta.news.title', 'News & Insights')} 
        description={t('meta.news.description', 'Latest company news, press releases, and educational insights from UPER.')} 
      />
      
      {/* Page Header */}
      <div className="pt-32 pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
          isApple 
            ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
            : 'bg-primary-50 border border-primary-100 text-primary-600'
        }`}>
          <Newspaper className="w-4 h-4" /> {t("news.tag", "News & Updates")}
        </div>
      </div>

      <BannerCarousel 
        carouselItems={carouselItems} 
        isLoading={isLoading}
        fallbackTitle={pageSettingsDocs[0]?.title || t("news.defaultTitle", "Latest News & Insights")}
        fallbackSubtitle={pageSettingsDocs[0]?.subtitle || t("news.defaultSubtitle", "Stay updated with UPER and global education trends.")}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {/* Search Bar Section */}
        {!isLoading && news.length > 0 && (
          <div className="max-w-6xl mx-auto mb-12 relative z-10 w-full">
            <div className="relative group mb-4 max-w-xl mx-auto">
              <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:transition-colors ${
                isApple ? 'group-focus-within:text-slate-800' : 'group-focus-within:text-primary-500'
              }`}>
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("news.searchPlaceholder", "Search articles by title or keywords...")}
                className={`w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 text-slate-800 placeholder-slate-400 transition-all text-sm font-medium hover:border-slate-300 ${
                  isApple 
                    ? 'focus:ring-slate-800/10 focus:border-slate-800' 
                    : 'focus:ring-primary-500/20 focus:border-primary-500'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4 bg-slate-100 hover:bg-slate-200 p-0.5 rounded-full" />
                </button>
              )}
            </div>

            {/* Recommended/Popular Quick Search Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 w-full px-2">
              {hotSearchTags.map((tag) => {
                const isActive = tag.query === ''
                  ? searchQuery === ''
                  : searchQuery.toLowerCase().trim() === tag.query.toLowerCase();

                return (
                  <button
                    key={tag.id}
                    onClick={() => setSearchQuery(tag.query)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer scale-100 active:scale-95 flex-shrink-0 ${
                      isActive
                        ? (isApple 
                            ? "bg-slate-900 text-white shadow-sm shadow-slate-900/10 border border-slate-900" 
                            : "bg-primary-600 text-white shadow-sm shadow-primary-600/15 border border-primary-600")
                        : "bg-white text-slate-600 hover:text-slate-800 border border-slate-100 hover:border-slate-200 hover:bg-slate-50 shadow-sm"
                    }`}
                  >
                    {t(tag.labelKey, tag.default)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <Skeleton className="w-full aspect-[4/3] rounded-none" />
                <div className="p-6">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          (import.meta as any).env.DEV ? (
            <div className="py-12 bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 rounded-3xl p-8 text-center max-w-2xl mx-auto">
              <h3 className="font-bold text-lg mb-2">🔧 [DEV MODE] No News Articles Found</h3>
              <p className="text-sm opacity-90">
                This news listing is empty because no articles were fetched from Sanity.
                Ensure you have created and published documents of type <code>news</code> in your Sanity Studio.
              </p>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">{t("news.noNews", "No news articles found.")}</div>
          )
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto px-6 relative overflow-hidden">
            {/* Elegant Background Accents */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-primary-50/20 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div className="mb-6 relative h-36 w-full flex items-center justify-center overflow-hidden">
              {/* Animated Floating Searching Illustration */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
              >
                <svg width="180" height="120" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-auto h-32">
                  {/* Background Soft Glow Circular Accents */}
                  <circle cx="90" cy="62" r="40" fill="url(#circleGlow)" className="opacity-60" />
                  
                  {/* Document Graphic with lines */}
                  <motion.g 
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  >
                    <rect x="65" y="25" width="50" height="66" rx="8" fill="white" stroke="#E2E8F0" strokeWidth="2" />
                    {/* Folded Corner */}
                    <path d="M103 25 L115 37 L107 37 C104.79 37 103 35.21 103 33 Z" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1.5" />
                    {/* Mock Texts */}
                    <line x1="75" y1="42" x2="95" y2="42" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="75" y1="52" x2="105" y2="52" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="75" y1="62" x2="90" y2="62" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="75" y1="72" x2="101" y2="72" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
                  </motion.g>

                  {/* Animated Magnifying Glass scanning */}
                  <motion.g
                    animate={{ 
                      x: [0, 15, -15, 0],
                      y: [0, -10, 5, 0],
                      rotate: [0, 8, -8, 0]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 6, 
                      ease: "easeInOut" 
                    }}
                  >
                    {/* Magnifying Glass Body */}
                    <circle cx="110" cy="70" r="18" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="3" />
                    <circle cx="110" cy="70" r="14" fill="url(#lensGlass)" className="opacity-30" />
                    {/* Handle */}
                    <line x1="123" y1="83" x2="140" y2="100" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
                    {/* Inner Sparkle Accent */}
                    <motion.circle 
                      cx="110" 
                      cy="70" 
                      r="1" 
                      fill="#3B82F6"
                      animate={{ scale: [1, 2, 1], opacity: [0.3, 0.8, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  </motion.g>

                  {/* Tiny floating clouds/sparkles */}
                  <motion.circle cx="45" cy="40" r="3" fill="#93C5FD" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3, delay: 0.5 }} />
                  <motion.circle cx="135" cy="35" r="4" fill="#FED7AA" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.5, delay: 1 }} />
                  <motion.polygon points="145,55 147,51 151,50 147,49 145,45 143,49 139,50 143,51" fill="#FCD34D" animate={{ scale: [0.8, 1.2, 0.8], rotate: [0, 180, 360] }} transition={{ repeat: Infinity, duration: 4 }} />

                  {/* SVG Gradients definition */}
                  <defs>
                    <radialGradient id="circleGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#EFF6FF" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="lensGlass" x1="96" y1="56" x2="124" y2="84">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-2 px-2 max-w-md mx-auto leading-snug">
              {t("news.noResults", "No articles found matching your criteria")}
            </h3>
            <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed px-4">
              {t("news.noResultsDesc", "Please refine your keywords, clear the search, or choose one of the popular search tags above.")}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all cursor-pointer shadow-md hover:shadow-lg duration-150 ${
                  isApple 
                    ? 'bg-slate-900 hover:bg-slate-800' 
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                <X className="w-4 h-4" />
                {t("news.clearSearch", "Clear Search")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {filteredNews.map((item, idx) => (
              <motion.div 
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group cursor-pointer bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link to={`/news/${item.slug?.current || ''}`} className="block h-full">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img 
                      src={(() => {
                        const imgToUse = (item.images && item.images.length > 0) ? item.images[0] : item.image;
                        return imgToUse ? urlFor(imgToUse)?.width(800).url() : null;
                      })() || "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=800"} 
                      alt={item.title} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                      <Calendar className="w-4 h-4" />
                      <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                    </div>
                    <h3 className={`text-xl font-bold text-slate-900 leading-snug transition-colors line-clamp-2 mb-3 ${
                      isApple ? 'group-hover:text-slate-950' : 'group-hover:text-primary-600'
                    }`}>
                      {item.title}
                    </h3>
                    <p className="text-slate-600 line-clamp-3 mb-4">
                      {item.excerpt}
                    </p>
                    <div className={`flex items-center gap-2 font-semibold text-sm transition-colors ${
                      isApple ? 'text-slate-900 hover:text-slate-950' : 'text-primary-600 hover:text-primary-700'
                    }`}>
                      {t("news.readMore", "Read More")} <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
