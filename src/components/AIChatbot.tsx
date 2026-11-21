import {lazy, Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {MessageCircleMore, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {chooseText, type HskLanguage} from '../data/hskAssessment';
import {chatPromotionParams, type ChatOrigin} from '../services/portalChat';
import {normalizeSiteLanguage} from '../utils/siteMetadata';
import {promotionEntryPoint, websitePromotionUrl} from '../utils/promotionNavigation';
import {trackChatbotInteraction, trackEvent} from '../utils/analytics';
import './site-chat-host.css';
import {clearChatMessageAnchor,readChatMessageAnchor} from '../utils/chatJourneyNavigation';
import {visitorScope} from '../services/visitorScope';

const ChatWorkspace = lazy(() => import('./ChatWorkspace'));
const mobileQuery = '(max-width: 767px)';
function subscribeViewport(notify: () => void) {
  const viewport = window.matchMedia(mobileQuery);
  viewport.addEventListener('change', notify);
  return () => viewport.removeEventListener('change', notify);
}

export default function AIChatbot({expanded,returnScroll}: {expanded: boolean; returnScroll?: number}) {
  const {i18n} = useTranslation();
  const lang = normalizeSiteLanguage(i18n.language);
  const current = useLocation();
  const navigate = useNavigate();
  const [open,setOpen] = useState(()=>{
    const anchor=readChatMessageAnchor();
    return expanded||anchor?.widget===true&&anchor.owner===visitorScope();
  });
  const [started,setStarted] = useState(open);
  const launcher = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const restoreScroll = useRef(expanded ? returnScroll : undefined);
  const mobile = useSyncExternalStore(subscribeViewport, () => matchMedia(mobileQuery).matches, () => false);
  const visible = open || expanded;
  const modal = mobile || expanded;
  const label = chooseText(lang,'UPER 学习咨询','UPER Learning Advisory','Konsultasi Belajar UPER');
  const launcherLabel = visible
    ? chooseText(lang,'关闭咨询','Close chat','Tutup konsultasi')
    : chooseText(lang,'课程咨询','Course advice','Konsultasi kursus');

  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node || !visible) {
      node?.close();
      return;
    }
    if (node.open && node.matches(':modal') !== modal) node.close();
    if (!node.open) {
      if (modal) node.showModal();
      else node.show();
      node.querySelector<HTMLElement>('[data-chat-host-dismiss]')?.focus({preventScroll:true});
    }
  }, [visible, modal]);

  // On reload of an expanded chat, restore the website position when its history entry becomes visible again.
  useLayoutEffect(() => {
    if (expanded || restoreScroll.current === undefined) return;
    const y = restoreScroll.current;
    restoreScroll.current = undefined;
    const frame = requestAnimationFrame(() => window.scrollTo({top:y,behavior:'instant'}));
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  function dismiss() {
    if (expanded) {
      navigate(-1);
      return;
    }
    clearChatMessageAnchor();
    setOpen(false);
    trackChatbotInteraction('close');
    requestAnimationFrame(() => launcher.current?.focus({preventScroll:true}));
  }

  function toggle() {
    if (visible) {
      dismiss();
      return;
    }
    setStarted(true);
    setOpen(true);
    trackChatbotInteraction('open');
  }

  function expand(origin: ChatOrigin, language: HskLanguage) {
    const params = chatPromotionParams(origin);
    const entry = promotionEntryPoint(params.get('entry_point')) ??
      (origin.source === 'standalone_chat' ? 'direct' : 'homepage_widget');
    const url = new URL(websitePromotionUrl('/chat',params,entry),window.location.origin);
    url.searchParams.set('lang',language);
    trackEvent('link_click',{target:'consultation',entry_point:'homepage_widget'});
    const scrollY = window.scrollY;
    restoreScroll.current = scrollY;
    navigate(url.pathname+url.search,{state:{siteChatBackground:{location:current,scrollY}}});
  }

  return <>
    <button type="button" ref={launcher} id="uper-ai-fab" className="site-chat-launcher" onClick={toggle}
      aria-expanded={visible} aria-controls="uper-ai-chat-window">
      {visible ? <X size={19} aria-hidden="true"/> : <MessageCircleMore size={19} aria-hidden="true"/>}
      <span>{launcherLabel}</span>
    </button>
    <dialog ref={dialog} className="site-chat-host" id="uper-ai-chat-window" aria-label={label}
      data-fullscreen={modal || undefined}
      onCancel={event=>{event.preventDefault();dismiss();}}
      onKeyDown={event=>{
        const nestedDialog=(event.target as HTMLElement).closest('dialog[open]');
        if(event.key==='Escape'&&!modal&&!event.defaultPrevented&&nestedDialog===event.currentTarget){
          event.preventDefault();dismiss();
        }
      }}>
      {started&&<Suspense fallback={<p className="p-4" role="status">{chooseText(lang,'正在打开咨询…','Opening consultation…','Membuka konsultasi…')}</p>}>
        <ChatWorkspace presentation={expanded?'expanded':mobile?'mobile':'panel'} initialLanguage={lang}
          active={visible} onDismiss={dismiss} onExpand={expand}/>
      </Suspense>}
    </dialog>
  </>;
}
