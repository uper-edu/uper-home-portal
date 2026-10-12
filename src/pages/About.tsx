import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Globe2, Target, Users, Sparkles, ChevronDown, ArrowRight, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/SEO';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDesignStyle } from '../utils/theme';

export default function About() {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  
  const featuredFaqs = [
    {
      id: 'q1',
      question: t('faq.items.0.question'),
      answer: t('faq.items.0.answer')
    },
    {
      id: 'q3',
      question: t('faq.items.2.question'),
      answer: t('faq.items.2.answer')
    },
    {
      id: 'q6',
      question: t('faq.items.5.question'),
      answer: t('faq.items.5.answer')
    }
  ];

  return (
    <div className="pt-32 pb-20">
      <SEO 
        title={t('meta.about.title', 'About Us')} 
        description={t('meta.about.description', 'Learn about UPER\'s mission to connect Southeast Asian students with educational opportunities in China.')} 
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
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}
          >
            <Globe2 className="w-4 h-4" />
            <span>{t('about.tag', 'About UPER')}</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight"
          >
            {t('about.title1', 'Building Educational')} <span className="text-gradient">{t('about.title2', 'Bridges')}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-600"
          >
            {t('about.desc', 'Welcome to UPER...')}
          </motion.p>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={`bg-white p-10 rounded-3xl relative overflow-hidden transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'shadow-xl shadow-slate-200/50 border border-slate-100'
            }`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full -z-0 ${
              isApple ? 'bg-slate-50' : 'bg-primary-50'
            }`}></div>
            <div className="relative z-10">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/50' : 'bg-primary-100 text-primary-600'
              }`}>
                <Target className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-slate-900">{t('about.missionTitle', 'Our Mission')}</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                {t('about.missionDesc1')}
              </p>
              <p className="text-slate-600 leading-relaxed">
                {t('about.missionDesc2')}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={`bg-white p-10 rounded-3xl relative overflow-hidden transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'shadow-xl shadow-slate-200/50 border border-slate-100'
            }`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-0"></div>
            <div className="relative z-10">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/50' : 'bg-slate-100 text-slate-700'
              }`}>
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-slate-900">{t('about.visionTitle', 'Our Vision')}</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                {t('about.visionDesc1')}
              </p>
              <p className="text-slate-600 leading-relaxed">
                {t('about.visionDesc2')}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Team / Image Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl overflow-hidden relative aspect-[21/9] shadow-2xl"
        >
          <img 
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1600" 
            alt="Students collaborating" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end p-8 md:p-12">
            <div className="max-w-2xl text-white">
              <h3 className="text-3xl font-bold mb-4">{t('about.teamTitle', 'A Team of Education Experts')}</h3>
              <p className="text-slate-200 text-lg">
                {t('about.teamDesc')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Embedded FAQ Section */}
        <div className="mt-28 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}>
              <HelpCircle className="w-4 h-4" />
              <span>{t('faq.tag', 'Instant Solutions')}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              {t('faq.title1', 'Frequently Asked')} <span className="text-gradient">{t('faq.title2', 'Questions')}</span>
            </h2>
          </div>

          <div className="space-y-4">
            {featuredFaqs.map((faq, index) => {
              const isOpen = openFaq === faq.id;
              return (
                <div 
                  key={faq.id} 
                  className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isOpen 
                      ? (isApple ? 'border-slate-300 shadow-sm' : 'border-primary-100 shadow-xl shadow-primary-100/10') 
                      : (isApple ? 'border-slate-200/80 hover:border-slate-300' : 'border-slate-100 hover:border-slate-200 shadow-sm')
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                    className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold select-none mt-0.5 ${
                        isApple ? 'bg-slate-100 text-slate-800' : 'bg-primary-50 text-primary-600'
                      }`}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="font-extrabold text-slate-900 text-base md:text-lg leading-snug">
                        {faq.question}
                      </span>
                    </div>
                    <span className={`flex-shrink-0 w-5 h-5 rounded-md bg-slate-50 flex items-center justify-center text-slate-400 transition-transform duration-200 mt-0.5 ${
                      isOpen ? (isApple ? 'rotate-180 text-slate-800 bg-slate-100' : 'rotate-180 text-primary-600 bg-primary-50') : ''
                    }`}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-6 pb-5 text-slate-600 border-t border-slate-50/50 pt-3 pl-6">
                          <div className="prose prose-slate max-w-none text-sm md:text-base text-slate-600 leading-relaxed prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:text-slate-900 prose-strong:font-semibold">
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

          <div className="text-center mt-10">
            <Link 
              to="/faq" 
              className={`inline-flex items-center gap-2 font-extrabold transition-all group cursor-pointer text-sm ${
                isApple ? 'text-[#0071e3] hover:text-[#0077ed]' : 'text-primary-600 hover:text-primary-700'
              }`}
            >
              <span>{t('faq.viewAllQuestions', 'View All FAQs')}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
