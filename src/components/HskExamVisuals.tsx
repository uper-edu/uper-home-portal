import React, { useState } from 'react';

interface HskImageProps {
  id: string; // e.g. "car", "bullet_train", "airplane", "cover_ears", "cover_eyes", "shh", "bird_branch", etc.
  className?: string;
  customSrc?: string;
}

/**
 * HSK Authentic Exam Visual Renderer
 * Priority 1: 100% Genuine PDF Scanned Crop (extracted from official HSK exam paper)
 * Priority 2: Authentic Examination Monochrome Ink Line Art (pure B&W pencil/ink sketch matching official Chinese test papers, zero AI cartoon color)
 */
export function HskExamImage({ id, className = "w-full h-20 sm:h-28", customSrc }: HskImageProps) {
  const [imgError, setImgError] = useState(false);

  // Check if genuine extracted PDF image exists in global cache, props, or static directory
  const extractedSrc = customSrc || 
    (typeof window !== 'undefined' ? (window as any).__HSK_EXTRACTED_IMAGES__?.[id] : null) || 
    `/images/hsk/${id}.png`;

  if (!imgError && extractedSrc) {
    return (
      <div className={`${className} bg-white rounded-lg p-1 flex items-center justify-center border border-slate-200 overflow-hidden shadow-2xs`}>
        <img
          src={extractedSrc}
          alt={id}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  // Official Examination Monochrome Pencil & Ink Sketch Standard (Paper-accurate Line Art)
  switch (id) {
    // ---- Page 2 Q1: Car, Bullet Train, Airplane ----
    case 'car':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 160 100" className="w-full h-full max-h-28" fill="none">
            {/* White Sedan Car - Monochrome Exam Ink Line */}
            <path d="M22 66 C22 58 28 54 38 50 L56 32 C62 26 74 24 88 24 L114 24 C126 24 135 30 142 42 L150 52 C154 56 154 62 152 66 L22 66 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M58 32 L84 32 L84 48 L46 48 Z" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.8" />
            <path d="M88 32 L114 32 C122 32 128 38 134 48 L88 48 Z" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.8" />
            {/* Door & handle */}
            <line x1="86" y1="48" x2="86" y2="66" stroke="#1E293B" strokeWidth="1.5" />
            <line x1="68" y1="52" x2="76" y2="52" stroke="#1E293B" strokeWidth="2" />
            {/* Wheels */}
            <circle cx="50" cy="66" r="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="50" cy="66" r="6" fill="#1E293B" />
            <circle cx="124" cy="66" r="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="124" cy="66" r="6" fill="#1E293B" />
            <line x1="12" y1="80" x2="158" y2="80" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
        </div>
      );

    case 'bullet_train':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 160 100" className="w-full h-full max-h-28" fill="none">
            {/* High-speed bullet train - Monochrome Line */}
            <path d="M10 65 L10 44 C35 44 75 40 115 38 C138 36 152 48 156 58 C156 63 146 66 126 66 L10 66 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M125 41 C138 41 148 46 152 53 L125 53 Z" fill="#1E293B" />
            <line x1="10" y1="52" x2="135" y2="52" stroke="#1E293B" strokeWidth="1.5" />
            {/* Passenger windows */}
            <rect x="25" y="44" width="16" height="6" rx="1.5" fill="#F1F5F9" stroke="#1E293B" strokeWidth="1.2" />
            <rect x="50" y="44" width="16" height="6" rx="1.5" fill="#F1F5F9" stroke="#1E293B" strokeWidth="1.2" />
            <rect x="75" y="44" width="16" height="6" rx="1.5" fill="#F1F5F9" stroke="#1E293B" strokeWidth="1.2" />
            <rect x="100" y="44" width="16" height="6" rx="1.5" fill="#F1F5F9" stroke="#1E293B" strokeWidth="1.2" />
            {/* Track */}
            <line x1="5" y1="70" x2="155" y2="70" stroke="#1E293B" strokeWidth="2.5" />
            <line x1="20" y1="70" x2="16" y2="76" stroke="#64748B" strokeWidth="1.5" />
            <line x1="50" y1="70" x2="46" y2="76" stroke="#64748B" strokeWidth="1.5" />
            <line x1="80" y1="70" x2="76" y2="76" stroke="#64748B" strokeWidth="1.5" />
            <line x1="110" y1="70" x2="106" y2="76" stroke="#64748B" strokeWidth="1.5" />
            <line x1="140" y1="70" x2="136" y2="76" stroke="#64748B" strokeWidth="1.5" />
          </svg>
        </div>
      );

    case 'airplane':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 160 100" className="w-full h-full max-h-28" fill="none">
            {/* Fuselage - Exam Ink */}
            <path d="M16 66 C40 60 90 44 135 28 C145 25 152 28 150 34 C145 40 110 64 80 74 L16 66 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            {/* Wings */}
            <path d="M74 50 L106 14 L118 16 L90 54 Z" fill="#F1F5F9" stroke="#1E293B" strokeWidth="2" />
            <path d="M58 60 L48 86 L58 87 L78 64 Z" fill="#F1F5F9" stroke="#1E293B" strokeWidth="2" />
            {/* Tail */}
            <path d="M22 64 L10 38 L22 40 L28 64 Z" fill="#F1F5F9" stroke="#1E293B" strokeWidth="2" />
            {/* Windows */}
            <circle cx="85" cy="46" r="1.8" fill="#1E293B" />
            <circle cx="95" cy="43" r="1.8" fill="#1E293B" />
            <circle cx="105" cy="40" r="1.8" fill="#1E293B" />
            <circle cx="115" cy="36" r="1.8" fill="#1E293B" />
          </svg>
        </div>
      );

    // ---- Page 2 Q2: Hands on ears (捂耳朵), eyes (捂眼睛), shh (嘘) ----
    case 'cover_ears':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="60" cy="56" r="28" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            {/* Hair */}
            <path d="M32 46 C32 26 50 18 60 18 C70 18 88 26 88 46 C80 34 60 30 32 46 Z" fill="#1E293B" />
            {/* Eyes tightly closed */}
            <path d="M46 54 L54 54" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M66 54 L74 54" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            {/* Distressed mouth */}
            <path d="M52 70 Q60 65 68 70" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            {/* Hands covering ears */}
            <ellipse cx="28" cy="56" rx="8" ry="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="92" cy="56" rx="8" ry="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            {/* Sound waves crossed out */}
            <path d="M14 46 Q8 56 14 66" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M106 46 Q112 56 106 66" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'cover_eyes':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="60" cy="56" r="28" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M32 46 C32 26 50 18 60 18 C70 18 88 26 88 46 C80 34 60 30 32 46 Z" fill="#1E293B" />
            <circle cx="60" cy="72" r="3.5" fill="#1E293B" />
            {/* Hands covering eyes */}
            <ellipse cx="48" cy="53" rx="14" ry="9" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="72" cy="53" rx="14" ry="9" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
          </svg>
        </div>
      );

    case 'shh':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="60" cy="56" r="28" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M32 46 C32 26 50 18 60 18 C70 18 88 26 88 46 C80 34 60 30 32 46 Z" fill="#1E293B" />
            <circle cx="48" cy="50" r="3" fill="#1E293B" />
            <circle cx="72" cy="50" r="3" fill="#1E293B" />
            {/* Raised finger on lips */}
            <rect x="56" y="58" width="8" height="26" rx="4" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <line x1="56" y1="68" x2="64" y2="68" stroke="#1E293B" strokeWidth="1.5" />
          </svg>
        </div>
      );

    // ---- Page 2 Q3: Bird on branch, Cat on chair, Dog under chair ----
    case 'bird_branch':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            {/* Branch */}
            <path d="M10 80 Q60 68 110 74" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M70 72 Q90 54 105 48" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            {/* Bird body */}
            <ellipse cx="55" cy="56" rx="18" ry="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="42" cy="48" r="9" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M33 48 L24 50 L33 53 Z" fill="#1E293B" />
            <circle cx="42" cy="46" r="1.8" fill="#1E293B" />
            <path d="M68 60 L85 66 L70 68 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
          </svg>
        </div>
      );

    case 'cat_on_chair':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            {/* Wooden Chair Line Art */}
            <path d="M35 15 L35 60 L85 60 L85 15" stroke="#1E293B" strokeWidth="2.5" />
            <line x1="35" y1="30" x2="85" y2="30" stroke="#1E293B" strokeWidth="1.8" />
            <line x1="35" y1="45" x2="85" y2="45" stroke="#1E293B" strokeWidth="1.8" />
            <rect x="30" y="58" width="60" height="6" rx="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <line x1="36" y1="64" x2="32" y2="105" stroke="#1E293B" strokeWidth="2.5" />
            <line x1="84" y1="64" x2="88" y2="105" stroke="#1E293B" strokeWidth="2.5" />
            {/* Cat ON Chair */}
            <ellipse cx="60" cy="50" rx="14" ry="11" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="60" cy="40" r="8" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <polygon points="53,35 56,28 60,35" fill="#1E293B" />
            <polygon points="60,35 64,28 67,35" fill="#1E293B" />
            <circle cx="57" cy="39" r="1.5" fill="#1E293B" />
            <circle cx="63" cy="39" r="1.5" fill="#1E293B" />
          </svg>
        </div>
      );

    case 'dog_under_chair':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <path d="M35 15 L35 60 L85 60 L85 15" stroke="#1E293B" strokeWidth="2.5" />
            <rect x="30" y="58" width="60" height="6" rx="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <line x1="36" y1="64" x2="30" y2="105" stroke="#1E293B" strokeWidth="2.5" />
            <line x1="84" y1="64" x2="90" y2="105" stroke="#1E293B" strokeWidth="2.5" />
            {/* Dog UNDER Chair */}
            <ellipse cx="60" cy="85" rx="14" ry="10" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="50" cy="78" r="8" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="46" cy="76" rx="3" ry="6" fill="#1E293B" />
            <circle cx="48" cy="78" r="1" fill="#FFFFFF" />
          </svg>
        </div>
      );

    // ---- Page 4 Q8-10: Hand bottle, Headache, Driving car, Soccer girl, Laughing TV, Book stack ----
    case 'hand_bottle':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            {/* Sleeve & Hand */}
            <path d="M10 80 L50 65 L60 75 L20 95 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <circle cx="62" cy="65" r="9" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            {/* Water bottle */}
            <rect x="65" y="24" width="22" height="52" rx="6" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <rect x="71" y="15" width="10" height="9" rx="2" fill="#1E293B" />
            <line x1="65" y1="44" x2="87" y2="44" stroke="#1E293B" strokeWidth="1.5" />
            <line x1="65" y1="56" x2="87" y2="56" stroke="#1E293B" strokeWidth="1.5" />
          </svg>
        </div>
      );

    case 'headache':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="60" cy="55" r="26" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M35 48 C35 25 50 20 60 20 C70 20 85 25 85 48 Z" fill="#1E293B" />
            {/* Hands on temples */}
            <circle cx="36" cy="52" r="7" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <circle cx="84" cy="52" r="7" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            {/* Headache lines */}
            <path d="M30 36 L22 32" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            <path d="M90 36 L98 32" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'driver_car_wave':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <path d="M20 75 C20 50 35 45 55 45 L95 45 C105 45 115 55 115 75 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <rect x="40" y="50" width="30" height="20" rx="3" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.8" />
            <circle cx="55" cy="58" r="6" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            {/* Waving hand out window */}
            <path d="M50 48 Q42 35 48 30" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'soccer_girl':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            {/* Soccer Ball */}
            <circle cx="70" cy="25" r="10" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <polygon points="70,20 75,23 73,28 67,28 65,23" fill="#1E293B" />
            {/* Figure kicking */}
            <circle cx="58" cy="46" r="9" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <path d="M50 55 L66 55 L63 78 L53 78 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <path d="M53 78 L46 102" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
            <path d="M63 78 L76 92" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'laughing_tv':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            {/* Person leaning back on sofa laughing */}
            <ellipse cx="60" cy="90" rx="35" ry="14" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M45 76 L75 76 L70 50 L50 50 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <circle cx="60" cy="38" r="12" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            {/* Open laughing mouth */}
            <path d="M54 40 Q60 50 66 40 Z" fill="#1E293B" />
          </svg>
        </div>
      );

    case 'boy_books':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="60" cy="34" r="10" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <path d="M50 44 L70 44 L68 84 L52 84 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            {/* Stack of books */}
            <rect x="42" y="55" width="36" height="7" rx="1.5" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.8" />
            <rect x="44" y="62" width="34" height="7" rx="1.5" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.8" />
            <rect x="40" y="69" width="38" height="7" rx="1.5" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.8" />
          </svg>
        </div>
      );

    // ---- Page 7 Q22-25: Guitar boy, Schoolgirl, Umbrella, Eggs & Milk, Two men waving ----
    case 'guitar_boy':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="55" cy="35" r="9" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            {/* Guitar */}
            <path d="M25 80 L80 40 L88 46 L35 88 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <line x1="85" y1="42" x2="105" y2="28" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="38" cy="80" r="12" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            {/* Music note */}
            <path d="M75 25 Q82 20 85 28" stroke="#1E293B" strokeWidth="2" fill="none" />
            <circle cx="85" cy="28" r="2" fill="#1E293B" />
          </svg>
        </div>
      );

    case 'schoolgirl':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="55" cy="35" r="8" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <path d="M50 43 L62 43 L60 70 L52 70 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <path d="M48 68 L64 68 L67 85 L45 85 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            {/* Backpack */}
            <rect x="60" y="44" width="14" height="22" rx="3" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
          </svg>
        </div>
      );

    case 'umbrella':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <path d="M20 55 C20 25 100 25 100 55 Z" fill="#1E293B" stroke="#1E293B" strokeWidth="2" />
            <line x1="60" y1="20" x2="60" y2="55" stroke="#1E293B" strokeWidth="2.5" />
            <line x1="60" y1="55" x2="60" y2="90" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M60 90 C60 96 68 96 68 90" stroke="#1E293B" strokeWidth="2.5" fill="none" />
          </svg>
        </div>
      );

    case 'eggs_milk':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            {/* Milk Glass */}
            <rect x="30" y="40" width="30" height="40" rx="3" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M60 50 Q72 50 72 60 Q72 70 60 70" stroke="#1E293B" strokeWidth="2.5" fill="none" />
            {/* Eggs */}
            <ellipse cx="78" cy="74" rx="9" ry="12" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <ellipse cx="92" cy="77" rx="8" ry="11" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <ellipse cx="84" cy="64" rx="8" ry="10" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
          </svg>
        </div>
      );

    case 'two_men_waving':
      return (
        <div className={`${className} bg-white rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-300 shadow-2xs`}>
          <svg viewBox="0 0 120 120" className="w-full h-full max-h-28" fill="none">
            <circle cx="45" cy="40" r="8" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <path d="M38 48 L52 48 L50 85 L40 85 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <path d="M52 50 L68 35" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
            <circle cx="78" cy="45" r="8" fill="#1E293B" stroke="#1E293B" strokeWidth="2" />
            <path d="M70 53 L86 53 L84 85 L72 85 Z" fill="#1E293B" stroke="#1E293B" strokeWidth="2" />
          </svg>
        </div>
      );

    default:
      return null;
  }
}
