import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  FileText, 
  Globe, 
  DollarSign, 
  ArrowRight, 
  HelpCircle, 
  ChevronDown,
  Compass,
  Edit3,
  Send,
  Users,
  Plane,
  Play,
  X,
  Quote,
  Sparkles,
  CheckCircle2,
  Calendar,
  Award,
  Video
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/SEO';
import { useDesignStyle } from '../utils/theme';
import ProgramFAQPortal from '../components/ProgramFAQPortal';
import { client } from '../sanityClient';
import imageUrlBuilder from '../sanityClient';

const builder = imageUrlBuilder(client);
function urlFor(source: any) {
  try {
    if (!source) {
      const emptyHelper: any = {
        width: () => emptyHelper,
        height: () => emptyHelper,
        fit: () => emptyHelper,
        auto: () => emptyHelper,
        url: () => ''
      };
      return emptyHelper;
    }
    if (typeof source === 'string') {
      const stringHelper: any = {
        width: () => stringHelper,
        height: () => stringHelper,
        fit: () => stringHelper,
        auto: () => stringHelper,
        url: () => source
      };
      return stringHelper;
    }
    if (!source.asset || !source.asset._ref) {
      const emptyHelper: any = {
        width: () => emptyHelper,
        height: () => emptyHelper,
        fit: () => emptyHelper,
        auto: () => emptyHelper,
        url: () => ''
      };
      return emptyHelper;
    }
    return builder.image(source);
  } catch (e) {
    const emptyHelper: any = {
      width: () => emptyHelper,
      height: () => emptyHelper,
      fit: () => emptyHelper,
      auto: () => emptyHelper,
      url: () => ''
    };
    return emptyHelper;
  }
}

interface StudentStory {
  _id: string;
  name: string;
  school: string;
  quote: string;
  image?: any;
  certificateImage?: any;
  program?: string;
  scholarship?: string;
  admissionDate?: string;
}

export default function StudyAbroad() {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();

  // State for Roadmap
  const [activeStep, setActiveStep] = useState(0);

  // State for Success Stories
  const [stories, setStories] = useState<StudentStory[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<string | null>(null);

  // Load Stories from Sanity without Fallback
  useEffect(() => {
    setIsLoadingStories(true);
    client.fetch(`*[_type == "admissionsList"]`)
      .then((data) => {
        if (data && data.length > 0) {
          // Map Sanity fields to StudentStory
          const mapped = data.map((item: any) => ({
            _id: item._id,
            name: item.name,
            school: item.school,
            quote: item.quote,
            image: item.image,
            certificateImage: item.certificateImage,
            program: item.program || "Academic Program",
            scholarship: item.scholarship || "Full Scholarship",
            admissionDate: item.admissionDate
          }));
          setStories(mapped);
        } else {
          setStories([]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch stories from Sanity:', err);
        setStories([]);
      })
      .finally(() => {
        setIsLoadingStories(false);
      });
  }, []);

  const servicesTranslation = t('abroad.services', { returnObjects: true });
  const servicesItems = Array.isArray(servicesTranslation) ? servicesTranslation : [{},{},{},{}];
  const services = [
    {
      icon: <GraduationCap className="w-7 h-7" />,
      title: servicesItems[0]?.title || "Tailored Academic Planning",
      desc: servicesItems[0]?.desc || "",
      bgClass: "bg-blue-50 group-hover:bg-blue-100",
      textClass: "text-blue-600 group-hover:text-blue-700"
    },
    {
      icon: <FileText className="w-7 h-7" />,
      title: servicesItems[1]?.title || "Application Process Support",
      desc: servicesItems[1]?.desc || "",
      bgClass: "bg-emerald-50 group-hover:bg-emerald-100",
      textClass: "text-emerald-600 group-hover:text-emerald-700"
    },
    {
      icon: <Globe className="w-7 h-7" />,
      title: servicesItems[2]?.title || "Visa & Pre-Departure",
      desc: servicesItems[2]?.desc || "",
      bgClass: "bg-purple-50 group-hover:bg-purple-100",
      textClass: "text-purple-600 group-hover:text-purple-700"
    },
    {
      icon: <DollarSign className="w-7 h-7" />,
      title: servicesItems[3]?.title || "Scholarship Guidance",
      desc: servicesItems[3]?.desc || "",
      bgClass: "bg-orange-50 group-hover:bg-orange-100",
      textClass: "text-orange-600 group-hover:text-orange-700"
    }
  ];

  // Roadmap Data
  const roadmapSteps = [
    {
      id: 1,
      timeframe: "Sept - Nov",
      title: t("abroad.roadmap.step1.title", "评估定位与目标规划"),
      englishTitle: "Assessment & Planning",
      desc: t("abroad.roadmap.step1.desc", "Establish target universities & matching scholarship tracks (CSC, SGS, CIS, etc.) based on early profile auditing."),
      icon: <Compass className="w-6 h-6" />,
      checklist: [
        t("abroad.roadmap.step1.item1", "Profile evaluation & GPA transcript auditing"),
        t("abroad.roadmap.step1.item2", "Research interest matching (for graduate applicants)"),
        t("abroad.roadmap.step1.item3", "HSK & HSKK score diagnosis & diagnostic timeline setup"),
        t("abroad.roadmap.step1.item4", "Scholarship strategy selection (Type A, Type B, or Local Gov)")
      ],
      tip: t("abroad.roadmap.step1.tip", "UPER Mentor Hack: Getting evaluated early gives you a 3-month head start in contacting prospective advisors!"),
      color: "from-blue-500 to-sky-500",
      lightColor: "bg-blue-50/70 text-blue-700 border-blue-100/60 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400",
      accentColor: "blue"
    },
    {
      id: 2,
      timeframe: "Nov - Jan",
      title: t("abroad.roadmap.step2.title", "背景提升与文书精磨"),
      englishTitle: "Document Strategy & Essays",
      desc: t("abroad.roadmap.step2.desc", "Collaborate 1-on-1 with elite mentors to draft compelling, story-driven Personal Statements and Study Plans."),
      icon: <Edit3 className="w-6 h-6" />,
      checklist: [
        t("abroad.roadmap.step2.item1", "Personal Statement & Study Plan deep brainstorming sessions"),
        t("abroad.roadmap.step2.item2", "1-on-1 revisions with masters/PhD alumni from Tsinghua & Peking U"),
        t("abroad.roadmap.step2.item3", "Academic resume (CV) structure and layout optimization"),
        t("abroad.roadmap.step2.item4", "Secure recommendation letters from senior faculty members")
      ],
      tip: t("abroad.roadmap.step2.tip", "UPER Mentor Hack: A distinctive study plan explaining your cultural integration value is the #1 decision maker for CSC boards!"),
      color: "from-emerald-500 to-teal-500",
      lightColor: "bg-emerald-50/70 text-emerald-700 border-emerald-100/60 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400",
      accentColor: "emerald"
    },
    {
      id: 3,
      timeframe: "Jan - Mar",
      title: t("abroad.roadmap.step3.title", "官方系统网申提报"),
      englishTitle: "Portal Launch & Submissions",
      desc: t("abroad.roadmap.step3.desc", "Execute synchronous applications across multiple university admissions portals and government platforms."),
      icon: <Send className="w-6 h-6" />,
      checklist: [
        t("abroad.roadmap.step3.item1", "University portal profile setup and document uploads"),
        t("abroad.roadmap.step3.item2", "Chinese Government Scholarship (CSC) online system registration"),
        t("abroad.roadmap.step3.item3", "Application fee processing and physical exam forms validation"),
        t("abroad.roadmap.step3.item4", "Pre-admission track monitoring and immediate corrective actions")
      ],
      tip: t("abroad.roadmap.step3.tip", "UPER Mentor Hack: Submitting early in January ensures your file gets reviewed by the first-round panel when budgets are peak!"),
      color: "from-purple-500 to-indigo-500",
      lightColor: "bg-purple-50/70 text-purple-700 border-purple-100/60 dark:bg-purple-950/20 dark:border-purple-900/30 dark:text-purple-400",
      accentColor: "purple"
    },
    {
      id: 4,
      timeframe: "Mar - May",
      title: t("abroad.roadmap.step4.title", "面试模拟与审核追踪"),
      englishTitle: "Interviews & Auditing",
      desc: t("abroad.roadmap.step4.desc", "Refine oral academic expression through authentic simulated mock sessions with UPER's alumni advisory panel."),
      icon: <Users className="w-6 h-6" />,
      checklist: [
        t("abroad.roadmap.step4.item1", "Realistic mock interviews with former scholars & elite alumni"),
        t("abroad.roadmap.step4.item2", "Answering frameworks preparation (Academic goals, regional adaptation)"),
        t("abroad.roadmap.step4.item3", "Math, science, or program-specific technical exam guidelines"),
        t("abroad.roadmap.step4.item4", "Tracking waitlists and providing supplemental achievements")
      ],
      tip: t("abroad.roadmap.step4.tip", "UPER Mentor Hack: Keep your answers focused on how you will bridge academic research between China and your home region!"),
      color: "from-amber-500 to-orange-500",
      lightColor: "bg-amber-50/70 text-amber-700 border-amber-100/60 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400",
      accentColor: "amber"
    },
    {
      id: 5,
      timeframe: "June - Aug",
      title: t("abroad.roadmap.step5.title", "签证办结与行前启航"),
      englishTitle: "Visas & Pre-Departure",
      desc: t("abroad.roadmap.step5.desc", "Claim your official admissions package containing original JW201/202 forms and finalize your relocation roadmap."),
      icon: <Plane className="w-6 h-6" />,
      checklist: [
        t("abroad.roadmap.step5.item1", "Collection and validation of official Admission Notices and JW201/202s"),
        t("abroad.roadmap.step5.item2", "X1 study visa application at regional embassies/consulates"),
        t("abroad.roadmap.step5.item3", "UPER exclusive pre-departure briefing (SIMs, banking, housing)"),
        t("abroad.roadmap.step5.item4", "Dorm reservations, airport greetings, and PPIT peer matching")
      ],
      tip: t("abroad.roadmap.step5.tip", "UPER Mentor Hack: Joining UPER's exclusive active students network in China ensures you have peers welcoming you on campus!"),
      color: "from-rose-500 to-red-500",
      lightColor: "bg-rose-50/70 text-rose-700 border-rose-100/60 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400",
      accentColor: "rose"
    }
  ];

  const getWhatsAppUrl = (stepIndex: number) => {
    const step = roadmapSteps[stepIndex];
    if (!step) return "https://wa.me/6281116612062";
    
    const stepNum = stepIndex + 1;
    const currentLang = i18n.language || 'zh';
    
    let text = "";
    if (currentLang.startsWith('zh')) {
      text = `您好 UPER！我对“${step.title}”（${step.timeframe}）这一阶段的留学服务很感兴趣，想进行详细咨询并寻求相关帮助。`;
    } else if (currentLang.startsWith('id')) {
      text = `Halo UPER! Saya sangat tertarik dengan tahap "Langkah ${stepNum}: ${step.title}" (${step.timeframe}) dalam pendaftaran studi di China, dan ingin berkonsultasi lebih lanjut.`;
    } else {
      text = `Hello UPER! I'm interested in the "Step ${stepNum}: ${step.title}" (${step.timeframe}) stage of the application. I would love to get more details and consulting on this step.`;
    }
    
    return `https://wa.me/6281116612062?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="pt-32 pb-20">
      <SEO 
        title={t('meta.consultancy.title', 'Study Abroad Consultancy')} 
        description={t('meta.consultancy.description', 'Comprehensive guidance for university selection and scholarship applications in China.')} 
        canonicalUrl="https://uperedu.com/consultancy"
        breadcrumbs={[
          { name: 'Home', url: 'https://uperedu.com' },
          { name: 'Study Abroad Consultancy', url: 'https://uperedu.com/consultancy' }
        ]}
        schemaData={{
          "@type": "Service",
          "name": "Chinese University Admissions & CSC Scholarship Consultancy",
          "serviceType": "Study Abroad Consulting",
          "provider": {
            "@type": "EducationalOrganization",
            "name": "PT UPER EDUCATION TECHNOLOGY"
          },
          "areaServed": "ID"
        }}
      />
      
      {/* Dynamic Certificate Modal (Lightbox) */}
      <AnimatePresence>
        {selectedCertificate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setSelectedCertificate(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative max-w-4xl max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-2 flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all cursor-pointer shadow-lg"
                onClick={() => setSelectedCertificate(null)}
                aria-label="Close certificate"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={selectedCertificate}
                alt="Admission Certificate"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' 
                : 'bg-primary-50 border border-primary-100 text-primary-600 dark:bg-primary-950/20 dark:border-primary-900/30 dark:text-primary-400'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>{t("abroad.tag", "Consultancy Services")}</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 dark:text-white tracking-tight"
          >
            {t("abroad.title1", "Your Journey to ")} <span className="text-gradient">{t("abroad.title2", "Top Universities.")}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-600 dark:text-slate-350"
          >
            {t("abroad.desc")}
          </motion.p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-24">
          {services.map((srv, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white dark:bg-slate-900 p-10 rounded-3xl border transition-all duration-300 group ${
                isApple 
                  ? 'border-slate-200/50 dark:border-slate-800 shadow-none hover:border-slate-300 dark:hover:border-slate-700' 
                  : 'border-slate-100 dark:border-slate-800/80 shadow-xl shadow-slate-200/40 dark:shadow-none hover:border-primary-200 dark:hover:border-primary-900'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{srv.title}</h3>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shrink-0 ml-4 -mt-5 -mr-5 shadow-sm ${
                  isApple 
                    ? 'bg-slate-100 text-slate-800 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' 
                    : `${srv.bgClass} ${srv.textClass} dark:bg-slate-800 dark:text-primary-400`
                }`}>
                  {srv.icon}
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg mt-1">{srv.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* 交互式申请路线图 / Interactive Application Roadmap */}
        <section className="mb-24">
          <div className="text-center max-w-3xl mx-auto mb-16 relative">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border ${
              isApple 
                ? 'bg-slate-100 border-slate-200/60 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200' 
                : 'bg-primary-50 border border-primary-100 text-primary-600 dark:bg-primary-950/20 dark:border-primary-900/30 dark:text-primary-400'
            }`}>
              <Calendar className="w-3.5 h-3.5" />
              <span>{t("abroad.roadmap.tag", "APPLICATION PIPELINE")}</span>
            </div>
            <h2 className="text-3xl md:text-4.5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {t("abroad.roadmap.title", "中国顶尖名校申请路线图")}
            </h2>
            <p className="text-slate-600 dark:text-slate-450 text-sm md:text-base leading-relaxed">
              {t("abroad.roadmap.desc", "清晰掌握申请规划，从定位到获发签证，UPER全程贴心保驾护航。点击各阶段了解核心任务与导师锦囊。")}
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Steps Left Panel (Desktop) */}
            <div className="lg:col-span-5 space-y-4 hidden lg:block">
              {roadmapSteps.map((step, idx) => {
                const isActive = activeStep === idx;
                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(idx)}
                    className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                      isActive
                        ? isApple
                          ? 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-sm'
                          : `bg-white dark:bg-slate-900 border-l-4 border-l-${step.accentColor}-500 shadow-lg shadow-slate-200/50 dark:shadow-none border-slate-200/80 dark:border-slate-800`
                        : 'bg-white dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        isActive
                          ? isApple 
                            ? 'bg-slate-900 text-white border-slate-800' 
                            : `bg-gradient-to-tr ${step.color} text-white border-transparent`
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-800'
                      }`}>
                        {step.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-mono uppercase tracking-widest font-extrabold px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-black/5 dark:bg-white/10 text-slate-800 dark:text-slate-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {step.timeframe}
                          </span>
                        </div>
                        <h4 className={`font-bold transition-colors ${
                          isActive 
                            ? 'text-slate-900 dark:text-white' 
                            : 'text-slate-700 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                        }`}>
                          {step.title}
                        </h4>
                      </div>
                    </div>
                    <ArrowRight className={`w-5 h-5 transition-transform duration-300 ${
                      isActive 
                        ? 'translate-x-1 text-slate-800 dark:text-slate-200' 
                        : 'text-slate-300 dark:text-slate-700 group-hover:translate-x-0.5'
                    }`} />
                  </button>
                );
              })}
            </div>

            {/* Desktop Details Panel (Right) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-[2rem] p-8 md:p-10 shadow-xl shadow-slate-200/30 dark:shadow-none min-h-[500px] flex flex-col justify-between hidden lg:flex">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-3 border ${
                        isApple 
                          ? 'bg-slate-50 border-slate-200/60 text-slate-700 dark:bg-slate-850 dark:border-slate-750 dark:text-slate-300' 
                          : roadmapSteps[activeStep].lightColor
                      }`}>
                        {roadmapSteps[activeStep].timeframe}
                      </div>
                      <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        {roadmapSteps[activeStep].title}
                      </h3>
                      <p className="text-xs font-mono tracking-wider text-slate-400 uppercase mt-1">
                        {roadmapSteps[activeStep].englishTitle}
                      </p>
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                      isApple 
                        ? 'bg-slate-100 text-slate-800 border-slate-200/50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-750 shadow-none' 
                        : `text-white bg-gradient-to-tr ${roadmapSteps[activeStep].color} shadow-lg shadow-slate-200/50 dark:shadow-none`
                    }`}>
                      {roadmapSteps[activeStep].icon}
                    </div>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm md:text-base">
                    {roadmapSteps[activeStep].desc}
                  </p>

                  <div className="space-y-3.5 pt-2">
                    <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
                      {t("abroad.roadmap.coreChecks", "CORE CHECKS")}
                    </h5>
                    <ul className="grid sm:grid-cols-2 gap-3">
                      {roadmapSteps[activeStep].checklist.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-350 leading-relaxed">
                           <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`p-4 rounded-2xl border flex gap-3 items-start ${
                    isApple 
                      ? 'bg-slate-50 border-slate-200/80 text-slate-800 dark:bg-slate-800/40 dark:border-slate-750/60 dark:text-slate-200' 
                      : roadmapSteps[activeStep].lightColor
                  }`}>
                    <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed font-medium">
                      {roadmapSteps[activeStep].tip}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center mt-6">
                <span className="text-xs font-mono text-slate-400">
                  {t("abroad.roadmap.stepIndicator", { current: activeStep + 1, total: 5 })}
                </span>
                <a
                  href={getWhatsAppUrl(activeStep)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-white transition-all shadow-md ${
                    isApple 
                      ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                      : `bg-gradient-to-r ${roadmapSteps[activeStep].color} hover:shadow-lg hover:scale-[1.01]`
                  }`}
                >
                  <span>{t("abroad.roadmap.getHelp", { step: activeStep + 1 })}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Mobile / Tablet Accordion View (Always Visible on smaller screens) */}
            <div className="lg:hidden space-y-4">
              {roadmapSteps.map((step, idx) => {
                const isOpen = activeStep === idx;
                return (
                  <div
                    key={step.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isOpen 
                        ? 'border-slate-300 dark:border-slate-750 shadow-md' 
                        : 'border-slate-200/50 dark:border-slate-850 hover:border-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => setActiveStep(isOpen ? -1 : idx)}
                      className="w-full flex items-center justify-between p-5 text-left gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                          isApple
                            ? isOpen
                              ? 'bg-slate-900 text-white border-slate-850 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-200'
                              : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-800'
                            : `text-white bg-gradient-to-tr ${step.color} border-transparent`
                        }`}>
                          {step.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-slate-400 bg-slate-50 dark:bg-slate-850 px-1.5 py-0.5 rounded-full">
                              {step.timeframe}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            {step.title}
                          </h4>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-slate-800 dark:text-slate-200' : ''
                      }`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-5 pb-5 pt-1 border-t border-slate-50 dark:border-slate-850 space-y-4">
                            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                              {step.desc}
                            </p>

                            <div className="space-y-2.5">
                              <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
                                {t("abroad.roadmap.coreChecks", "CORE CHECKS")}
                              </h5>
                              <ul className="space-y-2">
                                {step.checklist.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-350 leading-relaxed">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className={`p-3 rounded-xl border flex gap-2.5 items-start ${
                              isApple 
                                ? 'bg-slate-50 border-slate-200/80 text-slate-800 dark:bg-slate-800/40 dark:border-slate-750/60 dark:text-slate-200' 
                                : step.lightColor
                            }`}>
                              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                              <p className="text-[11px] leading-relaxed font-medium">
                                {step.tip}
                              </p>
                            </div>

                            <div className="pt-3">
                              <a
                                href={getWhatsAppUrl(idx)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-full text-xs font-bold text-white transition-all ${
                                  isApple 
                                    ? 'bg-[#0071e3] hover:bg-[#0077ed]' 
                                    : `bg-gradient-to-r ${step.color}`
                                }`}
                              >
                                <span>{t("abroad.roadmap.getHelp", { step: idx + 1 })}</span>
                                <ArrowRight className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Elite Mentors Essay Tailoring Section */}
        <section className={`mb-24 py-16 px-8 md:px-12 text-white rounded-3xl relative overflow-hidden transition-all duration-300 ${
          isApple 
            ? 'bg-[#1c1c1e] border border-slate-800 shadow-none' 
            : 'bg-gradient-to-tr from-primary-900/90 to-slate-900 border border-primary-900/50 shadow-2xl'
        }`}>
          <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
            isApple ? 'bg-slate-800/30' : 'bg-primary-500/20'
          }`} />
          <div className={`absolute -bottom-10 -left-10 w-64 h-64 rounded-full blur-2xl pointer-events-none ${
            isApple ? 'bg-slate-850/20' : 'bg-primary-500/10'
          }`} />
          
          <div className="relative z-10 grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-5 ${
                isApple 
                  ? 'bg-slate-100/10 border border-white/10 text-slate-300' 
                  : 'bg-primary-500/20 border border-primary-500/35 text-primary-100'
              }`}>
                <FileText className="w-3.5 h-3.5" />
                <span>{t("abroad.mentors.tag", "高端定制文书 | Essay Tailoring")}</span>
              </div>
              <h2 className="text-3xl md:text-4.5xl font-extrabold mb-6 tracking-tight text-white">
                {t("abroad.mentors.title", "名校导师文书定制")}
              </h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-8">
                {t("abroad.mentors.desc", "文书（Personal Statement / Study Plan）是顶尖高校筛选和奖学金评估中，展现个人独特性与核心学术竞争力的最关键依据。UPER 专属名校导师文书定制服务，颠覆传统的模板化翻译，为您打造触动名校招生官的黄金履历。")}
              </p>

              {/* Grid bullet points */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <h4 className="font-bold text-slate-100 text-sm mb-1">{t("abroad.mentors.p1.title", "顶尖名校硕博导师团队")}</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">{t("abroad.mentors.p1.desc", "由清华大学、北京大学、复旦大学、上海交通大学等知名中国高校优秀硕博学长学姐、校友、行业精英全程担任编辑，深谙招生面试底层逻辑。")}</p>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <h4 className="font-bold text-slate-100 text-sm mb-1">{t("abroad.mentors.p2.title", "1对1全深度定制体系")}</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">{t("abroad.mentors.p2.desc", "从头脑风暴开始，挖掘学生的独特背景亮点、升学规划、科研学术及课外成长线，制定完全不可替代的自述故事线。")}</p>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <h4 className="font-bold text-slate-100 text-sm mb-1">{t("abroad.mentors.p3.title", "学术及母语级精确打磨")}</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">{t("abroad.mentors.p3.desc", "母语级中英文双语精细校对。不仅提升词汇、语法及学术逻辑链条，更确保叙事视角完全符合中国顶尖高校申请表达体系。")}</p>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <h4 className="font-bold text-slate-100 text-sm mb-1">{t("abroad.mentors.p4.title", "极高录取及奖学金成功率")}</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">{t("abroad.mentors.p4.desc", "经由此计划精修的奖学金自述书，成功斩获卓越全额政府及大学理事会金级奖学金概率平均提升140%以上。")}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 relative mt-6 lg:mt-0 flex justify-center">
              <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl relative">
                <div className="p-5 border-b border-white/10 bg-black/40 flex justify-between items-center">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{t("abroad.draft.header", "Scholar Study Plan Draft")}</span>
                </div>
                <div className="p-6 font-mono text-[11px] leading-relaxed text-slate-300 space-y-4">
                  <p className="text-slate-400">// {t("abroad.draft.comment", "UPER Elite Mentor Edit Block")}</p>
                  <p><b className="text-blue-400">{t("abroad.draft.profileLabel", "Student Profile:")}</b> {t("abroad.draft.profileValue", "International Applicant (Jakarta PIK)")}</p>
                  <p><b className="text-amber-400">{t("abroad.draft.targetLabel", "Target University:")}</b> {t("abroad.draft.targetValue", "Peking University (北京大学)")}</p>
                  <p className={`border-l-2 pl-3 italic text-slate-400 bg-white/[0.02] p-2 rounded ${isApple ? 'border-slate-500' : 'border-primary-500'}`}>
                    {t("abroad.draft.quote", "\"My cross-disciplinary approach in computational linguistics has fueled local Indonesian educational models, inspired by deep heritage...\"")}
                  </p>
                  <p className="text-green-400">✓ {t("abroad.draft.result", "Academic Narrative: EXCELLENT / 定制叙事极其卓越")}</p>
                  <p className={`${isApple ? 'text-blue-400' : 'text-primary-400'}`}>✓ {t("abroad.draft.score", "Scholarship Compatibility: 98.7%")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 成功案例墙 / Success Case Wall */}
        {(isLoadingStories || stories.length > 0 || (import.meta as any).env.DEV) && (
          <section className="mb-24">
            <div className="text-center max-w-3xl mx-auto mb-16 relative">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border ${
                isApple 
                  ? 'bg-slate-100 border-slate-200/60 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200' 
                  : 'bg-primary-50 border border-primary-100 text-primary-600 dark:bg-primary-950/20 dark:border-primary-900/30 dark:text-primary-400'
              }`}>
                <Award className="w-3.5 h-3.5" />
                <span>{t("abroad.cases.tag", "STUDENT TRIUMPHS")}</span>
              </div>
              <h2 className="text-3xl md:text-4.5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                {t("abroad.cases.title", "名校录取与奖学金荣誉墙")}
              </h2>
              <p className="text-slate-600 dark:text-slate-450 text-sm md:text-base leading-relaxed">
                {t("abroad.cases.desc", "每一个卓越梦校录取，背后都是个性化背景定位与极具说服力的学术故事。可随时在Sanity后台动态配置更新。")}
              </p>
            </div>

            {isLoadingStories ? (
              <div className="grid md:grid-cols-3 gap-8">
                {[1, 2, 3].map((placeholder) => (
                  <div key={placeholder} className="bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-850 h-80 rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : stories.length === 0 ? (
              <div className="py-12 bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 rounded-3xl p-8 text-center max-w-2xl mx-auto">
                <h3 className="font-bold text-lg mb-2">🔧 [DEV MODE] No Data Found for Admissions List</h3>
                <p className="text-sm opacity-90">
                  This entire section is completely hidden in <strong>Production</strong> because no items were returned from Sanity.
                  Ensure you have created and published documents of type <code>admissionsList</code> in your Sanity Studio.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-8">
                {stories.map((story, idx) => {
                  const storyImage = story.image ? urlFor(story.image)?.width(400).height(400).url() : null;
                  const finalImage = storyImage || story.image || "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=400&h=400";
                  
                  const storyCert = story.certificateImage ? (typeof story.certificateImage === 'string' ? story.certificateImage : urlFor(story.certificateImage)?.url()) : null;
                  const certFallbacks = [
                    "https://images.unsplash.com/photo-1589330694653-ded6df53f6ee?auto=format&fit=crop&q=80&w=800",
                    "https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?auto=format&fit=crop&q=80&w=800",
                    "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&q=80&w=800"
                  ];
                  const finalCert = storyCert || (typeof story.certificateImage === 'string' ? story.certificateImage : null) || certFallbacks[idx % certFallbacks.length];
                  
                  return (
                    <motion.div
                      key={story._id}
                      initial={{ opacity: 0, y: 25 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className={`relative rounded-3xl p-6 md:p-8 flex flex-col justify-between group border transition-all duration-300 ${
                        isApple
                          ? 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 shadow-none hover:border-slate-300 dark:hover:border-slate-700'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-200/40 dark:shadow-none hover:shadow-xl hover:border-slate-200'
                      }`}
                    >
                      <Quote className="absolute top-6 right-6 w-12 h-12 text-slate-100/60 dark:text-slate-800/40 pointer-events-none transform rotate-180" />
                      
                      <div>
                        {/* Scholarship & Intake Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border leading-none ${
                            isApple 
                              ? 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700' 
                              : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30'
                          }`}>
                            <Award className="w-3 h-3 shrink-0" />
                            <span>{story.scholarship}</span>
                          </span>
                          {story.admissionDate && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border leading-none ${
                              isApple 
                                ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/40 dark:border-slate-700/80' 
                                : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30'
                            }`}>
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{story.admissionDate}</span>
                            </span>
                          )}
                        </div>

                        {/* Quote Text */}
                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-6 italic relative z-10">
                          "{story.quote}"
                        </p>
                      </div>

                      {/* Student Info Block */}
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-5 mt-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={finalImage}
                            alt={story.name}
                            className="w-11 h-11 rounded-full object-cover border-2 border-slate-100 dark:border-slate-800 shrink-0 shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                              {story.name}
                            </h4>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-1 leading-tight">
                              {story.school}
                            </p>
                            {story.program && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight font-medium">
                                {story.program}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Optional Admission Certificate Button */}
                        {finalCert && (
                          <button
                            onClick={() => {
                              setSelectedCertificate(finalCert);
                            }}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                              isApple 
                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200' 
                                : 'bg-primary-50 hover:bg-primary-100 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400 dark:hover:bg-primary-900/40'
                            }`}
                            title={t('abroad.cases.viewCert', 'View Admission Certificate')}
                            aria-label="View admission certificate"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Why Choose Us */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`p-10 md:p-16 rounded-3xl border flex flex-col md:flex-row items-center gap-12 transition-all duration-300 ${
            isApple ? 'bg-[#fcfcfd] border-slate-200/50 dark:bg-slate-900 dark:border-slate-800 shadow-none' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="md:w-1/2">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900 dark:text-white tracking-tight">{t("abroad.why.title")}</h2>
            <p className="text-lg text-slate-600 dark:text-slate-350 leading-relaxed mb-6">
              {t("abroad.why.desc")}
            </p>
            <blockquote className={`pl-6 py-2 text-xl italic text-slate-700 dark:text-slate-300 font-serif mb-8 border-l-4 ${
              isApple ? 'border-slate-400 dark:border-slate-600' : 'border-primary-500'
            }`}>
              "{t("abroad.why.quote")}"
            </blockquote>
            <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-white px-8 py-4 rounded-full font-medium transition-all cursor-pointer ${
              isApple 
                ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30 dark:shadow-none'
            }`}>
              {t("abroad.why.btn")} <ArrowRight className="w-5 h-5" />
            </a>
          </div>
          <div className="md:w-1/2 w-full">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200" 
                alt="University campus" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </motion.div>

        {/* Study Abroad Subpage FAQs Section */}
        <StudyAbroadFAQsAccordion />

        {/* Study Abroad FAQ Portal */}
        <div className="mt-20">
          <ProgramFAQPortal program="Study Abroad" />
        </div>

      </div>
    </div>
  );
}

const StudyAbroadFAQsAccordion = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [openId, setOpenId] = React.useState<string | null>('q1'); // Open first item by default

  // Retrieve translated FAQ items under faq.items index
  const items = t('faq.items', { returnObjects: true });
  const allFaqs = Array.isArray(items) ? items : [];
  
  // Custom filter to pick 5 prominent Study Abroad questions
  const selectedIds = ['q1', 'q2', 'q9', 'q10', 'q11'];
  const faqs = allFaqs.filter(f => selectedIds.includes(f.id));

  return (
    <div className="mt-32 mb-20">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full mb-4 border ${
          isApple 
            ? 'bg-slate-100 border-slate-200/60 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200' 
            : 'bg-primary-50 border-primary-100 text-primary-600 dark:bg-primary-950/30 dark:border-primary-900/30 dark:text-primary-400'
        }`}>
          {t('faq.tag', 'Instant Solutions')}
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">
          {t('faq.abroadTitlePrefix', 'Study-Abroad ')}{t('faq.title1', 'Frequently Asked')} <span className="text-gradient">{t('faq.title2', 'Questions')}</span>
        </h2>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div 
              key={faq.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition-all duration-300 ${
                isApple 
                  ? 'border-slate-200/50 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-none' 
                  : 'border-slate-100 dark:border-slate-800/80 shadow-sm hover:border-primary-200 dark:hover:border-primary-900'
              }`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-800 dark:text-slate-200 gap-4 cursor-pointer"
              >
                <span>{faq.question}</span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-300 ${
                  isOpen 
                    ? isApple 
                      ? 'rotate-180 text-[#0071e3]' 
                      : 'rotate-180 text-primary-500'
                    : 'text-slate-400'
                }`} />
              </button>
              
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6 pt-2 border-t border-slate-50 dark:border-slate-850 text-slate-600 dark:text-slate-400 leading-relaxed text-sm whitespace-pre-line">
                      {faq.answer.replace(/\*\*/g, '')}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
