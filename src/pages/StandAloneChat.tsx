import {chatLanguage} from '../utils/chatLanguage';
import {visitorScope} from '../services/visitorScope';
import {PageMetadata} from '../components/PageMetadata';
import { safeHskResult } from "../data/hskReportHistory";
import {draft,deliveryText,type Delivery} from "../services/chatDelivery";
import { chatFetch, registerContact, restoreChat, finishChat, startAnotherVisitor } from '../services/portalChat';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Sparkles,
  MessageCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ArrowLeft,
  UserCheck,
  Clock,
  HelpCircle,
  Globe2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GFormOnboardingModal from '../components/GFormOnboardingModal';
import HskAssessmentReport from '../components/HskAssessmentReport';
import {type HskResult, chooseText} from '../data/hskAssessment';
import {saveHskAttempt, restoreHskAttempts, assessmentConsultation, profileConsultation} from '../services/portalChat';
import {writeHskResult,readHskHistory,readHskDraft} from '../services/hskAttemptStorage';
import HSKPlacementAssessment from '../components/HSKPlacementAssessment';
import {hskWhatsAppDraft} from '../services/hskWhatsApp';
import HskAssessmentWelcome from '../components/HskAssessmentWelcome';
import { LeadProfile, calculateLeadTier } from '../types/leadSystem';
import {
  getStudentContext,
  getChatAssessmentStatus,
  saveStudentContext,
  subscribeStudentContext
} from '../services/studentProfileStorage';

interface ChatMessage {
  delivery?: Delivery;
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestedPrompts?: string[];
  isAssessmentCard?: boolean;
  isProfileWelcome?: boolean;
  isAssessmentResult?: boolean;
  assessmentData?: HskResult & { whatsapp?: string };
}

export default function StandAloneChat() {
  const [initialContext] = useState(getStudentContext);
  const [profile, setProfile] = useState<LeadProfile | null>(() => {
    const ctx = getStudentContext();
    return ctx?.leadProfile || null;
  });
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(() => {
    const ctx = getStudentContext();
    return !ctx?.leadProfile;
  });
  const [isTakingAssessment, setIsTakingAssessment] = useState(() => getChatAssessmentStatus(initialContext) === 'pending');
  useEffect(() => {
    let active=true;
    const owner = visitorScope();
    Promise.all([restoreChat('standalone_chat').catch(()=>[]),restoreHskAttempts().catch(()=>readHskHistory(initialContext?.preferredLanguage||'en'))]).then(([rows,attempts])=>{
      if(!active || owner !== visitorScope())return;
      const latest=attempts[0] || safeHskResult(initialContext?.assessment?.result, initialContext?.preferredLanguage || 'en');
      if(latest){writeHskResult(latest);if(!readHskDraft())setIsTakingAssessment(false);}
      const unavailable = !latest && initialContext?.assessment?.result;
      const failedIntro=latest&&rows.some((r:any)=>r.request_id==='hsk-intro-'+latest.attempt.attemptId&&['failed','interrupted'].includes(r.status));
      const failedProfileIntro=rows.some((r:any)=>r.request_id?.startsWith('profile-intro-')&&['failed','interrupted'].includes(r.status));
      const visibleRows=rows.filter((r:any)=>!(latest&&r.request_id?.startsWith('profile-intro-')) && !((r.request_id?.startsWith('hsk-intro-')||r.request_id?.startsWith('profile-intro-'))&&['failed','interrupted'].includes(r.status)));
      const cards:ChatMessage[]=latest?[{id:`assessment-${latest.attempt.attemptId}`,role:'assistant',content:latest.summary,timestamp:new Date(latest.attempt.completedAt!),isAssessmentResult:true,assessmentData:latest}]:unavailable?[{id:'assessment-unavailable',role:'assistant',content:chooseText(initialContext?.preferredLanguage || 'en','历史报告待核对','Historical report needs review','Laporan lama perlu ditinjau'),timestamp:new Date(),isAssessmentResult:true,assessmentData:unavailable}]:[];
      const introIndex=latest?visibleRows.findIndex((r:any)=>r.id==='reply-hsk-intro-'+latest.attempt.attemptId):-1;
      const profileCards:ChatMessage[]=!latest&&rows.some((r:any)=>r.request_id?.startsWith('profile-intro-'))?[{id:'profile-welcome',role:'assistant',content:'',timestamp:new Date(),isProfileWelcome:true}]:[];
      if(rows.length||cards.length)setMessages(introIndex<0?[...profileCards,...visibleRows,...cards]:[...visibleRows.slice(0,introIndex),...cards,...visibleRows.slice(introIndex)]);
      if(failedIntro)setConsultationError(latest);
      if(failedProfileIntro&&!latest)setProfileConsultationError(true);
    });
    return()=>{active=false;};
  },[]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!initialContext?.leadProfile) return [];
    const pending = getChatAssessmentStatus(initialContext) === 'pending';
    const language = chatLanguage(initialContext.preferredLanguage,window.location.search);
    return [{
      id: 'msg-resume', role: 'assistant', timestamp: new Date(),
      content: language === 'zh'
        ? (pending ? '欢迎回来！您的资料已保存，请在下方选择 HSK 测评模式。' : '欢迎回来！您的资料已保存，可以继续咨询，也可以点击顶部的 HSK 摸底测验。')
        : language === 'id'
        ? (pending ? 'Selamat datang kembali! Profil Anda tersimpan. Silakan pilih mode tes HSK di bawah.' : 'Selamat datang kembali! Profil Anda tersimpan. Lanjutkan konsultasi atau pilih Ikuti Tes HSK di atas.')
        : (pending ? 'Welcome back! Your profile is saved. Please select an HSK assessment mode below.' : 'Welcome back! Your profile is saved. Continue your consultation or select Take HSK Test above.')
    }];
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lang, setLang] = useState<'en' | 'id' | 'zh'>(()=>chatLanguage(initialContext?.preferredLanguage,window.location.search));

  // A saved promotion entry also selects the interface language for returning visitors.
  // Existing customer records, messages and assessment state are not rewritten.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search), code = params.get('c'), entry = params.get('p');
    if (!code || !entry) return;
    let active = true;
    fetch(`/api/campaigns/${encodeURIComponent(code)}/links/${encodeURIComponent(entry)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active && ['en','id','zh'].includes(data?.link?.language)) setLang(data.link.language); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const changeLanguage = (language: 'en' | 'id' | 'zh') => {
    setLang(language);
    saveStudentContext({ preferredLanguage: language });
  };

  const handleAssessmentCancel = () => {
    setIsTakingAssessment(false);
    saveStudentContext({ chatAssessmentStatus: readHskDraft()?'paused':'skipped' });
    setMessages(prev=>[...prev.filter(m=>!m.isAssessmentCard && m.id!=='msg-resume' && !m.isProfileWelcome),{id:'profile-welcome',role:'assistant',content:'',timestamp:new Date(),isProfileWelcome:true}]);
    void beginProfileConsultation();
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isTakingAssessment) {
      const last=messages.at(-1);
      if(last?.isAssessmentResult || last?.id.startsWith('reply-hsk-intro-'))mainRef.current?.querySelector('[data-hsk-welcome]')?.scrollIntoView({behavior:'auto',block:'start'});
      else scrollToBottom();
    }
  }, [messages, isTyping, isTakingAssessment]);
  useEffect(() => {
    if (isTakingAssessment) mainRef.current?.scrollTo({ top: 0 });
  }, [isTakingAssessment]);

  // Keep state synchronized with storage events
  useEffect(() => {
    const unsubscribe = subscribeStudentContext((ctx) => {
      setProfile(ctx?.leadProfile || null);
      if(ctx?.preferredLanguage)setLang(ctx.preferredLanguage);
      setShowOnboardingModal(!ctx?.leadProfile);
    });
    return unsubscribe;
  }, []);

  // Sync lead profile to backend API
  const syncLeadToBackend = async (lead: LeadProfile, _messages?: ChatMessage[]) => { await registerContact(lead); };
  const syncChatTranscript = async (_lead: LeadProfile | null, _messages: ChatMessage[]) => {};

  // Explicit handler to voluntarily launch HSK Placement Assessment anytime
  const handleStartVoluntaryAssessment = () => {
    setIsTakingAssessment(true);
    saveStudentContext({ chatAssessmentStatus: 'pending', preferredLanguage: lang });
    const launchMsg: ChatMessage = {
      id: `msg-voluntary-${Date.now()}`,
      role: 'assistant',
      content: chooseText(lang,'请选择50题完整测评，或15题快速测评以获得初步学习起点建议。','Choose the full 50-item assessment, or the 15-item quick assessment for an initial learning starting point.','Pilih tes lengkap 50 soal, atau tes singkat 15 soal untuk rekomendasi titik awal belajar.'),
      timestamp: new Date(),
      isAssessmentCard: true
    };
    setMessages((prev) => [...prev, launchMsg]);
  };

  // Called when student finishes 30s GForm Profile
  const handleOnboardingComplete = async (completedProfile: LeadProfile, selectedLang: 'en' | 'id' | 'zh') => {
    await registerContact(completedProfile);
    setProfile(completedProfile);
    setLang(selectedLang);
    setShowOnboardingModal(false);

    // Synchronize to unified student context across all applet surfaces
    saveStudentContext({
      leadProfile: completedProfile,
      assessment: null,
      chatAssessmentStatus: completedProfile.levelState === 'PARTIAL' ? 'pending' : 'not_required',
      preferredLanguage: selectedLang
    });

    const studentName = completedProfile.fullName;
    const goal = completedProfile.goal;
    const levelState = completedProfile.levelState;
    const reportedLevel = completedProfile.reportedLevel;

    if (levelState === 'PARTIAL') {
      // PARTIAL -> Assessment Needed
      setIsTakingAssessment(true);
      const greetingContent = selectedLang === 'en'
        ? `Hello **${studentName}**! Welcome to your UPER Education academic consultation. 🌟

Based on your inquiry profile:
- 🎯 **Primary Goal:** ${goal}
- 📊 **Current Level:** ${reportedLevel} (Verification Required)

*According to UPER placement guidance, accurate placement is essential so that classes are neither too demanding nor too basic. We have prepared an **UPER HSK 1–3 diagnostic adaptation** for you below:*`
        : selectedLang === 'zh'
        ? `您好 **${studentName}**！欢迎来到 UPER 学习咨询中心。🌟

根据您的登记信息：
- 🎯 **学习目标：** ${goal}
- 📊 **自报基础：** ${reportedLevel} (需测评定级)

*为确保分班精准、避免课程过难或重复学习，我们已在下方为您开启 **UPER HSK 1~3 级混合摸底测试**：*`
        : `Halo **${studentName}**! Senang bertemu dengan Anda di sesi konsultasi UPER Education.

Berdasarkan formulir Anda:
- 🎯 **Tujuan Belajar:** ${goal}
- 📊 **Tingkat Saat Ini:** ${reportedLevel} (Perlu verifikasi)

*Sesuai standar akademik UPER, kami telah mengaktifkan **Diagnostik Penempatan UPER HSK** untuk Anda di bawah ini:*`;

      const initialGreeting: ChatMessage = {
        id: 'msg-init-partial',
        role: 'assistant',
        content: greetingContent,
        timestamp: new Date(),
        isAssessmentCard: true
      };
      setMessages([initialGreeting]);


    } else if (levelState === 'KNOWN') {
      // KNOWN -> Skip Assessment (But offer voluntary entry)
      const greetingContent = selectedLang === 'zh'
        ? `您好 **${studentName}**！您填写的中文基础是 **${reportedLevel}（自报）**，尚不代表测评结论。可以自选摸底测评，或先咨询课程。具体班级、开班时间及名额需要确认。您最想了解什么？`
        : selectedLang === 'id'
        ? `Halo **${studentName}**! Tingkat **${reportedLevel}** berasal dari laporan Anda, bukan hasil tes. Anda dapat memilih tes atau konsultasi. Jadwal dan ketersediaan perlu dikonfirmasi.`
        : `Hello **${studentName}**! **${reportedLevel}** is your self-reported starting point, not an assessment result. You can choose a diagnostic or ask about courses. Classes, schedules and availability require confirmation.`;

      const initialGreeting: ChatMessage = {
        id: 'msg-init-known',
        role: 'assistant',
        content: greetingContent,
        timestamp: new Date(),
        suggestedPrompts: selectedLang === 'zh' ? ['参加UPER分班诊断（自选）','学费和分期安排如何？','如何了解适合的课程或试听？'] : selectedLang === 'en' ? [
          '🎯 Take UPER HSK Placement Diagnostic (Optional)',
          'What are the course fees and available installment plans?',
          'When are the nearest class start dates for my level?'
        ] : [
          '🎯 Ikuti diagnostik UPER HSK (opsional)',
          'Berapa biaya kelas lanjutan dan opsi cicilannya?',
          'Kapan jadwal kelas terdekat untuk level saya?'
        ]
      };
      setMessages([initialGreeting]);


    } else {
      // ZERO -> Complete Beginner (Also offer voluntary entry)
      const greetingContent = selectedLang === 'en'
        ? `Hello **${studentName}**! Welcome to UPER Education.

As a **Complete Beginner**, your academic pathway is structured as follows:
- **Diagnostic Status:** Mandatory placement testing waived (self-reported beginner).
- **Recommended Program:** **HSK 1 Starter & Practical Conversation Track** (Comprehensive Pinyin system, tones, and 150 core high-frequency vocabulary).

*Optional: If you would like to preview diagnostic audio, feel free to click **"Take HSK Test"** at the top right anytime.*

How can I assist you today with course schedules, class options, or tuition details?`
        : selectedLang === 'zh'
        ? `您好 **${studentName}**！欢迎来到 UPER Education。

针对您的**零基础起点**，UPER 为您规划了清晰的教学路径：
- **测评状态：** 免除强制摸底测验（已确认零基础起点）。
- **推荐班级：** **HSK 1 零基础启航班**（涵盖标准拼音发音、四声调及 150 个核心高频生词）。

*注：如您希望体验真实的考场听力真题，也可随时点击右上角的 **【HSK 摸底测验】** 进行自测。*

请问您目前最希望了解哪方面的信息（例如开班排期、授课形式或学费方案）？`
        : `Halo **${studentName}**! Selamat datang di UPER Education.

Bagi peserta **Pemula (Zero Beginner)**, jalur akademik yang disiapkan adalah sebagai berikut:
- **Status Diagnostik:** Bebas tes penempatan wajib (fondasi awal terkonfirmasi).
- **Rekomendasi Kelas:** **HSK 1 Starter & Percakapan Praktis** (sistem Pinyin, empat nada, dan 150 kosakata esensial).

*Opsional: Anda dapat mengklik tombol **"Ikuti Tes HSK"** di pojok kanan atas kapan saja jika ingin mencoba format soal ujian.*

Apa yang ingin Anda ketahui lebih lanjut mengenai jadwal kelas, format kursus, atau biaya?`;

      const initialGreeting: ChatMessage = {
        id: 'msg-init-zero',
        role: 'assistant',
        content: greetingContent,
        timestamp: new Date(),
        suggestedPrompts: selectedLang === 'zh' ? ['参加UPER分班诊断（自选）','学费和分期安排如何？','如何了解适合的课程或试听？'] : selectedLang === 'en' ? [
          '🎯 Take UPER HSK Placement Diagnostic (Optional)',
          'How long does it take from zero to conversational fluency?',
          'What are the tuition fees and schedules for HSK 1 beginner classes?'
        ] : [
          '🎯 Ikuti diagnostik UPER HSK (opsional)',
          'Berapa lama belajar dari nol hingga bisa bicara lancar?',
          'Berapa biaya dan jadwal kelas pemula HSK 1?'
        ]
      };
      setMessages([initialGreeting]);

    }
  };

  const handleAssessmentComplete = (result: HskResult) => {
    setIsTakingAssessment(false);
    if (profile) {
      const updatedProfile: LeadProfile = {...profile,quizScore:result.score,totalQuestions:result.questionCount,quizMaxScore:result.maxScore,
        ...(profile.levelSource==='trial'?{}:{levelConfirmed:result.levelConfirmed,levelSource:'assessment' as const}),quizResultSummary:result.summary,quizBreakdown:result.breakdown,
        latestAssessment:result,assessmentProvenance:result.saveStatus==='saved'?'server_recomputed_adapted_paper':undefined};
      // Assessments update evidence, never the existing customer Tier.
      setProfile(updatedProfile);
      saveStudentContext({leadProfile:updatedProfile,chatAssessmentStatus:'completed',assessment:{completed:true,result,score:result.score,total:result.maxScore,maxScore:result.maxScore,questionCount:result.questionCount,levelConfirmed:result.levelConfirmed,summary:result.summary,breakdown:result.breakdown,saveStatus:result.saveStatus,completedAt:result.attempt.completedAt}});
    }
    setProfileConsultationError(false);
    setMessages(prev=>[...prev.filter(m=>!m.isAssessmentResult && !m.isAssessmentCard && !m.isProfileWelcome && !m.id.startsWith('reply-profile-intro') && m.id!=='msg-resume'),{id:`assessment-${result.attempt.attemptId}`,role:'assistant',content:result.summary,timestamp:new Date(),isAssessmentResult:true,assessmentData:result,
      suggestedPrompts:[]}]);
    if(result.saveStatus==='saved')void beginAssessmentConsultation(result);
  };
  const [consultationError,setConsultationError]=useState<HskResult|null>(null);
  const [profileConsultationError,setProfileConsultationError]=useState(false);
  const consultationRunning=useRef(new Set<string>());
  const beginAssessmentConsultation=async(result:HskResult)=>{
    const attemptId=result.attempt.attemptId;
    const botId='reply-hsk-intro-'+attemptId;
    if(consultationRunning.current.has(attemptId)||messages.some(m=>m.id===botId&&m.content))return;
    consultationRunning.current.add(attemptId);setConsultationError(null);setIsTyping(true);
    setMessages(prev=>[...prev.filter(m=>m.id!==botId),{id:botId,role:'assistant',content:'',timestamp:new Date()}]);
    let reply='';
    try{
      const res=await assessmentConsultation(attemptId,lang);
      const response=await finishChat(res,'standalone_chat','hsk-intro-'+attemptId,e=>{if(e.reset)reply='';if(e.chunk)reply+=e.chunk;setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:reply}:m));});
      setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:response.reply}:m));
    }catch{setMessages(prev=>prev.filter(m=>m.id!==botId));setConsultationError(result);}
    finally{consultationRunning.current.delete(attemptId);setIsTyping(false);}
  };
  const beginProfileConsultation=async()=>{
    const botId='reply-profile-intro';
    if(consultationRunning.current.has(botId)||messages.some(m=>m.id.startsWith(botId)&&m.content))return;
    consultationRunning.current.add(botId);setProfileConsultationError(false);setIsTyping(true);
    setMessages(prev=>[...prev.filter(m=>m.id!==botId),{id:botId,role:'assistant',content:'',timestamp:new Date()}]);
    let reply='';
    try{
      const res=await profileConsultation(lang);
      const response=await finishChat(res,'standalone_chat','profile-intro',e=>{if(e.reset)reply='';if(e.chunk)reply+=e.chunk;setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:reply}:m));});
      setMessages(prev=>prev.map(m=>m.id===botId?{...m,content:response.reply}:m));
    }catch{setMessages(prev=>prev.filter(m=>m.id!==botId));setProfileConsultationError(true);}
    finally{consultationRunning.current.delete(botId);setIsTyping(false);}
  };
  const [savingReport,setSavingReport]=useState(false);
  const retryReport=async(result:HskResult)=>{
    if(savingReport)return;setSavingReport(true);
    try {const saved=await saveHskAttempt(result.attempt,lang);writeHskResult(saved);handleAssessmentComplete(saved);} catch {} finally {setSavingReport(false);}
  };

  // Send message to DeepSeek backend
  const handleSendMessage = async (textToSend?: string, retry?: ChatMessage) => {
    const messageContent=(retry?.content || textToSend || inputValue).trim();
    if(!messageContent || isTyping)return;
    if(!retry && (messageContent.includes('🎯') || messageContent.toLowerCase().includes('take official hsk') || messageContent.includes('参加UPER HSK 摸底测试') || messageContent.includes('参加UPER分班诊断') || /take.*UPER.*diagnostic|ikuti.*diagnostik.*UPER/i.test(messageContent))){handleStartVoluntaryAssessment();return;}
    setInputValue('');setIsTyping(true);
    const userMessage:ChatMessage=retry || {id:crypto.randomUUID(),role:'user',content:messageContent,timestamp:new Date()};
    const botMessageId='reply-'+userMessage.id;
    setMessages(prev=>[...prev.filter(m=>m.id!==botMessageId && m.id!==userMessage.id),{...userMessage,delivery:'pending'},{id:botMessageId,role:'assistant',content:'',timestamp:new Date()}]);
    let reply='';
    try{
      const res=await chatFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[userMessage],isHumanMode:false,language:lang,stream:true})},'standalone_chat');
      const result=await finishChat(res,'standalone_chat',userMessage.id,e=>{
        if(e.reset)reply='';if(e.chunk)reply+=e.chunk;if(e.reply && !e.chunk)reply=e.reply;
        setMessages(prev=>prev.map(m=>m.id===userMessage.id&&e.saved?{...m,delivery:'saved'}:m.id===botMessageId?{...m,content:reply}:m));
      });
      setMessages(prev=>prev.map(m=>m.id===userMessage.id?{...m,delivery:'saved'}:m.id===botMessageId?{...m,content:result.reply,suggestedPrompts:result.suggestedPrompts}:m));
    }catch(e){
      const delivery=draft('standalone_chat',userMessage.id)?.delivery || 'unknown';
      setMessages(prev=>prev.filter(m=>m.id!==botMessageId).map(m=>m.id===userMessage.id?{...m,delivery}:m));
    }finally{setIsTyping(false);}
  };

  const whatsappDraft=hskWhatsAppDraft(profile,messages.filter(m=>m.isAssessmentResult).at(-1)?.assessmentData,lang);
  const [retakeConfirm,setRetakeConfirm]=useState(false);
  const [switchingPerson,setSwitchingPerson]=useState(false);
  const [personError,setPersonError]=useState(false);
  const [switchConfirm,setSwitchConfirm]=useState(false);
  const switchPerson=()=>{setRetakeConfirm(false);setSwitchConfirm(true);};
  const performPersonSwitch=async()=>{

    setSwitchingPerson(true);setPersonError(false);
    try{await startAnotherVisitor();window.location.reload();}catch{setPersonError(true);setSwitchingPerson(false);}
  };
  const hasResults=messages.some(m=>m.isAssessmentResult);
  return (
    <div className="flex flex-col h-dvh bg-slate-100 text-slate-900 font-sans">
      <PageMetadata lang={lang}/>
      {/* Onboarding Profile Modal (GForm First) */}
      <GFormOnboardingModal
        isOpen={showOnboardingModal}
        onComplete={handleOnboardingComplete}
        initialLang={lang}
      />

      {/* Standalone Header */}
      <header className={`bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-6 flex items-center justify-between shadow-md shrink-0 ${isTakingAssessment ? 'py-2 gap-2' : 'py-3 flex-col gap-3 sm:flex-row'}`}>
        {isTakingAssessment ? <span className="text-sm font-semibold min-w-0">{chooseText(lang,'HSK 分班参考测评','HSK placement assessment','Tes penempatan HSK')}</span> : (
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={chooseText(lang,'返回首页','Return to Home','Kembali ke beranda')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-tech-500 flex items-center justify-center font-bold text-white shadow-sm shadow-primary-500/30 text-sm">
              UP
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white truncate">{chooseText(lang,'UPER 学习咨询','UPER Learning Advisory','Konsultasi Belajar UPER')}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AI
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
              <p className="text-slate-400 truncate max-w-[160px] sm:max-w-none">
                {profile ? profile.fullName : chooseText(lang,'课程咨询与分班参考','Course consultation and placement reference','Konsultasi kursus dan referensi penempatan')}
              </p>
              {hasResults && <button type="button" className="text-slate-200 underline underline-offset-2 min-h-11 -my-3 shrink-0" onClick={()=>mainRef.current?.querySelector('[data-hsk-result-anchor]')?.scrollIntoView({behavior:'smooth',block:'start'})}>{chooseText(lang,'测评结果','Assessment results','Hasil tes')}</button>}
              </div>
            </div>
          </div>
        </div>

        )}
        {/* Right Action: Voluntary HSK Test, Language Switcher & WhatsApp Link */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {profile && <button type="button" disabled={switchingPerson||isTyping} onClick={()=>void switchPerson()} className="text-xs text-slate-200 underline underline-offset-2 min-h-11 disabled:opacity-50">{switchingPerson?chooseText(lang,'正在切换…','Switching…','Mengganti…'):chooseText(lang,'切换使用者','Switch user','Ganti pengguna')}</button>}
          {/* Voluntary Assessment Quick Launcher Button */}
          {!isTakingAssessment && (
            <button
              type="button"
              onClick={()=>{
                if(hasResults&&!readHskDraft())setRetakeConfirm(true);else handleStartVoluntaryAssessment();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-white" />
              <span>{readHskDraft()?chooseText(lang,'继续测评','Resume assessment','Lanjutkan tes'):hasResults?chooseText(lang,'重新测评','Retake assessment','Ulangi tes'):chooseText(lang,'HSK 摸底测验','Take HSK Test','Ikuti Tes HSK')}</span>
            </button>
          )}

          {/* Top Language Toggle */}
          <div className="flex items-center bg-slate-800 rounded-full p-0.5 border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => changeLanguage('en')}
              aria-pressed={lang === 'en'}
              className={`px-2 py-0.5 min-h-11 rounded-full transition-all font-semibold ${
                lang === 'en' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => changeLanguage('id')}
              aria-pressed={lang === 'id'}
              className={`px-2 py-0.5 min-h-11 rounded-full transition-all font-semibold ${
                lang === 'id' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => changeLanguage('zh')}
              aria-pressed={lang === 'zh'}
              className={`px-2 py-0.5 min-h-11 rounded-full transition-all font-semibold ${
                lang === 'zh' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              中文
            </button>
          </div>

          {!isTakingAssessment && <a
            href={whatsappDraft.url}
            title={chooseText(lang,'带上基本信息和测评摘要，在WhatsApp中编辑后手动发送','Includes your profile and assessment summary; edit and send manually in WhatsApp','Membawa profil dan ringkasan tes; edit lalu kirim sendiri di WhatsApp')}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={chooseText(lang,'通过WhatsApp联系真人顾问','Contact a human advisor on WhatsApp','Hubungi Konsultan UPER via WhatsApp')}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5 shrink-0"><path d="M20 11.8a8 8 0 0 1-11.8 7L4 20l1.2-4.2A8 8 0 1 1 20 11.8Z" stroke="currentColor" strokeWidth="1.8"/><path d="M8.5 7.5c-.6.6-.8 1.3-.4 2.3 1 2.5 3 4.5 5.5 5.4 1 .4 1.7.1 2.2-.5l.5-1.1-2.1-1-1 1c-1.4-.6-2.7-1.8-3.3-3.2l.8-1-1-2Z" fill="currentColor"/></svg>
            <span className="text-left leading-tight"><span className="block">{chooseText(lang,'联系真人顾问','Human advisor','Konsultan UPER')}</span><span className="block text-[10px] font-normal opacity-90">WhatsApp</span></span>
          </a>}
        </div>
      </header>

      {/* Main Dialogue Scrollable Body */}
      {switchConfirm&&<div role="dialog" aria-modal="true" aria-label={chooseText(lang,'切换使用者','Switch user','Ganti pengguna')} onKeyDown={e=>{if(e.key==='Escape'&&!switchingPerson)setSwitchConfirm(false);if(e.key==='Tab'){const b=e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');if(e.shiftKey&&document.activeElement===b[0]){e.preventDefault();b[b.length-1]?.focus();}else if(!e.shiftKey&&document.activeElement===b[b.length-1]){e.preventDefault();b[0]?.focus();}}}} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"><div className="bg-white text-slate-900 rounded-2xl p-6 max-w-md space-y-4"><h2 className="text-lg font-semibold">{chooseText(lang,'切换使用者','Switch user','Ganti pengguna')}</h2><p>{chooseText(lang,'下一位需要重新填写个人资料。当前使用者已保存的记录会保留；未提交的内容不会转给下一位。','The next person must enter their details. Saved records are kept; unsent content is not transferred.','Pengguna berikutnya perlu mengisi data pribadi. Catatan tersimpan tetap ada; isian yang belum dikirim tidak diteruskan.')}</p><button autoFocus disabled={switchingPerson} className="min-h-11 px-4" onClick={()=>setSwitchConfirm(false)}>{chooseText(lang,'取消','Cancel','Batal')}</button><button disabled={switchingPerson} className="min-h-11 px-4 underline" onClick={()=>void performPersonSwitch()}>{switchingPerson?chooseText(lang,'正在切换…','Switching…','Mengganti…'):chooseText(lang,'继续切换','Continue','Lanjutkan')}</button></div></div>}
      {personError&&<p role="alert">{chooseText(lang,'切换未确认成功，请刷新后核对当前使用者，不要继续填写。','The switch could not be confirmed. Reload and check the current user before continuing.','Pergantian belum dapat dikonfirmasi. Muat ulang dan periksa pengguna sebelum melanjutkan.')}</p>}
      {retakeConfirm&&<div role="dialog" onKeyDown={e=>{if(e.key==='Escape')setRetakeConfirm(false);if(e.key==='Tab'){const b=e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');if(e.shiftKey&&document.activeElement===b[0]){e.preventDefault();b[b.length-1]?.focus();}else if(!e.shiftKey&&document.activeElement===b[b.length-1]){e.preventDefault();b[0]?.focus();}}}} aria-modal="true" aria-label={chooseText(lang,'重新测评','Retake assessment','Ulangi tes')} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"><div className="bg-white text-slate-900 rounded-2xl p-6 max-w-md space-y-4"><h2 className="text-lg font-semibold">{chooseText(lang,`为 ${profile?.fullName||''} 重新测评？`,`Retake the assessment for ${profile?.fullName||''}?`,`Ulangi tes untuk ${profile?.fullName||''}?`)}</h2><p>{chooseText(lang,'之前的测评记录会保留。','Previous assessment records will be kept.','Riwayat tes sebelumnya tetap disimpan.')}</p><button autoFocus type="button" className="min-h-11 px-4 underline" onClick={()=>{setRetakeConfirm(false);handleStartVoluntaryAssessment();}}>{chooseText(lang,'开始重新测评','Start retake','Mulai tes ulang')}</button><button type="button" className="min-h-11 px-4" onClick={()=>setRetakeConfirm(false)}>{chooseText(lang,'取消','Cancel','Batal')}</button><button type="button" className="block underline min-h-11" onClick={()=>void switchPerson()}>{chooseText(lang,'不是本人？切换使用者','Not you? Switch user','Bukan Anda? Ganti pengguna')}</button></div></div>}
      <main ref={mainRef} className={`flex-1 min-h-0 overflow-y-auto space-y-4 w-full mx-auto ${isTakingAssessment ? 'p-2 sm:p-4 max-w-5xl' : 'p-4 sm:p-6 max-w-4xl'}`}>
        {!isTakingAssessment && messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {msg.role==='user' && msg.delivery && <div role="status" className="text-xs mb-1">{deliveryText(msg.delivery,lang)}{!['pending','saved'].includes(msg.delivery) && <button className="ml-3 underline min-h-11" disabled={isTyping} onClick={()=>void handleSendMessage(undefined,msg)}>{lang==='zh'?'重试':lang==='en'?'Retry':'Coba lagi'}</button>}</div>}
            <div className={`flex items-start gap-2.5 max-w-[92%] sm:max-w-[80%] ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-primary-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`p-4 sm:p-5 rounded-3xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-sm shadow-md shadow-primary-600/20'
                  : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200/80 shadow-sm'
              }`}>
                {msg.isProfileWelcome ? <HskAssessmentWelcome profile={profile} lang={lang} completed={false}/> : msg.isAssessmentResult && msg.assessmentData ? (
                  <div className="space-y-4">
                    <HskAssessmentWelcome profile={profile} lang={lang}/>
                    <div data-hsk-result-anchor className="scroll-mt-4"><HskAssessmentReport result={msg.assessmentData} lang={lang} saving={savingReport} onRetry={()=>void retryReport(msg.assessmentData!)}/></div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-inherit prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                  </div>
                )}
              </div>
            </div>

            {/* Suggested Clickable Follow-up Prompts */}
            {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 pl-10 max-w-full">
                {msg.suggestedPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(p)}
                    className="text-xs bg-white hover:bg-primary-50 text-primary-800 font-semibold py-1.5 px-3 rounded-full border border-primary-200/80 shadow-xs hover:border-primary-400 transition-all text-left"
                  >
                    💬 {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Embedded Authentic HSK Placement Assessment */}
        {isTakingAssessment && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <HSKPlacementAssessment
              studentName={profile?.fullName || 'Student'}
              onComplete={handleAssessmentComplete}
              onCancel={handleAssessmentCancel}
              lang={lang}
            />
          </motion.div>
        )}

        {/* AI Typing Indicator */}
        {!isTakingAssessment && consultationError && <p role="alert" className="text-sm">{chooseText(lang,'咨询暂不可用，测评结果已保存。','Consultation is temporarily unavailable; your results are saved.','Konsultasi belum tersedia; hasil tes tersimpan.')} <button className="underline min-h-11" onClick={()=>void beginAssessmentConsultation(consultationError)}>{chooseText(lang,'重试咨询','Retry consultation','Coba konsultasi lagi')}</button></p>}
        {!isTakingAssessment && profileConsultationError && <p role="alert" className="text-sm">{chooseText(lang,'咨询暂不可用，请重试。','Consultation is temporarily unavailable. Please retry.','Konsultasi belum tersedia. Silakan coba lagi.')} <button className="underline min-h-11" onClick={()=>void beginProfileConsultation()}>{chooseText(lang,'重试咨询','Retry consultation','Coba konsultasi lagi')}</button></p>}
        {!isTakingAssessment && isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pl-10">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>
              {lang === 'en'
                ? 'UPER AI is preparing a reply...'
                : lang === 'zh'
                ? 'UPER AI 正在生成专属解答与规划...'
                : 'UPER AI sedang menyiapkan jawaban...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Bottom Sticky Input */}
      {!isTakingAssessment && <footer className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-4xl mx-auto flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTakingAssessment || isTyping}
            placeholder={
              isTakingAssessment
                ? chooseText(lang,'请先完成上方测评…','Please complete the assessment above…','Selesaikan tes di atas terlebih dahulu…')
                : chooseText(lang,'请输入课程、HSK或学习规划问题…','Ask about courses, HSK or study planning…','Tanyakan tentang kursus, HSK atau rencana belajar…')
            }
            className="min-w-0 flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTakingAssessment || isTyping}
            className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl shadow-md shadow-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>}
    </div>
  );
}
