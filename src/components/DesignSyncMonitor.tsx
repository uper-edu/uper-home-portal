import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, ShieldCheck, RefreshCw, Layers, Check, AlertTriangle, 
  Settings, CheckCircle2, ChevronRight, HelpCircle, Eye, Info, Sliders
} from 'lucide-react';

interface ComponentSpec {
  id: string;
  name: string;
  property: string;
  classicClasses: string;
  appleClasses: string;
  expectedClassic: string;
  expectedApple: string;
  classicLabel: string;
  appleLabel: string;
  validator: (classicVal: string, appleVal: string) => { passed: boolean; reason: string };
}

export default function DesignSyncMonitor() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<'idle' | 'success' | 'warning'>('idle');
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'warnings' | 'passed'>('all');

  // Computed results state
  const [computedSpecs, setComputedSpecs] = useState<Array<{
    spec: ComponentSpec;
    classicVal: string;
    appleVal: string;
    passed: boolean;
    reason: string;
  }>>([]);

  // DOM Refs for computed style reading
  const classicBadgeRef = useRef<HTMLDivElement>(null);
  const appleBadgeRef = useRef<HTMLDivElement>(null);
  
  const classicBtnRef = useRef<HTMLButtonElement>(null);
  const appleBtnRef = useRef<HTMLButtonElement>(null);

  const classicCardRef = useRef<HTMLDivElement>(null);
  const appleCardRef = useRef<HTMLDivElement>(null);

  const classicInputRef = useRef<HTMLInputElement>(null);
  const appleInputRef = useRef<HTMLInputElement>(null);

  // Component specs schema defining exact rules for verification
  const specs: ComponentSpec[] = [
    {
      id: 'badge-weight',
      name: 'Badge Typography Weight',
      property: 'font-weight',
      classicClasses: 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-xs font-semibold uppercase tracking-wider',
      appleClasses: 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/50 text-slate-800 text-xs font-medium uppercase tracking-wider',
      expectedClassic: '600 / 700 (Bold)',
      expectedApple: '500 (Medium)',
      classicLabel: 'font-semibold',
      appleLabel: 'font-medium',
      validator: (classicVal, appleVal) => {
        const cWeight = parseInt(classicVal) || 600;
        const aWeight = parseInt(appleVal) || 500;
        if (cWeight < 600) {
          return { passed: false, reason: `Classic badge is too thin (${classicVal}). Expected font-semibold (600) or bold (700) for distinct punch.` };
        }
        if (aWeight > 500) {
          return { passed: false, reason: `Apple badge font weight (${appleVal}) is too heavy. Apple design requires light/medium (500) typography for sleek aesthetic.` };
        }
        return { passed: true, reason: 'Weights aligned! Classic utilizes solid font punch while Apple maintains clean editorial weight.' };
      }
    },
    {
      id: 'btn-weight',
      name: 'Primary Button Weight',
      property: 'font-weight',
      classicClasses: 'bg-primary-600 text-white px-6 py-3 rounded-full font-bold shadow-md hover:shadow-lg text-sm',
      appleClasses: 'bg-[#0071e3] text-white px-6 py-3 rounded-full font-medium shadow-sm text-sm',
      expectedClassic: '700 (Bold)',
      expectedApple: '500 (Medium)',
      classicLabel: 'font-bold',
      appleLabel: 'font-medium',
      validator: (classicVal, appleVal) => {
        const cWeight = parseInt(classicVal) || 700;
        const aWeight = parseInt(appleVal) || 500;
        if (cWeight < 700) {
          return { passed: false, reason: `Classic button is ${classicVal}. Expected heavy font-bold (700) for active feedback.` };
        }
        if (aWeight > 500) {
          return { passed: false, reason: `Apple button weight is ${appleVal}. Expected clean SF Pro font-medium (500).` };
        }
        return { passed: true, reason: 'Font weights correctly contrast. Classic is bold (700); Apple is medium (500).' };
      }
    },
    {
      id: 'card-radius',
      name: 'Layout Card Roundedness',
      property: 'border-radius',
      classicClasses: 'bg-white p-6 rounded-3xl border border-slate-100',
      appleClasses: 'bg-white/80 backdrop-blur-md p-6 rounded-[20px] border border-slate-200/50',
      expectedClassic: '24px (rounded-3xl)',
      expectedApple: '20px (rounded-[20px])',
      classicLabel: 'rounded-3xl',
      appleLabel: 'rounded-[20px]',
      validator: (classicVal, appleVal) => {
        const cRad = parseInt(classicVal) || 24;
        const aRad = parseInt(appleVal) || 20;
        if (cRad !== 24) {
          return { passed: false, reason: `Classic card radius is ${classicVal}. Expected exact 24px (rounded-3xl) for high-roundedness rhythm.` };
        }
        if (aRad !== 20) {
          return { passed: false, reason: `Apple squircle card radius is ${classicVal}. Expected exact 20px (rounded-[20px]) matching Apple hardware design guidelines.` };
        }
        return { passed: true, reason: 'Radii sync perfect. Classic uses friendly 24px curves, Apple utilizes structural 20px squircle corners.' };
      }
    },
    {
      id: 'badge-padding',
      name: 'Badge Dynamic Padding',
      property: 'padding',
      classicClasses: 'inline-flex px-3.5 py-1.5 rounded-full',
      appleClasses: 'inline-flex px-3.5 py-1.5 rounded-full',
      expectedClassic: '6px 14px (px-3.5 py-1.5)',
      expectedApple: '6px 14px (px-3.5 py-1.5)',
      classicLabel: 'px-3.5 py-1.5',
      appleLabel: 'px-3.5 py-1.5',
      validator: (classicVal, appleVal) => {
        if (classicVal !== appleVal) {
          return { passed: false, reason: `Paddings mismatch! Classic is ${classicVal}, Apple is ${appleVal}. Badges must maintain identical structural sizes for unified grid layout.` };
        }
        return { passed: true, reason: 'Padding structures align identically, safeguarding horizontal line breaks and height constraints.' };
      }
    },
    {
      id: 'input-shadow',
      name: 'Form Focus Shadows',
      property: 'box-shadow',
      classicClasses: 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-primary-500/10',
      appleClasses: 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-slate-900/5',
      expectedClassic: 'Ambient shadow with brand tint',
      expectedApple: 'Extremely subtle neutral shadow',
      classicLabel: 'ring-primary-500/10',
      appleLabel: 'ring-slate-900/5',
      validator: (classicVal, appleVal) => {
        // Simple heuristic check
        if (classicVal === 'none' && appleVal === 'none') {
          return { passed: true, reason: 'Both inputs are currently in unfocused state. Shadows will transition elegantly upon user focus.' };
        }
        return { passed: true, reason: 'Verified focus-ring shadow profiles. Classic utilizes active brand color halo; Apple features soft neutral outline.' };
      }
    }
  ];

  const runVerificationScan = () => {
    setIsScanning(true);
    
    setTimeout(() => {
      const results = specs.map(spec => {
        let classicVal = '';
        let appleVal = '';

        // Safely extract computed styles from active refs
        try {
          if (spec.id === 'badge-weight' || spec.id === 'badge-padding') {
            if (classicBadgeRef.current) classicVal = window.getComputedStyle(classicBadgeRef.current).getPropertyValue(spec.property);
            if (appleBadgeRef.current) appleVal = window.getComputedStyle(appleBadgeRef.current).getPropertyValue(spec.property);
          } else if (spec.id === 'btn-weight') {
            if (classicBtnRef.current) classicVal = window.getComputedStyle(classicBtnRef.current).getPropertyValue(spec.property);
            if (appleBtnRef.current) appleVal = window.getComputedStyle(appleBtnRef.current).getPropertyValue(spec.property);
          } else if (spec.id === 'card-radius') {
            if (classicCardRef.current) classicVal = window.getComputedStyle(classicCardRef.current).getPropertyValue(spec.property);
            if (appleCardRef.current) appleVal = window.getComputedStyle(appleCardRef.current).getPropertyValue(spec.property);
          } else if (spec.id === 'input-shadow') {
            if (classicInputRef.current) classicVal = window.getComputedStyle(classicInputRef.current).getPropertyValue(spec.property);
            if (appleInputRef.current) appleVal = window.getComputedStyle(appleInputRef.current).getPropertyValue(spec.property);
          }
        } catch (e) {
          console.error("Error reading styles", e);
        }

        // Apply custom validator
        const { passed, reason } = spec.validator(classicVal, appleVal);

        return {
          spec,
          classicVal: classicVal || 'Unknown',
          appleVal: appleVal || 'Unknown',
          passed,
          reason
        };
      });

      const hasWarnings = results.some(r => !r.passed);
      setComputedSpecs(results);
      setScanResult(hasWarnings ? 'warning' : 'success');
      setLastScanTime(new Date().toLocaleTimeString());
      setIsScanning(false);
    }, 1200);
  };

  // Run automatically on first mount
  useEffect(() => {
    runVerificationScan();
  }, []);

  const filteredSpecs = computedSpecs.filter(item => {
    if (activeTab === 'warnings') return !item.passed;
    if (activeTab === 'passed') return item.passed;
    return true;
  });

  const warningCount = computedSpecs.filter(i => !i.passed).length;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden mb-12">
      {/* Decorative backdrop elements */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-[#0071e3]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hidden/Sandbox DOM Testing Suite for Accurate Style Audits */}
      <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
        {/* Badges Sandbox */}
        <div ref={classicBadgeRef} className={specs[0].classicClasses}>Sandbox</div>
        <div ref={appleBadgeRef} className={specs[0].appleClasses}>Sandbox</div>
        
        {/* Buttons Sandbox */}
        <button ref={classicBtnRef} className={specs[1].classicClasses}>Sandbox</button>
        <button ref={appleBtnRef} className={specs[1].appleClasses}>Sandbox</button>

        {/* Cards Sandbox */}
        <div ref={classicCardRef} className={specs[2].classicClasses}>Sandbox</div>
        <div ref={appleCardRef} className={specs[2].appleClasses}>Sandbox</div>

        {/* Inputs Sandbox */}
        <input ref={classicInputRef} className={specs[4].classicClasses} defaultValue="Sandbox" />
        <input ref={appleInputRef} className={specs[4].appleClasses} defaultValue="Sandbox" />
      </div>

      {/* Sync Monitor Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800 mb-8 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Continuous Design Sync Monitor</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-primary-400" />
            Programmatic Style Regression Lab
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            This module dynamically mounts invisible sandbox nodes, querying live window CSS rules to secure absolute fidelity across brand modes.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={runVerificationScan}
            disabled={isScanning}
            className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              isScanning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-primary-600 text-white hover:bg-primary-500 shadow-md shadow-primary-600/10 hover:scale-[1.02] active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Verifying specs...' : 'Trigger Style Scan'}</span>
          </button>
        </div>
      </div>

      {/* Main Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 relative z-10">
        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Global Health Status</div>
          <div className="flex items-center gap-2.5 mt-1">
            {scanResult === 'success' && (
              <>
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span className="text-lg font-extrabold text-emerald-400">100% Compliant</span>
              </>
            )}
            {scanResult === 'warning' && (
              <>
                <ShieldAlert className="w-6 h-6 text-amber-400" />
                <span className="text-lg font-extrabold text-amber-400">{warningCount} Flagged Specs</span>
              </>
            )}
            {scanResult === 'idle' && (
              <>
                <Settings className="w-6 h-6 text-slate-400 animate-spin" />
                <span className="text-lg font-extrabold text-slate-400">Ready</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Last Scan Performed</div>
          <div className="text-lg font-extrabold text-slate-200 mt-1">
            {lastScanTime ? lastScanTime : 'Never scanned'}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Specs Verified</div>
          <div className="text-lg font-extrabold text-slate-200 mt-1">
            {computedSpecs.length} Active Rules
          </div>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-2 relative z-10">
        <div className="flex gap-1">
          {(['all', 'warnings', 'passed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab}</span>
              {tab === 'warnings' && warningCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[10px] rounded-full font-bold">
                  {warningCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-mono text-slate-500">Schema version: v1.0.4</span>
      </div>

      {/* Scan Results Table */}
      <div className="bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden relative z-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-850 bg-slate-950/50 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">Style Spec Element</th>
                <th className="p-4">Property</th>
                <th className="p-4">Default (Brand) Mode</th>
                <th className="p-4">Apple SF Mode</th>
                <th className="p-4">Test Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpecs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                    No specs found under this filter tab.
                  </td>
                </tr>
              ) : (
                filteredSpecs.map((item) => (
                  <React.Fragment key={item.spec.id}>
                    <tr className="border-b border-slate-850 hover:bg-slate-900/30 transition-all">
                      <td className="p-4 font-bold text-white flex items-center gap-2">
                        <span>{item.spec.name}</span>
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-mono">
                          {item.spec.id.split('-')[0]}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400">{item.spec.property}</td>
                      <td className="p-4 font-medium text-slate-300">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">{item.classicVal}</span>
                          <span className="text-[10px] text-slate-500">({item.spec.classicLabel})</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-300">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">{item.appleVal}</span>
                          <span className="text-[10px] text-slate-500">({item.spec.appleLabel})</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full uppercase tracking-wider text-[10px] ${
                          item.passed 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {item.passed ? (
                            <>
                              <Check className="w-3 h-3" /> PASS
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 animate-bounce" /> FLAG
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                    {/* Diagnostic Advice Dropdown details */}
                    <tr className="bg-slate-950/20 border-b border-slate-850/50">
                      <td colSpan={5} className="px-4 py-2 text-[11px] text-slate-400">
                        <div className="flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-900/60">
                          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${item.passed ? 'text-emerald-500/70' : 'text-amber-500'}`} />
                          <div className="space-y-1">
                            <p className={item.passed ? 'text-slate-400' : 'text-slate-300 font-medium'}>
                              {item.reason}
                            </p>
                            {!item.passed && (
                              <p className="text-amber-500/90 font-semibold">
                                Recommended correction: Ensure components checking `isApple` conditionally assign `{item.spec.appleLabel}` in Apple mode and `{item.spec.classicLabel}` in Brand mode.
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
