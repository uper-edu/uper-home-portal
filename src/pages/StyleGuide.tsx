import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, CheckCircle2, AlertCircle, Info, ArrowRight, UploadCloud, 
  ChevronRight, Landmark, School, Building2, ExternalLink, HelpCircle, 
  MapPin, Phone, Mail, Calendar, Clock, Users, Play, Palette, LayoutGrid
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DesignSyncMonitor from '../components/DesignSyncMonitor';

export default function StyleGuide() {
  const [globalStyle, setGlobalStyle] = useState<'default' | 'apple'>('default');
  const [colorTheme, setColorTheme] = useState<'teal' | 'ocean' | 'autumn' | 'charcoal'>('teal');
  const [inputText, setInputText] = useState('');
  const [selectVal, setSelectVal] = useState('1');

  // Sync with HTML attribute for realistic local testing
  useEffect(() => {
    const origStyle = document.documentElement.getAttribute('data-design-style') || 'default';
    const origTheme = document.documentElement.getAttribute('data-color-theme') || 'teal';
    
    // Set to local initial
    setGlobalStyle(origStyle as any);
    setColorTheme(origTheme as any);
  }, []);

  const handleStyleChange = (style: 'default' | 'apple') => {
    setGlobalStyle(style);
    document.documentElement.setAttribute('data-design-style', style);
    localStorage.setItem('uper-design-style', style);
    // Dispatch event to notify layout & other components
    window.dispatchEvent(new Event('storage'));
  };

  const handleThemeChange = (theme: 'teal' | 'ocean' | 'autumn' | 'charcoal') => {
    setColorTheme(theme);
    document.documentElement.setAttribute('data-color-theme', theme);
    localStorage.setItem('uper-color-theme', theme);
    window.dispatchEvent(new Event('storage'));
  };

  // Helper component to force a specific style context in side-by-side panels
  const RenderPanel = ({ isApple, children, title }: { isApple: boolean, children: React.ReactNode, title: string }) => {
    return (
      <div className={`p-6 md:p-8 rounded-3xl border transition-all duration-300 ${
        isApple 
          ? 'bg-white/70 backdrop-blur-md border-slate-200/60 shadow-sm' 
          : 'bg-slate-50/50 border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/50">
          <h3 className={`text-sm font-bold uppercase tracking-wider ${
            isApple ? 'text-slate-800' : 'text-primary-700'
          }`}>
            {title}
          </h3>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
            isApple ? 'bg-slate-900 text-white' : 'bg-primary-100 text-primary-700'
          }`}>
            {isApple ? 'Apple Style Context' : 'Default UI Context'}
          </span>
        </div>
        <div className="space-y-8">
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      {/* Intro Header */}
      <div className="mb-12 text-center md:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 mb-4">
          <Palette className="w-3.5 h-3.5 text-primary-500" />
          <span>UPER Design & Style Lab</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Style Guide & Components Showcase
        </h1>
        <p className="text-slate-600 max-w-3xl leading-relaxed text-base md:text-lg">
          Welcome to the hidden Design Style system debug dashboard. Use this panel to analyze padding, borders, color harmony, typography sizes, and components rendering side-by-side across both <strong className="text-slate-800">Default (Teal/Ocean)</strong> and <strong className="text-[#0071e3]">Apple (San Francisco Slate)</strong> design modes.
        </p>
      </div>

      {/* Global Interactive Controller */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 mb-12 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary-500" />
          Global Environment Controls (Live Simulation)
        </h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Design Style Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
              Active Global Design Style
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleStyleChange('default')}
                className={`py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  globalStyle === 'default'
                    ? 'bg-primary-600 text-white border-transparent shadow-md shadow-primary-500/10'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${globalStyle === 'default' ? 'bg-white' : 'bg-primary-500'}`} />
                <span>Default (Brand Focus)</span>
              </button>
              <button
                onClick={() => handleStyleChange('apple')}
                className={`py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  globalStyle === 'apple'
                    ? 'bg-slate-900 text-white border-transparent shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${globalStyle === 'apple' ? 'bg-white' : 'bg-slate-400'}`} />
                <span>Apple (Minimalist SF)</span>
              </button>
            </div>
          </div>

          {/* Color Theme Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
              Brand Color Accents (Applies to Default Style)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['teal', 'ocean', 'autumn', 'charcoal'] as const).map((tTheme) => (
                <button
                  key={tTheme}
                  onClick={() => handleThemeChange(tTheme)}
                  className={`py-2.5 px-2 rounded-xl font-semibold text-xs capitalize transition-all border cursor-pointer ${
                    colorTheme === tTheme
                      ? 'bg-white text-slate-900 border-slate-900 ring-2 ring-slate-900/10 font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                    tTheme === 'teal' ? 'bg-teal-500' :
                    tTheme === 'ocean' ? 'bg-sky-600' :
                    tTheme === 'autumn' ? 'bg-amber-600' : 'bg-slate-600'
                  }`} />
                  {tTheme}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Programmatic Design Sync Auditing Station */}
      <DesignSyncMonitor />

      {/* Side-by-Side Playground Container */}
      <div className="space-y-16">
        
        {/* Section 1: Typography and Headings */}
        <section>
          <div className="border-l-4 border-primary-500 pl-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">1. Headers & Typography</h2>
            <p className="text-sm text-slate-500 mt-1">
              Check letter-spacing, tracking-tight, weights, and color contrast safeguards inside light and dark wrappers.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Default Typography */}
            <RenderPanel isApple={false} title="Default Style Typography">
              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-1">Display H1 Title</span>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Empowering Global Education partnerships
                </h1>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-1">Section H2 Header</span>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Our Study Abroad Services
                </h2>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-1">Component H3 Title</span>
                <h3 className="text-lg font-bold text-slate-800">
                  Dual Degree & Pathway Programs
                </h3>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-1">Body Text & Paragraphs</span>
                <p className="text-slate-600 text-sm leading-relaxed">
                  We provide streamlined, professional cross-border consultancy and partnership channels for universities worldwide, ensuring highly coordinated execution and pristine academic quality.
                </p>
              </div>
            </RenderPanel>

            {/* Apple Typography */}
            <RenderPanel isApple={true} title="Apple Style Typography">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Display H1 Title</span>
                <h1 className="text-4xl font-semibold text-[#1d1d1f] tracking-tight leading-tight">
                  Empowering Global Education partnerships
                </h1>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Section H2 Header</span>
                <h2 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
                  Our Study Abroad Services
                </h2>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Component H3 Title</span>
                <h3 className="text-lg font-semibold text-[#1d1d1f]">
                  Dual Degree & Pathway Programs
                </h3>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Body Text & Paragraphs</span>
                <p className="text-slate-500 text-sm leading-relaxed tracking-normal">
                  We provide streamlined, professional cross-border consultancy and partnership channels for universities worldwide, ensuring highly coordinated execution and pristine academic quality.
                </p>
              </div>
            </RenderPanel>
          </div>
        </section>

        {/* Section 2: Action Buttons */}
        <section>
          <div className="border-l-4 border-primary-500 pl-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">2. Buttons & Interactivity</h2>
            <p className="text-sm text-slate-500 mt-1">
              Verify border-radius, color values, shadow styles, hover effects, and icon spacing.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Default Buttons */}
            <RenderPanel isApple={false} title="Default Style Buttons">
              {/* Primary Action Button */}
              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-2">Primary Action Button</span>
                <button className="bg-primary-600 text-white px-6 py-3 rounded-full font-bold hover:bg-primary-700 transition-all shadow-md hover:shadow-lg hover:shadow-primary-500/20 flex items-center gap-2 cursor-pointer text-sm">
                  <span>Start Your Journey</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Secondary Action Button */}
              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-2">Secondary Button (Teal-tinted)</span>
                <button className="bg-primary-50 border border-primary-100 text-primary-600 px-6 py-2.5 rounded-full font-bold hover:bg-primary-100 transition-all flex items-center gap-2 cursor-pointer text-sm">
                  <span>Learn More</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Icon / Circular Action */}
              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-2">Circular Icon Trigger</span>
                <button className="w-10 h-10 rounded-full flex items-center justify-center bg-primary-50 border border-primary-100 text-primary-600 hover:bg-primary-100 hover:scale-105 transition-all cursor-pointer">
                  <Palette className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Outline Style */}
              <div>
                <span className="text-[10px] uppercase font-bold text-primary-600 block mb-2">Outline Button</span>
                <button className="bg-transparent border border-slate-200 hover:border-primary-300 hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-full font-semibold transition-all cursor-pointer text-sm">
                  Explore Programs
                </button>
              </div>
            </RenderPanel>

            {/* Apple Buttons */}
            <RenderPanel isApple={true} title="Apple Style Buttons">
              {/* Primary Action Button */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Primary Action Button</span>
                <button className="bg-[#0071e3] text-white px-6 py-3 rounded-full font-medium hover:bg-[#0077ed] transition-all flex items-center gap-2 cursor-pointer text-sm shadow-sm active:scale-95">
                  <span>Start Your Journey</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Secondary Action Button */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Secondary Button (Slate-tinted)</span>
                <button className="bg-slate-100 text-slate-800 border border-slate-200/60 px-6 py-2.5 rounded-full font-medium hover:bg-slate-200 transition-all flex items-center gap-2 cursor-pointer text-sm active:scale-95">
                  <span>Learn More</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Icon / Circular Action */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Circular Icon Trigger</span>
                <button className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100 hover:text-slate-950 transition-all cursor-pointer active:scale-95">
                  <Palette className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Outline Style */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Outline Button</span>
                <button className="bg-transparent border border-slate-300 hover:border-slate-800 hover:bg-slate-50 text-slate-850 px-6 py-2.5 rounded-full font-medium transition-all cursor-pointer text-sm active:scale-95">
                  Explore Programs
                </button>
              </div>
            </RenderPanel>
          </div>
        </section>

        {/* Section 3: Pill Tags & Badges */}
        <section>
          <div className="border-l-4 border-primary-500 pl-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">3. Badges, Tags & Status Pills</h2>
            <p className="text-sm text-slate-500 mt-1">
              Verify tag backgrounds, text-weight, uppercase properties, and tiny icon integration.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Default Badges */}
            <RenderPanel isApple={false} title="Default Style Badges">
              {/* Category Pill */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-primary-600 block">Category / Section Badge</span>
                <div className="flex">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Global Partnerships</span>
                  </div>
                </div>
              </div>

              {/* Status Tags */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-primary-600 block">Status Badges (Success, Info, Alert)</span>
                <div className="flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                    <Info className="w-3.5 h-3.5" /> Active
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
                    <AlertCircle className="w-3.5 h-3.5" /> Pending
                  </span>
                </div>
              </div>

              {/* Interactive List Tags */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-primary-600 block">Interactive Filter Chip</span>
                <div className="flex gap-2">
                  <button className="px-4 py-1.5 rounded-full bg-primary-600 text-white text-xs font-bold shadow-sm">
                    All Partners
                  </button>
                  <button className="px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:border-primary-300">
                    Universities
                  </button>
                </div>
              </div>
            </RenderPanel>

            {/* Apple Badges */}
            <RenderPanel isApple={true} title="Apple Style Badges">
              {/* Category Pill */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Category / Section Badge</span>
                <div className="flex">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/50 text-slate-800 text-xs font-medium uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                    <span>Global Partnerships</span>
                  </div>
                </div>
              </div>

              {/* Status Tags */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Status Badges (Success, Info, Alert)</span>
                <div className="flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-50 text-slate-850 text-xs font-medium border border-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> Approved
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-50 text-slate-850 text-xs font-medium border border-slate-200">
                    <Info className="w-3.5 h-3.5 text-slate-600" /> Active
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-50 text-slate-850 text-xs font-medium border border-slate-200">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-600" /> Pending
                  </span>
                </div>
              </div>

              {/* Interactive List Tags */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Interactive Filter Chip</span>
                <div className="flex gap-2">
                  <button className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium">
                    All Partners
                  </button>
                  <button className="px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium hover:border-slate-800 hover:text-slate-900">
                    Universities
                  </button>
                </div>
              </div>
            </RenderPanel>
          </div>
        </section>

        {/* Section 4: Input Elements */}
        <section>
          <div className="border-l-4 border-primary-500 pl-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">4. Form Inputs & Interactive Selects</h2>
            <p className="text-sm text-slate-500 mt-1">
              Analyze text field focus states, textarea bounds, dropdown indicators, and file-uploader drag zones.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Default Form Elements */}
            <RenderPanel isApple={false} title="Default Form Elements">
              {/* Text Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Full Name</label>
                <input 
                  type="text" 
                  placeholder="Enter your name"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:bg-white text-slate-800 text-sm rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-400 focus:ring-4 focus:ring-primary-500/10"
                />
              </div>

              {/* Select dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Target Level</label>
                <select 
                  value={selectVal} 
                  onChange={(e) => setSelectVal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 focus:border-primary-500 focus:bg-white text-slate-800 text-sm rounded-xl px-4 py-3 outline-none transition-all cursor-pointer"
                >
                  <option value="1">Bachelor's Degree Program</option>
                  <option value="2">Master's Degree Program</option>
                  <option value="3">Doctoral Degree Program</option>
                </select>
              </div>

              {/* Drag and Drop File Zone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Upload Academic Transcript</label>
                <div className="border-2 border-dashed border-primary-200 hover:border-primary-400 bg-primary-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all">
                  <UploadCloud className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-semibold">Drag and drop file here, or click to browse</p>
                  <span className="text-[10px] text-slate-400 block mt-1">Supports PDF, JPG, PNG up to 5MB</span>
                </div>
              </div>
            </RenderPanel>

            {/* Apple Form Elements */}
            <RenderPanel isApple={true} title="Apple Form Elements">
              {/* Text Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-800">Full Name</label>
                <input 
                  type="text" 
                  placeholder="Enter your name"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-800 text-sm rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-400 focus:ring-4 focus:ring-slate-900/5"
                />
              </div>

              {/* Select dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-800">Target Level</label>
                <select 
                  value={selectVal} 
                  onChange={(e) => setSelectVal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white text-slate-800 text-sm rounded-xl px-4 py-3 outline-none transition-all cursor-pointer"
                >
                  <option value="1">Bachelor's Degree Program</option>
                  <option value="2">Master's Degree Program</option>
                  <option value="3">Doctoral Degree Program</option>
                </select>
              </div>

              {/* Drag and Drop File Zone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-800">Upload Academic Transcript</label>
                <div className="border border-dashed border-slate-300 hover:border-slate-800 bg-slate-50 rounded-2xl p-6 text-center cursor-pointer transition-all">
                  <UploadCloud className="w-8 h-8 text-slate-750 mx-auto mb-2" />
                  <p className="text-xs text-slate-700 font-medium">Drag and drop file here, or click to browse</p>
                  <span className="text-[10px] text-slate-400 block mt-1">Supports PDF, JPG, PNG up to 5MB</span>
                </div>
              </div>
            </RenderPanel>
          </div>
        </section>

        {/* Section 5: Info Cards */}
        <section>
          <div className="border-l-4 border-primary-500 pl-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">5. Layout Cards & Content Blocks</h2>
            <p className="text-sm text-slate-500 mt-1">
              Verify glassmorphism effect, subtle border contrast, watermark placement, and hover transitions.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Default Cards */}
            <RenderPanel isApple={false} title="Default Layout Cards">
              {/* Partner Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center">
                    <Landmark className="w-6 h-6 text-primary-600" />
                  </div>
                  <span className="text-[10px] font-bold bg-primary-50 text-primary-700 uppercase px-2.5 py-1 rounded-full">
                    Top Tier University
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Tsinghua University</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  One of the most prestigious academic institutions in East Asia, providing world-class joint curriculum.
                </p>
                <div className="flex items-center justify-between text-xs font-bold text-primary-600 hover:text-primary-700 cursor-pointer">
                  <span>Explore Curriculum</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </RenderPanel>

            {/* Apple Cards */}
            <RenderPanel isApple={true} title="Apple Layout Cards">
              {/* Partner Card */}
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-[20px] border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Landmark className="w-6 h-6 text-slate-800" />
                  </div>
                  <span className="text-[10px] font-medium bg-slate-100 text-slate-800 uppercase px-2.5 py-1 rounded-full border border-slate-200">
                    Top Tier University
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-[#1d1d1f] mb-2">Tsinghua University</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  One of the most prestigious academic institutions in East Asia, providing world-class joint curriculum.
                </p>
                <div className="flex items-center justify-between text-xs font-medium text-[#0071e3] hover:text-[#0077ed] cursor-pointer">
                  <span>Explore Curriculum</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </RenderPanel>
          </div>
        </section>

      </div>

      {/* Style Guide Navigation Back Button */}
      <div className="mt-16 text-center border-t border-slate-200/50 pt-10">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold text-sm transition-colors"
        >
          <span>Back to Home Application</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
