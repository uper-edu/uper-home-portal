import {lookupPromotion} from '../utils/promotionLookup';
import {promotionJourneyUrl} from '../utils/promotionNavigation';
import {trackEvent} from '../utils/analytics';
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Share2,
  MoreVertical,
  ExternalLink,
  Download,
} from "lucide-react";
import { PublicPageLinkActions, PublicLinkDialog, PublicLinkModal } from "../components/PublicLinkActions";
import { PageMetadata } from "../components/PageMetadata";
import { PublicHeaderBrand, PublicHeaderLanguage, PublicHeaderMenu } from "../components/PublicHeaderMenu";
import "./link-hub.css";
import { useSearchParams } from "react-router-dom";
import LinkHandbookPreview from "../components/LinkHandbookPreview";
import { SocialProfileIcon, socialProfileOrder, socialProfiles } from "../components/SocialProfileIcon";
import { linkHubConsultUrl } from '../utils/instagramBioCampaign';

const whatsapp = "https://wa.me/6281116612062";
const handbook = "/link-assets/uper-handbook-2026.pdf";
const words = {
  en: {
    socials: "Social media",
    links: "UPER links",
    tagline: "HSK | CSCA | Study Abroad",
    enrollment: "Browse Courses & Enroll",
    enrollmentNote: "HSK 1–4 · Schedules, class types & fees",
    consult: "Free HSK Test · 24/7 AI Chat",
    consultNote: "Check your level · Get course advice",
    whatsappConsult: "Free Consultation (WhatsApp)",
    whatsappConsultNote: "UPER Team · Business Hours",
    document: "PDF · Document",
    description:
      "Your guide to China education, career opportunities, scholarships, and more 🇨🇳",
    share: "Share",
    close: "Close",
    view: "Open PDF",
    download: "Download",
    home: "UPER Official Website",
    pdfError: "Preview unavailable. Use Open PDF or Download below.",
  },
  id: {
    socials: "Media sosial",
    links: "Tautan UPER",
    tagline: "HSK | CSCA | Studi di Luar Negeri",
    enrollment: "Lihat & Daftar Kelas",
    enrollmentNote: "HSK 1–4 · Jadwal kelas dan biaya",
    consult: "Tes HSK Gratis · AI 24/7",
    consultNote: "Cek level · Saran kelas",
    whatsappConsult: "Konsultasi Gratis (WhatsApp)",
    whatsappConsultNote: "Tim UPER · Jam Kerja",
    document: "PDF · Dokumen",
    description:
      "Panduan pendidikan di Tiongkok, peluang karier, beasiswa, dan lainnya 🇨🇳",
    share: "Bagikan",
    close: "Tutup",
    view: "Buka PDF",
    download: "Unduh",
    home: "Situs Resmi UPER",
    pdfError: "Pratinjau tidak tersedia. Gunakan Buka PDF atau Unduh di bawah.",
  },
  zh: {
    socials: "社交媒体",
    links: "UPER链接",
    tagline: "HSK | CSCA | 留学",
    enrollment: "查看课程与报名",
    enrollmentNote: "HSK 1–4 · 班次时间与学费",
    consult: "免费 HSK 测评 · 全天候 AI 咨询",
    consultNote: "水平测试与选课建议",
    whatsappConsult: "免费咨询（WhatsApp）",
    whatsappConsultNote: "UPER 咨询团队 · 工作时间在线",
    document: "PDF · 文档",
    description: "了解中国教育、职业机会、奖学金及更多信息 🇨🇳",
    share: "分享",
    close: "关闭",
    view: "打开PDF",
    download: "下载",
    home: "UPER官方网站",
    pdfError: "预览暂不可用，请使用下方打开PDF或下载。",
  },
};

export default function LinkHub() {
  const { i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const lang = i18n.language.startsWith("zh")
    ? "zh"
    : i18n.language.startsWith("id")
      ? "id"
      : "en";
  useEffect(() => {
    if (params.has('lang')) return;
    let active = true;
    void Promise.resolve(lookupPromotion(params)).then(result => {
      if (active && result?.state === 'verified') void i18n.changeLanguage(result.promotion.language);
    });
    return () => { active = false; };
  }, [params, i18n]);
  const t = words[lang];
  const homeUrl = promotionJourneyUrl("/", params);
  const enrollmentUrl = promotionJourneyUrl(`/enrollment?lang=${lang}`, params, 'linkhub');
  const consultUrl = linkHubConsultUrl(params, lang);
  const selectLanguage = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("lang", value);
    setParams(next, { replace: true });
    void i18n.changeLanguage(value);
  };
  const trackHandbook = (handbook_action: string) =>
    trackEvent('link_click', {target:'handbook', entry_point:'linkhub', asset_id:'handbook_2026', handbook_action});
  const [documentOpen, setDocumentOpen] = useState(false);
  const [share, setShare] = useState<{ title: string; url: string } | null>(null);
  const shareItem = (title: string, url: string) => setShare({title,url});
  return (
    <div className="linkhub-page" lang={lang === "zh" ? "zh-CN" : lang}>
      <PageMetadata />
      <header className="public-page-header linkhub-toolbar">
        <a href={homeUrl} aria-label={t.home}>
          <PublicHeaderBrand/>
        </a>
        <div className="public-header-tools flex">
          <PublicHeaderLanguage language={lang} onChange={selectLanguage}/>
          <PublicPageLinkActions path="/link" language={lang} params={params} shareTitle="UPER Education & Technology"/>
          <PublicHeaderMenu label={lang==='zh'?'网站菜单':lang==='id'?'Menu situs':'Site menu'}>
            {close=><>
              <a href={homeUrl} onClick={close}>{t.home}</a>
              <a href={enrollmentUrl} onClick={()=>{close();trackEvent('link_click',{target:'enrollment',entry_point:'linkhub'});}}>{t.enrollment}</a>
              <a href={consultUrl} onClick={()=>{close();trackEvent('link_click',{target:'consultation',entry_point:'linkhub'});}}>{t.consult}</a>
            </>}
          </PublicHeaderMenu>
        </div>
      </header>
      <main className="linkhub-main">
        <header className="linkhub-profile">
          <img
            className="linkhub-avatar"
            src="/link-assets/avatar.png"
            alt="UPER"
            width="96"
            height="96"
          />
          <h1>UPER Education &amp; Technology</h1>
          <p>{t.tagline}</p>
        </header>
        <section className="linkhub-links" aria-label={t.links}>
          <div className="linkhub-card linkhub-card--enrollment">
            <a className="linkhub-card-main" href={enrollmentUrl} onClick={()=>trackEvent('link_click',{target:'enrollment',entry_point:'linkhub'})}>
              <span>{t.enrollment}</span>
              <small>{t.enrollmentNote}</small>
            </a>
            <button className="linkhub-card-share" type="button" aria-label={`${t.share}: ${t.enrollment}`} onClick={() => shareItem(t.enrollment, enrollmentUrl)}>
              <MoreVertical size={19} />
            </button>
          </div>
          <div className="linkhub-card">
            <a className="linkhub-card-main" href={consultUrl} onClick={()=>trackEvent('link_click',{target:'consultation',entry_point:'linkhub'})}>
              <span>{t.consult}</span>
              <small>{t.consultNote}</small>
            </a>
            <button
              className="linkhub-card-share"
              type="button"
              aria-label={`${t.share}: ${t.consult}`}
              onClick={() => shareItem(t.consult, consultUrl)}
            >
              <MoreVertical size={19} />
            </button>
          </div>
          <div className="linkhub-card">
            <button
              type="button"
              className="linkhub-card-main"
              onClick={() => {trackHandbook('preview');setDocumentOpen(true);}}
            >
              <span>Handbook 2026</span>
              <small>
                <FileText size={12} />
                {t.document}
              </small>
            </button>
            <button
              className="linkhub-card-share"
              type="button"
              aria-label={`${t.share}: Handbook 2026`}
              onClick={() => { trackHandbook("share"); shareItem("Handbook 2026", handbook); }}
            >
              <MoreVertical size={19} />
            </button>
          </div>
          <div className="linkhub-card">
            <a
              className="linkhub-card-main"
              href={whatsapp}
              onClick={()=>trackEvent('link_click',{target:'whatsapp',entry_point:'linkhub'})}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{t.whatsappConsult}</span>
              <small>{t.whatsappConsultNote}</small>
            </a>
            <button
              className="linkhub-card-share"
              type="button"
              aria-label={`${t.share}: ${t.whatsappConsult}`}
              onClick={() => shareItem(t.whatsappConsult, whatsapp)}
            >
              <MoreVertical size={19} />
            </button>
          </div>
        </section>
        <footer className="linkhub-footer">
          <nav className="linkhub-socials" aria-label={t.socials}>
            {socialProfileOrder.map((kind) => (
              <a
                key={kind}
                onClick={()=>trackEvent('link_click',{target:kind,entry_point:'linkhub'})}
                href={socialProfiles[kind].url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={socialProfiles[kind].name}
              >
                <SocialProfileIcon platform={kind} />
              </a>
            ))}
          </nav>
          <a href={homeUrl}>© PT UPER EDUCATION TECHNOLOGY 2025. All rights reserved.</a>
        </footer>
      </main>
      {documentOpen && (
        <PublicLinkModal
          title="Handbook 2026"
          close={() => setDocumentOpen(false)}
          label={t.close}
          className="linkhub-document"
        >
          <p className="linkhub-document-summary">{t.description}</p>
          <LinkHandbookPreview url={handbook} errorText={t.pdfError} />
          <footer>
            <a href={handbook} target="_blank" rel="noopener noreferrer" onClick={() => trackHandbook("view")}>
              <ExternalLink size={17} />
              {t.view}
            </a>
            <a href={handbook} download onClick={() => trackHandbook("download_click")}>
              <Download size={17} />
              {t.download}
            </a>
            <button
              type="button"
              onClick={() => { trackHandbook("share"); shareItem("Handbook 2026", handbook); }}
            >
              <Share2 size={17} />
              {t.share}
            </button>
          </footer>
        </PublicLinkModal>
      )}
      {share && <PublicLinkDialog language={lang} address={share.url} shareTitle={share.title} close={()=>setShare(null)}/>}
    </div>
  );
}
