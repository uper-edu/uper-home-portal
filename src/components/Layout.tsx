import {promotionEntryPoint, promotionJourneyUrl, promotionLandingPaths, websitePromotionUrl} from '../utils/promotionNavigation';
import VisitorBoundary from './VisitorBoundary';
import React, { lazy, useState, useEffect, useId, useRef, Suspense } from 'react';
import { m, AnimatePresence, LazyMotion, domAnimation } from 'motion/react';
import { Link, Outlet, useLocation, useMatch, useNavigationType, useNavigate } from 'react-router-dom';
import { ArrowRight, X, MapPin, User, Phone, MessageCircle, CalendarCheck, ChevronDown, GraduationCap, Palette, Settings2, Sliders, Check, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {useSiteChatBackground} from './SiteChatRoutes';
import {readEnrollmentPosition} from '../utils/chatJourneyNavigation';
import {normalizeSiteLanguage} from '../utils/siteMetadata';
import { BackToTop } from './ui/BackToTop';
import { trackLanguageSwitch, trackEvent } from '../utils/analytics';
import { useDesignStyle, useColorTheme } from '../utils/theme';
import { useStudentName, STUDENT_PORTAL_URL } from '../utils/studentAuth';
import { SocialProfileIcon, socialProfileOrder, socialProfiles } from './SocialProfileIcon';
import { PublicHeaderBrand, PublicHeaderLanguage, PublicHeaderMenuIcon, publicHeaderMenuButtonClass } from './PublicHeaderMenu';
import { PublicPageLinkActions } from './PublicLinkActions';

const prefTranslations = {
  id: {
    btnTitle: "Preferensi",
    title: "Pengaturan Tampilan",
    subtitle: "Sesuaikan gaya dan warna situs",
    designStyle: "Gaya Desain",
    colorTheme: "Skema Warna",
    styles: {
      default: { name: "Profesional Modern", desc: "Tata letak korporat standar" },
      apple: { name: "Minimalis Apple [Lab]", desc: "Gaya squircle & kaca blur (Proyek Eksperimen)" }
    },
    themes: {
      teal: "Classic Mint",
      ocean: "Deep Ocean",
      autumn: "Autumn Warmth",
      charcoal: "Slate Minimalist"
    },
    reset: "Kembali ke Default",
    confirm: "Selesai"
  },
  en: {
    btnTitle: "Preferences",
    title: "Display Preferences",
    subtitle: "Customize design style and colors",
    designStyle: "Design Style",
    colorTheme: "Color Scheme",
    styles: {
      default: { name: "Modern Professional", desc: "Corporate structure" },
      apple: { name: "Apple Minimalist [Lab]", desc: "Rounded squircles & glass blur (Lab Project)" }
    },
    themes: {
      teal: "Classic Mint",
      ocean: "Deep Ocean",
      autumn: "Autumn Warmth",
      charcoal: "Slate Minimalist"
    },
    reset: "Reset to Default",
    confirm: "Done"
  },
  zh: {
    btnTitle: "个性化偏好",
    title: "个性化偏好设置",
    subtitle: "自定义设计风格与界面色彩",
    designStyle: "设计风格",
    colorTheme: "界面色彩",
    styles: {
      default: { name: "现代专业", desc: "标准企业布局" },
      apple: { name: "苹果极简 [Lab]", desc: "超圆润高斯模糊风格 (实验室项目)" }
    },
    themes: {
      teal: "经典薄荷",
      ocean: "深邃海洋",
      autumn: "暖秋金辉",
      charcoal: "极简石墨"
    },
    reset: "恢复默认设置",
    confirm: "完成"
  }
};

const Navbar = ({ onOpenAppearance, onOpenCourseAdvice, learnerPreview, navbarRef }: {
  onOpenAppearance: () => void; learnerPreview?:boolean; navbarRef:React.Ref<HTMLElement>;
  onOpenCourseAdvice: (trigger:HTMLButtonElement)=>void;
}) => {
  const { t, i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = useLocation();
  const enrollmentSection = useMatch('/enrollment/*');
  const enrollmentCatalog = useMatch('/enrollment');
  const home = useMatch('/');
  const sharedMobileTools = enrollmentSection || home;
  const publicLinkPath = home ? '/' : enrollmentCatalog ? '/enrollment' : undefined;
  const mobileMenuId = useId();
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const language = normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language);
  const { isApple } = useDesignStyle();
  const { name: studentName } = useStudentName(i18n.language, !learnerPreview);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileMenuOpen && !event.defaultPrevented) {
        setMobileMenuOpen(false);
        mobileMenuTrigger.current?.focus({preventScroll:true});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const desktop = window.matchMedia('(min-width: 80rem)');
    const closeAtDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    desktop.addEventListener('change', closeAtDesktop);
    closeAtDesktop();
    return () => desktop.removeEventListener('change', closeAtDesktop);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (mobileMenuOpen) {
      body.style.overflow = 'hidden';
      body.style.height = '100%';
      html.style.overflow = 'hidden';
      html.style.height = '100%';
    } else {
      body.style.overflow = '';
      body.style.height = '';
      html.style.overflow = '';
      html.style.height = '';
    }
    return () => {
      body.style.overflow = '';
      body.style.height = '';
      html.style.overflow = '';
      html.style.height = '';
    };
  }, [mobileMenuOpen]);

  const navigateLanguage = useNavigate();
  const switchLanguage = (code: string) => {
    const url = new URL(window.location.href);
    if (code === "id" && !(enrollmentSection && url.searchParams.has('p'))) url.searchParams.delete("lang");
    else url.searchParams.set("lang", code);
    url.searchParams.delete("lng");
    navigateLanguage(url.pathname + url.search + url.hash, {replace:true});
    i18n.changeLanguage(code);
    trackLanguageSwitch(code);
  };

  const languageSwitcher = <PublicHeaderLanguage language={language} onChange={switchLanguage}/>;

  const promotionQuery = new URLSearchParams(location.search);
  const journeyLink = (path: string) => promotionLandingPaths.some(item => item === path)
    ? promotionJourneyUrl(path, promotionQuery) : path;

  const navLinks = [
    { nameKey: 'nav.home', path: '/' },
    { 
      nameKey: 'nav.studentPrograms', 
      dropdown: [
        { nameKey: 'nav.hskAi', path: '/hsk' },
        { nameKey: 'nav.cscaCoaching', path: '/csca' },
        { nameKey: 'nav.studyAbroad', path: '/consultancy' },
        { nameKey: 'nav.studyTours', path: '/tours' },
      ]
    },
    { nameKey: 'nav.enrollment', path: '/enrollment' },
    { nameKey: 'nav.partners', path: '/partners' },
    { nameKey: 'nav.news', path: '/news' },
    { 
      nameKey: 'nav.aboutUs', 
      dropdown: [
        { nameKey: 'nav.aboutUsSub', path: '/about' },
        { nameKey: 'nav.contact', path: '/contact' },
        { nameKey: 'nav.faq', path: '/faq' },
        { nameKey: 'nav.careers', path: '/careers' },
      ]
    },
  ];

  const consultClass = `shrink-0 px-5 py-2.5 rounded-full font-medium transition-all items-center gap-2 ${isApple ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-none' : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg hover:shadow-primary-500/30'}`;

  return (
    <nav ref={navbarRef} inert={learnerPreview} className={`fixed top-0 w-full z-50 transition-all duration-300 ${enrollmentSection?'public-page-header':isScrolled?'glass-card py-3 shadow-xs':'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-5 flex justify-between items-center gap-3">
        <Link to={journeyLink("/")} className="flex shrink-0 items-center gap-1.5 md:gap-2 group">
          {enrollmentSection ? <PublicHeaderBrand eager/> : <><img
            src="/uper-logo-mark.svg" 
            alt="UPER Logo" 
            width="38"
            height="38"
            fetchPriority="high"
            decoding="async"
            className="h-[28px] md:h-[38px] w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
          />
          <span className={`font-extrabold text-[19px] md:text-[23px] tracking-[0.03em] leading-none font-sans transition-colors duration-300 ${
            isApple ? 'text-slate-900' : 'text-slate-800'
          }`}>
            UPER
          </span></>}
        </Link>
        
        <div className="hidden xl:flex shrink-0 items-center gap-3 whitespace-nowrap font-medium text-slate-600">
          {navLinks.map(link => (
            link.dropdown ? (
              <div 
                key={link.nameKey} 
                className="relative group"
                onMouseEnter={() => setActiveDropdown(link.nameKey)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button className={`flex items-center gap-1 transition-colors py-2 ${link.dropdown.some(d => location.pathname === d.path) ? (isApple ? 'text-slate-900 font-bold' : 'text-primary-600 font-semibold') : (isApple ? 'hover:text-slate-900 text-slate-600' : 'hover:text-primary-600')}`}>
                  {t(link.nameKey)} <ChevronDown className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {activeDropdown === link.nameKey && (
                    <m.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-0 mt-0 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-2"
                    >
                      {link.dropdown.map(dropLink => (
                        <Link
                          key={dropLink.nameKey}
                          to={journeyLink(dropLink.path)}
                          className={`block px-4 py-2 text-sm transition-colors ${location.pathname === dropLink.path ? (isApple ? 'bg-slate-100 text-slate-900 font-bold' : 'bg-primary-50 text-primary-600 font-semibold') : (isApple ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-primary-600')}`}
                        >
                          {t(dropLink.nameKey)}
                        </Link>
                      ))}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link 
                key={link.nameKey} 
                to={link.path==='/enrollment' ? promotionJourneyUrl('/enrollment?lang='+i18n.language.slice(0,2), promotionQuery, 'website') : link.path!}
                aria-current={location.pathname === link.path ? 'page' : undefined}
                className={`transition-colors py-2 ${(location.pathname === link.path || (link.path === '/enrollment' && location.pathname.startsWith('/enrollment/'))) ? (isApple ? 'text-slate-900 font-bold' : 'text-primary-600 font-semibold') : (isApple ? 'hover:text-slate-900 text-slate-600' : 'hover:text-primary-600')}`}
              >
                {t(link.nameKey)}
              </Link>
            )
          ))}
        </div>

        <div className="hidden xl:flex min-w-0 items-center gap-2 whitespace-nowrap">
          {languageSwitcher}

          {studentName ? (
            <span className={`min-w-0 border px-4 py-2 rounded-full font-medium flex items-center gap-2 ${
              isApple
                ? 'border-slate-800 text-slate-800'
                : 'border-primary-600 text-primary-600'
            }`}>
              <GraduationCap className="w-4 h-4 shrink-0" /> <span className="truncate">{t('nav.studentGreeting', { name: studentName })}</span>
            </span>
          ) : (
            <a
              href={STUDENT_PORTAL_URL}
              target="_self"
              className={`shrink-0 border px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                isApple
                  ? 'border-slate-800 text-slate-800 hover:bg-slate-100'
                  : 'border-primary-600 text-primary-600 hover:bg-primary-50'
              }`}
            >
              <GraduationCap className="w-4 h-4" /> {t('nav.studentLogin')}
            </a>
          )}

          <button type="button" className={consultClass+' flex cursor-pointer'} aria-haspopup="dialog" aria-controls="uper-ai-chat-window"
            onClick={event=>onOpenCourseAdvice(event.currentTarget)}>
            {t('nav.startJourney')} <ArrowRight className="w-4 h-4" aria-hidden="true"/>
          </button>
        </div>

        <div className={`xl:hidden flex shrink-0 items-center ${sharedMobileTools?'public-header-tools':'gap-2'}`}>
          {languageSwitcher}
          {publicLinkPath && !learnerPreview &&
            <PublicPageLinkActions path={publicLinkPath} language={language} params={promotionQuery}
              shareTitle={home?'UPER Education & Technology':t('nav.enrollment')} mobileOnly/>}
          <button
            ref={mobileMenuTrigger}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={publicHeaderMenuButtonClass+(sharedMobileTools?'':' bg-slate-100 hover:bg-slate-200')}
            aria-label={language==='zh'?'网站菜单':language==='id'?'Menu situs':'Site menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuOpen?mobileMenuId:undefined}
          >
            <PublicHeaderMenuIcon open={mobileMenuOpen}/>
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <m.div
            id={mobileMenuId}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`xl:hidden absolute top-full left-0 w-full p-5 flex flex-col gap-3.5 shadow-2xl border-b max-h-[85vh] overflow-y-auto ${isApple ? 'bg-white/95 backdrop-blur-2xl border-slate-200/80' : 'bg-white border-slate-200'}`}
          >
            {/* Navigation Links */}
            {navLinks.map(link => (
              link.dropdown ? (
                <div key={link.nameKey} className="flex flex-col gap-1.5">
                  <div className="px-3 pt-2 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    {t(link.nameKey)}
                  </div>
                  <div className="flex flex-col gap-1 pl-3 border-l-2 border-slate-100 ml-3">
                    {link.dropdown.map(dropLink => (
                      <Link 
                        key={dropLink.nameKey} 
                        to={journeyLink(dropLink.path)}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`p-2.5 rounded-lg font-medium text-sm ${location.pathname === dropLink.path ? (isApple ? 'bg-slate-100 text-slate-900 font-bold' : 'bg-primary-50 text-primary-600') : (isApple ? 'hover:bg-slate-50 text-slate-600 hover:text-slate-900' : 'hover:bg-white/50 text-slate-600')}`}
                      >
                        {t(dropLink.nameKey)}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link 
                  key={link.nameKey} 
                  to={link.path==='/enrollment' ? promotionJourneyUrl('/enrollment?lang='+i18n.language.slice(0,2), promotionQuery, 'website') : link.path!}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-lg font-medium ${location.pathname === link.path ? (isApple ? 'bg-slate-100 text-slate-900 font-bold' : 'bg-primary-50 text-primary-600') : (isApple ? 'hover:bg-slate-50 text-slate-750' : 'hover:bg-white/50 text-slate-700')}`}
                >
                  {t(link.nameKey)}
                </Link>
              )
            ))}

            {/* Deeper Settings Link in Mobile Menu */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {studentName ? (
                <span className={`w-full border p-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                  isApple
                    ? 'border-slate-800 text-slate-800'
                    : 'border-primary-600 text-primary-600'
                }`}>
                  <GraduationCap className="w-5 h-5" /> {t('nav.studentGreeting', { name: studentName })}
                </span>
              ) : (
                <a
                  href={STUDENT_PORTAL_URL}
                  target="_self"
                  className={`w-full border p-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                    isApple
                      ? 'border-slate-800 text-slate-800 hover:bg-slate-100'
                      : 'border-primary-600 text-primary-600 hover:bg-primary-50'
                  }`}
                >
                  <GraduationCap className="w-5 h-5" /> {t('nav.studentLogin')}
                </a>
              )}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAppearance();
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-100/80 text-slate-600 hover:text-slate-900 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{t('footer.appearanceSettings', 'Display & Theme Settings')}</span>
              </button>

              <button type="button" className={consultClass+' hidden cursor-pointer justify-center md:flex'}
                aria-haspopup="dialog" aria-controls="uper-ai-chat-window" onClick={event=>{
                  setMobileMenuOpen(false);
                  onOpenCourseAdvice(mobileMenuTrigger.current ?? event.currentTarget);
                }}>
                {t('nav.startJourney')} <ArrowRight className="w-4 h-4" aria-hidden="true"/>
              </button>
              <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className="w-full bg-[#25D366] text-white p-3 rounded-xl font-medium flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5" /> {t('fab.chat')}
              </a>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const AppearanceModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const { isApple, designStyle, setDesignStyle } = useDesignStyle();
  const { colorTheme, setColorTheme } = useColorTheme();

  const handleColorChange = (theme: 'teal' | 'ocean' | 'autumn' | 'charcoal') => {
    setColorTheme(theme);
  };

  const handleStyleChange = (style: 'default' | 'apple') => {
    setDesignStyle(style);
  };

  const handleReset = () => {
    setColorTheme('teal');
    setDesignStyle('default');
  };

  const currentLang = (i18n.language && i18n.language.startsWith('zh')) 
    ? 'zh' 
    : (i18n.language && i18n.language.startsWith('id')) 
      ? 'id' 
      : 'en';

  const prefText = prefTranslations[currentLang];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Dialog */}
        <m.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`relative w-full max-w-md bg-white rounded-3xl shadow-2xl border p-6 z-10 overflow-hidden ${
            isApple ? 'border-slate-200 bg-white/95 backdrop-blur-2xl' : 'border-slate-100'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${isApple ? 'bg-slate-100 text-slate-800' : 'bg-primary-50 text-primary-600'}`}>
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{prefText.title}</h3>
                <p className="text-xs text-slate-500">{prefText.subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 1. Design Style */}
          <div className="mb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
              <Sliders className="w-3.5 h-3.5" />
              {prefText.designStyle}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'default' as const, key: 'default' as const },
                { id: 'apple' as const, key: 'apple' as const }
              ].map((style) => {
                const isSelected = designStyle === style.id;
                const info = prefText.styles[style.key];
                return (
                  <button
                    key={style.id}
                    onClick={() => handleStyleChange(style.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? isApple
                          ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900/10 shadow-xs'
                          : 'border-primary-500 bg-primary-50/50 ring-1 ring-primary-500/10 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">{info.name}</span>
                      {isSelected && <Check className={`w-3.5 h-3.5 ${isApple ? 'text-slate-900' : 'text-primary-600'}`} />}
                    </div>
                    <span className="text-[10px] text-slate-500 block leading-snug">{info.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Color Theme */}
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
              <Palette className="w-3.5 h-3.5" />
              {prefText.colorTheme}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'teal' as const, hex: '#14b8a6', key: 'teal' as const },
                { id: 'ocean' as const, hex: '#3b82f6', key: 'ocean' as const },
                { id: 'autumn' as const, hex: '#d97706', key: 'autumn' as const },
                { id: 'charcoal' as const, hex: '#475569', key: 'charcoal' as const },
              ].map((theme) => {
                const isSelected = colorTheme === theme.id;
                const label = prefText.themes[theme.key];
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleColorChange(theme.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? isApple
                          ? 'bg-slate-900/5 border-slate-900/20 ring-1 ring-slate-900/10'
                          : 'bg-primary-50/50 border-primary-500 ring-1 ring-primary-500/10'
                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span 
                      className="w-4 h-4 rounded-full border border-white shadow-xs shrink-0"
                      style={{ backgroundColor: theme.hex }}
                    />
                    <span className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{label}</span>
                    {isSelected && <Check className={`w-3.5 h-3.5 ml-auto ${isApple ? 'text-slate-900' : 'text-primary-600'}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleReset}
              className={`py-2 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                isApple 
                  ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900' 
                  : 'border-slate-200 text-slate-600 hover:text-primary-600 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {prefText.reset}
            </button>
            <button
              onClick={onClose}
              className={`py-2 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                isApple 
                  ? 'bg-slate-900 text-white hover:bg-slate-800' 
                  : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/20'
              }`}
            >
              <Check className="w-4 h-4" />
              {prefText.confirm}
            </button>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
};

const Footer = ({ onOpenAppearance }: { onOpenAppearance: () => void }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const promotionQuery = new URLSearchParams(location.search);
  const websiteEntry = location.pathname === '/' ? 'homepage_widget' : 'website';
  const journeyLink = (path: string) => promotionJourneyUrl(path, promotionQuery);
  const footerEntry = (path: '/chat' | '/link') => websitePromotionUrl(path, promotionQuery, websiteEntry, i18n.language);
  const { isApple } = useDesignStyle();

  return (
    <footer className={`transition-all duration-300 py-16 border-t ${
      isApple 
        ? 'bg-slate-50/90 backdrop-blur-md text-slate-600 border-slate-200/80 shadow-[0_-1px_10px_rgba(0,0,0,0.02)]' 
        : 'bg-slate-950 text-slate-400 border-slate-800'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-1.5 md:gap-2 mb-4 group">
              <img 
                src="/uper-logo-mark.svg" 
                alt="UPER Logo" 
                width="40"
                height="40"
                loading="lazy"
                decoding="async"
                className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
              />
              <span className={`font-extrabold text-[23px] tracking-[0.03em] leading-none font-sans transition-colors duration-300 ${
                isApple ? 'text-slate-800' : 'text-white'
              }`}>
                UPER
              </span>
            </div>
            <p className={`mb-5 text-sm leading-relaxed ${isApple ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('footer.description')}
            </p>
            <nav aria-labelledby="footer-social-heading">
              <h4 id="footer-social-heading" className={`mb-2 text-xs font-semibold ${isApple ? 'text-slate-700' : 'text-slate-300'}`}>
                {t('footer.followUs')}
              </h4>
              <ul className="flex flex-wrap gap-1.5">
                {socialProfileOrder.map((platform) => (
                  <li key={platform}>
                    <a
                      href={socialProfiles[platform].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={socialProfiles[platform].name}
                      onClick={() => trackEvent('link_click', { target: platform, entry_point: websiteEntry })}
                      className={`inline-flex size-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        isApple
                          ? 'border-slate-200 bg-white text-slate-700 hover:border-primary-400 hover:text-primary-700 focus-visible:outline-primary-600'
                          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-primary-400 hover:text-white focus-visible:outline-primary-400'
                      }`}
                    >
                      <SocialProfileIcon platform={platform} className="size-5 shrink-0" />
                      <span className="sr-only">{socialProfiles[platform].name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          
          <div>
            <h4 className={`font-bold mb-4 tracking-wider text-sm ${
              isApple 
                ? 'text-slate-800 font-semibold tracking-tight text-xs' 
                : 'text-white uppercase text-sm'
            }`}>{t('footer.quickLinks')}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to={footerEntry('/link')} className="transition-colors" onClick={() => trackEvent('link_click', {target:'hub', entry_point:websiteEntry})}>
                  {i18n.language.startsWith('zh') ? '更多资源' : i18n.language.startsWith('id') ? 'Sumber lainnya' : 'More resources'}
                </Link>
              </li>
              <li>
                <Link to={footerEntry('/chat')} className="transition-colors" onClick={() => trackEvent('link_click', {target:'consultation', entry_point:websiteEntry})}>
                  {i18n.language.startsWith('zh') ? '在线咨询' : i18n.language.startsWith('id') ? 'Konsultasi online' : 'Online consultation'}
                </Link>
              </li>
              <li>
                <Link to={journeyLink("/hsk")} className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.hskAi')}
                </Link>
              </li>
              <li>
                <Link to={journeyLink("/tours")} className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.studyTours')}
                </Link>
              </li>
              <li>
                <Link to={journeyLink("/consultancy")} className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.studyAbroad')}
                </Link>
              </li>
              <li>
                <Link to="/about" className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.aboutUsSub')}
                </Link>
              </li>
              <li>
                <Link to="/faq" className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.faq')}
                </Link>
              </li>
              <li>
                <Link to="/partners" className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.partners')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Us: Jakarta HQ + China Office */}
          <div className="md:col-span-2">
            <h4 className={`font-bold mb-4 tracking-wider text-sm ${
              isApple 
                ? 'text-slate-800 font-semibold tracking-tight text-xs' 
                : 'text-white uppercase text-sm'
            }`}>{t('footer.contactUs')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {/* Jakarta HQ */}
              <div className={`p-4.5 rounded-2xl border flex flex-col justify-between ${isApple ? 'bg-white/80 border-slate-200/80' : 'bg-slate-900/80 border-slate-800'}`}>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary-500 block mb-3">
                    {t('footer.jakartaHeadOffice', 'Jakarta Head Office')}
                  </span>
                  <div className="flex flex-col gap-3">
                    {/* Address */}
                    <div className="flex items-start gap-2.5 text-xs">
                      <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isApple ? 'text-slate-500' : 'text-primary-500'}`} />
                      <span className={`leading-relaxed ${isApple ? 'text-slate-600' : 'text-slate-300'}`}>
                        {t('footer.jakartaAddress', 'Ruko Golf Island, JL. Pantai Indah Kapuk No. 100 Blok E, Jakarta')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Hotline */}
                <div className="pt-3 mt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center">
                  <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-xs transition-colors ${
                    isApple ? 'text-slate-600 hover:text-[#25D366]' : 'text-slate-300 hover:text-[#25D366]'
                  }`}>
                    <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                    <span>+62 811-1661-2062</span>
                  </a>
                </div>
              </div>

              {/* China Office (Hangzhou) - Clean 3 Icon Rows */}
              <div className={`p-4.5 rounded-2xl border flex flex-col justify-between ${isApple ? 'bg-white/80 border-slate-200/80' : 'bg-slate-900/80 border-slate-800'}`}>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 block mb-3">
                    {t('footer.chinaOffice', 'China Office (Hangzhou)')}
                  </span>
                  
                  {/* Three structured rows: 1. Address icon, 2. User icon, 3. Phone icon */}
                  <div className="flex flex-col gap-2.5">
                    {/* 1. Address */}
                    <div className="flex items-start gap-2.5 text-xs">
                      <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isApple ? 'text-slate-500' : 'text-amber-500'}`} />
                      <span className={`leading-relaxed ${isApple ? 'text-slate-600' : 'text-slate-300'}`}>
                        {t('footer.chinaAddress', 'Headquarters Economy Park for Alumni Corporation of Zhejiang University')}
                      </span>
                    </div>

                    {/* 2. Representative */}
                    <div className="flex items-center gap-2.5 text-xs">
                      <User className={`w-4 h-4 shrink-0 ${isApple ? 'text-slate-500' : 'text-amber-500'}`} />
                      <span className={`font-semibold ${isApple ? 'text-slate-800' : 'text-slate-100'}`}>
                        {t('footer.chinaPerson', 'Wang Lisong')}
                      </span>
                    </div>

                    {/* 3. Phone */}
                    <div className="flex items-center gap-2.5 text-xs">
                      <Phone className={`w-4 h-4 shrink-0 ${isApple ? 'text-slate-500' : 'text-amber-500'}`} />
                      <a 
                        href="tel:+8618612142789" 
                        className={`font-semibold tracking-wide transition-colors ${
                          isApple 
                            ? 'text-slate-800 hover:text-amber-600' 
                            : 'text-amber-400 hover:text-amber-300 hover:underline'
                        }`}
                      >
                        {t('footer.chinaPhone', '+86 18612142789')}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className={`pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium tracking-tight ${
          isApple ? 'border-slate-200/80 text-slate-400' : 'border-slate-800 text-slate-500'
        }`}>
          <p>© PT UPER EDUCATION TECHNOLOGY 2025. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/contact" className={`transition-colors ${isApple ? 'hover:text-slate-800' : 'hover:text-white'}`}>
              {t('nav.contact')}
            </Link>
            <a href="#" className={`transition-colors ${isApple ? 'hover:text-slate-800' : 'hover:text-white'}`}>
              {t('footer.privacyPolicy')}
            </a>
            <a href="#" className={`transition-colors ${isApple ? 'hover:text-slate-800' : 'hover:text-white'}`}>
              {t('footer.termsOfService')}
            </a>
            {/* Deeper Appearance / Theme settings entry in footer */}
            <button
              onClick={onOpenAppearance}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                isApple ? 'text-slate-400 hover:text-slate-800' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={t('footer.appearanceSettings', 'Display & Theme Settings')}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{t('footer.appearanceSettings', 'Display Settings')}</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

const MobileBottomBar = () => {
  const { t, i18n } = useTranslation();
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const lang = normalizeSiteLanguage(i18n.language);
  const entry = promotionEntryPoint(query.get('entry_point')) ?? 'website';
  const enrollment = promotionJourneyUrl('/enrollment?lang=' + lang, query, entry);
  const consultation = new URL(websitePromotionUrl('/chat', query, entry, lang), window.location.origin);
  consultation.searchParams.set('lang', lang);
  const actionStyle = 'min-h-12 min-w-0 flex-1 rounded-xl border px-2.5 py-2 flex items-center justify-center gap-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b5946]';
  return (
    <div className="public-mobile-bottom-bar md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-lg border-t border-[#d5e7df] p-3 flex gap-2.5 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <Link to={enrollment} onClick={() => trackEvent('link_click', {target:'enrollment', entry_point:entry})}
        className={`${actionStyle} border-[#0b5946] bg-[#0b5946] text-white shadow-[0_3px_8px_#133b2e2e] active:bg-[#094a3b]`}>
        <CalendarCheck className="size-[18px] shrink-0" aria-hidden="true" /> {t('mobile.enroll')}
      </Link>
      <Link to={consultation.pathname + consultation.search} onClick={() => trackEvent('link_click', {target:'consultation', entry_point:entry})}
        className={`${actionStyle} border-[#b8d5c9] bg-[#edf7f2] text-[#0b5946] active:bg-[#dcefe6]`}>
        <MessageCircle className="size-[18px] shrink-0" aria-hidden="true" /> {t('mobile.chatNow')}
      </Link>
    </div>
  );
};

const AIChatbot = lazy(() => import('./AIChatbot'));

export default function Layout({learnerPreview=false}:{learnerPreview?:boolean}) {
  const chatBackground = useSiteChatBackground();
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();
  const location = useLocation();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [chatLaunchRequest,setChatLaunchRequest]=useState<HTMLButtonElement|null>(null);
  const [enrollmentChatEntry,setEnrollmentChatEntry]=useState<string>();
  const navbarRef = useRef<HTMLElement>(null);
  // Scroll to top on route change, but restore scroll on back navigation
  const { pathname } = location;
  const enrollmentScreen = (/^\/enrollment\/(?:mine|help)\//).test(pathname) || /^\/enrollment(?:\/[^/]+)?\/?$/.test(pathname);
  const navType = useNavigationType();
  const scrollPath = useRef<string | null>(null);

  useEffect(() => {
    // Set the language on body
    document.body.setAttribute('lang', i18n.language);
    document.documentElement.setAttribute('lang', i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (learnerPreview) return;
    // Language switching replaces the query string without leaving the page.
    if (scrollPath.current === pathname) return;
    scrollPath.current = pathname;
    if (enrollmentScreen && readEnrollmentPosition(location.state)) return;

    const isCustomScrollRestoredPage = pathname === '/' || pathname === '/news' || pathname === '/faq';
    if (navType === 'POP') {
      if (!isCustomScrollRestoredPage) {
        // Try to restore scroll position with a slight delay to allow rendering
        let savedScroll: string | null;
        try { savedScroll = sessionStorage.getItem(`scrollPos-${pathname}`); }
        catch { return; }
        const top = savedScroll && parseInt(savedScroll, 10);
        if (typeof top !== 'number' || !Number.isFinite(top)) return;
        const timer = setTimeout(() => window.scrollTo({top, behavior:'auto'}), 50);
        return () => clearTimeout(timer);
      }
    } else {
      // Navigating to a new page, scroll to top
      window.scrollTo(0, 0);
    }
  }, [pathname, navType]);

  // Keep track of scroll position for the current route
  useEffect(() => {
    const isCustomScrollRestoredPage = pathname === '/' || pathname === '/news' || pathname === '/faq';
    if (isCustomScrollRestoredPage) return;

    const handleScroll = () => {
      try { sessionStorage.setItem(`scrollPos-${pathname}`, window.scrollY.toString()); }
      catch { /* Page navigation still works when storage is unavailable. */ }
    };
    
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedHandleScroll = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(handleScroll, 150);
    };

    window.addEventListener('scroll', debouncedHandleScroll);
    return () => {
      window.removeEventListener('scroll', debouncedHandleScroll);
      clearTimeout(debounceTimer);
    };
  }, [pathname]);

  return (
    <LazyMotion features={domAnimation}>
      <div data-enrollment-screen={enrollmentScreen || undefined} className={`min-h-screen bg-mesh font-sans flex flex-col pb-20 md:pb-0 overflow-x-hidden ${isApple ? 'selection:bg-slate-200 selection:text-slate-900' : 'selection:bg-primary-200 selection:text-primary-900'}`}>

        <Navbar navbarRef={navbarRef} learnerPreview={learnerPreview} onOpenAppearance={() => setAppearanceOpen(true)} onOpenCourseAdvice={trigger=>{
          if (enrollmentScreen) setEnrollmentChatEntry(location.key);
          setChatLaunchRequest(trigger);
        }}/>
        <main className="flex-grow">
          <m.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Suspense fallback={
              <div className="min-h-[60vh] flex flex-col items-center justify-center bg-transparent">
                <div className={`w-10 h-10 border-4 ${isApple ? 'border-slate-800' : 'border-primary-600'} border-t-transparent rounded-full animate-spin`} />
              </div>
            }>
              <Outlet />
            </Suspense>
          </m.div>
        </main>
        {!learnerPreview && (!enrollmentScreen || chatBackground || enrollmentChatEntry===location.key) &&
          <Suspense fallback={null}><VisitorBoundary><AIChatbot navbarRef={navbarRef} expanded={Boolean(chatBackground)} returnScroll={chatBackground?.scrollY}
            launchRequest={chatLaunchRequest} onLaunchHandled={setChatLaunchRequest}/></VisitorBoundary></Suspense>}
        {!enrollmentScreen && <>
          <Footer onOpenAppearance={() => setAppearanceOpen(true)} />
          <BackToTop />
          <MobileBottomBar />
        </>}
        <AppearanceModal isOpen={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
      </div>
    </LazyMotion>
  );
}
