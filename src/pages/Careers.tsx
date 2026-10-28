import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  FileText, 
  Globe, 
  GraduationCap, 
  Laptop, 
  Sparkles, 
  Building2,
  AlertCircle,
  UploadCloud,
  X,
  Coins,
  Heart,
  Compass,
  BookOpen,
  Waves,
  Coffee,
  Target,
  Languages
} from 'lucide-react';
import { SEO } from '../components/SEO';
import { trackFormSubmit } from '../utils/analytics';
import { useDesignStyle } from '../utils/theme';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  headcount?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  salary?: string;
  benefits?: string[];
  kpis?: string[];
  languages?: string[];
}

export default function Careers() {
  const submissionKey=useRef(crypto.randomUUID());
  const { t, i18n } = useTranslation();
  const localeText=(en:string,id:string,zh:string)=>i18n.language.startsWith('zh')?zh:i18n.language.startsWith('id')?id:en;
  const { isApple } = useDesignStyle();
  const inputFocusClass = isApple ? 'focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10' : 'focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10';
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  
  // Application file upload states
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Application form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    roleId: '',
    experience: '',
    resumeUrl: '',
    coverLetter: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitErrorType, setSubmitErrorType] = useState<'validation' | 'server' | 'file_required' | null>(null);

  // Retrieve translatable jobs array
  const jobs = useMemo<Job[]>(() => {
    const rawJobs = t('careers.jobs', { returnObjects: true });
    if (Array.isArray(rawJobs)) {
      return rawJobs as Job[];
    }
    // Deep fallback
    return [
      {
        id: 'mandarin-tutor',
        title: 'Mandarin Language Instructor (HSK 1-6 Specialist)',
        department: 'Education & Curriculum',
        location: 'Jakarta PIK Office / Hybrid',
        type: 'Full-time / Part-time',
        headcount: '3 vacancies',
        description: 'Join our elite pedagogy team to elevate Mandarin oral and written competency among Indonesian high schoolers. Using UPER s proprietary AI-assisted learning platform, you will help students unlock top-percentile HSK scores.',
        requirements: [],
        responsibilities: []
      }
    ];
  }, [t]);

  // Retrieve translatable benefits list
  const benefitsList = useMemo(() => {
    const rawBenefits = t('careers.benefits.list', { returnObjects: true });
    if (Array.isArray(rawBenefits)) {
      return rawBenefits;
    }
    // High-quality defaults
    return [
      { title: 'Highly Competitive Reward Loops', desc: 'Favorable base salaries paired with generous performance bonuses.' },
      { title: 'Comprehensive Healthcare Coverage', desc: 'Full BPJS benefits alongside premium private supplementary insurance.' },
      { title: 'Cross-Border Travels & Delegations', desc: 'Fully-sponsored study advisor tours to partner first-class Chinese schools.' },
      { title: 'Learning & Tech Certifications', desc: 'Sizable personal growth budgets covering HSK pedagogy and content skill courses.' },
      { title: 'Elite Waterfront Workspace in PIK', desc: 'Work inside our modern, light-filled Golf Island PIK office with flexible hybrid modes.' },
      { title: 'Vibrant Cultural Celebrations & Snacks', desc: 'Interactive bi-lingual team-building camps and endless fresh master brews.' }
    ];
  }, [t]);

  // Set the default role based on clicked job or selector
  const handleJobApplyClick = (jobId: string) => {
    setFormData(prev => ({ ...prev, roleId: jobId }));
    setSelectedJob(jobId);
    
    // Auto scroll to form
    const formElement = document.getElementById('apply-form-section');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (file: File) => {
    setFileError(null);
    const allowedExtensions = ['pdf', 'doc', 'docx'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (!extension || !allowedExtensions.includes(extension)) {
      setFileError(t('careers.form.errorFileFormat', 'Allowed formats are PDF, DOC, or DOCX.'));
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setFileError(t('careers.form.errorFileSize', 'File size exceeds 10MB limit.'));
      return;
    }
    
    setResumeFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to read file as string'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(false);
    setSubmitErrorType(null);
    setFileError(null);
    
    // Validate required fields: Either resumeFile or resumeUrl must be provided
    const hasResume = resumeFile || (formData.resumeUrl && formData.resumeUrl.trim() !== '');
    if (!formData.name || !formData.email || !formData.phone || !formData.roleId || !hasResume) {
      setSubmitError(true);
      if (!hasResume) {
        setSubmitErrorType('file_required');
        setFileError(t('careers.form.errorFileRequired', 'Please attach your CV/Resume file or provide a cloud link.'));
      } else {
        setSubmitErrorType('validation');
      }
      trackFormSubmit('career_apply_form', false, { reason: 'validation_error' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const base64Content = resumeFile ? await getBase64(resumeFile) : "";
      const appliedJob = jobs.find(j => j.id === formData.roleId);
      const roleTitle = appliedJob ? appliedJob.title : formData.roleId;

      const payload = {
        requestId:submissionKey.current,
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        roleId: formData.roleId,
        roleTitle: roleTitle,
        experience: formData.experience,
        resumeUrl: formData.resumeUrl,
        coverLetter: formData.coverLetter,
        resumeFileBase64: base64Content,
        resumeFileName: resumeFile ? resumeFile.name : ""
      };

      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.saved === true) {
        setSubmitSuccess(true);submissionKey.current=crypto.randomUUID();
        trackFormSubmit('career_apply_form', true, { roleId: formData.roleId, roleTitle });
        setResumeFile(null);
        setFormData({
          name: '',
          email: '',
          phone: '',
          roleId: '',
          experience: '',
          resumeUrl: '',
          coverLetter: ''
        });
      } else {
        console.error('Submission failed:', data.error || data.details);
        setSubmitError(true);
        setSubmitErrorType('server');
        trackFormSubmit('career_apply_form', false, { reason: 'api_error', error: data.error || 'Failed' });
      }
    } catch (err: any) {
      console.error('Error during form submit:', err);
      setSubmitError(true);
      setSubmitErrorType('server');
      trackFormSubmit('career_apply_form', false, { reason: 'exception', error: err.message || 'unknown' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Structured data (Schema.org JobPosting) for Generative Search crawler indexing
  const jobPostingsSchema = useMemo(() => {
    if (!jobs || jobs.length === 0) return null;
    return {
      "@type": "ItemList",
      "name": t('nav.careers', 'Careers'),
      "itemListElement": jobs.map((job, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": job.title,
      })),
    };
  }, [jobs, t]);

  return (
    <div className="pt-32 pb-24 min-h-screen font-sans">
      <SEO 
        schemaData={jobPostingsSchema || undefined}
        title={t('meta.careers.title', 'Join UPER | Work With Us & Careers in Global Education')} 
        description={t('meta.careers.description', 'Explore career opportunities at UPER. Lead the digital bridge linking Southeast Asian elites to elite universities in China. Join our Jakarta PIK hub.')} 
      />

      {/* Structured JobPostings Metadata for Official Authority validation */}


      {/* Header section with modern design language */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 shadow-sm ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>{t('careers.tag', 'Join Our Mission')}</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight"
          >
            {t('careers.title1', 'Build the Bridge,')} <span className="text-gradient">{t('careers.title2', 'Elevate Your Career')}</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed"
          >
            {t('careers.desc', "Come join a premier team driven to dismantle barriers between Southeast Asian aspirants and top-tier Chinese universities.")}
          </motion.p>
          
          {/* Office locations row as specified in Section 8 */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap justify-center items-center gap-3 mt-8 md:mt-10"
          >
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mr-2">
              <MapPin className="w-4 h-4 text-primary-500 shrink-0" />
              {t('careers.locations', 'Locations:')}
            </span>
            <span className="px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              {t('careers.locJakarta', 'Jakarta PIK, Indonesia')}
            </span>
            <span className="px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0" />
              {t('careers.locShenzhen', 'Shenzhen, China')}
            </span>
            <span className="px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {t('careers.locWuhan', 'Wuhan, China')}
            </span>
          </motion.div>
        </div>

        {/* Perks Section (The Authority Loop) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-start gap-4 transition-all"
          >
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100/50">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{t('careers.perks.globalTitle', 'Global Exposure')}</h3>
            <p className="text-slate-500 leading-relaxed text-sm">{t('careers.perks.globalDesc', 'Work alongside prominent Ivy-league equivalent Chinese university admission officers, with fully-funded international travels.')}</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-start gap-4 transition-all"
          >
            <div className="p-3 bg-violet-50 rounded-xl text-violet-600 border border-violet-100/50">
              <Laptop className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{t('careers.perks.aiTitle', 'AI & Innovation')}</h3>
            <p className="text-slate-500 leading-relaxed text-sm">{t('careers.perks.aiDesc', 'Tackle educational bottlenecks using cutting-edge adaptive AI assessment tech and high-tech student infrastructure.')}</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-start gap-4 transition-all"
          >
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100/50">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{t('careers.perks.impactTitle', 'Generational Impact')}</h3>
            <p className="text-slate-500 leading-relaxed text-sm">{t('careers.perks.impactDesc', 'Help thousands of high-schoolers secure life-defining state fellowships, executive packages, and academic successes.')}</p>
          </motion.div>
        </div>

        {/* UPER Exclusive Benefits & Employee Care Section */}
        <div className="mb-24">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}>
              <Heart className="w-4 h-4" />
              <span>{t('careers.benefits.tag', 'Grow with UPER')}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              {t('careers.benefits.title', 'Premier Benefits & Inclusive Care')}
            </h2>
            <p className="text-slate-500 mt-3 text-sm md:text-base leading-relaxed">
              {t('careers.benefits.subtitle', 'We celebrate and invest in our change-makers, delivering competitive rewards and fluid growth paths.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefitsList.map((benefit: any, index: number) => {
              const iconMap = [
                { icon: <Coins className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-600 border-amber-100' },
                { icon: <Heart className="w-5 h-5" />, bg: 'bg-rose-50 text-rose-600 border-rose-100' },
                { icon: <Compass className="w-5 h-5" />, bg: 'bg-blue-50 text-blue-600 border-blue-100' },
                { icon: <BookOpen className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                { icon: <Waves className="w-5 h-5" />, bg: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
                { icon: <Coffee className="w-5 h-5" />, bg: 'bg-orange-50 text-orange-600 border-orange-100' }
              ];
              const theme = iconMap[index % iconMap.length];

              return (
                <motion.div
                  key={index}
                  whileHover={{ y: -4 }}
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
                >
                  <div className={`p-3 self-start rounded-xl border ${theme.bg}`}>
                    {theme.icon}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {benefit.title}
                    </h4>
                    <p className="text-slate-500 text-xs md:text-sm mt-1.5 leading-relaxed">
                      {benefit.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Work Environment Section as specified in Section 8 */}
        <div className="mb-24 py-12 bg-gradient-to-b from-slate-50 to-white rounded-3xl p-8 md:p-12 border border-slate-100 shadow-sm">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 mb-3 shadow-xs">
              <span>{t('careers.workspace.tag', 'UPER WORKSPACE')}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{t('careers.workspace.title', 'Our Work Environment')}</h2>
            <p className="text-slate-500 mt-2 text-sm md:text-base">
              {t('careers.workspace.desc', 'View our sea-view office in Pantai Indah Kapuk (Jakarta), and modern workspaces in Shenzhen and Wuhan.')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-slate-100 relative aspect-[4/3] bg-slate-150">
              <img 
                src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600" 
                alt="Jakarta PIK Waterfront Office" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-90 group-hover:opacity-100 transition-opacity flex items-end p-5">
                <div>
                  <span className="text-white text-xs font-black tracking-widest block uppercase font-mono">JAKARTA PIK Office</span>
                  <span className="text-slate-300 text-[10px] font-medium block mt-0.5">{t('careers.workspace.picDesc', 'Coastal Workspace in Jakarta PIK')}</span>
                </div>
              </div>
            </div>
            
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-slate-100 relative aspect-[4/3] bg-slate-150">
              <img 
                src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=600" 
                alt="Shenzhen Center" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-90 group-hover:opacity-100 transition-opacity flex items-end p-5">
                <div>
                  <span className="text-white text-xs font-black tracking-widest block uppercase font-mono">SHENZHEN TECH HUB</span>
                  <span className="text-slate-300 text-[10px] font-medium block mt-0.5">{t('careers.workspace.szDesc', 'Tech Hub in Shenzhen, China')}</span>
                </div>
              </div>
            </div>
            
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-slate-100 relative aspect-[4/3] bg-slate-150">
              <img 
                src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80&w=600" 
                alt="Wuhan Academic Labs" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-90 group-hover:opacity-100 transition-opacity flex items-end p-5">
                <div>
                  <span className="text-white text-xs font-black tracking-widest block uppercase font-mono">WUHAN RESEARCH LAB</span>
                  <span className="text-slate-300 text-[10px] font-medium block mt-0.5">{t('careers.workspace.whDesc', 'Academic & Pedagogy Labs in Wuhan')}</span>
                </div>
              </div>
            </div>
            
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-slate-100 relative aspect-[4/3] bg-slate-150">
              <img 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=600" 
                alt="Collaborative meeting rooms" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-90 group-hover:opacity-100 transition-opacity flex items-end p-5">
                <div>
                  <span className="text-white text-xs font-black tracking-widest block uppercase font-mono">TEAM WORKSPACE</span>
                  <span className="text-slate-300 text-[10px] font-medium block mt-0.5">{t('careers.workspace.teamDesc', 'Warm & Open Collaborative Hub')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Position Listings Accordion */}
        <div className="mb-24">
          <div className="text-center max-w-3xl mx-auto mb-12 flex flex-col items-center">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 mb-4 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{jobs.length} Positions Active</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight flex items-center justify-center gap-2.5">
              <Building2 className={`w-6 h-6 md:w-8 h-8 shrink-0 ${isApple ? 'text-slate-800' : 'text-primary-600'}`} />
              <span>{t('careers.positions', 'Open Career Tracks')}</span>
            </h2>
            <p className="text-slate-500 mt-3 text-sm md:text-base leading-relaxed">
              {t('careers.introSubtitle', 'Become an architectural pillar in building elite Indonesian-Chinese student bridges.')}
            </p>
          </div>

          <div className="space-y-4">
            {jobs.map((job) => {
              const isOpen = selectedJob === job.id;
              return (
                <div 
                  key={job.id}
                  id={`job-card-${job.id}`}
                  className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isOpen 
                      ? (isApple 
                          ? 'border-slate-800 shadow-md ring-1 ring-slate-900/5' 
                          : 'border-primary-500 shadow-md ring-1 ring-primary-500/10') 
                      : 'border-slate-100 hover:border-slate-250 shadow-sm'
                  }`}
                >
                  {/* Summary Card line clickable */}
                  <div 
                    onClick={() => setSelectedJob(isOpen ? null : job.id)}
                    className="p-6 md:p-8 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-md">
                          {job.department}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location}
                        </span>
                        {job.headcount && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-xs font-bold rounded-md ${
                            isApple 
                              ? 'bg-slate-50 border-slate-200 text-slate-800' 
                              : 'bg-primary-50/70 border border-primary-100 text-primary-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isApple ? 'bg-slate-700' : 'bg-primary-500'}`} />
                            {job.headcount}
                          </span>
                        )}
                      </div>
                      <h3 className={`text-xl md:text-2xl font-bold text-slate-900 transition-colors ${
                        isApple ? 'hover:text-slate-900' : 'hover:text-primary-600'
                      }`}>
                        {job.title}
                      </h3>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="flex items-center gap-2.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {job.type}
                        </span>
                      </div>
                      <button className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-600 transition-all flex items-center gap-1.5 text-sm font-medium">
                        <span>{isOpen ? t('careers.closeDetails', 'Hide Details') : t('careers.viewDetails', 'View Details')}</span>
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expansion content */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-slate-50 bg-slate-50/30 overflow-hidden"
                      >
                        <div className="p-6 md:p-8 space-y-6">
                          <div>
                            <p className="text-slate-600 leading-relaxed md:text-base">
                              {job.description}
                            </p>
                          </div>

                          {/* Responsibilities */}
                          {job.responsibilities && job.responsibilities.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-sm font-bold text-slate-800 tracking-wider uppercase">Key Contributions</h4>
                              <ul className="space-y-2">
                                {job.responsibilities.map((resp, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-slate-600 text-sm md:text-base">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>{resp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Requirements */}
                          {job.requirements && job.requirements.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-sm font-bold text-slate-800 tracking-wider uppercase">Qualifications Sought</h4>
                              <ul className="space-y-2">
                                {job.requirements.map((req, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-slate-600 text-sm md:text-base">
                                    <div className={`w-1.5 h-1.5 rounded-full mt-2.5 shrink-0 ${isApple ? 'bg-slate-700' : 'bg-primary-500'}`} />
                                    <span>{req}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Language Requirements */}
                          {job.languages && job.languages.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-sm font-bold text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
                                <Languages className="w-4 h-4 text-indigo-500" />
                                <span>{t('careers.jobLanguages', 'Language Requirements')}</span>
                              </h4>
                              <ul className="space-y-2">
                                {job.languages.map((lang, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-slate-600 text-sm md:text-base">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0" />
                                    <span>{lang}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* KPIs */}
                          {job.kpis && job.kpis.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-sm font-bold text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
                                <Target className="w-4 h-4 text-emerald-500" />
                                <span>{t('careers.jobKpis', 'Key Performance Indicators (KPIs)')}</span>
                              </h4>
                              <ul className="space-y-2">
                                {job.kpis.map((kpi, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-slate-600 text-sm md:text-base">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                                    <span>{kpi}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Salary & Benefits */}
                          {(job.salary || (job.benefits && job.benefits.length > 0)) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100/60">
                              {job.salary && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-bold text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
                                    <Coins className="w-4 h-4 text-amber-500" />
                                    <span>{t('careers.jobSalary', 'Salary Range')}</span>
                                  </h4>
                                  <p className="text-slate-700 text-sm md:text-base font-semibold">
                                    {job.salary}
                                  </p>
                                </div>
                              )}
                              {job.benefits && job.benefits.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-bold text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
                                    <Heart className="w-4 h-4 text-rose-500" />
                                    <span>{t('careers.jobBenefits', 'Position Benefits')}</span>
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {job.benefits.map((ben, i) => (
                                      <li key={i} className="flex items-start gap-2 text-slate-600 text-sm">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-450 mt-2 shrink-0" />
                                        <span>{ben}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-4 border-t border-slate-100 flex justify-start">
                            <button 
                              onClick={() => handleJobApplyClick(job.id)}
                              className={`px-6 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 text-sm text-white ${
                                isApple 
                                  ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                                  : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/10 hover:shadow-primary-600/20'
                              }`}
                            >
                              <span>Apply Now</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
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

        {/* Interactive Application Form (Creates Dynamic Closing Loop) */}
        <div id="apply-form-section" className="max-w-3xl mx-auto">
          <motion.div 
            layout
            className={`bg-white rounded-3xl p-8 md:p-12 relative overflow-hidden transition-all duration-300 ${
              isApple 
                ? 'border border-slate-200/50 shadow-none' 
                : 'border border-slate-150 shadow-xl shadow-slate-200/50'
            }`}
          >
            {/* Success state overlay */}
            <AnimatePresence>
              {submitSuccess && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white z-10 p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <motion.div 
                    initial={{ scale: 0.8, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12 }}
                    className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2"
                  >
                    <CheckCircle2 className="w-10 h-10" />
                  </motion.div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-slate-950">
                    {t('careers.form.successTitle', 'Application Received!')}
                  </h3>
                  <p className="text-slate-600 max-w-lg leading-relaxed">
                    {localeText('Your application has been received and is available for authorized recruitment review.','Lamaran Anda telah diterima dan tersedia untuk ditinjau oleh petugas rekrutmen berwenang.','您的申请已收到，可由获授权的招聘人员审核。')}
                  </p>
                  <button 
                    onClick={() => setSubmitSuccess(false)}
                    className="px-6 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl font-semibold text-slate-700 transition"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mb-8">
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                {t('careers.form.title', 'Submit Your Application')}
              </h3>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed mb-4">
                {t('careers.form.desc', 'Fill out this form and attach your academic or corporate profile.')}
              </p>
              
              {/* Active portal banner notice */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 text-sm transition-all duration-300 ${
                isApple 
                  ? 'bg-slate-100 border-slate-200/60 text-slate-800' 
                  : 'bg-primary-50 border-primary-100 text-primary-950'
              }`}>
                <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${isApple ? 'text-slate-800' : 'text-primary-600'}`} />
                <div className="space-y-0.5">
                  <h5 className={`font-bold ${isApple ? 'text-slate-900' : 'text-primary-950'}`}>
                    {t('careers.form.comingSoon', 'Application Portal Active')}
                  </h5>
                  <p className={`text-xs leading-relaxed font-semibold ${isApple ? 'text-slate-600' : 'text-primary-750'}`}>
                    {t('careers.form.comingSoonDesc', 'Our official application portal is fully active. Please fill out the form below, upload your latest resume/CV, and our Talent Team will evaluate your profile within 3 business days.')}
                  </p>
                </div>
              </div>
            </div>

             <form onSubmit={handleFormSubmit} className="space-y-6">
              {submitError && (
                <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-start gap-2 text-sm animate-fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <h5 className="font-bold">
                      {submitErrorType === 'server'
                        ? t('careers.form.serverErrorTitle', 'Submission Failed (Server Error)')
                        : t('careers.form.errorTitle', 'Form Errors Found')}
                    </h5>
                    <p className="text-xs text-rose-600 mt-0.5">
                      {submitErrorType === 'server'
                        ? t('careers.form.serverErrorDesc', 'Sorry, your application could not be sent. This might be due to an email system configuration issue. Please retry or email us directly at upereducation@gmail.com.')
                        : submitErrorType === 'file_required'
                          ? t('careers.form.errorFileRequired', 'Please attach your CV/Resume file or provide a cloud resume link.')
                          : t('careers.form.errorDesc', 'Please fill in all mandatory fields.')}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    {t('careers.form.name', 'Full Name')} <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder={t('careers.form.namePl', 'e.g., Jonathan Wijaya')}
                    className={`w-full px-4 py-3 border border-slate-200 ${inputFocusClass} rounded-xl outline-none transition text-sm bg-slate-50/30 font-medium`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    {t('careers.form.email', 'Email Address')} <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="email" 
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder={t('careers.form.emailPl', 'e.g., jonathan@example.com')}
                    className={`w-full px-4 py-3 border border-slate-200 ${inputFocusClass} rounded-xl outline-none transition text-sm bg-slate-50/30 font-medium`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    {t('careers.form.phone', 'Phone Number / WhatsApp')} <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="tel" 
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder={t('careers.form.phonePl', 'e.g., +62 812-3456-7890')}
                    className={`w-full px-4 py-3 border border-slate-200 ${inputFocusClass} rounded-xl outline-none transition text-sm bg-slate-50/30 font-medium`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    {t('careers.form.role', 'Target Position')} <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    name="roleId"
                    required
                    value={formData.roleId}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border border-slate-200 ${inputFocusClass} rounded-xl outline-none transition text-sm bg-slate-50 font-medium text-slate-700 cursor-pointer`}
                  >
                    <option value="">-- Choose Position --</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block col-span-1">
                      {t('careers.form.experience', 'Years of Experience')}
                    </label>
                    <input 
                      type="text" 
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      placeholder={t('careers.form.experiencePl', 'e.g., 3 years')}
                      className={`w-full px-4 py-3 border border-slate-200 ${inputFocusClass} rounded-xl outline-none transition text-sm bg-slate-50/30 font-medium`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">
                      {t('careers.form.resume', 'Resume Link / Cloud Storage URL')} <span className="text-xs font-normal text-slate-400">({t('nav.optional', 'Optional')})</span>
                    </label>
                    <input 
                      type="url" 
                      name="resumeUrl"
                      value={formData.resumeUrl}
                      onChange={handleInputChange}
                      placeholder={t('careers.form.resumePl', 'e.g., Google Drive or Dropbox link to your CV')}
                      className={`w-full px-4 py-3 border border-slate-200 ${inputFocusClass} rounded-xl outline-none transition text-sm bg-slate-50/30 font-medium`}
                    />
                  </div>
                </div>

                {/* Attach Resume File zone */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    {t('careers.form.resumeFile', 'Attach Resume File')} <span className="text-rose-500">*</span>
                  </label>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.doc,.docx" 
                    onChange={(e) => { 
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }} 
                  />

                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                      isDragging 
                        ? (isApple ? 'border-slate-800 bg-slate-100/60' : 'border-primary-500 bg-primary-50/50')
                        : resumeFile 
                          ? 'border-emerald-500 bg-emerald-50/10' 
                          : 'border-slate-200 hover:border-slate-350 bg-slate-50/50 hover:bg-slate-50/85'
                    }`}
                  >
                    {resumeFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 animate-bounce" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 max-w-md truncate">
                            {resumeFile.name}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResumeFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition flex items-center gap-1 border border-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t('careers.form.changeFile', 'Remove File')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <div className="p-3 bg-white rounded-xl shadow-sm text-slate-405">
                          <UploadCloud className={`w-6 h-6 ${isApple ? 'text-slate-700' : 'text-primary-500'}`} />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          {t('careers.form.dragAndDrop', 'Drag & drop your resume PDF/Word here, or click to choose file')}
                        </p>
                        <p className="text-xs text-slate-400">
                          {t('careers.form.resumeFileLimit', 'Max 10MB. Formats: PDF, DOC, DOCX')}
                        </p>
                      </div>
                    )}
                  </div>

                  {fileError && (
                    <p className="text-xs font-semibold text-rose-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fileError}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 block">
                  {t('careers.form.coverLetter', 'Introduce Yourself (Cover Letter)')}
                </label>
                <textarea 
                  name="coverLetter"
                  rows={4}
                  value={formData.coverLetter}
                  onChange={handleInputChange}
                  placeholder={t('careers.form.coverLetterPl', 'Tell us briefly why you would make an incredible team player...')}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl outline-none transition text-sm bg-slate-50/30 font-medium resize-none ${
                    isApple 
                      ? 'focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10' 
                      : 'focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'
                  }`}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full md:w-auto px-8 py-3.5 text-white font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                    isSubmitting 
                      ? 'bg-slate-400' 
                      : (isApple 
                          ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                          : 'bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 shadow-lg shadow-primary-600/10 hover:shadow-primary-600/20')
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('careers.form.submitting', 'Submitting...')}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{t('careers.form.submit', 'Apply Now')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
