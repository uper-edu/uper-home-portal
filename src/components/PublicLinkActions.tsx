import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Bookmark, Check, ChevronDown, Copy, Monitor, Share2, Smartphone, X} from 'lucide-react';
import {promotionJourneyUrl} from '../utils/promotionNavigation';
import type {SiteLanguage} from '../utils/siteMetadata';
import './public-link-actions.css';

const words = {
  zh: {
    save: '收藏入口', sharePage: '分享页面', share: '分享', close: '关闭', copy: '复制链接', copied: '链接已复制',
    failed: '无法自动复制，请选择并复制上方链接。', shareFailed: '无法打开系统分享，请复制链接。',
    mobileTitle: '添加到主屏幕', desktopTitle: '创建桌面快捷方式',
    showLink: '查看链接', pageLink: '页面链接', shortcutCopied: '已复制',
    iphone: {device: 'Safari · iPhone / iPad', open: '先复制链接，再用 Safari 打开。',
      steps: ['在 Safari 中点「分享」，也可从页面菜单进入。', '选择「添加到主屏幕」，再点「添加」。']},
    android: {device: 'Chrome · Android', open: '先复制链接，再用 Chrome 打开。',
      steps: ['点 Chrome 菜单，选择「安装并创建快捷方式」。', '选择「创建快捷方式」，再点「添加」。']},
    desktop: {device: 'Chrome · 电脑', open: '先复制链接，再用 Chrome 打开。',
      steps: ['打开 Chrome 菜单，进入「投放、保存和分享」。', '选择「创建快捷方式」，再点「创建」。']},
  },
  en: {
    save: 'Save this page', sharePage: 'Share this page', share: 'Share', close: 'Close', copy: 'Copy link', copied: 'Link copied',
    failed: 'Copy unavailable. Select and copy the link above.', shareFailed: 'System sharing is unavailable. Copy the link instead.',
    mobileTitle: 'Add to Home Screen', desktopTitle: 'Create a desktop shortcut',
    showLink: 'View link', pageLink: 'Page link', shortcutCopied: 'Copied',
    iphone: {device: 'Safari · iPhone / iPad', open: 'Copy the link and open it in Safari.',
      steps: ['Tap Share in Safari or find it in the page menu.', 'Choose Add to Home Screen and tap Add.']},
    android: {device: 'Chrome · Android', open: 'Copy the link and open it in Chrome.',
      steps: ['In the Chrome menu, choose Install and create shortcut.', 'Select Create shortcut and tap Add.']},
    desktop: {device: 'Chrome · Computer', open: 'Copy the link and open it in Chrome.',
      steps: ['Open the Chrome menu and find Cast, save, and share.', 'Select Create shortcut and confirm.']},
  },
  id: {
    save: 'Simpan halaman', sharePage: 'Bagikan halaman', share: 'Bagikan', close: 'Tutup', copy: 'Salin tautan', copied: 'Tautan disalin',
    failed: 'Tidak dapat menyalin. Pilih dan salin tautan di atas.', shareFailed: 'Berbagi lewat sistem tidak tersedia. Silakan salin tautan.',
    mobileTitle: 'Tambahkan ke Layar Utama', desktopTitle: 'Buat pintasan desktop',
    showLink: 'Lihat tautan', pageLink: 'Tautan halaman', shortcutCopied: 'Disalin',
    iphone: {device: 'Safari · iPhone / iPad', open: 'Salin tautan, lalu buka di Safari.',
      steps: ['Ketuk Bagikan di Safari atau cari di menu halaman.', 'Pilih Tambahkan ke Layar Utama, lalu ketuk Tambah.']},
    android: {device: 'Chrome · Android', open: 'Salin tautan, lalu buka di Chrome.',
      steps: ['Di menu Chrome, pilih Instal dan buat pintasan.', 'Pilih Buat pintasan, lalu ketuk Tambahkan.']},
    desktop: {device: 'Chrome · Komputer', open: 'Salin tautan, lalu buka di Chrome.',
      steps: ['Buka menu Chrome, lalu pilih Transmisikan, simpan, dan bagikan.', 'Pilih Buat pintasan, lalu konfirmasi.']},
  },
};

function bookmarkDevice() {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    const inBrowser = /Version\/.*Safari\//.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS|MicroMessenger/i.test(agent);
    return {device:'iphone',inBrowser} as const;
  }
  const inBrowser = /Chrome\//.test(agent) && !/; wv\)|Edg|OPR|SamsungBrowser|MicroMessenger|\bFBAN|\bFBAV|Instagram|GSA\//i.test(agent);
  return {device:/Android/i.test(agent)?'android':'desktop',inBrowser} as const;
}

export function PublicLinkModal({title, close, label, children, className = ''}: {
  title:string; close:()=>void; label:string; children:ReactNode; className?:string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus({preventScroll:true});
    };
  }, []);
  return <dialog ref={ref} className={`public-link-dialog ${className}`} aria-label={title}
    onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}
    onClick={event=>{if (event.target === event.currentTarget) close();}}>
    <div className="public-link-dialog-inner">
      <header>
        <h2>{title}</h2>
        <button type="button" onClick={close} aria-label={label}><X size={22} aria-hidden="true"/></button>
      </header>
      {children}
    </div>
  </dialog>;
}

export function PublicLinkDialog({language, address, shareTitle, close}: {
  language:SiteLanguage; address:string; shareTitle?:string; close:()=>void;
}) {
  const t = words[language];
  const [status,setStatus] = useState<'idle'|'copied'|'failed'|'share-failed'>('idle');
  const disclosure = useRef<HTMLDetailsElement>(null);
  const manualLink = useRef<HTMLInputElement>(null);
  const url = new URL(address, window.location.origin).href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('failed');
      if (disclosure.current) {
        disclosure.current.open = true;
        manualLink.current?.focus();
      }
    }
  }
  async function share(title:string) {
    try {
      await navigator.share({title,url});
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setStatus('share-failed');
    }
  }
  const {device,inBrowser} = bookmarkDevice();
  const guide = t[device];
  const desktop = device==='desktop';
  const DeviceIcon = desktop?Monitor:Smartphone;
  const systemShare = typeof navigator.share==='function' ? shareTitle : undefined;
  const feedback = status==='failed'?t.failed:status==='copied'?t.copied:status==='share-failed'?t.shareFailed:'';
  return <PublicLinkModal title={shareTitle?t.share:desktop?t.desktopTitle:t.mobileTitle} close={close} label={t.close} className="public-link-panel">
    {shareTitle ? <p className="public-link-shortcut-guide public-link-share-subject">{shareTitle}</p> :
      <div className="public-link-shortcut-guide">
        <p className="public-link-shortcut-device"><DeviceIcon size={17} aria-hidden="true"/>{guide.device}</p>
        {!inBrowser&&<p className="public-link-shortcut-open">{guide.open}</p>}
        <ol role="list">
          {guide.steps.map(step=><li key={step}>{step}</li>)}
        </ol>
      </div>}
    <details ref={disclosure} className="public-link-panel-address">
      <summary>{t.showLink}<ChevronDown size={15} aria-hidden="true"/></summary>
      <input ref={manualLink} aria-label={t.pageLink} readOnly value={url} onFocus={event=>event.currentTarget.select()}/>
    </details>
    <div className="public-link-panel-actions">
      {systemShare&&<button type="button" className="public-link-panel-action" onClick={()=>void share(systemShare)}>
        <Share2 size={18} aria-hidden="true"/>{t.share}
      </button>}
      <button type="button" className={`public-link-panel-action${systemShare?' public-link-panel-action--secondary':''}`} onClick={copy}>
        {status==='copied'?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>}
        {status==='copied'?t.shortcutCopied:t.copy}
      </button>
    </div>
    <p role="status" className={status==='failed'||status==='share-failed'?'public-link-copy-status':'sr-only'}>{feedback}</p>
  </PublicLinkModal>;
}

export function PublicPageLinkActions({path, language, params, shareTitle, mobileOnly = false}: {
  path:'/'|'/link'|'/chat'|'/enrollment'; language:SiteLanguage; params:URLSearchParams; shareTitle:string; mobileOnly?:boolean;
}) {
  const [action,setAction] = useState<'shortcut'|'share'>();
  const t = words[language];
  const visibility = mobileOnly?' public-link-button--mobile':'';
  return <>
    <button type="button" className={`public-link-button public-link-bookmark${visibility}`}
      aria-label={t.save} title={t.save} aria-haspopup="dialog" onClick={()=>setAction('shortcut')}>
      <Bookmark size={19} aria-hidden="true"/>
    </button>
    <button type="button" className={`public-link-button public-link-share${visibility}`}
      aria-label={t.sharePage} title={t.sharePage} aria-haspopup="dialog" onClick={()=>setAction('share')}>
      <Share2 size={19} aria-hidden="true"/>
    </button>
    {action&&<PublicLinkDialog language={language} address={promotionJourneyUrl(`${path}?lang=${language}`,params)}
      shareTitle={action==='share'?shareTitle:undefined} close={()=>setAction(undefined)}/>}
  </>;
}
