import ApplicationErrorBoundary from './components/ApplicationErrorBoundary';
import VisitorBoundary from './components/VisitorBoundary';
import {RouteMetadata,MetadataProvider} from './components/PageMetadata';
import {normalizeSiteLanguage} from './utils/siteMetadata';
import {useTranslation} from 'react-i18next';
import CmsContentStatus from './components/CmsContentStatus';
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { usePageTracking } from './utils/analytics';
import { ThemeProvider } from './utils/theme';
import { installAdminWorkspaceHistoryGuard } from './utils/adminWorkspaceHistory';
import {learnerPreviewToken} from './utils/enrollmentLearnerPreview';
import {SiteChatRoutes} from './components/SiteChatRoutes';
import {cancelUnmatchedEnrollmentPreload} from './services/enrollmentLandingState';

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

const loadHome = () => import('./pages/Home');
const loadEnrollment = () => import('./pages/Enrollment');
const Layout = lazyWithRetry(() => import('./components/Layout'));
const Home = lazyWithRetry(loadHome);
const LinkHub = lazyWithRetry(() => import('./pages/LinkHub'));
const Enrollment = lazyWithRetry(loadEnrollment);
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
let standaloneChatModule: Promise<typeof import('./pages/StandAloneChat')> | undefined;
function loadStandaloneChat() {
  return standaloneChatModule ??= import('./pages/StandAloneChat').catch(error => {
    standaloneChatModule = undefined;
    throw error;
  });
}
const StandAloneChat = lazyWithRetry(loadStandaloneChat);
const CrmWorkbench = lazyWithRetry(() => import('./pages/CrmWorkbench'));
const AcademicWorkbench = lazyWithRetry(() => import('./pages/AcademicWorkbench'));
const AccessWorkbench = lazyWithRetry(() => import('./pages/AccessWorkbench'));
const CmsWorkbench = lazyWithRetry(() => import('./pages/CmsWorkbench'));

function StandaloneChatRoute() {
  // Download the UI while VisitorBoundary verifies the cookie. Only the
  // boundary can mount the workspace and begin reading private history.
  useEffect(() => { void loadStandaloneChat().catch(() => {}); }, []);
  return <VisitorBoundary><StandAloneChat /></VisitorBoundary>;
}

function WebsiteLayout({learnerPreview=false}:{learnerPreview?:boolean}) {
  const {pathname}=useLocation();
  // Keep these entry pages downloading alongside the website shell on cold navigation.
  useEffect(() => {
    if(pathname==='/')void loadHome().catch(()=>{});
    else if(/^\/enrollment(?:\/|$)/i.test(pathname))void loadEnrollment().catch(()=>{});
  }, [pathname]);
  return <Suspense fallback={learnerPreview?null:<PageLoading/>}><Layout learnerPreview={learnerPreview}/></Suspense>;
}

function PageLoading() {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"/></div>;
}

function AnalyticsTracker() {
  usePageTracking();
  return null;
}

function EnrollmentPreloadCleanup() {
  const {pathname,search}=useLocation();
  useEffect(cancelUnmatchedEnrollmentPreload,[pathname,search]);
  useEffect(()=>{
    // Browser Back can run while the destination route is still downloading.
    window.addEventListener('popstate',cancelUnmatchedEnrollmentPreload);
    return ()=>window.removeEventListener('popstate',cancelUnmatchedEnrollmentPreload);
  },[]);
  return null;
}

function SiteNotFound() {
  const {i18n}=useTranslation();
  const lang=normalizeSiteLanguage(i18n.resolvedLanguage||i18n.language);
  return <main className="pt-32 pb-20 px-6 text-center"><h1>{lang==='zh'?'页面未找到':lang==='id'?'Halaman Tidak Ditemukan':'Page Not Found'}</h1><a href="/">{lang==='zh'?'返回首页':lang==='id'?'Kembali ke beranda':'Return home'}</a></main>;
}

installAdminWorkspaceHistoryGuard();

export default function App() {
  if (learnerPreviewToken()) return <ThemeProvider><BrowserRouter>
    <ApplicationErrorBoundary><Suspense fallback={null}><Routes>
      <Route element={<WebsiteLayout learnerPreview/>}><Route path="/enrollment" element={<Enrollment/>}/></Route>
    </Routes></Suspense></ApplicationErrorBoundary>
  </BrowserRouter></ThemeProvider>;
  return (
    <ThemeProvider>
      <ApplicationErrorBoundary>
        <BrowserRouter>
        <MetadataProvider><RouteMetadata />
        <CmsContentStatus />
            <EnrollmentPreloadCleanup />
            <AnalyticsTracker />
            <Suspense fallback={<PageLoading/>}>
              <SiteChatRoutes><Routes>
                {/* Standalone public link-in-bio hub */}
                <Route path="link" element={<LinkHub />} />
                {/* Standalone Seminar & Direct AI Advisory Portals */}
                <Route path="chat" element={<StandaloneChatRoute />} />
                <Route path="consult" element={<StandaloneChatRoute />} />

                {/* Sales & Telemarketing CRM Workbench */}
                <Route path="crm" element={<CrmWorkbench />} />
                <Route path="academics" element={<AcademicWorkbench />} />
                
                {/* Standalone Official Website CMS & Media Repository */}
                <Route path="system" element={<AccessWorkbench />} />
                <Route path="cms" element={<CmsWorkbench />} />
                <Route path="CMS" element={<CmsWorkbench />} />


                <Route path="/" element={<WebsiteLayout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />
                  <Route path="faq" element={<FAQ />} />
                  <Route path="careers" element={<Careers />} />
                  <Route path="partners" element={<Partners />} />
                  <Route path="tours" element={<StudyTours />} />
                  <Route path="hsk" element={<HSK />} />
                  <Route path="enrollment" element={<Enrollment />} />
                  <Route path="enrollment/mine" element={<Enrollment />} />
                  <Route path="enrollment/mine/:recordKind/:recordId" element={<Enrollment />} />
                  <Route path="enrollment/payment" element={<Enrollment />} />
                  <Route path="enrollment/assist" element={<Enrollment />} />
                  <Route path="enrollment/help/:topic" element={<Enrollment />} />
                  <Route path="enrollment/interest" element={<Enrollment />} />
                  <Route path="enrollment/:classId" element={<Enrollment />} />
                  <Route path="csca" element={<CSCA />} />
                  <Route path="consultancy" element={<StudyAbroad />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="news" element={<News />} />
                  <Route path="news/:slug" element={<NewsDetail />} />
                  <Route path="campaign/:slug" element={<CampaignDetail />} />
                  <Route path="style-guide" element={<StyleGuide />} />
                  <Route path="*" element={<SiteNotFound/>}/>
                </Route>
              </Routes></SiteChatRoutes>
            </Suspense></MetadataProvider>
        </BrowserRouter>
      </ApplicationErrorBoundary>
    </ThemeProvider>
  );
}
