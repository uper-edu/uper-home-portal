import {createBrowserUuid} from '../utils/browserUuid';
import {chatWorkspaceEntry,type ChatWorkspaceEntry} from '../utils/chatWorkspaceAction';
import {ChatComposer,ChatFollowups,ChatMessage as ChatBubble,ChatTyping} from './ChatConversation';
import type {EnrollmentGuideAction} from '../utils/enrollmentGuidance';
import {watchPromotionLanguage} from '../utils/promotionLookup';
import {linkHubReturnUrl,promotionIdentity,promotionParameters} from '../utils/promotionNavigation';
import {trackEvent} from '../utils/analytics';
import {chatLanguage} from '../utils/chatLanguage';
import {subscribeVisitorScope,visitorScope} from '../services/visitorScope';
import {PageMetadata} from './PageMetadata';
import { safeHskResult } from "../data/hskReportHistory";
import {draft,type Delivery} from "../services/chatDelivery";
import {chatFetch, chatPromotionParams, registerContact, finishChat, startAnotherVisitor, sharedChatDrafts} from '../services/portalChat';
import {announceChatChange,useSharedChat} from '../hooks/useSharedChat';
import {readChatInputDraft,writeChatInputDraft} from '../hooks/useChatInputDraft';
import {preloadEnrollmentNavigation} from '../services/enrollmentClassDetails';
import {trackChatbotInteraction} from '../utils/analytics';
import type {ChatOrigin,ChatSource} from '../services/portalChat';
import type {ChatPresentation} from './StandaloneChatChrome';
import {clearChatMessageAnchor,readChatMessageAnchor,readEnrollmentConsultation,returnAlongJourney} from '../utils/chatJourneyNavigation';
import type {EnrollmentChatSelection} from '../utils/enrollmentChatJourney';
import {lazy,memo,Suspense,useState,useCallback,useEffect,useMemo,useRef,type ComponentProps,type ComponentType} from 'react';
import {reportClientFailure} from '../services/clientDiagnostics';
import {useLocation,useNavigate} from 'react-router-dom';
import {ChatAssessmentSummary,ChatWelcome,ChatWelcomeSocials,StandaloneChatDialog,StandaloneChatHeader} from './StandaloneChatChrome';
import '../pages/standalone-chat.css';
import {type HskResult, chooseText} from '../data/hskAssessment';
import {retryHskAttempt, restoreVerifiedHskAttempts, assessmentConsultation, profileConsultation} from '../services/portalChat';
import {writeHskResult,readHskHistory,readHskDraft,hasHskDraft,clearHskDraft} from '../services/hskAttemptStorage';
import {watchReadReconnect} from '../services/readReconnect';
import {hskWhatsAppDraft} from '../services/hskWhatsApp';
import {chatAssessmentReturn,rememberChatAssessment,chatAssessmentSummaryId,chatAssessmentReplyId} from '../services/chatAssessmentReturn';
import type {ChatRegistrationStep} from '../services/chatRegistrationDraft';
import type { LeadProfile } from '../types/leadSystem';
import {
  getStudentContext,
  getChatAssessmentStatus,
  saveStudentContext,
  subscribeStudentContext
} from '../services/studentProfileStorage';

type DeferredAssessmentProps=ComponentProps<typeof import('./HSKPlacementAssessment').default>&{onLoadCancel:()=>void};
const HskAssessmentReport=lazy(()=>Promise.all([
  import('./HskAssessmentReport'),
  import('./hsk-assessment-report.css'),
]).then(([report])=>report).catch(error=>{
  reportClientFailure(error,'preload');
  return {default:({lang='en'}:ComponentProps<typeof import('./HskAssessmentReport').default>)=>
    <div className="hsk-report-notice" role="alert">
      <p>{chooseText(lang,'暂时无法加载测评详情。','Assessment details could not load.','Detail hasil tes belum dapat dimuat.')}</p>
      <button type="button" className="chat-enrollment-next" onClick={()=>window.location.reload()}>
        {chooseText(lang,'刷新页面','Refresh page','Muat ulang halaman')}
      </button>
    </div>};
}));
const HSKPlacementAssessment=lazy<ComponentType<DeferredAssessmentProps>>(()=>Promise.all([
  import('./HSKPlacementAssessment'),
  import('./hsk-picture-layout.css'),
  import('./hsk-assessment-report.css'),
]).then(([assessment])=>assessment).catch(error=>{
  reportClientFailure(error,'preload');
  // The browser can cache failed module imports for this document. Refresh starts a new request.
  return {default:({lang='en',onLoadCancel}:DeferredAssessmentProps)=><div className="space-y-3 p-4 text-sm">
    <p role="alert">{chooseText(lang,'暂时无法加载测评。可以刷新页面重试，也可以先返回咨询。','The assessment could not load. Refresh to try again or return to chat.','Tes belum dapat dimuat. Muat ulang untuk mencoba lagi atau kembali ke chat.')}</p>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="chat-enrollment-next chat-enrollment-next--primary" onClick={()=>window.location.reload()}>{chooseText(lang,'刷新页面','Refresh page','Muat ulang halaman')}</button>
      <button type="button" className="chat-enrollment-next" onClick={onLoadCancel}>{chooseText(lang,'返回咨询','Return to chat','Kembali ke chat')}</button>
    </div>
  </div>};
}));

type LearningProfileProps=ComponentProps<typeof import('./GFormOnboardingModal').default>;
function LearningProfileLoadNotice({lang,onClose,failed=false}:{lang:LearningProfileProps['initialLang'];onClose:()=>void;failed?:boolean}){
  const t=(zh:string,en:string,id:string)=>chooseText(lang??'en',zh,en,id);
  return <StandaloneChatDialog title={t('学习资料','Learning profile','Profil belajar')}
    closeLabel={t('关闭资料登记','Close registration','Tutup pendaftaran')} onClose={onClose}>
    {failed?<p role="alert">{t('暂时无法加载学习资料。可刷新页面重试。','The learning profile could not load. Refresh the page to try again.','Profil belajar belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.')}</p>:
      <p role="status">{t('正在加载学习资料…','Loading learning profile…','Memuat profil belajar…')}</p>}
    <div className="chat-dialog-actions">
      <button type="button" onClick={onClose}>{t('返回咨询','Return to chat','Kembali ke chat')}</button>
      {failed&&<button type="button" className="chat-primary" onClick={()=>window.location.reload()}>{t('刷新页面','Refresh page','Muat ulang halaman')}</button>}
    </div>
  </StandaloneChatDialog>;
}
const GFormOnboardingModal=lazy(()=>import('./GFormOnboardingModal').catch(error=>{
  reportClientFailure(error,'preload');
  return {default:({initialLang='en',onConsultFirst}:LearningProfileProps)=><LearningProfileLoadNotice lang={initialLang} onClose={()=>onConsultFirst?.(initialLang)} failed/>};
}));

interface ChatMessage {
  enrollment?:EnrollmentGuideAction;
  delivery?: Delivery;
  enrollmentContext?: EnrollmentChatSelection;
  action?: 'handoff'|'booking'|'enrollment';
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestedPrompts?: string[];
  workspaceEntry?:ChatWorkspaceEntry;
  isAssessmentResult?: boolean;
  assessmentData?: HskResult & { whatsapp?: string };
}

type MessageEntry = (value:ChatWorkspaceEntry) => {label:string;open:()=>void}|undefined;

const WorkspaceMessage = memo(function WorkspaceMessage({message,lang,source,page,conversationId,owner,entry,
  widget,compact,active,busy,retry,checkReply,checkingReply,onReport,messageEntry}:{
  message:ChatMessage;lang:'zh'|'en'|'id';source:ChatSource;page:ChatOrigin['page'];conversationId:string;owner:string;
  entry:ChatSource;widget:boolean;compact:boolean;active:boolean;busy:boolean;retry?:()=>void;checkReply?:()=>void;checkingReply?:boolean;
  onReport:(report:HskResult)=>void;messageEntry?:MessageEntry;
}){
  const action=message.role==='assistant'&&message.workspaceEntry&&message.content.trim()
    ? messageEntry?.(message.workspaceEntry) : undefined;
  return <ChatBubble role={message.role==='user'?'user':'assistant'} content={message.content} language={lang} entry={entry}
    origin={{source,page}} enrollment={message.enrollment}
    anchor={message.enrollment?{owner,conversationId,messageId:message.id,widget}:undefined}
    delivery={message.delivery} compact={compact} active={active} busy={busy} onRetry={retry} onCheckReply={checkReply} checkingReply={checkingReply}
    entryAction={action&&<button type="button" className="chat-enrollment-next chat-enrollment-next--primary" data-chat-workspace-action
      disabled={busy} onClick={action.open}>{action.label}</button>}>
    {message.isAssessmentResult&&message.assessmentData?<ChatAssessmentSummary result={message.assessmentData} lang={lang}
      onDetails={onReport}/>:undefined}
  </ChatBubble>;
});

function assessmentMessage(result:HskResult):ChatMessage {
  return {id:chatAssessmentSummaryId(result.attempt.attemptId),role:'assistant',content:result.summary,
    timestamp:new Date(result.attempt.completedAt!),isAssessmentResult:true,assessmentData:result};
}

type ChatWorkspaceProps = {
  presentation?: ChatPresentation;
  active?: boolean;
  initialLanguage?: 'en' | 'id' | 'zh';
  onDismiss?: () => void;
  onExpand?: (origin: {source: ChatSource; page?: string}, language: 'en' | 'id' | 'zh') => void;
};

export default function ChatWorkspace({
  presentation = 'page', active = true, initialLanguage, onDismiss, onExpand,
}: ChatWorkspaceProps) {
  const {state,key:routeKey,pathname,search} = useLocation();
  const navigate = useNavigate();
  const fromEnrollment = readEnrollmentConsultation(state);
  const returnAnchor = readChatMessageAnchor();
  const restoredAnchor = useRef('');
  const embedded = presentation !== 'page';
  const compact = presentation === 'panel';
  const chatSource: ChatSource = presentation === 'page' || presentation === 'expanded' ? 'standalone_chat' : 'homepage_widget';
  const [threadId] = useState(() => !embedded ? new URLSearchParams(location.hash.slice(1)).get('continue') ?? undefined : undefined);
  const [initialContext] = useState(getStudentContext);
  const [profile, setProfile] = useState<LeadProfile | null>(() => {
    const ctx = getStudentContext();
    return ctx?.leadProfile || null;
  });
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [report,setReport] = useState<HskResult|null>(null);
  const [confirm,setConfirm] = useState<'restart'|'switch'|'retake'|null>(null);
  const [restartFrom,setRestartFrom] = useState<string>();
  const [isTakingAssessment, setIsTakingAssessment] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const lastMessage=messages[messages.length-1];
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const initialInputFocusHandled = useRef(false);
  const [isTyping, setIsTyping] = useState(false);
  const [{language:lang}, setChatLanguage] = useState(()=>({
    language:chatLanguage(initialContext?.preferredLanguage ?? initialLanguage,window.location.search),
    selected:false,
  }));

  const {thread, failed:chatFailed, readbackFailed, starting, checkingReply, replyPending, replyStalled, stalledQuestion, startNew, refresh:refreshChat, refreshInBackground} = useSharedChat(chatSource, isTyping || !active, threadId);
  const [assessment, setAssessment] = useState<HskResult|null|undefined>();
  const assessmentRestore = useRef<AbortController | undefined>(undefined);
  const assessmentHistoryConfirmed = useRef(false);
  const [owner] = useState(visitorScope);
  const previousThread = useRef<string | undefined>(undefined);
  const appliedSnapshot = useRef<{thread:typeof thread;assessment:typeof assessment} | undefined>(undefined);
  const sending = useRef<AbortController|undefined>(undefined);

  useEffect(()=>{
    const unsubscribe=subscribeVisitorScope(()=>{
      if(visitorScope()!==owner)sending.current?.abort();
    });
    return ()=>{
      unsubscribe();
      sending.current?.abort();
    };
  },[owner]);

  useEffect(() => {
    if(!active||assessmentHistoryConfirmed.current)return;
    const request = new AbortController();
    assessmentRestore.current = request;
    const language = initialContext?.preferredLanguage || lang;
    const isCurrent = () => !request.signal.aborted && visitorScope() === owner;
    const applyHistory = (attempts:HskResult[]) => {
      const returnTo=chatAssessmentReturn(owner);
      const bound=returnTo && attempts.find(item=>item.attempt.attemptId===returnTo.attemptId);
      const restored = bound ?? attempts[0];
      const fallback = restored ? undefined : safeHskResult(initialContext?.assessment?.result, language);
      if (fallback) writeHskResult(fallback);
      setAssessment(restored ?? fallback ?? null);
    };
    const reconnect=watchReadReconnect(readHistory);
    function readHistory() {
      if (!isCurrent()) return;
      void restoreVerifiedHskAttempts(owner,request.signal).then(attempts=>{
        if (!isCurrent()) return;
        assessmentHistoryConfirmed.current=true;
        reconnect.stop();
        applyHistory(attempts);
      },()=>{
        if (!isCurrent()) return;
        applyHistory(readHskHistory(language));
        reconnect.failed();
      });
    }
    request.signal.addEventListener('abort',reconnect.stop,{once:true});
    readHistory();
    return () => { request.abort(); };
  }, [active,owner]);

  useEffect(() => {
    if (!thread || isTyping) return;
    const previous=appliedSnapshot.current;
    const sameSnapshot=previous?.thread===thread;
    if(sameSnapshot && previous?.assessment===assessment)return;
    appliedSnapshot.current={thread,assessment};
    // Close the previous conversation's UI even if assessment history is still loading.
    if (previous?.thread && previous.thread.conversationId !== thread.conversationId) {
      setShowOnboardingModal(false);
      setReport(null);
      setIsTakingAssessment(false);
      setConsultationError(null);
      setProfileConsultationError(false);
    }
    const rows = thread.messages;
    const visibleRows = rows.filter(row => !(
      (row.id.startsWith('reply-hsk-intro-') || row.id.startsWith('reply-profile-intro-'))
      && ['failed','interrupted'].includes(row.status)
    ));
    if (assessment === undefined) {
      // The conversation is ready even while its assessment summary is being restored.
      setMessages(visibleRows);
      return;
    }
    const firstLoad = previousThread.current === undefined;
    const changed = !firstLoad && previousThread.current !== thread.conversationId;
    previousThread.current = thread.conversationId;
    const assessmentId=assessment?.attempt.attemptId;
    const returnTo=assessmentId && chatAssessmentReturn(owner,assessmentId);
    const bound=!!assessmentId && assessmentId===returnTo?.attemptId && returnTo.conversationId===thread.conversationId;
    const replyId=assessmentId && chatAssessmentReplyId(assessmentId);
    const savedReply=replyId?rows.find(row=>row.id===replyId):undefined;
    const failedIntro = assessment && savedReply && ['failed','interrupted'].includes(savedReply.status);
    if (firstLoad && getChatAssessmentStatus(initialContext)==='pending') {
      const draft=readHskDraft();
      const draftReturn=draft && chatAssessmentReturn(owner,draft.attempt.attemptId);
      if (draft && (!draftReturn || draftReturn.conversationId===thread.conversationId) &&
        !(assessmentId===draft.attempt.attemptId && assessment?.saveStatus==='saved')) setIsTakingAssessment(true);
    }
    const failedProfile = rows.some(row => row.id.startsWith('reply-profile-intro-') && ['failed','interrupted'].includes(row.status));
    const initialStandalone = firstLoad && !embedded && !fromEnrollment && !thread.restarted && thread.source === chatSource && !rows.length;
    const introIndex = replyId ? visibleRows.findIndex(row => row.id === replyId) : -1;
    const summary = assessment && (bound || introIndex >= 0 || failedIntro || initialStandalone&&!returnTo)
      ? [assessmentMessage(assessment)]
      : [];
    setMessages(current=>{
      // A late assessment must not overwrite messages sent after this snapshot was read.
      const base=sameSnapshot?current.filter(row=>!row.isAssessmentResult):visibleRows;
      const index=sameSnapshot?base.findIndex(row=>row.id===replyId):introIndex;
      return index<0?[...base,...summary]:[...base.slice(0,index),...summary,...base.slice(index)];
    });
    if (changed || failedIntro || introIndex >= 0) setConsultationError(failedIntro ? assessment : null);
    if (changed || failedProfile || visibleRows.some(row => row.id.startsWith('reply-profile-intro-') && row.status === 'completed'))
      setProfileConsultationError(failedProfile);
    if (firstLoad && assessment?.saveStatus==='saved' && !savedReply &&
      (bound || initialStandalone&&!returnTo&&!hasHskDraft())) {
      void beginAssessmentConsultation(assessment);
    } else if (initialStandalone && !assessment && !hasHskDraft() && initialContext?.leadProfile?.goal &&
      getChatAssessmentStatus(initialContext)!=='completed') {
      void beginProfileConsultation();
    }
  }, [thread, assessment, isTyping]);

  // A saved promotion entry also selects the interface language for returning visitors.
  // Existing customer records, messages and assessment state are not rewritten.
  useEffect(() => {
    if (embedded && !new URLSearchParams(window.location.search).has('p')) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('lang')) return;
    return watchPromotionLanguage(params,language=>{
      if (!new URLSearchParams(window.location.search).has('lang'))
        setChatLanguage(current=>current.selected||current.language===language?current:{language,selected:false});
    });
  }, []);

  const changeLanguage = (language: 'en' | 'id' | 'zh') => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', language);
    if (presentation === 'page' || presentation === 'expanded') window.history.replaceState(window.history.state, '', url);
    setChatLanguage({language,selected:true});
    saveStudentContext({ preferredLanguage: language });
  };

  const consultFirst=(language:'en'|'id'|'zh')=>{
    setShowOnboardingModal(false);
    if(language!==lang)changeLanguage(language);
    requestAnimationFrame(()=>inputRef.current?.focus());
  };

  const leaveAssessment = () => {
    const status=hasHskDraft()?'paused':'skipped';
    followLatest.current=true;
    setIsTakingAssessment(false);
    saveStudentContext({chatAssessmentStatus:status});
    return status;
  };
  const handleAssessmentCancel = () => {
    trackEvent('assessment_exit',{reason:leaveAssessment()});
    if (profile?.goal && !thread?.messages.length) void beginProfileConsultation();
  };

  const positionedThread = useRef<string | undefined>(undefined);
  const followLatest = useRef(true);

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active && !isTakingAssessment) {
      const anchorKey = returnAnchor && routeKey+':'+returnAnchor.messageId;
      if (anchorKey && returnAnchor.owner===visitorScope() && returnAnchor.conversationId===thread?.conversationId) {
        // Late assessment and history reads must not pull the learner away from the returned message.
        if(restoredAnchor.current===anchorKey)return;
        const target=mainRef.current?.querySelector<HTMLElement>('[data-chat-message-id="'+CSS.escape(returnAnchor.messageId)+'"]');
        if (target) {
          restoredAnchor.current=anchorKey;
          target.focus({preventScroll:true});
          target.scrollIntoView({behavior:'instant',block:'start'});
          return;
        }
      }
      const last=lastMessage;
      const firstPosition=!!(last&&thread&&positionedThread.current!==thread.conversationId);
      if(firstPosition){
        positionedThread.current=thread?.conversationId;
        followLatest.current=true;
      }
      // Keep the reader's position when a reply grows or another tab syncs.
      if(!followLatest.current)return;
      const frame=requestAnimationFrame(()=>{
        if(!followLatest.current)return;
        const region=mainRef.current;
        if(!region)return;
        if(last?.isAssessmentResult || last?.id.startsWith('reply-hsk-intro-'))
          region.querySelector('[data-hsk-result-anchor]')?.scrollIntoView({behavior:'instant',block:'start'});
        else region.scrollTop=region.scrollHeight;
      });
      return ()=>cancelAnimationFrame(frame);
    }
  }, [messages, isTyping, isTakingAssessment, active, thread?.conversationId, routeKey]);
  useEffect(() => {
    if (isTakingAssessment) mainRef.current?.scrollTo({ top: 0 });
  }, [isTakingAssessment]);

  // Keep state synchronized with storage events
  useEffect(() => {
    const unsubscribe = subscribeStudentContext((ctx) => {
      setProfile(ctx?.leadProfile || null);
      const language=ctx?.preferredLanguage;
      if(language)setChatLanguage(current=>current.language===language?current:{...current,language});
      if (ctx?.assessment?.result) {
        const owned=safeHskResult(ctx.assessment.result,ctx.preferredLanguage??'en');
        if (owned) setAssessment(owned);
      }
    });
    return unsubscribe;
  }, []);

  const handleStartVoluntaryAssessment = useCallback(() => {
    clearChatMessageAnchor();
    setIsTakingAssessment(true);
    saveStudentContext({chatAssessmentStatus:'pending',preferredLanguage:lang});
  },[lang]);

  const handleOnboardingComplete = async (answers: object, selectedLang: 'en'|'id'|'zh',
    options:{queryOnly?:boolean;retryOriginal?:boolean},step:ChatRegistrationStep) => {
    const conversationId=thread?.conversationId;
    const contacts=step==='preferences'&&profile?{fullName:profile.fullName,whatsapp:profile.whatsapp,email:profile.email}:{};
    const origin=fromEnrollment&&thread?{source:thread.source,page:fromEnrollment.url}:thread;
    const registration=await registerContact({...answers,...contacts,language:selectedLang},{...options,chatOrigin:origin,contactConversion:step==='contact'});
    // The saved profile belongs to the visitor; the follow-up belongs to the conversation that submitted it.
    if(visitorScope()!==owner||appliedSnapshot.current?.thread?.conversationId!==conversationId)return;
    const savedProfile={...profile,...registration.lead};
    setProfile(savedProfile);
    if (selectedLang!==lang) changeLanguage(selectedLang);
    saveStudentContext({leadProfile:savedProfile,preferredLanguage:selectedLang});
    if (step==='preferences') {
      consultFirst(selectedLang);
      void beginProfileConsultation(selectedLang);
    }
  };

  const handleAssessmentComplete = (result: HskResult) => {
    assessmentHistoryConfirmed.current=true;
    assessmentRestore.current?.abort();
    followLatest.current=true;
    setIsTakingAssessment(false);
    setAssessment(result);
    const attemptId=result.attempt.attemptId;
    const inOriginalChat=thread && rememberChatAssessment(owner,attemptId,thread.conversationId);
    const updatedProfile=profile ? {...profile,quizScore:result.score,totalQuestions:result.questionCount,quizMaxScore:result.maxScore,
      ...(profile.levelSource==='trial'?{}:{levelConfirmed:result.levelConfirmed,levelSource:'assessment' as const}),quizResultSummary:result.summary,
      quizBreakdown:result.breakdown,latestAssessment:result,assessmentProvenance:result.saveStatus==='saved'?'server_recomputed_adapted_paper' as const:undefined}:null;
    if (updatedProfile) setProfile(updatedProfile);
    saveStudentContext({leadProfile:updatedProfile,chatAssessmentStatus:'completed',assessment:{completed:true,result,score:result.score,
      total:result.maxScore,maxScore:result.maxScore,questionCount:result.questionCount,levelConfirmed:result.levelConfirmed,
      summary:result.summary,breakdown:result.breakdown,saveStatus:result.saveStatus,completedAt:result.attempt.completedAt}});
    setProfileConsultationError(false);
    if (inOriginalChat) {
      setMessages(prev=>[...prev.filter(m=>!m.isAssessmentResult),assessmentMessage(result)]);
      if(result.saveStatus==='saved')void beginAssessmentConsultation(result);
    }
  };
  const [consultationError,setConsultationError]=useState<HskResult|null>(null);
  const [profileConsultationError,setProfileConsultationError]=useState(false);
  const consultationRunning=useRef(new Set<string>());
  const replyProgress=(botId:string)=>{
    let reply='';
    let frame:number|undefined;
    return {
      update(event:{done?:boolean;reset?:boolean;chunk?:string;reply?:string}){
        if(event.done)return;
        const next=event.chunk ? (event.reset?'':reply)+event.chunk : event.reply||(event.reset?'':reply);
        if(next===reply)return;
        reply=next;
        if(frame!==undefined)return;
        frame=requestAnimationFrame(()=>{
          frame=undefined;
          if(visitorScope()!==owner)return;
          const content=reply;
          setMessages(prev=>prev.map(message=>message.id===botId?{...message,content}:message));
        });
      },
      cancel(){if(frame!==undefined)cancelAnimationFrame(frame);},
    };
  };
  const beginAssessmentConsultation=async(result:HskResult)=>{
    const attemptId=result.attempt.attemptId;
    const botId=chatAssessmentReplyId(attemptId);
    if(!thread || consultationRunning.current.has(attemptId)||messages.some(m=>m.id===botId&&m.content))return;
    consultationRunning.current.add(attemptId);setConsultationError(null);setIsTyping(true);
    setMessages(prev=>[...prev.filter(m=>m.id!==botId),{id:botId,role:'assistant',content:'',timestamp:new Date()}]);
    const owner=visitorScope();
    const progress=replyProgress(botId);
    try{
      const res=await assessmentConsultation(attemptId,lang,thread.conversationId,chatSource);
      const response=await finishChat(res,chatSource,'hsk-intro-'+attemptId,progress.update);
      setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:response.reply,enrollment:response.enrollment,suggestedPrompts:response.suggestedPrompts}:m));
    }catch{setMessages(prev=>prev.filter(m=>m.id!==botId));setConsultationError(result);}
    finally{progress.cancel();announceChatChange(owner);consultationRunning.current.delete(attemptId);setIsTyping(false);}
  };
  const beginProfileConsultation=async(language=lang)=>{
    const botId='reply-profile-intro';
    if(!thread || consultationRunning.current.has(botId)||messages.some(m=>m.id.startsWith(botId)&&m.content))return;
    consultationRunning.current.add(botId);setProfileConsultationError(false);setIsTyping(true);
    setMessages(prev=>[...prev.filter(m=>m.id!==botId),{id:botId,role:'assistant',content:'',timestamp:new Date()}]);
    const owner=visitorScope();
    const progress=replyProgress(botId);
    try{
      const res=await profileConsultation(language,thread.conversationId,chatSource);
      const response=await finishChat(res,chatSource,'profile-intro',progress.update);
      setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:response.reply,enrollment:response.enrollment,suggestedPrompts:response.suggestedPrompts}:m));
    }catch{setMessages(prev=>prev.filter(m=>m.id!==botId));setProfileConsultationError(true);}
    finally{progress.cancel();announceChatChange(owner);consultationRunning.current.delete(botId);setIsTyping(false);}
  };
  const [savingReport,setSavingReport]=useState(false);
  const [reportError,setReportError]=useState<HskResult|null>(null);
  const reportRetryRunning=useRef(false);
  const retryReport=async(result:HskResult)=>{
    if(reportRetryRunning.current)return;
    reportRetryRunning.current=true;
    setSavingReport(true);
    setReportError(null);
    try {
      const saved=await retryHskAttempt(result.attempt,lang,owner);
      clearHskDraft(saved.attempt.attemptId);
      setReport(current=>current===result?saved:current);
      if(previousThread.current===thread?.conversationId)handleAssessmentComplete(saved);
    } catch {
      if(visitorScope()===owner)setReportError(result);
    } finally {
      reportRetryRunning.current=false;
      setSavingReport(false);
    }
  };

  const handleSendMessage = async (textToSend?: string, retry?: ChatMessage, action?: ChatMessage['action']) => {
    const inputValue=readChatInputDraft(owner,thread?.conversationId);
    const messageContent=(retry?.content || textToSend || inputValue).trim();
    if(!messageContent || isTyping || starting || chatFailed || !thread || sending.current || visitorScope()!==owner)return;
    clearChatMessageAnchor();
    followLatest.current=true;
    const controller = new AbortController();
    sending.current = controller;
    const current=()=>!controller.signal.aborted&&visitorScope()===owner;
    const requestAction = retry?.action ?? action;
    if (chatSource === 'homepage_widget') {
      if (textToSend && !requestAction) trackChatbotInteraction('click_shortcut', {prompt_text:textToSend});
      else if (!requestAction) trackChatbotInteraction('send_message', {message_length:messageContent.length});
    }
    // Only a composer submission consumes its draft. A retry belongs to the message in history.
    const typedMessage = !textToSend && !retry;
    setIsTyping(true);
    const userMessage:ChatMessage=retry || {id:createBrowserUuid(),role:'user',content:messageContent,timestamp:new Date(),action:requestAction,
      enrollmentContext:fromEnrollment?.selection};
    const botMessageId='reply-'+userMessage.id;
    setMessages(prev=>{
      const rows=prev.filter(message=>message.id!==botMessageId);
      const questionIndex=rows.findIndex(message=>message.id===userMessage.id);
      const pending:ChatMessage[]=[{...userMessage,delivery:'pending'},
        {id:botMessageId,role:'assistant',content:'',timestamp:new Date()}];
      if(questionIndex<0)return [...rows,...pending];
      rows.splice(questionIndex,1,...pending);
      return rows;
    });
    const progress=replyProgress(botMessageId);
    let acknowledged=false;
    try{
      const request=chatFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({messages:[userMessage],action:requestAction,language:lang,stream:!requestAction,enrollmentContext:userMessage.enrollmentContext})},chatSource,thread.conversationId,true);
      const queued=draft(sharedChatDrafts,userMessage.id);
      const stored=queued?.conversationId===thread.conversationId && queued.content===messageContent;
      if (typedMessage && stored) writeChatInputDraft(owner,thread.conversationId,'',inputValue);
      if (!textToSend && !retry) inputRef.current?.focus({ preventScroll: true });
      const res=await request;
      const result=await finishChat(res,chatSource,userMessage.id,e=>{
        if(!current())return;
        if(!e.done&&!acknowledged&&e.saved===true){
          acknowledged=true;
          setMessages(prev=>prev.map(m=>m.id===userMessage.id?{...m,delivery:'saved'}:m));
        }
        progress.update(e);
      });
      if(!current())return;
      if (typedMessage && !stored) writeChatInputDraft(owner,thread.conversationId,'',inputValue);
      if (result.status === 'contact_required') setShowOnboardingModal(true);
      setMessages(prev=>prev.map(m=>m.id===userMessage.id?{...m,delivery:'saved'}:m.id===botMessageId?{...m,content:result.reply,enrollment:result.enrollment,suggestedPrompts:result.suggestedPrompts,workspaceEntry:result.workspaceEntry}:m));
    }catch(e){
      if(!current())return;
      const delivery=(visitorScope()===owner && draft(sharedChatDrafts,userMessage.id)?.delivery) || 'unknown';
      setMessages(prev=>prev.filter(m=>m.id!==botMessageId).map(m=>m.id===userMessage.id?{...m,delivery}:m));
      if(visitorScope()===owner&&(delivery==='unknown'||delivery==='interrupted'||delivery==='pending'))refreshInBackground();
    }finally{
      progress.cancel();
      announceChatChange(owner);
      if(sending.current===controller)sending.current=undefined;
      if(current())setIsTyping(false);
    }
  };

  const assessments=messages.filter(message=>message.isAssessmentResult);
  const conversationAssessment=assessments[assessments.length-1]?.assessmentData;
  const whatsappDraft=useMemo(()=>hskWhatsAppDraft(profile,conversationAssessment,lang),[profile,conversationAssessment,lang]);
  const [switchingPerson,setSwitchingPerson]=useState(false);
  const [personSwitchUnconfirmed,setPersonSwitchUnconfirmed]=useState(false);
  const checkPersonSwitch=confirm==='switch'&&personSwitchUnconfirmed;
  const freshChatHref = () => {
    const url = new URL(location.href);
    url.hash = '';
    for (const key of promotionParameters) url.searchParams.delete(key);
    url.searchParams.delete('entry_point');
    return url.pathname + url.search;
  };
  const performPersonSwitch=async()=>{

    setSwitchingPerson(true);
    try{
      await startAnotherVisitor(freshChatHref());
    }catch{setPersonSwitchUnconfirmed(true);setSwitchingPerson(false);}
  };
  const t=(zh:string,en:string,id:string)=>chooseText(lang,zh,en,id);
  const replyCheckFailure=t('暂时无法查询回复，请重试。','The reply could not be checked. Try again.','Balasan belum dapat diperiksa. Coba lagi.');
  const emptyChat=!messages.length&&!thread?.messages.length&&!isTyping;
  const conversationId=thread?.conversationId;
  useEffect(()=>{
    if(presentation!=='page'||!active||!conversationId||initialInputFocusHandled.current)return;
    initialInputFocusHandled.current=true;
    if(!emptyChat||threadId||fromEnrollment||isTakingAssessment||showOnboardingModal||report||confirm||
      document.hidden||document.activeElement!==document.body||readChatInputDraft(owner,conversationId)||
      !window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches)return;
    inputRef.current?.focus({preventScroll:true});
  },[presentation,active,conversationId,emptyChat,threadId,fromEnrollment,isTakingAssessment,showOnboardingModal,report,confirm,owner]);

  useEffect(()=>{
    const page=pageRef.current;
    const viewport=window.visualViewport;
    if(presentation!=='page'||!active||!conversationId||!page||!viewport||
      !window.matchMedia('(pointer: coarse)').matches)return;
    let frame=0;
    const syncViewport=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        if(viewport.scale!==1){
          page.style.removeProperty('--chat-visible-height');
          delete page.dataset.chatKeyboard;
          return;
        }
        const visibleHeight=viewport.height+viewport.offsetTop-page.getBoundingClientRect().top;
        page.style.setProperty('--chat-visible-height',Math.round(visibleHeight)+'px');
        const keyboardOpen=document.activeElement===inputRef.current&&
          document.documentElement.clientHeight-viewport.height>120;
        if(keyboardOpen)page.dataset.chatKeyboard='open';
        else delete page.dataset.chatKeyboard;
      });
    };
    syncViewport();
    viewport.addEventListener('resize',syncViewport);
    viewport.addEventListener('scroll',syncViewport);
    page.addEventListener('focusin',syncViewport);
    page.addEventListener('focusout',syncViewport);
    return ()=>{
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize',syncViewport);
      viewport.removeEventListener('scroll',syncViewport);
      page.removeEventListener('focusin',syncViewport);
      page.removeEventListener('focusout',syncViewport);
      page.style.removeProperty('--chat-visible-height');
      delete page.dataset.chatKeyboard;
    };
  },[presentation,active,conversationId]);

  const hasAssessmentDraft=hasHskDraft();
  const retainedReport=conversationAssessment || assessment;
  const hasRetainedReport=Boolean(retainedReport);
  const assessmentAction=useCallback(()=>{
    if(hasRetainedReport&&!hasAssessmentDraft)setConfirm('retake');
    else handleStartVoluntaryAssessment();
  },[hasRetainedReport,hasAssessmentDraft,handleStartVoluntaryAssessment]);
  const busy=isTyping||starting||chatFailed;
  const openLearningProfile=useCallback(()=>setShowOnboardingModal(true),[]);
  const hasProfile=Boolean(profile);
  const messageEntry=useCallback<MessageEntry>((value)=>{
    const entry=chatWorkspaceEntry(value?.action,value?.language);
    if (!entry) return;
    const label=(zh:string,en:string,id:string)=>chooseText(entry.language,zh,en,id);
    if (entry.action==='learning_profile') return {label:hasProfile?
      label('补充学习资料','Add learning preferences','Tambahkan preferensi belajar'):
      label('填写学习资料','Add learning profile','Isi profil belajar'),open:openLearningProfile};
    if (entry.action==='assessment_result'&&retainedReport) return {
      label:label('查看测评结果','View assessment results','Lihat hasil tes'),open:()=>setReport(retainedReport)};
    return {label:hasAssessmentDraft?label('继续测评','Resume assessment','Lanjutkan tes'):
      retainedReport?label('重新测评','Retake assessment','Ulangi tes'):
        label('开始免费测评','Start free assessment','Mulai tes gratis'),open:assessmentAction};
  },[assessmentAction,hasAssessmentDraft,hasProfile,openLearningProfile,retainedReport]);
  const headerActions=[
    {label:profile?t('补充学习资料','Add learning preferences','Tambahkan preferensi belajar'):
      t('填写学习资料','Add learning profile','Isi profil belajar'),onClick:openLearningProfile,disabled:busy},
    ...(retainedReport?[{label:t('查看测评结果','View assessment results','Lihat hasil tes'),onClick:()=>setReport(retainedReport)}]:[]),
    {label:hasAssessmentDraft?t('继续测评','Resume assessment','Lanjutkan tes'):retainedReport?t('重新测评','Retake assessment','Ulangi tes'):t('免费 HSK 摸底测评','Free HSK placement assessment','Tes penempatan HSK gratis'),
      onClick:assessmentAction,disabled:busy},
    {label:t('联系真人顾问（WhatsApp）','Contact an advisor on WhatsApp','Hubungi konsultan lewat WhatsApp'),href:whatsappDraft.url},
    ...(embedded ? [{label:t('申请顾问跟进','Request advisor follow-up','Minta tindak lanjut konsultan'),
      onClick:()=>void handleSendMessage(t('请安排顾问联系我','Please arrange advisor follow-up','Mohon tindak lanjut konsultan'),undefined,'handoff'),disabled:busy}] : []),
    {label:t('开始新对话','Start a new conversation','Mulai percakapan baru'),onClick:()=>{
      if(!thread)return;
      setRestartFrom(thread.conversationId);
      setConfirm('restart');
    },disabled:busy},
    {label:t('切换使用者','Switch user','Ganti pengguna'),onClick:()=>setConfirm('switch'),disabled:isTyping||starting},
  ];
  const cancelLabel=t('取消','Cancel','Batal');
  const closeLabel=t('关闭','Close','Tutup');
  const confirmationTitle=confirm==='restart'?t('开始新对话','Start a new conversation','Mulai percakapan baru'):
    confirm==='switch'?t('切换使用者','Switch user','Ganti pengguna'):t('重新测评','Retake assessment','Ulangi tes');
  const restartReadBack=confirm==='restart'&&!!restartFrom&&!!thread&&thread.conversationId!==restartFrom;
  const restartLabel=restartReadBack?t('继续咨询','Continue chatting','Lanjutkan konsultasi'):
    chatFailed?t('重试','Retry','Coba lagi'):confirmationTitle;
  async function handleConfirm(){
    if(checkPersonSwitch){window.location.reload();return;}
    if(confirm==='switch'){await performPersonSwitch();return;}
    if(confirm==='retake'){
      setConfirm(null);
      handleStartVoluntaryAssessment();
      return;
    }
    if(confirm==='restart'&&restartFrom&&await startNew(restartFrom))setConfirm(null);
  }
  const backToEnrollment = fromEnrollment && {
    label:fromEnrollment.selection.kind==='class'?t('返回该班','Back to this class','Kembali ke kelas ini'):
      t('返回选班','Back to class selection','Kembali memilih kelas'),
    href:fromEnrollment.url,
    onReturn:()=>{
      preloadEnrollmentNavigation(new URL(fromEnrollment.url,location.origin));
      returnAlongJourney(navigate,fromEnrollment,{enrollmentPosition:fromEnrollment.position});
    },
  };
  const browsing = fromEnrollment?.selection.kind==='catalog'?fromEnrollment.selection:undefined;
  const filterSummary = browsing && [
    browsing.level?'HSK '+browsing.level:undefined,
    browsing.period==='weekend'?t('周末','Weekends','Akhir pekan'):
      browsing.period==='weekday-evening'?t('工作日晚间','Weekday evenings','Malam hari kerja'):
      browsing.period==='mixed'?t('工作日与周末','Weekdays & weekends','Hari kerja & akhir pekan'):undefined,
    browsing.format==='standard'?t('标准班','Standard class','Kelas standar'):
      browsing.format==='small'?t('小班','Small group','Kelas kecil'):
      browsing.format==='one-on-one'?t('一对一','One-to-one','Kelas privat'):undefined,
  ].filter(Boolean).join(' · ');
  const showMetadata = presentation === 'page' || presentation === 'expanded';
  const entryParams = new URLSearchParams(search);
  // Changing Chat's language updates the browser URL without replacing the React Router entry.
  const linkHubPath = !embedded ? linkHubReturnUrl(new URLSearchParams(window.location.search),lang) : undefined;
  const recommendationPage = fromEnrollment?.url ?? (linkHubPath && promotionIdentity(entryParams).tagged ? pathname+search : undefined);
  const header = <StandaloneChatHeader lang={lang} onLanguageChange={changeLanguage} actions={thread ? headerActions : []}
    presentation={presentation} enrollmentReturn={backToEnrollment} linkHubReturn={linkHubPath} onDismiss={onDismiss} onExpand={onExpand && thread ? ()=>onExpand(thread,lang) : undefined}
    bookmarkParams={showMetadata?(promotionIdentity(entryParams).tagged?entryParams:chatPromotionParams(thread,search)):undefined}
    name={profile?.fullName} assessment={isTakingAssessment && !!thread} inactive={showOnboardingModal}/>;
  if (!thread) return <div className="standalone-chat-page font-sans" data-chat-presentation={presentation}>
    {showMetadata&&<PageMetadata lang={lang}/>}
    {header}
    <div className="chat-workspace-loading">
      {!chatFailed ?
        <p role="status">{t('正在接续咨询…','Restoring your consultation…','Melanjutkan konsultasi…')}</p> :
        <>
          <p role="alert">{t('无法打开原咨询，请重试。','This consultation could not be opened. Please retry.','Konsultasi ini tidak bisa dibuka. Coba lagi.')}</p>
          <button className="underline" onClick={refreshChat}>{t('重试','Retry','Coba lagi')}</button>
          {threadId&&<a className="ml-4 underline" href={freshChatHref()}>{t('打开当前咨询','Open current consultation','Buka konsultasi saat ini')}</a>}
        </>}
    </div>
  </div>;
  const ConversationRegion = embedded ? 'div' : 'main';
  return (
    <div ref={pageRef} className="standalone-chat-page font-sans" data-chat-presentation={presentation} data-chat-conversation={thread.conversationId}>
      {showMetadata&&<PageMetadata lang={lang}/>}
      {showOnboardingModal&&<Suspense fallback={<LearningProfileLoadNotice lang={lang} onClose={()=>consultFirst(lang)}/>}>
        <GFormOnboardingModal isOpen onComplete={handleOnboardingComplete} initialLang={lang} profile={profile} onConsultFirst={consultFirst}/>
      </Suspense>}

      {header}
      {fromEnrollment&&!isTakingAssessment&&<div className="chat-enrollment-context" data-enrollment-chat-context>
        <strong>{fromEnrollment.selection.kind==='class'?t('咨询这个班','Asking about this class','Tanya tentang kelas ini'):
          t('当前选班条件','Current class filters','Filter kelas saat ini')}</strong>
        <span>{fromEnrollment.title||filterSummary||t('全部班次','All classes','Semua kelas')}</span>
      </div>}

      {confirm&&<StandaloneChatDialog title={confirmationTitle} closeLabel={closeLabel} variant={confirm==='retake'?'retake':undefined}
        locked={switchingPerson||starting} onClose={()=>setConfirm(null)}>
        <p>{restartReadBack?t('新对话已打开。','The new conversation is ready.','Percakapan baru sudah siap.') : confirm==='restart'
          ? t('为当前使用者开始一段新对话。原有对话会保留。','Start a new conversation for this user. Earlier conversations will be kept.','Mulai percakapan baru untuk pengguna ini. Percakapan sebelumnya tetap disimpan.')
          : confirm==='switch'
            ? t('另一位使用者将开启独立咨询。原对话和测评记录会保留。查看原使用者的报名需要重新验证邮箱。','Another person will open a separate consultation. Earlier chats and assessments will be kept. Verify the email again to access the previous user’s enrollments.','Pengguna lain akan membuka konsultasi terpisah. Percakapan dan hasil tes sebelumnya tetap disimpan. Verifikasi kembali email untuk melihat pendaftaran pengguna sebelumnya.')
            : t('开始新一轮测评，之前的结果和对话都会保留。','Your earlier results and conversation will be kept.','Hasil sebelumnya dan percakapan Anda tetap tersimpan.')}</p>
        {checkPersonSwitch&&<p role="alert" className="chat-assessment-review">{t('切换未确认成功，请刷新后核对当前使用者。','Switch not confirmed. Reload and check the current user.','Pergantian belum dikonfirmasi. Muat ulang dan periksa pengguna saat ini.')}</p>}
        {confirm==='restart'&&!restartReadBack&&chatFailed&&<p role="alert" className="chat-assessment-review">{t('新对话暂未确认，请重试。','New conversation not confirmed. Please retry.','Percakapan baru belum dikonfirmasi. Coba lagi.')}</p>}
        {confirm==='retake'&&<div className="chat-retake-person">
          <span>{t('为其他人测评？','Taking the test for someone else?','Tes ini untuk orang lain?')}</span>
          <button type="button" onClick={()=>setConfirm('switch')}>{t('切换使用者','Switch user','Ganti pengguna')}</button>
        </div>}
        <div className="chat-dialog-actions">
          <button type="button" disabled={switchingPerson||starting} onClick={()=>setConfirm(null)}>{cancelLabel}</button>
          <button type="button" className="chat-primary disabled:opacity-50" disabled={switchingPerson||starting} onClick={()=>void handleConfirm()}>
            {switchingPerson||starting?t('处理中…','Working…','Memproses…'):
              checkPersonSwitch?t('刷新核对','Reload to check','Muat ulang untuk memeriksa'):
              confirm==='switch'?t('继续切换','Continue','Lanjutkan'):
              confirm==='retake'?t('开始测评','Start assessment','Mulai tes'):restartLabel}
          </button>
        </div>
      </StandaloneChatDialog>}
      {report&&<StandaloneChatDialog title={t('测评详情','Assessment details','Detail hasil tes')} closeLabel={closeLabel} onClose={()=>setReport(null)} variant="assessment-report">
        {reportError===report&&<p role="alert" className="hsk-report-notice">
          {t('仍无法同步测评。结果已保留，可以再次重试。','Results still could not sync. Your result is kept. You can try again.','Hasil masih belum tersinkron. Hasil Anda tersimpan di perangkat dan bisa dicoba lagi.')}
        </p>}
        <Suspense fallback={<p role="status" className="hsk-report-notice">
          {t('正在加载测评详情…','Loading assessment details…','Memuat detail hasil tes…')}
        </p>}>
          <HskAssessmentReport result={report} lang={lang} saving={savingReport} onRetry={()=>void retryReport(report)}/>
        </Suspense>
        <div className="chat-dialog-actions"><button className="chat-enrollment-next" type="button" disabled={savingReport} onClick={()=>{setReport(null);setConfirm('retake');}}>
          {t('重新测评','Retake assessment','Ulangi tes')}
        </button></div>
      </StandaloneChatDialog>}

      <ConversationRegion ref={node=>{mainRef.current=node;}} inert={showOnboardingModal} className="standalone-chat-main"
        onScroll={event=>{
          if(isTakingAssessment)return;
          const region=event.currentTarget;
          followLatest.current=region.scrollHeight-region.scrollTop-region.clientHeight<=72;
        }}>
        {!isTakingAssessment && emptyChat && <div className="chat-welcome-layout">
          <ChatWelcome lang={lang} hasDraft={hasAssessmentDraft} hasResult={Boolean(retainedReport)}
            hasProfile={Boolean(profile)} onLearningProfile={!busy?openLearningProfile:undefined}
            onAssessment={()=>retainedReport&&!hasAssessmentDraft?setReport(retainedReport):assessmentAction()}
            onPrompt={prompt=>{
              writeChatInputDraft(owner,thread.conversationId,prompt,'');
              inputRef.current?.focus({preventScroll:true});
            }}/>
          <ChatWelcomeSocials lang={lang}/>
        </div>}
        {!isTakingAssessment && !emptyChat && <div className="standalone-chat-flow">
        {messages.map((msg) => {
          const canRetry=msg.role==='user'&&!!msg.delivery&&msg.delivery!=='saved'&&msg.delivery!=='pending';
          return (
          <div key={msg.id} data-chat-message-id={msg.id} tabIndex={-1}>
            <WorkspaceMessage message={msg} lang={lang} source={thread.source} page={recommendationPage??thread.page}
              entry={chatSource} owner={owner} conversationId={thread.conversationId} widget={presentation==='panel'||presentation==='mobile'}
              compact={compact} active={active} busy={msg.workspaceEntry?busy:canRetry&&(isTyping||checkingReply)}
              retry={canRetry?()=>void handleSendMessage(undefined,msg):undefined}
              checkReply={msg.delivery==='unknown'&&!replyPending?refreshChat:undefined}
              checkingReply={msg.delivery==='unknown'&&checkingReply}
              onReport={setReport} messageEntry={msg.workspaceEntry?messageEntry:undefined}/>

            {!isTyping && !starting && msg === lastMessage && msg.role === 'assistant' &&
              <ChatFollowups prompts={msg.suggestedPrompts} onSelect={prompt=>void handleSendMessage(prompt)}/>}

          </div>
        );})}

          {consultationError&&<p role="alert" className="text-sm">{t('咨询暂不可用，测评结果已保存。','Consultation is temporarily unavailable; your results are saved.','Konsultasi belum tersedia; hasil tes tersimpan.')} <button className="underline min-h-11" onClick={()=>void beginAssessmentConsultation(consultationError)}>{t('重试咨询','Retry consultation','Coba konsultasi lagi')}</button></p>}
          {profileConsultationError&&<p role="alert" className="text-sm">{t('咨询暂不可用，请重试。','Consultation is temporarily unavailable. Please retry.','Konsultasi belum tersedia. Silakan coba lagi.')} <button className="underline min-h-11" onClick={()=>void beginProfileConsultation()}>{t('重试咨询','Retry consultation','Coba konsultasi lagi')}</button></p>}
          {isTyping&&<ChatTyping language={lang}/>}
          {!isTyping&&!replyPending&&!chatFailed&&readbackFailed&&messages.some(message=>message.delivery==='unknown')&&
            <p role="status" className="text-sm text-slate-600">{replyCheckFailure}</p>}
          {!isTyping&&replyPending&&!chatFailed&&<p role="status" className="text-sm text-slate-600">
            {readbackFailed ? replyCheckFailure
              : replyStalled ? t('上一条回复尚未完成。','The previous reply has not finished.','Balasan sebelumnya belum selesai.')
              : t('正在等候上一条回复。','Waiting for the previous reply.','Menunggu balasan sebelumnya.')} {' '}
            <button type="button" className="underline" disabled={starting||checkingReply} onClick={refreshChat}>
              {checkingReply?t('正在查询…','Checking…','Memeriksa…'):t('查询回复','Check for reply','Periksa balasan')}
            </button>
            {stalledQuestion&&<>{' '}<button type="button" className="underline" disabled={starting||checkingReply}
              onClick={()=>void handleSendMessage(undefined,stalledQuestion)}>
              {t('重试原问题','Retry original question','Coba ulang pertanyaan awal')}
            </button></>}
          </p>}
        </div>}

        {isTakingAssessment&&<div className="standalone-chat-assessment">
          <Suspense fallback={<div className="flex items-center gap-3 p-4 text-sm">
            <p role="status">{t('正在加载测评…','Loading assessment…','Memuat tes…')}</p>
            <button type="button" className="underline" onClick={leaveAssessment}>{cancelLabel}</button>
          </div>}>
            <HSKPlacementAssessment studentName={profile?.fullName || 'Student'} onComplete={handleAssessmentComplete}
              onCancel={handleAssessmentCancel} onLoadCancel={leaveAssessment} active={active}
              onAttemptStart={attemptId=>rememberChatAssessment(owner,attemptId,thread.conversationId)}
              lang={lang} initialMode="express"/>
          </Suspense>
        </div>}
      </ConversationRegion>

      {!isTakingAssessment && <footer inert={showOnboardingModal}>
        <ChatComposer language={lang} conversationId={thread.conversationId} onSend={()=>void handleSendMessage()} busy={busy} inputRef={inputRef} compact={compact}
          placeholder={emptyChat
            ?presentation==='page'
              ?t('问课程、学费或测评','Ask about courses, fees or tests','Tanya kelas, biaya, atau tes')
              :t('直接提问，例如：零基础学中文要多久？','Ask a question, such as where to start as a beginner','Tanya langsung, misalnya cara mulai sebagai pemula')
            :t('继续提问…','Ask a follow-up…','Tanya lagi…')}>
          {chatFailed && <p role="alert" className="text-sm">{chooseText(lang,'对话同步失败。','Conversation could not sync.','Percakapan gagal disinkronkan.')} <button type="button" className="underline" onClick={refreshChat}>{chooseText(lang,'重试','Retry','Coba lagi')}</button></p>}
        </ChatComposer>
      </footer>}
    </div>
  );
}
