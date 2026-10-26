import './components/admin-form.css';
import VisitorBoundary from './components/VisitorBoundary';
import {RouteMetadata,MetadataProvider,applyPageMetadata} from './components/PageMetadata';
import {normalizeSiteLanguage,resolveMetadata} from './utils/siteMetadata';
import {useTranslation} from 'react-i18next';
import CmsContentStatus from './components/CmsContentStatus';
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout';
import { usePageTracking } from './utils/analytics';
import { ThemeProvider } from './utils/theme';
import Home from './pages/Home';

// Robust dynamic import with automatic retry on chunk loading hiccups
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      console.warn('[Vite Dynamic Import] Retrying chunk fetch...', err);
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        return await factory();
      } catch (finalErr) {
        console.error('[Vite Dynamic Import] Retry failed:', finalErr);
        throw finalErr;
      }
    }
  });
}

const About = lazyWithRetry(() => import('./pages/About'));
const FAQ = lazyWithRetry(() => import('./pages/FAQ'));
const Partners = lazyWithRetry(() => import('./pages/Partners'));
const StudyTours = lazyWithRetry(() => import('./pages/StudyTours'));
const HSK = lazyWithRetry(() => import('./pages/HSK'));
const CSCA = lazyWithRetry(() => import('./pages/CSCA'));
const StudyAbroad = lazyWithRetry(() => import('./pages/StudyAbroad'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const Careers = lazyWithRetry(() => import('./pages/Careers'));
const News = lazyWithRetry(() => import('./pages/News'));
const NewsDetail = lazyWithRetry(() => import('./pages/NewsDetail'));
const CampaignDetail = lazyWithRetry(() => import('./pages/CampaignDetail'));
const StyleGuide = lazyWithRetry(() => import('./pages/StyleGuide'));
const StudioPage = lazyWithRetry(() => import('./pages/Studio'));
const StandAloneChat = lazyWithRetry(() => import('./pages/StandAloneChat'));
const CrmWorkbench = lazyWithRetry(() => import('./pages/CrmWorkbench'));
const AccessWorkbench = lazyWithRetry(() => import('./pages/AccessWorkbench'));
const CmsWorkbench = lazyWithRetry(() => import('./pages/CmsWorkbench'));

function AnalyticsTracker() {
  usePageTracking();
  return null;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch() {
    applyPageMetadata(document, resolveMetadata(window.location.pathname, normalizeSiteLanguage(document.documentElement.lang), {unavailable:true}));
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-800 font-sans">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-slate-900">Application Notice</h2>
            <p className="text-xs text-slate-500">
              The application encountered a temporary network or module sync issue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-500 text-white font-medium text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SiteNotFound() {
  const {i18n}=useTranslation();
  const lang=normalizeSiteLanguage(i18n.resolvedLanguage||i18n.language);
  return <main className="pt-32 pb-20 px-6 text-center"><h1>{lang==='zh'?'页面未找到':lang==='id'?'Halaman Tidak Ditemukan':'Page Not Found'}</h1><a href="/">{lang==='zh'?'返回首页':lang==='id'?'Kembali ke beranda':'Return home'}</a></main>;
}

export default function App() {
  return (
    <ThemeProvider>
      <HelmetProvider>
        <ErrorBoundary>
          <BrowserRouter>
        <MetadataProvider><RouteMetadata />
        <CmsContentStatus />
            <AnalyticsTracker />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>}>
              <Routes>
                {/* Standalone Seminar & Direct AI Advisory Portals */}
                <Route path="chat" element={<VisitorBoundary><StandAloneChat /></VisitorBoundary>} />
                <Route path="consult" element={<VisitorBoundary><StandAloneChat /></VisitorBoundary>} />

                {/* Sales & Telemarketing CRM Workbench */}
                <Route path="crm" element={<CrmWorkbench />} />
                
                {/* Standalone Official Website CMS & Media Repository */}
                <Route path="system" element={<AccessWorkbench />} />
                <Route path="cms" element={<CmsWorkbench />} />
                <Route path="CMS" element={<CmsWorkbench />} />

                <Route path="studio" element={<StudioPage />} />

                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />
                  <Route path="faq" element={<FAQ />} />
                  <Route path="careers" element={<Careers />} />
                  <Route path="partners" element={<Partners />} />
                  <Route path="tours" element={<StudyTours />} />
                  <Route path="hsk" element={<HSK />} />
                  <Route path="csca" element={<CSCA />} />
                  <Route path="consultancy" element={<StudyAbroad />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="news" element={<News />} />
                  <Route path="news/:slug" element={<NewsDetail />} />
                  <Route path="campaign/:slug" element={<CampaignDetail />} />
                  <Route path="style-guide" element={<StyleGuide />} />
                  <Route path="*" element={<SiteNotFound/>}/>
                </Route>
              </Routes>
            </Suspense></MetadataProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </HelmetProvider>
    </ThemeProvider>
  );
}
