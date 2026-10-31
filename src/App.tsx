import './components/admin-colors.css';
import ApplicationErrorBoundary from './components/ApplicationErrorBoundary';
import './components/admin-form-layout.css';
import './components/admin-form.css';
import './components/crm/crm-form-layout.css';
import VisitorBoundary from './components/VisitorBoundary';
import {RouteMetadata,MetadataProvider} from './components/PageMetadata';
import {normalizeSiteLanguage} from './utils/siteMetadata';
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

const LinkHub = lazyWithRetry(() => import('./pages/LinkHub'));
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


function SiteNotFound() {
  const {i18n}=useTranslation();
  const lang=normalizeSiteLanguage(i18n.resolvedLanguage||i18n.language);
  return <main className="pt-32 pb-20 px-6 text-center"><h1>{lang==='zh'?'页面未找到':lang==='id'?'Halaman Tidak Ditemukan':'Page Not Found'}</h1><a href="/">{lang==='zh'?'返回首页':lang==='id'?'Kembali ke beranda':'Return home'}</a></main>;
}

export default function App() {
  return (
    <ThemeProvider>
      <HelmetProvider>
        <ApplicationErrorBoundary>
          <BrowserRouter>
        <MetadataProvider><RouteMetadata />
        <CmsContentStatus />
            <AnalyticsTracker />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>}>
              <Routes>
                {/* Standalone public link-in-bio hub */}
                <Route path="link" element={<LinkHub />} />
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
        </ApplicationErrorBoundary>
      </HelmetProvider>
    </ThemeProvider>
  );
}
