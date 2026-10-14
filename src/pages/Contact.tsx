import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, Mail, MessageCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/SEO';
import { trackFormSubmit, trackConsultationClick } from '../utils/analytics';
import { useDesignStyle } from '../utils/theme';

export default function Contact() {
  const submissionKey=useRef(crypto.randomUUID());
  const { t, i18n } = useTranslation();
  const localeText=(en:string,id:string,zh:string)=>i18n.language.startsWith('zh')?zh:i18n.language.startsWith('id')?id:en;
  const { isApple } = useDesignStyle();
  const focusRingClass = isApple ? 'focus:ring-[#0071e3]' : 'focus:ring-primary-500';
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    interest: 'Study Tours',
    message: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error content when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (submitError) {
      setSubmitError('');
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) {
      newErrors.fullName = t('contactPage.errors.nameRequired', 'Full Name is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = t('contactPage.errors.emailRequired', 'Email Address is required');
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = t('contactPage.errors.emailInvalid', 'Please enter a valid email address');
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = t('contactPage.errors.phoneRequired', 'Mobile Phone is required');
    } else if (!/^\+?[\d\s-]{8,20}$/.test(formData.phone)) {
      newErrors.phone = t('contactPage.errors.phoneInvalid', 'Please enter a valid phone number');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitting(true);
      setSubmitError('');
      try {
        const response = await fetch('/api/inquiry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({...formData,requestId:submissionKey.current}),
        });

        const data = await response.json();

        if (response.ok && data.saved === true) {
          setIsSuccess(true);submissionKey.current=crypto.randomUUID();
          trackFormSubmit('contact_inquiry_form', true, { interest: formData.interest });
          setFormData({
            fullName: '',
            email: '',
            phone: '',
            interest: 'Study Tours',
            message: ''
          });
          // Reset success message after 5 seconds
          setTimeout(() => setIsSuccess(false), 5000);
        } else {
          const detailStr = data.details ? `: ${data.details}` : '';
          setSubmitError(`${data.error || 'Failed to submit inquiry'}${detailStr}`);
          trackFormSubmit('contact_inquiry_form', false, { reason: 'api_error', error: data.error || 'Failed' });
        }
      } catch (err: any) {
        console.error('Error submitting form:', err);
        setSubmitError('A network error occurred. Please try again later.');
        trackFormSubmit('contact_inquiry_form', false, { reason: 'network_error', error: err.message || 'unknown' });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      trackFormSubmit('contact_inquiry_form', false, { reason: 'validation_error' });
    }
  };

  return (
    <div className="pt-32 pb-20">
      <SEO 
        title={t('meta.contact.title', 'Contact Us')} 
        description={t('meta.contact.description', 'Get in touch with UPER for business inquiries, partnerships, or program information.')} 
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
            <MessageCircle className="w-4 h-4" />
            <span>{t("contact.tag", "Contact Us")}</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight"
          >
            {t("contact.title1", "Get in ")} <span className="text-gradient">{t("contact.title2", "Touch")}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600"
          >
            {t("contact.desc")}
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Jakarta Head Office */}
            <div className={`bg-white p-7 rounded-3xl transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'border border-slate-100 shadow-xl shadow-slate-200/40'
            }`}>
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/50' : 'bg-primary-50 text-primary-600'
                }`}>
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                      Indonesia HQ
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1.5 text-slate-900">{t("contactPage.headOffice", "Head Office")}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {t("contactPage.headOfficeAddress", "Ruko Golf Island, JL. Pantai Indah Kapuk No. 100 Blok E, Jakarta, Daerah Khusus Ibukota Jakarta")}
                  </p>
                </div>
              </div>
              <div className="w-full h-40 rounded-2xl overflow-hidden mt-5 border border-slate-200 isolation-auto">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3967.2405786307374!2d106.74102217596853!3d-6.098254293888365!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e6a1d4e082877a5%3A0x644c3fb2b6387063!2sRukan%20Golf%20Island%20PIK!5e0!3m2!1sen!2sid!4v1715096500000!5m2!1sen!2sid" 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                  title="UPER Head Office location map"
                ></iframe>
              </div>
            </div>

            {/* China Office (Hangzhou) */}
            <div className={`bg-white p-7 rounded-3xl transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'border border-slate-100 shadow-xl shadow-slate-200/40'
            }`}>
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/50' : 'bg-amber-50 text-amber-600'
                }`}>
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      China Office
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1.5 text-slate-900">{t("contactPage.chinaOffice", "China Office")}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">
                    {t("contactPage.chinaOfficeAddress", "Headquarters Economy Park for Alumni Corporation of Zhejiang University")}
                  </p>

                  {/* Representative Info */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block">{t("contactPage.chinaRepresentative", "China Representative")}</span>
                      <span className="font-semibold text-slate-900">{t("contactPage.chinaContactPerson", "王力松")}</span>
                    </div>
                    <a 
                      href="tel:+8618612142789"
                      onClick={() => trackConsultationClick('phone', '+86 18612142789')}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        isApple 
                          ? 'bg-slate-900 text-white hover:bg-slate-800' 
                          : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                      }`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>+86 18612142789</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp & Hotline */}
            <div className={`bg-white p-6 rounded-3xl flex items-start gap-5 transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'border border-slate-100 shadow-xl shadow-slate-200/40'
            }`}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[#25D366]/10 text-[#25D366]">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold mb-1 text-slate-900">{t("contactPage.whatsappPhone", "WhatsApp & Phone")}</h3>
                <p className="text-slate-600 text-sm mb-3">
                  +62 811-1661-2062
                </p>
                <a 
                  href="https://wa.me/6281116612062" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => trackConsultationClick('whatsapp', '+62 811-1661-2062')}
                  className="inline-flex items-center gap-2 text-sm text-[#25D366] font-semibold hover:text-[#1da851] transition-colors"
                >
                  {t("contactPage.freeConsultNow", "Free consult with us NOW!")} &rarr;
                </a>
              </div>
            </div>

            {/* Email */}
            <div className={`bg-white p-6 rounded-3xl flex items-start gap-5 transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'border border-slate-100 shadow-xl shadow-slate-200/40'
            }`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/50' : 'bg-tech-50 text-tech-600'
              }`}>
                <Mail className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold mb-1 text-slate-900">{t("contactPage.email", "Email")}</h3>
                <p className="text-slate-600 text-sm mb-3">
                  service@uperedu.com
                </p>
                <a 
                  href="mailto:service@uperedu.com" 
                  onClick={() => trackConsultationClick('email', 'service@uperedu.com')}
                  className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${
                    isApple ? 'text-[#0071e3] hover:text-[#0077ed]' : 'text-tech-600 hover:text-tech-700'
                  }`}
                >
                  {t("contactPage.sendEmail", "Send an email")} &rarr;
                </a>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className={`bg-white p-10 rounded-3xl flex flex-col justify-center relative overflow-hidden transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'shadow-xl shadow-slate-200/50 border border-slate-100'
            }`}
          >
            <AnimatePresence>
              {isSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 bg-white z-10 flex flex-col items-center justify-center p-10 text-center"
                >
                  <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{t("contactPage.thankYou", "Thank you!")}</h3>
                  <p className="text-slate-600">{localeText('Your inquiry has been received. Our team will review it and follow up.','Pertanyaan Anda telah diterima. Tim kami akan meninjau dan menindaklanjutinya.','您的咨询已收到，团队将审核并跟进。')}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <h3 className="text-3xl font-bold mb-6 text-slate-900">{t("contactPage.sendMessage", "Send us a message")}</h3>
            <p className="text-slate-500 mb-8">{localeText('Complete the form so our team can review your inquiry.','Lengkapi formulir agar tim kami dapat meninjau pertanyaan Anda.','请填写表单，便于团队审核您的咨询。')}</p>
            
            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              {submitError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                  <span>{submitError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("contactPage.fullName", "Full Name")}</label>
                <input 
                  type="text" 
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.fullName ? 'border-red-500 focus:ring-red-500' : `border-slate-200 ${focusRingClass}`} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 transition-all`} 
                  placeholder="John Doe" 
                />
                {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("contactPage.emailAddress", "Email Address")}</label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.email ? 'border-red-500 focus:ring-red-500' : `border-slate-200 ${focusRingClass}`} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 transition-all`} 
                  placeholder="john@example.com" 
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("contactPage.mobilePhone", "Mobile Phone")}</label>
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.phone ? 'border-red-500 focus:ring-red-500' : `border-slate-200 ${focusRingClass}`} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 transition-all`} 
                  placeholder="+62 812-3456-7890" 
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("contactPage.interestedIn", "Interested In")}</label>
                <select 
                  name="interest"
                  value={formData.interest}
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 ${focusRingClass} transition-all appearance-none`}
                >
                  <option value="Study Tours">{t("contactPage.interests.studyTours", "Study Tours")}</option>
                  <option value="HSK Training">{t("contactPage.interests.hskTraining", "HSK Training")}</option>
                  <option value="Study Abroad Consultancy">{t("contactPage.interests.studyAbroad", "Study Abroad Consultancy")}</option>
                  <option value="Other">{t("contactPage.interests.other", "Other")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t("contactPage.message", "Detailed Description")}</label>
                <textarea 
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 ${focusRingClass} transition-all resize-y`} 
                  placeholder={t("contactPage.messagePlaceholder", "Please describe your background, study goals, specific requests, etc...")}
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`w-full text-white px-8 py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                } ${
                  isApple 
                    ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                    : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t("contactPage.submitting", "Submitting...")}
                  </>
                ) : t("contactPage.submitInquiry", "Submit Inquiry")}
              </button>
            </form>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
