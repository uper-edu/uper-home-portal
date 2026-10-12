import { safeHskResult } from "../data/hskReportHistory";
import {draft,deliveryText,type Delivery} from "../services/chatDelivery";
import { chatFetch, registerContact, restoreChat, finishChat } from '../services/portalChat';
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
import {saveHskAttempt, restoreHskAttempts} from '../services/portalChat';
import {writeHskResult,readHskHistory} from '../services/hskAttemptStorage';
import HSKPlacementAssessment from '../components/HSKPlacementAssessment';
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
  useEffect(()=>{fetch('/api/portal/session').then(r=>r.ok?r.json():Promise.reject()).then(s=>{if(!s.registered)setShowOnboardingModal(true);}).catch(()=>{});},[]);
  const [isTakingAssessment, setIsTakingAssessment] = useState(() => getChatAssessmentStatus(initialContext) === 'pending');
  useEffect(() => {
    let active=true;
    Promise.all([restoreChat('standalone_chat').catch(()=>[]),restoreHskAttempts().catch(()=>readHskHistory(initialContext?.preferredLanguage||'en'))]).then(([rows,attempts])=>{
      if(!active)return;
      const latest=attempts[0] || safeHskResult(initialContext?.assessment?.result, initialContext?.preferredLanguage || 'en');
      if(latest)writeHskResult(latest);
      const unavailable = !latest && initialContext?.assessment?.result;
      if(rows.length || latest || unavailable)setMessages([...rows,...(latest?[{id:`assessment-${latest.attempt.attemptId}`,role:'assistant' as const,content:latest.summary,timestamp:new Date(latest.attempt.completedAt!),isAssessmentResult:true,assessmentData:latest}]:unavailable?[{id:'assessment-unavailable',role:'assistant' as const,content:chooseText(initialContext?.preferredLanguage || 'en','历史报告待核对','Historical report needs review','Laporan lama perlu ditinjau'),timestamp:new Date(),isAssessmentResult:true,assessmentData:unavailable}]:[])]);
    });
    return()=>{active=false;};
  },[]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!initialContext?.leadProfile) return [];
    const pending = getChatAssessmentStatus(initialContext) === 'pending';
    const language = initialContext.preferredLanguage || 'en';
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
  const [lang, setLang] = useState<'en' | 'id' | 'zh'>(initialContext?.preferredLanguage || 'en');

  const changeLanguage = (language: 'en' | 'id' | 'zh') => {
    setLang(language);
    saveStudentContext({ preferredLanguage: language });
  };

  const handleAssessmentCancel = () => {
    setIsTakingAssessment(false);
    saveStudentContext({ chatAssessmentStatus: 'skipped' });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isTakingAssessment) scrollToBottom();
  }, [messages, isTyping, isTakingAssessment]);
  useEffect(() => {
    if (isTakingAssessment) mainRef.current?.scrollTo({ top: 0 });
  }, [isTakingAssessment]);

  // Keep state synchronized with storage events
  useEffect(() => {
    const unsubscribe = subscribeStudentContext((ctx) => {
      if (ctx?.leadProfile) {
        setProfile(ctx.leadProfile);
      }
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
      content: chooseText(lang,'中文分班诊断已开启。快测11题，仅供筛查；完整测评50题（21听力、21阅读、8识字选择）。这是所提供试卷的数字化改编，不是官方认证考试。请在下方选择模式。','The Mandarin diagnostic is ready. Screening has 11 items; the full diagnostic has 50 (21 listening, 21 reading, 8 character choices). This is an adaptation of the supplied paper, not an official certification exam. Choose a mode below.','Diagnostik Mandarin siap. Skrining berisi 11 soal; tes lengkap berisi 50 (21 menyimak, 21 membaca, 8 pilihan karakter). Ini adaptasi tes yang disediakan, bukan ujian sertifikasi resmi. Pilih mode di bawah.'),
      timestamp: new Date(),
      isAssessmentCard: true
    };
    setMessages((prev) => [...prev, launchMsg]);
  };

  // Called when student finishes 30s GForm Profile
  const handleOnboardingComplete = async (completedProfile: LeadProfile, selectedLang: 'en' | 'id' | 'zh') => {
    try { await registerContact(completedProfile); } catch (e) { alert((e as Error).message); return; }
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
      const greetingContent = selectedLang === 'en'
        ? `Hello **${studentName}**! Welcome to UPER Education! 🌟

Impressive! You already hold verified proficiency at **${reportedLevel}**. In accordance with UPER academic standards:
- ✅ **Diagnostic Status:** You **do not need to take basic placement tests**—your foundation is well-established!
- 🎯 **Recommended Track:** We directly tailor an accelerated HSK curriculum, university scholarship guidance, or enterprise career placement for you.

💡 *Tip: If you still wish to test your exact score today, feel free to click the **"Take HSK Test"** button at the top right corner or below.*

What would you like to explore regarding class schedules, tuition packages, or Chinese university scholarships?`
        : selectedLang === 'zh'
        ? `您好 **${studentName}**！欢迎来到 UPER Education！🌟

太棒了！您自报的中文基础是 **${reportedLevel}**。根据 UPER 教学规范：
- ✅ **测评状态：** 您**无需重复参加基础摸底测验**，基础非常清晰！
- 🎯 **推荐规划：** 我们直接为您对接高级进阶班排期、赴华奖学金名额或中资企业职场中文通道。

💡 *提示：如果您仍希望检验自己的实战得分，可随时点击右上角的 **【HSK 摸底测验】** 或下方快捷入口随时自测。*

关于近期的开班排期、课程学费或奖学金申请，您目前最想了解哪方面？`
        : `Halo **${studentName}**! Selamat datang di UPER Education! 🌟

Hebat sekali! Tingkat yang Anda laporkan adalah **${reportedLevel}**. Sesuai standar UPER:
- ✅ **Status Tes:** Anda **tidak perlu mengulang tes dasar**, fondasi Anda sudah sangat jelas!
- 🎯 **Rekomendasi:** Kami langsung menyusun jalur percepatan HSK lanjutan & persiapan karir perusahaan Tiongkok.

💡 *Tips: Jika Anda ingin menguji kemampuan nyata Anda hari ini, silakan klik tombol **"Ikuti Tes HSK"** di pojok kanan atas kapan saja.*`;

      const initialGreeting: ChatMessage = {
        id: 'msg-init-known',
        role: 'assistant',
        content: greetingContent,
        timestamp: new Date(),
        suggestedPrompts: selectedLang === 'zh' ? ['参加UPER分班诊断（自选）','学费和分期安排如何？','如何安排教师复核或试听？'] : selectedLang === 'en' ? [
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
        suggestedPrompts: selectedLang === 'zh' ? ['参加UPER分班诊断（自选）','学费和分期安排如何？','如何安排教师复核或试听？'] : selectedLang === 'en' ? [
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
      updatedProfile.tier=calculateLeadTier({buyingSignal:updatedProfile.buyingSignal,currentStatus:updatedProfile.currentStatus,goal:updatedProfile.goal,levelState:updatedProfile.levelState,city:updatedProfile.city,mode:updatedProfile.mode,hskExamPlan:updatedProfile.hskExamPlan,assessmentDone:true}).tier;
      setProfile(updatedProfile);
      saveStudentContext({leadProfile:updatedProfile,chatAssessmentStatus:'completed',assessment:{completed:true,result,score:result.score,total:result.maxScore,maxScore:result.maxScore,questionCount:result.questionCount,levelConfirmed:result.levelConfirmed,summary:result.summary,breakdown:result.breakdown,saveStatus:result.saveStatus,completedAt:result.attempt.completedAt}});
    }
    setMessages(prev=>[...prev.filter(m=>m.id!==`assessment-${result.attempt.attemptId}`),{id:`assessment-${result.attempt.attemptId}`,role:'assistant',content:result.summary,timestamp:new Date(),isAssessmentResult:true,assessmentData:result,
      suggestedPrompts:lang==='zh'?['哪些错题值得优先复习？','如何安排教师复核或试听？','适合我的课程什么时候开班？']:lang==='id'?['Soal salah mana yang perlu dipelajari dulu?','Bagaimana menjadwalkan peninjauan guru atau kelas percobaan?','Kapan kelas yang sesuai dimulai?']:['Which missed items should I review first?','How can I arrange a teacher review or trial lesson?','When does a suitable course start?']}]);
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
    if(!retry && (messageContent.includes('🎯') || messageContent.toLowerCase().includes('take official hsk') || messageContent.includes('参加UPER HSK 摸底测试'))){handleStartVoluntaryAssessment();return;}
    setInputValue('');setIsTyping(true);
    const userMessage:ChatMessage=retry || {id:crypto.randomUUID(),role:'user',content:messageContent,timestamp:new Date()};
    const botMessageId='reply-'+userMessage.id;
    setMessages(prev=>[...prev.filter(m=>m.id!==botMessageId && m.id!==userMessage.id),{...userMessage,delivery:'pending'},{id:botMessageId,role:'assistant',content:'',timestamp:new Date()}]);
    let reply='';
    try{
      const res=await chatFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[userMessage],isHumanMode:false,stream:true})},'standalone_chat');
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

  return (
    <div className="flex flex-col h-dvh bg-slate-100 text-slate-900 font-sans">
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
              <p className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-none">
                {profile ? profile.fullName : chooseText(lang,'课程咨询与分班参考','Course consultation and placement reference','Konsultasi kursus dan referensi penempatan')}
              </p>
            </div>
          </div>
        </div>

        )}
        {/* Right Action: Voluntary HSK Test, Language Switcher & WhatsApp Link */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Voluntary Assessment Quick Launcher Button */}
          {!isTakingAssessment && (
            <button
              type="button"
              onClick={handleStartVoluntaryAssessment}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-white" />
              <span>{lang === 'en' ? 'Take HSK Test' : lang === 'zh' ? 'HSK 摸底测验' : 'Ikuti Tes HSK'}</span>
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
            href="https://wa.me/6281116612062?text=Hello%20UPER%2C%20I%20am%20using%20the%20AI%20Advisory%20Portal%20and%20would%20like%20to%20speak%20with%20an%20academic%20consultant."
            target="_blank"
            rel="noopener noreferrer"
            aria-label={chooseText(lang,'通过WhatsApp联系顾问','Contact an advisor on WhatsApp','Hubungi konsultan via WhatsApp')}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{chooseText(lang,'联系顾问','Advisor','Konsultan')}</span>
          </a>}
        </div>
      </header>

      {/* Main Dialogue Scrollable Body */}
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
                {msg.isAssessmentResult && msg.assessmentData ? (
                  <div className="space-y-4">
                    <HskAssessmentReport result={msg.assessmentData} lang={lang} saving={savingReport} onRetry={()=>void retryReport(msg.assessmentData!)}/>
                    <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-primary-300 px-4 text-primary-700 font-semibold">{chooseText(lang,'主动联系顾问','Contact an advisor','Hubungi konsultan')}</a>
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
