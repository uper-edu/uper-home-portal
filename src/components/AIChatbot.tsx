import {lazy, Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {Bot, GraduationCap, Sparkles, X} from 'lucide-react';
import {motion} from 'motion/react';
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
  const {t, i18n} = useTranslation();
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
    <div className="fixed bottom-24 right-6 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-3 select-none">
      <motion.button type="button" ref={launcher} id="uper-ai-fab"
        whileHover={{scale:1.08}} whileTap={{scale:.95}} onClick={toggle}
        aria-label={t('faq.toggleAiService')} aria-expanded={visible} aria-controls="uper-ai-chat-window"
        className={'relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all duration-300 group '+
          (visible ? 'bg-slate-900 text-white hover:bg-slate-800' :
            'bg-gradient-to-tr from-primary-600 to-primary-500 text-white hover:shadow-primary-600/45 hover:shadow-xl')}>
        {visible ? <X className="w-5.5 h-5.5" aria-hidden="true"/> :
          <span className="relative w-full h-full flex items-center justify-center" aria-hidden="true">
            <span className="absolute inset-1.5 border border-dashed border-white/25 rounded-full animate-[spin_15s_linear_infinite] group-hover:border-white/50"/>
            <Sparkles className="absolute top-2.5 right-2.5 w-3 h-3 text-amber-300 opacity-90"/>
            <Bot className="w-6.5 h-6.5 text-white drop-shadow-sm group-hover:-translate-y-0.5 transition-transform duration-300"/>
            <GraduationCap className="absolute top-2.5 left-2.5 w-4 h-4 text-white/90 -rotate-[20deg]"/>
            <span className="absolute top-0 right-0 flex size-3">
              <span className="animate-ping absolute size-full rounded-full bg-amber-400 opacity-75"/>
              <span className="relative size-3 rounded-full bg-amber-500"/>
            </span>
          </span>}
      </motion.button>
    </div>
    <dialog ref={dialog} className="site-chat-host" id="uper-ai-chat-window" aria-label={label}
      data-fullscreen={modal || undefined}
      onCancel={event=>{event.preventDefault();dismiss();}}
      onKeyDown={event=>{
        if(event.key==='Escape'&&!modal&&!event.defaultPrevented){event.preventDefault();dismiss();}
      }}>
      {started&&<Suspense fallback={<p className="p-4" role="status">{chooseText(lang,'正在打开咨询…','Opening consultation…','Membuka konsultasi…')}</p>}>
        <ChatWorkspace presentation={expanded?'expanded':mobile?'mobile':'panel'} initialLanguage={lang}
          active={visible} onDismiss={dismiss} onExpand={expand}/>
      </Suspense>}
    </dialog>
  </>;
}
