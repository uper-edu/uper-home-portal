import {visitorScope, assertVisitorScope} from '../services/visitorScope';
import React, { useEffect, useRef, useState } from "react";
import {
  getVersionQuestions,
  displayVersionOptions,
  requireHskVersion,
  HSK_EXAM_VERSION,
  HSK_SCORING_VERSION,
} from "../data/hskAssessmentVersions";
import {
  chooseText,
  gradeHskAttempt,
  newHskAttempt,
  stripSourceLabel,
  type HskAttempt,
  type HskResult,
  type HskMode,
  type HskLanguage,
} from "../data/hskAssessment";
import {
  readHskDraft,
  writeHskDraft,
  clearHskDraft,
  writeHskResult,
  readHskHistoryState,
} from "../services/hskAttemptStorage";
import { saveHskAttempt, restoreHskHistory } from "../services/portalChat";
import { HskPlayback, type PlaybackStatus } from "../services/hskPlayback";
import { HskExamImage } from "./HskExamVisuals";
import { HskPinyinText } from "./HskPinyinText";
import { HskQuestionPrompt } from "./HskQuestionPrompt";
import HskAssessmentReport from "./HskAssessmentReport";
import { hskInstruction } from "../data/hskInstructions";
interface Props {
  onComplete: (result: HskResult) => void;
  onCancel?: () => void;
  studentName: string;
  lang?: HskLanguage;
}
export default function HSKPlacementAssessment({
  onComplete,
  onCancel,
  lang = "en",
}: Props) {
  const t = (zh: string, en: string, id: string) =>
    chooseText(lang, zh, en, id);
  const [ownerScope] = useState(visitorScope);
  const [draft] = useState(readHskDraft);
  const continuing =
    !!draft &&
    !!requireHskVersion(draft.attempt.examVersion, draft.attempt.scoringVersion)
      .administration;
  const [mode, setMode] = useState<HskMode>(
    continuing ? draft!.attempt.mode : "full",
  );
  const [attempt, setAttempt] = useState<HskAttempt | null>(null);
  const [index, setIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [optionsNeedScroll, setOptionsNeedScroll] = useState(false);
  const pictureGrid = useRef<HTMLDivElement | null>(null),
    answerNav = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("loading");
  const [pending, setPending] = useState<HskResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [storageOK, setStorageOK] = useState(true);
  const [history, setHistory] = useState(() => readHskHistoryState(lang));
  const [historical, setHistorical] = useState<HskResult | null>(null);
  const media = useRef<HTMLAudioElement | null>(null),
    player = useRef<HskPlayback | null>(null);
  const key = useRef("");
  const pausedRef = useRef(false),
    mounted = useRef(true),
    savingRef = useRef(false);
  const leaveRef = useRef<
    (key: string, reason: "next" | "skip" | "timeout") => void
  >(() => {});
  const questionRef = useRef<HTMLHeadingElement>(null);
  const questions = attempt
    ? getVersionQuestions(
        attempt.mode,
        attempt.examVersion,
        attempt.scoringVersion,
      )
    : getVersionQuestions(mode);
  const q = questions[index] || questions[0];
  const version = requireHskVersion(
    attempt?.examVersion || HSK_EXAM_VERSION,
    attempt?.scoringVersion || HSK_SCORING_VERSION,
  );
  const asset = version.audioAssets[String(q.id)];
  const selected = attempt?.answers[q.id];
  useEffect(() => {
    const grid = pictureGrid.current,
      nav = answerNav.current;
    if (!attempt || complete || q.format !== "image_select" || !grid || !nav) {
      setOptionsNeedScroll(false);
      return;
    }
    const main = grid.closest("main");
    const check = () => {
      const bottom = grid.getBoundingClientRect().bottom;
      const limit = Math.min(
        nav.getBoundingClientRect().top,
        main?.getBoundingClientRect().bottom || window.innerHeight,
      );
      setOptionsNeedScroll(bottom > limit + 1);
    };
    const observer = typeof ResizeObserver==='undefined' ? undefined : new ResizeObserver(check);
    observer?.observe(grid);
    observer?.observe(nav);
    window.addEventListener("resize", check);
    main?.addEventListener("scroll", check);
    check();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", check);
      main?.removeEventListener("scroll", check);
    };
  }, [attempt?.attemptId, index, complete, paused]);
  const button =
    "min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary-600 disabled:opacity-50";
  useEffect(() => {
    mounted.current = true;
    media.current = new Audio();
    return () => {
      mounted.current = false;
      player.current?.stop();
    };
  }, []);
  useEffect(() => {
    let active = true;
    restoreHskHistory(lang)
      .then((h) => {
        if (active) setHistory(h);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lang]);
  const activate = (a: HskAttempt, i: number, position = 0, auto = true) => {
    const item = getVersionQuestions(a.mode, a.examVersion, a.scoringVersion)[
      i
    ];
    const runKey = a.attemptId + ":" + i;
    key.current = runKey;
    player.current?.stop();
    setAudioTime(position);
    setPaused(!auto);
    pausedRef.current = !auto;
    if (item.section !== "listening" || !media.current) return;
    const audio = requireHskVersion(a.examVersion, a.scoringVersion)
      .audioAssets[String(item.id)];
    player.current = new HskPlayback(media.current, {
      status: (s) => {
        if (mounted.current && key.current === runKey) setStatus(s);
      },
      time: (s) => {
        if (mounted.current && key.current === runKey) setAudioTime(s);
      },
      started: () => {
        if (key.current === runKey)
          setAttempt((prev) =>
            prev
              ? {
                  ...prev,
                  plays: {
                    ...prev.plays,
                    [item.id]: Math.max(1, prev.plays[item.id] || 0),
                  },
                }
              : prev,
          );
      },
      ended: () => leaveRef.current(runKey, "timeout"),
      failed: () => {
        if (key.current === runKey)
          setAttempt((prev) =>
            prev
              ? {
                  ...prev,
                  audioFailures: [...new Set([...prev.audioFailures, item.id])],
                }
              : prev,
          );
      },
    });
    player.current.load(audio.src, Math.min(position, audio.durationSec), auto);
  };
  leaveRef.current = (runKey, reason) => {
    if (!attempt || complete || pausedRef.current || key.current !== runKey)
      return;
    const seconds = Math.min(
      asset?.durationSec || 0,
      player.current?.position || 0,
    );
    key.current = "";
    player.current?.stop();
    setAttempt((prev) =>
      prev
        ? {
            ...prev,
            answers:
              reason === "skip"
                ? { ...prev.answers, [q.id]: null }
                : prev.answers,
            navigation: { ...prev.navigation, [q.id]: reason },
            audioPositions:
              q.section === "listening"
                ? { ...prev.audioPositions, [q.id]: seconds }
                : prev.audioPositions,
          }
        : prev,
    );
    if (index === questions.length - 1) setComplete(true);
    else setIndex((i) => i + 1);
  };
  useEffect(() => {
    if (!attempt || complete) return;
    const nextKey = attempt.attemptId + ":" + index;
    if (key.current !== nextKey) activate(attempt, index);
    questionRef.current?.focus();
  }, [attempt?.attemptId, index, complete]);
  useEffect(() => {
    if (!attempt || pending) return;
    if (visitorScope() !== ownerScope) return;
    setStorageOK(
      writeHskDraft({
        attempt,
        currentIdx: index,
        reviewing: complete,
        audioPositionSec: audioTime,
        paused,
      }),
    );
  }, [attempt, index, complete, audioTime, paused, pending]);
  useEffect(() => {
    if (!attempt || complete || paused) return;
    const tick = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        (q.section !== "listening" || status === "playing")
      )
        setAttempt((prev) =>
          prev
            ? {
                ...prev,
                activeSeconds: {
                  ...prev.activeSeconds,
                  [q.id]: Math.min(86400, (prev.activeSeconds[q.id] || 0) + 1),
                },
              }
            : prev,
        );
    }, 1000);
    return () => clearInterval(tick);
  }, [attempt?.attemptId, index, complete, paused, status]);
  const pause = () => {
    if (pausedRef.current || !attempt || complete) return;
    pausedRef.current = true;
    setPaused(true);
    player.current?.pause();
    setAttempt((prev) =>
      prev ? { ...prev, pauseCount: (prev.pauseCount || 0) + 1 } : prev,
    );
  };
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [attempt?.attemptId, complete]);
  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    if (q.section === "listening") player.current?.resume();
  };
  const start = (restore = false) => {
    const old = restore && continuing ? draft : null;
    const a = old ? old.attempt : newHskAttempt(mode, crypto.randomUUID());
    const i = old ? old.currentIdx : 0;
    setAttempt(a);
    setIndex(i);
    setComplete(old?.reviewing || false);
    setPending(null);
    if (!old?.reviewing) activate(a, i, old?.audioPositionSec || 0, true);
  };
  const submit = async () => {
    if (!attempt || savingRef.current) return;
    try { assertVisitorScope(ownerScope); } catch { setSaveError(true); return; }
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    player.current?.stop();
    const local =
      pending ||
      gradeHskAttempt(
        { ...attempt, completedAt: new Date().toISOString() },
        lang,
      );
    setPending(local);
    writeHskResult(local);
    try {
      const saved = await saveHskAttempt(local.attempt, lang, ownerScope);
      writeHskResult(saved);
      clearHskDraft();
      if (mounted.current) onComplete(saved);
    } catch {
      if (mounted.current) setSaveError(true);
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  if (historical)
    return (
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-4 space-y-4">
        <HskAssessmentReport result={historical} lang={lang} />
        <button className={button} onClick={() => onComplete(historical)}>
          {t("进入咨询", "Continue to consultation", "Lanjut ke konsultasi")}
        </button>
      </section>
    );
  if (!attempt)
    return (
      <section
        aria-label={t("选择测评模式", "Choose assessment", "Pilih tes")}
        className="mx-auto max-w-3xl rounded-2xl bg-white p-4 sm:p-6 space-y-4"
      >
        <h2 className="text-xl font-bold">
          {t("中文分班测评", "Mandarin assessment", "Tes bahasa Mandarin")}
        </h2>
        <fieldset className="space-y-2">
          <legend className="sr-only">
            {t("选择模式", "Choose mode", "Pilih mode")}
          </legend>
          {(continuing
            ? [draft!.attempt.mode]
            : (["full", "express"] as HskMode[])
          ).map((m) => (
            <label
              key={m}
              className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${mode === m ? "border-primary-600 bg-primary-50" : "border-slate-300"}`}
            >
              {!continuing && (
                <input
                  type="radio"
                  name="hsk-mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="mt-1"
                />
              )}
              <span>
                <strong>
                  {m === "express"
                    ? t(
                        `快速测评 · ${continuing ? getVersionQuestions("express", draft!.attempt.examVersion, draft!.attempt.scoringVersion).length : 15}题`,
                        `Quick assessment · ${continuing ? getVersionQuestions("express", draft!.attempt.examVersion, draft!.attempt.scoringVersion).length : 15} items`,
                        `Tes singkat · ${continuing ? getVersionQuestions("express", draft!.attempt.examVersion, draft!.attempt.scoringVersion).length : 15} soal`,
                      )
                    : t(
                        "完整测评 · 50题",
                        "Full assessment · 50 items",
                        "Tes lengkap · 50 soal",
                      )}
                </strong>
                <span className="block text-sm text-slate-600">
                  {m === "express"
                    ? t(
                        continuing &&
                          !requireHskVersion(
                            draft!.attempt.examVersion,
                            draft!.attempt.scoringVersion,
                          ).screeningPolicy
                          ? "约5–8分钟 · 听力与阅读"
                          : "约6–10分钟 · 听力、阅读与识字",
                        continuing &&
                          !requireHskVersion(
                            draft!.attempt.examVersion,
                            draft!.attempt.scoringVersion,
                          ).screeningPolicy
                          ? "About 5–8 minutes · listening and reading"
                          : "About 6–10 minutes · listening, reading and characters",
                        continuing &&
                          !requireHskVersion(
                            draft!.attempt.examVersion,
                            draft!.attempt.scoringVersion,
                          ).screeningPolicy
                          ? "Sekitar 5–8 menit · menyimak dan membaca"
                          : "Sekitar 6–10 menit · menyimak, membaca dan karakter",
                      )
                    : t(
                        "约25–35分钟 · 听力、阅读与识字",
                        "About 25–35 minutes · listening, reading and characters",
                        "Sekitar 25–35 menit · menyimak, membaca dan karakter",
                      )}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <ul className="list-disc pl-5 text-sm space-y-2">
          <li>
            {t(
              "请开启声音。开始后，听力每题播放两遍，包含作答停顿；结束后自动进入下一题。",
              "Turn sound on. After you start, each listening item plays twice with an answer pause, then advances automatically.",
              "Aktifkan suara. Setelah mulai, setiap soal audio diputar dua kali dengan jeda menjawab, lalu lanjut otomatis.",
            )}
          </li>
          <li>
            {t(
              "可提前下一题或跳过；离题后不能返回修改。",
              "You may advance or skip early; answers lock when you leave an item.",
              "Boleh lanjut atau lewati lebih awal; jawaban terkunci setelah meninggalkan soal.",
            )}
          </li>
          <li>
            {t(
              "阅读与识字题不设逐题时限，未答计0分。",
              "Reading and character items have no item timer; blanks score zero.",
              "Soal membaca dan karakter tanpa batas per soal; kosong bernilai nol.",
            )}
          </li>
        </ul>
        <p className="text-xs text-slate-500">
          {t(
            "预计耗时为初始估算；结果用于学习与分班参考。",
            "Time is an initial estimate; results guide learning and placement.",
            "Waktu merupakan perkiraan awal; hasil untuk panduan belajar dan penempatan.",
          )}
        </p>
        {continuing ? (
          <button
            className={button + " bg-primary-700 text-white"}
            onClick={() => start(true)}
          >
            {t(
              "继续未完成测评",
              "Continue unfinished assessment",
              "Lanjutkan tes sebelumnya",
            )}
          </button>
        ) : (
          <button
            className={button + " bg-primary-700 text-white"}
            onClick={() => start()}
          >
            {t("开始测评", "Start assessment", "Mulai tes")}
          </button>
        )}
        {onCancel && (
          <button className={button} onClick={onCancel}>
            {continuing?t("暂停测评，进入AI咨询","Pause assessment & start AI consultation","Jeda tes & mulai konsultasi AI"):t("跳过测评，进入AI咨询","Skip assessment & start AI consultation","Lewati tes & mulai konsultasi AI")}
          </button>
        )}
        {!!history.results.length && (
          <details className="text-sm">
            <summary className="cursor-pointer min-h-11">
              {t("历史结果", "Past results", "Hasil sebelumnya")}
            </summary>
            <div className="space-y-2">
              {history.results.map((r) => (
                <button
                  key={r.attempt.attemptId}
                  className={button + " block w-full text-left"}
                  onClick={() => setHistorical(r)}
                >
                  {r.correctCount}/{r.questionCount} ·{" "}
                  {new Date(r.attempt.completedAt!).toLocaleDateString(
                    lang === "zh" ? "zh-CN" : lang === "id" ? "id-ID" : "en-US",
                  )}
                </button>
              ))}
            </div>
          </details>
        )}
        {!!history.problems.length && (
          <details className="text-sm">
            <summary className="cursor-pointer min-h-11">
              {t(
                "历史记录待核对",
                "Historical records need review",
                "Catatan lama perlu ditinjau",
              )}{" "}
              ({history.problems.length})
            </summary>
            <p>
              {t(
                "异常记录已隔离保留，不影响本次测评。",
                "Unavailable records are retained separately and do not affect this assessment.",
                "Catatan bermasalah tetap disimpan terpisah dan tidak memengaruhi tes.",
              )}
            </p>
          </details>
        )}
      </section>
    );
  if (complete)
    return (
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-4 space-y-4">
        <h2>{t("测评已完成", "Assessment complete", "Tes selesai")}</h2>
        <p>
          {t("已作答", "Answered", "Dijawab")}{" "}
          {Object.values(attempt.answers).filter((v) => v !== null).length} ·{" "}
          {t("未作答", "Unanswered", "Belum dijawab")}{" "}
          {questions.length -
            Object.values(attempt.answers).filter((v) => v !== null).length}
        </p>
        <p className="text-sm text-slate-600">
          {t(
            "未作答题计0分。",
            "Unanswered items score zero.",
            "Soal belum dijawab bernilai nol.",
          )}
        </p>
        <button
          disabled={saving}
          className={button + " bg-primary-700 text-white"}
          onClick={() => void submit()}
        >
          {saving
            ? t("正在提交…", "Submitting…", "Mengirim…")
            : saveError
              ? t("重试提交", "Retry submission", "Coba kirim lagi")
              : t(
                  "提交并进入咨询",
                  "Submit and continue to consultation",
                  "Kirim dan lanjut ke konsultasi",
                )}
        </button>
        {saveError && (
          <p role="alert">
            {t(
              "结果暂存，服务端保存未完成，请重试。",
              "Results are stored locally; server saving failed. Please retry.",
              "Hasil tersimpan lokal; penyimpanan server gagal. Coba lagi.",
            )}
          </p>
        )}
      </section>
    );
  const remaining = Math.max(
    0,
    Math.ceil((asset?.durationSec || 0) - audioTime),
  );
  const pictureChoices = q.format === "image_select";
  return (
    <section
      className={`mx-auto max-w-3xl rounded-2xl bg-white ${pictureChoices ? `hsk-picture-question p-3 sm:p-6 ${q.section==='reading'?'space-y-1.5':'space-y-2'}` : "p-4 sm:p-6 space-y-4"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 ref={questionRef} tabIndex={-1} className="font-bold">
          {t("第", "Item", "Soal")} {index + 1}/{questions.length} ·{" "}
          {q.section === "listening"
            ? t("听力", "Listening", "Menyimak")
            : q.section === "reading"
              ? t("阅读", "Reading", "Membaca")
              : t("识字选择", "Characters", "Karakter")}
        </h2>
        <button
          className="min-h-11 text-sm underline"
          onClick={paused ? resume : pause}
        >
          {paused
            ? t("继续测评", "Continue assessment", "Lanjutkan tes")
            : t("暂停测评", "Pause assessment", "Jeda tes")}
        </button>
      </div>
      <progress
        className="block w-full h-1 accent-primary-600"
        aria-label={t("测评进度", "Assessment progress", "Kemajuan tes")}
        value={index}
        max={questions.length}
      />
      {q.section === "listening" ? (
        <div
          className={`rounded-xl bg-slate-50 ${pictureChoices ? "p-2 space-y-1" : "p-3 space-y-2"}`}
        >
          <div role="status" className="flex justify-between text-sm">
            <span>
              {paused
                ? t("已暂停", "Paused", "Dijeda")
                : status === "loading"
                  ? t("正在加载录音…", "Loading audio…", "Memuat audio…")
                  : status === "blocked"
                    ? t(
                        "点击继续以播放录音",
                        "Tap continue to enable audio",
                        "Ketuk lanjut untuk memutar audio",
                      )
                    : status === "error"
                      ? t(
                          "录音加载失败",
                          "Audio unavailable",
                          "Audio tidak tersedia",
                        )
                      : audioTime >=
                          (asset.answerPauseStartSec ?? asset.durationSec)
                        ? t("作答时间", "Answer time", "Waktu menjawab")
                        : t("录音播放中", "Audio playing", "Audio diputar")}
            </span>
            <span>
              {t("剩余", "Remaining", "Sisa")} {remaining}
              {t("秒", "s", "d")}
            </span>
          </div>
          <progress
            className={`${pictureChoices?'block h-1.5':''} w-full accent-primary-600`}
            aria-label={t(
              "听力作答时间",
              "Listening answer window",
              "Waktu menjawab audio",
            )}
            value={audioTime}
            max={asset.durationSec}
          />
          {!paused && (status === "blocked" || status === "error") && (
            <button
              className={button}
              onClick={() =>
                status === "error"
                  ? player.current?.retry()
                  : player.current?.resume()
              }
            >
              {status === "error"
                ? t("重试加载", "Retry audio", "Coba muat audio")
                : t("继续播放", "Continue audio", "Lanjutkan audio")}
            </button>
          )}
        </div>
      ) : (
        <>
          <p
            className={`${pictureChoices ? "text-xs" : "text-sm"} text-slate-600`}
          >
            {pictureChoices ? t('选对应图片，每题独立。','Choose the matching picture. Each item is independent.','Pilih gambar yang cocok. Setiap soal berdiri sendiri.') : hskInstruction(q, lang)}
          </p>
          <HskQuestionPrompt question={q} lang={lang} compact={pictureChoices}/>
        </>
      )}
      {paused && !pictureChoices && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">
          {t(
            "测评已暂停，点击继续后从中断处恢复。",
            "Paused. Continue from where you stopped.",
            "Tes dijeda. Lanjutkan dari posisi terakhir.",
          )}
        </p>
      )}
      <fieldset disabled={paused}>
        <legend
          className={pictureChoices ? `mb-1 text-xs ${optionsNeedScroll?'text-amber-800 font-semibold':'text-slate-500'}` : "sr-only"}
        >
          {pictureChoices
            ? optionsNeedScroll
              ? t(
                  `共${q.options.length}个选项 · 下滑查看全部`,
                  `All ${q.options.length} options · Scroll to see all`,
                  `${q.options.length} pilihan · Gulir untuk melihat semua`,
                )
              : t(
                  `共${q.options.length}个选项，请看完后选择`,
                  `All ${q.options.length} options`,
                  `${q.options.length} pilihan`,
                )
            : t("选择一个答案", "Choose one answer", "Pilih satu jawaban")}
        </legend>
        <div
          ref={pictureGrid}
          data-option-count={q.options.length}
          className={`grid ${pictureChoices ? "hsk-picture-grid grid-cols-3 gap-1.5 sm:gap-3" : `gap-3 ${q.section === "writing" ? "grid-cols-3" : q.format === "word_bank" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}`}
        >
          {displayVersionOptions(q, version).map((opt) => (
            <label
              key={opt.id}
              htmlFor={`hsk-q-${q.id}-${opt.id}`}
              className={`relative rounded-xl border ${pictureChoices ? "p-1.5 pt-5 sm:p-3 sm:pt-6" : "p-3"} cursor-pointer focus-within:ring-2 focus-within:ring-primary-600 ${selected === opt.id ? "border-primary-600 bg-primary-50" : "border-slate-300"}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={`hsk-q-${q.id}`}
                id={`hsk-q-${q.id}-${opt.id}`}
                checked={selected === opt.id}
                onChange={() =>
                  setAttempt((prev) =>
                    prev
                      ? {
                          ...prev,
                          answers: { ...prev.answers, [q.id]: opt.id },
                        }
                      : prev,
                  )
                }
                aria-label={
                  opt.imageKey
                    ? t(
                        `图片选项${opt.label}`,
                        `Picture option ${opt.label}`,
                        `Pilihan gambar ${opt.label}`,
                      )
                    : undefined
                }
              />
              {opt.imageKey ? (
                <>
                  <HskExamImage
                    id={opt.imageKey}
                    className="w-full h-[clamp(80px,16dvh,144px)] sm:h-[clamp(80px,16dvh,160px)]"
                    examVersion={attempt.examVersion}
                    scoringVersion={attempt.scoringVersion}
                    label={t(
                      `图片选项${opt.label}`,
                      `Picture option ${opt.label}`,
                      `Pilihan gambar ${opt.label}`,
                    )}
                    lang={lang}
                  />
                  <span className="absolute top-0.5 left-1.5 text-sm font-bold">
                    {opt.label}
                  </span>
                </>
              ) : (
                <span className="flex gap-2">
                  <span className="font-semibold">{opt.label}.</span>
                  {opt.tokens ? (
                    <HskPinyinText
                      tokens={opt.tokens}
                      size={q.section === "writing" ? "lg" : "base"}
                    />
                  ) : (
                    <span
                      className={
                        q.section === "writing"
                          ? "text-2xl font-bold"
                          : "text-base font-serif"
                      }
                    >
                      {stripSourceLabel(opt.text)}
                    </span>
                  )}
                </span>
              )}
              {selected === opt.id && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-2 text-primary-700"
                >
                  ✓
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>
      <div ref={answerNav} className="sticky bottom-0 bg-white py-2 flex gap-2">
        <button
          className={button + " bg-primary-700 text-white flex-1"}
          disabled={paused || selected == null}
          onClick={() => leaveRef.current(key.current, "next")}
        >
          {index === questions.length - 1
            ? t("完成测评", "Finish assessment", "Selesaikan tes")
            : t("下一题", "Next", "Berikutnya")}
        </button>
        <button
          className={button}
          disabled={paused}
          onClick={() => leaveRef.current(key.current, "skip")}
        >
          {t("跳过", "Skip", "Lewati")}
        </button>
      </div>
      {!storageOK && (
        <p role="alert" className="text-xs text-amber-800">
          {t(
            "浏览器无法保存进度，请保持本页打开。",
            "Your browser cannot save progress. Keep this page open.",
            "Browser tidak dapat menyimpan kemajuan. Tetap buka halaman ini.",
          )}
        </p>
      )}
    </section>
  );
}
