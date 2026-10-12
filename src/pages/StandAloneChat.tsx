import { chatFetch, registerContact, restoreChat } from '../services/portalChat';
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
import HSKPlacementAssessment from '../components/HSKPlacementAssessment';
import { LeadProfile, calculateLeadTier } from '../types/leadSystem';
import { 
  getStudentContext, 
  getChatAssessmentStatus,
  saveStudentContext, 
  subscribeStudentContext 
} from '../services/studentProfileStorage';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestedPrompts?: string[];
  isAssessmentCard?: boolean;
  isAssessmentResult?: boolean;
  assessmentData?: {
    score: number;
    total: number;
    levelConfirmed: string;
    whatsapp?: string;
  };
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
  useEffect(() => { let active=true; restoreChat('standalone_chat').then(rows => { if(active && rows.length) setMessages(rows); }).catch(() => {}); return () => { active=false; }; }, []);
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

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isTakingAssessment]);

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
      content: lang === 'en'
        ? `🎯 **Official HSK Placement Diagnostic Activated!**

Below is our official HSK placement evaluation. You can choose either:
- **⚡ Express Seminar Mode (10 Questions, ~3 mins)**: Fast diagnostic for quick level confirmation.
- **📜 Full Official Exam (50 Questions, ~20 mins)**: 21 Listening, 21 Reading, and 8 Writing questions with official pass standards.

Please choose your mode and start below:`
        : lang === 'zh'
        ? `🎯 **已为您开启官方 HSK 能力摸底测评！**

系统已为您准备好真题测试卷，您可以选择：
- **⚡ 宣讲会精炼快测 (10 题 · 约 3 分钟)**：快速检测并定位当前 HSK 等级；
- **📜 完整官方 50 题试卷 (约 20 分钟)**：严格按真题评测卷 21 听力 + 21 阅读 + 8 书写进行诊断。

请在下方卡片中点击开始：`
        : `🎯 **Tes Penempatan HSK Resmi Diaktifkan!**

Silakan pilih mode tes di bawah ini (Mode Cepat 10 Soal atau Ujian Lengkap 50 Soal) untuk memulai:`,
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

*According to UPER and BLCU standards, accurate placement is essential so that classes are neither too demanding nor too basic. We have prepared an **Official HSK 1~3 Mixed Placement Diagnostic** for you below:*`
        : selectedLang === 'zh'
        ? `您好 **${studentName}**！欢迎来到 UPER 官方学术咨询中心。🌟

根据您的登记信息：
- 🎯 **学习目标：** ${goal}
- 📊 **自报基础：** ${reportedLevel} (需测评定级)

*为确保分班精准、避免课程过难或重复学习，我们已在下方为您开启 **官方 HSK 1~3 级混合摸底测试**：*`
        : `Halo **${studentName}**! Senang bertemu dengan Anda di sesi konsultasi UPER Education. 

Berdasarkan formulir Anda:
- 🎯 **Tujuan Belajar:** ${goal}
- 📊 **Tingkat Saat Ini:** ${reportedLevel} (Perlu verifikasi)

*Sesuai standar akademik UPER dan BLCU, kami telah mengaktifkan **Tes Penempatan HSK Resmi** untuk Anda di bawah ini:*`;

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

太棒了！您已具备 **${reportedLevel}** 的明确中文基础。根据 UPER 教学规范：
- ✅ **测评状态：** 您**无需重复参加基础摸底测验**，基础非常清晰！
- 🎯 **推荐规划：** 我们直接为您对接高级进阶班排期、赴华奖学金名额或中资企业职场中文通道。

💡 *提示：如果您仍希望检验自己的实战得分，可随时点击右上角的 **【HSK 摸底测验】** 或下方快捷入口随时自测。*

关于近期的开班排期、课程学费或奖学金申请，您目前最想了解哪方面？`
        : `Halo **${studentName}**! Selamat datang di UPER Education! 🌟

Hebat sekali! Anda telah memiliki sertifikasi/kemampuan **${reportedLevel}**. Sesuai standar UPER:
- ✅ **Status Tes:** Anda **tidak perlu mengulang tes dasar**, fondasi Anda sudah sangat jelas!
- 🎯 **Rekomendasi:** Kami langsung menyusun jalur percepatan HSK lanjutan & persiapan karir perusahaan Tiongkok.

💡 *Tips: Jika Anda ingin menguji kemampuan nyata Anda hari ini, silakan klik tombol **"Ikuti Tes HSK"** di pojok kanan atas kapan saja.*`;

      const initialGreeting: ChatMessage = {
        id: 'msg-init-known',
        role: 'assistant',
        content: greetingContent,
        timestamp: new Date(),
        suggestedPrompts: selectedLang === 'en' ? [
          '🎯 Take Official HSK Placement Test (Optional)',
          'What are the course fees and available installment plans?',
          'When are the nearest class start dates for my level?'
        ] : [
          '🎯 参加官方 HSK 摸底测试 (自测)',
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
- **Diagnostic Status:** Mandatory placement testing waived (Zero baseline confirmed).
- **Recommended Program:** **HSK 1 Starter & Practical Conversation Track** (Comprehensive Pinyin system, tones, and 150 core high-frequency vocabulary).

*Optional: If you would like to preview authentic exam audio, feel free to click **"Take HSK Test"** at the top right anytime.*

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
        suggestedPrompts: selectedLang === 'en' ? [
          '🎯 Take Official HSK Placement Test (Optional)',
          'How long does it take from zero to conversational fluency?',
          'What are the tuition fees and schedules for HSK 1 beginner classes?'
        ] : [
          '🎯 参加官方 HSK 摸底测试 (自测)',
          'Berapa lama belajar dari nol hingga bisa bicara lancar?',
          'Berapa biaya dan jadwal kelas pemula HSK 1?'
        ]
      };
      setMessages([initialGreeting]);

    }
  };

  // Called when HSK Placement Quiz completes
  const handleAssessmentComplete = (result: {
    score: number;
    total: number;
    levelConfirmed: string;
    summary: string;
    breakdown?: {
      hsk1Correct: number;
      hsk1Total: number;
      hsk2Correct: number;
      hsk2Total: number;
      hsk3Correct: number;
      hsk3Total: number;
    };
  }) => {
    setIsTakingAssessment(false);

    if (profile) {
      const updatedProfile: LeadProfile = {
        ...profile,
        quizScore: result.score,
        totalQuestions: result.total,
        levelConfirmed: result.levelConfirmed,
        levelSource: 'mixed',
        quizResultSummary: result.summary,
        quizBreakdown: result.breakdown
      };

      // Recalculate Tier with assessment done (R5 rule)
      const recalculated = calculateLeadTier({
        buyingSignal: updatedProfile.buyingSignal,
        currentStatus: updatedProfile.currentStatus,
        goal: updatedProfile.goal,
        levelState: updatedProfile.levelState,
        city: updatedProfile.city,
        mode: updatedProfile.mode,
        hskExamPlan: updatedProfile.hskExamPlan,
        assessmentDone: true
      });
      updatedProfile.tier = recalculated.tier;
      setProfile(updatedProfile);
      syncLeadToBackend(updatedProfile).catch(e => alert(e.message));

      // Save assessment state into unified student context
      saveStudentContext({
        leadProfile: updatedProfile,
        chatAssessmentStatus: 'completed',
        assessment: {
          completed: true,
          score: result.score,
          total: result.total,
          levelConfirmed: result.levelConfirmed,
          summary: result.summary,
          breakdown: result.breakdown,
          completedAt: new Date().toISOString()
        }
      });
    }

    const resultContent = lang === 'en'
      ? `🎉 **Your HSK Diagnostic Assessment Results Are Ready!**

- 🏆 **Your Score:** ${result.score} / ${result.total} Correct
- 📜 **Confirmed Official Level:** **${result.levelConfirmed}**

### 💡 Diagnostic Analysis & Recommendation
${result.summary}

Your complete assessment report has been securely logged in UPER's academic system. Our advisory team will also send the course syllabus, HSK vocabulary guide, and schedule to your WhatsApp (**${profile?.whatsapp}**).

Feel free to ask me anything now!`
      : lang === 'zh'
      ? `🎉 **您的 HSK 摸底能力测评报告已生成！**

- 🏆 **测试得分：** ${result.score} / ${result.total} 题正确
- 📜 **官方测评定级：** **${result.levelConfirmed}**

### 💡 综合能力诊断与分班建议
${result.summary}

您的完整测评数据与学生画像已归档至 UPER 教学系统。规划顾问也可通过 WhatsApp（**${profile?.whatsapp}**）为您发送详细课程大纲与排期优惠方案。

您现在可以直接向我提问！`
      : `🎉 **Hasil Tes Diagnostik HSK Anda Telah Keluar!**

- 🏆 **Skor Anda:** ${result.score} / ${result.total} Benar
- 📜 **Estimasi Level Resmi:** **${result.levelConfirmed}**

### 💡 Analisis Kemampuan & Rekomendasi
${result.summary}

Laporan lengkap dan silabus kelas telah dicatat di sistem UPER. Tim konsultan akademik kami juga dapat mengirimkan modul kosakata dan jadwal kelas via WhatsApp ke nomor Anda (**${profile?.whatsapp}**).

Silakan tanyakan apa saja kepada saya sekarang!`;

    const assessmentResultMsg: ChatMessage = {
      id: `msg-eval-${Date.now()}`,
      role: 'assistant',
      content: result.summary,
      timestamp: new Date(),
      isAssessmentResult: true,
      assessmentData: {
        score: result.score,
        total: result.total,
        levelConfirmed: result.levelConfirmed,
        whatsapp: profile?.whatsapp
      },
      suggestedPrompts: lang === 'en' ? [
        'When is the nearest start date for my recommended class?',
        'What are the course tuition fees and seminar promotional discounts?',
        'Can I schedule an in-person consultation at UPER Jakarta Campus?'
      ] : [
        'Kapan tanggal mulai kelas terdekat untuk level saya?',
        'Berapa biaya kursus dan apakah ada promo seminar hari ini?',
        'Apakah bisa konsultasi tatap muka langsung di kampus UPER Jakarta?'
      ]
    };

    setMessages((prev) => [...prev, assessmentResultMsg]);
  };

  // Send message to DeepSeek backend
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputValue).trim();
    if (!messageContent || isTyping) return;

    // Direct interception for voluntary placement assessment trigger
    if (
      messageContent.includes('🎯') || 
      messageContent.toLowerCase().includes('take official hsk') || 
      messageContent.includes('参加官方 HSK 摸底测试')
    ) {
      handleStartVoluntaryAssessment();
      return;
    }

    setInputValue('');

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const currentContext = getStudentContext();
      const messagesHistory = [
        ...messages.filter(m => m.role !== 'system').map(m => ({ id: m.id, role: m.role, content: m.content })),
        { id: userMessage.id, role: 'user', content: messageContent }
      ];

      const botMessageId = `msg-${Date.now() + 1}`;
      const botPlaceholder: ChatMessage = {
        id: botMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botPlaceholder]);

      const res = await chatFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesHistory,
          studentContext: currentContext || (profile ? { leadProfile: profile } : undefined),
          isHumanMode: false,
          stream: true
        })
      }, 'standalone_chat');

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`);
      }

      let accumulatedReply = '';
      let suggested: string[] = [];

      if (res.body && res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let streamBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.reset) {
                accumulatedReply = '';
                suggested = [];
                setMessages((prev) => prev.map((m) => m.id === botMessageId ? { ...m, content: '', suggestedPrompts: [] } : m));
              }
              if (parsed.chunk) {
                accumulatedReply += parsed.chunk;
                setMessages((prev) =>
                  prev.map((m) => (m.id === botMessageId ? { ...m, content: accumulatedReply } : m))
                );
              }
              if (parsed.done) {
                if (Array.isArray(parsed.suggestedPrompts)) {
                  suggested = parsed.suggestedPrompts;
                }
                if (parsed.reply && !accumulatedReply) {
                  accumulatedReply = parsed.reply;
                }
              }
            } catch (_) {}
          }
        }
      } else {
        const data = await res.json();
        accumulatedReply = data.reply || (
          lang === 'en' 
            ? 'Sorry, the system is processing your inquiry. Please try asking again.' 
            : 'Maaf, sistem sedang memproses informasi. Silakan ulangi pertanyaan Anda.'
        );
        suggested = Array.isArray(data.suggestedPrompts) ? data.suggestedPrompts : [];
      }

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === botMessageId
            ? { ...m, content: accumulatedReply || '...', suggestedPrompts: suggested }
            : m
        );
        syncChatTranscript(profile, next);
        return next;
      });
    } catch (err) {
      console.error('[CHAT ERROR]', err);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: lang === 'en'
          ? 'Network connectivity blip. You can also directly connect with our official academic advisor via WhatsApp at **+62 811-1661-2062**.'
          : 'Terjadi sedikit kendala jaringan. Anda juga dapat langsung menghubungi konsultan resmi kami via WhatsApp di nomor **+62 811-1661-2062**.',
        timestamp: new Date()
      };
      setMessages((prev) => {
        const next = [...prev, errorMessage];
        syncChatTranscript(profile, next);
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Onboarding Profile Modal (GForm First) */}
      <GFormOnboardingModal
        isOpen={showOnboardingModal}
        onComplete={handleOnboardingComplete}
        initialLang={lang}
      />

      {/* Standalone Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white py-3 px-4 sm:px-6 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Return to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-tech-500 flex items-center justify-center font-bold text-white shadow-sm shadow-primary-500/30 text-sm">
              UP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">UPER AI Smart Advisory</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-none">
                {profile ? `${profile.fullName} · ${profile.goal}` : 'Academic Consultation & HSK Placement Portal'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Action: Voluntary HSK Test, Language Switcher & WhatsApp Link */}
        <div className="flex items-center gap-2">
          {/* Voluntary Assessment Quick Launcher Button */}
          {!isTakingAssessment && (
            <button
              type="button"
              onClick={handleStartVoluntaryAssessment}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
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
              className={`px-2 py-0.5 rounded-full transition-all font-semibold ${
                lang === 'en' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => changeLanguage('id')}
              className={`px-2 py-0.5 rounded-full transition-all font-semibold ${
                lang === 'id' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => changeLanguage('zh')}
              className={`px-2 py-0.5 rounded-full transition-all font-semibold ${
                lang === 'zh' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              中文
            </button>
          </div>

          <a
            href="https://wa.me/6281116612062?text=Hello%20UPER%2C%20I%20am%20using%20the%20AI%20Advisory%20Portal%20and%20would%20like%20to%20speak%20with%20an%20academic%20consultant."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden xs:inline">WhatsApp Advisor</span>
          </a>
        </div>
      </header>

      {/* Main Dialogue Scrollable Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl w-full mx-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
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
                  <div className="space-y-3.5">
                    {/* Header: Confirmed Level Badge & Score */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600">
                          {lang === 'en' ? 'Diagnostic Result' : lang === 'zh' ? '测评诊断结果' : 'Hasil Diagnostik'}
                        </span>
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                          {msg.assessmentData.levelConfirmed}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {lang === 'en' ? 'Score' : lang === 'zh' ? '测试得分' : 'Skor Resmi'}
                        </span>
                        <span className="text-base font-black font-mono text-primary-700">
                          {msg.assessmentData.score} <span className="text-xs font-normal text-slate-400">/ {msg.assessmentData.total}</span>
                        </span>
                      </div>
                    </div>

                    {/* Recommendation & Breakdown with breathing room */}
                    <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed prose-p:my-1.5 prose-ul:my-1.5">
                      <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                    </div>

                    {/* Separate Dedicated Bottom CTA Card */}
                    <div className="mt-3 p-3.5 bg-emerald-50/90 rounded-2xl border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 text-xs">
                          <p className="font-bold text-emerald-950">
                            {lang === 'en' ? 'Report Logged · Advisor Follow-up' : lang === 'zh' ? '报告已归档 · 顾问专属跟进' : 'Laporan Tersimpan & Konsultasi WA'}
                          </p>
                          <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                            {lang === 'en' 
                              ? `Syllabus and discount plan will be sent to WhatsApp (${msg.assessmentData.whatsapp || '+62...'}).`
                              : lang === 'zh'
                              ? `课程大纲与排期优惠将同步发送至 WhatsApp（${msg.assessmentData.whatsapp || '您的号码'}）。`
                              : `Silabus dan jadwal kelas akan dikirim via WhatsApp (${msg.assessmentData.whatsapp || 'nomor Anda'}).`}
                          </p>
                        </div>
                      </div>

                      <a
                        href={`https://wa.me/6281116612062?text=${encodeURIComponent(`Hello UPER, I have completed the HSK assessment (Score: ${msg.assessmentData.score}/${msg.assessmentData.total}, Level: ${msg.assessmentData.levelConfirmed}). I would like to consult with an academic advisor.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{lang === 'en' ? 'Chat on WhatsApp' : lang === 'zh' ? '联系学术顾问' : 'Chat Konsultan'}</span>
                      </a>
                    </div>

                    {/* P3: 针对该定级的专属导师 1对1 直达连线通道 */}
                    <div className="mt-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                          <span>{lang === 'en' ? 'Connect with Expert Specialists' : lang === 'zh' ? '针对您的定级 · 专属名师 1对1 答疑通道' : 'Hubungi Konsultan Spesialis'}</span>
                        </span>
                        <span className="text-[10px] text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-semibold border border-primary-100">
                          {lang === 'en' ? 'Click to Consult' : lang === 'zh' ? '点击即刻连线' : 'Tanya Sekarang'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'lili', name: lang === 'zh' ? '莉莉老师' : 'Teacher Lili', role: lang === 'zh' ? 'HSK 语言专家' : 'HSK Specialist', prompt: lang === 'zh' ? `我想请教莉莉老师：根据我的 ${msg.assessmentData.levelConfirmed} 测评成绩，推荐报读什么班型与排期？` : `Question for Teacher Lili: Based on my ${msg.assessmentData.levelConfirmed} score, which course fits me best?` },
                          { id: 'jason', name: lang === 'zh' ? '杰森老师' : 'Coach Jason', role: lang === 'zh' ? 'CSCA 备考教练' : 'CSCA Coach', prompt: lang === 'zh' ? `我想请教杰森老师：我的成绩冲刺中国顶尖大学（如清华/交大），CSCA 课程如何规划？` : `Question for Coach Jason: How to plan CSCA prep for top China universities with my profile?` },
                          { id: 'sarah', name: lang === 'zh' ? '萨拉老师' : 'Sarah', role: lang === 'zh' ? '奖学金顾问' : 'Scholarship Advisor', prompt: lang === 'zh' ? `我想请教萨拉老师：以我目前基础，能申请哪些中国大学全额奖学金？` : `Question for Sarah: What full scholarships can I target in China right now?` },
                          { id: 'kevin', name: lang === 'zh' ? '凯文老师' : 'Kevin', role: lang === 'zh' ? '研学营总监' : 'Study Tour Director', prompt: lang === 'zh' ? `我想请教凯文老师：近期前往北京/上海名校研学营的具体排期与报名条件？` : `Question for Kevin: What are the schedules and criteria for China study tours?` }
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSendMessage(c.prompt)}
                            className="p-2.5 bg-white hover:bg-primary-50/70 border border-slate-200/90 hover:border-primary-300 rounded-xl text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
                          >
                            <p className="font-bold text-xs text-slate-900 group-hover:text-primary-700">{c.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{c.role}</p>
                          </button>
                        ))}
                      </div>

                      {/* 全站数据互通感知提示 */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{lang === 'zh' ? '测评报告已同步至首页右下角 AI 顾问，全站任意页面均可继续沟通' : 'Profile synced with Homepage AI Assistant across all pages'}</span>
                        </span>
                        <Link to="/" className="text-primary-600 hover:underline font-semibold flex items-center gap-0.5">
                          <span>{lang === 'zh' ? '返回首页' : 'Home'}</span>
                          <span aria-hidden="true">&rarr;</span>
                        </Link>
                      </div>
                    </div>
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
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pl-10">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>
              {lang === 'en' 
                ? 'UPER AI is crafting your official academic response...' 
                : lang === 'zh'
                ? 'UPER AI 正在生成专属解答与规划...'
                : 'UPER AI sedang mengetik jawaban resmi...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Bottom Sticky Input */}
      <footer className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0">
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
                ? (lang === 'en' ? 'Please complete the diagnostic questions above first...' : 'Selesaikan soal HSK di atas terlebih dahulu...') 
                : (lang === 'en' ? 'Type your question about courses, HSK preparation, or scholarships...' : 'Ketik pertanyaan Anda seputar kursus, HSK, atau beasiswa...')
            }
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTakingAssessment || isTyping}
            className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl shadow-md shadow-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
