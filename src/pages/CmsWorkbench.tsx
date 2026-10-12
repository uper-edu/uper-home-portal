import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { safeStorage } from '../utils/safeStorage';
import { 
  Sparkles, 
  Globe, 
  Sun, 
  Moon, 
  ExternalLink,
  Layers
} from 'lucide-react';
import ContentManagementPanel from '../components/crm/ContentManagementPanel';

export default function CmsWorkbench() {
  // Language State: 'en' (default) vs 'zh'
  const [lang, setLang] = useState<'en' | 'zh'>(() => {
    try {
      const saved = safeStorage.getItem('uper_cms_lang') || safeStorage.getItem('uper_crm_lang');
      if (saved === 'en' || saved === 'zh') return saved;
    } catch {
      // fallback
    }
    return 'en';
  });

  const toggleLang = () => {
    const next = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    try {
      safeStorage.setItem('uper_cms_lang', next);
    } catch {}
  };

  const t = (enText: string, zhText: string) => (lang === 'zh' ? zhText : enText);

  // Theme State: 'light' (Apple Style) vs 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = safeStorage.getItem('uper_cms_theme') || safeStorage.getItem('uper_crm_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      safeStorage.setItem('uper_cms_theme', next);
    } catch {}
  };

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 select-text ${
      isLight ? 'bg-[#f5f5f7] text-[#1d1d1f]' : 'bg-slate-950 text-slate-100'
    }`}>
      <Helmet>
        <title>{t('UPER CMS · Official Website Content & Media Management', 'UPER CMS · 官方网站全量内容与素材管理系统')}</title>
        <meta name="description" content="Dedicated standalone content and media configuration management workspace for UPER official website." />
      </Helmet>

      {/* Standalone CMS Top Navigation Header */}
      <header className={`px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 transition-colors duration-200 ${
        isLight 
          ? 'bg-white/85 backdrop-blur-md border-b border-slate-200/90 shadow-2xs' 
          : 'bg-slate-900 border-b border-slate-800 shadow-md'
      }`}>
        {/* Brand & System Title */}
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="flex items-center gap-2 group hover:opacity-95 transition-opacity" 
            title={t('Back to UPER Portal Homepage', '返回 UPER 官网首页')}
          >
            <img 
              src="/uper-logo-mark.svg" 
              alt="UPER Logo" 
              width="36" 
              height="36" 
              className="h-[34px] w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
            />
            <span className={`font-extrabold text-[22px] tracking-[0.03em] leading-none font-sans ${
              isLight ? 'text-slate-900 font-extrabold' : 'text-white'
            }`}>
              UPER
            </span>
          </Link>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  CMS Workbench
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  isLight 
                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                    : 'bg-amber-950/40 text-amber-300 border-amber-800'
                }`}>
                  Headless CMS
                </span>
              </div>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('Official Website Content & Media Management Hub', '官网全量内容与素材配置管理中心')}
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Quick link to CRM */}
          <Link
            to="/crm"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={t('Open Sales CRM Workbench', '切换到销售线索 CRM 工作台')}
          >
            <Layers className="w-3.5 h-3.5 text-primary-500" />
            <span className="hidden sm:inline">{t('Sales CRM', '销售 CRM')}</span>
          </Link>

          {/* Quick link to Live Portal */}
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={t('Open Official Website in new tab', '在新标签页查看官网前台效果')}
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">{t('Live Portal', '官网前台')}</span>
          </Link>

          {/* Language Switcher Button */}
          <button
            type="button"
            onClick={toggleLang}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={lang === 'en' ? '切换至中文界面' : 'Switch to English Interface'}
          >
            <Globe className="w-3.5 h-3.5 text-primary-500" />
            <span>{lang === 'en' ? '中文 (ZH)' : 'English (EN)'}</span>
          </button>

          {/* Apple Style Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isLight ? t('Switch to Dark Mode', '切换至深色模式') : t('Switch to Apple Light Mode', '切换至浅色模式')}
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('Dark Theme', '深色模式')}</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('Apple Light', '浅色模式')}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main CMS Workspace Container */}
      <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1560px] w-full mx-auto space-y-5">
        <ContentManagementPanel isLight={isLight} lang={lang} />
      </main>
    </div>
  );
}
