import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headphones, 
  Volume2, 
  Clock, 
  CheckCircle2, 
  Award, 
  ArrowRight, 
  Zap, 
  FileText, 
  Check, 
  HelpCircle,
  RotateCcw,
  Upload,
  Music,
  AlertCircle,
  Sparkles,
  FileDown,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { 
  RealHskQuestion, 
  getExamQuestions, 
  evaluateOfficialHskScore 
} from '../data/hskQuizQuestions';
import { HskExamImage } from './HskExamVisuals';
import { HskPinyinText } from './HskPinyinText';
import { extractHskImagesFromPdf } from '../utils/pdfImageExtractor';

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface HSKPlacementAssessmentProps {
  onComplete: (result: {
    score: number;
    total: number;
    levelConfirmed: string;
    summary: string;
    breakdown?: {
      hsk1Correct: number;
      hsk1Total: number;
      hsk2Correct: number;
      hsk2Total: number;
      hsk3Correct: number;
      hsk3Total: number;
    };
  }) => void;
  onCancel?: () => void;
  studentName: string;
  lang?: 'en' | 'id' | 'zh';
}

function cleanPromptText(text?: string): string {
  if (!text) return '';
  return text.replace(/^\s*\d+[\.．\s]\s*/, '').trim();
}

function cleanPromptPinyin(pinyin?: string): string {
  if (!pinyin) return '';
  return pinyin.replace(/^\s*\d+[\.．\s]\s*/, '').trim();
}

export default function HSKPlacementAssessment({ 
  onComplete, 
  onCancel,
  studentName,
  lang = 'en'
}: HSKPlacementAssessmentProps) {
  // Mode selection: 'express' (10 questions, ~3 min) or 'full' (50 questions, ~20 min)
  const [examMode, setExamMode] = useState<'express' | 'full'>('express');
  const [selectedMode, setSelectedMode] = useState<'express' | 'full'>('express');
  const [hasStarted, setHasStarted] = useState(false);

  const [questionList, setQuestionList] = useState<RealHskQuestion[]>(() => getExamQuestions('express'));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Audio broadcast control states (Strict HSK Examination Standard)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);
  const [audioPhase, setAudioPhase] = useState<'idle' | 'play_1' | 'pause' | 'play_2' | 'finished'>('idle');
  const [countdown, setCountdown] = useState(15);
  const [sliceProgressSec, setSliceProgressSec] = useState<number>(0);
  const [sliceDurationSec, setSliceDurationSec] = useState<number>(0);

  // PDF Authentic Image Extraction States
  const [extractedImages, setExtractedImages] = useState<Record<string, string>>({});
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfExtractMsg, setPdfExtractMsg] = useState('');
  const [hasPdfImages, setHasPdfImages] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const ttsTimeoutRef = useRef<any>(null);
  const activeQuestionIdRef = useRef<number>(-1);
  const isAbortedRef = useRef<boolean>(false);

  const currentQ = questionList[currentIdx];
  const timerRef = useRef<any>(null);

  // Stop all active audio, timers, and voice synthesis immediately
  const stopAllAudio = () => {
    isAbortedRef.current = true;
    activeQuestionIdRef.current = -1;

    // Clear any cleanup callbacks registered on current audio element
    if (audioCleanupRef.current) {
      try {
        audioCleanupRef.current();
      } catch (e) {
        // ignore
      }
      audioCleanupRef.current = null;
    }

    // Clear speech timeout
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }

    // Clear exam countdown timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Cancel browser SpeechSynthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Stop and reset HTML5 audio element
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch (err) {
        // ignore
      }
    }

    // Reset playback states
    setIsPlayingAudio(false);
    setAudioAutoplayBlocked(false);
    setAudioPhase('idle');
    setSliceProgressSec(0);
  };

  // Probe server for extracted images on startup
  useEffect(() => {
    // 1. Check localStorage for previously extracted images
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hsk_extracted_images');
        if (stored) {
          const parsed = JSON.parse(stored);
          setExtractedImages(parsed);
          setHasPdfImages(true);
          (window as any).__HSK_EXTRACTED_IMAGES__ = parsed;
        }
      } catch (e) {
        // ignore
      }
    }

    // 2. Probe server for extracted images
    fetch('/api/hsk-images-status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.total > 0) {
          setHasPdfImages(true);
        }
      })
      .catch(() => {});
  }, []);

  // Handle user uploading official PDF file to extract genuine images
  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingPdf(true);
    setPdfExtractMsg(lang === 'en' ? 'Reading official PDF file...' : '正在解析官方试卷 PDF 文件...');

    try {
      const imgMap = await extractHskImagesFromPdf(file, (msg) => {
        setPdfExtractMsg(msg);
      });

      const count = Object.keys(imgMap).length;
      setExtractedImages(imgMap);
      setHasPdfImages(true);

      if (typeof window !== 'undefined') {
        (window as any).__HSK_EXTRACTED_IMAGES__ = imgMap;
        try {
          localStorage.setItem('hsk_extracted_images', JSON.stringify(imgMap));
        } catch (storageErr) {
          // ignore quota
        }
      }

      // Save to server
      fetch('/api/upload-hsk-extracted-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imgMap })
      }).catch(console.warn);
    } catch (err: any) {
      console.error('Failed to extract images from PDF:', err);
      alert(lang === 'en' ? `PDF image extraction failed: ${err.message}` : `PDF 试卷提取图片失败：${err.message}`);
    } finally {
      setIsExtractingPdf(false);
      setPdfExtractMsg('');
      e.target.value = '';
    }
  };

  // Finish broadcast sequence & start answer countdown
  const finishAudioBroadcast = () => {
    setIsPlayingAudio(false);
    setHasPlayedAudio(true);
    setAudioPhase('finished');

    // 15 seconds official countdown for student to select answer
    setCountdown(15);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Fallback to high-naturalness exam-cadence TTS (Dual Broadcast with 3.5s pause)
  const fallbackToTts = (targetQ?: RealHskQuestion) => {
    const q = targetQ || currentQ;
    if (!q || !q.spokenScript) {
      finishAudioBroadcast();
      return;
    }
    const thisQId = q.id;
    activeQuestionIdRef.current = thisQId;
    isAbortedRef.current = false;

    setIsPlayingAudio(true);
    setAudioPhase('play_1');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter1 = new SpeechSynthesisUtterance(q.spokenScript);
      utter1.lang = 'zh-CN';
      utter1.rate = 0.85;

      utter1.onend = () => {
        if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) return;
        setAudioPhase('pause');
        ttsTimeoutRef.current = setTimeout(() => {
          if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) return;
          setAudioPhase('play_2');
          const utter2 = new SpeechSynthesisUtterance(q.spokenScript!);
          utter2.lang = 'zh-CN';
          utter2.rate = 0.85;

          utter2.onend = () => {
            if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) return;
            finishAudioBroadcast();
          };
          window.speechSynthesis.speak(utter2);
        }, 3500);
      };

      window.speechSynthesis.speak(utter1);
    } else {
      ttsTimeoutRef.current = setTimeout(() => {
        if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) return;
        finishAudioBroadcast();
      }, 5000);
    }
  };

  // Strict HSK Authentic Listening Broadcast Engine (100% Dedicated Question MP3 with Dual Broadcast)
  const startStrictBroadcast = (targetQ?: RealHskQuestion, force: boolean = false) => {
    const q = targetQ || currentQ;
    if (!q) return;
    if (!force && (isPlayingAudio || hasPlayedAudio)) return;

    const thisQId = q.id;

    // 1. Immediately disconnect previous listeners and stop running audio
    if (audioCleanupRef.current) {
      try {
        audioCleanupRef.current();
      } catch (e) {}
      audioCleanupRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 2. Clear aborted flag and activate current question ID
    isAbortedRef.current = false;
    activeQuestionIdRef.current = thisQId;

    setIsPlayingAudio(true);
    setHasPlayedAudio(false);
    setAudioAutoplayBlocked(false);
    setAudioPhase('play_1');
    setSliceProgressSec(0);

    // 3. Play dedicated question audio (/audio/q{id}.mp3)
    const qAudioUrl = `/audio/q${thisQId}.mp3`;
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
    }
    const audio = audioElementRef.current;
    try {
      audio.pause();
    } catch (e) {}
    audio.src = qAudioUrl;
    audio.preload = 'auto';
    audio.load();
    audio.currentTime = 0;

    let hasCleanedUp = false;
    const cleanupListeners = () => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      if (audioCleanupRef.current === cleanupListeners) {
        audioCleanupRef.current = null;
      }
    };
    audioCleanupRef.current = cleanupListeners;

    const handleTimeUpdate = () => {
      // If question changed or session was cancelled, stop immediately
      if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) {
        audio.pause();
        cleanupListeners();
        return;
      }
      const cur = Math.round(audio.currentTime);
      setSliceProgressSec(cur);
      const totalDur = audio.duration;
      if (totalDur && !isNaN(totalDur) && totalDur > 0) {
        setSliceDurationSec(Math.round(totalDur));
        // Dual broadcast phase estimation based on progress
        const half = Math.max(1, (totalDur - 3.5) / 2);
        if (audio.currentTime < half) {
          setAudioPhase('play_1');
        } else if (audio.currentTime < half + 3.5) {
          setAudioPhase('pause');
        } else {
          setAudioPhase('play_2');
        }
      }
    };

    const handleEnded = () => {
      cleanupListeners();
      if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) return;
      finishAudioBroadcast();
    };

    const handleError = () => {
      cleanupListeners();
      if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) return;
      console.warn(`Dedicated audio for Q${thisQId} failed`);
      setIsPlayingAudio(false);
      setAudioAutoplayBlocked(true);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        cleanupListeners();
        if (isAbortedRef.current || activeQuestionIdRef.current !== thisQId) return;
        console.warn('Dedicated MP3 play() failed:', err);
        if (err.name === 'NotAllowedError') {
          // Browser autoplay policy blocked audio
          setIsPlayingAudio(false);
          setAudioAutoplayBlocked(true);
        } else {
          fallbackToTts(q);
        }
      });
    }
  };

  // Start assessment with selected mode
  const handleStartExam = () => {
    stopAllAudio();
    setExamMode(selectedMode);
    const list = getExamQuestions(selectedMode);
    setQuestionList(list);
    setCurrentIdx(0);
    setAnswers({});
    setSelectedOption(null);
    setHasStarted(true);

    const firstQ = list[0];
    if (firstQ && firstQ.section === 'listening') {
      // Inherit user click gesture directly for immediate, unblocked audio playback
      startStrictBroadcast(firstQ, true);
    }
  };

  // Reset audio state per question & automatically start audio playback for listening questions
  useEffect(() => {
    if (!hasStarted || !currentQ) return;

    // If already playing this question (e.g. started via user click in handleStartExam or handleNextQuestion), keep playing!
    if (activeQuestionIdRef.current === currentQ.id && isPlayingAudio) {
      return;
    }

    // Immediately cut off any previous audio and speech
    stopAllAudio();

    // Arm the active question id
    const thisQId = currentQ.id;
    activeQuestionIdRef.current = thisQId;
    isAbortedRef.current = false;

    setSelectedOption(answers[currentQ.id] || null);
    setHasPlayedAudio(false);
    setIsPlayingAudio(false);
    setCountdown(15);

    // If reading or writing question, start 30s timer
    if (currentQ.section !== 'listening') {
      setCountdown(30);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        stopAllAudio();
      };
    }

    // LISTENING QUESTION: Fallback timer to trigger broadcast if not already started
    const autoPlayTimer = setTimeout(() => {
      if (activeQuestionIdRef.current === thisQId && !isPlayingAudio && !hasPlayedAudio) {
        startStrictBroadcast(currentQ, true);
      }
    }, 250);

    return () => {
      clearTimeout(autoPlayTimer);
    };
  }, [currentIdx, hasStarted]);

  const handleSelectOption = (optionId: string) => {
    setSelectedOption(optionId);
  };

  const handleNextQuestion = () => {
    if (!selectedOption) return;

    // Immediately and unconditionally stop all audio from previous question!
    stopAllAudio();

    const newAnswers = { ...answers, [currentQ.id]: selectedOption };
    setAnswers(newAnswers);

    if (currentIdx < questionList.length - 1) {
      const nextIdx = currentIdx + 1;
      const nextQ = questionList[nextIdx];
      setCurrentIdx(nextIdx);
      if (nextQ && nextQ.section === 'listening') {
        // Direct click gesture start for next question!
        startStrictBroadcast(nextQ, true);
      }
    } else {
      // Completed all questions in the test! Evaluate with official standard
      const evalResult = evaluateOfficialHskScore(newAnswers, questionList);
      
      const summaryEn = `${evalResult.recommendationEn}

- **Recommended Track:** ${evalResult.targetTrack}
- **Accuracy Breakdown:** HSK 1 (${evalResult.hsk1Correct}/${evalResult.hsk1Total}), HSK 2 (${evalResult.hsk2Correct}/${evalResult.hsk2Total}), HSK 3 (${evalResult.hsk3Correct}/${evalResult.hsk3Total})`;

      const summaryZh = `${evalResult.recommendationZh}

- **推荐班级：** ${evalResult.targetTrack}
- **分级表现：** HSK 1级 (${evalResult.hsk1Correct}/${evalResult.hsk1Total} 题正确), HSK 2级 (${evalResult.hsk2Correct}/${evalResult.hsk2Total} 题正确), HSK 3级 (${evalResult.hsk3Correct}/${evalResult.hsk3Total} 题正确)`;

      onComplete({
        score: evalResult.totalScore,
        total: questionList.length * 2,
        levelConfirmed: evalResult.levelConfirmed,
        summary: lang === 'zh' ? summaryZh : summaryEn,
        breakdown: {
          hsk1Correct: evalResult.hsk1Correct,
          hsk1Total: evalResult.hsk1Total,
          hsk2Correct: evalResult.hsk2Correct,
          hsk2Total: evalResult.hsk2Total,
          hsk3Correct: evalResult.hsk3Correct,
          hsk3Total: evalResult.hsk3Total
        }
      });
    }
  };

  // Pre-test Mode Selection Screen
  if (!hasStarted) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden my-2 sm:my-4 max-w-xl mx-auto p-4 sm:p-6 space-y-4 font-sans">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-600 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-primary-600">
              UPER Official Placement System
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {lang === 'en' ? 'Select Your Assessment Mode' : lang === 'zh' ? '选择 HSK 等级摸底模式' : 'Pilih Mode Tes Penempatan HSK'}
            </h3>
          </div>
        </div>

        {/* Assessment Purpose Banner - Streamlined */}
        <div className="py-2 px-3 bg-slate-50/90 rounded-xl border border-slate-200/80 text-xs flex items-center gap-2">
          <span className="text-sm shrink-0">🎯</span>
          <p className="text-[11px] sm:text-xs text-slate-600 font-medium">
            {lang === 'en'
              ? 'Official HSK 1–3 benchmark: diagnose proficiency and unlock personalized scholarship pathways.'
              : '对标官方 HSK 1~3 级标准，快速测定中文水平，匹配定制化留学与奖学金方案。'}
          </p>
        </div>

        {/* Mode Comparison Cards */}
        <div className="grid grid-cols-1 gap-3 pt-0.5">
          {/* Mode 1: Express Mode */}
          <div
            onClick={() => setSelectedMode('express')}
            className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col gap-2 cursor-pointer ${
              selectedMode === 'express'
                ? 'border-primary-600 bg-primary-50/80 ring-2 ring-primary-500/30 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selectedMode === 'express' ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {selectedMode === 'express' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary-950">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  {lang === 'en' ? 'Express Assessment (10 Questions)' : '⚡ 极速摸底评估 (10 题 · 约 3 分钟)'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                {lang === 'en' ? 'Quick Benchmark' : '初评速测 · 展台推荐'}
              </span>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed pl-6 space-y-1">
              <p>
                <strong className="text-slate-700">{lang === 'en' ? 'Features: ' : '特点与内容：'}</strong>
                {lang === 'en'
                  ? 'Carefully sampled 10 gradient core questions across HSK 1–3 (picture matching, dialogue listening, core words). Quickly identifies baseline proficiency in 3 minutes without consuming excessive time.'
                  : '精选 10 道阶梯式核心真题（覆盖 HSK 1~3 级听力看图、对话理解、基础字词认读），3分钟迅速定位基础水平。'}
              </p>
              <p className="text-[11px] text-slate-500">
                <strong className="text-slate-600">{lang === 'en' ? 'Target: ' : '适合人群：'}</strong>
                {lang === 'en'
                  ? 'First-time learners, event visitors, or students with limited time wanting a rapid benchmark.'
                  : '初次摸底、展台参会、时间紧凑希望快速测定当前汉语基础水平的学员。'}
              </p>
            </div>
          </div>

          {/* Mode 2: Full 50-Question Official Diagnostic Exam */}
          <div
            onClick={() => setSelectedMode('full')}
            className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col gap-2 cursor-pointer ${
              selectedMode === 'full'
                ? 'border-primary-600 bg-primary-50/80 ring-2 ring-primary-500/30 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selectedMode === 'full' ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {selectedMode === 'full' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  {lang === 'en' ? 'Full Official Diagnostic (50 Questions)' : '📜 官方全真分级诊断 (50 题 · 约 20 分钟)'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                100 {lang === 'en' ? 'Points Total' : '分官方全真卷'}
              </span>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed pl-6 space-y-1">
              <p>
                <strong className="text-slate-700">{lang === 'en' ? 'Features: ' : '特点与内容：'}</strong>
                {lang === 'en'
                  ? '100% complete 12-page official exam paper (21 Listening, 21 Reading, 8 Writing). Strict score weighting providing in-depth diagnostic competence report.'
                  : '100% 完整真题试卷（21题听力 + 21题阅读 + 8题书写，满分100分），严格依据汉考国际考卷达标率与分值权重深度判定。'}
              </p>
              <p className="text-[11px] text-slate-500">
                <strong className="text-slate-600">{lang === 'en' ? 'Target: ' : '适合人群：'}</strong>
                {lang === 'en'
                  ? 'Students preparing for official exams, comprehensive gap identification, or seeking detailed multi-dimensional capability reports.'
                  : '备考冲刺、深度查漏补缺、需要详尽官方能力分级雷达报告的学员。'}
              </p>
            </div>
          </div>
        </div>

        {/* Audio Engine Status - Clean and Embedded */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/70 text-[11px] text-slate-600">
          <Volume2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
          <span className="font-medium text-slate-700">
            {lang === 'en' 
              ? 'Authentic Examination Audio: Embedded & Ready (Dual Broadcast with 3.5s pause)' 
              : '听力录音：官方考场原声已内嵌就绪（标准双播 · 停顿 3.5 秒）'}
          </span>
        </div>

        {/* Prominent Confirmation and Start Button */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleStartExam}
            className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-primary-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
          >
            <span>
              {selectedMode === 'express'
                ? (lang === 'en' ? 'Confirm & Start Express Assessment (10 Questions) →' : '确认并开始极速摸底评估 (10 题) →')
                : (lang === 'en' ? 'Confirm & Start Full Official Diagnostic (50 Questions) →' : '确认并开始官方全真分级诊断 (50 题) →')}
            </span>
          </button>

          {onCancel && (
            <div className="text-center">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium py-1"
              >
                {lang === 'en' ? 'Skip test & continue to direct consultation' : '跳过测评，直接向顾问咨询'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden my-1 sm:my-3 max-w-xl mx-auto font-sans flex flex-col">
      {/* Quiz Top Bar - Ultra Compact on Mobile */}
      <div className="bg-slate-900 text-white px-3.5 py-2 sm:px-5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-500/20 border border-primary-400/30 flex items-center justify-center text-primary-300 shrink-0">
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] sm:text-xs font-semibold text-primary-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>{examMode === 'express' ? 'Express' : 'Official Full'}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">{currentQ.level}</span>
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>
                {lang === 'en' && `Question ${currentIdx + 1} / ${questionList.length}`}
                {lang === 'id' && `Soal ${currentIdx + 1} / ${questionList.length}`}
                {lang === 'zh' && `第 ${currentIdx + 1} / ${questionList.length} 题`}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-primary-700/80 text-white">
                #{currentQ.id}
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-slate-800/90 rounded-full border border-slate-700 text-xs font-mono text-amber-300 shrink-0">
          <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>{countdown}s</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-1">
        <div 
          className="bg-primary-600 h-full transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questionList.length) * 100}%` }}
        />
      </div>

      {/* Real Exam Paper Layout Container - Compact Padding for Mobile */}
      <div className="p-3.5 sm:p-5 space-y-2.5 sm:space-y-4 bg-white flex-1">
        {/* PDF Section Header Banner with Compact Badges */}
        <div className="border-b border-slate-100 pb-2 sm:pb-2.5">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-primary-700 text-white font-extrabold text-xs sm:text-sm rounded-lg shadow-2xs tracking-tight font-mono">
                第 {currentQ.id} 题
              </span>
              <span className="text-xs font-bold text-slate-700 font-serif tracking-wide truncate max-w-[200px] sm:max-w-xs">
                {currentQ.pageHeader.replace(/[★*]+/g, '').replace(/\n/g, ' · ').replace(/\s+/g, ' ').trim()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {currentQ.section === 'listening' ? '🎧 听力' : currentQ.section === 'reading' ? '📖 阅读' : '✍️ 书写'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {currentQ.level}
              </span>
            </div>
          </div>
        </div>

          {/* Word Bank Table (For Page 8 & 9) */}
          {currentQ.wordBank && (
            <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-300">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-xs">
                {currentQ.wordBank.map((item) => (
                  <div key={item.id} className="p-1 bg-white rounded border border-slate-200">
                    <div className="text-[9px] font-mono text-slate-500">{item.pinyin}</div>
                    <div className="font-bold text-slate-800 text-[11px]">{item.id}. {item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Listening Broadcast Controller: Unified Single-Line Progress & Status */}
        {currentQ.section === 'listening' && (
          <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
            audioAutoplayBlocked && !isPlayingAudio
              ? 'bg-amber-50/95 border border-amber-300 text-amber-900 shadow-2xs'
              : hasPlayedAudio || audioPhase === 'finished'
              ? 'bg-emerald-50/90 border border-emerald-200 text-emerald-800'
              : 'bg-indigo-50/90 border border-indigo-200/80 text-indigo-900'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              {isPlayingAudio ? (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="w-1 h-3 bg-indigo-600 animate-pulse rounded-full" />
                  <span className="w-1 h-4 bg-indigo-500 animate-pulse rounded-full" />
                  <span className="w-1 h-2 bg-indigo-400 animate-pulse rounded-full" />
                </div>
              ) : (hasPlayedAudio || audioPhase === 'finished') ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              ) : audioAutoplayBlocked ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-600 animate-bounce flex-shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              )}

              <span className="font-semibold truncate text-[11px] sm:text-xs">
                {audioAutoplayBlocked && !isPlayingAudio ? (
                  lang === 'en' ? 'Audio ready · Click Play below' : '录音已就绪 · 点击右侧播放'
                ) : audioPhase === 'play_1' ? (
                  lang === 'en' ? 'Broadcast 1 playing...' : '第 1 遍播放中...'
                ) : audioPhase === 'pause' ? (
                  lang === 'en' ? 'Interval pause (3.5s)...' : '停顿 3.5 秒...'
                ) : audioPhase === 'play_2' ? (
                  lang === 'en' ? 'Broadcast 2 playing...' : '第 2 遍播放中...'
                ) : (hasPlayedAudio || audioPhase === 'finished') ? (
                  lang === 'en' ? 'Audio completed · Please choose an answer' : '播音完毕 · 请选择答案'
                ) : (
                  lang === 'en' ? 'Preparing audio...' : '准备播音中...'
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[11px] font-bold">
              {isPlayingAudio && sliceDurationSec > 0 && (
                <span className="text-indigo-600">
                  {sliceProgressSec}s / {sliceDurationSec}s
                </span>
              )}
              {(hasPlayedAudio || audioPhase === 'finished') && (
                <span className="text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-full flex items-center gap-1 text-[10px]">
                  <Clock className="w-2.5 h-2.5" />
                  {countdown}s
                </span>
              )}
              <button
                type="button"
                onClick={() => startStrictBroadcast(currentQ, true)}
                className={`px-2.5 py-1 rounded-lg border shadow-2xs font-sans text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  audioAutoplayBlocked && !isPlayingAudio
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300 animate-pulse'
                    : 'bg-white/90 hover:bg-white text-indigo-700 hover:text-indigo-900 border-indigo-200/90'
                }`}
                title={lang === 'en' ? 'Play / Replay Audio' : '播放 / 重听录音'}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>
                  {audioAutoplayBlocked && !isPlayingAudio
                    ? (lang === 'en' ? 'Play Audio' : '播放录音')
                    : (lang === 'en' ? 'Replay' : '重听')}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Question Prompt (ONLY for reading / writing, NEVER for listening where question is spoken) */}
        {currentQ.section !== 'listening' && (currentQ.promptText || currentQ.promptPinyin) && (
          <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 flex items-start gap-2.5">
            <span className="px-2 py-0.5 bg-white border border-slate-300 text-primary-800 font-extrabold text-xs rounded-md shadow-2xs shrink-0 mt-0.5 font-mono">
              {currentQ.id}.
            </span>
            <div className="flex-1 min-w-0">
              <HskPinyinText
                pinyinStr={cleanPromptPinyin(currentQ.promptPinyin)}
                hanziStr={cleanPromptText(currentQ.promptText)}
                size="base"
              />
            </div>
          </div>
        )}

        {/* OPTIONS DISPLAY (Replicating PDF Styles) */}

        {/* 1. Image Selection Grid (Page 2, 4, 7) - Authentic PDF Image Crops */}
        {currentQ.format === 'image_select' && (
          <div className={`grid grid-cols-3 ${currentQ.options.length > 3 ? 'gap-1.5 sm:gap-2.5' : 'gap-2 sm:gap-3'}`}>
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              const isCompact = currentQ.options.length > 3;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`p-1 sm:p-1.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50/90 ring-2 ring-primary-500/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <HskExamImage 
                    id={opt.imageKey || ''} 
                    customSrc={extractedImages[opt.imageKey || '']}
                    className={`w-full ${isCompact ? 'h-13 sm:h-18' : 'h-18 sm:h-24'}`} 
                  />
                  <div className="flex items-center justify-center gap-1 font-bold text-xs sm:text-sm">
                    <span className={`${isSelected ? 'text-primary-800' : 'text-slate-800'}`}>
                      {opt.id}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary-600 font-extrabold" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Pinyin + Hanzi Options (Page 3 & 5) - Word Segmented Centered Pinyin */}
        {currentQ.format === 'pinyin_options' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2.5">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex items-center justify-center cursor-pointer min-h-[48px] sm:min-h-[58px] ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50/90 ring-2 ring-primary-500/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400 font-mono">{opt.id}.</span>
                    <HskPinyinText 
                      pinyinStr={opt.pinyin} 
                      hanziStr={opt.text} 
                      size="sm" 
                    />
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-600 inline ml-1 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Pure Hanzi, NO PINYIN (Page 6, 9, 10 - Standard HSK 3) */}
        {(currentQ.format === 'pure_hanzi' || currentQ.format === 'passage_comprehension') && (
          <div className="space-y-1.5 sm:space-y-2">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`w-full p-2.5 sm:p-3 text-left rounded-xl border text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer font-serif ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50/90 text-primary-950 font-bold ring-2 ring-primary-500/30 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span>{opt.text?.startsWith(opt.id) ? opt.text : `${opt.id}. ${opt.text}`}</span>
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-[10px] sm:text-xs shrink-0 ${
                    isSelected 
                      ? 'border-primary-600 bg-primary-600 text-white' 
                      : 'border-slate-300 text-transparent'
                  }`}>
                    ✓
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 4. Sentence Match (Page 8) */}
        {currentQ.format === 'sentence_match' && (
          <div className="space-y-1.5 sm:space-y-2">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`w-full p-2.5 sm:p-3 text-left rounded-xl border text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50/90 text-primary-950 font-bold ring-2 ring-primary-500/30 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    {opt.pinyin && <div className="text-[10px] font-mono text-slate-400 mb-0.5">{opt.pinyin}</div>}
                    <div className="font-serif font-medium">{opt.text}</div>
                  </div>
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border shrink-0 flex items-center justify-center text-[10px] sm:text-xs ${
                    isSelected 
                      ? 'border-primary-600 bg-primary-600 text-white' 
                      : 'border-slate-300 text-transparent'
                  }`}>
                    ✓
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 5. Word Bank Fill-in Options (Page 8 & 9) */}
        {currentQ.format === 'word_bank' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {(currentQ.wordBank || currentQ.options).map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50/90 ring-2 ring-primary-500/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt.pinyin && (
                    <div className="text-[10px] font-mono text-slate-400 mb-0.5">{opt.pinyin}</div>
                  )}
                  <div className="text-xs sm:text-sm font-bold text-slate-900 font-serif flex items-center gap-1">
                    <span>{opt.text === opt.id ? opt.id : `${opt.id}. ${opt.text}`}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-600 inline" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 6. Writing Character Selection (Page 11) */}
        {currentQ.format === 'writing_pinyin' && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  className={`p-3 sm:p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer min-h-[65px] sm:min-h-[80px] ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50/90 ring-2 ring-primary-500/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt.pinyin && (
                    <div className="text-xs font-mono text-slate-400 mb-0.5">{opt.pinyin}</div>
                  )}
                  <div className="text-lg sm:text-xl font-extrabold text-slate-900 font-serif flex items-center gap-1.5">
                    <span>{opt.id}. {opt.text}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-600 inline" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Floating Bottom Actions Toolbar */}
      <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-3.5 py-2.5 sm:px-6 sm:py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center justify-between gap-2.5">
        {onCancel && (
          <button
            type="button"
            onClick={() => {
              stopAllAudio();
              onCancel();
            }}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium px-2 py-1.5 cursor-pointer shrink-0"
          >
            {lang === 'en' ? 'Exit' : '退出测评'}
          </button>
        )}

        <button
          type="button"
          disabled={!selectedOption}
          onClick={handleNextQuestion}
          className={`ml-auto px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer ${
            selectedOption
              ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/25 active:scale-[0.99]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>
            {currentIdx < questionList.length - 1 
              ? (lang === 'en' ? 'Next Question' : '下一题') 
              : (lang === 'en' ? 'Submit & Generate Diagnostic Report' : '提交并生成官方分级报告')}
          </span>
          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}
