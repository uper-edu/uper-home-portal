import { chatFetch, registerContact, restoreChat } from '../services/portalChat';
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
  typingText: { zh: string; en: string; id: string };
  connectedText: { zh: string; en: string; id: string };
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
    typingText: {
      zh: 'Sarah 老师正在输入中...',
      en: 'Sarah is typing...',
      id: 'Kak Sarah sedang mengetik...'
    },
    connectedText: {
      zh: '🔔 **[人工客服已接入]** 您好！我是 UPER 雅加达办公室全职留学咨询顾问 **Sarah**，很高兴为您服务。有什么关于大学、全额奖学金申请或者选校的具体需求，您都可以随时在这里告诉我，我将竭诚协助您！',
      en: '🔔 **[Advisor Connected]** Hello! I am **Sarah**, senior study advisor here at UPER Jakarta HQ. I am completely at your service now. Please type any questions about our full scholarship programs, course details, or application process and I will guide you step by step!',
      id: '🔔 **[Konsultan Tersambung]** Halo! Saya **Sarah**, konsultan akademik senior di kantor pusat UPER Jakarta. Saya sangat senang bisa membantu Anda sekarang. Silakan ketik pertanyaan Anda secara detail tentang beasiswa S1/S2/S3, atau pendaftaran!'
    }
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
    typingText: {
      zh: '莉莉老师正在输入中...',
      en: 'Lili is typing...',
      id: 'Lili老师 sedang mengetik...'
    },
    connectedText: {
      zh: '🔔 **[HSK专家已接入]** 大家好！我是 UPER 印尼校区汉语教研总监 **Lili老师**。想学好中文并通过 HSK 拿到名校敲门砖吗？不管是零基础、听说纠音还是真题备考，我都会为您安排最棒的方案。随时问我吧！',
      en: '🔔 **[HSK Expert Connected]** Hello there! I am **Lili老师**, Head of Language Curriculum at UPER. Ready to upgrade your Mandarin standard and pass your HSK exams? I can advise on standard classes, level placements, tones, or test setups. Ask me anything!',
      id: '🔔 **[Pakar HSK Tersambung]** Halo semuanya! Saya **Lili老师**, Direktur Akademik HSK di UPER. Ingin menguasai bahasa Mandarin dan lulus ujian HSK untuk kuliah di China? Dari kelas pemula hingga tingkat lanjut, saya siap membantu. Silakan bertanya!'
    }
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
    typingText: {
      zh: '杰森老师正在输入中...',
      en: 'Mr. Jason is typing...',
      id: 'Coach Jason sedang mengetik...'
    },
    connectedText: {
      zh: '🔔 **[学术教练已接入]** 你好！我是 UPER 学术考前培训总教练 **杰森老师**。顶尖高校笔试是一场硬仗。我们的 CSCA 课程是你的学术保险，我们会通过数理化衔接帮你直通清华、交大等中国 C9 联盟高校。关于考试大纲，尽管提问！',
      en: '🔔 **[CSCA Coach Connected]** Welcome! I am **Coach Jason**, chief strategist for CSCA test preparation at UPER. Elite C9 universities have challenging entrance tests in math & physics. Our CSCA bridging is your ultimate academic protection. Let me know your target major!',
      id: '🔔 **[Coach CSCA Tersambung]** Selamat datang! Saya **Coach Jason**, kepala pelatih persiapan ujian akademik CSCA di UPER. Ujian seleksi masuk universitas C9 seperti Tsinghua/SJTU sangat menantang. Bimbel CSCA adalah jaminan akademik Anda. Apa jurusan impian Anda?'
    }
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
    typingText: {
      zh: '凯文老师正在输入中...',
      en: 'Kevin is typing...',
      id: 'Kak Kevin sedang mengetik...'
    },
    connectedText: {
      zh: '🔔 **[游学总监已接入]** 哈啰！我是 UPER 的国际研学营总监 **凯文老师**。探索中国不仅能在课堂上，更能走入大厂！我们去天安门、去清华、去腾讯、去阿里巴巴。关于签证、安全保障、酒店安排等，我都可以为你解答。走起！',
      en: '🔔 **[Camp Director Connected]** Hey there! **Kevin** here, study tour and camps director at UPER. Want to witness China’s tech boom, explore scenic landmarks, and gain international certificates? I have all the answers on upcoming tour logistics, costs, and safety. Ask away!',
      id: '🔔 **[Camp Director Tersambung]** Halo adik-adip dan rekan sekalian! Saya **Kak Kevin**, Direktur Program Study Tour UPER. Ingin mengunjungi kampus Tsinghua, kantor Tencent & Alibaba, serta mengeksplorasi budaya China? Tanyakan saya tentang jadwal, fasilitas, visa, dan lainnya!'
    }
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
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  
  // Custom states for UPER consultant lead capture form
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
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
        const stored = sessionStorage.getItem('uper_pending_lead');
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
          sessionStorage.setItem('uper_pending_lead', JSON.stringify(pendingLeadData));
        } else {
          sessionStorage.removeItem('uper_pending_lead');
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
      return typeof window !== 'undefined' && sessionStorage.getItem('uper_lead_submitted') === 'true';
    } catch (_) {
      return false;
    }
  });

  useEffect(()=>{fetch('/api/portal/session').then(r=>r.ok?r.json():Promise.reject()).then(s=>setLeadSubmitted(!!s.registered)).catch(()=>{});},[]);
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
      return typeof window !== 'undefined' && sessionStorage.getItem('uper_chat_human_mode') === 'true';
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
      return (typeof window !== 'undefined' && sessionStorage.getItem('uper_chat_counselor_id')) || 'scholarship';
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
        sessionStorage.setItem('uper_chat_counselor_id', id);
      }
    } catch (_) {}

    if (notify) {
      const counselor = UPER_COUNSELORS.find((c) => c.id === id) || UPER_COUNSELORS[0];
      setMessages((prev) => [
        ...prev,
        {
          id: 'sys_swap_' + Math.random().toString(36).substring(7),
          role: 'assistant',
          content: currentLang.startsWith('zh')
            ? `🔄 **[系统提示]** 已成功无缝切换至专属顾问 **${counselor.nameCn}**。${counselor.role.zh}已接入，欢迎随时继续提问。`
            : currentLang.startsWith('en')
            ? `🔄 **[System]** Successfully switched to expert advisor **${counselor.name}** (${counselor.role.en}). Ready to support you.`
            : `🔄 **[Sistem]** Berhasil berpindah ke konsultan spesialis **${counselor.name}** (${counselor.role.id}). Silakan ajukan pertanyaan Anda.`,
          timestamp: new Date(),
          isComplete: true,
        },
      ]);
    }
  };

  const toggleHumanMode = (val: boolean) => {
    setIsHumanMode(val);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('uper_chat_human_mode', String(val));
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
      const level = ctx.assessment.levelConfirmed || 'HSK 1';
      if (currentLang.startsWith('zh')) {
        return [
          `针对我测出的 ${level}，有哪些推荐班型与开班时间？`,
          `达到中国顶尖名校（C9/双一流）申请要求还需要多久？`,
          `如何预约雅加达校区 1 对 1 专家试听与答疑？`,
          `UPER 的奖学金申请保录取计划具体是怎样的？`,
        ];
      }
      if (currentLang.startsWith('en')) {
        return [
          `What class schedules are recommended for my confirmed ${level}?`,
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
      const level = ctx.assessment.levelConfirmed || 'HSK 1';
      const score = ctx.assessment.score ?? 0;
      const total = ctx.assessment.total ?? 15;
      if (currentLang.startsWith('zh')) {
        return `🎉 欢迎回来，**${name}**！已为您无缝同步在全景测评舱的 HSK 诊断成果（测评定级：**${level}**，实测得分：**${score}/${total}** 正确）。\n\n针对该水平，UPER 已为您匹配好名校阶梯课程及全额奖学金备考方案。请问有什么我可以为您深度解析的吗？`;
      }
      if (currentLang.startsWith('en')) {
        return `🎉 Welcome back, **${name}**! We have synchronized your diagnostic results from our Placement Lab (Confirmed Level: **${level}**, Score: **${score}/${total}** correct).\n\nBased on your level, UPER has mapped out your target university pathway and scholarship curriculum. How can I assist you with your personalized study plan today?`;
      }
      return `🎉 Selamat datang kembali, **${name}**! Hasil tes penempatan HSK Anda telah terhubung (Level Terkonfirmasi: **${level}**, Skor: **${score}/${total}**).\n\nBerdasarkan level ini, UPER telah menyiapkan jalur universitas impian dan program beasiswa untuk Anda. Ada rencana studi atau beasiswa yang ingin didiskusikan?`;
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
        sessionStorage.removeItem('uper_lead_submitted');
        sessionStorage.removeItem('uper_chat_human_mode');
        sessionStorage.removeItem('uper_chat_counselor_id');
        sessionStorage.removeItem('uper_pending_lead');
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
        successMsg: 'Contact details saved to CRM. An advisor will follow up according to the schedule.',
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
        successMsg: 'Contact details saved to CRM. An advisor will follow up according to the schedule.',
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
    if (!formName.trim() || !formPhone.trim() || !formEmail.trim() || !formInterest) {
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
          sessionStorage.setItem('uper_lead_submitted', 'true');
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
      console.error('[SUBMIT FORM ERROR]', err);
      trackFormSubmit('chatbot_lead_form', false, { reason: 'api_error', error: err.message || 'unknown' });
      setFormError(
        currentLang.startsWith('zh') 
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

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

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
    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: text,
      timestamp: new Date(),
      isComplete: true,
    };

    let activeHumanMode = isHumanMode;
    let extraSystemMsg: Message | null = null;

    // Detect natural language requests for speaking directly to a human/live agent
    const isHumanKeyword = /人工|客服|联系老师|微信|电话|真人|human|advisor|agent|representative|live|sarah|lili|jason|kevin|bicara langsung|bantuan/i.test(text);
    if (isHumanKeyword && !isHumanMode) {
      // Append user message first so they see their typing selection
      setMessages((prev) => [...prev, userMsg]);

      // Detect preferred counselor based on full context and current text
      const detectedCounselorId = detectBestCounselorId(messages, formInterest, text);
      
      if (!detectedCounselorId) {
        // System is unable to determine project. Let's provide the choice card.
        const selectMsg: Message = {
          id: 'select_project_counselor',
          role: 'assistant',
          content: currentLang.startsWith('zh')
            ? '为了分配最合适的专业领域顾问，请选择您想要咨询的具体项目：'
            : currentLang.startsWith('en')
            ? 'To connect you with the right specialist advisor, please select the specific program you want to consult about:'
            : 'Agar kami dapat menghubungkan Anda dengan konsultan spesialis yang tepat, silakan pilih program yang ingin Anda tanyakan:',
          timestamp: new Date(),
          isComplete: true,
        };

        setIsLoading(true);
        setTimeout(() => {
          setIsLoading(false);
          setMessages((prev) => [...prev, selectMsg]);
        }, 800);
        return;
      }

      setIsLoading(true);
      const matchedC = UPER_COUNSELORS.find(c => c.id === detectedCounselorId) || UPER_COUNSELORS[0];

      // Step 1: Detect and request transfer
      setSwitchingStep(
        currentLang.startsWith('zh') 
          ? '已为您检测到人工专属咨询需求，正在呼叫有关部门专家...' 
          : currentLang.startsWith('en')
          ? 'Live consultant request detected. Initializing specialized transfer...'
          : 'Deteksi permintaan admin manusia. Membuka jalur transfer spesialis...'
      );
      await new Promise((resolve) => setTimeout(resolve, 1400));

      // Step 2: Assign Counselor
      setSwitchingStep(
        currentLang.startsWith('zh') 
          ? `正在呼叫 ${matchedC.nameCn}（${matchedC.role.zh}），正在审阅对话背景...` 
          : currentLang.startsWith('en')
          ? `Connecting Counselor ${matchedC.name}. Reviewing previous conversation topics...`
          : `Menghubungkan Kak ${matchedC.name}. Menyelaraskan ringkasan percakapan...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1600));

      // Transition completes
      activeHumanMode = true;
      toggleHumanMode(true);
      setActiveCounselorId(detectedCounselorId);
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('uper_chat_counselor_id', detectedCounselorId);
        }
      } catch (_) {}
      setSwitchingStep('');

      // Create the transition message
      extraSystemMsg = {
        id: 'sys_' + Math.random().toString(36).substring(7),
        role: 'assistant',
        content: currentLang.startsWith('zh') 
          ? `🔔 **[系统提示]** 已成功无缝切换为 **人工专家顾问会话**！专属导师 **${matchedC.nameCn}** 已接入，正为您准备沟通解答...`
          : currentLang.startsWith('en')
          ? `🔔 **[System]** Successfully switched to **Live Specialist Consulting**. Our advisor **${matchedC.name}** has joined and is ready to assist you...`
          : `🔔 **[Sistem]** Berhasil berpindah ke **Mode Konsultan Manusia**! Mentor **${matchedC.name}** telah siaga dalam obrolan untuk melayani Anda...`,
        timestamp: new Date(),
        isComplete: true,
      };

      setMessages((prev) => {
        const nextMsgs = [...prev, extraSystemMsg!];
        if (!leadSubmitted) {
          nextMsgs.push({
            id: 'inline_lead_form_prompt_handover',
            role: 'assistant',
            content: currentLang.startsWith('zh')
              ? '为了顾问老师能更高效、精准地协助您，建议您先登记一下联系信息与咨询意愿，以便老师在后续为您安排专属测评与预约规划：'
              : currentLang.startsWith('en')
              ? 'To help our advisor assist you more effectively, we recommend registering your details and preferences below:'
              : 'Untuk membantu konsultan kami melayani Anda lebih baik, kami menyarankan Anda mengisi detail bidang dan kontak Anda di bawah:',
            timestamp: new Date(),
            isComplete: true,
          });
        }
        return nextMsgs;
      });
    } else {
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
    }

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

      if (!activeHumanMode) {
        // P2: SSE Streaming Mode for AI Chatbot
        const botMsgId = Math.random().toString(36).substring(7);
        let streamStarted = false;

        const res = await chatFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: historyContext,
            isHumanMode: false,
            counselorId: activeCounselorId,
            studentContext: studentContext || getStudentContext(),
            stream: true
          }),
          signal: controller.signal
        }, 'homepage_widget');

        if (!res.ok) {
          let serverErrorMsg = '';
          try {
            const errData = await res.json();
            serverErrorMsg = errData.error || errData.details || '';
          } catch (_) {}
          throw new Error(serverErrorMsg || 'Network error generating response');
        }

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
                  reply = '';
                  receivedSuggestions = [];
                  setMessages((prev) => prev.map((m) => m.id === botMsgId ? { ...m, content: '', suggestedPrompts: [] } : m));
                }
                if (parsed.chunk) {
                  reply += parsed.chunk;
                  if (!streamStarted) {
                    streamStarted = true;
                    setIsLoading(false);
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: botMsgId,
                        role: 'assistant',
                        content: reply,
                        timestamp: new Date(),
                        isComplete: true
                      }
                    ]);
                  } else {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === botMsgId ? { ...m, content: reply } : m))
                    );
                  }
                }
                if (parsed.done) {
                  if (Array.isArray(parsed.suggestedPrompts)) {
                    receivedSuggestions = parsed.suggestedPrompts;
                  }
                  if (parsed.modelUsed) {
                    setActiveModelUsed(parsed.modelUsed);
                  }
                  if (parsed.reply && !reply) {
                    reply = parsed.reply;
                  }
                }
              } catch (_) {}
            }
          }
        } else {
          const data = await res.json();
          if (data.modelUsed) {
            setActiveModelUsed(data.modelUsed);
          }
          reply = (data.reply || '').trim();
          receivedSuggestions = data.suggestedPrompts || [];
          setMessages((prev) => [
            ...prev,
            {
              id: botMsgId,
              role: 'assistant',
              content: reply,
              timestamp: new Date(),
              isComplete: false
            }
          ]);
        }

        setIsLoading(false);
        setSuggestedPrompts(receivedSuggestions);
      } else {
        // Human Mode with realistic counselor delay
        const res = await chatFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: historyContext,
            isHumanMode: true,
            counselorId: activeCounselorId,
            studentContext: studentContext || getStudentContext(),
            stream: false
          }),
          signal: controller.signal
        }, 'homepage_widget');

        if (!res.ok) {
          let serverErrorMsg = '';
          try {
            const errData = await res.json();
            serverErrorMsg = errData.error || errData.details || '';
          } catch (_) {}
          throw new Error(serverErrorMsg || 'Network error generating response');
        }

        const data = await res.json();
        if (data.modelUsed) {
          setActiveModelUsed(data.modelUsed);
        }
        reply = (data.reply || '').trim() || (currentLang.startsWith('zh') ? '对不起，系统当前繁忙，请稍后重新发送您的问题。' : 'Maaf, sistem sedang sibuk. Silakan coba sebentar lagi.');
        receivedSuggestions = data.suggestedPrompts || [];

        const len = reply.length;
        const hasMarkdownLists = (reply.match(/^[\s*-+•\d+\.]/gm) || []).length >= 2;
        const hasHeaders = reply.includes('#') || reply.includes('**');
        const hasUrlsOrContacts = reply.includes('http') || reply.includes('+62') || reply.includes('@uper');
        const isCopyPaste = len > 220 || (len > 120 && (hasMarkdownLists || hasHeaders || hasUrlsOrContacts));

        let delayTime = 1500;
        if (isCopyPaste) {
          delayTime = Math.min(2500, 1000 + len * 2);
        } else {
          const msPerChar = len < 40 ? 45 : len < 90 ? 35 : 25;
          delayTime = Math.min(5500, 600 + len * msPerChar);
        }
        await new Promise((resolve) => setTimeout(resolve, delayTime));

        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            role: 'assistant',
            content: reply,
            timestamp: new Date(),
            isComplete: false
          }
        ]);
        setSuggestedPrompts(receivedSuggestions);
      }

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
                  ? '💡 **[顾问贴士]** 想要获得更高效、个性化的留学解答，并接收由 AI 生成的本次对话深度分析总结邮件，建议您在下面登记您的个人信息。专属教育顾问将在24小时内携测评方案与您主动触达：'
                  : currentLang.startsWith('en')
                  ? '💡 **[Advisor Tip]** To obtain highly personalized consultation answers and receive an automated AI dialogue summary emailed to you, we recommend registering your details below. An expert will reach out within 24 hours!'
                  : '💡 **[Perhatian]** Untuk memudahkan analisis mendalam serta mendapatkan ringkasan percakapan yang disusun AI ini ke email Anda, silakan mengisi formulir kontak di bawah ini. Konsultan kami akan segera menghubungi Anda dalam 24 jam!',
                timestamp: new Date(),
                isComplete: true,
              }
            ];
          });
        }, 3500); // 3.5 seconds delay to let typewriter complete most of the main text
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      
      const serverErrorMessage = error?.message || '';
      const isTimeout = error.name === 'AbortError' || serverErrorMessage.toLowerCase().includes('timeout');
      
      let detailMsg = '';
      if (isTimeout) {
        detailMsg = currentLang.startsWith('zh')
          ? '\n\n【 诊断提示：连接超时。目前 DeepSeek-V3 接口线路可能较为拥堵，建议稍后双击对话框重新输入。 】'
          : currentLang.startsWith('en')
          ? '\n\n【 Diagnosis: Connection Timeout. The DeepSeek-V3 API route may be temporarily congested, please try resending in a moment. 】'
          : '\n\n【 Diagnosis: Koneksi Timeout. Jalur API DeepSeek-V3 mungkin sedang padat, silakan coba kirim ulang beberapa saat lagi. 】';
      } else if (serverErrorMessage) {
        detailMsg = `\n\nDetail: ${serverErrorMessage}`;
      }

      let errorText = `Maaf, terjadi kesalahan koneksi. Silakan hubungi admin kami melalui WhatsApp (+62 811-1661-2062).${detailMsg}`;
      if (currentLang.startsWith('zh')) {
        errorText = `抱歉，连接服务器失败。请点击右下角通过 WhatsApp 联系我们的顾问老师协助您（+62 811-1661-2062）。${detailMsg}`;
      } else if (currentLang.startsWith('en')) {
        errorText = `Sorry, a connection error occurred. Please get in touch directly with our advisors over WhatsApp at +62 811-1661-2062.${detailMsg}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: errorText,
          timestamp: new Date(),
          isComplete: false,
        },
      ]);
      setSuggestedPrompts([]);
    } finally {
      clearTimeout(timeoutId);
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

  const handleInitiateHumanMode = async (preferredId?: string) => {
    const initialId = preferredId || detectBestCounselorId(messages, formInterest);

    if (!initialId) {
      // Ambiguous! Ask user to select from choice menu card.
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: 'select_project_counselor',
          role: 'assistant',
          content: currentLang.startsWith('zh')
            ? '为了您可以分配最合适的专业领域老师，请选择您想要咨询的具体项目：'
            : currentLang.startsWith('en')
            ? 'To connect you with the right specialist advisor, please select the specific program you want to consult about:'
            : 'Agar kami dapat menghubungkan Anda dengan konsultan spesialis yang tepat, silakan pilih program yang ingin Anda tanyakan:',
          timestamp: new Date(),
          isComplete: true,
        }
      ]);
      return;
    }

    setIsLoading(true);
    const targetCounselor = UPER_COUNSELORS.find(c => c.id === initialId) || UPER_COUNSELORS[0];
    
    // Step 1: Establish Connection
    setSwitchingStep(
      currentLang.startsWith('zh') 
        ? `正在发起人工服务申请，呼叫雅加达总部专属顾问 ${targetCounselor.nameCn}...` 
        : currentLang.startsWith('en')
        ? `Calling helper line, connecting to ${targetCounselor.name} at Jakarta HQ...`
        : `Menghubungkan ke layanan akademik, memanggil Kak ${targetCounselor.name}...`
    );
    await new Promise((resolve) => setTimeout(resolve, 1400));

    // Step 2: Counselor accepted, syncing history
    setSwitchingStep(
      currentLang.startsWith('zh') 
        ? `专属领域教师已接入会话，正连线 ${targetCounselor.nameCn}...` 
        : currentLang.startsWith('en')
        ? `Academic specialist accepted. Swapping dialogue with ${targetCounselor.name}...`
        : `Hubungan diterima. Mengarahkan obrolan ke spesialis Kak ${targetCounselor.name}...`
    );
    await new Promise((resolve) => setTimeout(resolve, 1600));

    // Step 3: Complete Connection
    setActiveCounselorId(initialId);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('uper_chat_counselor_id', initialId);
      }
    } catch (_) {}

    toggleHumanMode(true);
    setSwitchingStep('');
    setIsLoading(false);

    setMessages((prev) => {
      const nextMsgs = [...prev];
      nextMsgs.push({
        id: 'sys_' + Math.random().toString(36).substring(7),
        role: 'assistant',
        content: currentLang.startsWith('zh') 
          ? targetCounselor.connectedText.zh
          : currentLang.startsWith('en')
          ? targetCounselor.connectedText.en
          : targetCounselor.connectedText.id,
        timestamp: new Date(),
        isComplete: true,
      });

      if (!leadSubmitted) {
        nextMsgs.push({
          id: 'inline_lead_form_prompt_handover',
          role: 'assistant',
          content: currentLang.startsWith('zh')
            ? '为了顾问老师能更高效、精准地协助您，建议您先登记一下联系信息与咨询意愿，以便老师在后续为您安排专属测评与预约规划：'
            : currentLang.startsWith('en')
            ? 'To help our advisor assist you more effectively, we highly recommend registering your details and program preferences below:'
            : 'Untuk membantu konsultan kami melayani Anda lebih baik, kami sangat menyarankan Anda mengisi detail bidang dan kontak Anda di bawah:',
          timestamp: new Date(),
          isComplete: true,
        });
      }
      return nextMsgs;
    });
  };

  const currentStarterPrompts = getStarterPrompts();

  // Do not display on the official uperedu.com domain and subdomains
  const isOfficialProduction = 
    typeof window !== 'undefined' && 
    (window.location.hostname === 'uperedu.com' || window.location.hostname.endsWith('.uperedu.com'));

  if (isOfficialProduction) {
    return null;
  }

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
          aria-label="Toggle UPER AI Customer Service"
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
            onMouseEnter={() => {
              if (isDesktop && typeof document !== 'undefined' && document.body) {
                document.body.style.overflow = 'hidden';
              }
            }}
            onMouseLeave={() => {
              if (isDesktop && typeof document !== 'undefined' && document.body) {
                document.body.style.overflow = '';
              }
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
                {isHumanMode ? (
                  <div className="relative animate-fade-in">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${getCurrentCounselor().gradient} flex items-center justify-center border border-white/10 shadow-md`}>
                      <span className="font-extrabold text-sm text-white">{getCurrentCounselor().avatarChar}</span>
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    isApple 
                      ? 'bg-slate-100 border-slate-200/60' 
                      : 'bg-primary-600/25 border-primary-500/20'
                  }`}>
                    <Sparkles className={`w-5.5 h-5.5 ${isApple ? 'text-slate-800' : 'text-primary-400'}`} />
                  </div>
                )}
                <div>
                  <h3 className={`font-bold text-sm tracking-tight flex items-center gap-1.5 whitespace-nowrap ${
                    isApple ? 'text-slate-850 font-semibold' : 'text-white'
                  }`}>
                    {isHumanMode ? (
                      <span>{currentLang.startsWith('zh') ? getCurrentCounselor().nameCn : getCurrentCounselor().name}</span>
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
                        ? getCurrentCounselor().role.zh 
                        : currentLang.startsWith('en') 
                        ? getCurrentCounselor().role.en 
                        : getCurrentCounselor().role.id
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
                      className={`mr-1 shadow-sm px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isApple 
                          ? 'bg-slate-900 hover:bg-slate-850 text-white border-slate-950 shadow-none' 
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-amber-500/20'
                      }`}
                      title={currentLang.startsWith('zh') ? '转客服人员' : currentLang.startsWith('en') ? 'Speak to Human' : 'Bicara Konsultan'}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{currentLang.startsWith('zh') ? '转为人工' : currentLang.startsWith('en') ? 'Live Help' : 'Chat Konsultan'}</span>
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
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5">
                        {getFormText().phone} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder={getFormText().phonePlaceholder}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white text-slate-800 text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-400"
                        disabled={formLoading}
                        id="form-phone"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5">
                        {getFormText().email} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder={getFormText().emailPlaceholder}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white text-slate-800 text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-400"
                        disabled={formLoading}
                        id="form-email"
                      />
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
                            {studentContext.assessment.levelConfirmed || 'HSK 1'}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-[11px] leading-tight flex items-center gap-1">
                              <span>{currentLang.startsWith('zh') ? '已打通独立舱测评档案' : currentLang.startsWith('en') ? 'Placement Lab Profile Synced' : 'Profil Tes Penempatan Terhubung'}</span>
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </span>
                            <span className="text-[10px] text-slate-500 font-sans">
                              {currentLang.startsWith('zh') 
                                ? `得分: ${studentContext.assessment.score ?? 'N/A'}/${studentContext.assessment.total ?? 15} · 状态: 已同步`
                                : `Score: ${studentContext.assessment.score ?? 'N/A'}/${studentContext.assessment.total ?? 15} · Status: Verified`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowAssessmentCard(!showAssessmentCard)}
                            className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md transition-all cursor-pointer"
                          >
                            {showAssessmentCard ? (currentLang.startsWith('zh') ? '收起' : 'Hide') : (currentLang.startsWith('zh') ? '详情' : 'Detail')}
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
                          {studentContext.assessment.summary && (
                            <div className="p-2 bg-white/80 rounded-lg border border-primary-100 text-[11px] text-slate-700 leading-relaxed font-sans">
                              <p className="font-bold text-slate-900 mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary-700">
                                <span>{currentLang.startsWith('zh') ? '官方能力诊断报告' : 'Official Diagnostic Report'}</span>
                              </p>
                              <p className="line-clamp-4">{studentContext.assessment.summary}</p>
                            </div>
                          )}

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
                                          {currentLang.startsWith('zh') ? `${c.nameCn} (${c.name})` : `Counselor ${c.name}`}
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
                                isHuman={isHumanMode && !m.id.startsWith('sys_')}
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
                          {m.role === 'assistant' && !m.id.startsWith('sys_') && (isHumanMode ? `${getCurrentCounselor().name} • ` : 'UPER AI • ')}
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
                              currentLang.startsWith('zh') ? getCurrentCounselor().typingText.zh : currentLang.startsWith('en') ? getCurrentCounselor().typingText.en : getCurrentCounselor().typingText.id
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
                    <span>Powered by {formatModelName(activeModelUsed)}</span>
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
