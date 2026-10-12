import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Globe2, MessageCircle, Sparkles, MapPin, GraduationCap, Plane, Bot, Handshake, Calendar, Quote, ChevronLeft, ChevronRight, Building2, Briefcase, Target, Clock, Users, Tag, Landmark, School, Network, Trophy, CheckCircle2, FileText, Headset, Star, CheckCircle } from 'lucide-react';
import { Link, useNavigationType } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/SEO';
import { client } from '../sanityClient';
import imageUrlBuilder from '../sanityClient';
import { useDesignStyle } from '../utils/theme';

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

function safeDate(dateString: string) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

const FALLBACK_CAMPAIGNS = [
  {
    _id: 'camp-1',
    title: 'Study Tour Tiongkok - Beijing & Shanghai',
    subtitle: 'Kunjungi universitas top dunia seperti Tsinghua & Peking University dan rasakan pengalaman belajar yang sesungguhnya.',
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
    buttonText: 'Daftar Sekarang',
    buttonLink: '/tours',
    slug: { current: 'study-tour-2026' }
  },
  {
    _id: 'camp-2',
    title: 'Program Persiapan Beasiswa CSCA 2026',
    subtitle: 'Bimbingan intensif esai akademis, rencana studi, dan persiapan wawancara bersama alumni Tsinghua dan PKU.',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200',
    buttonText: 'Pelajari Program',
    buttonLink: '/csca',
    slug: { current: 'prep-csca-2026' }
  }
];

const MarketingCampaign = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [campaigns, setCampaigns] = useState<any[]>(FALLBACK_CAMPAIGNS);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    client.fetch(`*[_type == "campaign" && isActive == true] | order(_createdAt desc)`).then((data) => {
      const valid = (data || []).filter(Boolean);
      if (valid.length > 0) {
        setCampaigns(valid);
      } else {
        setCampaigns(FALLBACK_CAMPAIGNS);
      }
    }).catch(err => {
      console.error('Failed to fetch campaigns.', err);
      setCampaigns(FALLBACK_CAMPAIGNS);
    });
  }, []);

  useEffect(() => {
    if (campaigns.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % campaigns.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [campaigns.length]);

  if (campaigns.length === 0 || !campaigns[currentIndex]) {
    if ((import.meta as any).env.DEV) {
      return (
        <section className={`py-12 transition-colors duration-300 ${isApple ? 'bg-[#fcfcfd]' : 'bg-white'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-8 bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 rounded-3xl p-6 text-center">
              <h3 className="font-bold text-lg mb-2">🔧 [DEV MODE] No Active Campaigns Found</h3>
              <p className="text-sm opacity-90">
                This entire Marketing Campaign section is hidden in <strong>Production</strong>. Publish a document of type <code>campaign</code> with <code>isActive == true</code> in Sanity.
              </p>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  const campaign = campaigns[currentIndex];
  const linkUrl = campaign?.slug?.current ? `/campaign/${campaign.slug.current}` : (campaign?.buttonLink || "/tours");

  return (
    <section className={`py-12 transition-colors duration-300 ${isApple ? 'bg-[#fcfcfd]' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`relative rounded-3xl overflow-hidden group transition-all duration-300 ${isApple ? 'shadow-lg border border-slate-200/50' : 'shadow-2xl'}`}>
          <Link to={linkUrl} className="block relative w-full aspect-[21/9] md:aspect-[3/1] bg-slate-900">
            {campaigns.map((camp, idx) => (
              <motion.div
                key={camp._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: idx === currentIndex ? 1 : 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
                style={{ pointerEvents: idx === currentIndex ? 'auto' : 'none' }}
              >
                <div className={`absolute inset-0 z-10 bg-gradient-to-r ${
                  isApple 
                    ? 'from-slate-950/80 via-slate-900/40 to-transparent' 
                    : 'from-primary-900/60 to-primary-600/30'
                }`}></div>
                <img 
                  src={urlFor(camp.image)?.width(2000).url() || "https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&q=80&w=2000"} 
                  alt={camp.title} 
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="relative z-20 p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 h-full">
                  <div className="text-white max-w-2xl flex flex-col justify-center h-full">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider mb-6 w-fit ${
                      isApple 
                        ? 'bg-white/10 border border-white/20 backdrop-blur-sm' 
                        : 'bg-white/20 backdrop-blur-md border border-white/30'
                    }`}>
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                      <span>{t('home.campaign.tag')}</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{camp.title}</h2>
                    <p className="text-base md:text-lg text-white/90 mb-8 md:mb-0 line-clamp-2">{camp.subtitle}</p>
                  </div>
                  <div className="shrink-0 w-full md:w-auto mt-auto md:mt-0">
                    <div className="flex items-center gap-2 text-white font-bold text-xl group-hover:translate-x-1 transition-transform">
                      {camp.buttonText || "Learn More"} <ArrowRight className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </Link>
          
          {campaigns.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
              {campaigns.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentIndex(idx);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/80'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const FALLBACK_NEWS = [
  {
    _id: 'news-1',
    title: 'Peluang Beasiswa Penuh Pemerintah Tiongkok (CSC) 2026 Resmi Dibuka',
    publishedAt: '2026-03-15T00:00:00Z',
    slug: { current: 'csc-scholarship-2026-open' },
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800',
    excerpt: 'Simak panduan lengkap, persyaratan dokumen, dan strategi penulisan rencana studi untuk memenangkan beasiswa CSC di kampus impian Anda.'
  },
  {
    _id: 'news-2',
    title: 'Delegasi UPER Kunjungi Universitas Top di Beijing Pererat Kerja Sama Akademik',
    publishedAt: '2026-02-28T00:00:00Z',
    slug: { current: 'uper-visit-beijing-universities' },
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800',
    excerpt: 'UPER menandatangani MoU baru yang membuka jalur eksklusif beasiswa prestasi dan program pertukaran mahasiswa.'
  },
  {
    _id: 'news-3',
    title: 'Pentingnya Sertifikasi HSK 4 & 5 dalam Seleksi Akademik di Universitas Tiongkok',
    publishedAt: '2026-02-10T00:00:00Z',
    slug: { current: 'hsk-certification-importance' },
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=800',
    excerpt: 'Meskipun beberapa jurusan menawarkan kelas pengantar bahasa Inggris, penguasaan Mandarin yang dibuktikan dengan sertifikat HSK tetap menjadi poin plus.'
  },
  {
    _id: 'news-4',
    title: 'Sesi Pembekalan Keberangkatan (Departure Briefing) Mahasiswa UPER Angkatan 2026',
    publishedAt: '2026-01-20T00:00:00Z',
    slug: { current: 'departure-briefing-2026' },
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800',
    excerpt: 'Panduan lengkap mengenai persiapan visa JW202, asuransi kesehatan, tempat tinggal, hingga tips beradaptasi dengan budaya lokal.'
  }
];

const NewsSection = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [news, setNews] = useState<any[]>(FALLBACK_NEWS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    client.fetch(`*[_type == "news"] | order(publishedAt desc)[0...8]`).then((data) => {
      const valid = (data || []).filter(Boolean);
      if (valid.length > 0) {
        setNews(valid);
      } else {
        setNews(FALLBACK_NEWS);
      }
    }).catch(err => {
      console.error('Failed to fetch news.', err);
      setNews(FALLBACK_NEWS);
    });
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth + 40 : current.offsetWidth - 40;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setHasDragged(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast
    if (Math.abs(walk) > 10) {
      setHasDragged(true);
    }
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  if (news.length === 0) {
    if ((import.meta as any).env.DEV) {
      return (
        <section className={`py-12 border-t transition-colors duration-300 ${isApple ? 'bg-[#fcfcfd] border-slate-100' : 'bg-white border-slate-100'} overflow-hidden`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-8 bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 rounded-3xl p-6 text-center">
              <h3 className="font-bold text-lg mb-2">🔧 [DEV MODE] No News Articles Found</h3>
              <p className="text-sm opacity-90">
                This entire News section is hidden in <strong>Production</strong>. Publish documents of type <code>news</code> in Sanity to populate.
              </p>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className={`py-24 border-t transition-colors duration-300 ${isApple ? 'bg-[#fcfcfd] border-slate-100' : 'bg-white border-slate-100'} overflow-hidden`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 relative">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-primary-50 border border-primary-100 text-primary-600'
          }`}>
            <Globe2 className="w-4 h-4" /> {t('home.news.tag')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 tracking-tight">{t('home.news.title1')} <span className="text-gradient">{t('home.news.title2')}</span></h2>
          <p className="text-slate-600 text-lg mb-8">{t('home.news.desc')}</p>
          <div className="flex items-center justify-center gap-4 hidden md:flex">
            <div className="flex gap-2">
              <button onClick={() => scroll('left')} className="p-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors" aria-label="Scroll left">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => scroll('right')} className="p-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors" aria-label="Scroll right">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <Link to="/news" className={`flex items-center gap-2 font-semibold transition-colors ml-4 border-l border-slate-200 pl-4 ${
              isApple ? 'text-[#0071e3] hover:text-[#0077ed]' : 'text-primary-600 hover:text-primary-700'
            }`}>
              {t('home.news.viewAll')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div 
          ref={scrollRef} 
          className={`flex overflow-x-auto gap-6 pb-8 hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 overscroll-x-contain snap-x snap-mandatory ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {news.map((item, idx) => (
            <motion.div 
              key={item._id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group shrink-0 w-[85vw] sm:w-[350px] snap-center sm:snap-start"
            >
              <Link to={`/news/${item.slug?.current || ''}`} className="block" onClick={(e) => hasDragged && e.preventDefault()}>
                <div className={`relative aspect-[4/3] overflow-hidden mb-6 transition-all duration-300 ${
                  isApple ? 'rounded-2xl border border-slate-200/50 shadow-sm' : 'rounded-2xl shadow-md'
                }`}>
                  <img 
                    src={(() => {
                      const imgToUse = (item.images && item.images.length > 0) ? item.images[0] : item.image;
                      return imgToUse ? urlFor(imgToUse)?.width(800).url() : null;
                    })() || "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=800"} 
                    alt={item.title} 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                  <Calendar className="w-4 h-4" />
                  <span>{item.publishedAt ? safeDate(item.publishedAt) : ''}</span>
                </div>
                <h3 className={`text-xl font-medium leading-relaxed transition-colors line-clamp-2 ${
                  isApple ? 'text-slate-800 group-hover:text-[#0071e3]' : 'text-slate-800 group-hover:text-primary-600'
                }`}>
                  {item.title}
                </h3>
              </Link>
            </motion.div>
          ))}
        </div>
        <Link to="/news" className={`md:hidden mt-8 w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl ${
          isApple ? 'bg-slate-100 text-[#0071e3] hover:bg-slate-200' : 'bg-primary-50 text-primary-600'
        }`}>
          {t('home.news.viewAll')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
};

const FALLBACK_STORIES = [
  {
    _id: 'story-1',
    name: 'Michael Wijaya',
    school: 'Tsinghua University (清华大学)',
    program: 'Mechanical Engineering & Automation',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200',
    quote: 'Dukungan penuh dari UPER dalam menyusun personal statement sangat berharga. Mentor UPER membantu saya menonjolkan proyek robotika saya, sehingga saya berhasil mendapatkan beasiswa penuh CSC Type B di Tsinghua!'
  },
  {
    _id: 'story-2',
    name: 'Amanda Sutanto',
    school: 'Peking University (北京大学)',
    program: 'International Economics and Trade',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200&h=200',
    quote: 'Proses wawancara di PKU sangat kompetitif. Berkat simulasi wawancara 1-on-1 dengan alumni UPER, saya bisa menjawab semua pertanyaan akademis dengan tenang dan percaya diri.'
  },
  {
    _id: 'story-3',
    name: 'Devin Henderson',
    school: 'Zhejiang University (浙江大学)',
    program: 'Computer Science and Technology',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200',
    quote: 'Kurikulum bridging CSCA dari UPER benar-benar mempersiapkan saya untuk menghadapi standar akademik ketat di Tiongkok. Transisi dari SMA ke kuliah tingkat tinggi menjadi sangat mulus!'
  },
  {
    _id: 'story-4',
    name: 'Clara Audrey',
    school: 'Shanghai Jiao Tong University (上海交通大学)',
    program: 'Biomedical Engineering',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200',
    quote: 'Navigasi birokrasi visa dan JW202 sangat membingungkan pada awalnya. Tim UPER mengurus semua detail teknis sehingga saya bisa fokus penuh pada persiapan akademik saya.'
  }
];

const StudentStories = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [stories, setStories] = useState<any[]>(FALLBACK_STORIES);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    client.fetch(`*[_type == "studentStory"][0...8]`).then((data) => {
      const valid = (data || []).filter(Boolean);
      if (valid.length > 0) {
        setStories(valid);
      } else {
        setStories(FALLBACK_STORIES);
      }
    }).catch(err => {
      console.error('Failed to fetch stories.', err);
      setStories(FALLBACK_STORIES);
    });
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth + 40 : current.offsetWidth - 40;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setHasDragged(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast
    if (Math.abs(walk) > 10) {
      setHasDragged(true);
    }
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  if (stories.length === 0) {
    if ((import.meta as any).env.DEV) {
      return (
        <section className={`py-12 transition-colors duration-300 ${isApple ? 'bg-white' : 'bg-slate-50'} overflow-hidden`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-8 bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 rounded-3xl p-6 text-center">
              <h3 className="font-bold text-lg mb-2">🔧 [DEV MODE] No Student Experiences Found</h3>
              <p className="text-sm opacity-90">
                This entire Student Stories section is hidden in <strong>Production</strong>. Publish documents of type <code>studentStory</code> in Sanity to populate.
              </p>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className={`py-24 transition-colors duration-300 ${isApple ? 'bg-white' : 'bg-slate-50'} overflow-hidden`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 relative">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-primary-50 border border-primary-100 text-primary-600'
          }`}>
            <Quote className="w-4 h-4" /> {t('home.stories.tag')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 tracking-tight">{t('home.stories.title1')} <span className="text-gradient">{t('home.stories.title2')}</span></h2>
          <p className="text-lg text-slate-600 mb-8">{t('home.stories.desc')}</p>
          <div className="flex justify-center gap-2 hidden md:flex">
            <button onClick={() => scroll('left')} className={`p-2 rounded-full border border-slate-200 transition-colors ${
              isApple ? 'bg-slate-50 hover:bg-slate-100 text-slate-600' : 'hover:bg-white text-slate-600 bg-white/50'
            }`} aria-label="Scroll left">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => scroll('right')} className={`p-2 rounded-full border border-slate-200 transition-colors ${
              isApple ? 'bg-slate-50 hover:bg-slate-100 text-slate-600' : 'hover:bg-white text-slate-600 bg-white/50'
            }`} aria-label="Scroll right">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div 
          ref={scrollRef} 
          className={`flex overflow-x-auto gap-6 pt-16 pb-8 hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 overscroll-x-contain snap-x snap-mandatory ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {stories.map((story, idx) => (
            <motion.div 
              key={story._id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`mt-12 px-8 pb-8 pt-8 relative shrink-0 w-[85vw] sm:w-[400px] snap-center sm:snap-start flex flex-col transition-all duration-300 ${
                isApple 
                  ? 'bg-white rounded-[2rem] border border-slate-200/50 shadow-none' 
                  : 'bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100'
              }`}
            >
              <Quote className="absolute bottom-8 right-8 w-24 h-24 text-slate-50 -z-0 transform rotate-180" />
              <div className="absolute -top-12 right-8 z-20">
                <div className="relative">
                  <img 
                    src={urlFor(story.image)?.width(200).url() || "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=200&h=200"} 
                    alt={story.name} 
                    className="w-24 h-24 rounded-full object-cover border-[6px] border-white shadow-xl bg-white" 
                    draggable={false}
                  />
                  <div className={`absolute bottom-1 right-1 text-white p-1 rounded-full border-2 border-white shadow-md ${
                    isApple ? 'bg-[#0071e3]' : 'bg-primary-500'
                  }`} title="Verified Student">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>
              </div>
              <div className="mb-6 relative z-10 pr-24">
                <div className="flex gap-1 mb-3 text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <h4 className="font-bold text-slate-900 text-xl">{story.name}</h4>
                <p className={`text-xs font-semibold w-fit px-3 py-1 rounded-full mt-2 border ${
                  isApple 
                    ? 'bg-slate-50 border-slate-200/60 text-slate-700' 
                    : 'bg-primary-50 border-primary-100/60 text-primary-700'
                }`}>{story.school}</p>
                {story.program && (
                  <p className="text-[11px] text-slate-500 font-medium mt-1 pl-1">
                    {story.program}
                  </p>
                )}
              </div>
              <p className="text-slate-600 leading-relaxed relative z-10 italic flex-1">"{story.quote}"</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Hero = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [currentImage, setCurrentImage] = useState(0);

  const heroImages = [
    {
      src: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=1200",
      alt: "Vibrant and modern university campus in China"
    },
    {
      src: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200",
      alt: "Modern university campus and tech labs - The destination"
    },
    {
      src: "/hero-classroom.jpg",
      fallbackSrc: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200",
      alt: "UPER Mandarin Training Classroom - Professional Chinese Language Education in Indonesia"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
              isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}>
              <Sparkles className="w-4 h-4" />
              <span>{t('home.hero.tag')}</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6 text-slate-900">
              {t('home.hero.heading1')} <br/>
              <span className="text-gradient">{t('home.hero.heading2')}</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-xl">
              {t('home.hero.desc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="https://wa.me/6281116612062" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`px-8 py-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 text-lg ${
                  isApple 
                    ? 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-md' 
                    : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
                {t('home.hero.chat', 'Free Consult Now')}
              </a>
              <Link 
                to="/tours" 
                className={`px-8 py-4 rounded-full font-medium transition-all flex items-center justify-center gap-2 text-lg ${
                  isApple 
                    ? 'border border-slate-300 text-slate-700 hover:bg-slate-50' 
                    : 'border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 bg-transparent'
                }`}
              >
                {t('home.hero.explore', 'Explore Programs')} <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            
            <div className="mt-12 flex items-center gap-5 text-sm font-medium text-slate-500">
              <div className="flex -space-x-3 shrink-0">
                {[
                  "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=100&h=100",
                  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=100&h=100",
                  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=100&h=100",
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100"
                ].map((src, i) => (
                  <img key={i} src={src} alt="Student" width="40" height="40" loading="lazy" decoding="async" className="w-10 h-10 rounded-full border-2 border-white object-cover" />
                ))}
              </div>
              <p>{t('home.hero.join')} <span className="text-slate-900 font-bold">{t('home.hero.students')}</span></p>
            </div>

            <div className="mt-6 flex items-center gap-5 text-xs sm:text-sm font-medium text-slate-500">
              <div className="flex -space-x-3 shrink-0">
                <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center overflow-hidden z-[4] shadow-sm"><img src="/blcu-logo.png" alt="BLCU" width="38" height="38" loading="lazy" decoding="async" className="w-full h-full object-contain p-[1px] mix-blend-multiply" /></div>
                <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center overflow-hidden z-[3] shadow-sm"><img src="/ccnu-logo.png" alt="CCNU" width="38" height="38" loading="lazy" decoding="async" className="w-full h-full object-contain p-[1px] mix-blend-multiply" /></div>
                <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center overflow-hidden z-[2] shadow-sm"><img src="/dku-logo.jpg" alt="DKU" width="38" height="38" loading="lazy" decoding="async" className="w-full h-full object-contain p-[1px] mix-blend-multiply" /></div>
                <div className="w-10 h-10 rounded-full border-2 border-white bg-white flex items-center justify-center overflow-hidden z-[1] shadow-sm"><img src="/muh-logo.png" alt="MUH" width="38" height="38" loading="lazy" decoding="async" className="w-full h-full object-contain p-[1px] mix-blend-multiply" /></div>
              </div>
              <p className="leading-snug max-w-[380px]">
                {t('home.hero.partnership.prefix')} <span className="text-slate-900 font-bold">{t('home.hero.partnership.highlight')}</span>{t('home.hero.partnership.suffix')}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className={`absolute inset-0 blur-3xl rounded-full transform -rotate-6 scale-105 ${
              isApple ? 'bg-slate-200/50 dark:bg-slate-800/30' : 'bg-gradient-to-tr from-primary-500/20 to-tech-500/20'
            }`}></div>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/20 aspect-[4/3]">
              <AnimatePresence mode="popLayout">
                <motion.img 
                  key={currentImage}
                  src={heroImages[currentImage].src} 
                  alt={heroImages[currentImage].alt}
                  fetchPriority={currentImage === 0 ? "high" : "auto"}
                  decoding="async"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const fallback = (heroImages[currentImage] as any).fallbackSrc;
                    if (fallback && e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent z-10 pointer-events-none"></div>

              {/* Carousel Indicators */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {heroImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === currentImage ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>

            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const SchoolPartnerships = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();

  const stories = [
    {
      name: t('home.schoolPartnerships.story1.name'),
      type: t('home.schoolPartnerships.story1.type'),
      stats: t('home.schoolPartnerships.story1.stats'),
    },
    {
      name: t('home.schoolPartnerships.story2.name'),
      type: t('home.schoolPartnerships.story2.type'),
      stats: t('home.schoolPartnerships.story2.stats'),
    }
  ];

  const processSteps = t('home.schoolPartnerships.process', { returnObjects: true }) as string[];
  // Fallback map just in case it doesn't return an array in some edge cases
  const steps = Array.isArray(processSteps) ? processSteps : [
    t('home.schoolPartnerships.process.0'),
    t('home.schoolPartnerships.process.1'),
    t('home.schoolPartnerships.process.2'),
    t('home.schoolPartnerships.process.3'),
    t('home.schoolPartnerships.process.4'),
    t('home.schoolPartnerships.process.5')
  ];

  const processIcons = [MessageCircle, Target, FileText, GraduationCap, Handshake, Headset];

  return (
    <section className="py-24 bg-white border-y border-slate-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-primary-50 border border-primary-100 text-primary-600'
          }`}>
            <School className="w-4 h-4" /> {t('home.schoolPartnerships.tag')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 tracking-tight">
            {t('home.schoolPartnerships.title1')} <span className="text-gradient">{t('home.schoolPartnerships.title2')}</span>
          </h2>
          <p className="text-lg text-slate-600">
            {t('home.schoolPartnerships.desc')}
          </p>
        </div>

        {/* Top Part: Process Flow */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-20"
        >
          <div className="flex items-center gap-4 mb-10 justify-center">
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
             <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-sm">
               <CheckCircle2 className={`w-5 h-5 ${isApple ? 'text-slate-700' : 'text-primary-500'}`} /> 
               {t('home.schoolPartnerships.processTitle')}
             </div>
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
          </div>

          <div className="grid grid-cols-2 lg:flex lg:flex-row items-stretch gap-4 lg:gap-2">
             {steps.map((step, idx) => {
               const StepIcon = processIcons[idx];
               return (
                <div key={idx} className="flex flex-col lg:flex-row items-stretch flex-1 w-full gap-2 relative">
                  <div className="w-full h-full relative group">
                    <div className={`h-full bg-white p-4 xl:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col lg:flex-col items-center lg:items-center justify-center lg:justify-start gap-4 lg:gap-5 overflow-hidden cursor-default ${
                      isApple ? 'hover:border-slate-800' : 'hover:border-primary-300'
                    }`}>
                       {/* Watermark Icon */}
                       <div className={`absolute right-[-10px] lg:right-[-20px] bottom-[-20px] text-slate-50 transition-colors pointer-events-none z-0 ${
                         isApple ? 'group-hover:text-slate-100' : 'group-hover:text-primary-50'
                       }`}>
                         <StepIcon className="w-24 h-24 xl:w-32 xl:h-32" />
                       </div>
                       
                       {/* Badge Icon */}
                       <div className={`w-12 h-12 shrink-0 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 transition-all z-10 shadow-sm ${
                         isApple 
                           ? 'group-hover:bg-[#0071e3] group-hover:border-[#0071e3] group-hover:text-white' 
                           : 'group-hover:bg-primary-500 group-hover:border-primary-500 group-hover:text-white'
                       }`}>
                         <StepIcon className="w-5 h-5" />
                       </div>
                       
                       {/* Text Content */}
                       <div className="flex-1 flex flex-col justify-start w-full">
                         <h4 className={`font-bold text-slate-800 text-[14px] xl:text-[15px] leading-snug transition-colors z-10 text-center lg:text-center lg:mt-[-4px] ${
                           isApple ? 'group-hover:text-slate-950' : 'group-hover:text-primary-700'
                         }`}>
                           {step}
                         </h4>
                       </div>
                    </div>
                  </div>
                  
                  {/* Desktop Connecting Arrow */}
                  {idx < steps.length - 1 && (
                    <div className="hidden lg:flex items-center justify-center shrink-0 text-slate-300 w-3 xl:w-4 relative z-20 self-center">
                       <ChevronRight className="w-5 h-5 xl:w-6 xl:h-6" />
                    </div>
                  )}
                  
                  {/* Mobile Connecting Line */}
                  {idx < steps.length - 1 && (
                    <div className="hidden lg:hidden text-slate-200 my-1 self-center">
                       <div className="w-1 h-6 border-l-2 border-dashed border-slate-300"></div>
                    </div>
                  )}
                </div>
               );
             })}
          </div>
        </motion.div>

        {/* Bottom Part: Success Stories & CTA */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`p-8 md:p-12 rounded-3xl border ${isApple ? 'bg-slate-50/60 border-slate-200/50 shadow-none' : 'bg-slate-50 border-slate-100'}`}
        >
          <div className="flex items-center gap-4 mb-10 justify-center">
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
             <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-sm">
               <Trophy className="w-5 h-5 text-orange-500" /> 
               {t('home.schoolPartnerships.storiesTitle')}
             </div>
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {stories.map((story, i) => (
              <div key={i} className={`relative group overflow-hidden bg-white p-4 xl:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center gap-4 cursor-default ${
                isApple ? 'hover:border-slate-300' : 'hover:border-primary-300'
              }`}>
                {/* Watermark Background */}
                <div className={`absolute right-[-15px] bottom-[-15px] transition-colors pointer-events-none z-0 ${
                  isApple ? 'text-slate-50 group-hover:text-slate-100' : 'text-slate-50 group-hover:text-primary-50'
                }`}>
                  <School className="w-24 h-24" strokeWidth={1} />
                </div>

                {/* Icon */}
                <div className={`w-10 h-10 shrink-0 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 transition-all z-10 shadow-sm ${
                  isApple 
                    ? 'group-hover:bg-[#0071e3] group-hover:border-[#0071e3] group-hover:text-white' 
                    : 'group-hover:bg-primary-500 group-hover:border-primary-500 group-hover:text-white'
                }`}>
                  <School className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <h4 className={`font-bold text-slate-800 text-[15px] leading-snug transition-colors ${isApple ? 'group-hover:text-slate-950' : 'group-hover:text-primary-700'}`}>
                    {story.name}
                  </h4>
                  <div className="flex flex-col gap-1 mt-1.5">
                    <span className={`font-medium text-[13px] leading-none ${isApple ? 'text-slate-600' : 'text-primary-600'}`}>
                      {story.type}
                    </span>
                    <span className="text-slate-500 text-[13px] flex items-center gap-1.5 leading-none">
                      <Users className={`w-3.5 h-3.5 transition-colors ${isApple ? 'group-hover:text-[#0071e3]' : 'group-hover:text-primary-400'}`} /> {story.stats}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <Link 
              to="/contact" 
              className={`relative group overflow-hidden p-4 xl:p-6 rounded-2xl transition-all flex items-center justify-center gap-3 cursor-pointer h-full min-h-[90px] ${
                isApple 
                  ? 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-md hover:shadow-lg' 
                  : 'bg-gradient-to-br from-primary-600 to-tech-600 shadow-sm hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-1'
              }`}
            >
              <div className="absolute right-[-15px] bottom-[-15px] text-white/10 group-hover:text-white/20 transition-colors pointer-events-none z-0">
                <ArrowRight className="w-24 h-24 transform -rotate-45" strokeWidth={1} />
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <span className="font-bold text-white text-lg tracking-wide">
                  {t('home.schoolPartnerships.cta')}
                </span>
                <ArrowRight className="w-5 h-5 text-white transform group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const CorporateTraining = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  
  const indTranslation = t('home.corporate.industries', { returnObjects: true });
  const industries = Array.isArray(indTranslation) ? indTranslation : ['Mining', 'Manufacturing', 'Banking', 'Infrastructure', 'Retail', 'Tech'];
  const featTranslation = t('home.corporate.features', { returnObjects: true });
  const features = Array.isArray(featTranslation) ? featTranslation : ['Custom vocabulary', 'Flexible scheduling', 'Progress tracking'];
  
  return (
    <section className={`py-24 border-y transition-colors duration-300 ${isApple ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-100'} overflow-hidden`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-tech-50 border border-tech-100 text-tech-600'
          }`}>
            <Building2 className="w-4 h-4" /> {t('home.corporate.tag')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 tracking-tight">
            {t('home.corporate.title1')} <span className="text-gradient">{t('home.corporate.title2')}</span>
          </h2>
          <p className="text-lg text-slate-600">
            {t('home.corporate.desc')}
          </p>
        </div>

        {/* Top Part: Industry Solutions */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-20"
        >
          <div className="flex items-center gap-4 mb-10 justify-center">
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
             <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-sm">
               <Globe2 className="w-5 h-5 text-tech-500" /> 
               {t('home.corporate.solutionsTitle')}
             </div>
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 items-stretch gap-4">
             {[
               { name: industries[0], icon: Target },
               { name: industries[1], icon: Building2 },
               { name: industries[2], icon: Landmark },
               { name: industries[3], icon: MapPin },
               { name: industries[4], icon: Tag },
               { name: industries[5], icon: Network }
             ].map((industry, idx) => {
               const StepIcon = industry.icon;
               return (
                <div key={idx} className="flex-1 w-full relative">
                  <div className="w-full h-full relative group">
                    <div className={`h-full p-4 xl:p-5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-4 overflow-hidden cursor-default text-center ${
                      isApple 
                        ? 'bg-slate-50/50 border-slate-200/50 hover:bg-white hover:border-slate-300 hover:shadow-lg' 
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-tech-300 hover:-translate-y-1'
                    }`}>
                       {/* Watermark Icon */}
                       {!isApple && (
                         <div className="absolute right-[-10px] bottom-[-20px] text-slate-50 group-hover:text-tech-50 transition-colors pointer-events-none z-0">
                           <StepIcon className="w-24 h-24" />
                         </div>
                       )}
                       
                       {/* Badge Icon */}
                       <div className={`w-12 h-12 shrink-0 rounded-full border flex items-center justify-center transition-all z-10 shadow-sm ${
                         isApple 
                           ? 'bg-white border-slate-200 text-slate-500 group-hover:bg-slate-900 group-hover:border-slate-900 group-hover:text-white' 
                           : 'bg-slate-50 border-slate-200 text-slate-500 group-hover:bg-tech-500 group-hover:border-tech-500 group-hover:text-white'
                       }`}>
                         <StepIcon className="w-5 h-5" />
                       </div>
                       
                       {/* Text Content */}
                       <div className="flex flex-col justify-center w-full">
                         <h4 className={`font-bold text-[14px] xl:text-[15px] leading-snug transition-colors z-10 mt-[-4px] ${
                           isApple ? 'text-slate-800 group-hover:text-slate-950' : 'text-slate-800 group-hover:text-tech-700'
                         }`}>
                           {industry.name}
                         </h4>
                       </div>
                    </div>
                  </div>
                </div>
               );
             })}
          </div>
        </motion.div>

        {/* Bottom Part: Success Stories & CTA */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`p-8 md:p-12 border transition-all duration-300 ${
              isApple 
                ? 'bg-[#fcfcfd]/60 rounded-[2rem] border-slate-200/50 shadow-none' 
                : 'bg-white rounded-3xl border border-slate-100 shadow-sm'
            }`}
        >
          <div className="flex items-center gap-4 mb-10 justify-center">
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
             <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-sm">
               <Trophy className="w-5 h-5 text-orange-500" /> 
               {t('home.corporate.storiesTitle')}
             </div>
             <div className="h-px bg-slate-200 flex-1 max-w-[120px] hidden md:block"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className={`relative group overflow-hidden p-4 xl:p-6 rounded-2xl border transition-all flex flex-col justify-center gap-4 cursor-default text-left ${
              isApple 
                ? 'bg-white border-slate-200/50 shadow-none' 
                : 'bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md hover:border-tech-300 hover:-translate-y-1'
            }`}>
              {!isApple && (
                <div className="absolute right-[-15px] bottom-[-15px] text-white group-hover:text-tech-50 transition-colors pointer-events-none z-0">
                  <Building2 className="w-24 h-24" strokeWidth={1} />
                </div>
              )}
              <div className="flex items-center gap-4 relative z-10">
                <div className={`w-10 h-10 shrink-0 rounded-full border flex items-center justify-center transition-all shadow-sm ${
                  isApple 
                    ? 'bg-slate-50 border-slate-200/60 text-slate-400 group-hover:bg-slate-900 group-hover:border-slate-900 group-hover:text-white' 
                    : 'bg-white border-slate-200 text-slate-400 group-hover:bg-tech-500 group-hover:border-tech-500 group-hover:text-white'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`font-bold text-[15px] leading-snug transition-colors ${
                    isApple ? 'text-slate-800 group-hover:text-slate-950' : 'text-slate-800 group-hover:text-tech-700'
                  }`}>
                    {t('home.corporate.story1.name')}
                  </h4>
                  <div className="flex flex-col gap-1 mt-1.5">
                    <span className={`font-medium text-[13px] leading-none ${isApple ? 'text-[#0071e3]' : 'text-tech-600'}`}>
                      {t('home.corporate.story1.highlight')}
                    </span>
                    <span className="text-slate-500 text-[13px] flex items-center gap-1.5 leading-none">
                      <Users className={`w-3.5 h-3.5 transition-colors ${isApple ? 'group-hover:text-slate-700' : 'group-hover:text-tech-400'}`} /> {t('home.corporate.story1.stats')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`relative group overflow-hidden p-4 xl:p-6 rounded-2xl border transition-all flex flex-col justify-center cursor-default text-left ${
              isApple 
                ? 'bg-white border-slate-200/50 shadow-none' 
                : 'bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md hover:border-tech-300 hover:-translate-y-1'
            }`}>
              {!isApple && (
                <div className="absolute right-[-15px] bottom-[-15px] text-white group-hover:text-tech-50 transition-colors pointer-events-none z-0">
                  <CheckCircle2 className="w-24 h-24" strokeWidth={1} />
                </div>
              )}
              <div className="relative z-10">
                <ul className="space-y-3">
                  <li className={`flex items-center gap-3 font-medium transition-colors ${
                    isApple ? 'text-slate-700 group-hover:text-slate-900' : 'text-slate-700 group-hover:text-tech-800'
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isApple ? 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white' : 'bg-tech-100 text-tech-600 group-hover:bg-tech-500 group-hover:text-white'
                    }`}><CheckCircle2 className="w-3.5 h-3.5" /></span>
                    {features[0]}
                  </li>
                  <li className={`flex items-center gap-3 font-medium transition-colors ${
                    isApple ? 'text-slate-700 group-hover:text-slate-900' : 'text-slate-700 group-hover:text-tech-800'
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isApple ? 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white' : 'bg-tech-100 text-tech-600 group-hover:bg-tech-500 group-hover:text-white'
                    }`}><Clock className="w-3.5 h-3.5" /></span>
                    {features[1]}
                  </li>
                  <li className={`flex items-center gap-3 font-medium transition-colors ${
                    isApple ? 'text-slate-700 group-hover:text-slate-900' : 'text-slate-700 group-hover:text-tech-800'
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isApple ? 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white' : 'bg-tech-100 text-tech-600 group-hover:bg-tech-500 group-hover:text-white'
                    }`}><MapPin className="w-3.5 h-3.5" /></span>
                    {features[2]}
                  </li>
                </ul>
              </div>
            </div>

            <Link 
              to="/contact" 
              className={`relative group overflow-hidden p-4 xl:p-6 rounded-2xl transition-all flex items-center justify-center gap-3 cursor-pointer h-full min-h-[90px] ${
                isApple 
                  ? 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-none' 
                  : 'bg-gradient-to-br from-primary-600 to-tech-600 shadow-sm hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-1'
              }`}
            >
              <div className="absolute right-[-15px] bottom-[-15px] text-white/10 group-hover:text-white/20 transition-colors pointer-events-none z-0">
                <FileText className="w-24 h-24 transform -rotate-12" strokeWidth={1} />
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <span className="font-bold text-white text-lg tracking-wide">
                  {t('home.corporate.ctaBtn')}
                </span>
                <ArrowRight className="w-5 h-5 text-white transform group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const DEFAULT_PARTNER_CATEGORIES = [
  { name: 'Chinese Universities', count: 2 },
  { name: 'Chinese Enterprises', count: 1 },
  { name: 'Indonesian Universities & Schools', count: 4 },
  { name: 'Indonesian Organizations', count: 1 }
];

let cachedCategories: { name: string; count: number }[] | null = null;

const StrategicPartners = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [categories, setCategories] = React.useState<{ name: string; count: number }[]>(cachedCategories || []);
  const [loading, setLoading] = React.useState(!cachedCategories);

  React.useEffect(() => {
    if (cachedCategories) return; // Skip fetch if already cached
    const fetchPartnerCategories = async () => {
      try {
        const query = `*[_type == "partner" && isActive == true] { category }`;
        const data = await client.fetch(query);
        
        if (data && data.length > 0) {
          // Count partners per category
          const counts = data.reduce((acc: Record<string, number>, curr: any) => {
            const cat = curr.category || 'Other';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {});
          
          // Format for display
          const formattedCategories = Object.entries(counts).map(([name, count]) => ({
            name,
            count: count as number
          }));
          
          cachedCategories = formattedCategories;
          setCategories(formattedCategories);
        } else {
          setCategories(DEFAULT_PARTNER_CATEGORIES);
        }
      } catch (error) {
        console.error("Error fetching partners for home, using fallback:", error);
        setCategories(DEFAULT_PARTNER_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };

    fetchPartnerCategories();
  }, []);

  if (loading) {
    // Provide a skeleton placeholder with a min-height to maintain layout stability during initial load
    return (
      <section className={`py-20 relative overflow-hidden border-y ${isApple ? 'bg-[#fcfcfd] border-slate-100' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[300px] flex justify-center items-center">
            <div className={`w-8 h-8 border-4 rounded-full animate-spin ${isApple ? 'border-slate-200 border-t-slate-800' : 'border-primary-200 border-t-primary-600'}`}></div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  const getCategoryIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('university') || lowerName.includes('universities')) return <Landmark className={`w-6 h-6 transition-colors ${isApple ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-primary-500'}`} />;
    if (lowerName.includes('school')) return <School className={`w-6 h-6 transition-colors ${isApple ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-primary-500'}`} />;
    if (lowerName.includes('enterprise') || lowerName.includes('company')) return <Building2 className={`w-6 h-6 transition-colors ${isApple ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-primary-500'}`} />;
    if (lowerName.includes('organization')) return <Network className={`w-6 h-6 transition-colors ${isApple ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-primary-500'}`} />;
    return <Handshake className={`w-6 h-6 transition-colors ${isApple ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-500 group-hover:text-primary-500'}`} />;
  };

  return (
    <section className={`py-20 relative overflow-hidden border-y transition-colors duration-300 ${isApple ? 'bg-[#fcfcfd] border-slate-100' : 'bg-white border-slate-200'}`}>
      {/* Decorative Background */}
      {!isApple && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary-100/50 rounded-full blur-[100px] pointer-events-none"></div>
        </>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-primary-50 border border-primary-100 text-primary-600'
          }`}>
            <Handshake className="w-4 h-4" /> {t('home.partners.tag')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">{t('home.partners.title1')} <span className="text-gradient">{t('home.partners.title2')}</span></h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {categories.slice(0, 4).map((category, idx) => (
            <Link 
              key={idx} 
              to={`/partners#section-${category.name.replace(/\s+/g, '-')}`}
              className={`group flex flex-col items-center justify-center text-center p-8 transition-all duration-300 relative overflow-hidden block ${
                isApple 
                  ? 'rounded-[2rem] bg-white border border-slate-200/50 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/30' 
                  : 'rounded-[2rem] bg-white/80 backdrop-blur-xl shadow-lg shadow-slate-200/40 border border-slate-100 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-2'
              }`}
            >
              {/* Subtle top-right gradient on hover */}
              {!isApple && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-50/80 to-transparent rounded-bl-[4rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0"></div>
              )}

              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 relative z-10 shadow-sm ${
                isApple 
                  ? 'bg-slate-50 border border-slate-100 group-hover:bg-slate-100 group-hover:scale-105' 
                  : 'bg-slate-50 border border-slate-100 group-hover:bg-primary-50 group-hover:border-primary-100 group-hover:scale-110'
              }`}>
                {getCategoryIcon(category.name)}
              </div>
              <h4 className={`font-bold text-base mb-3 transition-colors relative z-10 ${
                isApple ? 'text-slate-800 group-hover:text-slate-950' : 'text-slate-800 group-hover:text-primary-700'
              }`}>{t(`partnersPage.categories.${category.name}`, category.name) as string}</h4>
              
              <div className="mt-auto relative z-10">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  isApple 
                    ? 'bg-slate-50 border border-slate-200 text-slate-500' 
                    : 'bg-slate-100 border border-slate-200 text-slate-600 group-hover:bg-primary-100 group-hover:border-primary-200 group-hover:text-primary-700'
                }`}>
                  <span>{category.count}</span> {t('home.partners.partners')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const AudienceCards = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  
  interface AudienceCardData {
    title: string;
    desc: string;
    icon: React.ReactNode;
    items: React.ReactNode[];
    cta: string;
    link: string;
    cardBg: string;
    tileBg: string;
    tileText: string;
    tagStyle: string;
    btnStyles: string;
    shadowColor: string;
    glowGradient: string;
    borderColor?: string;
  }

  const audiences: AudienceCardData[] = [
    {
      title: t('home.audience.students.title'),
      desc: t('home.audience.students.desc', '定制化学习计划，自主备考，全方位提升中文水平'),
      icon: <GraduationCap className={`w-9 h-9 drop-shadow-sm stroke-[1.8] ${isApple ? 'text-primary-600' : 'text-white'}`} />,
      items: [
        <div key="1" className="flex items-center justify-center gap-1.5 px-1 w-full h-full">
          <Link to="/hsk" onClick={(e) => e.stopPropagation()} className={`${isApple ? 'hover:text-[#0071e3] text-primary-700' : 'hover:text-primary-800 text-primary-700'} font-extrabold transition-colors`}>HSK</Link>
          <span className={`${isApple ? 'text-primary-300/60' : 'text-primary-300'} font-normal`}>/</span>
          <Link to="/csca" onClick={(e) => e.stopPropagation()} className={`${isApple ? 'hover:text-[#0071e3] text-primary-700' : 'hover:text-primary-800 text-primary-700'} font-extrabold transition-colors`}>CSCA</Link>
        </div>,
        <Link key="2" to="/consultancy" onClick={(e) => e.stopPropagation()} className={`w-full h-full flex items-center justify-center ${isApple ? 'hover:text-[#0071e3] text-primary-700' : 'hover:text-primary-800 text-primary-700'} font-extrabold transition-colors`}>{t('nav.studyAbroad')}</Link>,
        <Link key="3" to="/tours" onClick={(e) => e.stopPropagation()} className={`w-full h-full flex items-center justify-center ${isApple ? 'hover:text-[#0071e3] text-primary-700' : 'hover:text-primary-800 text-primary-700'} font-extrabold transition-colors`}>{t('nav.studyTours')}</Link>
      ],
      cta: t('home.audience.students.cta'),
      link: '/hsk',
      cardBg: 'bg-gradient-to-b from-primary-50/40 via-white to-white',
      tileBg: 'bg-gradient-to-b from-primary-400 to-primary-600 border-primary-300/40 shadow-lg shadow-primary-500/15',
      tileText: 'HSK',
      tagStyle: 'bg-white/80 border-primary-100/70 text-primary-800 hover:bg-white hover:text-primary-900 hover:border-primary-200/80 hover:shadow-sm',
      btnStyles: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:brightness-[1.03] border border-primary-500/20 shadow-lg shadow-primary-500/15',
      shadowColor: 'hover:shadow-2xl hover:shadow-primary-500/15',
      glowGradient: 'from-primary-300 to-primary-500',
      borderColor: 'border-primary-500/15 hover:border-primary-500/35'
    },
    {
      title: t('home.audience.schools.title'),
      desc: t('home.audience.schools.desc', '一站式留学与升学解决方案，助力院校合作及学分共建'),
      icon: <Building2 className={`w-9 h-9 drop-shadow-sm stroke-[1.8] ${isApple ? 'text-tech-600' : 'text-white'}`} />,
      items: Array.isArray(t('home.audience.schools.items', { returnObjects: true })) ? t('home.audience.schools.items', { returnObjects: true }) as any[] : ['Tailored Chinese courses', 'Extracurricular activities', 'Joint diploma programs'],
      cta: t('home.audience.schools.cta'),
      link: '/contact',
      cardBg: 'bg-gradient-to-b from-tech-50/40 via-white to-white',
      tileBg: 'bg-gradient-to-b from-tech-400 to-tech-600 border-tech-300/40 shadow-lg shadow-tech-500/15',
      tileText: 'CSCA',
      tagStyle: 'bg-white/80 border-tech-100/70 text-tech-700 hover:bg-white hover:text-tech-900 hover:border-tech-200/80 hover:shadow-sm',
      btnStyles: 'bg-gradient-to-r from-tech-500 to-tech-600 text-white hover:brightness-[1.03] border border-tech-500/20 shadow-lg shadow-tech-500/15',
      shadowColor: 'hover:shadow-2xl hover:shadow-tech-500/15',
      glowGradient: 'from-tech-300 to-tech-500',
      borderColor: 'border-tech-500/15 hover:border-tech-500/35'
    },
    {
      title: t('home.audience.companies.title'),
      desc: t('home.audience.companies.desc', '企业专属中文与跨文化培训，为出海业务定制的高效课程'),
      icon: <Briefcase className={`w-9 h-9 drop-shadow-sm stroke-[1.8] ${isApple ? 'text-slate-700' : 'text-white'}`} />,
      items: Array.isArray(t('home.audience.companies.items', { returnObjects: true })) ? t('home.audience.companies.items', { returnObjects: true }) as any[] : ['Industry-specific vocabulary', 'Flexible corporate scheduling', 'Cross-cultural workshops'],
      cta: t('home.audience.companies.cta'),
      link: '/contact',
      cardBg: 'bg-gradient-to-b from-primary-50/15 via-tech-50/15 to-white border-slate-200/80',
      tileBg: 'bg-gradient-to-br from-primary-500 to-tech-500 border-primary-300/30 shadow-lg shadow-primary-500/15',
      tileText: 'B2B',
      tagStyle: 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:text-slate-900 hover:border-primary-200/80 hover:shadow-sm',
      btnStyles: 'bg-gradient-to-r from-primary-600 to-tech-600 text-white hover:brightness-[1.03] border border-primary-500/20 shadow-lg shadow-primary-500/15',
      shadowColor: 'hover:shadow-2xl hover:shadow-primary-500/15',
      glowGradient: 'from-primary-400 to-tech-400',
      borderColor: 'border-slate-200/80 hover:border-primary-500/35'
    }
  ];

  const getCardTag = (idx: number) => {
    switch (idx) {
      case 0:
        return t('home.audience.students.tag', 'For Individuals');
      case 1:
        return t('home.audience.schools.tag', 'For Institutions');
      case 2:
        return t('home.audience.companies.tag', 'For Corporates');
      default:
        return '';
    }
  };

  return (
    <section className={`py-24 relative z-20 transition-colors duration-300 ${isApple ? 'bg-[#fcfcfd]' : 'bg-[#f8fafc] border-y border-slate-200/50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {audiences.map((aud, idx) => {
            const cardBgClass = isApple ? 'bg-gradient-to-b from-slate-50/20 via-white to-white' : aud.cardBg;
            const borderClass = isApple ? 'border-slate-200/50' : aud.borderColor;
            const tileBgClass = isApple 
              ? idx === 0 
                ? 'bg-primary-50/50 border-primary-100/40 shadow-none'
                : idx === 1
                  ? 'bg-tech-50/50 border-tech-100/40 shadow-none'
                  : 'bg-slate-100 border-slate-200/60 shadow-none'
              : aud.tileBg;
            const tagStyleClass = isApple 
              ? idx === 0
                ? 'bg-primary-50/10 border-primary-100/20 text-primary-800 hover:bg-primary-50/30 hover:border-primary-200/40'
                : idx === 1
                  ? 'bg-tech-50/10 border-tech-100/20 text-tech-800 hover:bg-tech-50/30 hover:border-tech-200/40'
                  : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              : aud.tagStyle;
            const btnStylesClass = isApple ? 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-none' : aud.btnStyles;
            const shadowColorClass = isApple ? 'hover:shadow-2xl hover:shadow-slate-200/60' : aud.shadowColor;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.6 }}
                className={`group relative ${cardBgClass} ${borderClass} rounded-[2.5rem] p-8 md:p-10 border transition-all duration-500 flex flex-col items-center text-center ${shadowColorClass} hover:-translate-y-2 cursor-pointer`}
              >
                {/* Top Inner Light highlight */}
                {!isApple && (
                  <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/30 to-transparent rounded-t-[2.5rem] pointer-events-none" />
                )}

                {/* Hover dynamic glow backdrop */}
                {!isApple && (
                  <div className={`absolute -inset-px rounded-[2.5rem] bg-gradient-to-tr ${aud.glowGradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none z-0`} />
                )}

                <div className="relative z-10 flex flex-col items-center w-full h-full flex-grow">
                  {/* Visual Label at top right of card */}
                  <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border bg-white/95 text-slate-600 shadow-sm border-slate-100/80 mb-5`}>
                    {getCardTag(idx)}
                  </span>

                  {/* 3D claymorphic squircle tile from mock design */}
                  <div className="relative mb-6">
                    <div className={`w-24 h-24 rounded-[1.85rem] ${tileBgClass} border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 group-hover:scale-105`}>
                      {/* Glossy sheen indicator */}
                      {!isApple && (
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-[1.85rem]" />
                      )}
                      <div className="mt-1">{aud.icon}</div>
                      <span className={`text-[10px] font-extrabold tracking-widest mt-1.5 uppercase font-mono leading-none ${isApple ? idx === 0 ? 'text-primary-600' : idx === 1 ? 'text-tech-600' : 'text-slate-500' : 'text-[#ffffffea]'}`}>
                        {aud.tileText}
                      </span>
                    </div>
                  </div>

                  {/* Central Main Title */}
                  <h3 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors leading-snug min-h-[64px] flex items-center justify-center text-center mb-2.5">
                    {aud.title}
                  </h3>

                  {/* Card Subtitle description */}
                  <p className="text-xs md:text-sm text-slate-500/90 leading-relaxed font-medium mb-6 max-w-[275px] mx-auto min-h-[64px] flex items-center justify-center text-center">
                    {aud.desc}
                  </p>

                  {/* Tags collection inside cards - locked to exactly 152px height for perfect alignment */}
                  <div className="flex flex-col gap-2.5 w-full max-w-[250px] mx-auto mb-8 items-center h-[152px] justify-center">
                    {aud.items.map((item, i) => (
                      <div 
                        key={i} 
                        className={`px-4 h-11 rounded-full text-xs font-bold shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all duration-300 hover:scale-[1.02] border ${tagStyleClass} w-full text-center flex items-center justify-center gap-2`}
                      >
                        {typeof item === 'string' ? <span className="leading-tight px-1">{item}</span> : item}
                      </div>
                    ))}
                  </div>

                  {/* Glassy pill solid button aligned beautifully at bottom */}
                  <div className="w-full mt-auto">
                    <Link 
                      to={aud.link} 
                      className={`w-[95%] mx-auto py-3.5 px-6 rounded-full font-extrabold text-center flex items-center justify-center gap-2 group/btn transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 ${btnStylesClass}`}
                    >
                      <span>{aud.cta}</span>
                      <ArrowRight className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const MainServices = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const services = [
    {
      id: 'hsk',
      title: t('home.servicesData.hsk.title', 'AI-Assisted HSK Training'),
      desc: t('home.servicesData.hsk.desc', 'Master Chinese with our AI-assisted training for all levels.'),
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1600',
      link: '/hsk',
      icon: <Bot className="w-6 h-6" />,
      color: 'from-tech-500 to-purple-500'
    },
    {
      id: 'csca',
      title: t('home.servicesData.csca.title', 'CSCA Coaching'),
      desc: t('home.servicesData.csca.desc', 'Expert coaching for the CSCA exam.'),
      image: 'https://images.unsplash.com/photo-1544717297-fa95b6ee9643?auto=format&fit=crop&q=80&w=1600',
      link: '/csca',
      icon: <Target className="w-6 h-6" />,
      color: 'from-rose-500 to-red-500'
    },
    {
      id: 'consultancy',
      title: t('home.servicesData.consultancy.title', 'Study Abroad Consultancy'),
      desc: t('home.servicesData.consultancy.desc', 'Comprehensive guidance for studying in China, from university selection to visa processing and scholarship applications.'),
      image: '/consultancy-meeting.jpg',
      fallbackImage: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1600',
      link: '/consultancy',
      icon: <GraduationCap className="w-6 h-6" />,
      color: 'from-emerald-500 to-teal-500'
    },
    {
      id: 'tours',
      title: t('home.servicesData.tours.title', 'Study Tours to China'),
      desc: t('home.servicesData.tours.desc', 'Immersive programs blending language learning, cultural experiences, and visits to tech giants and historical landmarks.'),
      image: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&q=80&w=1600',
      link: '/tours',
      icon: <Plane className="w-6 h-6" />,
      color: 'from-blue-500 to-cyan-500'
    }
  ];

  return (
    <section className={`py-24 transition-colors duration-300 ${isApple ? 'bg-white' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-primary-50 border border-primary-100 text-primary-600'
          }`}>
            <Sparkles className="w-4 h-4" /> {t('home.services.tag')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 tracking-tight">{t('home.services.title1')} <span className="text-gradient">{t('home.services.title2')}</span></h2>
          <p className="text-lg text-slate-600">{t('home.services.desc')}</p>
        </div>

        <div className="space-y-16">
          {services.map((srv, idx) => {
            const iconBgClass = isApple ? 'bg-slate-100 border border-slate-200 text-slate-700' : `bg-gradient-to-br ${srv.color} text-white shadow-lg`;
            const titleHoverClass = isApple ? 'group-hover:text-[#0071e3]' : 'group-hover:text-primary-600';
            const linkTextClass = isApple ? 'text-[#0071e3] group-hover:text-[#0077ed]' : 'text-primary-600 group-hover:text-primary-700';

            return (
              <motion.div 
                key={srv.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="block group"
              >
                <Link to={srv.link} className={`flex flex-col ${idx % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} bg-white rounded-3xl overflow-hidden transition-all duration-500 ${
                  isApple 
                    ? 'border border-slate-200/50 shadow-sm hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/40' 
                    : 'shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:border-primary-200'
                }`}>
                  <div className="md:w-1/2 relative overflow-hidden aspect-[4/3] md:aspect-auto">
                    <img 
                      src={srv.image} 
                      alt={srv.title} 
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (srv.id === 'consultancy') {
                          if (!target.dataset.triedAlt) {
                            target.dataset.triedAlt = 'true';
                            target.src = '/consultancy.jpg';
                            return;
                          }
                        }
                        const fallback = (srv as any).fallbackImage;
                        if (fallback && target.src !== fallback) {
                          target.src = fallback;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                  <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-center relative overflow-hidden">
                    {!isApple && (
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${srv.color} opacity-5 rounded-bl-full -z-0 transition-transform duration-500 group-hover:scale-150`}></div>
                    )}
                    <div className="relative z-10">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transform group-hover:-translate-y-1 transition-transform duration-500 ${iconBgClass}`}>
                        {srv.icon}
                      </div>
                      <h3 className={`text-3xl md:text-4xl font-bold mb-4 text-slate-900 transition-colors ${titleHoverClass}`}>{srv.title}</h3>
                      <p className="text-lg text-slate-600 leading-relaxed mb-8">{srv.desc}</p>
                      <div className={`inline-flex items-center gap-2 font-bold text-lg transition-colors ${linkTextClass}`}>
                        {t('home.services.explore')} <ArrowRight className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const FALLBACK_TRENDING_ITEMS = [
  {
    id: 'hsk-4-bootcamp',
    category: '📚 HSK',
    title: 'HSK 4 Intensive Bootcamp',
    desc: 'Master HSK 4 efficiently. Study online or at our Jakarta center. Perfect for scholarship seekers.',
    image: 'https://images.unsplash.com/photo-1546410531-ee4cb12b22d1?auto=format&fit=crop&q=80&w=800',
    badge: '🔥 Enroll Now',
    link: '/hsk',
    meta: { term: '4 Weeks', start: 'Jun 10', seats: '8 Seats Left', price: 'IDR 2.5M' }
  },
  {
    id: 'csca-scholarship',
    category: '🏗️ CSCA',
    title: 'CSCA Scholarship Prep',
    desc: 'Expert preparation on our Jakarta Campus to help you secure prestigious Chinese university scholarships.',
    image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800',
    badge: '⭐ Enroll Now',
    link: '/csca',
    meta: { term: '6 Weeks', start: 'Jun 20', seats: '10 Seats Left', price: 'IDR 3.8M' }
  },
  {
    id: 'tour-beijing',
    category: '✈️ Study Tour',
    title: 'Beijing · Cultural Tour',
    desc: 'Tsinghua Univ base. Explore Forbidden City, Great Wall, Hutong, and experience an actual HSK Trial.',
    image: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&q=80&w=800',
    badge: '🏃 Recruiting',
    link: '/tours',
    meta: { term: '10-12 Days', start: 'Flexible', seats: 'Need 12 More', price: 'IDR 15-18M' }
  },
  {
    id: 'tour-hangzhou',
    category: '✈️ Study Tour',
    title: 'Hangzhou · Jiangnan Tour',
    desc: 'Zhejiang University base. Discover West Lake, Longjing Tea, Alibaba HQ, and Songcheng Show.',
    image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&q=80&w=800',
    badge: '🏃 Recruiting',
    link: '/tours',
    meta: { term: '8-10 Days', start: 'Flexible', seats: 'Need 17 More', price: 'IDR 12-15M' }
  },
  {
    id: 'tour-wuhan',
    category: '✈️ Study Tour',
    title: 'Wuhan · Chu Culture Tour',
    desc: 'Wuhan University base. Visit Yellow Crane Tower, East Lake, Hubei Museum, and take a Yangtze Cruise.',
    image: 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?auto=format&fit=crop&q=80&w=800',
    badge: '🏃 Recruiting',
    link: '/tours',
    meta: { term: '8-10 Days', start: 'Flexible', seats: 'Need 19 More', price: 'IDR 12-15M' }
  },
  {
    id: 'hsk-3-foundation',
    category: '📚 HSK',
    title: 'HSK 3 Foundation',
    desc: 'Solidify your basics with our upcoming HSK 3 foundation course. Register early to claim your spot.',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
    badge: '⏳ Coming Soon',
    link: '/hsk',
    meta: { term: 'TBA', start: 'Aug 1', seats: 'Notify Me', price: 'TBA' }
  }
];

const TrendingSection = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [trendingItems, setTrendingItems] = useState<any[]>([]);

  useEffect(() => {
    client.fetch(`*[_type == "trendingProgram" && isActive == true] | order(order asc)`).then((data) => {
      const validData = (data || []).filter(Boolean);
      if (validData && validData.length > 0) {
        setTrendingItems(validData.map((item: any) => ({
          id: item._id,
          category: item.category,
          title: item.title,
          desc: item.desc,
          image: urlFor(item.image)?.url() || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
          badge: item.badge,
          link: item.link,
          meta: {
            term: item.term || 'TBA',
            start: item.startDate || 'TBA',
            seats: item.seats || 'Open',
            price: item.price || 'TBA'
          }
        })));
      } else {
        setTrendingItems([]);
      }
    }).catch(err => {
      console.log('Fetching trending programs failed.', err);
      setTrendingItems([]);
    });
  }, []);

  if (trendingItems.length === 0) {
    if ((import.meta as any).env.DEV) {
      return (
        <section className={`py-12 transition-colors duration-300 ${isApple ? 'bg-white' : 'bg-white'} relative overflow-hidden`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="py-8 bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 rounded-3xl p-6 text-center">
              <h3 className="font-bold text-lg mb-2">🔧 [DEV MODE] No Trending Programs Found</h3>
              <p className="text-sm opacity-90">
                This entire Trending Section is hidden in <strong>Production</strong>. Publish a document of type <code>trendingProgram</code> with <code>isActive == true</code> in Sanity.
              </p>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className={`py-24 transition-colors duration-300 ${isApple ? 'bg-white' : 'bg-white'} relative overflow-hidden`}>
      {!isApple && <div className="absolute inset-0 bg-mesh opacity-30"></div>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 border-b border-slate-200 pb-12">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
            isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-primary-50 border border-primary-100 text-primary-600'
          }`}>
            <Briefcase className="w-4 h-4" /> {t('home.trending.tag')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 tracking-tight">{t('home.trending.title1')} <span className="text-gradient">{t('home.trending.title2')}</span></h2>
          <p className="text-lg text-slate-600">{t('home.trending.desc')}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {trendingItems.map((item, idx) => {
            const fallbackKeyMap: Record<string, string> = {
              'hsk-4-bootcamp': 'hsk4',
              'csca-scholarship': 'csca',
              'tour-beijing': 'tourBeijing',
              'tour-hangzhou': 'tourHangzhou',
              'tour-wuhan': 'tourWuhan',
              'hsk-3-foundation': 'hsk3'
            };
            const fKey = item.id ? fallbackKeyMap[item.id] : null;
            const title = fKey ? t(`home.trendingFallbacks.${fKey}.title`, item.title) : item.title;
            const desc = fKey ? t(`home.trendingFallbacks.${fKey}.desc`, item.desc) : item.desc;
            const badge = fKey ? t(`home.trendingFallbacks.${fKey}.badge`, item.badge) : item.badge;

            return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: (idx % 3) * 0.1 }}
              className="h-full block group"
            >
              <Link 
                to={item.link || '#'} 
                className={`h-full overflow-hidden flex flex-col relative block group h-full transition-all duration-300 ${
                  isApple 
                    ? 'rounded-[2rem] bg-white border border-slate-200/50 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/40' 
                    : 'bg-slate-50 rounded-2xl border border-slate-200 hover:border-primary-300 hover:shadow-xl hover:-translate-y-1'
                }`}
              >
                <div className="absolute top-4 left-4 z-20">
                  <span className={`px-3 py-1 text-xs font-bold text-white shadow-md uppercase tracking-wider ${
                    isApple ? 'bg-slate-800 rounded-[6px]' : 'bg-slate-900 rounded-sm'
                  }`}>
                    {item.category}
                  </span>
                </div>
                <div className="absolute top-4 right-4 z-20">
                  <span className={`px-3 py-1 text-sm font-bold shadow-sm border ${
                    isApple 
                      ? 'bg-slate-50/95 border-slate-200 text-slate-800 rounded-full' 
                      : 'bg-white/90 text-rose-600 border-rose-100 rounded-full'
                  }`}>
                    {badge}
                  </span>
                </div>
                
                <div className="relative h-56 overflow-hidden bg-slate-100">
                  <img src={item.image} alt={title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
                </div>
                
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className={`text-xl font-bold mb-2 transition-colors line-clamp-1 ${
                    isApple ? 'text-slate-850 group-hover:text-[#0071e3]' : 'text-slate-900 group-hover:text-primary-600'
                  }`}>{title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6 line-clamp-2">{desc}</p>
                  
                  <div className="mt-auto">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Clock className={`w-4 h-4 ${isApple ? 'text-slate-500' : 'text-primary-500'}`} />
                        <span className="truncate">{item.meta.term}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Calendar className={`w-4 h-4 ${isApple ? 'text-slate-500' : 'text-primary-500'}`} />
                        <span className="truncate">{item.meta.start}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Users className={`w-4 h-4 ${isApple ? 'text-slate-500' : 'text-primary-500'}`} />
                        <span className="truncate">{item.meta.seats}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                        <Tag className={`w-4 h-4 ${isApple ? 'text-slate-500' : 'text-primary-500'}`} />
                        <span className="truncate">{item.meta.price}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  const navigationType = useNavigationType();

  const isRestoringRef = useRef(navigationType === 'POP');

  // Track scroll position in sessionStorage as user scrolls
  useEffect(() => {
    const handleScroll = () => {
      if (!isRestoringRef.current && window.location.pathname === '/') {
        sessionStorage.setItem('home_scrollY', window.scrollY.toString());
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intercept user-initiated scrolling to abort auto-scrolling
  useEffect(() => {
    const abortRestoration = () => {
      isRestoringRef.current = false;
    };
    window.addEventListener('wheel', abortRestoration, { passive: true });
    window.addEventListener('touchstart', abortRestoration, { passive: true });
    window.addEventListener('keydown', abortRestoration, { passive: true });
    window.addEventListener('mousedown', abortRestoration, { passive: true });
    return () => {
      window.removeEventListener('wheel', abortRestoration);
      window.removeEventListener('touchstart', abortRestoration);
      window.removeEventListener('keydown', abortRestoration);
      window.removeEventListener('mousedown', abortRestoration);
    };
  }, []);

  // Handle scroll restoration on POP, clear on PUSH
  useEffect(() => {
    if (navigationType === 'PUSH') {
      sessionStorage.removeItem('home_scrollY');
      isRestoringRef.current = false;
    } else if (navigationType === 'POP') {
      const savedScrollY = sessionStorage.getItem('home_scrollY');
      if (savedScrollY) {
        const targetY = parseInt(savedScrollY, 10);
        if (targetY <= 0) {
          isRestoringRef.current = false;
          return;
        }

        let attempts = 0;
        const maxAttempts = 35; // 3.5 seconds maximum at 100ms interval
        
        const tryScroll = () => {
          if (!isRestoringRef.current) return; // Aborted by user action
          
          const scrollHeight = document.documentElement.scrollHeight;
          const clientHeight = document.documentElement.clientHeight;
          const maxPossibleScroll = scrollHeight - clientHeight;
          const currentTarget = Math.min(targetY, maxPossibleScroll);
          
          window.scrollTo({ top: currentTarget, behavior: 'instant' as any });
          
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(tryScroll, 100);
          } else {
            isRestoringRef.current = false;
          }
        };

        tryScroll();
      } else {
        isRestoringRef.current = false;
      }
    } else {
      isRestoringRef.current = false;
    }
  }, [navigationType]);

  const { t } = useTranslation();

  return (
    <>
      <SEO 
        title={t('meta.home.title', 'UPER Education | Kuliah di China & Beasiswa CSC')} 
        description={t('meta.home.description', 'Konsultan resmi kuliah ke China, bimbingan beasiswa CSC penuh, persiapan ujian CSCA, dan kursus HSK 3.0 standar BLCU di Jakarta PIK.')} 
        canonicalUrl="https://uperedu.com"
        breadcrumbs={[
          { name: 'Home', url: 'https://uperedu.com' }
        ]}
      />
      <Hero />
      <AudienceCards />
      <MainServices />
      <TrendingSection />
      <MarketingCampaign />
      <NewsSection />
      <StudentStories />
      <SchoolPartnerships />
      <CorporateTraining />
      <StrategicPartners />
    </>
  );
}
