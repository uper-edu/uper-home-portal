import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Share2,
  MoreVertical,
  X,
  Copy,
  Check,
  ExternalLink,
  Download,
} from "lucide-react";
import { PageMetadata } from "../components/PageMetadata";
import "./link-hub.css";
import { useSearchParams } from "react-router-dom";
import LinkHandbookPreview from "../components/LinkHandbookPreview";

const whatsapp = "https://wa.me/6281116612062";
const community =
  "https://chat.whatsapp.com/JB76F7F25DA7DggiYamZul?mode=ems_copy_t";
const handbook = "/link-assets/uper-handbook-2026.pdf";
const words = {
  en: {
    language: "Language",
    socials: "Social media",
    links: "UPER links",
    tagline: "HSK | CSCA | Study Abroad",
    consult: "FREE Online Consultation",
    consultNote: "AI 24/7 · Human support during business hours",
    community: "Join UPER Community",
    free: "WhatsApp Community · Free to join",
    document: "PDF · Document",
    description:
      "Your guide to China education, career opportunities, scholarships, and more 🇨🇳",
    share: "Share",
    close: "Close",
    copy: "Copy link",
    copied: "Link copied",
    failed: "Copy unavailable. Select and copy the link below.",
    native: "More sharing options",
    view: "Open PDF",
    download: "Download",
    home: "UPER Official Website",
    profile: "Share profile",
    pdfError: "Preview unavailable. Use Open PDF or Download below.",
  },
  id: {
    language: "Bahasa",
    socials: "Media sosial",
    links: "Tautan UPER",
    tagline: "HSK | CSCA | Studi di Luar Negeri",
    consult: "Konsultasi Online GRATIS",
    consultNote: "AI 24/7 · Layanan manusia pada jam kerja",
    community: "Gabung Komunitas UPER",
    free: "Komunitas WhatsApp · Gratis",
    document: "PDF · Dokumen",
    description:
      "Panduan pendidikan di Tiongkok, peluang karier, beasiswa, dan lainnya 🇨🇳",
    share: "Bagikan",
    close: "Tutup",
    copy: "Salin tautan",
    copied: "Tautan disalin",
    failed: "Tidak dapat menyalin. Pilih dan salin tautan di bawah.",
    native: "Opsi berbagi lainnya",
    view: "Buka PDF",
    download: "Unduh",
    home: "Situs Resmi UPER",
    profile: "Bagikan profil",
    pdfError: "Pratinjau tidak tersedia. Gunakan Buka PDF atau Unduh di bawah.",
  },
  zh: {
    language: "语言",
    socials: "社交媒体",
    links: "UPER链接",
    tagline: "HSK | CSCA | 留学",
    consult: "免费在线咨询",
    consultNote: "7×24 AI · 工作时间人工",
    community: "加入UPER社群",
    free: "WhatsApp社群 · 免费加入",
    document: "PDF · 文档",
    description: "了解中国教育、职业机会、奖学金及更多信息 🇨🇳",
    share: "分享",
    close: "关闭",
    copy: "复制链接",
    copied: "链接已复制",
    failed: "无法自动复制，请选择并复制下方链接。",
    native: "更多分享方式",
    view: "打开PDF",
    download: "下载",
    home: "UPER官方网站",
    profile: "分享主页",
    pdfError: "预览暂不可用，请使用下方打开PDF或下载。",
  },
};
function SocialIcon({ kind }: { kind: "whatsapp" | "tiktok" | "youtube" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      {kind === "youtube" ? (
        <>
          <path d="M23 7s-.2-1.7-.9-2.4c-.9-.9-1.9-.9-2.4-1C16.4 3.3 12 3.3 12 3.3s-4.4 0-7.7.3c-.5.1-1.5.1-2.4 1C1.2 5.3 1 7 1 7S.7 9 .7 11v2c0 2 .3 4 .3 4s.2 1.7.9 2.4c.9.9 2.1.9 2.7 1 2 .2 7.4.3 7.4.3s4.4 0 7.7-.3c.5-.1 1.5-.1 2.4-1 .7-.7.9-2.4.9-2.4s.3-2 .3-4v-2c0-2-.3-4-.3-4Z" />
          <path d="m9.7 8.2 6 3.8-6 3.8Z" fill="#91a2a4" />
        </>
      ) : kind === "tiktok" ? (
        <path d="M16.6 1h-4v14.2a3.1 3.1 0 1 1-2.7-3.1V8a7.2 7.2 0 1 0 6.8 7.2V8.1a10 10 0 0 0 5.3 1.6V5.6A6.1 6.1 0 0 1 16.6 1Z" />
      ) : (
        <>
          <path
            fillRule="evenodd"
            d="M12 1a11 11 0 0 0-9.5 16.5L1 23l5.6-1.5A11 11 0 1 0 12 1Zm0 2a9 9 0 1 1-4.6 16.8l-.4-.2-3.2.8.9-3.1-.3-.4A9 9 0 0 1 12 3Z"
          />
          <path d="M8.2 6.6c-.3-.1-.6 0-.9.3-.6.6-.9 1.3-.8 2.2.2 2.8 3.7 6.5 7 7.3 1.2.3 2.4-.3 2.8-.9.2-.4.4-1.1.2-1.4l-2.3-1.2c-.3-.1-.4 0-.6.2l-.9 1c-.2.2-.4.2-.7 0a9 9 0 0 1-3.3-3c-.2-.3-.2-.4 0-.6l.7-.9c.2-.2.2-.4.1-.6L8.5 7c-.1-.2-.1-.4-.3-.4Z" />
        </>
      )}
    </svg>
  );
}
function Modal({
  title,
  close,
  label,
  children,
  className = "",
}: {
  title: string;
  close: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`linkhub-dialog ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="linkhub-dialog-inner">
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={close} aria-label={label}>
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export default function LinkHub() {
  const { i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const lang = i18n.language.startsWith("zh")
    ? "zh"
    : i18n.language.startsWith("id")
      ? "id"
      : "en";
  const t = words[lang];
  const consultUrl = `/chat?lang=${lang}`;
  const selectLanguage = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("lang", value);
    setParams(next, { replace: true });
    void i18n.changeLanguage(value);
  };
  const [documentOpen, setDocumentOpen] = useState(false),
    [share, setShare] = useState<{ title: string; url: string } | null>(null),
    [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const shareItem = (title: string, url: string) => {
    setCopyState("idle");
    setShare({ title, url: new URL(url, window.location.origin).href });
  };
  const profileShare = () =>
    shareItem(
      "UPER Education & Technology",
      `/link${lang === "en" ? "" : `?lang=${lang}`}`,
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share!.url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: share!.title, url: share!.url });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setCopyState("failed");
    }
  };
  return (
    <div className="linkhub-page" lang={lang === "zh" ? "zh-CN" : lang}>
      <svg
        className="linkhub-background-filter"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id="linkhub-background-grain"
            filterUnits="objectBoundingBox"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="desaturatedNoise"
            />
            <feComponentTransfer in="desaturatedNoise" result="subtleNoise">
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
            <feBlend mode="overlay" in="subtleNoise" in2="SourceGraphic" />
          </filter>
        </defs>
      </svg>
      <PageMetadata />
      <div className="linkhub-toolbar">
        <a href="/" aria-label={t.home}>
          <img src="/link-assets/avatar.png" alt="UPER" />
        </a>
        <nav className="linkhub-languages" aria-label={t.language}>
          {(
            [
              ["en", "EN"],
              ["id", "ID"],
              ["zh", "中文"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              aria-pressed={lang === code}
              onClick={() => selectLanguage(code)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={profileShare} aria-label={t.profile}>
          <Share2 size={20} />
        </button>
      </div>
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
          <nav className="linkhub-socials" aria-label={t.socials}>
            {(["whatsapp", "tiktok", "youtube"] as const).map((kind) => (
              <a
                key={kind}
                href={
                  kind === "whatsapp"
                    ? whatsapp
                    : kind === "tiktok"
                      ? "https://www.tiktok.com/@upereducation"
                      : "https://www.youtube.com/@UperEducation"
                }
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  kind === "whatsapp"
                    ? "WhatsApp"
                    : kind === "tiktok"
                      ? "TikTok"
                      : "YouTube"
                }
              >
                <SocialIcon kind={kind} />
              </a>
            ))}
          </nav>
        </header>
        <section className="linkhub-links" aria-label={t.links}>
          <div className="linkhub-card">
            <a className="linkhub-card-main" href={consultUrl}>
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
              onClick={() => setDocumentOpen(true)}
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
              onClick={() => shareItem("Handbook 2026", handbook)}
            >
              <MoreVertical size={19} />
            </button>
          </div>
          <div className="linkhub-card">
            <a
              className="linkhub-card-main"
              href={community}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{t.community}</span>
              <small>{t.free}</small>
            </a>
            <button
              className="linkhub-card-share"
              type="button"
              aria-label={`${t.share}: ${t.community}`}
              onClick={() => shareItem(t.community, community)}
            >
              <MoreVertical size={19} />
            </button>
          </div>
        </section>
        <footer className="linkhub-footer">
          <a href="/">UPER Education &amp; Technology</a>
        </footer>
      </main>
      {documentOpen && (
        <Modal
          title="Handbook 2026"
          close={() => setDocumentOpen(false)}
          label={t.close}
          className="linkhub-document"
        >
          <p className="linkhub-document-summary">{t.description}</p>
          <LinkHandbookPreview url={handbook} errorText={t.pdfError} />
          <footer>
            <a href={handbook} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={17} />
              {t.view}
            </a>
            <a href={handbook} download>
              <Download size={17} />
              {t.download}
            </a>
            <button
              type="button"
              onClick={() => shareItem("Handbook 2026", handbook)}
            >
              <Share2 size={17} />
              {t.share}
            </button>
          </footer>
        </Modal>
      )}
      {share && (
        <Modal
          title={`${t.share} · ${share.title}`}
          close={() => setShare(null)}
          label={t.close}
        >
          <p className="linkhub-share-title">{share.title}</p>
          <input
            aria-label={t.copy}
            readOnly
            value={share.url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="linkhub-share-actions">
            <button type="button" onClick={copy}>
              {copyState === "copied" ? (
                <Check size={18} />
              ) : (
                <Copy size={18} />
              )}{" "}
              {copyState === "copied" ? t.copied : t.copy}
            </button>
            {typeof navigator.share === "function" && (
              <button type="button" onClick={nativeShare}>
                <Share2 size={18} />
                {t.native}
              </button>
            )}
          </div>
          <p role="status" className="linkhub-copy-status">
            {copyState === "failed"
              ? t.failed
              : copyState === "copied"
                ? t.copied
                : ""}
          </p>
        </Modal>
      )}
    </div>
  );
}
