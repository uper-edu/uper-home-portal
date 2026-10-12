import React from 'react';
import { motion } from 'motion/react';
import { Plane, Shield, BookOpen, Users, MapPin, ArrowRight, Bot, Heart, Globe2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/SEO';
import { useDesignStyle } from '../utils/theme';

export default function StudyTours() {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();

  const featuresTranslation = t('tours.features', { returnObjects: true });
  const featuresItems = Array.isArray(featuresTranslation) ? featuresTranslation : [{},{},{}];
  const features = [
    {
      icon: <BookOpen className="w-7 h-7" />,
      title: featuresItems[0]?.title || "Expertly Crafted Programs",
      desc: featuresItems[0]?.desc || "Language learning, cultural workshops, academic interactions, and visits to tech giants and historical landmarks.",
      bgClass: "bg-blue-50",
      textClass: "text-blue-600"
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: featuresItems[1]?.title || "Extensive Resource Integration",
      desc: featuresItems[1]?.desc || "Long-term partnerships with prestigious educational institutions, top-tier universities, and renowned professors.",
      bgClass: "bg-emerald-50",
      textClass: "text-emerald-600"
    },
    {
      icon: <Shield className="w-7 h-7" />,
      title: featuresItems[2]?.title || "Comprehensive Service Assurance",
      desc: featuresItems[2]?.desc || "Professional tour leaders, overseas travel insurance, comfortable accommodation, and seamless communication with parents.",
      bgClass: "bg-purple-50",
      textClass: "text-purple-600"
    }
  ];

  const toursTranslation = t('tours.programs', { returnObjects: true });
  const toursItems = Array.isArray(toursTranslation) ? toursTranslation : [{},{},{},{}];
  const tours = [
    {
      id: "wuhan",
      title: toursItems[0]?.title || "Wuhan Summer Camp",
      image: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?auto=format&fit=crop&q=80&w=800",
      desc: toursItems[0]?.desc || "Immerse yourself in the vibrant culture and academic excellence of central China. Visit Huanghelou, explore Wuhan University's campus, and experience local traditions.",
      tags: toursItems[0]?.tags || ["Summer 2025", "Language", "Culture"]
    },
    {
      id: "beijing",
      title: toursItems[1]?.title || "Beijing Cultural Immersion",
      image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&q=80&w=800",
      desc: toursItems[1]?.desc || "A full 14-day guided experience exploring top universities like Tsinghua and Peking University, tech innovations in Zhongguancun, and historical heritage like the Great Wall.",
      tags: toursItems[1]?.tags || ["Capital", "Top Universities", "Heritage"]
    },
    {
      id: "shanghai-hangzhou",
      title: toursItems[2]?.title || "Shanghai & Hangzhou Business Tour",
      image: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&q=80&w=800",
      desc: toursItems[2]?.desc || "Experience the magic of modern metropolises. Includes visits to Alibaba headquarters, modern tech hubs, and the serene beauty of the West Lake.",
      tags: toursItems[2]?.tags || ["Tech Giants", "Modern City", "E-commerce"]
    },
    {
      id: "shenzhen",
      title: toursItems[3]?.title || "Shenzhen Tech & Innovation Tour",
      image: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=800",
      desc: toursItems[3]?.desc || "Step into the heart of China's silicon valley. Exclusive access to leading technological giants, hardware markets, and networking with local innovators.",
      tags: toursItems[3]?.tags || ["Innovation", "Networking", "Tech Hub"]
    }
  ];

  return (
    <div className="pt-32 pb-20">
      <SEO 
        title={t('meta.tours.title', 'Study Tours')} 
        description={t('meta.tours.description', 'Immersive study tours to China. Experience the culture and visit top universities.')} 
        canonicalUrl="https://uperedu.com/tours"
        breadcrumbs={[
          { name: 'Home', url: 'https://uperedu.com' },
          { name: 'Study Tours', url: 'https://uperedu.com/tours' }
        ]}
        schemaData={{
          "@type": "TouristTrip",
          "name": "UPER China University Immersion & STEM Study Tour",
          "description": "Guided educational exploration and university immersion camp visiting Tsinghua, Peking University, and high-tech innovation hubs.",
          "provider": {
            "@type": "EducationalOrganization",
            "name": "PT UPER EDUCATION TECHNOLOGY"
          }
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
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}
          >
            <Plane className="w-4 h-4" />
            <span>{t("tours.tag", "Immersive Experiences")}</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight"
          >
            {t("tours.title1", "China ")} <span className="text-gradient">{t("tours.title2", "Study Tours")}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-600"
          >
            {t("tours.desc")}
          </motion.p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white p-8 rounded-3xl transition-all duration-300 ${
                isApple 
                  ? 'border border-slate-200/50 shadow-none' 
                  : 'border border-slate-100 shadow-xl shadow-slate-200/40 hover:-translate-y-1'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-slate-900">{feature.title}</h3>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ml-3 -mt-4 -mr-4 shadow-sm ${
                  isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/50' : `${feature.bgClass} ${feature.textClass}`
                }`}>
                  {feature.icon}
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed mt-1">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Guiding Principles */}
        <GuidingPrinciples />

        {/* Tour List */}
        <div className="space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-8">{t("tours.availablePrograms", "Available Programs")}</h2>
          
          {tours.map((tour, idx) => (
            <motion.div 
              key={tour.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white rounded-3xl overflow-hidden flex flex-col md:flex-row group transition-all duration-300 ${
                isApple 
                  ? 'border border-slate-200/50 shadow-none' 
                  : 'border border-slate-100 shadow-xl shadow-slate-200/40'
              }`}
            >
              <div className="md:w-2/5 relative overflow-hidden aspect-[4/3] md:aspect-auto">
                <img 
                  src={tour.image} 
                  alt={tour.title} 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="md:w-3/5 p-8 md:p-12 flex flex-col justify-center">
                <div className="flex flex-wrap gap-2 mb-4">
                  {tour.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="text-3xl font-bold mb-4 text-slate-900">{tour.title}</h3>
                <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                  {tour.desc}
                </p>
                <div className="mt-auto">
                  <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 font-semibold transition-colors group/btn ${
                    isApple ? 'text-[#0071e3] hover:text-[#0077ed]' : 'text-primary-600 hover:text-primary-700'
                  }`}>
                    {t("tours.requestItinerary", "Request Itinerary")} <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>

      {/* Destinations Gallery */}
      <Destinations />
    </div>
  );
}

const GuidingPrinciples = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const valuesTranslation = t('tours.values', { returnObjects: true });
  const valuesItems = Array.isArray(valuesTranslation) ? valuesTranslation : [{},{},{}];
  const values = [
    {
      icon: <Bot className={`w-7 h-7 ${isApple ? 'text-slate-700' : 'text-blue-600'}`} />,
      title: valuesItems[0]?.title || "Tech-Enhanced Learning",
      desc: valuesItems[0]?.desc || "Cutting-edge AI tools and interactive platforms that adapt to your pace, making mastering Chinese faster and more intuitive.",
      bgClass: "bg-blue-50"
    },
    {
      icon: <Heart className={`w-7 h-7 ${isApple ? 'text-slate-700' : 'text-emerald-600'}`} />,
      title: valuesItems[1]?.title || "Humanistic Care",
      desc: valuesItems[1]?.desc || "Education is more than academics. We prioritize your emotional wellbeing, personal growth, and cultural sensitivity.",
      bgClass: "bg-emerald-50"
    },
    {
      icon: <Globe2 className={`w-7 h-7 ${isApple ? 'text-slate-700' : 'text-rose-500'}`} />,
      title: valuesItems[2]?.title || "Global Citizenship",
      desc: valuesItems[2]?.desc || "Starting in Indonesia, we build bridges to China and the world, celebrating diverse perspectives and inclusive environments.",
      bgClass: "bg-rose-50"
    }
  ];

  return (
    <div className="mb-24">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900 tracking-tight">{t("tours.guidingPrinciples.title", "Our Guiding Principles")}</h2>
        <p className="text-slate-600 text-lg">{t("tours.guidingPrinciples.desc", "We believe in a holistic approach that combines the efficiency of modern technology with the warmth of human connection.")}</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {values.map((val, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className={`p-8 rounded-3xl border transition-all group ${
              isApple 
                ? 'bg-[#fcfcfd] border-slate-200/50 hover:border-slate-300' 
                : 'bg-slate-50 border-slate-100 hover:shadow-xl hover:bg-white'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-slate-900">{val.title}</h3>
              <div className={`w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-3 -mt-4 -mr-4 ${
                isApple ? 'bg-slate-100 border border-slate-200/50' : val.bgClass
              }`}>
                {val.icon}
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed mt-1">{val.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const Destinations = () => {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const places = [
    { name: "Peking University", img: "https://images.unsplash.com/photo-1599827552599-2f3dbdb95945?auto=format&fit=crop&q=80&w=800" },
    { name: "Beijing Language and Culture University", img: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&q=80&w=800" },
    { name: "Shanghai Disneyland", img: "https://images.unsplash.com/photo-1505809850792-4dcf0b89b1c0?auto=format&fit=crop&q=80&w=800" },
    { name: "Shanghai BeiDou Navigation Satellite Industry Base", img: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800" },
    { name: "Alibaba", img: "https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=800" },
    { name: "Wuhan University", img: "https://images.unsplash.com/photo-1523841589119-b444fe6e7a57?auto=format&fit=crop&q=80&w=800" },
    { name: "Geely", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800" },
    { name: "Wuzhen", img: "https://images.unsplash.com/photo-1552554749-cc19cbe35fb8?auto=format&fit=crop&q=80&w=800" },
    { name: "China Central Normal University", img: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800" },
  ];

  return (
    <section className="py-24 bg-white overflow-hidden mt-12 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900 tracking-tight">{t("tours.destinations.title", "Study Destinations Gallery")}</h2>
        <p className="text-slate-600 text-lg">{t("tours.destinations.desc", "Explore the incredible places you'll visit during our immersive study tours.")}</p>
      </div>
      
      <div className="flex overflow-x-auto pb-12 px-4 sm:px-6 lg:px-8 gap-6 snap-x snap-mandatory hide-scrollbar overscroll-x-contain">
        {places.map((place, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="min-w-[300px] md:min-w-[400px] aspect-[4/5] rounded-3xl overflow-hidden relative snap-center group"
          >
            <img 
              src={place.img} 
              alt={place.name} 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute bottom-0 left-0 p-8 transform translate-y-4 group-hover:translate-y-0 transition-transform">
              <div className={`flex items-center gap-2 mb-2 ${isApple ? 'text-slate-300' : 'text-primary-400'}`}>
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-bold uppercase tracking-wider">{t("tours.destinationLabel", "Destination")}</span>
              </div>
              <h3 className="text-2xl font-bold text-white">{place.name}</h3>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
