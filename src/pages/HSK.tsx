import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { BookOpen, Award, BarChart, CheckCircle2, Bot, Sparkles, BrainCircuit, LineChart, HelpCircle, ArrowRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEO } from '../components/SEO';
import { hskFaqsByLang } from '../data/hskFaqs';
import { useDesignStyle } from '../utils/theme';
import ProgramFAQPortal from '../components/ProgramFAQPortal';

export default function HSK() {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();

  const levelsTranslation = t("hsk.levels", { returnObjects: true });
  const levels = Array.isArray(levelsTranslation) ? levelsTranslation : [
    { level: "HSK 1-2", title: "Beginner", desc: "Fundamental Chinese expressions and basic communication skills for beginners." },
    { level: "HSK 3-4", title: "Intermediate", desc: "Intermediate language skills for everyday situations and academic contexts." },
    { level: "HSK 5-6", title: "Advanced", desc: "Advanced proficiency for highly complex topics and professional environments." }
  ];

  const currentFaqs = hskFaqsByLang[i18n.language] || hskFaqsByLang['id'] || [];
  const topFaqs = currentFaqs.slice(0, 6).map(f => ({
    question: f.question,
    answer: f.answer.replace(/[#*`]/g, '').slice(0, 300)
  }));

  return (
    <div className="pt-32 pb-20">
      <SEO 
        title={t('meta.hsk.title', 'AI-Assisted HSK Training')} 
        description={t('meta.hsk.description', 'Master Chinese with our AI-assisted HSK training programs.')} 
        canonicalUrl="https://uperedu.com/hsk"
        breadcrumbs={[
          { name: 'Home', url: 'https://uperedu.com' },
          { name: 'HSK Training', url: 'https://uperedu.com/hsk' }
        ]}
        faqs={topFaqs}
        courseData={{
          name: 'UPER HSK 3.0 & HSKK Mandarin Training',
          description: 'Structured Mandarin language coaching for HSK 1 through HSK 6 and HSKK oral certifications co-developed with BLCU standards.',
          provider: 'PT UPER EDUCATION TECHNOLOGY'
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                : 'bg-tech-50 border border-tech-100 text-tech-600'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>{t("hsk.header.tag")}</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight"
          >
            {t("hsk.header.title1")} <span className="text-gradient">{t("hsk.header.title2")}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-600"
          >
            {t("hsk.header.desc")}
          </motion.p>
        </div>

        {/* Levels Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {levels.map((lvl, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white p-8 rounded-3xl relative overflow-hidden transition-all duration-300 ${
                isApple ? 'border border-slate-200/50 shadow-none' : 'border border-slate-100 shadow-xl shadow-slate-200/40'
              }`}
            >
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -z-0 ${
                isApple ? 'bg-slate-100/60' : 'bg-gradient-to-br from-primary-50 to-tech-50'
              }`}></div>
              <div className="relative z-10">
                <div className="inline-block px-4 py-1.5 rounded-full bg-slate-900 text-white font-bold text-sm mb-6">
                  {lvl.level}
                </div>
                <h3 className="text-2xl font-bold mb-3 text-slate-900">{lvl.title}</h3>
                <p className="text-slate-600 leading-relaxed">{lvl.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Methodology & Resources */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900 tracking-tight">{t("hsk.methodology.title")}</h2>
            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
              {t("hsk.methodology.desc")}
            </p>
            <ul className="space-y-4">
              {(Array.isArray(t("hsk.methodology.items", { returnObjects: true })) ? t("hsk.methodology.items", { returnObjects: true }) as string[] : ['Interactive classroom discussions', 'Intensive listening & speaking exercises', 'Multimedia resources & role-plays', 'Comprehensive study materials & mock exams']).map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${isApple ? 'text-slate-700' : 'text-primary-500'}`} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl overflow-hidden shadow-2xl border border-slate-100 aspect-square md:aspect-[4/3]"
          >
            <img 
              src="https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=1200" 
              alt="Students studying" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

        {/* BLCU Teaching & Research System Support Section */}
        <div className={`py-16 px-8 md:px-12 rounded-3xl border mb-24 relative overflow-hidden transition-all duration-300 ${
          isApple 
            ? 'bg-[#fcfcfd] border-slate-200/50 shadow-none' 
            : 'bg-gradient-to-tr from-sky-50 via-white to-primary-50 border-sky-100 shadow-xl shadow-sky-200/20'
        }`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 grid md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-7">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
                isApple 
                  ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                  : 'bg-primary-50 border border-primary-100 text-primary-600'
              }`}>
                <BookOpen className="w-4 h-4" />
                <span>{t("hsk.blcu.tag", "权威学术支撑 | Academic Authority")}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 tracking-tight">
                {t("hsk.blcu.title", "北语教研体系支持")}
              </h2>
              <p className="text-slate-600 text-[15px] md:text-base leading-relaxed mb-8 max-w-2xl">
                {t("hsk.blcu.desc", "依托“对外汉语”摇篮——北京语言大学（BLCU）正统深厚、权威卓越的教研底蕴，结合现代先进科技，专门量身定制更精准、全方位的精英中文课程体系。")}
              </p>
              
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="flex gap-3">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${isApple ? 'text-slate-700' : 'text-primary-500'}`} />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{t("hsk.blcu.point1.title", "北京语言大学教研体系支持")}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{t("hsk.blcu.point1.desc", "对接北语高标准对外汉语教学大纲与学术考量指标")}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${isApple ? 'text-slate-700' : 'text-primary-500'}`} />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{t("hsk.blcu.point2.title", "北语名师团队指导")}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{t("hsk.blcu.point2.desc", "由北京语言大学一线资深对外汉语名师全程监督及设计指导")}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${isApple ? 'text-slate-700' : 'text-primary-500'}`} />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{t("hsk.blcu.point3.title", "中文国际教育专业背景")}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{t("hsk.blcu.point3.desc", "汇聚中印两地一流对外汉语硕博教研背景人才支持")}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${isApple ? 'text-slate-700' : 'text-primary-500'}`} />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{t("hsk.blcu.point4.title", "HSK教学研究优势")}</h4>
                    <p className="text-slate-500 text-xs mt-0.5">{t("hsk.blcu.point4.desc", "极极优势的HSK新课纲演进研究，对考点难点多维度精准穿透")}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-5 relative group">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-white/60 relative z-10 bg-slate-100">
                <img 
                  id="hsk-blcu-academic-image"
                  src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=800" 
                  alt="BLCU academic campus building" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-4 right-4 left-4 sm:left-auto bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-slate-100/80 flex items-center gap-3 z-20">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 shadow-sm">
                    <img 
                      id="hsk-blcu-logo-overlay"
                      src="/blcu-logo.png" 
                      alt="BLCU Logo" 
                      className="w-full h-full object-contain p-1 mix-blend-multiply"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="text-left">
                    <div className={`text-[10px] font-extrabold uppercase tracking-wider leading-none ${
                      isApple ? 'text-slate-800' : 'text-primary-600'
                    }`}>Academic Partner</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5 whitespace-nowrap">Beijing Language & Culture Univ.</div>
                  </div>
                </div>
              </div>
              <div className={`absolute -inset-2 rounded-3xl blur-md -z-0 opacity-40 ${
                isApple ? 'bg-slate-300' : 'bg-gradient-to-tr from-sky-300 to-primary-300'
              }`} />
            </div>
          </div>
        </div>

        {/* Future AI Vision */}
        <FutureAIVision />

        {/* HSK Subpage FAQ Section */}
        <HSKFAQsAccordion />

        {/* HSK FAQ Portal */}
        <div className="mb-20">
          <ProgramFAQPortal program="HSK" />
        </div>

        {/* Certification Benefits */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-slate-900 rounded-3xl p-10 md:p-16 text-center text-white relative overflow-hidden"
        >
          <div className={`absolute inset-0 blur-3xl ${
            isApple ? 'bg-slate-900/40' : 'bg-gradient-to-tr from-primary-900/50 to-tech-900/50'
          }`}></div>
          <div className="relative z-10 max-w-3xl mx-auto">
            <Award className={`w-16 h-16 mx-auto mb-6 ${isApple ? 'text-slate-300' : 'text-primary-400'}`} />
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white tracking-tight">{t("hsk.benefits.title")}</h2>
            <p className="text-xl text-slate-300 leading-relaxed mb-10">
              {t("hsk.benefits.desc")}
            </p>
            <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center text-white px-8 py-4 rounded-full font-medium transition-all text-lg ${
              isApple 
                ? 'bg-white/15 hover:bg-white/25 border border-white/10 shadow-none' 
                : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30'
            }`}>
              {t("hsk.benefits.btn")}
            </a>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

const FutureAIVision = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const itemsTranslation = t("hsk.vision.items", { returnObjects: true });
  const items = Array.isArray(itemsTranslation) ? itemsTranslation : [{},{},{}];
  const features = [
    {
      icon: <BrainCircuit className="w-7 h-7" />,
      title: items[0]?.title || "Adaptive Learning Paths",
      desc: items[0]?.desc || "",
      bgClass: "bg-blue-50",
      textClass: "text-blue-600"
    },
    {
      icon: <Bot className="w-7 h-7" />,
      title: items[1]?.title || "24/7 Virtual Tutor",
      desc: items[1]?.desc || "",
      bgClass: "bg-emerald-50",
      textClass: "text-emerald-600"
    },
    {
      icon: <LineChart className="w-7 h-7" />,
      title: items[2]?.title || "Predictive Exam Scoring",
      desc: items[2]?.desc || "",
      bgClass: "bg-purple-50",
      textClass: "text-purple-600"
    }
  ];

  return (
    <div className="mb-24">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple 
              ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
              : 'bg-tech-50 border border-tech-100 text-tech-600'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t("hsk.vision.tag")}</span>
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl md:text-4xl font-bold mb-6 text-slate-900"
        >
          {t("hsk.vision.title1")} <span className="text-gradient">{t("hsk.vision.title2")}</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-slate-600"
        >
          {t("hsk.vision.desc")}
        </motion.p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {features.map((feature, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden group hover:border-tech-300 transition-colors"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-tech-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mb-3 border border-slate-200">
                    {t("hsk.vision.inDevelopment")}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{feature.title}</h3>
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ml-4 -mt-4 -mr-4 ${feature.bgClass} ${feature.textClass}`}>
                  {feature.icon}
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed text-sm mt-1">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};



const HSKFAQsAccordion = () => {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();
  const [openId, setOpenId] = React.useState<string | null>('hsk_q1'); // Open first item by default

  const lang = (i18n.language || 'en').split('-')[0];
  const currentLang = ['en', 'zh', 'id'].includes(lang) ? lang : 'en';
  
  // Specific list of top 5 HSK FAQs that are most relevant
  const selectedIds = ['hsk_q1', 'hsk_q2', 'hsk_q3', 'hsk_q6', 'hsk_q53'];
  const allFaqs = hskFaqsByLang[currentLang] || hskFaqsByLang['en'] || [];
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
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
          HSK {t('faq.title1', 'Frequently Asked')} <span className="text-gradient">{t('faq.title2', 'Questions')}</span>
        </h2>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div 
              key={faq.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                isApple 
                  ? 'border-slate-200/50 hover:border-slate-300 shadow-none' 
                  : 'border-slate-100 shadow-sm hover:border-primary-200'
              }`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-800 gap-4"
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
                    <div className="px-6 pb-6 pt-2 border-t border-slate-50 text-slate-600 leading-relaxed text-sm">
                      <div className="prose prose-slate max-w-none text-sm text-slate-600 leading-relaxed prose-p:my-1 prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1.5 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-1.5 prose-li:my-0.5 prose-table:w-full prose-table:border-collapse prose-table:my-4 prose-th:bg-slate-50 prose-th:border prose-th:border-slate-200 prose-th:p-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-slate-800 prose-td:border prose-td:border-slate-200 prose-td:p-2.5 prose-td:text-slate-600">
                        <Markdown remarkPlugins={[remarkGfm]}>{faq.answer}</Markdown>
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
  );
};

