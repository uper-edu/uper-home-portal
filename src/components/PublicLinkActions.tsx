import {useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {Bookmark, Check, ChevronDown, ChevronRight, Copy, Download, EllipsisVertical, Monitor, PlusSquare, Share, Share2, Smartphone, X} from 'lucide-react';
import {promotionJourneyUrl} from '../utils/promotionNavigation';
import {promptPublicInstall, publicInstallState, subscribePublicInstall} from '../utils/publicAppInstall';
import type {SiteLanguage} from '../utils/siteMetadata';

const words = {
  zh: {
    save: '收藏入口', sharePage: '分享页面', share: '分享', close: '关闭', copy: '复制链接', copied: '链接已复制',
    failed: '无法自动复制，请选择并复制上方链接。', shareFailed: '无法打开系统分享，请复制链接。',
    mobileTitle: '添加到主屏幕', desktopTitle: '创建桌面快捷方式',
    showLink: '查看链接', pageLink: '页面链接', shortcutCopied: '已复制',
    shareAndSave: '分享与保存', shareVia: '分享到…', addBookmark: '加入浏览器书签',
    homeTitle: 'UPER 官网', hubTitle: 'UPER 官方入口',
    installOpens: 'UPER 图标打开全部入口', installed: 'UPER 已安装',
    installFailed: '无法打开安装确认，可以按下方步骤添加。',
    openInBrowser: '复制链接，在系统浏览器中打开。',
    shortcutLabels: {
      iphone: ['分享', '添加到主屏幕'],
      android: ['安装并创建快捷方式', '创建快捷方式'],
      otherAndroid: ['打开浏览器菜单', '添加到主屏幕'],
    },
    shortcutNotes: {
      iphone: ['从工具栏或页面菜单打开', '最后轻点「添加」'],
      android: ['打开浏览器的 ⋮ 菜单', '最后轻点「添加」'],
      otherAndroid: ['轻点 ⋮ 菜单', '选择「添加到主屏幕」或「安装应用」，再确认'],
    },
    addressBarShare: '轻点地址栏右侧的分享图标',
    bookmarkSteps: {
      iphone: '打开页面菜单，选择「添加书签」，再点「存储」。',
      iphoneChrome: '打开 ⋯ 菜单，轻点「添加到书签」。',
      android: '打开 ⋮ 菜单，点书签星标。',
      otherAndroid: '打开浏览器菜单，选择添加书签。',
      desktop: '点击地址栏右侧的书签星标，然后保存。',
    },
    desktopSteps: ['打开浏览器菜单，进入「投放、保存和分享」。', '选择「创建快捷方式」，再点「创建」。'],
  },
  en: {
    save: 'Save this page', sharePage: 'Share this page', share: 'Share', close: 'Close', copy: 'Copy link', copied: 'Link copied',
    failed: 'Copy unavailable. Select and copy the link above.', shareFailed: 'System sharing is unavailable. Copy the link instead.',
    mobileTitle: 'Add to Home Screen', desktopTitle: 'Create a desktop shortcut',
    showLink: 'View link', pageLink: 'Page link', shortcutCopied: 'Copied',
    shareAndSave: 'Share & save', shareVia: 'Share via…', addBookmark: 'Add a bookmark',
    homeTitle: 'UPER homepage', hubTitle: 'UPER official links',
    installOpens: 'The UPER icon opens all official links', installed: 'UPER is installed',
    installFailed: 'Couldn’t open the install prompt. Use the steps below.',
    openInBrowser: 'Copy the link and open it in your browser.',
    shortcutLabels: {
      iphone: ['Share', 'Add to Home Screen'],
      android: ['Install and create shortcut', 'Create shortcut'],
      otherAndroid: ['Open your browser menu', 'Add to Home Screen'],
    },
    shortcutNotes: {
      iphone: ['In the toolbar or page menu', 'Then tap Add'],
      android: ['Open the browser’s ⋮ menu', 'Then tap Add'],
      otherAndroid: ['Tap the ⋮ menu', 'Choose Add to Home Screen or Install app, then confirm'],
    },
    addressBarShare: 'Tap the Share icon next to the address bar',
    bookmarkSteps: {
      iphone: 'Open the page menu, choose Add Bookmark, then tap Save.',
      iphoneChrome: 'Open the ⋯ menu and tap Add to Bookmarks.',
      android: 'Open the ⋮ menu and tap the bookmark star.',
      otherAndroid: 'Open the browser menu and choose Add bookmark.',
      desktop: 'Click the bookmark star in the address bar and save.',
    },
    desktopSteps: ['Open the browser menu and find Cast, save, and share.', 'Select Create shortcut and confirm.'],
  },
  id: {
    save: 'Simpan halaman', sharePage: 'Bagikan halaman', share: 'Bagikan', close: 'Tutup', copy: 'Salin tautan', copied: 'Tautan disalin',
    failed: 'Tidak dapat menyalin. Pilih dan salin tautan di atas.', shareFailed: 'Berbagi lewat sistem tidak tersedia. Silakan salin tautan.',
    mobileTitle: 'Tambahkan ke Layar Utama', desktopTitle: 'Buat pintasan desktop',
    showLink: 'Lihat tautan', pageLink: 'Tautan halaman', shortcutCopied: 'Disalin',
    shareAndSave: 'Bagikan & simpan', shareVia: 'Bagikan lewat…', addBookmark: 'Tambah bookmark',
    homeTitle: 'Beranda UPER', hubTitle: 'Tautan resmi UPER',
    installOpens: 'Ikon UPER membuka semua tautan resmi', installed: 'UPER sudah terinstal',
    installFailed: 'Dialog instalasi tidak terbuka. Ikuti langkah di bawah.',
    openInBrowser: 'Salin tautan, lalu buka di browser.',
    shortcutLabels: {
      iphone: ['Bagikan', 'Tambahkan ke Layar Utama'],
      android: ['Instal dan buat pintasan', 'Buat pintasan'],
      otherAndroid: ['Buka menu browser', 'Tambahkan ke Layar Utama'],
    },
    shortcutNotes: {
      iphone: ['Di bilah alat atau menu halaman', 'Lalu ketuk Tambah'],
      android: ['Buka menu ⋮ di browser', 'Lalu ketuk Tambahkan'],
      otherAndroid: ['Ketuk menu ⋮', 'Pilih Tambahkan ke Layar Utama atau Instal aplikasi, lalu konfirmasi'],
    },
    addressBarShare: 'Ketuk ikon Bagikan di samping kolom alamat',
    bookmarkSteps: {
      iphone: 'Buka menu halaman, pilih Tambah Penanda, lalu ketuk Simpan.',
      iphoneChrome: 'Buka menu ⋯, lalu ketuk Tambahkan ke bookmark.',
      android: 'Buka menu ⋮, lalu ketuk ikon bintang.',
      otherAndroid: 'Buka menu browser, lalu pilih Tambahkan ke bookmark.',
      desktop: 'Klik ikon bintang di kolom alamat, lalu simpan.',
    },
    desktopSteps: ['Buka menu browser, lalu pilih Transmisikan, simpan, dan bagikan.', 'Pilih Buat pintasan, lalu konfirmasi.'],
  },
};

function saveContext() {
  const agent = navigator.userAgent;
  const embedded = /; wv\)|MicroMessenger|\bFBAN|\bFBAV|Instagram|GSA\//i.test(agent);
  if (/iPhone|iPad|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return {browser:/CriOS\//i.test(agent)?'iphoneChrome':'iphone',embedded} as const;
  }
  if (/Android/i.test(agent)) {
    const chrome = /Chrome\//i.test(agent) && !/Edg|OPR|SamsungBrowser/i.test(agent);
    return {browser:chrome?'android':'otherAndroid',embedded} as const;
  }
  return {browser:'desktop',embedded} as const;
}

export function PublicLinkModal({title, close, label, children, className = '', focusTitle = false, restoreFocus = true}: {
  title:string; close:()=>void; label:string; children:ReactNode; className?:string; focusTitle?:boolean; restoreFocus?:boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    dialog.showModal();
    if (focusTitle) heading.current?.focus({preventScroll:true});
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (restoreFocus && opener?.isConnected) opener.focus({preventScroll:true});
      if (!restoreFocus && document.activeElement===opener) opener?.blur();
    };
  }, [focusTitle,restoreFocus]);
  return <dialog ref={ref} className={`public-link-dialog ${className}`} aria-label={title}
    onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}
    onClick={event=>{if (event.target === event.currentTarget) close();}}>
    <div className="public-link-dialog-inner">
      <header>
        <h2 ref={heading} tabIndex={focusTitle?-1:undefined}>{title}</h2>
        <button type="button" onClick={close} aria-label={label}><X size={22} aria-hidden="true"/></button>
      </header>
      {children}
    </div>
  </dialog>;
}

export function PublicLinkDialog({language, address, shareTitle, combined = false, restoreFocus, close}: {
  language:SiteLanguage; address:string; shareTitle?:string; combined?:boolean; restoreFocus?:boolean; close:()=>void;
}) {
  const t = words[language];
  const [status,setStatus] = useState<'idle'|'copied'|'failed'|'share-failed'>('idle');
  const installState = useSyncExternalStore(subscribePublicInstall, publicInstallState);
  const [installResult,setInstallResult] = useState<'idle'|'pending'|'accepted'|'dismissed'|'failed'>('idle');
  const installLabelId = useId();
  const installDestinationId = useId();
  const shortcut = useRef<HTMLDetailsElement>(null);
  const bookmark = useRef<HTMLElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const manualLink = useRef<HTMLInputElement>(null);
  const page = new URL(address, window.location.origin);
  const url = page.href;
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
  async function install() {
    if (installResult==='pending') return;
    setInstallResult('pending');
    try {
      const choice = await promptPublicInstall();
      setInstallResult(choice?.outcome ?? 'failed');
    } catch (error) {
      setInstallResult((error as Error)?.name==='AbortError' ? 'dismissed' : 'failed');
    }
  }
  useEffect(() => {
    if (installResult==='accepted') {
      bookmark.current?.focus({preventScroll:true});
    } else if (installResult==='failed' || installResult==='dismissed') {
      if (installResult==='failed' && shortcut.current) shortcut.current.open = true;
      shortcut.current?.querySelector('summary')?.focus({preventScroll:true});
    }
  }, [installResult]);
  const {browser,embedded} = saveContext();
  const desktop = browser==='desktop';
  const DeviceIcon = desktop?Monitor:Smartphone;
  const systemShare = shareTitle && typeof navigator.share==='function' &&
    (!combined || typeof navigator.canShare!=='function' || navigator.canShare({title:shareTitle,url}));
  const feedback = status==='failed'?t.failed:status==='copied'?t.copied:status==='share-failed'?t.shareFailed:'';
  const shortcutTitle = desktop?t.desktopTitle:t.mobileTitle;
  const isInstalled = installState==='installed' || installResult==='accepted';
  const canInstall = !isInstalled && (installState==='ready' || installResult==='pending');
  const shortcutGuide = browser==='iphoneChrome'?'iphone':browser;
  const FirstStepIcon = shortcutGuide==='iphone'?Share:EllipsisVertical;
  const instructions = <div className="public-link-shortcut-guide">
        {embedded&&<p className="public-link-shortcut-open">{t.openInBrowser}</p>}
        {shortcutGuide!=='desktop' ? <ol className="public-link-visual-steps" role="list">
          {t.shortcutLabels[shortcutGuide].map((label,index)=>{
            const StepIcon = index===0?FirstStepIcon:PlusSquare;
            return <li key={label}>
              <span className="public-link-step-icon"><StepIcon size={18} aria-hidden="true"/></span>
              <div><strong>{label}</strong><span>{browser==='iphoneChrome' && index===0?t.addressBarShare:t.shortcutNotes[shortcutGuide][index]}</span></div>
            </li>;
          })}
        </ol> : <ol role="list">
          {t.desktopSteps.map(step=><li key={step}>{step}</li>)}
        </ol>}
      </div>;
  const addressField = <details ref={disclosure} className="public-link-panel-address">
      <summary>{t.showLink}<ChevronDown size={15} aria-hidden="true"/></summary>
      <input ref={manualLink} aria-label={t.pageLink} readOnly value={url} onFocus={event=>event.currentTarget.select()}/>
    </details>;
  return <PublicLinkModal title={combined?t.shareAndSave:shareTitle?t.share:shortcutTitle} close={close} label={t.close} focusTitle={combined} restoreFocus={restoreFocus}
    className={`public-link-panel${combined?' public-link-panel--combined':''}`}>
    {combined ? <div className="public-link-preview">
      <span className="public-link-preview-icon"><img src="/uper-logo-mark.svg" alt="" width="27" height="27"/></span>
      <div><strong>{shareTitle}</strong><span>{page.host}{page.pathname}</span></div>
    </div> : shareTitle ? <p className="public-link-shortcut-guide public-link-share-subject">{shareTitle}</p> : instructions}
    {!combined&&addressField}
    <div className="public-link-panel-actions">
      {systemShare&&<button type="button" className="public-link-panel-action" onClick={()=>void share(shareTitle)}>
        {combined?<Share size={18} aria-hidden="true"/>:<Share2 size={18} aria-hidden="true"/>}{combined?t.shareVia:t.share}
      </button>}
      <button type="button" className={`public-link-panel-action${systemShare?' public-link-panel-action--secondary':''}`} onClick={copy}>
        {status==='copied'?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>}
        {status==='copied'?t.shortcutCopied:t.copy}
      </button>
    </div>
    {combined&&addressField}
    <p role="status" className={status==='failed'||status==='share-failed'?'public-link-copy-status':'sr-only'}>{feedback}</p>
    {combined&&<div className="public-link-save-choices">
      {isInstalled ? <p className="public-link-installed" role="status"><Check size={18} aria-hidden="true"/>{t.installed}</p> :
        canInstall ? <button type="button" className="public-link-install" onClick={()=>void install()}
          aria-disabled={installResult==='pending'} aria-labelledby={installLabelId} aria-describedby={installDestinationId}>
          <Smartphone size={19} aria-hidden="true"/>
          <span><span id={installLabelId}>{shortcutTitle}</span><small id={installDestinationId}>{t.installOpens}</small></span>
          <Download size={16} aria-hidden="true"/>
        </button> : <details name="public-link-save" ref={shortcut}>
        <summary><DeviceIcon size={19} aria-hidden="true"/><span>{shortcutTitle}</span><ChevronRight size={16} aria-hidden="true"/></summary>
        {installResult==='failed'&&<p role="status" className="public-link-copy-status public-link-install-error">{t.installFailed}</p>}
        {instructions}
      </details>}
      <details name="public-link-save">
        <summary ref={bookmark}><Bookmark size={19} aria-hidden="true"/><span>{t.addBookmark}</span><ChevronRight size={16} aria-hidden="true"/></summary>
        <div className="public-link-shortcut-guide">
          {embedded&&<p className="public-link-shortcut-open">{t.openInBrowser}</p>}
          <p>{t.bookmarkSteps[browser]}</p>
        </div>
      </details>
    </div>}
  </PublicLinkModal>;
}

export function PublicPageLinkActions({path, language, params, shareTitle, mobileOnly = false}: {
  path:'/'|'/link'|'/chat'|'/enrollment'; language:SiteLanguage; params:URLSearchParams; shareTitle:string; mobileOnly?:boolean;
}) {
  const [action,setAction] = useState<'shortcut'|'share'|'combined'>();
  const [restoreFocus,setRestoreFocus] = useState(true);
  const t = words[language];
  const previewTitle = path==='/'?t.homeTitle:path==='/link'?t.hubTitle:shareTitle;
  return <>
    <button type="button" className="public-link-button public-link-button--mobile"
      aria-label={t.shareAndSave} title={t.shareAndSave} aria-haspopup="dialog" onClick={event=>{
        event.currentTarget.focus({preventScroll:true});
        setRestoreFocus(event.detail===0);
        setAction('combined');
      }}>
      <Share size={18} strokeWidth={1.65} aria-hidden="true"/>
    </button>
    {!mobileOnly&&<>
      <button type="button" className="public-link-button public-link-bookmark public-link-button--desktop"
        aria-label={t.save} title={t.save} aria-haspopup="dialog" onClick={()=>setAction('shortcut')}>
        <Bookmark size={19} aria-hidden="true"/>
      </button>
      <button type="button" className="public-link-button public-link-share public-link-button--desktop"
        aria-label={t.sharePage} title={t.sharePage} aria-haspopup="dialog" onClick={()=>setAction('share')}>
        <Share2 size={19} aria-hidden="true"/>
      </button>
    </>}
    {action&&<PublicLinkDialog language={language} address={promotionJourneyUrl(`${path}?lang=${language}`,params)}
      combined={action==='combined'} restoreFocus={action!=='combined'||restoreFocus} shareTitle={action==='combined'?previewTitle:action==='share'?shareTitle:undefined}
      close={()=>setAction(undefined)}/>}
  </>;
}
