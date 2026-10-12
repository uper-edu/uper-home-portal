import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigationType } from 'react-router-dom';
import { Search, ChevronDown, Check, HelpCircle, MessageCircle, ArrowRight, BookOpen, GraduationCap, Compass, DollarSign, Globe, Briefcase, HelpCircle as QuestionIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEO } from '../components/SEO';
import { Helmet } from 'react-helmet-async';
import { hskFaqsByLang } from '../data/hskFaqs';
import { cscaFaqsByLang } from '../data/cscaFaqs';
import { trackFAQExpand } from '../utils/analytics';
import { useDesignStyle } from '../utils/theme';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

// Helper to determine program tags for each question dynamically & robustly
export function getQuestionTags(item: FAQItem): string[] {
  const tags: string[] = [];
  const id = item.id || '';
  
  if (id.startsWith('hsk_')) {
    tags.push('HSK');
  } else if (id.startsWith('csca_')) {
    tags.push('CSCA');
  } else {
    tags.push('Study Abroad');
  }
  
  return tags;
}

export const getTagStyles = (tag: string, isApple?: boolean) => {
  if (isApple) {
    return 'bg-slate-100/80 text-slate-700 border border-slate-200/50 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/50';
  }
  switch (tag) {
    case 'HSK':
      return 'bg-blue-50/80 text-blue-600 border border-blue-100/60 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
    case 'CSCA':
      return 'bg-rose-50/80 text-rose-600 border border-rose-100/60 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';
    case 'Study Abroad':
      return 'bg-emerald-50/80 text-emerald-600 border border-emerald-100/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-200';
  }
};

export default function FAQ() {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramProgram = searchParams.get('program');
  const navigationType = useNavigationType();

  // Restore states if it was a POP navigation (browser back or navigate(-1))
  const [searchQuery, setSearchQuery] = useState(() => {
    if (navigationType === 'POP') {
      return sessionStorage.getItem('faq_searchQuery') || '';
    }
    return '';
  });

  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (navigationType === 'POP') {
      return sessionStorage.getItem('faq_selectedCategory') || 'all';
    }
    return 'all';
  });

  const [selectedProgram, setSelectedProgram] = useState(() => {
    if (paramProgram === 'HSK' || paramProgram === 'CSCA' || paramProgram === 'Study Abroad') {
      return paramProgram;
    }
    if (navigationType === 'POP') {
      return sessionStorage.getItem('faq_selectedProgram') || 'all';
    }
    return 'all';
  });

  const [openId, setOpenId] = useState<string | null>(() => {
    if (navigationType === 'POP') {
      const saved = sessionStorage.getItem('faq_openId');
      return saved !== null ? (saved === 'null' ? null : saved) : 'q1';
    }
    return 'q1';
  });

  const isRestoringRef = useRef(navigationType === 'POP');

  // Track scroll position in sessionStorage as user scrolls
  useEffect(() => {
    const handleScroll = () => {
      if (!isRestoringRef.current && window.location.pathname === '/faq') {
        sessionStorage.setItem('faq_scrollY', window.scrollY.toString());
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

  // Save states to sessionStorage when they change
  useEffect(() => {
    sessionStorage.setItem('faq_searchQuery', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem('faq_selectedCategory', selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    sessionStorage.setItem('faq_selectedProgram', selectedProgram);
  }, [selectedProgram]);

  useEffect(() => {
    sessionStorage.setItem('faq_openId', openId || 'null');
  }, [openId]);

  // Handle scroll restoration on POP, clear on PUSH
  useEffect(() => {
    if (navigationType === 'PUSH') {
      sessionStorage.removeItem('faq_searchQuery');
      sessionStorage.removeItem('faq_selectedCategory');
      sessionStorage.removeItem('faq_selectedProgram');
      sessionStorage.removeItem('faq_openId');
      sessionStorage.removeItem('faq_scrollY');
      setSearchQuery('');
      setSelectedCategory('all');
      setSelectedProgram('all');
      setOpenId('q1');
      isRestoringRef.current = false;
    } else if (navigationType === 'POP') {
      const savedScrollY = sessionStorage.getItem('faq_scrollY');
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
    } else {
      isRestoringRef.current = false;
    }
  }, [navigationType]);

  useEffect(() => {
    const p = searchParams.get('program');
    if (p === 'HSK' || p === 'CSCA' || p === 'Study Abroad') {
      setSelectedProgram(p);
    } else if (p === 'all' || !p) {
      setSelectedProgram('all');
    }
  }, [searchParams]);

  const categories = [
    { id: 'all', label: t('faq.categories.all', 'All Questions') },
    { id: 'academic', label: t('faq.categories.academic', 'Application & Academic Questions'), icon: GraduationCap },
    { id: 'financial', label: t('faq.categories.financial', 'Financial Questions'), icon: DollarSign },
    { id: 'life', label: t('faq.categories.life', 'Life & Culture in China'), icon: Globe },
    { id: 'career', label: t('faq.categories.career', 'Career & Future'), icon: Briefcase }
  ];

  // Retrieve translated FAQ items securely
  const faqItems = useMemo<FAQItem[]>(() => {
    const items = t('faq.items', { returnObjects: true });
    let baseItems: FAQItem[] = [];
    if (Array.isArray(items)) {
      baseItems = items as FAQItem[];
    } else {
      // Fallback if translations are not fully loaded yet
      baseItems = [
        {
          id: 'q1',
          category: 'academic',
          question: 'What is UPER Education?',
          answer: t('faq.items.0.answer', 'UPER is Indonesia’s leading educational technology platform...')
        }
      ];
    }

    const lang = (i18n.language || 'en').split('-')[0];
    const currentLang = ['en', 'zh', 'id'].includes(lang) ? lang : 'en';
    const hskItems = hskFaqsByLang[currentLang] || hskFaqsByLang['en'] || [];
    const cscaItems = cscaFaqsByLang[currentLang] || cscaFaqsByLang['en'] || [];

    // Map any custom or general categories safely to the standardized layout tabs
    const normalizeItem = (item: FAQItem): FAQItem => {
      let mappedCat = item.category;
      if (mappedCat === 'process' || mappedCat === 'rules' || mappedCat === 'general' || !mappedCat) {
        const text = `${item.question} ${item.answer}`.toLowerCase();
        // Smarter categorization for fee/tuition/payment questions under financial
        mappedCat = (text.includes('fee') || text.includes('cost') || text.includes('price') || text.includes('pay') || text.includes('费用') || text.includes('学费') || text.includes('biaya') || text.includes('rupiah') || text.includes('rmb')) 
          ? 'financial' 
          : 'academic';
      }
      return { ...item, category: mappedCat };
    };

    const normalizedBase = baseItems.map(normalizeItem);
    const normalizedHsk = hskItems.map(normalizeItem);
    const normalizedCsca = cscaItems.map(normalizeItem);

    return [...normalizedHsk, ...normalizedCsca, ...normalizedBase];
  }, [t, i18n.language]);

  // Dynamic category counts calculation (Faceted search)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const catKeys = ['all', 'academic', 'financial', 'life', 'career'];
    catKeys.forEach(catId => {
      counts[catId] = faqItems.filter(item => {
        const matchCategory = catId === 'all' || item.category === catId;
        const matchSearch = searchQuery.trim() === '' || 
          item.question?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.answer?.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchProgram = true;
        if (selectedProgram !== 'all') {
          const itemTags = getQuestionTags(item);
          matchProgram = itemTags.includes(selectedProgram);
        }
        
        return matchCategory && matchSearch && matchProgram;
      }).length;
    });
    return counts;
  }, [faqItems, searchQuery, selectedProgram]);

  // Dynamic program counts calculation (Faceted search)
  const programCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const progKeys = ['all', 'HSK', 'CSCA', 'Study Abroad'];
    progKeys.forEach(progId => {
      counts[progId] = faqItems.filter(item => {
        const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchSearch = searchQuery.trim() === '' || 
          item.question?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.answer?.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchProgram = true;
        if (progId !== 'all') {
          const itemTags = getQuestionTags(item);
          matchProgram = itemTags.includes(progId);
        }
        
        return matchCategory && matchSearch && matchProgram;
      }).length;
    });
    return counts;
  }, [faqItems, searchQuery, selectedCategory]);

  const filteredItems = useMemo(() => {
    return faqItems.filter(item => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch = searchQuery.trim() === '' || 
        item.question?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.answer?.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchProgram = true;
      if (selectedProgram !== 'all') {
        const itemTags = getQuestionTags(item);
        matchProgram = itemTags.includes(selectedProgram);
      }
      
      return matchCategory && matchSearch && matchProgram;
    });
  }, [faqItems, selectedCategory, searchQuery, selectedProgram]);

  // Generate dynamic JSON-LD FAQPage Schema for Generative Engine Optimization (GEO)
  const faqJsonLd = useMemo(() => {
    if (!faqItems || faqItems.length === 0) return null;
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqItems.map(item => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.answer
        }
      }))
    };
  }, [faqItems]);

  const toggleAccordion = (id: string) => {
    const isExpanding = openId !== id;
    setOpenId(isExpanding ? id : null);
    
    if (isExpanding) {
      const foundItem = faqItems.find(item => item.id === id);
      if (foundItem) {
        const tags = getQuestionTags(foundItem);
        const faqType = tags.includes('HSK') ? 'hsk' : tags.includes('CSCA') ? 'csca' : 'general';
        trackFAQExpand(faqType, id, foundItem.question);
      }
    }
  };

  return (
    <div className="pt-32 pb-24 min-h-screen">
      <SEO 
        title={t('meta.faq.title', 'UPER FAQs | China Scholarships & HSK Exam Q&A')} 
        description={t('meta.faq.description', 'Got questions about studying in China, obtaining scholarships, starting HSK courses, or joining UPER study tours? Find authoritative answers here.')} 
        canonicalUrl="https://uperedu.com/faq"
        breadcrumbs={[
          { name: 'Home', url: 'https://uperedu.com' },
          { name: 'FAQ', url: 'https://uperedu.com/faq' }
        ]}
      />

      {/* JSON-LD FAQPage Schema for Search & AI Engines crawl */}
      {faqJsonLd && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(faqJsonLd)}
          </script>
        </Helmet>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}
          >
            <QuestionIcon className="w-4 h-4" />
            <span>{t('faq.tag', 'Instant Solutions')}</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight"
          >
            {t('faq.title1', 'Frequently Asked')} <span className="text-gradient">{t('faq.title2', 'Questions')}</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 leading-relaxed"
          >
            {t('faq.desc', 'Find clear, authoritative answers to help you navigate HSK preparation, scholarship applications, and university admissions in China.')}
          </motion.p>
        </div>

        {/* Search & Categories Panel */}
        <div className="mb-10 space-y-6">
          {/* Search Input */}
          <div className="relative group max-w-xl mx-auto">
            <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:transition-colors ${
              isApple ? 'group-focus-within:text-slate-800' : 'group-focus-within:text-primary-500'
            }`}>
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder={t('faq.searchPlaceholder', 'Search FAQs...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3.5 bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 transition-all text-sm group-hover:border-slate-300 ${
                isApple 
                  ? 'focus:ring-slate-800/10 focus:border-slate-800' 
                  : 'focus:ring-primary-500/20 focus:border-primary-500'
              }`}
            />
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const IconComponent = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setOpenId(null); // Reset accordion
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                    isActive
                      ? (isApple 
                          ? "bg-slate-900 text-white shadow-sm border border-slate-900" 
                          : "bg-primary-600 text-white shadow-md shadow-primary-600/15 border border-primary-600")
                      : "bg-white text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                  <span>{cat.label}</span>
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 ml-1 rounded-full text-[10px] font-bold transition-all duration-200 ${
                    isActive 
                      ? "bg-white/20 text-white" 
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {categoryCounts[cat.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Program Tag Filters */}
          <div className="pt-4 border-t border-slate-100 flex justify-center w-full">
            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              {[
                { id: 'all', label: t('faq.programs.all', 'All Programs') },
                { id: 'HSK', label: 'HSK' },
                { id: 'CSCA', label: 'CSCA' },
                { id: 'Study Abroad', label: t('faq.programs.studyAbroad', 'Study Abroad') }
              ].map((prog) => {
                const isActive = selectedProgram === prog.id;
                let activeStyle = "bg-slate-900 text-white shadow-md";
                if (isActive) {
                  if (isApple) {
                    activeStyle = "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm";
                  } else {
                    if (prog.id === 'HSK') activeStyle = "bg-blue-600 text-white shadow-md";
                    if (prog.id === 'CSCA') activeStyle = "bg-rose-600 text-white shadow-md";
                    if (prog.id === 'Study Abroad') activeStyle = "bg-emerald-600 text-white shadow-md";
                  }
                }
                
                return (
                  <button
                    key={prog.id}
                    onClick={() => {
                      setSelectedProgram(prog.id);
                      setOpenId(null); // Reset accordion
                      if (prog.id === 'all') {
                        searchParams.delete('program');
                      } else {
                        searchParams.set('program', prog.id);
                      }
                      setSearchParams(searchParams);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold tracking-tight transition-all duration-200 cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                      isActive
                        ? activeStyle
                        : "bg-white text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    {prog.id !== 'all' && prog.id !== 'Study Abroad' ? (
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${prog.id === 'HSK' ? 'bg-blue-400' : 'bg-rose-400'}`} />
                        {prog.label}
                      </span>
                    ) : prog.id === 'Study Abroad' ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {prog.label}
                      </span>
                    ) : (
                      prog.label
                    )}
                    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 ml-0.5 rounded-full text-[10px] font-bold transition-all duration-200 ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-slate-100 text-slate-400"
                    }`}>
                      {programCounts[prog.id] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="max-w-4xl mx-auto space-y-4 mb-20">
          <AnimatePresence mode="popLayout">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const isOpen = openId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isOpen 
                        ? (isApple ? 'border-slate-300 shadow-sm ring-1 ring-slate-100' : 'border-primary-100 shadow-lg shadow-primary-100/30 ring-1 ring-primary-50') 
                        : (isApple ? 'border-slate-200/80 hover:border-slate-300' : 'border-slate-100 hover:border-slate-200 hover:shadow-md')
                    }`}
                  >
                    <button
                      onClick={() => toggleAccordion(item.id)}
                      className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold select-none mt-0.5 ${
                          isApple ? 'bg-slate-100 text-slate-800' : 'bg-primary-50 text-primary-600'
                        }`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="space-y-1.5 flex-1 select-none">
                          <span className="font-extrabold text-slate-900 md:text-lg leading-snug block">
                            {item.question}
                          </span>
                          {/* Program Tags Badges */}
                          {getQuestionTags(item).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {getQuestionTags(item).map((tag) => (
                                <span
                                  key={tag}
                                  className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${getTagStyles(tag, isApple)}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`flex-shrink-0 w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 transition-transform duration-300 mt-0.5 ${
                        isOpen 
                          ? (isApple ? 'rotate-180 text-slate-800 bg-slate-100' : 'rotate-180 text-primary-600 bg-primary-50/50') 
                          : ''
                      }`}>
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                        >
                          <div className="px-6 pb-6 pt-3 text-slate-600 leading-relaxed border-t border-slate-50 pl-[42px]">
                            <div className="prose prose-slate max-w-none text-sm md:text-base text-slate-600 leading-relaxed prose-p:my-1 prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1.5 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:text-slate-900 prose-strong:font-semibold prose-table:w-full prose-table:border-collapse prose-table:my-4 prose-th:bg-slate-50 prose-th:border prose-th:border-slate-200 prose-th:p-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-slate-800 prose-td:border prose-td:border-slate-200 prose-td:p-2.5 prose-td:text-slate-600">
                              <Markdown remarkPlugins={[remarkGfm]}>{item.answer}</Markdown>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm"
              >
                <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{t('news.noResults', 'No matching results found')}</h3>
                <p className="text-slate-400 text-sm">{t('news.noResultsDesc', 'Please refine your keywords or select another tab.')}</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }} 
                  className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  {t('news.clearSearch', 'Clear Search')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-xl"
        >
          {/* Ambient Lighting Gradients */}
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
            isApple ? 'bg-slate-700/20' : 'bg-primary-500/10'
          }`} />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-xl mx-auto space-y-6">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {t('contact.faqFooterTitle', 'Still Have Questions?')}
            </h2>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              {t('contact.faqFooterDesc', 'Speak directly with our professional counselors. Get personalized advice regarding courses, admissions guidance, and visa preparation.')}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="https://wa.me/6281116612062" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`w-full sm:w-auto px-6 py-3 text-white font-extrabold rounded-full active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isApple 
                    ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                    : 'bg-primary-600 hover:bg-primary-700 shadow-lg hover:shadow-primary-600/20'
                }`}
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>{t('contact.chatNow', 'Consult via WhatsApp')}</span>
              </a>
              <a 
                href="/contact" 
                className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-full transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <span>{t('contact.visitPage', 'Contact Form')}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
