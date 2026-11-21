import {chatWorkspaceEntry,type ChatWorkspaceEntry} from '../utils/chatWorkspaceAction';
import {ChatComposer,ChatFollowups,ChatMessage as ChatBubble,ChatTyping} from './ChatConversation';
import type {EnrollmentGuideAction} from '../utils/enrollmentGuidance';
import {lookupPromotion} from '../utils/promotionLookup';
import {linkHubReturnUrl,promotionIdentity,promotionParameters} from '../utils/promotionNavigation';
import {trackEvent} from '../utils/analytics';
import {chatLanguage} from '../utils/chatLanguage';
import {visitorScope} from '../services/visitorScope';
import {PageMetadata} from './PageMetadata';
import { safeHskResult } from "../data/hskReportHistory";
import {draft,type Delivery} from "../services/chatDelivery";
import {chatFetch, chatPromotionParams, registerContact, finishChat, startAnotherVisitor, sharedChatDrafts} from '../services/portalChat';
import {announceChatChange,useSharedChat} from '../hooks/useSharedChat';
import {useChatInputDraft} from '../hooks/useChatInputDraft';
import {trackChatbotInteraction} from '../utils/analytics';
import type {ChatSource} from '../services/portalChat';
import type {ChatPresentation} from './StandaloneChatChrome';
import {readChatMessageAnchor,readEnrollmentConsultation,returnAlongJourney} from '../utils/chatJourneyNavigation';
import type {EnrollmentChatSelection} from '../utils/enrollmentChatJourney';
import {useState,useEffect,useRef} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {motion} from 'motion/react';
import {ChatAssessmentSummary,ChatWelcome,StandaloneChatDialog,StandaloneChatHeader} from './StandaloneChatChrome';
import '../pages/standalone-chat.css';
import GFormOnboardingModal from './GFormOnboardingModal';
import HskAssessmentReport from './HskAssessmentReport';
import {type HskResult, chooseText} from '../data/hskAssessment';
import {saveHskAttempt, restoreHskAttempts, assessmentConsultation, profileConsultation} from '../services/portalChat';
import {writeHskResult,readHskHistory,readHskDraft} from '../services/hskAttemptStorage';
import HSKPlacementAssessment from './HSKPlacementAssessment';
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
  const [isTakingAssessment, setIsTakingAssessment] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [lang, setLang] = useState<'en' | 'id' | 'zh'>(()=>chatLanguage(initialContext?.preferredLanguage ?? initialLanguage,window.location.search));

  const {thread, failed:chatFailed, starting, startNew, refresh:refreshChat} = useSharedChat(chatSource, isTyping || !active, threadId);
  const {value:inputValue, setValue:setInputValue} = useChatInputDraft(thread?.conversationId);
  const [assessment, setAssessment] = useState<HskResult|null|undefined>();
  const [owner] = useState(visitorScope);
  const previousThread = useRef<string | undefined>(undefined);
  const sending = useRef(false);

  useEffect(() => {
    let active = true;
    const owner = visitorScope();
    const language = initialContext?.preferredLanguage || lang;
    void restoreHskAttempts().catch(() => readHskHistory(language)).then(attempts => {
      if (!active || visitorScope() !== owner) return;
      const returnTo=chatAssessmentReturn(owner);
      const bound=returnTo && attempts.find(item=>item.attempt.attemptId===returnTo.attemptId);
      const latest = bound ?? attempts[0] ?? safeHskResult(initialContext?.assessment?.result, language);
      if (latest) writeHskResult(latest);
      setAssessment(latest ?? null);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!thread || assessment === undefined || isTyping) return;
    const firstLoad = previousThread.current === undefined;
    const changed = !firstLoad && previousThread.current !== thread.conversationId;
    previousThread.current = thread.conversationId;
    const rows = thread.messages;
    if (changed) {
      setShowOnboardingModal(false);
      setReport(null);
      setIsTakingAssessment(false);
    }
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
    const visibleRows = rows.filter(row => !(
      (row.id.startsWith('reply-hsk-intro-') || row.id.startsWith('reply-profile-intro-'))
      && ['failed','interrupted'].includes(row.status)
    ));
    const initialStandalone = firstLoad && !embedded && !fromEnrollment && !thread.restarted && thread.source === chatSource && !rows.length;
    const introIndex = replyId ? visibleRows.findIndex(row => row.id === replyId) : -1;
    const summary = assessment && (bound || introIndex >= 0 || failedIntro || initialStandalone&&!returnTo)
      ? [assessmentMessage(assessment)]
      : [];
    setMessages(introIndex<0?[...visibleRows,...summary]:[...visibleRows.slice(0,introIndex),...summary,...visibleRows.slice(introIndex)]);
    if (changed || failedIntro || introIndex >= 0) setConsultationError(failedIntro ? assessment : null);
    if (changed || failedProfile || visibleRows.some(row => row.id.startsWith('reply-profile-intro-') && row.status === 'completed'))
      setProfileConsultationError(failedProfile);
    if (firstLoad && assessment?.saveStatus==='saved' && !savedReply &&
      (bound || initialStandalone&&!returnTo&&!readHskDraft())) {
      void beginAssessmentConsultation(assessment);
    } else if (initialStandalone && !assessment && !readHskDraft() && initialContext?.leadProfile?.goal &&
      getChatAssessmentStatus(initialContext)!=='completed') {
      void beginProfileConsultation();
    }
  }, [thread, assessment]);

  // A saved promotion entry also selects the interface language for returning visitors.
  // Existing customer records, messages and assessment state are not rewritten.
  useEffect(() => {
    if (embedded && !new URLSearchParams(window.location.search).has('p')) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('lang')) return;
    let active = true;
    void Promise.resolve(lookupPromotion(params)).then(result => {
      if (active && !new URLSearchParams(window.location.search).has('lang') && result?.state === 'verified') setLang(result.promotion.language);
    });
    return () => { active = false; };
  }, []);

  const changeLanguage = (language: 'en' | 'id' | 'zh') => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', language);
    if (presentation === 'page' || presentation === 'expanded') window.history.replaceState(window.history.state, '', url);
    setLang(language);
    saveStudentContext({ preferredLanguage: language });
  };

  const consultFirst=(language:'en'|'id'|'zh')=>{
    setShowOnboardingModal(false);
    if(language!==lang)changeLanguage(language);
    requestAnimationFrame(()=>inputRef.current?.focus());
  };

  const handleAssessmentCancel = () => {
    trackEvent('assessment_exit',{reason:readHskDraft()?'paused':'skipped'});
    setIsTakingAssessment(false);
    saveStudentContext({ chatAssessmentStatus: readHskDraft()?'paused':'skipped' });
    if (profile?.goal && !thread?.messages.length) void beginProfileConsultation();
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active && !isTakingAssessment) {
      const anchorKey = returnAnchor && routeKey+':'+returnAnchor.messageId;
      if (anchorKey && restoredAnchor.current!==anchorKey && returnAnchor.owner===visitorScope() &&
        returnAnchor.conversationId===thread?.conversationId) {
        const target=mainRef.current?.querySelector<HTMLElement>('[data-chat-message-id="'+CSS.escape(returnAnchor.messageId)+'"]');
        if (target) {
          restoredAnchor.current=anchorKey;
          target.focus({preventScroll:true});
          target.scrollIntoView({behavior:'instant',block:'start'});
          return;
        }
      }
      const last=messages.at(-1);
      if(last?.isAssessmentResult || last?.id.startsWith('reply-hsk-intro-'))mainRef.current?.querySelector('[data-hsk-result-anchor]')?.scrollIntoView({behavior:'auto',block:'start'});
      else scrollToBottom();
    }
  }, [messages, isTyping, isTakingAssessment, active, thread?.conversationId, routeKey]);
  useEffect(() => {
    if (isTakingAssessment) mainRef.current?.scrollTo({ top: 0 });
  }, [isTakingAssessment]);

  // Keep state synchronized with storage events
  useEffect(() => {
    const unsubscribe = subscribeStudentContext((ctx) => {
      setProfile(ctx?.leadProfile || null);
      if(ctx?.preferredLanguage)setLang(ctx.preferredLanguage);
      if (ctx?.assessment?.result) {
        const owned=safeHskResult(ctx.assessment.result,ctx.preferredLanguage??'en');
        if (owned) setAssessment(owned);
      }
    });
    return unsubscribe;
  }, []);

  const handleStartVoluntaryAssessment = () => {
    setIsTakingAssessment(true);
    saveStudentContext({chatAssessmentStatus:'pending',preferredLanguage:lang});
  };

  const handleOnboardingComplete = async (answers: object, selectedLang: 'en'|'id'|'zh',
    options:{queryOnly?:boolean;retryOriginal?:boolean},step:ChatRegistrationStep) => {
    const contacts=step==='preferences'&&profile?{fullName:profile.fullName,whatsapp:profile.whatsapp,email:profile.email}:{};
    const origin=fromEnrollment&&thread?{source:thread.source,page:fromEnrollment.url}:thread;
    const registration=await registerContact({...answers,...contacts,language:selectedLang},{...options,chatOrigin:origin,contactConversion:step==='contact'});
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
  const beginAssessmentConsultation=async(result:HskResult)=>{
    const attemptId=result.attempt.attemptId;
    const botId=chatAssessmentReplyId(attemptId);
    if(!thread || consultationRunning.current.has(attemptId)||messages.some(m=>m.id===botId&&m.content))return;
    consultationRunning.current.add(attemptId);setConsultationError(null);setIsTyping(true);
    setMessages(prev=>[...prev.filter(m=>m.id!==botId),{id:botId,role:'assistant',content:'',timestamp:new Date()}]);
    const owner=visitorScope();
    let reply='';
    try{
      const res=await assessmentConsultation(attemptId,lang,thread.conversationId,chatSource);
      const response=await finishChat(res,chatSource,'hsk-intro-'+attemptId,e=>{if(e.reset)reply='';if(e.chunk)reply+=e.chunk;setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:reply}:m));});
      setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:response.reply,enrollment:response.enrollment,suggestedPrompts:response.suggestedPrompts}:m));
    }catch{setMessages(prev=>prev.filter(m=>m.id!==botId));setConsultationError(result);}
    finally{announceChatChange(owner);consultationRunning.current.delete(attemptId);setIsTyping(false);}
  };
  const beginProfileConsultation=async(language=lang)=>{
    const botId='reply-profile-intro';
    if(!thread || consultationRunning.current.has(botId)||messages.some(m=>m.id.startsWith(botId)&&m.content))return;
    consultationRunning.current.add(botId);setProfileConsultationError(false);setIsTyping(true);
    setMessages(prev=>[...prev.filter(m=>m.id!==botId),{id:botId,role:'assistant',content:'',timestamp:new Date()}]);
    const owner=visitorScope();
    let reply='';
    try{
      const res=await profileConsultation(language,thread.conversationId,chatSource);
      const response=await finishChat(res,chatSource,'profile-intro',e=>{if(e.reset)reply='';if(e.chunk)reply+=e.chunk;setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:reply}:m));});
      setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:response.reply,enrollment:response.enrollment,suggestedPrompts:response.suggestedPrompts}:m));
    }catch{setMessages(prev=>prev.filter(m=>m.id!==botId));setProfileConsultationError(true);}
    finally{announceChatChange(owner);consultationRunning.current.delete(botId);setIsTyping(false);}
  };
  const [savingReport,setSavingReport]=useState(false);
  const retryReport=async(result:HskResult)=>{
    if(savingReport)return;setSavingReport(true);
    try {const saved=await saveHskAttempt(result.attempt,lang);writeHskResult(saved);setReport(current=>current?saved:null);handleAssessmentComplete(saved);} catch {} finally {setSavingReport(false);}
  };

  const handleSendMessage = async (textToSend?: string, retry?: ChatMessage, action?: ChatMessage['action']) => {
    const messageContent=(retry?.content || textToSend || inputValue).trim();
    if(!messageContent || isTyping || starting || chatFailed || !thread || sending.current)return;
    sending.current = true;
    const requestAction = retry?.action ?? action;
    if (chatSource === 'homepage_widget') {
      if (textToSend && !requestAction) trackChatbotInteraction('click_shortcut', {prompt_text:textToSend});
      else if (!requestAction) trackChatbotInteraction('send_message', {message_length:messageContent.length});
    }
    if (!textToSend && !retry) {
      setInputValue('');
      inputRef.current?.focus({ preventScroll: true });
    }
    setIsTyping(true);
    const userMessage:ChatMessage=retry || {id:crypto.randomUUID(),role:'user',content:messageContent,timestamp:new Date(),action:requestAction,
      enrollmentContext:fromEnrollment?.selection};
    const botMessageId='reply-'+userMessage.id;
    setMessages(prev=>[...prev.filter(m=>m.id!==botMessageId && m.id!==userMessage.id),{...userMessage,delivery:'pending'},{id:botMessageId,role:'assistant',content:'',timestamp:new Date()}]);
    const owner=visitorScope();
    let reply='';
    try{
      const res=await chatFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[userMessage],action:requestAction,language:lang,stream:!requestAction,enrollmentContext:userMessage.enrollmentContext})},chatSource,thread.conversationId,true);
      const result=await finishChat(res,chatSource,userMessage.id,e=>{
        if(e.reset)reply='';if(e.chunk)reply+=e.chunk;if(e.reply && !e.chunk)reply=e.reply;
        setMessages(prev=>prev.map(m=>m.id===userMessage.id&&e.saved?{...m,delivery:'saved'}:m.id===botMessageId?{...m,content:reply}:m));
      });
      if (result.status === 'contact_required') setShowOnboardingModal(true);
      setMessages(prev=>prev.map(m=>m.id===userMessage.id?{...m,delivery:'saved'}:m.id===botMessageId?{...m,content:result.reply,enrollment:result.enrollment,suggestedPrompts:result.suggestedPrompts,workspaceEntry:result.workspaceEntry}:m));
    }catch(e){
      const delivery=draft(sharedChatDrafts,userMessage.id)?.delivery || 'unknown';
      setMessages(prev=>prev.filter(m=>m.id!==botMessageId).map(m=>m.id===userMessage.id?{...m,delivery}:m));
    }finally{announceChatChange(owner);sending.current=false;setIsTyping(false);}
  };

  const whatsappDraft=hskWhatsAppDraft(profile,messages.filter(m=>m.isAssessmentResult).at(-1)?.assessmentData,lang);
  const [switchingPerson,setSwitchingPerson]=useState(false);
  const [personError,setPersonError]=useState(false);
  const freshChatHref = () => {
    const url = new URL(location.href);
    url.hash = '';
    for (const key of promotionParameters) url.searchParams.delete(key);
    url.searchParams.delete('entry_point');
    return url.pathname + url.search;
  };
  const performPersonSwitch=async()=>{

    setSwitchingPerson(true);setPersonError(false);
    try{
      await startAnotherVisitor(freshChatHref());
    }catch{setPersonError(true);setSwitchingPerson(false);}
  };
  const t=(zh:string,en:string,id:string)=>chooseText(lang,zh,en,id);
  const emptyChat=!messages.length&&!thread?.messages.length&&!isTyping;
  const hasAssessmentDraft=Boolean(readHskDraft());
  const retainedReport=messages.filter(message=>message.isAssessmentResult).at(-1)?.assessmentData || assessment;
  const assessmentAction=()=>{
    if(retainedReport&&!hasAssessmentDraft)setConfirm('retake');
    else handleStartVoluntaryAssessment();
  };
  const busy=isTyping||starting||chatFailed;
  const openLearningProfile=()=>setShowOnboardingModal(true);
  function messageEntry(value:ChatWorkspaceEntry|undefined) {
    const entry=chatWorkspaceEntry(value?.action,value?.language);
    if (!entry) return;
    const label=(zh:string,en:string,id:string)=>chooseText(entry.language,zh,en,id);
    if (entry.action==='learning_profile') return {label:profile?
      label('补充学习资料','Add learning preferences','Tambahkan preferensi belajar'):
      label('填写学习资料','Add learning profile','Isi profil belajar'),open:openLearningProfile};
    if (entry.action==='assessment_result'&&retainedReport) return {
      label:label('查看测评结果','View assessment results','Lihat hasil tes'),open:()=>setReport(retainedReport)};
    return {label:hasAssessmentDraft?label('继续测评','Resume assessment','Lanjutkan tes'):
      retainedReport?label('重新测评','Retake assessment','Ulangi tes'):
        label('开始免费测评','Start free assessment','Mulai tes gratis'),open:assessmentAction};
  }
  const headerActions=[
    {label:profile?t('补充学习资料','Add learning preferences','Tambahkan preferensi belajar'):
      t('填写学习资料','Add learning profile','Isi profil belajar'),onClick:openLearningProfile,disabled:busy},
    ...(retainedReport?[{label:t('查看测评结果','View assessment results','Lihat hasil tes'),onClick:()=>setReport(retainedReport)}]:[]),
    {label:hasAssessmentDraft?t('继续测评','Resume assessment','Lanjutkan tes'):retainedReport?t('重新测评','Retake assessment','Ulangi tes'):t('免费 HSK 摸底测评','Free HSK placement assessment','Tes penempatan HSK gratis'),
      onClick:assessmentAction,disabled:busy},
    {label:t('联系真人顾问（WhatsApp）','Contact an advisor on WhatsApp','Hubungi konsultan lewat WhatsApp'),href:whatsappDraft.url},
    ...(embedded ? [{label:t('申请顾问跟进','Request advisor follow-up','Minta tindak lanjut konsultan'),
      onClick:()=>void handleSendMessage(t('请安排顾问联系我','Please arrange advisor follow-up','Mohon tindak lanjut konsultan'),undefined,'handoff'),disabled:busy}] : []),
    {label:t('开始新对话','Start a new conversation','Mulai percakapan baru'),onClick:()=>setConfirm('restart'),disabled:busy},
    {label:t('切换使用者','Switch user','Ganti pengguna'),onClick:()=>setConfirm('switch'),disabled:isTyping||starting},
  ];
  const cancelLabel=t('取消','Cancel','Batal');
  const closeLabel=t('关闭','Close','Tutup');
  const confirmationTitle=confirm==='restart'?t('开始新对话','Start a new conversation','Mulai percakapan baru'):
    confirm==='switch'?t('切换使用者','Switch user','Ganti pengguna'):t('重新测评','Retake assessment','Ulangi tes');
  async function handleConfirm(){
    if(confirm==='switch'){await performPersonSwitch();return;}
    if(confirm==='retake'){
      setConfirm(null);
      handleStartVoluntaryAssessment();
      return;
    }
    if(confirm==='restart'&&await startNew())setConfirm(null);
  }
  const backToEnrollment = fromEnrollment && {
    label:fromEnrollment.selection.kind==='class'?t('返回该班','Back to this class','Kembali ke kelas ini'):
      t('返回选班','Back to class selection','Kembali memilih kelas'),
    href:fromEnrollment.url,
    onReturn:()=>returnAlongJourney(navigate,fromEnrollment,{enrollmentPosition:fromEnrollment.position}),
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
  const linkHubPath = !embedded ? linkHubReturnUrl(entryParams,lang) : undefined;
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
    <div className="standalone-chat-page font-sans" data-chat-presentation={presentation} data-chat-conversation={thread.conversationId}>
      {showMetadata&&<PageMetadata lang={lang}/>}
      <GFormOnboardingModal
        isOpen={showOnboardingModal}
        onComplete={handleOnboardingComplete}
        initialLang={lang}
        profile={profile}
        onConsultFirst={consultFirst}
      />

      {header}
      {fromEnrollment&&!isTakingAssessment&&<div className="chat-enrollment-context" data-enrollment-chat-context>
        <strong>{fromEnrollment.selection.kind==='class'?t('咨询这个班','Asking about this class','Tanya tentang kelas ini'):
          t('当前选班条件','Current class filters','Filter kelas saat ini')}</strong>
        <span>{fromEnrollment.title||filterSummary||t('全部班次','All classes','Semua kelas')}</span>
      </div>}

      {confirm&&<StandaloneChatDialog title={confirmationTitle} closeLabel={closeLabel} variant={confirm==='retake'?'retake':undefined}
        locked={switchingPerson||starting} onClose={()=>{setConfirm(null);setPersonError(false);}}>
        <p>{confirm==='restart'
          ? t('为当前使用者开始一段新对话。原有对话会保留。','Start a new conversation for this user. Earlier conversations will be kept.','Mulai percakapan baru untuk pengguna ini. Percakapan sebelumnya tetap disimpan.')
          : confirm==='switch'
            ? t('另一位使用者将开启独立咨询。当前使用者的对话和测评记录会保留。','Another person will open a separate consultation. This user’s chat and assessment will be kept.','Pengguna lain akan membuka konsultasi terpisah. Percakapan dan hasil tes pengguna ini tetap disimpan.')
            : t('开始新一轮测评，之前的结果和对话都会保留。','Your earlier results and conversation will be kept.','Hasil sebelumnya dan percakapan Anda tetap tersimpan.')}</p>
        {personError&&<p role="alert" className="chat-assessment-review">{t('切换未确认成功，请刷新后核对当前使用者。','Switch not confirmed. Reload and check the current user.','Pergantian belum dikonfirmasi. Muat ulang dan periksa pengguna saat ini.')}</p>}
        {confirm==='restart'&&chatFailed&&<p role="alert" className="chat-assessment-review">{t('新对话暂未确认，请重试。','New conversation not confirmed. Please retry.','Percakapan baru belum dikonfirmasi. Coba lagi.')}</p>}
        {confirm==='retake'&&<div className="chat-retake-person">
          <span>{t('为其他人测评？','Taking the test for someone else?','Tes ini untuk orang lain?')}</span>
          <button type="button" onClick={()=>setConfirm('switch')}>{t('切换使用者','Switch user','Ganti pengguna')}</button>
        </div>}
        <div className="chat-dialog-actions">
          <button type="button" disabled={switchingPerson||starting} onClick={()=>{setConfirm(null);setPersonError(false);}}>{cancelLabel}</button>
          <button type="button" className="chat-primary disabled:opacity-50" disabled={switchingPerson||starting} onClick={()=>void handleConfirm()}>
            {switchingPerson||starting?t('处理中…','Working…','Memproses…'):
              confirm==='switch'?t('继续切换','Continue','Lanjutkan'):
              confirm==='retake'?t('开始测评','Start assessment','Mulai tes'):confirmationTitle}
          </button>
        </div>
      </StandaloneChatDialog>}
      {report&&<StandaloneChatDialog title={t('测评详情','Assessment details','Detail hasil tes')} closeLabel={closeLabel} onClose={()=>setReport(null)} variant="assessment-report">
        <HskAssessmentReport result={report} lang={lang} saving={savingReport} onRetry={()=>void retryReport(report)}/>
        <div className="chat-dialog-actions"><button className="chat-enrollment-next" type="button" onClick={()=>{setReport(null);setConfirm('retake');}}>
          {t('重新测评','Retake assessment','Ulangi tes')}
        </button></div>
      </StandaloneChatDialog>}

      <ConversationRegion ref={node=>{mainRef.current=node;}} inert={showOnboardingModal} className="standalone-chat-main">
        {!isTakingAssessment && emptyChat && <div className="chat-welcome-layout">
          <ChatWelcome lang={lang} hasDraft={hasAssessmentDraft} hasResult={Boolean(retainedReport)}
            onAssessment={()=>retainedReport&&!hasAssessmentDraft?setReport(retainedReport):assessmentAction()}
            onPrompt={prompt=>{setInputValue(prompt);inputRef.current?.focus({preventScroll:true});}}/>
        </div>}
        {!isTakingAssessment && !emptyChat && <div className="standalone-chat-flow">
        {!isTakingAssessment && messages.map((msg) => {
          const entry=msg.role==='assistant'&&msg.content.trim()?messageEntry(msg.workspaceEntry):undefined;
          return (
          <div key={msg.id} data-chat-message-id={msg.id} tabIndex={-1}>
            <ChatBubble role={msg.role==='user'?'user':'assistant'} content={msg.content} language={lang} entry={chatSource}
              origin={recommendationPage ? {source:thread.source,page:recommendationPage} : thread} enrollment={msg.enrollment}
              anchor={msg.enrollment?{owner:visitorScope(),conversationId:thread.conversationId,messageId:msg.id,
                widget:presentation==='panel'||presentation==='mobile'}:undefined}
              delivery={msg.delivery} compact={compact} busy={isTyping} onRetry={()=>void handleSendMessage(undefined,msg)}
              entryAction={entry&&<button type="button" className="chat-enrollment-next chat-enrollment-next--primary" data-chat-workspace-action
                disabled={busy} onClick={entry.open}>{entry.label}</button>}>
              {msg.isAssessmentResult&&msg.assessmentData?<ChatAssessmentSummary result={msg.assessmentData} lang={lang}
                onDetails={()=>setReport(msg.assessmentData!)}/>:undefined}
            </ChatBubble>

            {!isTyping && !starting && msg === messages.at(-1) && msg.role === 'assistant' &&
              <ChatFollowups prompts={msg.suggestedPrompts} onSelect={prompt=>void handleSendMessage(prompt)}/>}

          </div>
        );})}

          {consultationError&&<p role="alert" className="text-sm">{t('咨询暂不可用，测评结果已保存。','Consultation is temporarily unavailable; your results are saved.','Konsultasi belum tersedia; hasil tes tersimpan.')} <button className="underline min-h-11" onClick={()=>void beginAssessmentConsultation(consultationError)}>{t('重试咨询','Retry consultation','Coba konsultasi lagi')}</button></p>}
          {profileConsultationError&&<p role="alert" className="text-sm">{t('咨询暂不可用，请重试。','Consultation is temporarily unavailable. Please retry.','Konsultasi belum tersedia. Silakan coba lagi.')} <button className="underline min-h-11" onClick={()=>void beginProfileConsultation()}>{t('重试咨询','Retry consultation','Coba konsultasi lagi')}</button></p>}
          {isTyping&&<ChatTyping language={lang}/>}
          <div ref={messagesEndRef}/>
        </div>}

        {isTakingAssessment&&<motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="standalone-chat-assessment">
          <HSKPlacementAssessment studentName={profile?.fullName || 'Student'} onComplete={handleAssessmentComplete}
            onCancel={handleAssessmentCancel} active={active}
            onAttemptStart={attemptId=>rememberChatAssessment(owner,attemptId,thread.conversationId)}
            lang={lang} initialMode="express"/>
        </motion.div>}
      </ConversationRegion>

      {!isTakingAssessment && <footer inert={showOnboardingModal}>
        <ChatComposer language={lang} value={inputValue} onChange={setInputValue} onSend={()=>void handleSendMessage()} busy={busy} inputRef={inputRef} compact={compact}
          placeholder={emptyChat?t('直接提问，例如：零基础学中文要多久？','Ask a question, such as where to start as a beginner','Tanya langsung, misalnya cara mulai sebagai pemula'):t('继续提问…','Ask a follow-up…','Tanya lagi…')}>
          {chatFailed && <p role="alert" className="text-sm">{chooseText(lang,'对话同步失败。','Conversation could not sync.','Percakapan gagal disinkronkan.')} <button type="button" className="underline" onClick={refreshChat}>{chooseText(lang,'重试','Retry','Coba lagi')}</button></p>}
        </ChatComposer>
      </footer>}
    </div>
  );
}
