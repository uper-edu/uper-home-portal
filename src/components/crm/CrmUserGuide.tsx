import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Copy, 
  Check, 
  Layers, 
  Zap, 
  PhoneCall, 
  Clock, 
  HelpCircle, 
  ChevronRight, 
  ChevronDown,
  ArrowRight, 
  Compass, 
  Database, 
  Smartphone, 
  MessageSquare, 
  GraduationCap, 
  Building2, 
  Award,
  Sparkles,
  Tag,
  Globe,
  X,
  Filter,
  Eye,
  Send,
  UserCheck,
  ArrowUp,
  Hash,
  Printer,
  Share2,
  Target,
  FileText
} from 'lucide-react';

interface CrmUserGuideProps {
  isLight: boolean;
  lang: 'en' | 'zh';
  onNavigateTab?: (tab: 'leads' | 'campaigns' | 'policy' | 'docs') => void;
}

export const CrmUserGuide: React.FC<CrmUserGuideProps> = ({ isLight, lang, onNavigateTab }) => {
  const [activeChapter, setActiveChapter] = useState('chapter-1');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Batch 2: Reading Progress & Navigation
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [copiedAnchorId, setCopiedAnchorId] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Chapter 8: Data Dictionary Filters
  const [dictCategory, setDictCategory] = useState<'all' | 'ingestion' | 'profile' | 'academic' | 'cadence' | 'touch'>('all');
  const [dictSearch, setDictSearch] = useState('');

  // Chapter 9: FAQ & Script Customization
  const [expandedFaqIds, setExpandedFaqIds] = useState<string[]>(['faq-1']);
  const [scriptCategory, setScriptCategory] = useState<'all' | 'tuition' | 'visit' | 'diagnostic' | 'reminder' | 'reactivation'>('all');
  const [studentNameVar, setStudentNameVar] = useState('');

  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en);

  const handleCopyScript = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyField = (fieldName: string) => {
    navigator.clipboard.writeText(fieldName);
    setCopiedId(`field-${fieldName}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAnchor = (chapterId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${chapterId}`;
    navigator.clipboard.writeText(url);
    setCopiedAnchorId(chapterId);
    window.history.replaceState(null, '', `#${chapterId}`);
    setTimeout(() => setCopiedAnchorId(null), 2000);
  };

  const handleShareGuide = () => {
    const url = `${window.location.origin}${window.location.pathname}#${activeChapter}`;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFocusSearch = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 250);
  };

  const handlePrint = () => {
    window.print();
  };

  const chapters = useMemo(() => [
    { 
      id: 'chapter-1', 
      titleEn: '1. System Architecture', 
      titleZh: '1. 系统架构与定位', 
      icon: Compass,
      keywords: ['architecture', 'positioning', 'jakarta', 'pik', 'zoom', 'deduplication', '两段式', '架构', '定位', '全域合流']
    },
    { 
      id: 'chapter-2', 
      titleEn: '2. Capture & Ingestion Model', 
      titleZh: '2. 触点采集与诱饵清洗', 
      icon: Tag,
      keywords: ['hook', 'touchpoints', 'hsk_assessment', 'trial_class', 'scholarship', 'webinar', 'referral', 'campus_career_talk', 'phone', '+62', '诱饵', '清洗', '去重', '手机号', '沉睡复活']
    },
    { 
      id: 'chapter-3', 
      titleEn: '3. R1~R6 Tiering Engine', 
      titleZh: '3. R1~R6 算法推演规则链', 
      icon: Zap,
      keywords: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'tier', 'hot', 'warm', 'cold', 'buying signal', 'trial attended', 'school', 'deduction', '熔断', '降档', '加权', '推演', '规则链']
    },
    { 
      id: 'chapter-4', 
      titleEn: '4. Level & Assessment Flags', 
      titleZh: '4. Level状态与测评Flag判定', 
      icon: Award,
      keywords: ['level', 'state', 'zero', 'partial', 'known', 'assessment needed', 'skip assessment', 'hsk', 'diagnostic', '定级', '水平', '测评', '初学', '零基础', '标签']
    },
    { 
      id: 'chapter-5', 
      titleEn: '5. 8 Pipeline Stages & Flow', 
      titleZh: '5. 线索生命周期与8大阶段', 
      icon: Layers,
      keywords: ['stage', 'pipeline', 'funnel', 'new', 'contacted', 'assessment booked', 'assessment done', 'trial booked', 'trial attended', 'enrolled', 'lost', '漏斗', '8大阶段', '流转', '报名', '建联', '已约']
    },
    { 
      id: 'chapter-6', 
      titleEn: '6. Dynamic SLA Engine', 
      titleZh: '6. 客户分级与动态SLA机制', 
      icon: Clock,
      keywords: ['sla', 'cadence', 'frt', 'first response', 'due', 'overdue', 'business hours', 'watchdog', 'nextFollowUpAt', '3h', '24h', '48h', '时效', '倒计时', '首响应', '看门狗', '免打扰', '营业时段']
    },
    { 
      id: 'chapter-7', 
      titleEn: '7. Daily Sales SOP & Filters', 
      titleZh: '7. 顾问日常作业流程与高效筛选', 
      icon: PhoneCall,
      keywords: ['sop', 'filters', 'daily', 'routine', 'workbench', 'view mode', 'quick search', '顾问SOP', '日常作业', '筛选', '九步法', '外呼']
    },
    { 
      id: 'chapter-8', 
      titleEn: '8. Standard Data Dictionary', 
      titleZh: '8. 标准数据字典与字段规范', 
      icon: Database,
      keywords: ['dictionary', 'fields', 'entity', 'crmleadrecord', 'followuplog', 'id', 'whatsapp', 'email', 'tier', 'stage', 'buyingSignal', 'connectStatus', 'touchCount', '数据字典', '字段', '实体', '规范']
    },
    { 
      id: 'chapter-9', 
      titleEn: '9. FAQ & Script Library', 
      titleZh: '9. 业务常见问答与标准沟通范本', 
      icon: HelpCircle,
      keywords: ['faq', 'script', 'whatsapp template', 'script-1', 'indonesian', 'csv', 'bom', 'excel', 'overdue alert', 'halo kak', '范本', '话术', '问答', '常见问题', '模板', '印尼语']
    },
    { 
      id: 'chapter-10', 
      titleEn: '10. AI Ecosystem & Automation', 
      titleZh: '10. AI 全域营销与自动化生态架构', 
      icon: Sparkles,
      keywords: ['ai', 'ecosystem', 'automation', 'advisor', 'voice dialing', 'telemarketing', 'auto-reply', 'notification', 'copilot', '人工智能', '自动电销', '智能客服', '消息自动回复', '状态通知']
    }
  ], []);

  // ScrollSpy & Reading Progress: Automatically highlight active chapter and update progress bar
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;
      const chapterElements = chapters.map(ch => ({
        id: ch.id,
        el: document.getElementById(ch.id)
      })).filter(item => item.el !== null);

      for (let i = chapterElements.length - 1; i >= 0; i--) {
        const item = chapterElements[i];
        if (item.el && item.el.offsetTop <= scrollPosition) {
          setActiveChapter(item.id);
          break;
        }
      }

      // Calculate total reading progress percentage
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = Math.min(100, Math.max(0, Math.round((window.scrollY / totalHeight) * 100)));
        setReadingProgress(currentProgress);
      }
      setShowBackToTop(window.scrollY > 280);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chapters]);

  // Deep linking: smooth scroll to URL hash on initial load
  useEffect(() => {
    if (window.location.hash) {
      const targetId = window.location.hash.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        setTimeout(() => {
          const yOffset = -90;
          const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }, 150);
      }
    }
  }, []);

  // Live Handbook Search Engine
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: Array<{
      chapterId: string;
      chapterTitle: string;
      snippet: string;
      tag: string;
    }> = [];

    chapters.forEach(ch => {
      const title = (lang === 'zh' ? ch.titleZh : ch.titleEn).toLowerCase();
      const hasTitle = title.includes(q);
      const matchedKw = ch.keywords.filter(k => k.toLowerCase().includes(q));

      if (hasTitle || matchedKw.length > 0) {
        results.push({
          chapterId: ch.id,
          chapterTitle: lang === 'zh' ? ch.titleZh : ch.titleEn,
          snippet: matchedKw.length > 0 
            ? `${t('Matched keywords', '关联关键词')}: ${matchedKw.slice(0, 3).join(', ')}`
            : `${t('Direct Chapter Match', '直接匹配章节标题')}`,
          tag: t('Chapter', '章节')
        });
      }
    });

    // Special dictionary fields index
    const fields = [
      { name: 'buyingSignal', desc: 'Asked price / schedule / payment 购买信号' },
      { name: 'slaDueTime', desc: 'First Response SLA timestamp 首响应倒计时' },
      { name: 'nextFollowUpAt', desc: 'Scheduled appointment timestamp 约定回访' },
      { name: 'touchCount', desc: 'Cumulative follow-up attempts 跟进次数' },
      { name: 'levelState', desc: 'ZERO / PARTIAL / KNOWN 学术状态' },
      { name: 'hookType', desc: 'HSK / Trial / Scholarship 获客诱饵' },
      { name: 'connectStatus', desc: 'Connected / No Response 接通状态' },
      { name: 'owner', desc: 'Sales A / B / B2B 归属顾问' }
    ];

    fields.forEach(f => {
      if (f.name.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q)) {
        results.push({
          chapterId: 'chapter-8',
          chapterTitle: lang === 'zh' ? '第 8 章：标准数据字典' : '8. Standard Data Dictionary',
          snippet: `Field: ${f.name} (${f.desc})`,
          tag: t('Field', '字典字段')
        });
      }
    });

    return results.slice(0, 7);
  }, [searchQuery, chapters, lang, t]);

  const handleSelectChapter = (id: string) => {
    setActiveChapter(id);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const renderChapterHeader = (
    chapterId: string, 
    icon: React.ReactNode, 
    titleEn: string, 
    titleZh: string, 
    colorBg: string, 
    colorText: string,
    subtitleEn?: string,
    subtitleZh?: string,
    extraActions?: React.ReactNode
  ) => (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800 group flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className={`p-1.5 rounded-lg shrink-0 ${colorBg} ${colorText}`}>
          {icon}
        </span>
        <div>
          <h2 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {t(titleEn, titleZh)}
          </h2>
          {subtitleEn && subtitleZh && (
            <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {t(subtitleEn, subtitleZh)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {extraActions}
        <button
          type="button"
          onClick={() => handleCopyAnchor(chapterId)}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1 print:hidden"
          title={t('Copy direct link to this chapter', '复制本章节直达链接')}
        >
          {copiedAnchorId === chapterId ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60">
              <Check className="w-3 h-3 text-emerald-500" />
              <span>{t('Copied link!', '链接已复制')}</span>
            </span>
          ) : (
            <Hash className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-20 relative">
      {/* Batch 2: Top Reading Progress Indicator Bar (Fixed Top) */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-200/50 dark:bg-slate-800/50 pointer-events-none print:hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-150 shadow-xs"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Batch 2: Floating Action Button (FAB - Back to Top & Quick Jump to Search) */}
      <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5 transition-all duration-300 print:hidden ${
        showBackToTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <button
          type="button"
          onClick={handleFocusSearch}
          className={`p-2.5 rounded-full shadow-md border cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${
            isLight
              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-primary-600'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-primary-400'
          }`}
          title={t('Jump to Search', '直达手册检索')}
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleScrollToTop}
          className="group flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg bg-primary-600 hover:bg-primary-500 text-white cursor-pointer transition-all hover:scale-105 active:scale-95"
          title={t('Back to Top', '返回顶部')}
        >
          <ArrowUp className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
          <span className="text-[11px] font-mono font-bold">{readingProgress}%</span>
        </button>
      </div>

      {/* Mobile / Tablet Horizontal Sticky Navigation Bar (lg:hidden, print:hidden) */}
      <div className={`lg:hidden sticky top-16 z-20 py-2.5 px-3 rounded-2xl border mb-2 flex items-center gap-2 overflow-x-auto select-none no-scrollbar shadow-xs print:hidden ${
        isLight ? 'bg-white/95 backdrop-blur-md border-slate-200/90' : 'bg-slate-900/95 backdrop-blur-md border-slate-800'
      }`}>
        {chapters.map((ch) => {
          const isActive = activeChapter === ch.id;
          return (
            <button
              key={`mobile-${ch.id}`}
              type="button"
              onClick={() => handleSelectChapter(ch.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary-600 text-white shadow-xs font-bold'
                  : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ch.icon className="w-3.5 h-3.5" />
              <span>{t(ch.titleEn.split('. ')[1] || ch.titleEn, ch.titleZh.split('. ')[1] || ch.titleZh)}</span>
            </button>
          );
        })}
      </div>

      {/* Left Sidebar Navigation (Desktop lg:block, print:hidden) */}
      <div className="w-full lg:w-72 shrink-0 print:hidden">
        <div className={`sticky top-20 p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                <BookOpen className="w-4 h-4" />
              </span>
              <div>
                <h2 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {t('CRM Operations Manual', 'CRM 业务与数据手册')}
                </h2>
                <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  v2.3 · Enterprise Knowledge Base
                </span>
              </div>
            </div>
            {/* Live Scroll Indicator */}
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300 font-bold">
              {activeChapter.replace('chapter-', 'CH.')}
            </span>
          </div>

          {/* Reading Stats & Tools Bar */}
          <div className={`p-2 rounded-xl border mb-3 flex items-center justify-between text-[11px] ${
            isLight ? 'bg-slate-50 border-slate-200/80 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5">
              <span>📖 {t('~8 min', '约 8 分钟')}</span>
              <span>·</span>
              <span className="font-semibold text-primary-600 dark:text-primary-400">{readingProgress}% {t('read', '已读')}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrint}
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-all"
                title={t('Print or Save as PDF', '打印或导出为 PDF 培训文档')}
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleShareGuide}
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-all"
                title={t('Copy Handbook link', '复制手册直达链接')}
              >
                {copiedShare ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Search in Handbook with Clear Button and Live Dropdown */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search manual (R1, Field, SLA)...', '检索手册 (如: R1, 字段, SLA)...')}
              className={`w-full text-xs rounded-xl pl-8 pr-7 py-1.5 border outline-none font-medium transition-all ${
                isLight 
                  ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-primary-500' 
                  : 'bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500 focus:border-primary-500'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                title={t('Clear search', '清空检索')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Instant Search Results Panel */}
          {searchQuery.trim().length > 0 && (
            <div className={`mb-3 p-2 rounded-xl border max-h-56 overflow-y-auto ${
              isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-slate-950/90 border-slate-800'
            }`}>
              <div className="text-[10px] font-bold text-slate-400 mb-1.5 px-1 flex items-center justify-between">
                <span>{t('Search Results', '匹配结果')}</span>
                <span>{searchResults.length} {t('found', '条')}</span>
              </div>
              {searchResults.length === 0 ? (
                <div className="text-[11px] text-slate-400 py-3 text-center">
                  {t('No matching rules or fields found', '未检索到相关规则或字段')}
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((res, idx) => (
                    <button
                      key={`search-res-${idx}`}
                      type="button"
                      onClick={() => {
                        handleSelectChapter(res.chapterId);
                      }}
                      className={`w-full text-left p-1.5 rounded-lg text-[11px] transition-all cursor-pointer flex flex-col ${
                        isLight ? 'hover:bg-white hover:shadow-2xs text-slate-700' : 'hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-primary-600 dark:text-primary-400 truncate">{res.chapterTitle}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {res.tag}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate mt-0.5">{res.snippet}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nav List */}
          <nav className="space-y-1">
            {chapters.map((ch) => {
              const Icon = ch.icon;
              const isActive = activeChapter === ch.id;
              const isSearchMatch = searchQuery.trim() && (
                (lang === 'zh' ? ch.titleZh : ch.titleEn).toLowerCase().includes(searchQuery.toLowerCase()) ||
                ch.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
              );

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChapter(ch.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                    isActive
                      ? isLight 
                        ? 'bg-primary-50 text-primary-700 font-bold' 
                        : 'bg-primary-950/70 text-primary-400 font-bold'
                      : isLight 
                        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  } ${isSearchMatch ? 'ring-1 ring-primary-500/50' : ''}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
                    <span className="truncate">{t(ch.titleEn, ch.titleZh)}</span>
                  </div>
                  {isSearchMatch ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  ) : isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Jump to Live Leads */}
          {onNavigateTab && (
            <div className={`mt-4 pt-3 border-t ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
              <button
                type="button"
                onClick={() => onNavigateTab('leads')}
                className="w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span>{t('Go to Sales Workbench', '返回销售看板实操')}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Documentation Body */}
      <div className="flex-1 space-y-8 max-w-4xl print:max-w-none print:w-full">
        
        {/* Banner with Reading Stats & Quick Actions */}
        <div className={`p-5 rounded-2xl border transition-all ${
          isLight ? 'bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white border-blue-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 text-primary-600 text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-4 h-4" />
              <span>{t('Enterprise Architecture & Operating Playbook', '企业级业务架构与顾问标准作业手册')}</span>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title={t('Print or Save as PDF', '打印或导出为 PDF 培训文档')}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t('Print / Export PDF', '打印手册')}</span>
              </button>
              <button
                type="button"
                onClick={handleShareGuide}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title={t('Copy direct shareable link', '复制手册分享直链')}
              >
                {copiedShare ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 font-bold">{t('Copied!', '已复制')}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{t('Share', '分享')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <h1 className={`text-xl md:text-2xl font-black mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {t('UPER CRM Business Architecture & Operating Manual', 'UPER 业务流转、算法推演与数据字典全景手册')}
          </h1>
          <p className={`text-xs md:text-sm leading-relaxed mb-3.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {t(
              'A standardized operational guide for course consultants and sales leadership. Covers multi-channel lead acquisition, R1~R6 tiering deduction algorithms, assessment flags, dynamic SLA lifecycles, and complete system data dictionary specifications.',
              '面向课程顾问团队与学术管理层的标准化作业指南。系统阐明多渠道线索沉淀、R1~R6 算法推演规则链条、学术定级与测评建议标签、动态两段式SLA履约时钟及完整软件数据字典规范。'
            )}
          </p>

          {/* Quick Guide Stat Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 font-medium">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
              📖 {t('~8 min Read', '约 8 分钟阅读')}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
              🏛️ {t('9 Business Chapters', '9 大业务章节')}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
              🗄️ {t('49 Standard Fields', '49 个标准字典字段')}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold">
              💬 {t('5 WhatsApp Templates', '5 套官方话术')}
            </span>
            <span className="ml-auto font-mono text-primary-600 dark:text-primary-400 font-bold print:hidden">
              {readingProgress}% {t('completed', '已读')}
            </span>
          </div>
        </div>

        {/* Core Glossary & Concepts Quick Reference Card */}
        <div className={`p-5 rounded-2xl border space-y-3 ${
          isLight ? 'bg-amber-50/60 border-amber-200/80 text-amber-950' : 'bg-slate-900 border-amber-900/50 text-slate-200'
        }`}>
          <div className="flex items-center gap-2 font-bold text-xs">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>{t('Core Concepts & Glossary Quick Reference', '核心专有名词与底层概念速查手册 (Glossary)')}</span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            {t(
              'Before exploring the system mechanics, please familiarize yourself with these core terminology definitions used throughout UPER CRM:',
              '在深入了解算法规则与作业 SOP 之前，建议先掌握本系统频繁使用的 6 大底层核心专有名词定义：'
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-amber-200/60' : 'bg-slate-950 border-amber-900/40'}`}>
              <div className="font-bold text-xs text-primary-600 dark:text-primary-400 mb-0.5">Tier (线索评级)</div>
              <div className="text-[10.5px] opacity-80">{t('Commercial value & priority classification (Hot, Warm, Cold)', '商业价值与跟进紧迫度分级 (Hot/Warm/Cold)')}</div>
            </div>
            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-amber-200/60' : 'bg-slate-950 border-amber-900/40'}`}>
              <div className="font-bold text-xs text-rose-600 dark:text-rose-400 mb-0.5">Buying Signal (购买信号)</div>
              <div className="text-[10.5px] opacity-80">{t('Expressed intent like pricing, schedule, or enrollment', '客户主动释放的购买动机（如问学费、排期、分期）')}</div>
            </div>
            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-amber-200/60' : 'bg-slate-950 border-amber-900/40'}`}>
              <div className="font-bold text-xs text-amber-600 dark:text-amber-400 mb-0.5">SLA (服务响应时效)</div>
              <div className="text-[10.5px] opacity-80">{t('Mandatory time window for first outreach or follow-up', '硬性规定的首响应或回访时间倒计时红线')}</div>
            </div>
            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-amber-200/60' : 'bg-slate-950 border-amber-900/40'}`}>
              <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400 mb-0.5">Cadence (跟进时效节奏)</div>
              <div className="text-[10.5px] opacity-80">{t('Configurable outreach frequency & watchdog interval', '基于策略配置的跟进频率建议与看门狗频次')}</div>
            </div>
            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-amber-200/60' : 'bg-slate-950 border-amber-900/40'}`}>
              <div className="font-bold text-xs text-purple-600 dark:text-purple-400 mb-0.5">Flag (风控与特征标签)</div>
              <div className="text-[10.5px] opacity-80">{t('Special lead markers like Urgent, VIP, or Reactivated', '辅助决策的特殊特征标签（加急、VIP、复活潜客）')}</div>
            </div>
            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-amber-200/60' : 'bg-slate-950 border-amber-900/40'}`}>
              <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400 mb-0.5">Level State (学术状态)</div>
              <div className="text-[10.5px] opacity-80">{t('Student HSK baseline: ZERO, KNOWN, or PARTIAL', '学员中文水平判定：零基础(ZERO)、已知(KNOWN)或需测评')}</div>
            </div>
          </div>
        </div>

        {/* CHAPTER 1: System Overview */}
        <section id="chapter-1" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-1',
            <Compass className="w-4 h-4" />,
            'Chapter 1: System Architecture & Business Positioning',
            '第 1 章：系统定位与全域业务架构',
            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
            ''
          )}

          <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              {t(
                'UPER Education CRM is a specialized operational platform engineered for Chinese language education in Indonesia and overseas academic pathways. The platform orchestrates customer lifecycles across both physical face-to-face instruction at the Jakarta Pantai Indah Kapuk (PIK) campus and interactive nationwide online live courses via Zoom.',
                'UPER Education CRM 是专门针对印尼华文教育培训与赴华国际留学业务定制的全流程运营工作台。业务涵盖雅加达北区 PIK 校区面授课程与面向全印尼的 Zoom 远程互动直播课，推动咨询顾问从被动接待转向精细化主动转化。'
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('1. Unified Lead Aggregation', '1. 全域合流入库')}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t(
                    'Aggregates official website inquiries, 10-question placement quiz diagnostics, and AI counselor conversational leads into a unified deduplicated database.',
                    '官网咨询表单、10题智能自测出分诊断与在线智能客服会话线索自动归集、清洗与去重合并。'
                  )}
                </p>
              </div>

              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('2. R1~R6 Deduction Engine', '2. R1~R6 算法推演')}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t(
                    'Executes hierarchical deduction rules based on explicit buying signals, geographic intent, and academic objectives in real time.',
                    '严格执行 R1 至 R6 判定链条，基于商业意向信号、地缘省市及学术目标进行自动化评级推导。'
                  )}
                </p>
              </div>

              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('3. Dynamic Two-Stage Cadence', '3. 两段式动态履约')}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t(
                    'First response commitment closes upon initial outreach and seamlessly transitions into appointment countdowns, eliminating false SLA alarms.',
                    '首次沟通建联后首响时效即刻归档，自动演进为下次回访预约倒计时，杜绝传统系统虚假超时预警。'
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 2: Hooks & Ingestion Model */}
        <section id="chapter-2" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-2',
            <Tag className="w-4 h-4" />,
            'Chapter 2: Ingestion Touchpoints & Marketing Hook Model',
            '第 2 章：生源触点与“钩子”获客模型',
            'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
            '',
            'Taxonomy of acquisition hooks, Indonesian mobile phone standardization, and deduplication logic.',
            '获客诱饵场景分类定义、印尼手机号码国际规范化清洗与档案唯一合并机制。'
          )}

          <div className="space-y-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              {t(
                'Prior to initiating outreach, consultants should review the marketing hook type and context to personalize their introductory conversation effectively:',
                '顾问在发起首次沟通前，应当核实学员提交表单时所对应的内容诱饵（Hook Type）与渠道场景（Hook Context），以便切中核心关注点开展专业沟通：'
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hook Type */}
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <h4 className="font-bold text-xs text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
                  <span>{t('🪝 Marketing Hook Types', '🪝 核心诱饵类型 (Hook Type)')}</span>
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div><code>hsk_assessment</code>：{t('10-question placement test quiz with diagnostic score breakdown.', '10题水平自测诊断试卷，完成后期望获取详细能力分析；')}</div>
                  <div><code>trial_class</code>：{t('Explicit booking for trial experience session (PIK Campus / Zoom).', '预约试听课程（PIK校区面授或线上Zoom班型）；')}</div>
                  <div><code>scholarship_materials</code>：{t('Download comprehensive Tsinghua/Peking university scholarship application guide.', '申请赴华清北等知名高校奖学金申报指南；')}</div>
                  <div><code>webinar</code>：{t('Registration for career seminar on Chinese enterprise recruitment in Indonesia.', '报名中资在印尼高薪就业与商务华文公开课；')}</div>
                  <div><code>download_guide</code>：{t('Download beginner vocabulary and pronunciation reference whitepaper.', '下载零基础初学者华文常用词汇与语法速成手册；')}</div>
                  <div><code>referral</code>：{t('Direct recommendation by enrolled alumni or partner schools.', '在读学员或合作院校推荐转入。')}</div>
                </div>
              </div>

              {/* Hook Context */}
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <h4 className="font-bold text-xs text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
                  <span>{t('📍 Acquisition Contexts', '📍 触点场景渠道 (Hook Context)')}</span>
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div><code>campus_career_talk</code>：{t('On-campus academic fairs and university career presentations (UI, Binus, Trisakti).', '印尼各大高校（UI、Binus、Trisakti等）校园宣讲会；')}</div>
                  <div><code>paid_social</code>：{t('Targeted advertising campaigns on Instagram and TikTok.', 'Instagram / TikTok 官方定向信息流推广；')}</div>
                  <div><code>organic_dm</code>：{t('Inbound direct messages via social media business profiles.', '社交媒体官方主页私信主动咨询；')}</div>
                  <div><code>website</code>：{t('Organic organic search traffic and portal direct inquiries.', 'UPER 官方门户网站自然搜索流量；')}</div>
                  <div><code>expo</code>：{t('International education exhibitions and study abroad fairs in Jakarta.', '雅加达国际教育展与留学巡展线下展位直接登记。')}</div>
                </div>
              </div>
            </div>

            {/* Cleansing & Deduplication */}
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <span>{t('🛡️ Ingestion Normalization & Deduplication Protocol:', '🛡️ 入库清洗与去重合并机制：')}</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>
                  <b>{t('Mobile Number Standardization', '印尼手机号码国际规范化')}</b>：
                  {t(
                    'Local formats such as 0812-xxxx or 62812... are parsed, stripped of non-digit characters, and normalized to +62 812... to guarantee 100% WhatsApp dispatch success.',
                    '本地格式（如 0812-xxxx、62812...）自动统一清洗并规范为国际标准 +62 812...，确保 WhatsApp 一键会话唤起成功率达 100%。'
                  )}
                </li>
                <li>
                  <b>{t('Primary Key Intelligent Merging', '双重主键唯一合并')}</b>：
                  {t(
                    'Uses WhatsApp mobile number as primary key and Email as secondary index. Re-submissions update existing customer dossiers and aggregate diagnostic signals without creating duplicate records.',
                    '以 WhatsApp 联络号为主索引键，电子邮箱为第二校验键。学员重复提交表单或重新测评时，系统自动更新原有档案并累加意向信号，杜绝产生冗余重复名单。'
                  )}
                </li>
                <li>
                  <b>{t('Dormant Lead Re-activation', '沉睡线索复活唤醒')}</b>：
                  {t(
                    'Archived or lost leads that re-engage via quiz retakes or inquiry forms are prioritized with a high-urgency 30-minute response window.',
                    '原处于流失或冷池培育阶段的学员若重新在前端互动，系统自动唤醒并标注为复活潜客，启动高优先级的 30 分钟首响应窗口。'
                  )}
                </li>
              </ul>
            </div>

            {/* Campaign Tracking & Single Short ID Architecture */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${isLight ? 'bg-primary-50/40 border-primary-200 text-slate-800' : 'bg-primary-950/20 border-primary-900/60 text-slate-200'}`}>
              <h4 className="font-bold text-xs text-primary-700 dark:text-primary-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-primary-500" />
                <span>{t('🎯 Campaign Hub: Single Short ID Tracking & Closed-Loop Architecture', '🎯 营销获客中台：单短链标识追溯与事后闭环分析体系')}</span>
              </h4>
              <p className="text-[11px] leading-relaxed">
                {t(
                  'Modern digital marketing standard practice: Rather than cluttering public promotional posters and roll-up banners with complex UTM strings, UPER adopts the Single Short ID paradigm (e.g. /chat?c=seminar_2026).',
                  '营销业界标准规范：彻底摒弃在宣讲会立牌、海报、传单中暴露一长串繁杂生硬的 ?utm_source=...&utm_medium=... 参数，全面采用行业主流的「单短链标识绑定机制」（例如：/chat?c=seminar_2026）。'
                )}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-white border-primary-100' : 'bg-slate-900 border-primary-950'}`}>
                  <b className="text-primary-600 block mb-1">{t('1. Silent Attribute Binding', '1. 属性静默绑定')}</b>
                  {t('utm_source, medium, and hook context are bound to the Campaign ID at creation, resolved automatically on /chat landing.', '在活动创建时直接固化绑定渠道来源、物料媒介与默认诱饵，落地页自动解构。')}
                </div>
                <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-white border-primary-100' : 'bg-slate-900 border-primary-950'}`}>
                  <b className="text-primary-600 block mb-1">{t('2. AI Collateral Empowerment', '2. AI 全套物料赋能')}</b>
                  {t('AI synthesizes 45-min talk outlines, WhatsApp blasts, and social media posts using date, venue, and audience.', '根据活动时间、地点、受众与核心卖点，一键生成宣讲提纲、WhatsApp群发与社媒文案。')}
                </div>
                <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-white border-primary-100' : 'bg-slate-900 border-primary-950'}`}>
                  <b className="text-primary-600 block mb-1">{t('3. Closed-Loop ROI Tracking', '3. 事后闭环投产比')}</b>
                  {t('Cross-references CRM leads table in real time to calculate Sourced Leads, Enrolled deals, and net ROI.', '与 CRM 线索库实时联动，自动核算该活动带来的最终试听数、签约人数、学费 GMV 与 ROI。')}
                </div>
              </div>
            </div>

            {/* Visual Business Infographic: Campaign-to-Leads Closed-Loop Journey */}
            <div className={`p-5 rounded-2xl border space-y-4 ${isLight ? 'bg-gradient-to-br from-primary-50/50 via-white to-indigo-50/30 border-primary-200' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary-600 text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span>{t('🌟 End-to-End Campaign & Lead Journey Infographic', '🌟 营销活动从立项到线索闭环的业务全景可视化图解')}</span>
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                  {t('100% Automated Closed Loop', '全自动业务闭环')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
                {/* Step 1 */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between relative ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-800/80 border-slate-700'}`}>
                  <div>
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs mb-2">01</div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white mb-1">{t('1. Create Campaign', '① 创建获客活动')}</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('Set up your seminar or masterclass in CRM and instantly get a clean short link (/chat?c=code) & AI marketing copy.', '在 CRM 中一键新建活动，自动生成专属短链与 AI 全套宣传物料。')}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {t('Ready to Launch', '一键立项发布')} ➔
                  </div>
                </div>

                {/* Step 2 */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between relative ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-800/80 border-slate-700'}`}>
                  <div>
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs mb-2">02</div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white mb-1">{t('2. Share & Distribute', '② 投放与短链引流')}</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('Share the short link on Instagram, WhatsApp groups, or campus posters. Students click to land on your AI consultation channel.', '通过 Instagram、WhatsApp 群发或海报二维码分发，学员扫码直达 AI 专属通道。')}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {t('Student Landing', '访客扫码落地')} ➔
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between relative ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-800/80 border-slate-700'}`}>
                  <div>
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs mb-2">03</div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white mb-1">{t('3. Questionnaire & Test', '③ 问卷与 AI 测评')}</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('Students complete a 30s profile questionnaire and take an HSK diagnostic placement test with our AI counselor.', '学员完成 30 秒入驻问卷及 HSK 能力摸底测评，AI 顾问实时生成诊断报告。')}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                    {t('Data Capture', '问卷测评沉淀')} ➔
                  </div>
                </div>

                {/* Step 4 */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between relative ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-800/80 border-slate-700'}`}>
                  <div>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs mb-2">04</div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white mb-1">{t('4. Smart Attribution', '④ 智能归因入库')}</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('CRM instantly captures lead details, attributes them to the correct campaign, and tracks returning visitors via multi-touch attribution.', 'CRM 自动将学员身份与活动精准绑定，老学员回访自动标记最新触达。')}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {t('Lead Stored', '线索精准归因')} ➔
                  </div>
                </div>

                {/* Step 5 */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between relative ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-800/80 border-slate-700'}`}>
                  <div>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-xs mb-2">05</div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white mb-1">{t('5. Real-Time ROI & Funnel', '⑤ 实时看板与投产比')}</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('View total sourced leads, hot prospects, trial attendees, enrolled deals, and net ROI in real time on your campaign dashboard!', '在活动看板中实时查看获客数、高意向数、签约转化率及净投资回报率 (ROI)！')}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    {t('Closed Loop!', '全景闭环达成!')} ✨
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 3: R1~R6 Rule Engine */}
        <section id="chapter-3" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-3',
            <Zap className="w-4 h-4" />,
            'Chapter 3: Lead Qualification & R1~R6 Tiering Engine',
            '第 3 章：核心分 Tier 评级算法与 R1~R6 规则链',
            'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
            '',
            'Hierarchical Priority Execution Order: R6 ➔ R1 ➔ R2 ➔ R3 ➔ R4 ➔ R5',
            '系统底层严格执行的优先级排他推导链条：R6 ➔ R1 ➔ R2 ➔ R3 ➔ R4 ➔ R5'
          )}

          <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {/* Multi-Signal Accumulation & Intelligent Playbook Engine Note */}
            <div className={`p-4 rounded-xl border space-y-2 ${isLight ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950' : 'bg-indigo-950/40 border-indigo-800 text-indigo-200'}`}>
              <div className="font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <span>{t('Multi-Signal Accumulation & Intelligent Playbook Engine', '复合购买信号累加与智能化攻坚引擎')}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {t(
                  'Leads often express multiple buying signals over time (e.g. asking price first, then schedule, then installments). Uper CRM records all historical signals into an accumulating intent cloud (buyingSignals[]), automatically re-sorting and tailoring objection-handling scripts in the Sales Playbook to match each individual student profile.',
                  '在跟进与互动深入过程中，学员往往会分阶段释放多重购买信号（如：先问学费、再问排期、最后问分期）。系统支持复合信号历史累加（buyingSignals[] 标签云），并在“转化攻坚”Tab 中实现千人千面的动态话术推荐与优先级智能排序。'
                )}
              </p>
            </div>

            <p>
              {t(
                'Lead tiers are not calculated by arbitrary scoring, but strictly evaluated through mutually exclusive business rules in order of precedence:',
                '线索评级并非简单的数值打分，而是严格按照下述具有明确业务权重的规则链条进行逐级推导：'
              )}
            </p>

            <div className="space-y-2.5">
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${isLight ? 'bg-rose-50/70 border-rose-200' : 'bg-rose-950/30 border-rose-900'}`}>
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] shrink-0 font-mono">
                  R1
                </span>
                <div>
                  <div className="font-bold text-rose-900 dark:text-rose-200 text-xs">
                    {t('Buying Signal Override (Buying Signal ≠ None yet) ➔ Tier: Hot', '人工购买信号覆盖 (Buying Signal ≠ None yet) ➔ 一律判定为 Hot')}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t(
                      'Triggered when customer inquiries specifically about tuition pricing, class schedules, installment payments, readiness to enroll, or indicates an exam plan within 3 months. Overrides all baseline classifications to Hot with highest urgency.',
                      '当探测到咨询学费政策（Asked price）、班级排期（Asked schedule）、分期付款（Asked payment）、明确表达报读意向（Ready to enroll）或考期在3个月内时，具有最高优先级，强制判定为 S级 Hot。'
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-950/30 border-amber-900'}`}>
                <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10px] shrink-0 font-mono">
                  R2
                </span>
                <div>
                  <div className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                    {t('Trial Attendance Milestone (Trial Attended) ➔ Tier: Hot', '试听完课里程碑达成 (Trial Attended) ➔ 一律直升 Hot')}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t(
                      'When a prospective student completes a trial session, their intent reaches its peak conversion probability. System automatically promotes the lead to Hot to enforce immediate post-class consultation within 4 hours.',
                      '学员出席并完成试听课程体验后，其时间投入度与真实意向达到峰值，系统无条件升为 Hot，进入完课后 4 小时内沟通促成正式签约的关键转化窗口期。'
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${isLight ? 'bg-purple-50/70 border-purple-200' : 'bg-purple-950/30 border-purple-900'}`}>
                <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold text-[10px] shrink-0 font-mono">
                  R3
                </span>
                <div>
                  <div className="font-bold text-purple-900 dark:text-purple-200 text-xs">
                    {t('Institutional Profile (Current Status = Teacher or school staff) ➔ Tier: School', '机构身份优先 (Current Status = Teacher or school staff) ➔ 优先进入 School')}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t(
                      'Identified as international school curriculum contracting, teacher certification, or corporate group training. Routed directly to dedicated B2B sales management.',
                      '判定为国际学校校内课程外包、师资认证培训或企业员工团体培训大宗方案，系统自动划归 School 类别并分派给 B2B 专属顾问。'
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${isLight ? 'bg-blue-50/70 border-blue-200' : 'bg-blue-950/30 border-blue-900'}`}>
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] shrink-0 font-mono">
                  R4
                </span>
                <div>
                  <div className="font-bold text-blue-900 dark:text-blue-200 text-xs">
                    {t('Core Triad Baseline Matrix (Goal × Level State × City/Mode)', '核心三问打底基准模型 (Goal × Level State × City/Mode)')}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t(
                      'Strong Objectives (China Career, JV Employment, Scholarships, HSK Certification): KNOWN level qualifies as Hot; Jakarta domicile with offline preference qualifies as Warm-Offline; Non-Jakarta or Zoom preference qualifies as Warm-Online. Broad interest objectives default to Cold-Nurture.',
                      '明确目标客群（赴华中资就业、知名大学留学、HSK认证考试）：现有基础明确（KNOWN）直升 Hot；居住于雅加达且意向线下授课归入 Warm-Offline；外岛或线上直播需求归入 Warm-Online。泛兴趣客群归入 Cold-Nurture。'
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/30 border-emerald-900'}`}>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] shrink-0 font-mono">
                  R5
                </span>
                <div>
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                    {t('Behavioral Promotion (Assessment Done or Trial Booked) ➔ Upgrade Tier', '关键行为加权升档 (完成测评或预约试听) ➔ 在 R4 基准上升一档')}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t(
                      'When a Warm lead completes placement assessment or books a trial session, the system automatically advances their classification to Hot.',
                      '原处于 Warm 级的潜客一旦完成测评测验生成成绩单，或成功锁定试听班级排期，系统自动晋升其评级至 Hot。'
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-800 border-slate-700'}`}>
                <span className="px-2 py-0.5 rounded bg-slate-600 text-white font-bold text-[10px] shrink-0 font-mono">
                  R6
                </span>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {t('Rollback Circuit Breaker (Connect Status = No Response & Touch Count ≥ 3) ➔ Cold-Nurture', '止损回滚熔断保护 (未接通且触达 ≥ 3 次) ➔ 降档至 Cold-Nurture')}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {t(
                      'To protect institutional brand equity and prevent customer complaints, leads with 3 consecutive unanswered attempts are demoted to Cold-Nurture and removed from daily urgent call queues.',
                      '为维护机构教育品牌声誉并避免客户反感，连续 3 次外呼未接通的潜客自动降级至 Cold-Nurture，移出日常外呼队列并暂停催促。'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 4: Level State & Flags */}
        <section id="chapter-4" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-4',
            <Award className="w-4 h-4" />,
            'Chapter 4: Proficiency Level States & Assessment Action Flags',
            '第 4 章：Level 状态推导与测评建议 Flag 判定',
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
            '',
            'Actionable heuristics directing whether to administer diagnostic quiz testing.',
            '指导咨询顾问针对不同学术背景潜客制定标准化排课策略。'
          )}

          <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              {t(
                'The system translates self-reported proficiency into an internal Level State, which deterministically calculates the customer Action Flag:',
                '系统依据学员自述的现有汉语基础，自动推导其学术认知状态（Level State），并进一步生成行动建议标签（Flag）：'
              )}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border rounded-xl overflow-hidden">
                <thead className={isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-200'}>
                  <tr>
                    <th className="p-2.5 font-bold">{t('Reported Level', '自述水平')}</th>
                    <th className="p-2.5 font-bold">{t('Level State', '推导状态')}</th>
                    <th className="p-2.5 font-bold">{t('Action Flag', '系统行动标签')}</th>
                    <th className="p-2.5 font-bold">{t('Consultant Operating Protocol', '顾问标准操作指引')}</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-200 bg-white' : 'divide-slate-800 bg-slate-900'}`}>
                  <tr>
                    <td className="p-2.5 font-bold">Complete beginner</td>
                    <td className="p-2.5 font-mono text-slate-600">ZERO</td>
                    <td className="p-2.5 font-bold text-slate-500">Skip Assessment</td>
                    <td className="p-2.5">
                      {t(
                        'Direct placement into basic phonetics / Pinyin foundation courses. Avoid quiz assessments to reduce initial friction for zero-base beginners.',
                        '跳过测评。直接推荐基础语音拼音启蒙班型，避免增加零基础初学者的心理门槛与测试压力。'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">Beginner / Not sure</td>
                    <td className="p-2.5 font-mono text-amber-600 font-bold">PARTIAL</td>
                    <td className="p-2.5 font-bold text-amber-600">Assessment Needed</td>
                    <td className="p-2.5">
                      {t(
                        'Diagnostic quiz required. Essential engagement vehicle. Dispatch test link, analyze vocabulary and grammar score report, and deliver targeted curriculum advice.',
                        '必须安排测评定级。此为建立专业信任与促成转化的核心契机，推送测试试卷，出分后依据薄弱考点定制学习规划。'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">HSK 1 / HSK 2 / HSK 3 / HSK 4+</td>
                    <td className="p-2.5 font-mono text-emerald-600 font-bold">KNOWN</td>
                    <td className="p-2.5 font-bold text-slate-500">Skip Assessment</td>
                    <td className="p-2.5">
                      {t(
                        'Bypass testing. Verified official certification exists. Formulate accelerated course trajectory aimed at the next certification milestone.',
                        '跳过测评。学员已有明确官方考级凭证，直接依据现有等级出具进阶保过或留学直通方案。'
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CHAPTER 5: 8 Pipeline Stages */}
        <section id="chapter-5" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-5',
            <Layers className="w-4 h-4" />,
            'Chapter 5: 8 Lifecycle Pipeline Stages',
            '第 5 章：线索生命周期与 8 大推进阶段',
            'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
            '',
            'Standardized 8-stage conversion funnel aligned across table filters, table rows, and the follow-up drawer.',
            '标准化 8 级转化漏斗，在表头筛选工具条、表格行内下拉与跟进详情抽屉中严格保持一致。'
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left border rounded-xl overflow-hidden">
              <thead className={isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-200'}>
                <tr>
                  <th className="p-2.5 font-bold w-12 text-center">{t('No.', '序号')}</th>
                  <th className="p-2.5 font-bold whitespace-nowrap min-w-[130px]">{t('Stage', '阶段名称')}</th>
                  <th className="p-2.5 font-bold min-w-[220px]">{t('Stage Definition & State', '阶段业务定义与准入状态')}</th>
                  <th className="p-2.5 font-bold min-w-[220px]">{t('Consultant Standard Action', '顾问标准化推进动作')}</th>
                  <th className="p-2.5 font-bold min-w-[190px]">{t('Cadence / SLA Trigger', '时效要求与流转触发')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200 bg-white' : 'divide-slate-800 bg-slate-900'}`}>
                {/* 1. New */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">01</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-950/60 text-blue-300 border-blue-800'
                    }`}>
                      {t('New', '待初访')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Fresh inquiry ingested into CRM via website forms, placement tests, or AI chatbot. Uncontacted lead (touchCount = 0).',
                      '新线索入库（官网表单、自测题或AI客服），尚未开展初次沟通（跟进次数 touchCount = 0）。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Review hook type and source context; initiate introductory outreach via official WhatsApp or outbound phone call.',
                      '核查生源诱饵与触点场景，使用官方标准范本通过 WhatsApp 或电话发起专业首访。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      'First Response SLA active (Hot ≤3h, Warm ≤24h, Cold ≤48h). Non-business hours roll over to next morning 10:00.',
                      '激活首响应 SLA（Hot ≤3h，Warm ≤24h，Cold ≤48h）；非营业时段顺延至次日 10:00。'
                    )}
                  </td>
                </tr>

                {/* 2. Contacted */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">02</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
                    }`}>
                      {t('Contacted', '已建联')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Two-way communication successfully established. Learning goals, proficiency level, and mode preference verified.',
                      '已成功建立双向互动，核实了学习目标、现有汉语水平认知及授课模式意向（PIK面授或Zoom直播）。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Share curriculum syllabus and tuition schedule. Invite student to placement evaluation or trial class.',
                      '发送课程方案简章与学费政策，针对性引导完成 10 题定级测评或锁定校区/线上试听体验。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      'FRT archived. Specify next appointment date (nextFollowUpAt) or trigger 24h inactivity watchdog for Hot.',
                      '首响应时效履约归档。必须登记预约下次沟通时间，否则 Hot 生源超 24h 触发停滞预警。'
                    )}
                  </td>
                </tr>

                {/* 3. Assessment Booked */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">03</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-950/60 text-amber-300 border-amber-800'
                    }`}>
                      {t('Assessment Booked', '已约测评')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Student agreed to placement evaluation; official 10-question diagnostic quiz link dispatched.',
                      '学员已同意进行学术自测定级，已推送官方 10 题智能测评诊断链接。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Follow up with student to encourage quiz completion within 24 hours. Provide guidance on test format.',
                      '督促学员在 24 小时内完成测验作答，提供技术指引与测试说明。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      'Cadence follow-up within 24 hours. Automatic score generation triggers R5 promotion to Hot.',
                      '发送后 24 小时内跟进提醒；测验提交出分后系统自动执行 R5 规则升档至 Hot。'
                    )}
                  </td>
                </tr>

                {/* 4. Assessment Done */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">04</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-950/60 text-purple-300 border-purple-800'
                    }`}>
                      {t('Assessment Done', '测评完成')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Diagnostic score report generated (0~100 score with HSK module accuracy breakdown). Academic analysis ready.',
                      '测验得分与错题报告生成（0~100 分及各 HSK 考点得分明细），学术分析报告已就绪。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Academic advisor reviews weak knowledge points; deliver customized study plan and curriculum recommendation within 2h.',
                      '学术顾问核对词汇掌握度与薄弱考点，出分后 2 小时内出具学习规划方案并预约试听课。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      '2-hour post-score consultation window; lock in trial cohort schedule (PIK campus / Zoom).',
                      '出分后 2 小时内服务响应承诺；确定并锁定试听排期，推进流转至已约试听。'
                    )}
                  </td>
                </tr>

                {/* 5. Trial Booked */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">05</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-cyan-950/60 text-cyan-300 border-cyan-800'
                    }`}>
                      {t('Trial Booked', '已约试听')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Trial class schedule confirmed for a designated cohort (PIK physical campus or online Zoom cohort).',
                      '试听课开班排期与班型明确锁定（PIK 校区面授班或 Zoom 在线互动班）。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Send pre-class preparation guide and venue directions; dispatch Zoom credentials or campus directions 4h prior.',
                      '发送试听课前预习指引与校区定位导航；开课前 4 小时发送 Zoom 会议号或到校提醒。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      '4-hour pre-class milestone automated reminder dispatched; mark reminderSent = true.',
                      '开课前 4 小时里程碑提醒履约，系统标记 reminderSent 状态为已送达。'
                    )}
                  </td>
                </tr>

                {/* 6. Trial Attended */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">06</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    }`}>
                      {t('Trial Attended', '试听出席')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Student successfully attended and completed the trial experience class. Purchase intent reaches peak.',
                      '学员已出席并完成试听课程体验，意向度与时间投入达峰值，系统无条件升至 Hot。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Conduct feedback consultation within 4 hours; address syllabus questions and facilitate enrollment registration.',
                      '完课后 4 小时内发起回访沟通，收集课堂体验反馈，解答学费与课表疑问，促进签约预缴。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      '4-hour post-class golden conversion window; mandatory prompt action before intent cools down.',
                      '完课后 4 小时黄金关单转化窗口；未在规定时间内回访触发超期警告。'
                    )}
                  </td>
                </tr>

                {/* 7. Enrolled */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">07</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-green-100 text-green-800 border-green-300' : 'bg-green-950/60 text-green-300 border-green-800'
                    }`}>
                      {t('Enrolled', '已报名签约')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Tuition payment confirmed and student registration finalized. Commercial opportunity closed-won.',
                      '学费全额或定金缴纳确认，正式办理注册入学，实现商业闭环与赢单成单。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Record enrolled class code and revenue amount; register student profile in LMS and dispatch official textbooks.',
                      '登记报读班级编码（enrolledClass）与实收金额（revenue）；办理 LMS 教务建档与实体教材寄送。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      'Record outcome = "Enrolled" and revenue; handoff to teaching & student affairs administration.',
                      '归档 outcome 与成单流水，完成向授课教师与教务班主任的交接归档。'
                    )}
                  </td>
                </tr>

                {/* 8. Lost */}
                <tr>
                  <td className="p-2.5 font-mono text-center font-bold text-slate-400">08</td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                      isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {t('Lost', '流失')}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {t(
                      'Explicit budget incompatibility, schedule conflict, or demoted by R6 circuit breaker (≥3 unanswered dials).',
                      '学员明确暂无预算/时间冲突，或累计 ≥3 次外呼未接通触发 R6 止损熔断保护。'
                    )}
                  </td>
                  <td className="p-2.5 font-medium text-slate-700 dark:text-slate-200">
                    👉 {t(
                      'Archive lead with detailed lost reason memo; enroll in low-frequency monthly newsletter & scholarship updates.',
                      '记录流失核心原因备忘；移出日常外呼待办，归入公共培育池定期推送奖学金动态。'
                    )}
                  </td>
                  <td className="p-2.5 text-slate-500">
                    ⏱️ {t(
                      '30-day nurture cooling cycle; customer re-engagement automatically triggers priority resurrection.',
                      '30 天冷池培育休眠期；若客户在前端重新测评或咨询，系统自动唤醒为复活潜客。'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CHAPTER 6: Dynamic Cadence & SLA */}
        <section id="chapter-6" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-6',
            <Clock className="w-4 h-4" />,
            'Chapter 6: Dynamic Two-Stage Cadence & SLA Lifecycles',
            '第 6 章：客户评级与动态 SLA 履约机制',
            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
            ''
          )}

          <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              {t(
                'UPER CRM overcomes static expiration alarms with an adaptive two-stage cadence engine:',
                'UPER CRM 杜绝传统系统“一次超期、永久超期”的假警报弊病，采用了两段式动态履约引擎：'
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl border ${isLight ? 'bg-rose-50/50 border-rose-200' : 'bg-rose-950/20 border-rose-900'}`}>
                <h4 className="font-bold text-xs text-rose-800 dark:text-rose-400 mb-1.5 flex items-center gap-1.5">
                  <span>{t('⚡ Stage 1: First Response SLA (FRT)', '⚡ 阶段 1：首响应时效 (First Response SLA)')}</span>
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                  {t(
                    'Active when lead is uncontacted (Touch Count = 0). Measures speed to lead according to Tier:',
                    '学员刚入库、尚未联系（Touch = 0）时生效。根据客户 Tier 评级承诺响应窗口：'
                  )}
                </p>
                <ul className="space-y-1 text-[11px] list-disc list-inside">
                  <li><b>Hot (Tier 1)</b>：{t('Default 3 Hours mandatory outreach window.', '缺省 3 小时 内必须完成首联。')}</li>
                  <li><b>Warm (Tier 2/3)</b>：{t('Default 24 Hours outreach window.', '缺省 24 小时 响应。')}</li>
                  <li><b>Cold / School</b>：{t('Default 48 Hours outreach window.', '缺省 48 小时 响应。')}</li>
                </ul>
              </div>

              <div className={`p-4 rounded-xl border ${isLight ? 'bg-blue-50/50 border-blue-200' : 'bg-blue-950/20 border-blue-900'}`}>
                <h4 className="font-bold text-xs text-blue-800 dark:text-blue-400 mb-1.5 flex items-center gap-1.5">
                  <span>{t('📅 Stage 2: Scheduled Appointment Cadence', '📅 阶段 2：约定下次联系时钟 (Next Cadence)')}</span>
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                  {t(
                    'Upon recording initial outreach, First Response SLA completes and transitions to scheduled appointment tracking:',
                    '一旦顾问登记首次沟通记录，首响 SLA 宣布履约归档，时钟自动演进为：'
                  )}
                </p>
                <ul className="space-y-1 text-[11px] list-disc list-inside">
                  <li><b>{t('Scheduled Follow-up', '有约定时间')}</b>：{t('Counts down to agreed appointment timestamp.', '精准倒计时至约定时间，超期才报警。')}</li>
                  <li><b>{t('Inactivity Watchdog', '未设具体时间')}</b>：{t('Alerts after 24h/48h of inactivity.', '看门狗启动，Hot 超过 24h 自动提示需跟进。')}</li>
                  <li><b>{t('Unanswered Call Retry', '未接通呼叫')}</b>：{t('Enforces 4-hour cooling interval before next dial.', '自动触发 4 小时冷却，避免同一天内密集呼叫。')}</li>
                </ul>
              </div>
            </div>

            <div className={`p-3 rounded-xl border text-[11px] ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
            }`}>
              🌙 <b>{t('Business Hours & Grace Period (09:00 ~ 20:00)', '工作时间保护机制 (09:00 ~ 20:00)')}</b>：
              {t(
                'Inquiries submitted after 20:00 WIB or on non-working days roll over to 10:00 AM next business morning without penalizing consultant SLA compliance.',
                '在晚上 20:00 之后或休息日提交的咨询，系统自动标注为次日 10:00 待办，不计入夜间超时考核，既符合商务礼节又保证考核客观公正。'
              )}
            </div>
          </div>
        </section>

        {/* CHAPTER 7: Daily Sales SOP */}
        <section id="chapter-7" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-7',
            <PhoneCall className="w-4 h-4" />,
            'Chapter 7: Consultant Daily Standard Operating Procedure (SOP)',
            '第 7 章：课程顾问日常作业标准流程 (SOP)',
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
            ''
          )}

          <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              💡 {t('Daily 09:00 AM Call Routine via Multi-Filter Batching:', '每日 09:00 顾问标准化作业三步规程（运用表头多维筛选高效批处理）：')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-rose-700 dark:text-rose-400 mb-1">{t('Step 1: Overdue Urgent Recovery', '第 1 步：优先响应逾期待办')}</div>
                <p className="text-[11px] text-slate-500">
                  {t('Filter by Overdue SLA to resolve expired first contacts or overdue scheduled calls.', '选用“仅看逾期待办”筛选条件，优先处置超期未首联或未按时履约的紧急生源。')}
                </p>
              </div>
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-amber-700 dark:text-amber-400 mb-1">{t('Step 2: Fulfill Scheduled Commitments', '第 2 步：按时兑现今日约定')}</div>
                <p className="text-[11px] text-slate-500">
                  {t('Filter by Due Today to execute agreed appointments set during previous touches.', '选用“今日约定跟进”筛选条件，集中履约此前已与学员约定今日回访的沟通任务。')}
                </p>
              </div>
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">{t('Step 3: Clear Fresh Inbound Pipeline', '第 3 步：及时沟通新增生源')}</div>
                <p className="text-[11px] text-slate-500">
                  {t('Filter by New FRT to initiate WhatsApp greetings within the 3-hour golden window.', '选用“待初访首联”筛选条件，在 3 小时规定响应时效窗口内完成新入库生源首次沟通。')}
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-1">
                📝 {t('Follow-up Log Entry Requirements:', '跟进工单登记规范与标准动作：')}
              </h4>
              <p className="text-[11px] text-slate-500 mb-2">
                {t('Following each communication, slide out the lead drawer and complete the following 3 fields:', '每次沟通完毕后，展开右侧跟进详情抽屉，必须完整填报以下 3 项关键字段：')}
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px]">
                <li><b>{t('Connect Status', '接通状态 (connectStatus)')}</b>：{t('Record Connected, No Response, or Wrong Number accurately.', '准确登记 Connected（已接通）、No Response（未接通）或 Wrong Number（号码有误）；')}</li>
                <li><b>{t('Scheduled Follow-up Date', '预约下次沟通时间 (nextFollowUpAt)')}</b>：{t('Specify date and time to drive the appointment countdown clock.', '如与客户达成后续沟通意向，必须选定精准预约时点，以驱动履约倒计时时钟；')}</li>
                <li><b>{t('Next Action Memo', '下次回访待办内容 (nextAction)')}</b>：{t('State exact deliverable (e.g., Send weekend PIK class schedule).', '明确登记核心待办事项（如“发送周六PIK校区排期与试听指引”），实时在工作台看板展示。')}</li>
              </ol>
            </div>
          </div>
        </section>

        {/* CHAPTER 8: Standard Data Dictionary */}
        <section id="chapter-8" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-8',
            <Database className="w-4 h-4" />,
            'Chapter 8: Standard System Data Dictionary & Field Specifications',
            '第 8 章：标准数据字典与核心字段规范',
            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
            '',
            'Standardized data dictionary strictly synchronized with system software entities (CrmLeadRecord & FollowUpLog). Details data types, enum bounds, and business definitions.',
            '严格与软件系统底层实体（CrmLeadRecord 与 FollowUpLog）保持一致的标准数据字典，详述真实字段名称、数据类型、枚举值范围及业务流转定义。'
          )}

          {/* Chapter 8 Field Search & Category Toolbar */}
          <div className={`p-3.5 rounded-2xl border mb-5 space-y-2.5 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {[
                  { id: 'all', count: 49, labelEn: 'All Fields (49)', labelZh: '全部字段 (49)' },
                  { id: 'ingestion', count: 7, labelEn: '1. Ingestion (7)', labelZh: '1. 触点与来源 (7)' },
                  { id: 'profile', count: 7, labelEn: '2. Profile (7)', labelZh: '2. 客户画像 (7)' },
                  { id: 'academic', count: 10, labelEn: '3. Academic (10)', labelZh: '3. 测评定级 (10)' },
                  { id: 'cadence', count: 18, labelEn: '4. Cadence & SLA (18)', labelZh: '4. 评级与SLA (18)' },
                  { id: 'touch', count: 7, labelEn: '5. Logs & Outcomes (7)', labelZh: '5. 工单与转化 (7)' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setDictCategory(cat.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      dictCategory === cat.id
                        ? 'bg-primary-600 text-white shadow-xs font-bold'
                        : isLight 
                          ? 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80' 
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {t(cat.labelEn, cat.labelZh)}
                  </button>
                ))}
              </div>

              {/* Quick Field Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={dictSearch}
                  onChange={(e) => setDictSearch(e.target.value)}
                  placeholder={t('Search fields (e.g. buyingSignal, sla)...', '速查字段 (如 buyingSignal, sla)...')}
                  className={`w-full text-xs rounded-xl pl-8 pr-7 py-1.5 border outline-none font-medium transition-all ${
                    isLight 
                      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary-500 shadow-2xs' 
                      : 'bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-primary-500'
                  }`}
                />
                {dictSearch && (
                  <button
                    type="button"
                    onClick={() => setDictSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                    title={t('Clear search', '清空')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Status Summary & Reset */}
            {(dictSearch || dictCategory !== 'all') && (
              <div className="text-[11px] text-primary-600 dark:text-primary-400 font-medium flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span>
                    {dictSearch ? (
                      <>{t('Keyword:', '关键字:')} <b>"{dictSearch}"</b> · </>
                    ) : null}
                    {t('Category:', '分类:')} <b>{dictCategory === 'all' ? t('All', '全部') : dictCategory}</b> · {
                      (() => {
                        const q = dictSearch.trim().toLowerCase();
                        const rawSections = [
                          {
                            id: 'ingestion',
                            fields: [
                              { name: 'id', type: 'string', format: 'UPER-YYYYMMDD-XXX', defEn: 'Global unique lead record identifier; sequential business primary key.', defZh: '线索全局唯一业务流水编号，以系统日期与序列号生成，构成主索引。' },
                              { name: 'entryPoint', type: 'string', format: '/assessment, /trial, /contact, etc.', defEn: 'Initial landing URL path where the inquiry originated.', defZh: '线索初次接入的门户网站落地页路径。' },
                              { name: 'campaign', type: 'string', format: 'Text identifier', defEn: 'Specific marketing campaign name or quarterly promotional tag.', defZh: '归属的市场推广活动名称或季度营销专案标识。' },
                              { name: 'placement', type: 'string', format: 'Text identifier', defEn: 'Advertising placement, banner location, or referral link touchpoint.', defZh: '前端广告版位、展位定位点或特定内容引导点位。' },
                              { name: 'hookType', type: 'HookType', format: 'hsk_assessment / trial_class / scholarship_materials / webinar / download_guide / referral', defEn: 'Marketing incentive hook that prompted customer form submission.', defZh: '触发学员主动登记的核心引导内容类型，决定顾问初访切入点。' },
                              { name: 'hookContext', type: 'HookContextType', format: 'campus_career_talk / paid_social / organic_dm / website / expo', defEn: 'Channel acquisition environment or event scene.', defZh: '触点来源的市场推广渠道场景画像。' },
                              { name: 'submittedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Submission timestamp in UTC, serving as the benchmark for First Response SLA.', defZh: '线索提交的时间戳，用作计算承诺首响应时效（FRT）的起始基准。' }
                            ]
                          },
                          {
                            id: 'profile',
                            fields: [
                              { name: 'fullName', type: 'string', format: 'text', defEn: 'Student full legal name or preferred honorific.', defZh: '学员真实姓名或常用称谓。' },
                              { name: 'whatsapp', type: 'string', format: '+62 812-xxxx-xxxx', defEn: 'Standardized WhatsApp contact number; primary deduplication key.', defZh: '国际标准格式 WhatsApp 号码，系统唯一去重主键与一键外呼依据。' },
                              { name: 'email', type: 'string', format: 'user@domain.com', defEn: 'Student contact email address; secondary index.', defZh: '电子邮箱地址，作为第二校验合并索引。' },
                              { name: 'parentContact', type: 'string (optional)', format: '+62 8xx-xxxx-xxxx', defEn: 'Parent or legal guardian contact for minor or high-school applicants.', defZh: '未成年或中学生申请人的家长联络方式。' },
                              { name: 'currentStatus', type: 'CurrentStatusType', format: 'Working professional / Fresh graduate / University student / High school student / Teacher or school staff / Other', defEn: 'Demographic profile segment; triggers R3 School tiering rule if institutional.', defZh: '学员社会身份画像，若为教职工或学校人员则触发 R3 机构分级。' },
                              { name: 'city', type: 'CityType', format: 'Jakarta / Other', defEn: 'Geographic territory (Jakarta Jabodetabek vs outer island regions).', defZh: '所在城市地理分类（雅加达大都会区 vs 印尼其他省市外岛）。' },
                              { name: 'mode', type: 'ModeType', format: 'Offline / Online / Not sure', defEn: 'Preferred instruction mode (PIK physical campus vs Zoom interactive live).', defZh: '意向授课交付模式（PIK校区线下实体面授 vs Zoom远程互动直播）。' }
                            ]
                          },
                          {
                            id: 'academic',
                            fields: [
                              { name: 'goal', type: 'GoalType', format: 'Work in China / Work at JV / Study in China / HSK certification / Improve skills / Other', defEn: 'Primary learning objective driving R4 baseline tier deduction.', defZh: '核心学习目标诉求，区分明确考证就业需求与泛兴趣需求。' },
                              { name: 'goals', type: 'GoalType[] (optional)', format: 'Array of GoalType', defEn: 'Collection of multiple selected academic objectives.', defZh: '多选学习目标集合，支持多重意向学员全面画像。' },
                              { name: 'reportedLevel', type: 'ReportedLevelType', format: 'Complete beginner / Beginner / Not sure / HSK 1 ~ 4+', defEn: 'Self-reported Chinese language proficiency registered at onboarding.', defZh: '学员初次登记自述的现有汉语能力水平。' },
                              { name: 'levelState', type: 'LevelStateType', format: 'ZERO / PARTIAL / KNOWN', defEn: 'Derived academic proficiency state governing Flag recommendations.', defZh: '推导学术认知状态，决定是否建议开展定级水平测试。' },
                              { name: 'quizScore', type: 'number (optional)', format: '0 ~ 100', defEn: 'Placement assessment diagnostic score (0 to 100).', defZh: '智能自测诊断试卷总得分（0~100）。' },
                              { name: 'totalQuestions', type: 'number (optional)', format: '11 / 50', defEn: 'Item count: screening 11, full 50. This is not maximum points.', defZh: '题数：快测11、完整50，不代表满分。' },
                              { name: 'quizMaxScore', type: 'number (optional)', format: '22 / 100', defEn: 'Maximum points: screening 22, full 100. Legacy records without this field have an unknown points scale.', defZh: '满分：快测22、完整100。历史记录缺少此字段时不能推断分值单位。' },
                              { name: 'quizBreakdown', type: 'object (optional)', format: '{ hsk1Correct, hsk2Correct, hsk3Correct }', defEn: 'Detailed accuracy breakdown by HSK level tier.', defZh: 'HSK 各等级对应题目的答题正确率分布明细。' },
                              { name: 'quizResultSummary', type: 'string (optional)', format: 'text', defEn: 'Algorithmic evaluation summary generated post-assessment.', defZh: '自测试卷提交后由系统自动化生成的学术诊断综述。' },
                              { name: 'levelConfirmed', type: 'string (optional)', format: 'HSK 1 / HSK 2 / HSK 3 / HSK 4+', defEn: 'Placement reference; assessment results describe paper thresholds and are not proficiency certification. Check levelSource and assessmentProvenance.', defZh: '分班参考；系统测评只描述本卷门槛，不代表能力认证。需结合levelSource与assessmentProvenance判断来源。' },
                              { name: 'levelSource', type: 'string (optional)', format: 'self / assessment / trial / mixed', defEn: 'Verification source underlying level confirmation.', defZh: '定级认定的数据凭据来源（自述/测试出分/试听完课/综合评定）。' }
                            ]
                          },
                          {
                            id: 'cadence',
                            fields: [
                              { name: 'tier', type: 'TierType', format: 'Hot / Warm-Offline / Warm-Online / School / Cold-Nurture', defEn: 'Current active lead qualification tier driving SLA priorities.', defZh: '当前生效的客户商业优先级分层评级，驱动首响应时效窗口。' },
                              { name: 'tierPredicted', type: 'TierType', format: 'Hot / Warm-Offline / Warm-Online / School / Cold-Nurture', defEn: 'Initial qualification tier predicted by the R1~R6 rule engine.', defZh: '算法规则链初次计算给出的系统推荐评级。' },
                              { name: 'tierConfirmed', type: 'TierType (optional)', format: 'Hot / Warm-Offline / Warm-Online / School / Cold-Nurture', defEn: 'Manual tier override confirmed by the course consultant.', defZh: '课程顾问根据沟通情况在抽屉中人工确认的核准分级。' },
                              { name: 'tierSource', type: 'string', format: 'predicted / sales_confirmed / behaviour_override / buying_signal', defEn: 'Mechanism determining current effective tier.', defZh: '当前生效分层认定的业务触发来源机制。' },
                              { name: 'tierUpdatedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the most recent tier adjustment.', defZh: '客户评级最近一次变更或调整的时间戳。' },
                              { name: 'flag', type: 'FlagType', format: 'Skip Assessment / Assessment Needed', defEn: 'Actionable assessment recommendation flag.', defZh: '学术定级建议标签（指导顾问必须推送测试或跳过直接排班）。' },
                              { name: 'slaDueTime', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'First Response SLA target due timestamp.', defZh: '首响应承诺履约截止时间戳，超期后在看板显示红标预警。' },
                              { name: 'currentStage', type: 'StageType', format: 'New / Contacted / Assessment Booked / Assessment Done / Trial Booked / Trial Attended / Enrolled / Lost', defEn: 'Active progression stage within the 8-stage conversion pipeline.', defZh: '客户生命周期当前所处的 8 大标准转化漏斗推进阶段。' },
                              { name: 'stageUpdatedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the latest pipeline stage progression.', defZh: '销售阶段最新流转更新时间戳。' },
                              { name: 'connectStatus', type: 'ConnectStatusType (opt)', format: 'Connected / No Response / Wrong Number / Interested', defEn: 'Connectivity outcome of the latest outbound outreach call.', defZh: '最近一次外呼触达接通判定结果。' },
                              { name: 'buyingSignal', type: 'BuyingSignalType', format: 'Asked price / Asked schedule / Asked payment / Ready to enroll / None yet', defEn: 'Detected buying intent signal; triggers R1 Hot upgrade.', defZh: '交互过程中捕获的核心商业购买信号，触发 R1 升档。' },
                              { name: 'buyingSignals', type: 'BuyingSignalType[] (opt)', format: 'Array of BuyingSignalType', defEn: 'Historical record of all detected buying signals across touches.', defZh: '多轮沟通中捕获的历史商业购买信号汇总。' },
                              { name: 'touchCount', type: 'number', format: '0, 1, 2, 3...', defEn: 'Cumulative contact attempts; ≥3 unanswered attempts triggers R6 demotion.', defZh: '累计跟进次数，连续 3 次未接通触发 R6 熔断保护。' },
                              { name: 'owner', type: 'string', format: 'Sales A / Sales B / B2B owner / Online Ops', defEn: 'Responsible course consultant or account executive.', defZh: '当前归属的课程顾问或业务责任人。' },
                              { name: 'nextAction', type: 'string (optional)', format: 'text', defEn: 'Specific actionable task description displayed on the workbench.', defZh: '顾问填写的下次回访具体待办备忘事项说明。' },
                              { name: 'nextFollowUpAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Scheduled callback timestamp for Stage 2 cadence countdown clock.', defZh: '约定下次回访时间戳，驱动履约倒计时时钟。' },
                              { name: 'reminderSent', type: 'boolean (optional)', format: 'true / false', defEn: 'Whether 4-hour pre-class reminder message has been dispatched.', defZh: '开课前 4 小时就绪提醒发送标记。' },
                              { name: 'attendanceConfirmed', type: 'boolean (optional)', format: 'true / false', defEn: 'Whether student participation in trial cohort has been verified.', defZh: '学员试听课程实际出席确认标识。' }
                            ]
                          },
                          {
                            id: 'touch',
                            fields: [
                              { name: 'outcome', type: 'OutcomeType (optional)', format: 'Enrolled / Paid / Hold / Lost', defEn: 'Final commercial conversion conclusion.', defZh: '最终业务成单或终止状态。' },
                              { name: 'enrolledClass', type: 'string (optional)', format: 'text', defEn: 'Official course or cohort identifier upon confirmed enrollment.', defZh: '正式注册报读的班级代码与课程规格。' },
                              { name: 'revenue', type: 'number (optional)', format: 'IDR numeric value', defEn: 'Actual paid tuition revenue amount in Indonesian Rupiah.', defZh: '实收学费流水金额（印尼盾 IDR）。' },
                              { name: 'lastContactedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the most recent outreach interaction.', defZh: '最近一次有效沟通时间戳。' },
                              { name: 'updatedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the latest record mutation or modification.', defZh: '客户档案最后维护修改时间戳。' },
                              { name: 'followUpLogs', type: 'FollowUpLog[]', format: 'Array of FollowUpLog objects', defEn: 'Sequential audit trail of all follow-up touchpoints.', defZh: '回访沟通工单历史明细流，按时间倒序排列。' },
                              { name: 'chatTranscript', type: 'ChatTranscriptMessage[]', format: 'Array of { id, role, content, timestamp }', defEn: 'Full conversation transcript with the website AI counselor before form ingestion.', defZh: '生源表单入库前与官网在线智能客服的多轮交互转录记录。' }
                            ]
                          }
                        ];

                        const matchingCount = rawSections
                          .filter(s => dictCategory === 'all' || dictCategory === s.id)
                          .reduce((acc, s) => {
                            if (!q) return acc + s.fields.length;
                            return acc + s.fields.filter(f =>
                              f.name.toLowerCase().includes(q) ||
                              f.type.toLowerCase().includes(q) ||
                              f.format.toLowerCase().includes(q) ||
                              f.defEn.toLowerCase().includes(q) ||
                              f.defZh.includes(q)
                            ).length;
                          }, 0);

                        return matchingCount;
                      })()
                    } {t('fields found', '个匹配字段')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setDictSearch(''); setDictCategory('all'); }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  {t('Reset Filters', '重置所有过滤')}
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Filterable Dictionary Sections */}
          {(() => {
            const rawSections = [
              {
                id: 'ingestion',
                dotColor: 'bg-blue-500',
                textColor: 'text-blue-600 dark:text-blue-400',
                titleEn: '1. Ingestion Touchpoints & Marketing Channel Attributes',
                titleZh: '1. 渠道触点与营销来源实体 (Ingestion & Source Attributes)',
                fields: [
                  { name: 'id', type: 'string', format: 'UPER-YYYYMMDD-XXX', defEn: 'Global unique lead record identifier; sequential business primary key.', defZh: '线索全局唯一业务流水编号，以系统日期与序列号生成，构成主索引。' },
                  { name: 'entryPoint', type: 'string', format: '/assessment, /trial, /contact, etc.', defEn: 'Initial landing URL path where the inquiry originated.', defZh: '线索初次接入的门户网站落地页路径。' },
                  { name: 'campaign', type: 'string', format: 'Text identifier', defEn: 'Specific marketing campaign name or quarterly promotional tag.', defZh: '归属的市场推广活动名称或季度营销专案标识。' },
                  { name: 'placement', type: 'string', format: 'Text identifier', defEn: 'Advertising placement, banner location, or referral link touchpoint.', defZh: '前端广告版位、展位定位点或特定内容引导点位。' },
                  { name: 'hookType', type: 'HookType', format: 'hsk_assessment / trial_class / scholarship_materials / webinar / download_guide / referral', defEn: 'Marketing incentive hook that prompted customer form submission.', defZh: '触发学员主动登记的核心引导内容类型，决定顾问初访切入点。' },
                  { name: 'hookContext', type: 'HookContextType', format: 'campus_career_talk / paid_social / organic_dm / website / expo', defEn: 'Channel acquisition environment or event scene.', defZh: '触点来源的市场推广渠道场景画像。' },
                  { name: 'submittedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Submission timestamp in UTC, serving as the benchmark for First Response SLA.', defZh: '线索提交的时间戳，用作计算承诺首响应时效（FRT）的起始基准。' }
                ]
              },
              {
                id: 'profile',
                dotColor: 'bg-indigo-500',
                textColor: 'text-indigo-600 dark:text-indigo-400',
                titleEn: '2. Student Profile & Demographic Attributes',
                titleZh: '2. 学员客户基础档案实体 (Student Profile & Demographics)',
                fields: [
                  { name: 'fullName', type: 'string', format: 'text', defEn: 'Student full legal name or preferred honorific.', defZh: '学员真实姓名或常用称谓。' },
                  { name: 'whatsapp', type: 'string', format: '+62 812-xxxx-xxxx', defEn: 'Standardized WhatsApp contact number; primary deduplication key.', defZh: '国际标准格式 WhatsApp 号码，系统唯一去重主键与一键外呼依据。' },
                  { name: 'email', type: 'string', format: 'user@domain.com', defEn: 'Student contact email address; secondary index.', defZh: '电子邮箱地址，作为第二校验合并索引。' },
                  { name: 'parentContact', type: 'string (optional)', format: '+62 8xx-xxxx-xxxx', defEn: 'Parent or legal guardian contact for minor or high-school applicants.', defZh: '未成年或中学生申请人的家长联络方式。' },
                  { name: 'currentStatus', type: 'CurrentStatusType', format: 'Working professional / Fresh graduate / University student / High school student / Teacher or school staff / Other', defEn: 'Demographic profile segment; triggers R3 School tiering rule if institutional.', defZh: '学员社会身份画像，若为教职工或学校人员则触发 R3 机构分级。' },
                  { name: 'city', type: 'CityType', format: 'Jakarta / Other', defEn: 'Geographic territory (Jakarta Jabodetabek vs outer island regions).', defZh: '所在城市地理分类（雅加达大都会区 vs 印尼其他省市外岛）。' },
                  { name: 'mode', type: 'ModeType', format: 'Offline / Online / Not sure', defEn: 'Preferred instruction mode (PIK physical campus vs Zoom interactive live).', defZh: '意向授课交付模式（PIK校区线下实体面授 vs Zoom远程互动直播）。' }
                ]
              },
              {
                id: 'academic',
                dotColor: 'bg-amber-500',
                textColor: 'text-amber-600 dark:text-amber-400',
                titleEn: '3. Academic Intent & Placement Diagnostic Attributes',
                titleZh: '3. 意向诊断与学术指标 (Academic Intent & Diagnostics)',
                fields: [
                  { name: 'goal', type: 'GoalType', format: 'Work in China / Work at JV / Study in China / HSK certification / Improve skills / Other', defEn: 'Primary learning objective driving R4 baseline tier deduction.', defZh: '核心学习目标诉求，区分明确考证就业需求与泛兴趣需求。' },
                  { name: 'goals', type: 'GoalType[] (optional)', format: 'Array of GoalType', defEn: 'Collection of multiple selected academic objectives.', defZh: '多选学习目标集合，支持多重意向学员全面画像。' },
                  { name: 'reportedLevel', type: 'ReportedLevelType', format: 'Complete beginner / Beginner / Not sure / HSK 1 ~ 4+', defEn: 'Self-reported Chinese language proficiency registered at onboarding.', defZh: '学员初次登记自述的现有汉语能力水平。' },
                  { name: 'levelState', type: 'LevelStateType', format: 'ZERO / PARTIAL / KNOWN', defEn: 'Derived academic proficiency state governing Flag recommendations.', defZh: '推导学术认知状态，决定是否建议开展定级水平测试。' },
                  { name: 'quizScore', type: 'number (optional)', format: '0 ~ 100', defEn: 'Placement assessment diagnostic score (0 to 100).', defZh: '智能自测诊断试卷总得分（0~100）。' },
                  { name: 'totalQuestions', type: 'number (optional)', format: '11 / 50', defEn: 'Item count: screening 11, full 50. This is not maximum points.', defZh: '题数：快测11、完整50，不代表满分。' },
                              { name: 'quizMaxScore', type: 'number (optional)', format: '22 / 100', defEn: 'Maximum points: screening 22, full 100. Legacy records without this field have an unknown points scale.', defZh: '满分：快测22、完整100。历史记录缺少此字段时不能推断分值单位。' },
                  { name: 'quizBreakdown', type: 'object (optional)', format: '{ hsk1Correct, hsk2Correct, hsk3Correct }', defEn: 'Detailed accuracy breakdown by HSK level tier.', defZh: 'HSK 各等级对应题目的答题正确率分布明细。' },
                  { name: 'quizResultSummary', type: 'string (optional)', format: 'text', defEn: 'Algorithmic evaluation summary generated post-assessment.', defZh: '自测试卷提交后由系统自动化生成的学术诊断综述。' },
                  { name: 'levelConfirmed', type: 'string (optional)', format: 'HSK 1 / HSK 2 / HSK 3 / HSK 4+', defEn: 'Placement reference; assessment results describe paper thresholds and are not proficiency certification. Check levelSource and assessmentProvenance.', defZh: '分班参考；系统测评只描述本卷门槛，不代表能力认证。需结合levelSource与assessmentProvenance判断来源。' },
                  { name: 'levelSource', type: 'string (optional)', format: 'self / assessment / trial / mixed', defEn: 'Verification source underlying level confirmation.', defZh: '定级认定的数据凭据来源（自述/测试出分/试听完课/综合评定）。' }
                ]
              },
              {
                id: 'cadence',
                dotColor: 'bg-emerald-500',
                textColor: 'text-emerald-600 dark:text-emerald-400',
                titleEn: '4. Qualification Tiers, Flags & Cadence Governance',
                titleZh: '4. 评级推演、行为标签与履约管控 (Tiers, Flags & Cadence)',
                fields: [
                  { name: 'tier', type: 'TierType', format: 'Hot / Warm-Offline / Warm-Online / School / Cold-Nurture', defEn: 'Current active lead qualification tier driving SLA priorities.', defZh: '当前生效的客户商业优先级分层评级，驱动首响应时效窗口。' },
                  { name: 'tierPredicted', type: 'TierType', format: 'Hot / Warm-Offline / Warm-Online / School / Cold-Nurture', defEn: 'Initial qualification tier predicted by the R1~R6 rule engine.', defZh: '算法规则链初次计算给出的系统推荐评级。' },
                  { name: 'tierConfirmed', type: 'TierType (optional)', format: 'Hot / Warm-Offline / Warm-Online / School / Cold-Nurture', defEn: 'Manual tier override confirmed by the course consultant.', defZh: '课程顾问根据沟通情况在抽屉中人工确认的核准分级。' },
                  { name: 'tierSource', type: 'string', format: 'predicted / sales_confirmed / behaviour_override / buying_signal', defEn: 'Mechanism determining current effective tier.', defZh: '当前生效分层认定的业务触发来源机制。' },
                  { name: 'tierUpdatedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the most recent tier adjustment.', defZh: '客户评级最近一次变更或调整的时间戳。' },
                  { name: 'flag', type: 'FlagType', format: 'Skip Assessment / Assessment Needed', defEn: 'Actionable assessment recommendation flag.', defZh: '学术定级建议标签（指导顾问必须推送测试或跳过直接排班）。' },
                  { name: 'slaDueTime', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'First Response SLA target due timestamp.', defZh: '首响应承诺履约截止时间戳，超期后在看板显示红标预警。' },
                  { name: 'currentStage', type: 'StageType', format: 'New / Contacted / Assessment Booked / Assessment Done / Trial Booked / Trial Attended / Enrolled / Lost', defEn: 'Active progression stage within the 8-stage conversion pipeline.', defZh: '客户生命周期当前所处的 8 大标准转化漏斗推进阶段。' },
                  { name: 'stageUpdatedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the latest pipeline stage progression.', defZh: '销售阶段最新流转更新时间戳。' },
                  { name: 'connectStatus', type: 'ConnectStatusType (opt)', format: 'Connected / No Response / Wrong Number / Interested', defEn: 'Connectivity outcome of the latest outbound outreach call.', defZh: '最近一次外呼触达接通判定结果。' },
                  { name: 'buyingSignal', type: 'BuyingSignalType', format: 'Asked price / Asked schedule / Asked payment / Ready to enroll / None yet', defEn: 'Detected buying intent signal; triggers R1 Hot upgrade.', defZh: '交互过程中捕获的核心商业购买信号，触发 R1 升档。' },
                  { name: 'buyingSignals', type: 'BuyingSignalType[] (opt)', format: 'Array of BuyingSignalType', defEn: 'Historical record of all detected buying signals across touches.', defZh: '多轮沟通中捕获的历史商业购买信号汇总。' },
                  { name: 'touchCount', type: 'number', format: '0, 1, 2, 3...', defEn: 'Cumulative contact attempts; ≥3 unanswered attempts triggers R6 demotion.', defZh: '累计跟进次数，连续 3 次未接通触发 R6 熔断保护。' },
                  { name: 'owner', type: 'string', format: 'Sales A / Sales B / B2B owner / Online Ops', defEn: 'Responsible course consultant or account executive.', defZh: '当前归属的课程顾问或业务责任人。' },
                  { name: 'nextAction', type: 'string (optional)', format: 'text', defEn: 'Specific actionable task description displayed on the workbench.', defZh: '顾问填写的下次回访具体待办备忘事项说明。' },
                  { name: 'nextFollowUpAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Scheduled callback timestamp for Stage 2 cadence countdown clock.', defZh: '约定下次回访时间戳，驱动履约倒计时时钟。' },
                  { name: 'reminderSent', type: 'boolean (optional)', format: 'true / false', defEn: 'Whether 4-hour pre-class reminder message has been dispatched.', defZh: '开课前 4 小时就绪提醒发送标记。' },
                  { name: 'attendanceConfirmed', type: 'boolean (optional)', format: 'true / false', defEn: 'Whether student participation in trial cohort has been verified.', defZh: '学员试听课程实际出席确认标识。' }
                ]
              },
              {
                id: 'touch',
                dotColor: 'bg-rose-500',
                textColor: 'text-rose-600 dark:text-rose-400',
                titleEn: '5. Business Outcomes, Follow-up Logs & System Metadata',
                titleZh: '5. 业务转化结果、回访工单明细与系统元数据 (Outcomes & Logs)',
                fields: [
                  { name: 'outcome', type: 'OutcomeType (optional)', format: 'Enrolled / Paid / Hold / Lost', defEn: 'Final commercial conversion conclusion.', defZh: '最终业务成单或终止状态。' },
                  { name: 'enrolledClass', type: 'string (optional)', format: 'text', defEn: 'Official course or cohort identifier upon confirmed enrollment.', defZh: '正式注册报读的班级代码与课程规格。' },
                  { name: 'revenue', type: 'number (optional)', format: 'IDR numeric value', defEn: 'Actual paid tuition revenue amount in Indonesian Rupiah.', defZh: '实收学费流水金额（印尼盾 IDR）。' },
                  { name: 'lastContactedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the most recent outreach interaction.', defZh: '最近一次有效沟通时间戳。' },
                  { name: 'updatedAt', type: 'string (ISO 8601)', format: 'YYYY-MM-DDTHH:mm:ssZ', defEn: 'Timestamp of the latest record mutation or modification.', defZh: '客户档案最后维护修改时间戳。' },
                  { name: 'followUpLogs', type: 'FollowUpLog[]', format: 'Array of FollowUpLog objects', defEn: 'Sequential audit trail of all follow-up touchpoints.', defZh: '回访沟通工单历史明细流，按时间倒序排列。' },
                  { name: 'chatTranscript', type: 'ChatTranscriptMessage[]', format: 'Array of { id, role, content, timestamp }', defEn: 'Full conversation transcript with the website AI counselor before form ingestion.', defZh: '生源表单入库前与官网在线智能客服的多轮交互转录记录。' }
                ]
              }
            ];

            const q = dictSearch.trim().toLowerCase();
            const activeSections = rawSections
              .filter(sec => dictCategory === 'all' || dictCategory === sec.id)
              .map(sec => {
                if (!q) return sec;
                const filteredFields = sec.fields.filter(f =>
                  f.name.toLowerCase().includes(q) ||
                  f.type.toLowerCase().includes(q) ||
                  f.format.toLowerCase().includes(q) ||
                  f.defEn.toLowerCase().includes(q) ||
                  f.defZh.includes(q)
                );
                return { ...sec, fields: filteredFields };
              })
              .filter(sec => sec.fields.length > 0);

            if (activeSections.length === 0) {
              return (
                <div className={`p-8 text-center rounded-2xl border ${
                  isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                }`}>
                  <Database className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-1">
                    {t('No matching data fields found', '未检索到相关数据字典字段')}
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {t(`No fields match query "${dictSearch}". Try searching for field names (e.g. tier, hookType, sla) or reset filters.`, `未匹配到与 "${dictSearch}" 相关的字段。可尝试输入字段名 (如 tier, hookType, sla) 或重置过滤。`)}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setDictSearch(''); setDictCategory('all'); }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white cursor-pointer"
                  >
                    {t('Reset Filters', '清空检索条件')}
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-6 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {activeSections.map(sec => (
                  <div key={sec.id}>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${sec.dotColor}`}></span>
                        <span>{t(sec.titleEn, sec.titleZh)}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {sec.fields.length} {t('fields', '个字段')}
                      </span>
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-left border rounded-xl overflow-hidden">
                        <thead className={isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-200'}>
                          <tr>
                            <th className="p-2 font-bold font-mono w-[140px]">{t('Field Name', '真实字段名')}</th>
                            <th className="p-2 font-bold w-[120px]">{t('Type', '数据类型')}</th>
                            <th className="p-2 font-bold w-[220px]">{t('Enum Values / Format', '枚举取值范围 / 格式规范')}</th>
                            <th className="p-2 font-bold">{t('Business Definition', '业务定义与用途说明')}</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isLight ? 'divide-slate-200 bg-white' : 'divide-slate-800 bg-slate-900'}`}>
                          {sec.fields.map(f => {
                            const isCopied = copiedId === `field-${f.name}`;
                            return (
                              <tr key={f.name} className={isLight ? 'hover:bg-slate-50/80 transition-colors' : 'hover:bg-slate-800/40 transition-colors'}>
                                <td className="p-2 font-mono font-bold align-top">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyField(f.name)}
                                    className={`inline-flex items-center gap-1 group text-left cursor-pointer transition-all ${sec.textColor}`}
                                    title={t('Click to copy field name', '点击复制真实字段名')}
                                  >
                                    <span>{f.name}</span>
                                    {isCopied ? (
                                      <Check className="w-3 h-3 text-emerald-500 shrink-0 inline" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-70 shrink-0 text-slate-400 inline" />
                                    )}
                                  </button>
                                </td>
                                <td className="p-2 font-mono align-top text-[10px] text-slate-600 dark:text-slate-300">{f.type}</td>
                                <td className="p-2 font-mono text-[10px] align-top text-slate-500 break-words">{f.format}</td>
                                <td className="p-2 align-top text-[11px] leading-relaxed">{t(f.defEn, f.defZh)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>

        {/* CHAPTER 9: FAQ & Scripts */}
        <section id="chapter-9" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-9',
            <HelpCircle className="w-4 h-4" />,
            'Chapter 9: Frequently Asked Questions & Standard Outreach Templates',
            '第 9 章：业务常见问答与官方标准沟通范本',
            'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
            '',
            undefined,
            undefined,
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => {
                  if (expandedFaqIds.length === 5) {
                    setExpandedFaqIds([]);
                  } else {
                    setExpandedFaqIds(['faq-1', 'faq-2', 'faq-3', 'faq-4', 'faq-5']);
                  }
                }}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {expandedFaqIds.length === 5 ? t('Collapse All FAQs', '收起全部问答') : t('Expand All FAQs', '展开全部问答')}
              </button>
            </div>
          )}

          {/* Interactive Collapsible FAQ Accordion */}
          <div className="space-y-3 mb-6">
            {[
              {
                id: 'faq-1',
                qEn: 'Q1: Why does a lead show an overdue alert even after initial contact?',
                qZh: 'Q1：为什么在完成初次沟通后，系统界面仍然显示超时预警？',
                tag: 'SLA & 预约',
                ansEn: 'Explanation: Please verify that you recorded a Scheduled Follow-up Date (nextFollowUpAt) in the lead drawer. If you spoke with the student and agreed to reconnect tomorrow but did not set a scheduled timestamp, the system defaults to the inactivity watchdog rule (24h alert for Hot leads). Specifying the appointment date transitions the lead to an active appointment countdown.',
                ansZh: '解答：请确认顾问是否在跟进抽屉中完整登记了“预约下次沟通时间（nextFollowUpAt）”。若顾问已与学员完成通话并约定后续再访，但未在记录中选定具体预约时间戳，系统因缺少履约目标时间，超出时限后将自动触发停滞看门狗预警。顾问只需在跟进抽屉中选定预约时点并保存，系统即自动转入准确的预约履约倒计时。'
              },
              {
                id: 'faq-2',
                qEn: 'Q2: How are inquiries submitted late at night (e.g., 23:00 WIB) evaluated?',
                qZh: 'Q2：晚间非营业时段（如 23:00 WIB）提交的生源，次日是否会计入超时考核？',
                tag: '营业时段',
                ansEn: 'Explanation: The system incorporates operating business hours (09:00 ~ 20:00 WIB). Inquiries arriving outside these hours automatically enter grace period protection, extending first response compliance to 10:00 AM the following morning without impacting consultant performance metrics.',
                ansZh: '解答：系统内置标准营业时间（09:00 ~ 20:00 WIB）。非营业时段进来的表单自动获得免打扰宽限保护，只要在次日上午 10:00 前完成首访沟通即为完全合规，不影响顾问的考勤与履约率统计。'
              },
              {
                id: 'faq-3',
                qEn: 'Q3: How to open exported CSV files in Excel or spreadsheet software without encoding issues?',
                qZh: 'Q3：导出的 CSV 文件如何在各类表格软件中正常打开且避免字符编码异常？',
                tag: '数据导出',
                ansEn: 'Explanation: The CSV export utilizes standard UTF-8 with BOM encoding. When opened in Microsoft Excel, Apple Numbers, or cloud spreadsheets, both Indonesian and Chinese characters render cleanly without character corruption.',
                ansZh: '解答：系统导出的 CSV 采用国际标准 UTF-8 带 BOM 编码。直接在 Microsoft Excel、Apple Numbers 或各类在线云端表格中打开，印尼语和中文字符均可清晰呈现，杜绝乱码。'
              },
              {
                id: 'faq-4',
                qEn: 'Q4: How does the R6 circuit breaker demotion activate and how to revive dormant leads?',
                qZh: 'Q4：R6 熔断降档机制是如何触发的？流失或未接通潜客如何重新激活？',
                tag: '算法熔断',
                ansEn: 'Explanation: When an advisor records 3 consecutive "No Response" outreach attempts without successful engagement, the system automatically triggers rule R6, moving the customer to Cold-Nurture and pausing daily call alarms to prevent annoyance. If the student submits a new inquiry form, re-takes the quiz diagnostic, or message WhatsApp, the system automatically tags them as a Revived Lead and starts an urgent 30-minute response window.',
                ansZh: '解答：当顾问连续 3 次外呼触达均标记为“未接通 (No Response)”且无双向建联时，系统自动执行 R6 熔断规则，将其降级至 Cold-Nurture 并移出日常紧急外呼队列。若该学员后续在官网重新提交表单、重新参加测评或通过 WhatsApp 主动留言，系统将自动标记为“复活潜客”，并启动高优先级的 30 分钟首响应窗口。'
              },
              {
                id: 'faq-5',
                qEn: 'Q5: How can a lead be reassigned to a different course consultant or B2B specialist?',
                qZh: 'Q5：如何将线索快速流转分派给其他学术顾问或 B2B 大宗负责人？',
                tag: '线索流转',
                ansEn: 'Explanation: In both the Standard View and Expanded View tables, the last column displays a dedicated Attribution Advisor (Owner) selector. Advisors or managers can directly select "Sales A", "Sales B", "B2B owner", or "Online Ops" from the dropdown. Alternatively, click any row to open the Follow-up Drawer and update the Advisor field in the Overview tab with immediate real-time sync.',
                ansZh: '解答：在工作台的“标准 9 列视图”和“宽表 17 列视图”中，最后一列均设有独立的“归属顾问 (Owner)”快捷下拉选框。顾问或管理人员可直接将责任人切换为 Sales A、Sales B、B2B owner 或 Online Ops。此外，也可点击任意行打开侧边抽屉，在基本信息中修改顾问归属，修改即刻全系统实时同步。'
              }
            ].map(faq => {
              const isExpanded = expandedFaqIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className={`rounded-xl border transition-all ${
                    isExpanded 
                      ? isLight ? 'bg-slate-50 border-slate-300 shadow-2xs' : 'bg-slate-900 border-slate-700 shadow-sm'
                      : isLight ? 'bg-white border-slate-200/90 hover:border-slate-300' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedFaqIds(prev =>
                        prev.includes(faq.id) ? prev.filter(id => id !== faq.id) : [...prev, faq.id]
                      );
                    }}
                    className="w-full p-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {t(faq.qEn, faq.qZh)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {faq.tag}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-primary-500' : ''
                    }`} />
                  </button>

                  {isExpanded && (
                    <div className={`px-3.5 pb-3.5 pt-1 text-[11px] leading-relaxed border-t ${
                      isLight ? 'border-slate-200/60 text-slate-600' : 'border-slate-800 text-slate-300'
                    }`}>
                      {t(faq.ansEn, faq.ansZh)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Copyable Golden WhatsApp Templates with Scenario Filter & Dynamic Name Personalizer */}
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
              <div>
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>💬 {t('Official Standard WhatsApp Outreach Templates (Indonesian):', '官方推荐印尼语标准 WhatsApp 沟通范本（一键复制）：')}</span>
                </h3>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('Directly paste into official WhatsApp Web conversation window for high-converting outreach.', '可直接一键复制并粘贴至 WhatsApp 官方对话框中，支持动态填入学员姓名。')}
                </p>
              </div>

              {/* Student Name Personalizer Input */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                  {t('Recipient:', '学员称呼:')}
                </span>
                <div className="relative">
                  <input
                    type="text"
                    value={studentNameVar}
                    onChange={(e) => setStudentNameVar(e.target.value)}
                    placeholder={t('e.g. Cindy, Kevin', '如: Cindy, Budi')}
                    className={`text-xs rounded-xl px-2.5 py-1 w-32 sm:w-36 border outline-none font-medium transition-all ${
                      isLight ? 'bg-white border-slate-200 focus:border-primary-500 shadow-2xs' : 'bg-slate-900 border-slate-700 text-slate-200'
                    }`}
                  />
                  {studentNameVar && (
                    <button
                      type="button"
                      onClick={() => setStudentNameVar('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scenario Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 max-w-full">
              {[
                { id: 'all', labelEn: 'All Scenarios (5)', labelZh: '全部场景 (5)' },
                { id: 'tuition', labelEn: '1. Tuition & Schedule', labelZh: '1. 学费与排期' },
                { id: 'visit', labelEn: '2. PIK Campus Visit', labelZh: '2. PIK校区面谈' },
                { id: 'diagnostic', labelEn: '3. Quiz Diagnostic', labelZh: '3. 测评出分建议' },
                { id: 'reminder', labelEn: '4. Class Reminder', labelZh: '4. 开课提醒' },
                { id: 'reactivation', labelEn: '5. Lead Reactivation', labelZh: '5. 沉睡唤醒' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScriptCategory(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    scriptCategory === tab.id
                      ? 'bg-primary-600 text-white shadow-xs font-bold'
                      : isLight 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {t(tab.labelEn, tab.labelZh)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Template 1: Tuition inquiry */}
              {(scriptCategory === 'all' || scriptCategory === 'tuition') && (
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[11px] text-rose-700 dark:text-rose-400">🔥 {t('Template 1: Tuition & Schedule Inquiry', '范本 1：学费与排期咨询沟通')}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold">HSK / Ready</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800 mb-3 select-all">
                      {`Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Saya konsultan dari UPER Education. Terima kasih telah menghubungi kami. Terkait rencana belajar Mandarin & info biaya/jadwal kelas akselerasi, boleh tahu saat ini Kakak sudah pernah belajar Mandarin sebelumnya atau dari dasar (nol)? 😊`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyScript(
                      `Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Saya konsultan dari UPER Education. Terima kasih telah menghubungi kami. Terkait rencana belajar Mandarin & info biaya/jadwal kelas akselerasi, boleh tahu saat ini Kakak sudah pernah belajar Mandarin sebelumnya atau dari dasar (nol)? 😊`,
                      'script-1'
                    )}
                    className="py-1 px-2.5 rounded-lg text-[11px] font-semibold bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer self-end"
                  >
                    {copiedId === 'script-1' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('Copied!', '已复制')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('Copy Template', '复制范本')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Template 2: PIK Campus Visit */}
              {(scriptCategory === 'all' || scriptCategory === 'visit') && (
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[11px] text-amber-700 dark:text-amber-400">🏫 {t('Template 2: PIK Campus Visit Invitation', '范本 2：雅加达 PIK 校区面访邀约')}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold">Offline PIK</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800 mb-3 select-all">
                      {`Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Kami melihat Kakak berdomisili di area Jabodetabek. Kampus UPER berlokasi di PIK, Jakarta Utara. Kami mengundang Kakak untuk konsultasi tatap muka & trial class gratis di kampus kami pada hari Sabtu ini jam 10:00 WIB. Apakah jadwal tersebut cocok? 🏫`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyScript(
                      `Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Kami melihat Kakak berdomisili di area Jabodetabek. Kampus UPER berlokasi di PIK, Jakarta Utara. Kami mengundang Kakak untuk konsultasi tatap muka & trial class gratis di kampus kami pada hari Sabtu ini jam 10:00 WIB. Apakah jadwal tersebut cocok? 🏫`,
                      'script-2'
                    )}
                    className="py-1 px-2.5 rounded-lg text-[11px] font-semibold bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer self-end"
                  >
                    {copiedId === 'script-2' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('Copied!', '已复制')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('Copy Template', '复制范本')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Template 3: Assessment Follow-up */}
              {(scriptCategory === 'all' || scriptCategory === 'diagnostic') && (
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[11px] text-blue-700 dark:text-blue-400">📝 {t('Template 3: Placement Quiz Diagnostic Advice', '范本 3：测评出分后学习规划建议')}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold">HSK Diagnostic</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800 mb-3 select-all">
                      {`Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Hasil tes asesmen HSK Kakak di UPER sudah keluar. Tim akademik kami telah menganalisis skor Kakak dan menyiapkan silabus rekomendasi yang paling efisien untuk mencapai target HSK dalam 3 bulan. Kapan Kakak ada waktu luang 5 menit via telepon? 📚`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyScript(
                      `Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Hasil tes asesmen HSK Kakak di UPER sudah keluar. Tim akademik kami telah menganalisis skor Kakak dan menyiapkan silabus rekomendasi yang paling efisien untuk mencapai target HSK dalam 3 bulan. Kapan Kakak ada waktu luang 5 menit via telepon? 📚`,
                      'script-3'
                    )}
                    className="py-1 px-2.5 rounded-lg text-[11px] font-semibold bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer self-end"
                  >
                    {copiedId === 'script-3' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('Copied!', '已复制')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('Copy Template', '复制范本')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Template 4: Class Reminder (4h before) */}
              {(scriptCategory === 'all' || scriptCategory === 'reminder') && (
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400">⏰ {t('Template 4: Pre-Class Milestone Reminder', '范本 4：开课前 4 小时就绪提醒')}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold">Milestone</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800 mb-3 select-all">
                      {`Pengingat: Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Kelas trial Mandarin Kakak di UPER akan dimulai 4 jam lagi. Berikut link Zoom & passcode (atau lokasi Google Maps Kampus PIK). Mohon bergabung 5 menit lebih awal ya. Sampai jumpa di kelas! 🎓`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyScript(
                      `Pengingat: Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! Kelas trial Mandarin Kakak di UPER akan dimulai 4 jam lagi. Berikut link Zoom & passcode (atau lokasi Google Maps Kampus PIK). Mohon bergabung 5 menit lebih awal ya. Sampai jumpa di kelas! 🎓`,
                      'script-4'
                    )}
                    className="py-1 px-2.5 rounded-lg text-[11px] font-semibold bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer self-end"
                  >
                    {copiedId === 'script-4' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('Copied!', '已复制')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('Copy Template', '复制范本')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Template 5: Dormant / Lost Lead Reactivation */}
              {(scriptCategory === 'all' || scriptCategory === 'reactivation') && (
                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[11px] text-purple-700 dark:text-purple-400">✨ {t('Template 5: Dormant / Lost Lead Reactivation', '范本 5：沉睡潜客福利唤醒')}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-bold">Cold Nurture</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800 mb-3 select-all">
                      {`Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! UPER Education minggu ini sedang ada program beasiswa potongan biaya kelas akselerasi HSK & materi persiapan studi ke Tiongkok terbaru. Apakah Kakak masih tertarik untuk meningkatkan kemampuan Mandarin tahun ini? Kami kirimkan info lengkapnya ya! 🎁`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyScript(
                      `Halo Kak${studentNameVar ? ` ${studentNameVar.trim()}` : ''}! UPER Education minggu ini sedang ada program beasiswa potongan biaya kelas akselerasi HSK & materi persiapan studi ke Tiongkok terbaru. Apakah Kakak masih tertarik untuk meningkatkan kemampuan Mandarin tahun ini? Kami kirimkan info lengkapnya ya! 🎁`,
                      'script-5'
                    )}
                    className="py-1 px-2.5 rounded-lg text-[11px] font-semibold bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer self-end"
                  >
                    {copiedId === 'script-5' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('Copied!', '已复制')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('Copy Template', '复制范本')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CHAPTER 10: AI Ecosystem & Automation */}
        <section id="chapter-10" className={`p-6 rounded-2xl border ${isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900 border-slate-800'}`}>
          {renderChapterHeader(
            'chapter-10',
            <Sparkles className="w-4 h-4" />,
            'Chapter 10: AI Ecosystem & Core Intelligence Architecture',
            '第 10 章：AI 在全域营销与 CRM 智能体系中的核心赋能与自动化生态架构',
            'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400',
            '',
            undefined,
            undefined
          )}

          <div className="space-y-5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <p className="leading-relaxed">
              {t(
                'As requested by UPER senior marketing & interaction leadership, AI serves as the core intelligence engine across the entire marketing and CRM ecosystem. The architecture covers both currently operational intelligent modules and advanced future automation extensions.',
                '根据 UPER 营销与交互专家的专业指导，AI 贯穿于整个全域营销与 CRM 智能体系的核心。本章详细梳理了当前已全面投产的四大核心 AI 赋能模块，以及未来规划的 AI 自动化扩展引擎。'
              )}
            </p>

            {/* Part 1: Four Core Operational AI Modules */}
            <div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                <span>{t('Part I: Currently Operational Core AI Modules (Already Built-in)', '第一部分：当前已全面投产的四大核心 AI 赋能模块')}</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Module 1: Intake AI Advisor */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>💬</span>
                    <span>{t('1. 24/7 Intake AI Advisor (Multilingual Chat)', '1. 前端 24/7 智能咨询与意向捕获')}</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t(
                      'Bilingual/Trilingual AI advisory widget on landing pages (Chinese, English, Indonesian) handling instant student queries regarding tuition, schedules, and HSK levels 24/7, automatically logging full transcripts into chatTranscript.',
                      '落地页双语/三语 AI 顾问全天候在线，自动解答学费、校区、班期疑问，并将对话全量沉淀至后台 `chatTranscript`。'
                    )}
                  </p>
                </div>

                {/* Module 2: Diagnostic & Assessment AI */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>{t('2. Diagnostic & Assessment AI Engine', '2. 自适应测评与智能定级引擎')}</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t(
                      'Automatically administers HSK 1~3 adaptive diagnostic quizzes, instantly computes score breakdown, radar charts, and tier recommendations, eliminating manual initial screening costs.',
                      '自动调度 HSK 1~3 级自适应摸底试题，实时计算得分、生成能力雷达与分级推荐，省去人工初筛成本。'
                    )}
                  </p>
                </div>

                {/* Module 3: RevOps Protocol Automation */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>⚙️</span>
                    <span>{t('3. RevOps Protocol Automation Engine', '3. 营收运营规则自动化 (RevOps)')}</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t(
                      'Replaces traditional manual scoring with automated rules evaluating R1~R6 circuit breaker criteria, calculating dynamic SLA countdown timers, and triggering watchdog alerts.',
                      '替代传统人工打分，由底层规则链自动推演 R1~R6 评级、计算动态 SLA 倒计时并触发看门狗提醒。'
                    )}
                  </p>
                </div>

                {/* Module 4: Sales Copilot & Tailored Playbook */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>{t('4. Sales Copilot & Tailored Playbook', '4. 销售副驾驶与动态攻坚话术库')}</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t(
                      'Dynamically generates personalized WhatsApp icebreaker scripts and objection handling answers tailored to each lead’s goal, mode, city, and buying signal with one-click copy.',
                      '基于客户的多维购买信号与画像，自动为顾问生成个性化 WhatsApp 破冰话术与异议化解对策（一键复制与唤起）。'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Part 2: Future AI Automation Extensions */}
            <div className="pt-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t('Part II: Future AI Automation Roadmap & Extensions', '第二部分：未来 AI 自动化扩展引擎规划')}</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Future 1: Auto-Dialer */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>📞</span>
                    <span>{t('1. AI Voice Auto-Dialer', '1. AI 自动电销拨打')}</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t(
                      'Outbound AI voice calling for initial qualification within SLA windows, logging structured summaries directly to Journey Timeline.',
                      '在 SLA 窗口内自动发起外呼，进行流利的中印双语意向初筛，通话摘要自动回传至时间轴。'
                    )}
                  </p>
                </div>

                {/* Future 2: Auto-Reply */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>💬</span>
                    <span>{t('2. Inquiry Auto-Reply', '2. 用户咨询消息自动回复')}</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t(
                      'Autonomous WhatsApp & web chat replies for instant 24/7 engagement and seamless human handover.',
                      '全渠道 7x24 小时自动回复 WhatsApp 与网页咨询，无缝转接人工顾问。'
                    )}
                  </p>
                </div>

                {/* Future 3: Status Notifications */}
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>🔔</span>
                    <span>{t('3. Automated Status Notifications', '3. 状态自动通知联动')}</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t(
                      'Automated WhatsApp notifications for assessment score delivery, trial bookings, and pre-class reminders.',
                      '测评出分、试听预约与课前 4 小时就绪时，自动向学员推送 WhatsApp 状态通知。'
                    )}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};
