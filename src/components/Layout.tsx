import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { Globe2, ArrowRight, Menu, X, MapPin, User, Phone, MessageCircle, FileText, ChevronDown, GraduationCap, Palette, Settings2, Sliders, Check, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import AIChatbot from './AIChatbot';
import { BackToTop } from './ui/BackToTop';
import { trackLanguageSwitch } from '../utils/analytics';
import { useDesignStyle, useColorTheme } from '../utils/theme';

const prefTranslations = {
  id: {
    btnTitle: "Preferensi",
    title: "Pengaturan Tampilan",
    subtitle: "Sesuaikan bahasa, gaya, dan warna situs",
    language: "Bahasa",
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
    subtitle: "Customize language, design style, and colors",
    language: "Language",
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
    subtitle: "自定义语言、设计风格与界面色彩",
    language: "显示语言",
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

const Navbar = ({ onOpenAppearance }: { onOpenAppearance: () => void }) => {
  const { t, i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = useLocation();
  const { isApple } = useDesignStyle();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const switchLanguage = (code: string) => {
    i18n.changeLanguage(code);
    trackLanguageSwitch(code);
  };

  const languages = [
    { code: 'id', shortLabel: 'ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'en', shortLabel: 'EN', name: 'English', flag: '🇬🇧' },
    { code: 'zh', shortLabel: '中文', name: '简体中文', flag: '🇨🇳' },
  ];

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
    { nameKey: 'nav.partners', path: '/partners' },
    { nameKey: 'nav.news', path: '/news' },
    { nameKey: 'nav.careers', path: '/careers' },
    { 
      nameKey: 'nav.aboutUs', 
      dropdown: [
        { nameKey: 'nav.aboutUsSub', path: '/about' },
        { nameKey: 'nav.contact', path: '/contact' },
        { nameKey: 'nav.faq', path: '/faq' },
      ]
    },
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'glass-card py-3 shadow-xs' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-1.5 md:gap-2 group">
          <img 
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
          </span>
        </Link>
        
        <div className="hidden md:flex items-center gap-7 font-medium text-slate-600">
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
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-0 mt-0 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-2"
                    >
                      {link.dropdown.map(dropLink => (
                        <Link
                          key={dropLink.nameKey}
                          to={dropLink.path}
                          className={`block px-4 py-2 text-sm transition-colors ${location.pathname === dropLink.path ? (isApple ? 'bg-slate-100 text-slate-900 font-bold' : 'bg-primary-50 text-primary-600 font-semibold') : (isApple ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-primary-600')}`}
                        >
                          {t(dropLink.nameKey)}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link 
                key={link.nameKey} 
                to={link.path!} 
                className={`transition-colors py-2 ${location.pathname === link.path ? (isApple ? 'text-slate-900 font-bold' : 'text-primary-600 font-semibold') : (isApple ? 'hover:text-slate-900 text-slate-600' : 'hover:text-primary-600')}`}
              >
                {t(link.nameKey)}
              </Link>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {/* Prominent Desktop Language Switcher */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/90 shadow-xs">
            <span className="pl-2.5 pr-1.5 text-slate-400 text-xs flex items-center">
              <Globe2 className="w-3.5 h-3.5 text-slate-500" />
            </span>
            <div className="flex items-center gap-0.5">
              {languages.map((lng) => {
                const isSelected = i18n.language && i18n.language.startsWith(lng.code);
                return (
                  <button
                    key={lng.code}
                    onClick={() => switchLanguage(lng.code)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      isSelected
                        ? isApple
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'bg-primary-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title={lng.name}
                  >
                    {lng.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className={`px-5 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 ${isApple ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-none' : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg hover:shadow-primary-500/30'}`}>
            {t('nav.startJourney')} <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Mobile Header Bar: Prominent Language Switcher directly visible + Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          {/* Mobile Top Header Language Switcher */}
          <div className="flex items-center p-0.5 bg-slate-100/90 rounded-full border border-slate-200/90 shadow-xs">
            {languages.map((lng) => {
              const isSelected = i18n.language && i18n.language.startsWith(lng.code);
              return (
                <button
                  key={lng.code}
                  onClick={() => switchLanguage(lng.code)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                    isSelected
                      ? isApple
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'bg-primary-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {lng.shortLabel}
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-95 transition-all"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`md:hidden absolute top-full left-0 w-full p-5 flex flex-col gap-3.5 shadow-2xl border-b max-h-[85vh] overflow-y-auto ${isApple ? 'bg-white/95 backdrop-blur-2xl border-slate-200/80' : 'bg-white border-slate-200'}`}
          >
            {/* 1. High-Visibility Mobile Language Card */}
            <div className={`p-3.5 rounded-2xl border ${isApple ? 'bg-slate-100/80 border-slate-200/70' : 'bg-primary-50/60 border-primary-100'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-primary-600" />
                  Language / 语言 / Bahasa
                </span>
                <span className="text-[10px] text-slate-400 font-medium">1-Tap Switch</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {languages.map((lng) => {
                  const isSelected = i18n.language && i18n.language.startsWith(lng.code);
                  return (
                    <button
                      key={lng.code}
                      onClick={() => switchLanguage(lng.code)}
                      className={`py-2 px-1 text-center font-bold rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? isApple
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/10'
                            : 'bg-primary-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/60'
                      }`}
                    >
                      <span className="text-sm">{lng.flag}</span>
                      <span className="text-[11px] leading-tight">{lng.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

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
                        to={dropLink.path} 
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
                  to={link.path!} 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-lg font-medium ${location.pathname === link.path ? (isApple ? 'bg-slate-100 text-slate-900 font-bold' : 'bg-primary-50 text-primary-600') : (isApple ? 'hover:bg-slate-50 text-slate-750' : 'hover:bg-white/50 text-slate-700')}`}
                >
                  {t(link.nameKey)}
                </Link>
              )
            ))}

            {/* Deeper Settings Link in Mobile Menu */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
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

              <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className="w-full bg-[#25D366] text-white p-3 rounded-xl font-medium flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5" /> {t('fab.chat')}
              </a>
            </div>
          </motion.div>
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Dialog */}
        <motion.div
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const Footer = ({ onOpenAppearance }: { onOpenAppearance: () => void }) => {
  const { t } = useTranslation();
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
          </div>
          
          <div>
            <h4 className={`font-bold mb-4 tracking-wider text-sm ${
              isApple 
                ? 'text-slate-800 font-semibold tracking-tight text-xs' 
                : 'text-white uppercase text-sm'
            }`}>{t('footer.quickLinks')}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/hsk" className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.hskAi')}
                </Link>
              </li>
              <li>
                <Link to="/tours" className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
                  {t('nav.studyTours')}
                </Link>
              </li>
              <li>
                <Link to="/consultancy" className={`transition-colors ${isApple ? 'hover:text-slate-900 text-slate-500' : 'hover:text-primary-400'}`}>
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
  const { t } = useTranslation();
  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-lg border-t border-slate-200 p-3 flex gap-3 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <button className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:bg-slate-200 transition-colors">
        <FileText className="w-4 h-4" /> {t('mobile.freeGuide')}
      </button>
      <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366] text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/30 active:scale-95 transition-all">
        <MessageCircle className="w-4 h-4" /> {t('mobile.chatNow')}
      </a>
    </div>
  );
};

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();
  const location = useLocation();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  // Scroll to top on route change, but restore scroll on back navigation
  const { pathname } = location;
  const navType = useNavigationType();

  useEffect(() => {
    // Set the language on body
    document.body.setAttribute('lang', i18n.language);
    document.documentElement.setAttribute('lang', i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    const isCustomScrollRestoredPage = pathname === '/' || pathname === '/news' || pathname === '/faq';
    if (navType === 'POP') {
      if (!isCustomScrollRestoredPage) {
        // Try to restore scroll position with a slight delay to allow rendering
        const savedScroll = sessionStorage.getItem(`scrollPos-${pathname}`);
        if (savedScroll) {
          setTimeout(() => {
            window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'auto' });
          }, 50);
        }
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
      sessionStorage.setItem(`scrollPos-${pathname}`, window.scrollY.toString());
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
    <div className={`min-h-screen bg-mesh font-sans flex flex-col pb-20 md:pb-0 overflow-x-hidden ${isApple ? 'selection:bg-slate-200 selection:text-slate-900' : 'selection:bg-primary-200 selection:text-primary-900'}`}>
      <Helmet prioritizeSeoTags>
        <html lang={i18n.language} />
        <title>{t('meta.title', 'UPER - University Partnership Education')}</title>
        <meta name="description" content={t('meta.description', 'Study abroad in China, HSK training, CSCA coaching, and enterprise training solutions.')} />
        <meta name="keywords" content="UPER, UPER Education, kuliah di China, beasiswa China, beasiswa kuliah di Tiongkok, study tour ke China, kursus HSK Jakarta PIK, persiapan CSCA, study in China agent Jakarta, Chinese Government Scholarship CSC" />
        <meta property="og:title" content={t('meta.title', 'UPER - University Partnership Education')} />
        <meta property="og:description" content={t('meta.description', 'Study abroad in China, HSK training, CSCA coaching, and enterprise training solutions.')} />
        
        {/* Advanced GEO Tags & Local SEO for PIK Head Office, North Jakarta */}
        <meta name="geo.region" content="ID-JK" />
        <meta name="geo.placename" content="Jakarta Utara" />
        <meta name="geo.position" content="-6.1219;106.7410" />
        <meta name="ICBM" content="-6.1219, 106.7410" />
      </Helmet>
      <Navbar onOpenAppearance={() => setAppearanceOpen(true)} />
      <main className="flex-grow">
        <motion.div
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
        </motion.div>
      </main>
      <Footer onOpenAppearance={() => setAppearanceOpen(true)} />
      <AppearanceModal isOpen={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
      <AIChatbot />
      <BackToTop />
      <MobileBottomBar />
    </div>
  );
}
