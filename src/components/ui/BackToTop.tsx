import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp } from 'lucide-react';
import { useDesignStyle } from '../../utils/theme';

export const BackToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { isApple } = useDesignStyle();

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      if (scrollTop > 350) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }

      if (docHeight > 0) {
        const progress = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <>
      {/* Top scroll progress indicator bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 z-[100] pointer-events-none bg-slate-200/30">
        <div
          className={`h-full transition-all duration-150 ease-out ${
            isApple ? 'bg-slate-800' : 'bg-primary-600'
          }`}
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Back to top button */}
      <AnimatePresence>
        {isVisible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={scrollToTop}
            aria-label="Back to top"
            title="Kembali ke Atas / Back to Top"
            className={`fixed bottom-20 md:bottom-8 right-5 z-40 p-3 rounded-full shadow-lg border transition-all cursor-pointer active:scale-95 ${
              isApple
                ? 'bg-white/90 backdrop-blur-md border-slate-200 text-slate-800 hover:bg-white hover:text-slate-950 shadow-slate-200/50'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 shadow-slate-300/40'
            }`}
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};
