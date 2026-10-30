import {RegistrationSaveError,registrationSaveText} from '../services/registrationSave';
import type {ChatRequestAction} from '../utils/chatRequestIntent';
import {visitorKey} from '../services/visitorScope';
import {validContactEmail, contactEmailText, CONTACT_EMAIL_ERROR} from "../utils/contactEmail";
import {validContactPhone, contactPhoneText, CONTACT_PHONE_ERROR} from "../utils/contactPhone";
import { safeHskResult } from "../data/hskReportHistory";
import {draft,deliveryText,type Delivery} from "../services/chatDelivery";
import HskAssessmentReport from './HskAssessmentReport';
import {chooseText} from '../data/hskAssessment';
import { chatFetch, registerContact, restoreChat, finishChat } from '../services/portalChat';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles, Languages, HelpCircle, Loader2, ArrowUpRight, MessageCircle, RotateCcw, Bot, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { trackChatbotInteraction, trackFormSubmit } from '../utils/analytics';
import { useDesignStyle } from '../utils/theme';
import { 
  getStudentContext, 
  saveStudentContext, 
  clearStudentContext, 
  subscribeStudentContext,
  type UnifiedStudentContext 
} from '../services/studentProfileStorage';

interface Message {
  delivery?: Delivery;
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isComplete?: boolean;
}

const RenderMarkdown = ({ content }: { content: string }) => (
  <Markdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => <h1 className="text-base font-extrabold mt-3 mb-1.5 text-slate-900 border-b border-slate-100 pb-0.5">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-bold mt-2.5 mb-1.5 text-slate-800">{children}</h2>,
      h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-slate-800">{children}</h3>,
      h4: ({ children }) => <h4 className="text-xs font-bold mt-1.5 mb-1 text-slate-800">{children}</h4>,
      p: ({ children }) => <p className="mb-2 last:mb-0 text-slate-700 leading-relaxed">{children}</p>,
      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-1 text-slate-700">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-1 text-slate-700">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
      a: ({ href, children }) => (
        <a 
          href={href || ''} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary-600 hover:text-primary-700 underline font-medium inline-flex items-center gap-0.5 decoration-primary-300"
        >
          {children}
        </a>
      ),
      blockquote: ({ children }) => <blockquote className="border-l-2 border-primary-200 pl-2.5 italic text-slate-500 my-1">{children}</blockquote>,
    }}
  >
    {content}
  </Markdown>
);

interface TypewriterTextProps {
  text: string;
  speed?: number;
  isHuman?: boolean;
  onComplete?: () => void;
  onUpdate?: () => void;
}

function TypewriterText({ text, speed = 10, isHuman = false, onComplete, onUpdate }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    let currentIdx = 0;
    
    // Determine if this is a pre-prepared large block of information (copy-paste simulation)
    const len = text.length;
    const hasMarkdownLists = (text.match(/^[\s*-+•\d+\.]/gm) || []).length >= 2;
    const hasHeaders = text.includes('#') || text.includes('**');
    const hasUrlsOrContacts = text.includes('http') || text.includes('+62') || text.includes('@uper');
    const isCopyPaste = isHuman && (len > 220 || (len > 120 && (hasMarkdownLists || hasHeaders || hasUrlsOrContacts)));

    // Copy-pasted templates render super fast. Normal messages have standard stroke speed (~25-35ms).
    const typingInterval = isCopyPaste ? 3 : (isHuman ? 30 : speed);

    const interval = setInterval(() => {
      if (currentIdx < text.length) {
        let increment = 1;
        if (isCopyPaste) {
          // Copy-paste renders several characters per brief tick to simulate immediate chunk paste
          const remaining = text.length - currentIdx;
          increment = remaining > 200 ? 15 : remaining > 80 ? 8 : 4;
        } else if (!isHuman) {
          const remaining = text.length - currentIdx;
          // Speeds up incrementally for long automated texts
          increment = remaining > 300 ? 5 : remaining > 150 ? 3 : 1;
        }
        currentIdx = Math.min(currentIdx + increment, text.length);
        setDisplayed(text.substring(0, currentIdx));
        onUpdate?.();
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, typingInterval);

    return () => clearInterval(interval);
  }, [text, speed, isHuman]);

  return <RenderMarkdown content={displayed} />;
}

interface Counselor {
  id: string;
  name: string;
  nameCn: string;
  avatarChar: string;
  gradient: string;
  role: { zh: string; en: string; id: string };
  desc: { zh: string; en: string; id: string };
}

const UPER_COUNSELORS: Counselor[] = [
  {
    id: 'scholarship',
    name: 'Sarah',
    nameCn: 'Sarah 老师',
    avatarChar: 'S',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    role: {
      zh: '留学规划与全额奖学金专家',
      en: 'Senior Study Abroad & Scholarship Advisor',
      id: 'Konsultan Utama Beasiswa & Pendidikan China'
    },
    desc: {
      zh: '6年+背景提升、择校及奖学金专项规划经验，本硕毕业于著名中国大学等。',
      en: '6+ years in study profiling, background upgrade, and full scholarship awards matches.',
      id: 'Pengalaman 6+ tahun memandu ratusan siswa lolos beasiswa penuh di kampus terbaik.'
    },

  },
  {
    id: 'hsk',
    name: 'Lili',
    nameCn: '莉莉老师',
    avatarChar: 'L',
    gradient: 'from-rose-500 via-pink-500 to-red-500',
    role: {
      zh: '雅加达校区 HSK 语言教研总监',
      en: 'HSK Placement & Curriculum Chief',
      id: 'Direktur Pelatihan Bahasa & HSK'
    },
    desc: {
      zh: '8年+印尼学生汉语教学经验，持有标准国际中文教师证书(TCSOL)，精通考前纠错。',
      en: '8+ years teaching Chinese. Certified TCSOL tutor. Expert in Indonesian accent diagnostics.',
      id: '8+ tahun mengajar Mandarin. Pemegang TCSOL. Pakar pelafalan & persiapan ujian HSK.'
    },

  },
  {
    id: 'csca',
    name: 'Mr. Jason',
    nameCn: '杰森老师',
    avatarChar: 'J',
    gradient: 'from-sky-500 via-blue-600 to-indigo-700',
    role: {
      zh: 'CSCA 学术考前辅导总教练',
      en: 'CSCA Entrance Coaching Chief Coach',
      id: 'Kepala Pembimbing Ujian CSCA Jakarta'
    },
    desc: {
      zh: '10年拔尖学术辅导经历，帮助印尼众多名校学子成功考取清华、交大等顶尖名校数理类专业。',
      en: '10 years analytical coaching. Guided Binus/Ipeka/JNY students to crack Tsinghua/SJTU STEM test requirements.',
      id: 'Analis akademik 10 tahun. Membimbing siswa sekolah unggulan lolos tes masuk universitas C9 China.'
    },

  },
  {
    id: 'camp',
    name: 'Kevin',
    nameCn: '凯文老师',
    avatarChar: 'K',
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    role: {
      zh: '国际研学游学与研学营项目总监',
      en: 'International Camps & Study Tour Director',
      id: 'Direktur Program Global Study Tour China'
    },
    desc: {
      zh: '成功组织过20+期前往北京、上海、杭州、深圳的国际游学，擅长深度沉浸式跨国参访规划。',
      en: 'Led 20+ successful group tours to major Chinese tech hubs. Expert in tech enterprise and safety logistics.',
      id: 'Berhasil memimpin 20+ kali kunjungan study tour ke Beijing, Shanghai, Shenzhen. Pakar keselamatan.'
    },

  }
];

const detectBestCounselorId = (history: Message[], formInterestStr?: string, currentText?: string): string | null => {
  let scoreHSK = 0;
  let scoreCSCA = 0;
  let scoreCamp = 0;
  let scoreScholarship = 0;

  const hskKeywords = /hsk|汉语|中文|语言|class|bahasa|mandarin|kursus|belajar|tingkat|level|speak|vocabulary|lili|教材|雅加达PIK|PIK campus/i;
  const cscaKeywords = /csca|考前|辅导|ujian|bimbel|matematika|sains|physics|chemistry|math|entrance|penyelarasan|akademik|seleksi|jason|笔试|大纲|数学|物理|化学|C9/i;
  const campKeywords = /camp|游学|研学|tour|winter|summer|trip|kunjungan|jalan|holiday|kevin|大厂|研学营|冬令营|夏令营|带队|Alibaba|Tencent/i;
  const scholarshipKeywords = /scholarship|奖学金|beasiswa|full|S1|S2|S3|kuliah|degree|master|bachelor|phd|tsinghua|pku|fudan|sarah|留学|选校|申请|中国/i;

  const checkText = (txt: string) => {
    if (hskKeywords.test(txt)) scoreHSK += 1;
    if (cscaKeywords.test(txt)) scoreCSCA += 1;
    if (campKeywords.test(txt)) scoreCamp += 1;
    if (scholarshipKeywords.test(txt)) scoreScholarship += 1;
  };

  // 1. Scan previous conversation messages
  history.forEach((m) => {
    if (m.content) {
      checkText(m.content);
    }
  });

  // 2. Scan current user lead selection/interest with high priority
  if (formInterestStr) {
    if (/HSK|Bahasa|中文|语言/i.test(formInterestStr)) scoreHSK += 5;
    if (/CSCA|Bimbingan|辅导|考试|Ujian/i.test(formInterestStr)) scoreCSCA += 5;
    if (/Study Tour|Camp|游学|研学/i.test(formInterestStr)) scoreCamp += 5;
    if (/Scholarship|Beasiswa|留学/i.test(formInterestStr)) scoreScholarship += 5;
  }

  // 3. Scan the current query if passed
  if (currentText) {
    if (hskKeywords.test(currentText)) scoreHSK += 4;
    if (cscaKeywords.test(currentText)) scoreCSCA += 4;
    if (campKeywords.test(currentText)) scoreCamp += 4;
    if (scholarshipKeywords.test(currentText)) scoreScholarship += 4;
  }

  // Find max score
  const max = Math.max(scoreHSK, scoreCSCA, scoreCamp, scoreScholarship);
  if (max === 0) {
    return null; // Return null to indicate "unknown project"
  }

  if (max === scoreHSK) return 'hsk';
  if (max === scoreCSCA) return 'csca';
  if (max === scoreCamp) return 'camp';
  return 'scholarship';
};

export default function AIChatbot() {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  useEffect(() => { let active=true; restoreChat('homepage_widget').then(rows => { if(active && rows.length) setMessages(rows); }).catch(() => {}); return () => { active=false; }; }, []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const sendingRef = useRef(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  
  // Custom states for UPER consultant lead capture form
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const formPhoneRef = useRef<HTMLInputElement>(null);
  const [formPhoneTouched, setFormPhoneTouched] = useState(false);
  const [formPhoneRejected, setFormPhoneRejected] = useState(false);
  const formPhoneInvalid = formPhoneRejected || (formPhoneTouched && !validContactPhone(formPhone));

  const [formEmail, setFormEmail] = useState('');
  const formEmailRef = useRef<HTMLInputElement>(null);
  const [formEmailTouched, setFormEmailTouched] = useState(false);
  const [formEmailRejected, setFormEmailRejected] = useState(false);
  const formEmailInvalid = formEmailRejected || (formEmailTouched && !validContactEmail(formEmail));
  const [formInterest, setFormInterest] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [pendingLeadData, setPendingLeadData] = useState<{
    fullName: string;
    phone: string;
    email: string;
    interest: string;
  } | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem(visitorKey('uper_pending_lead'));
        return stored ? JSON.parse(stored) : null;
      }
    } catch (_) {}
    return null;
  });

  const pendingLeadDataRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    pendingLeadDataRef.current = pendingLeadData;
    try {
      if (typeof window !== 'undefined') {
        if (pendingLeadData) {
          sessionStorage.setItem(visitorKey('uper_pending_lead'), JSON.stringify(pendingLeadData));
        } else {
          sessionStorage.removeItem(visitorKey('uper_pending_lead'));
        }
      }
    } catch (_) {}
  }, [pendingLeadData]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [studentContext, setStudentContext] = useState<UnifiedStudentContext | null>(() => getStudentContext());
  const [showAssessmentCard, setShowAssessmentCard] = useState<boolean>(false);

  const [leadSubmitted, setLeadSubmitted] = useState<boolean>(() => {
    try {
      const ctx = getStudentContext();
      if (ctx?.leadProfile) return true;
      return typeof window !== 'undefined' && sessionStorage.getItem(visitorKey('uper_lead_submitted')) === 'true';
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    const unsubscribe = subscribeStudentContext((ctx) => {
      setStudentContext(ctx);
      if (ctx?.leadProfile) {
        setLeadSubmitted(true);
      }
    });
    return unsubscribe;
  }, []);

  const [isHumanMode, setIsHumanMode] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem(visitorKey('uper_chat_human_mode')) === 'true';
    } catch (_) {
      return false;
    }
  });

  const [switchingStep, setSwitchingStep] = useState<string>('');

  const [activeModelUsed, setActiveModelUsed] = useState<string>('gpt-4o');

  useEffect(() => {
    fetch('/api/ai-model-info')
      .then(res => res.json())
      .then(data => {
        if (data && data.activeModel) {
          setActiveModelUsed(data.activeModel);
        }
      })
      .catch(() => {});
  }, []);

  const formatModelName = (modelName: string) => {
    if (!modelName) return 'GPT-6 Luna';
    const lower = modelName.toLowerCase();
    if (lower.includes('gpt-6-luna') || lower.includes('luna')) return 'GPT-6 Luna';
    if (lower.includes('gpt-4o-mini')) return 'GPT-4o-mini';
    if (lower.includes('gpt-4o')) return 'GPT-4o';
    if (lower.includes('deepseek')) return 'DeepSeek-V3';
    return modelName;
  };

  const [activeCounselorId, setActiveCounselorId] = useState<string>(() => {
    try {
      return (typeof window !== 'undefined' && sessionStorage.getItem(visitorKey('uper_chat_counselor_id'))) || 'scholarship';
    } catch (_) {
      return 'scholarship';
    }
  });

  const getCurrentCounselor = (): Counselor => {
    return UPER_COUNSELORS.find((c) => c.id === activeCounselorId) || UPER_COUNSELORS[0];
  };

  const toggleCounselor = (id: string, notify = true) => {
    setActiveCounselorId(id);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(visitorKey('uper_chat_counselor_id'), id);
      }
    } catch (_) {}

    if(notify)toggleHumanMode(false);
  };

  const toggleHumanMode = (val: boolean) => {
    setIsHumanMode(val);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(visitorKey('uper_chat_human_mode'), String(val));
      }
    } catch (_) {}
  };

  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [chatWidth, setChatWidth] = useState<number>(630);
  const [chatHeight, setChatHeight] = useState<number>(620);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(min-width: 768px)');
      setIsDesktop(media.matches);
      const listener = (e: MediaQueryListEvent) => {
        setIsDesktop(e.matches);
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  const startResize = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    direction: 'left' | 'top' | 'both'
  ) => {
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const initialWidth = chatWidth;
    const initialHeight = chatHeight;
    const startX = clientX;
    const startY = clientY;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      if (direction === 'left' || direction === 'both') {
        const newWidth = Math.max(340, Math.min(window.innerWidth - 48, initialWidth - deltaX));
        setChatWidth(newWidth);
      }

      if (direction === 'top' || direction === 'both') {
        const newHeight = Math.max(380, Math.min(window.innerHeight - 120, initialHeight - deltaY));
        setChatHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentLang = i18n.language || 'id';
  const phoneText = contactPhoneText(currentLang);
  const emailText = contactEmailText(currentLang);

  // Trigger auto-focus whenever the chat window is opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 250);
    }
  }, [isOpen]);

  // Starter prompts by language
  const starterPrompts: Record<string, string[]> = {
    id: [
      'Bagaimana cara apply beasiswa ke China? 🇨🇳',
      'Apa keunggulan kursus HSK di UPER? 📚',
      'Apa itu kelas CSCA (Academic Insurance)? 🔬',
      'Kapan program Study Tour berikutnya? ✈️',
      'Apakah ada lowongan kerja di UPER? 💼',
    ],
    zh: [
      '如何申请去中国留学的奖学金？🇨🇳',
      'UPER的HSK中文培训有什么特色？📚',
      '什么是CSCA辅导（学术保险项目）？🔬',
      '下一次中国研学游学营是什么时候？✈️',
      'UPER目前有什么招聘岗位吗？💼',
    ],
    en: [
      'How to apply for scholarships to China? 🇨🇳',
      'What are UPER\'s HSK training advantages? 📚',
      'What is CSCA coaching (Academic Insurance)? 🔬',
      'When is the next China Study Tour? ✈️',
      'Are there any open job positions at UPER? 💼',
    ],
  };

  const getStarterPrompts = () => {
    const ctx = studentContext || getStudentContext();
    if (ctx?.assessment?.completed) {
      const level = safeHskResult(ctx.assessment.result,currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id')?.levelConfirmed || chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id','历史结果（未核验）','Legacy result (unverified)','Hasil lama (belum diverifikasi)');
      if (currentLang.startsWith('zh')) {
        return [
          `针对我报告中的 ${level}，有哪些推荐班型与开班时间？`,
          `达到中国顶尖名校（C9/双一流）申请要求还需要多久？`,
          `如何预约雅加达校区 1 对 1 专家试听与答疑？`,
          `UPER 的奖学金申请保录取计划具体是怎样的？`,
        ];
      }
      if (currentLang.startsWith('en')) {
        return [
          `What class schedules are recommended for my diagnostic ${level}?`,
          `How long does it take to qualify for top C9 university scholarships?`,
          `How can I book a 1-on-1 expert consultation at UPER Jakarta?`,
          `What are the terms of UPER's Scholarship Guarantee Program?`,
        ];
      }
      return [
        `Apa jadwal kelas yang direkomendasikan untuk level ${level} saya?`,
        `Berapa lama persiapan agar memenuhi syarat beasiswa universitas C9?`,
        `Bagaimana cara menjadwalkan konsultasi 1-on-1 di kampus UPER Jakarta?`,
        `Bagaimana skema program jaminan beasiswa UPER?`,
      ];
    }

    if (currentLang.startsWith('zh')) return starterPrompts.zh;
    if (currentLang.startsWith('en')) return starterPrompts.en;
    return starterPrompts.id; // Indonesian default
  };

  const getGreeting = () => {
    const ctx = studentContext || getStudentContext();
    if (ctx?.assessment?.completed) {
      const name = ctx.leadProfile?.fullName || (currentLang.startsWith('zh') ? '同学' : 'there');
      if(!ctx.assessment.result) return chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id','检测到历史测评记录，但缺少作答、版本和明确分值单位，尚未核验。建议重新测评或请教师复核。','A legacy assessment record was found, but answers, version and score units are missing. It is unverified; take a new assessment or request teacher review.','Ditemukan hasil tes lama tanpa jawaban, versi dan satuan nilai yang jelas. Hasil belum diverifikasi; ikuti tes baru atau minta peninjauan guru.');
      const observed=safeHskResult(ctx.assessment.result,currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id');
      if (!observed) return chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id','检测到历史报告，但其版本或作答记录暂不可复核。原记录保留，可重新测评或联系教师核对。','A historical report is retained, but its version or answers cannot currently be reviewed. Take a new assessment or ask a teacher to review it.','Laporan lama dipertahankan, tetapi versi atau jawabannya belum dapat ditinjau. Ikuti tes baru atau minta guru meninjaunya.');
      const score=observed.score;
      const total=observed.maxScore;
      return chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id',
        `欢迎回来，${name}！您有一份UPER分班参考报告（${score}/${total}分）。请查看报告的保存状态与测评范围；可继续讨论复习或教师复核。`,
        `Welcome back, ${name}! You have a UPER placement reference report (${score}/${total} points). Check its save status and scope; we can discuss review or a teacher assessment.`,
        `Selamat datang kembali, ${name}! Ada laporan referensi penempatan UPER (${score}/${total} poin). Periksa status penyimpanan dan cakupan tes; kita dapat membahas belajar ulang atau peninjauan guru.`);

    }

    if (ctx?.leadProfile) {
      const name = ctx.leadProfile.fullName || 'there';
      const goal = ctx.leadProfile.goal || '';
      if (currentLang.startsWith('zh')) {
        return `🎉 欢迎回来，**${name}**！已同步您的学术档案${goal ? `（目标方向：**${goal}**）` : ''}。请问有什么具体的升学、选校或课程规划问题我可以帮您解答？`;
      }
      if (currentLang.startsWith('en')) {
        return `🎉 Welcome back, **${name}**! Your academic profile has been synchronized${goal ? ` (Goal: **${goal}**)` : ''}. How may I assist you with your admissions or study planning today?`;
      }
      return `🎉 Selamat datang kembali, **${name}**! Profil akademik Anda telah tersinkronisasi${goal ? ` (Tujuan: **${goal}**)` : ''}. Ada yang bisa saya bantu terkait rencana studi atau pendaftaran hari ini?`;
    }

    if (currentLang.startsWith('zh')) {
      return '您好！我是 UPER AI 智能学习与咨询顾问。很高兴为您服务！我可以帮您解答关于赴华留学、全额奖学金申请、HSK 培训、CSCA 辅导或研学营等问题。请问有什么我可以帮您的？';
    }
    if (currentLang.startsWith('en')) {
      return 'Hello! I am UPER AI Advisor. I am here to help you guide through study in China opportunities, CSC scholarships, HSK language training, CSCA prep courses, or global study tours. How may I assist you today?';
    }
    return 'Halo! Saya UPER AI Advisor. Senang bisa membantu Anda! Saya siap menjawab pertanyaan Anda mengenai kuliah di Tiongkok/China, beasiswa penuh CSC, kursus bahasa HSK, bimbel ujian CSCA, atau program study tour kami. Apa yang ingin Anda tanyakan hari ini?';
  };

  const handleResetChat = () => {
    // Clear all messages
    setMessages([]);
    // Remove lead submitted flag
    setLeadSubmitted(false);
    setPendingLeadData(null);
    clearStudentContext();
    setStudentContext(null);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(visitorKey('uper_lead_submitted'));
        sessionStorage.removeItem(visitorKey('uper_chat_human_mode'));
        sessionStorage.removeItem(visitorKey('uper_chat_counselor_id'));
        sessionStorage.removeItem(visitorKey('uper_pending_lead'));
      }
    } catch (_) {}
    // Reset other states
    setIsHumanMode(false);
    setActiveCounselorId('scholarship');
    setSuggestedPrompts(getStarterPrompts());
    setShowForm(false);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormInterest('');
  };

  const getFormText = () => {
    if (currentLang.startsWith('zh')) {
      return {
        header: '联系专业顾问老师',
        sub: '请留下您的联系信息，我们将结合上方的 AI 沟通记录为您妥善安排对应的全职留学指导老师与您建联。',
        name: '同学/家长姓名 Student/Parent Name',
        namePlaceholder: '例如：李明 (Ming Li)',
        phone: 'WhatsApp / 手机号码 Phone/WA',
        phonePlaceholder: '例如：+62 812-3456-7890',
        email: '电子邮箱 Email',
        emailPlaceholder: '例如：name@example.com',
        interest: '意向咨询项目 Program',
        interestPlaceHolders: [
          '赴华名校全额奖学金申请 (Kuliah S1/S2/S3 Beasiswa China)',
          'HSK 专业中文培训课程 (Kursus Bahasa Mandarin HSK)',
          'CSCA 顶尖高校班辅导 bimbel (Bimbingan Ujian CSCA)',
          '中国主题短期名校研学游学营 (Study Tour & Summer Camp)',
          '其他业务或商务合作咨询 (Lain-lain / Kemitraan)'
        ],
        submitBtn: '确认提交并请求联系',
        cancelBtn: '取消并返回对话',
        successHeader: '登记成功！',
        successMsg: '联系信息已保存到 CRM，顾问将按跟进安排联系您。',
      };
    }
    if (currentLang.startsWith('en')) {
      return {
        header: 'Request Human Advisor Link',
        sub: 'Please leave your details. UPER education expert will review your discussion with UPER AI and contact you shortly.',
        name: 'Your Full Name',
        namePlaceholder: 'e.g. John Doe',
        phone: 'WhatsApp / Phone Number',
        phonePlaceholder: 'e.g. +62 812-3456-7890',
        email: 'Your Email Address',
        emailPlaceholder: 'e.g. name@example.com',
        interest: 'Program / Topic of Interest',
        interestPlaceHolders: [
          'China Elite Universities Full Scholarships (Bachelor/Master/PhD)',
          'HSK Chinese Proficiency Courses',
          'CSCA Premium Exam Coaching',
          'Short-term China Academic Study Tours',
          'General Consultations / Business Partnership'
        ],
        submitBtn: 'Submit Inquiry Card',
        cancelBtn: 'Go Back',
        successHeader: 'Successfully Registered!',
        successMsg: 'Kontak tersimpan di CRM. Konsultan akan menindaklanjuti sesuai jadwal.',
      };
    }
    // Indonesian fallback
    return {
      header: 'Hubungi Konsultan Profesional',
      sub: 'Tinggalkan detail kontak Anda di bawah ini. Tim UPER akan menganalisis riwayat obrolan AI Anda di atas untuk menghubungkan Anda dengan konsultan pendamping yang tepat.',
      name: 'Nama Lengkap Anda',
      namePlaceholder: 'Contoh: Adrian Wijaya',
      phone: 'Nomor WhatsApp / HP',
      phonePlaceholder: 'Contoh: +62 821-3456-7890',
      email: 'Alamat Email Anda',
      emailPlaceholder: 'Contoh: budi@gmail.com',
      interest: 'Program Peminatan Kuliah/Bimbel',
      interestPlaceHolders: [
        'Kuliah S1/S2/S3 Beasiswa Penuh China (CSC Scholarship)',
        'Kursus Persiapan Bahasa Mandarin HSK (HSK Course)',
        'Bimbingan Lolos Seleksi Akademik CSCA Jakarta',
        'Program Study Tour / Summer Camp Edukatif ke China',
        'Pertanyaan Kemitraan / Konsultasi Lainnya'
      ],
      submitBtn: 'Kirim & Hubungi Saya',
      cancelBtn: 'Kembali ke Chat',
      successHeader: 'Pendaftaran Sukses!',
      successMsg: 'Contact details saved to CRM. An advisor will follow up according to the schedule.',
    };
  };

  const handleCloseChat = () => { setIsOpen(false); trackChatbotInteraction('close'); };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPhoneRejected || !validContactPhone(formPhone)) {
      setFormPhoneTouched(true); formPhoneRef.current?.focus(); return;
    }
    if (formEmailRejected || !validContactEmail(formEmail)) {
      setFormEmailTouched(true); formEmailRef.current?.focus(); return;
    }
    if (!formName.trim() || !formInterest) {
      setFormError(currentLang.startsWith('zh') ? '请完整填写所有必填字段。' : 'Semua kolom wajib diisi dengan benar.');
      trackFormSubmit('chatbot_lead_form', false, { reason: 'validation_error' });
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const leadData = {
        fullName: formName,
        phone: formPhone,
        email: formEmail,
        interest: formInterest,
      };

      await registerContact({...leadData, entryPoint: "homepage_widget"});
      setFormSuccess(true);
      setLeadSubmitted(true);
      trackFormSubmit('chatbot_lead_form', true, { interest: formInterest });

      // Save to unified student context for cross-channel synchronization
      saveStudentContext({
        leadProfile: {
          entryPoint: 'homepage_floating_chatbot',
          campaign: 'organic_chat',
          placement: 'floating_widget',
          hookType: 'consultation',
          hookContext: 'website',
          submittedAt: new Date().toISOString(),
          fullName: formName.trim(),
          whatsapp: formPhone.trim(),
          email: formEmail.trim(),
          currentStatus: undefined as any,
          goal: formInterest.includes('HSK') ? 'Prepare for HSK certification' : formInterest.includes('CSCA') ? 'Study in China or scholarship' : 'Improve my Mandarin skills',
          reportedLevel: undefined as any,
          levelState: undefined as any,
          city: undefined as any,
          mode: undefined as any,
          buyingSignal: undefined as any,
          nextStepInterest: formInterest,
          tier: undefined as any,
          flag: undefined as any,
          tierSource: 'predicted'
        }
      });

      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(visitorKey('uper_lead_submitted'), 'true');
        }
      } catch (_) {}

      // Append confirmation & AI email dispatch details in the chat list
      setMessages((prev) => [
        ...prev,
        {
          id: 'lead_form_submitted_success_msg_' + Math.random().toString(36).substring(7),
          role: 'assistant',
          content: currentLang.startsWith('zh') ? '咨询信息已保存到 CRM，顾问会根据跟进安排联系您。' : 'Your contact details have been saved. An advisor will follow up.',
          timestamp: new Date(),
          isComplete: true,
        }
      ]);
      setTimeout(() => {
        scrollToBottom('smooth');
      }, 500);
    } catch (err: any) {
      if (err?.message === CONTACT_PHONE_ERROR) {
        setFormPhoneRejected(true); formPhoneRef.current?.focus(); return;
      }
      if (err?.message === CONTACT_EMAIL_ERROR) {
        setFormEmailRejected(true); formEmailRef.current?.focus(); return;
      }
      console.error('[SUBMIT FORM ERROR]', err);
      trackFormSubmit('chatbot_lead_form', false, { reason: 'api_error', error: err.message || 'unknown' });
      setFormError(
        err instanceof RegistrationSaveError ? registrationSaveText(err.state,currentLang) : currentLang.startsWith('zh')
          ? `提交失败: ${err.message || '网络连接异常，请重试'}` 
          : `Gagal mengirim data: ${err.message || 'masalah jaringan, silakan coba lagi'}`
      );
    } finally {
      setFormLoading(false);
    }
  };

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    // Scroll to bottom on updates
    scrollToBottom('smooth');
  }, [messages, isLoading]);

  // Initial greeting message when chat opens the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: getGreeting(),
          timestamp: new Date(),
          isComplete: false,
        },
      ]);
    }
  }, [isOpen]);

  // Notify user if chat is closed but they haven't seen greeting
  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      setHasNewMessage(true);
    }
  }, [messages]);

  // Keep suggested prompts synchronized with starter prompts when resetting or changing language
  useEffect(() => {
    if (messages.length <= 1) {
      setSuggestedPrompts(getStarterPrompts());
    }
  }, [currentLang, messages.length]);

  // Prevent page scroll when chat is open and active
  useEffect(() => {
    if (!isOpen) {
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);

  const markMessageComplete = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, isComplete: true } : msg))
    );
  };

  const handleSend = async (textToSend?: string, retry?: Message, explicitAction?: ChatRequestAction) => {
    const text = (retry?.content || textToSend || input).trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;

    if (textToSend) {
      trackChatbotInteraction('click_shortcut', { prompt_text: text });
    } else {
      trackChatbotInteraction('send_message', { message_length: text.length });
    }

    // Reset inputs
    if (!textToSend) {
      setInput('');
    }

    // Instantly refocus the input area
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);

    // Clear dynamic guides so user can't parallel select
    setSuggestedPrompts([]);

    // Append user message
    const userMsg: Message = retry || {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      isComplete: true,
    };

    const requestAction = retry ? draft('homepage_widget',retry.id)?.action : explicitAction;
    const activeHumanMode = retry ? requestAction==='handoff' : requestAction==='handoff' || isHumanMode;
    const extraSystemMsg: Message | null = null;
    setMessages(prev=>[...prev.filter(m=>m.id!==userMsg.id && m.id!==('reply-'+userMsg.id)),{...userMsg,delivery:'pending'}]);
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 70000); // Increased client-side timeout to 70 seconds to align with server-side 60s limit

    try {
      // Map entire state context for server side Gemini conversation history
      const messagesToContext = extraSystemMsg ? [...messages, userMsg, extraSystemMsg] : [...messages, userMsg];
      const historyContext = messagesToContext.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }));

      let reply = '';
      let receivedSuggestions: string[] = [];

        const botMsgId='reply-'+userMsg.id;
        setMessages(prev=>[...prev.filter(m=>m.id!==botMsgId),{id:botMsgId,role:'assistant',content:'',timestamp:new Date(),isComplete:true}]);
        const res=await chatFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:historyContext,isHumanMode:activeHumanMode,action:requestAction,language:currentLang.slice(0,2),stream:!activeHumanMode}),signal:controller.signal},'homepage_widget');
        const result=await finishChat(res,'homepage_widget',userMsg.id,e=>{
          if(e.reset)reply='';if(e.chunk)reply+=e.chunk;if(e.reply&&!e.chunk)reply=e.reply;
          setMessages(prev=>prev.map(m=>m.id===userMsg.id&&e.saved?{...m,delivery:'saved'}:m.id===botMsgId?{...m,content:reply}:m));
        });
        if(activeHumanMode)toggleHumanMode(true);
        if(result.status==='contact_required')setShowForm(true);
        if(result.modelUsed)setActiveModelUsed(result.modelUsed);
        setMessages(prev=>prev.map(m=>m.id===userMsg.id?{...m,delivery:'saved'}:m.id===botMsgId?{...m,content:result.reply,isComplete:true}:m));
        setSuggestedPrompts(result.suggestedPrompts || []);
      // Contextual lead form suggestion check - trigger exactly at 3, 6, 10, 20, 30, 45 exchanges
      const userMsgsCount = messagesToContext.filter(m => m.role === 'user').length;
      const triggerTurns = [3, 6, 10, 20, 30, 45];
      const shouldPromptLead = triggerTurns.includes(userMsgsCount) && !leadSubmitted;

      if (shouldPromptLead) {
        setTimeout(() => {
          setMessages((prev) => {
            const promptId = `inline_lead_form_prompt_${userMsgsCount}`;
            const hasExistingPrompt = prev.some(m => m.id === promptId);
            if (hasExistingPrompt) return prev;
            return [
              ...prev,
              {
                id: promptId,
                role: 'assistant',
                content: currentLang.startsWith('zh')
                  ? '💡 **[顾问贴士]** 请登记联系信息，咨询记录将保存到 CRM，顾问按跟进安排联系您。这不是实时人工聊天：'
                  : currentLang.startsWith('en')
                  ? '💡 **[Advisor Tip]** Register your contact details below. Your consultation is saved to CRM for advisor follow-up according to the schedule. This is not live agent chat.'
                  : '💡 **[Perhatian]** Isi kontak di bawah. Konsultasi tersimpan di CRM untuk tindak lanjut sesuai jadwal, bukan chat langsung dengan admin.',
                timestamp: new Date(),
                isComplete: true,
              }
            ];
          });
        }, 3500); // 3.5 seconds delay to let typewriter complete most of the main text
      }
    } catch (err) {
      const delivery=draft('homepage_widget',userMsg.id)?.delivery || 'unknown';
      setMessages(prev=>prev.filter(m=>m.id!==('reply-'+userMsg.id)).map(m=>m.id===userMsg.id?{...m,delivery}:m));
      setSuggestedPrompts([]);
    } finally {
      clearTimeout(timeoutId);
      sendingRef.current = false;
      setIsLoading(false);
      // Ensure input focus is returned to the user
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInitiateHumanMode = async (_preferredId?: string) => {
    await handleSend(currentLang.startsWith('zh')?'请安排顾问联系我':currentLang.startsWith('en')?'Please arrange advisor follow-up':'Mohon tindak lanjut konsultan', undefined, 'handoff');
  };

  const currentStarterPrompts = getStarterPrompts();

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-24 right-6 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-3 select-none">
        {/* Sparkle Notification Badge if closed */}
        {!isOpen && hasNewMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-primary-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg border border-primary-500 font-medium whitespace-nowrap flex items-center gap-1 cursor-pointer"
            onClick={() => {
              setIsOpen(true);
              setHasNewMessage(false);
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Chat UPER AI</span>
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (isOpen) {
              handleCloseChat();
            } else {
              setIsOpen(true);
              setHasNewMessage(false);
              trackChatbotInteraction('open');
            }
          }}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all duration-300 group ${
            isOpen 
            ? 'bg-slate-900 text-white hover:bg-slate-800' 
            : 'bg-gradient-to-tr from-primary-600 to-primary-500 text-white hover:shadow-primary-600/45 hover:shadow-xl'
          }`}
          aria-label={t('faq.toggleAiService')}
          id="uper-ai-fab"
        >
          {isOpen ? (
            <X className="w-5.5 h-5.5 transform group-hover:rotate-90 transition-transform duration-300" />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Spinning/Orbiting dashed background ring */}
              <div className="absolute inset-1.5 border border-dashed border-white/25 rounded-full animate-[spin_15s_linear_infinite] group-hover:border-white/50 group-hover:scale-105 transition-all" />
              
              {/* Sparkle top right */}
              <Sparkles className="absolute top-2.5 right-2.5 w-3 h-3 text-amber-300 opacity-90 group-hover:scale-125 group-hover:rotate-12 transition-all" />

              {/* Central Bot Icon */}
              <Bot className="w-6.5 h-6.5 text-white filter drop-shadow-sm group-hover:-translate-y-0.5 transition-transform duration-300" />

              {/* Graduation Cap placed playfully on bot's head */}
              <GraduationCap className="absolute top-2.5 left-2.5 w-4 h-4 text-white/90 drop-shadow-sm transform -rotate-[20deg] group-hover:rotate-[5deg] group-hover:scale-110 transition-all duration-300" />

              {/* Notification dot badge */}
              <span className="absolute top-0 right-0 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>
          )}
        </motion.button>
      </div>

      {/* AI Chat Window Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`fixed bottom-24 right-4 left-4 md:bottom-24 md:right-6 md:left-auto flex flex-col overflow-hidden z-50 transition-[box-shadow] overscroll-contain ${
              isApple 
                ? 'bg-white/95 backdrop-blur-2xl rounded-[2rem] border border-slate-200/50 shadow-2xl shadow-slate-900/10' 
                : 'bg-white rounded-2xl shadow-2xl border border-slate-100 shadow-slate-950/10'
            }`}
            style={{
              width: isDesktop ? `${chatWidth}px` : 'auto',
              height: isDesktop ? `${chatHeight}px` : 'calc(100vh - 140px)',
              maxWidth: isDesktop ? 'calc(100vw - 48px)' : undefined,
              maxHeight: isDesktop ? 'calc(100vh - 120px)' : undefined,
            }}
            id="uper-ai-chat-window"
          >
            {/* Edge Drag Handles for Resizing on Desktop */}
            {isDesktop && (
              <>
                {/* Top border handle */}
                <div 
                  onMouseDown={(e) => startResize(e, 'top')}
                  onTouchStart={(e) => startResize(e, 'top')}
                  className="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize z-50 hover:bg-primary-500/25 active:bg-primary-600/40 transition-colors"
                  title={currentLang.startsWith('zh') ? '上下拖拽改变高度' : 'Tarik untuk mengubah tinggi'}
                />
                {/* Left border handle */}
                <div 
                  onMouseDown={(e) => startResize(e, 'left')}
                  onTouchStart={(e) => startResize(e, 'left')}
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-w-resize z-50 hover:bg-primary-500/25 active:bg-primary-600/40 transition-colors"
                  title={currentLang.startsWith('zh') ? '左右拖拽改变宽度' : 'Tarik untuk mengubah lebar'}
                />
                {/* Top-left corner diagonal handle */}
                <div 
                  onMouseDown={(e) => startResize(e, 'both')}
                  onTouchStart={(e) => startResize(e, 'both')}
                  className="absolute top-0 left-0 w-5 h-5 cursor-nw-resize z-50 flex items-center justify-center hover:bg-primary-500/35 active:bg-primary-600/50 transition-colors rounded-tl-2xl overflow-hidden"
                  title={currentLang.startsWith('zh') ? '双向拖动调整大小' : 'Tarik sudut untuk mengubah ukuran'}
                >
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-slate-400 pointer-events-none opacity-60" />
                </div>
              </>
            )}

            {/* Header */}
            <div className={`p-4 flex justify-between items-center relative transition-colors duration-300 ${
              isApple 
                ? 'bg-[#fcfcfd]/90 border-b border-slate-200/50 text-slate-900' 
                : 'bg-slate-900 text-white'
            }`}>
              <div className="flex items-center gap-3 select-none">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 border border-slate-200"><Sparkles className="w-5 h-5 text-primary-500" /></div>
                <div>
                  <h3 className={`font-bold text-sm tracking-tight flex items-center gap-1.5 whitespace-nowrap ${
                    isApple ? 'text-slate-850 font-semibold' : 'text-white'
                  }`}>
                    {isHumanMode ? (
                      <span>{currentLang.startsWith('zh')?'顾问跟进申请':currentLang.startsWith('en')?'Advisor follow-up':'Tindak lanjut konsultan'}</span>
                    ) : (
                      <span>UPER AI Assistant</span>
                    )}
                    {!isHumanMode && (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
                    )}
                  </h3>
                  <p className={`text-[10px] font-sans max-w-[150px] md:max-w-[200px] truncate ${
                    isApple ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {isHumanMode ? (
                      currentLang.startsWith('zh') 
                        ? '非实时人工聊天 · 消息保存至 CRM'
                        : currentLang.startsWith('en') 
                        ? 'Not live agent chat · Messages saved to CRM'
                        : 'Bukan chat langsung · Pesan tersimpan di CRM'
                    ) : (
                      currentLang.startsWith('zh') 
                        ? '智能顾问 • 24小时在线' 
                        : currentLang.startsWith('en') 
                        ? 'Smart Advisor • Active 24/7' 
                        : 'Konsultan Pintar • Online 24/7'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!showForm && (
                  isHumanMode ? (
                    <button
                      onClick={() => {
                        toggleHumanMode(false);
                        setMessages((prev) => [
                          ...prev,
                          {
                            id: 'sys_' + Math.random().toString(36).substring(7),
                            role: 'assistant',
                            content: currentLang.startsWith('zh')
                              ? '🔄 **[系统提示]** 已为您成功切换回 **UPER AI 智能助手模式**。您现在可以继续与智能助手进行快速多语种咨询。'
                              : currentLang.startsWith('en')
                              ? '🔄 **[System]** Successfully returned to **UPER AI Assistant**. You are now chatting with our automated intelligence system again.'
                              : '🔄 **[Sistem]** Berhasil kembali ke **Mode UPER AI Assistant**. Anda kini dapat mengajukan pertanyaan cepat ke model AI kami kembali.',
                            timestamp: new Date(),
                            isComplete: true,
                          }
                        ]);
                      }}
                      className={`mr-1 shadow-sm px-2.5 py-1.5 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer border ${
                        isApple 
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/50 shadow-none' 
                          : 'bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 border-slate-700'
                      }`}
                      title={currentLang.startsWith('zh') ? '切换回 AI 助手' : 'Switch to AI'}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{currentLang.startsWith('zh') ? '切换为AI' : currentLang.startsWith('en') ? 'Switch to AI' : 'Tanya AI'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInitiateHumanMode()}
                      disabled={isLoading}
                      aria-busy={isLoading}
                      className={`mr-1 shadow-sm px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isApple 
                          ? 'bg-slate-900 hover:bg-slate-850 text-white border-slate-950 shadow-none' 
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-amber-500/20'
                      }`}
                      title={currentLang.startsWith('zh') ? '提交顾问跟进申请' : currentLang.startsWith('en') ? 'Request advisor follow-up' : 'Minta tindak lanjut konsultan'}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{currentLang.startsWith('zh') ? '申请顾问跟进' : currentLang.startsWith('en') ? 'Advisor follow-up' : 'Minta tindak lanjut'}</span>
                    </button>
                  )
                )}
                <button
                  onClick={handleResetChat}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer mr-0.5 ${
                    isApple 
                      ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-850' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={currentLang.startsWith('zh') ? '重新开始对话 / 清空缓存' : currentLang.startsWith('en') ? 'Restart Chat / Clear Cache' : 'Mulai Ulang Chat'}
                  aria-label="Reset Chat"
                >
                  <RotateCcw className="w-4.5 h-4.5" />
                </button>
                <button 
                  onClick={() => handleCloseChat()}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isApple 
                      ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-850' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  aria-label="Minimize Chat"
                >
                  <X className="w-5.5 h-5.5" />
                </button>
              </div>
            </div>

            {showForm ? (
              /* Leave Contact Details Form Overlay */
              <div className="flex-1 bg-slate-50/70 p-4 flex flex-col overflow-y-auto overscroll-contain scrollbar-thin">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm mb-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageCircle className="w-4.5 h-4.5 text-primary-600" />
                    {getFormText().header}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {getFormText().sub}
                  </p>
                </div>

                {formSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1 bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center justify-center text-center shadow-sm"
                  >
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3.5 border border-emerald-100 shadow-sm">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <h5 className="text-sm font-bold text-slate-800 mb-1.5">
                      {getFormText().successHeader}
                    </h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed px-1">
                      {getFormText().successMsg}
                    </p>

                    <a
                      href="https://wa.me/6281116612062"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 fill-white" />
                      <span>{currentLang.startsWith('zh') ? '立即发起 WhatsApp 会话' : 'Mulai Chat WhatsApp Sekarang'}</span>
                    </a>

                    <button
                      onClick={() => {
                        setShowForm(false);
                        setFormSuccess(false);
                        setFormName('');
                        setFormPhone('');
                        setFormEmail('');
                        setFormInterest('');
                      }}
                      className="mt-3.5 text-[11px] text-primary-600 hover:text-primary-700 font-semibold cursor-pointer"
                    >
                      {currentLang.startsWith('zh') ? '返回智能对话窗口' : 'Kembali ke Percakapan'}
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col gap-3.5">
                    {formError && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3 text-xs leading-relaxed font-medium">
                        {formError}
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5">
                        {getFormText().name} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder={getFormText().namePlaceholder}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white text-slate-800 text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-400"
                        disabled={formLoading}
                        id="form-full-name"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="form-phone" className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5">
                        {getFormText().phone} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        ref={formPhoneRef}
                        inputMode="tel"
                        autoComplete="tel"
                        aria-invalid={formPhoneInvalid}
                        aria-describedby={formPhoneInvalid ? "form-phone-help form-phone-error" : "form-phone-help"}
                        value={formPhone}
                        onChange={(e) => {setFormPhone(e.target.value); setFormPhoneRejected(false);}}
                        onBlur={() => setFormPhoneTouched(true)}
                        placeholder={getFormText().phonePlaceholder}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white text-slate-800 text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-400"
                        disabled={formLoading}
                        id="form-phone"
                      />
                      <p id="form-phone-help" className="text-xs text-slate-500">{phoneText.help}</p>
                      {formPhoneInvalid && <p id="form-phone-error" role="alert" className="text-xs text-rose-700">{phoneText.error}</p>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="form-email" className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5">
                        {getFormText().email} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        ref={formEmailRef}
                        autoComplete="email"
                        inputMode="email"
                        aria-invalid={formEmailInvalid}
                        aria-describedby={formEmailInvalid ? "form-email-help form-email-error" : "form-email-help"}
                        value={formEmail}
                        onChange={(e) => {setFormEmail(e.target.value); setFormEmailRejected(false);}}
                        onBlur={() => setFormEmailTouched(true)}
                        placeholder={getFormText().emailPlaceholder}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white text-slate-800 text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-400"
                        disabled={formLoading}
                        id="form-email"
                      />
                      <p id="form-email-help" className="text-xs text-slate-500">{emailText.help}</p>
                      {formEmailInvalid && <p id="form-email-error" role="alert" className="text-xs text-rose-700">{emailText.error}</p>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5">
                        {getFormText().interest} <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formInterest}
                        onChange={(e) => setFormInterest(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200/80 focus:border-primary-500 focus:bg-white text-slate-800 text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all cursor-pointer"
                        disabled={formLoading}
                        id="form-interest"
                      >
                        <option value="">{currentLang.startsWith('zh') ? '-- 请选择您的咨询意向 --' : '-- Pilih Peminatan Program --'}</option>
                        {getFormText().interestPlaceHolders.map((option: string, i: number) => (
                          <option key={i} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2.5 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer"
                        disabled={formLoading}
                      >
                        {getFormText().cancelBtn}
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl py-3 shadow-md shadow-primary-500/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        disabled={formLoading}
                      >
                        {formLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{currentLang.startsWith('zh') ? '正在提交...' : 'Mengirim...'}</span>
                          </>
                        ) : (
                          <span>{getFormText().submitBtn}</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* Regular AI Chat Window */
              <>
                {/* Conversation Flow Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 flex flex-col gap-4 scrollbar-thin overscroll-contain">
                  {/* Real-time Assessment & Profile Synced Banner */}
                  {studentContext?.assessment?.completed && (
                    <motion.div 
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-amber-500/10 via-primary-500/10 to-emerald-500/10 border border-primary-200/80 rounded-xl p-2.5 px-3 flex flex-col gap-2 text-xs text-slate-750 shadow-2xs backdrop-blur-xs select-none"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-white/90 border border-primary-300 text-primary-700 font-extrabold text-[10px] shadow-2xs tracking-tight">
                            {safeHskResult(studentContext.assessment.result,currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id')?.levelConfirmed || chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id','历史结果（未核验）','Legacy result (unverified)','Hasil lama (belum diverifikasi)')}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-[11px] leading-tight flex items-center gap-1">
                              <span>{currentLang.startsWith('zh') ? '分班参考报告' : currentLang.startsWith('en') ? 'Placement reference report' : 'Laporan referensi penempatan'}</span>
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </span>
                            <span className="text-[10px] text-slate-500 font-sans">
                              {!safeHskResult(studentContext.assessment.result,currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id') ? chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id','历史版本或记录暂不可复核','Historical version or record not currently reviewable','Versi atau catatan lama belum dapat ditinjau') : currentLang.startsWith('zh')
                                ? `得分: ${studentContext.assessment.score ?? 'N/A'}/${studentContext.assessment.maxScore ?? studentContext.assessment.total ?? '?'} 分 · ${studentContext.assessment.saveStatus==='saved'?'服务端已保存':'服务端保存未确认'}`
                                : chooseText(currentLang.startsWith('en')?'en':'id','',`Score: ${studentContext.assessment.score ?? 'N/A'}/${studentContext.assessment.maxScore ?? studentContext.assessment.total ?? '?'} points · ${studentContext.assessment.saveStatus==='saved'?'Server saved':'Server save unconfirmed'}`,`Skor: ${studentContext.assessment.score ?? 'N/A'}/${studentContext.assessment.maxScore ?? studentContext.assessment.total ?? '?'} poin · ${studentContext.assessment.saveStatus==='saved'?'Tersimpan di server':'Penyimpanan server belum dikonfirmasi'}`)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowAssessmentCard(!showAssessmentCard)}
                            className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md transition-all cursor-pointer"
                          >
                            {chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id',showAssessmentCard?'收起':'详情',showAssessmentCard?'Hide':'Details',showAssessmentCard?'Tutup':'Rincian')}
                          </button>
                          <a 
                            href="/chat"
                            className="text-[11px] font-semibold text-primary-600 hover:text-primary-800 underline decoration-primary-300 flex items-center gap-0.5 ml-1 whitespace-nowrap group cursor-pointer"
                            title={currentLang.startsWith('zh') ? '前往全景独立舱' : 'Open Placement Lab'}
                          >
                            <span>{currentLang.startsWith('zh') ? '独立舱' : 'Lab'}</span>
                            <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </a>
                        </div>
                      </div>

                      {/* Expandable Diagnostic Breakdown Sheet */}
                      {showAssessmentCard && (
                        <div className="pt-2 border-t border-primary-200/50 flex flex-col gap-2">
                          {studentContext.assessment.result ? <HskAssessmentReport result={studentContext.assessment.result} lang={currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id'}/> : <p className="text-xs">{chooseText(currentLang.startsWith('zh')?'zh':currentLang.startsWith('en')?'en':'id','历史结果缺少作答与版本，未核验；建议重新测评。','This legacy result has no answers or version and is unverified. Take a new assessment.','Hasil lama tidak memiliki jawaban atau versi dan belum diverifikasi. Ikuti tes baru.')}</p>}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAssessmentCard(false);
                                handleSend(currentLang.startsWith('zh') 
                                  ? `请针对我测评的 ${studentContext.assessment?.levelConfirmed || '当前等级'} 成绩，为我制定定制化的提分与开班方案` 
                                  : `Please design a personalized study plan for my ${studentContext.assessment?.levelConfirmed || 'tested'} level`);
                              }}
                              className="flex-1 py-1 px-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-[10px] rounded-lg transition-colors text-center cursor-pointer shadow-2xs"
                            >
                              {currentLang.startsWith('zh') ? '🎯 一键为该成绩定制规划' : '🎯 Tailor Study Plan'}
                            </button>
                            <a
                              href="/chat"
                              className="py-1 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-[10px] rounded-lg transition-colors text-center cursor-pointer"
                            >
                              {currentLang.startsWith('zh') ? '重新测验 / 50题' : 'Retake Exam'}
                            </a>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {messages.map((m, idx) => (
                    <div 
                      key={m.id} 
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all duration-200 ${
                        m.role === 'user' 
                        ? 'bg-primary-600 text-white rounded-br-none' 
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                      }`}>
                        {m.role==='user' && m.delivery && <div role="status" className="text-xs mb-2">{deliveryText(m.delivery,currentLang)}{!['pending','saved'].includes(m.delivery) && <button className="ml-3 underline min-h-11" disabled={isLoading} onClick={()=>void handleSend(undefined,m)}>{currentLang.startsWith('zh')?'重试':currentLang.startsWith('en')?'Retry':'Coba lagi'}</button>}</div>}
                        {/* Render message with linebreaks or Typewriter if assistant and not complete */}
                        <div className="leading-relaxed dynamic-chat-text">
                          {m.id === 'select_project_counselor' ? (
                            <div className="flex flex-col gap-3 font-sans select-none my-1">
                              <p className="font-semibold text-slate-855 text-xs leading-relaxed mb-1.5 flex items-center gap-1.5 pt-0.5">
                                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                                <span>{m.content}</span>
                              </p>
                              <div className="flex flex-col gap-2.5">
                                {UPER_COUNSELORS.map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => handleInitiateHumanMode(c.id)}
                                    disabled={isHumanMode || isLoading}
                                    className={`w-full text-left p-3.5 rounded-2xl border border-slate-150/80 bg-slate-50 hover:bg-slate-100 hover:border-slate-250 transition-all cursor-pointer flex items-center gap-3.5 active:scale-[0.985] ${
                                      isHumanMode || isLoading ? 'opacity-60 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${c.gradient} flex items-center justify-center shrink-0 shadow-sm border border-white/20`}>
                                      <span className="text-sm font-black text-white">{c.avatarChar}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1.5 justify-between">
                                        <span>
                                          {currentLang.startsWith('zh')?c.role.zh:currentLang.startsWith('en')?c.role.en:c.role.id}
                                        </span>
                                        <span className="text-[9px] text-primary-600 font-bold uppercase tracking-wider block shrink-0 bg-primary-50 px-1.5 py-0.5 rounded">
                                          {c.id.toUpperCase()}
                                        </span>
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-medium truncate mt-1">
                                        {currentLang.startsWith('zh') ? c.role.zh : currentLang.startsWith('en') ? c.role.en : c.role.id}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : m.id.startsWith('inline_lead_form_prompt') ? (
                            <div className="flex flex-col gap-3 font-sans select-none my-1">
                              <p className="font-normal text-slate-650 text-xs leading-relaxed flex items-start gap-1.5 pt-0.5">
                                <Sparkles className="w-4 h-4 text-primary-500 animate-pulse shrink-0 mt-0.5" />
                                <span>
                                  {m.content.split(/\*\*(.*?)\*\*/g).map((part, i) => 
                                    i % 2 === 1 ? (
                                      <strong key={i} className="font-extrabold text-slate-900">{part}</strong>
                                    ) : (
                                      part
                                    )
                                  )}
                                </span>
                              </p>
                              {leadSubmitted ? (
                                <div className="py-2.5 bg-primary-50 text-primary-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-primary-200/50">
                                  <span className="w-2 h-2 rounded-full bg-primary-500 animate-ping shrink-0" />
                                  <span>{currentLang.startsWith('zh') ? '✓ 咨询资料已成功登记咨询' : currentLang.startsWith('en') ? '✓ Info Registered Successfully' : '✓ Kontak Berhasil Dikirim'}</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setShowForm(true);
                                    setFormSuccess(false);
                                    setFormError('');
                                  }}
                                  className="w-full py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-[0.985] flex items-center justify-center gap-2 cursor-pointer border border-primary-500/25"
                                >
                                  <MessageCircle className="w-4 h-4 shrink-0" />
                                  <span>
                                    {currentLang.startsWith('zh') ? '📝 填写咨询登记表 (快速对接)' : currentLang.startsWith('en') ? '📝 Fill Consultation Form' : '📝 Isi Formulir Konsultasi'}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : m.role === 'assistant' ? (
                            idx === messages.length - 1 && !m.isComplete ? (
                              <TypewriterText 
                                text={m.content}
                                isHuman={false}
                                onComplete={() => markMessageComplete(m.id)}
                                onUpdate={() => scrollToBottom('auto')}
                              />
                            ) : (
                              <RenderMarkdown content={m.content} />
                            )
                          ) : (
                            <span className="whitespace-pre-line">{m.content}</span>
                          )}
                        </div>
                        {/* Timestamp & channel indicator */}
                        <p className={`text-[10px] mt-1.5 text-right font-mono ${
                          m.role === 'user' ? 'text-primary-200/80' : 'text-slate-400'
                        }`}>
                          {m.role === 'assistant' && !m.id.startsWith('sys_') && 'UPER • '}
                          {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
     
                  {/* Loader pulsing animation when asking AI */}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm rounded-bl-none flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary-600 shrink-0" />
                        <span className="text-xs text-slate-400 font-medium whitespace-pre-line animate-pulse">
                          {switchingStep || (
                            isHumanMode ? (
                              currentLang.startsWith('zh')?'正在保存跟进申请…':currentLang.startsWith('en')?'Saving follow-up request…':'Menyimpan permintaan tindak lanjut…'
                            ) : (
                              currentLang.startsWith('zh') ? 'UPER AI 正在思考中...' : currentLang.startsWith('en') ? 'UPER AI is typing...' : 'UPER AI sedang mengetik...'
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
     
                {/* Dynamic Suggested Prompts (shows after typewriter is done) */}
                {!isLoading && suggestedPrompts.length > 0 && (messages.length === 0 || messages[messages.length - 1]?.isComplete) && (
                  <div className="p-3 bg-white border-t border-slate-100/80">
                    <p className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5 px-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary-500 animate-pulse" />
                      {currentLang.startsWith('zh') ? '您可能想了解的问题：' : currentLang.startsWith('en') ? 'Suggested Prompts:' : 'Mungkin yang ingin Anda tanyakan:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto overscroll-contain p-0.5">
                      {suggestedPrompts.map((prompt, idx) => {
                        const flowColors = [
                          { bg: 'bg-indigo-50/70 hover:bg-indigo-100/80 border-indigo-100/50 text-indigo-700 hover:text-indigo-900', dot: 'bg-indigo-400' },
                          { bg: 'bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-100/50 text-emerald-700 hover:text-emerald-900', dot: 'bg-emerald-400' },
                          { bg: 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-100/50 text-amber-700 hover:text-amber-900', dot: 'bg-amber-400' },
                          { bg: 'bg-sky-50/70 hover:bg-sky-100/80 border-sky-100/50 text-sky-700 hover:text-sky-900', dot: 'bg-sky-400' },
                        ];
                        const theme = flowColors[idx % flowColors.length];
                        return (
                          <motion.button
                            key={idx}
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSend(prompt)}
                            className={`text-left text-xs px-3 py-1.5 rounded-full transition-all border ${theme.bg} cursor-pointer flex items-center justify-between gap-2 shadow-sm group font-medium max-w-full`}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} shrink-0`} />
                              <span className="truncate">{prompt}</span>
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-1" />
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}



                {/* Form Input footer */}
                <div className="p-3 bg-white border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={
                        currentLang.startsWith('zh') 
                        ? '在此输入您的问题，如：如何获得奖学金' 
                        : currentLang.startsWith('en') 
                        ? 'Type your question about UPER...' 
                        : 'Tanyakan sesuatu tentang UPER...'
                      }
                      className="flex-1 bg-slate-100 hover:bg-slate-50/80 focus:bg-white text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none border border-transparent focus:border-slate-200 resize-none max-h-24 scrollbar-none transition-all placeholder:text-slate-400 leading-normal"
                      disabled={isLoading}
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSend()}
                      disabled={isLoading || !input.trim()}
                      className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isLoading || !input.trim()
                        ? 'bg-slate-100 text-slate-300 pointer-events-none'
                        : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/10'
                      }`}
                      aria-label="Send Message"
                    >
                      <Send className="w-4.5 h-4.5" />
                    </motion.button>
                  </div>
                  
                  {/* Powered by dynamic model badge footer */}
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400/80 select-none">
                    <Sparkles className="w-3 h-3 text-primary-500 animate-pulse" />
                    <span>{isHumanMode?(currentLang.startsWith('zh')?'CRM 顾问跟进登记':currentLang.startsWith('en')?'CRM advisor follow-up':'Tindak lanjut konsultan CRM'):`Powered by ${formatModelName(activeModelUsed)}`}</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
