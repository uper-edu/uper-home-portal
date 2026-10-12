import React, { useEffect, useRef, useState } from "react";
import {
  getVersionQuestions as getExamQuestions,
  displayVersionOptions,
} from "../data/hskAssessmentVersions";
import { type HskHistoryProblem } from "../data/hskReportHistory";
import {
  chooseText,
  gradeHskAttempt,
  newHskAttempt,
  stripSourceLabel,
  type HskAttempt,
  type HskLanguage,
  type HskMode,
  type HskResult,
} from "../data/hskAssessment";
import {
  requireHskVersion,
  HSK_EXAM_VERSION,
  HSK_SCORING_VERSION,
} from "../data/hskAssessmentVersions";
import { hskExample, hskInstruction } from "../data/hskInstructions";
import {
  clearHskDraft,
  readHskDraft,
  readHskHistory,
  readHskHistoryState,
  writeHskDraft,
  writeHskResult,
} from "../services/hskAttemptStorage";
import { saveHskAttempt, restoreHskHistory } from "../services/portalChat";
import { HskExamImage } from "./HskExamVisuals";
import { HskPinyinText } from "./HskPinyinText";
import HskAssessmentReport from "./HskAssessmentReport";
import { HskQuestionPrompt } from "./HskQuestionPrompt";
interface Props {
  onComplete: (result: HskResult) => void;
  onCancel?: () => void;
  studentName: string;
  lang?: HskLanguage;
}
const formatSeconds = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
export default function HSKPlacementAssessment({
  onComplete,
  onCancel,
  studentName,
  lang = "en",
}: Props) {
  const t = (zh: string, en: string, id: string) =>
    chooseText(lang, zh, en, id);
  const [mode, setMode] = useState<HskMode>("express");
  const [draft, setDraft] = useState(readHskDraft);
  const [attempt, setAttempt] = useState<HskAttempt | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<HskResult | null>(null);
  const [history, setHistory] = useState(() => readHskHistory(lang));
  const [historyProblems, setHistoryProblems] = useState<HskHistoryProblem[]>(
    () => readHskHistoryState(lang).problems,
  );
  const [historyStorageAvailable, setHistoryStorageAvailable] = useState(
    () => readHskHistoryState(lang).storageAvailable,
  );
  const [saving, setSaving] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [audioState, setAudioState] = useState<
    "idle" | "playing" | "finished" | "error"
  >("idle");
  const [audioTime, setAudioTime] = useState(0);
  const [exitConfirm, setExitConfirm] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const qs = attempt
    ? getExamQuestions(
        attempt.mode,
        attempt.examVersion,
        attempt.scoringVersion,
      )
    : getExamQuestions(mode);
  // The mode picker can be shown after a longer completed attempt.
  const q = qs[currentIdx] ?? qs[0];
  const options = displayVersionOptions(
    q,
    requireHskVersion(
      attempt?.examVersion || HSK_EXAM_VERSION,
      attempt?.scoringVersion || HSK_SCORING_VERSION,
    ),
  );
  const example = hskExample(q);
  const selected = attempt?.answers[q.id];
  const audioAsset = requireHskVersion(
    attempt?.examVersion || HSK_EXAM_VERSION,
    attempt?.scoringVersion || HSK_SCORING_VERSION,
  ).audioAssets[String(q.id)];
  const sectionLabel =
    q.section === "listening"
      ? t("听力", "Listening", "Menyimak")
      : q.section === "reading"
        ? t("阅读", "Reading", "Membaca")
        : t("识字选择", "Character choices", "Pilihan karakter");
  const stopAudio = () => {
    audioRef.current?.pause();
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audioRef.current?.pause();
    };
  }, []);
  useEffect(() => {
    let active = true;
    const local = readHskHistoryState(lang);
    setHistory(local.results);
    setHistoryProblems(local.problems);
    setHistoryStorageAvailable(local.storageAvailable);
    restoreHskHistory(lang)
      .then((state) => {
        if (active) {
          setHistory(state.results);
          setHistoryProblems(state.problems);
          setHistoryStorageAvailable(state.storageAvailable);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lang]);
  useEffect(() => {
    if (!attempt || result) return;
    const saved = writeHskDraft({ attempt, currentIdx, reviewing });
    setStorageAvailable(saved);
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [attempt, currentIdx, reviewing, result]);
  useEffect(() => {
    if (!attempt || reviewing || result) return;
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible")
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
  }, [attempt?.attemptId, q.id, reviewing, result]);
  useEffect(() => {
    setAudioState("idle");
    setAudioTime(0);
    headingRef.current?.focus();
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, [q.id, reviewing, result, attempt?.attemptId]);
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") stopAudio();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  const start = (resume = false) => {
    if (resume && draft) {
      setAttempt(draft.attempt);
      setCurrentIdx(draft.currentIdx);
      setReviewing(draft.reviewing);
      setMode(draft.attempt.mode);
    } else {
      setAttempt(newHskAttempt(mode, crypto.randomUUID()));
      setCurrentIdx(0);
      setReviewing(false);
    }
    setResult(null);
    setExitConfirm(false);
  };
  const move = (index: number) => {
    stopAudio();
    setCurrentIdx(index);
    setReviewing(false);
  };
  const skip = () => {
    stopAudio();
    setAttempt((prev) =>
      prev ? { ...prev, answers: { ...prev.answers, [q.id]: null } } : prev,
    );
    if (currentIdx === qs.length - 1) setReviewing(true);
    else move(currentIdx + 1);
  };
  const next = () => {
    stopAudio();
    if (currentIdx === qs.length - 1) setReviewing(true);
    else move(currentIdx + 1);
  };
  const persist = async (local: HskResult) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await saveHskAttempt(local.attempt, lang);
      const locallyStored = writeHskResult(saved);
      if (mountedRef.current) {
        setResult(saved);
        setStorageAvailable(locallyStored);
      }
    } catch {
      /* Keep the complete local report and retry the same idempotency key. */
    } finally {
      savingRef.current = false;
      if (mountedRef.current) {
        setSaving(false);
        const state = readHskHistoryState(lang);
        setHistory(state.results);
        setHistoryProblems(state.problems);
        setHistoryStorageAvailable(state.storageAvailable);
      }
    }
  };
  const submit = () => {
    if (!attempt) return;
    stopAudio();
    const completed = { ...attempt, completedAt: new Date().toISOString() };
    const local = gradeHskAttempt(completed, lang);
    const saved = writeHskResult(local);
    setStorageAvailable(saved);
    if (saved) clearHskDraft();
    setResult(local);
    void persist(local);
  };
  const exit = () => {
    stopAudio();
    setExitConfirm(false);
    onCancel?.();
  };
  const playback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioState === "playing") {
      audio.pause();
      setAudioState("idle");
      return;
    }
    audio.currentTime = 0;
    setAudioTime(0);
    audio.play().catch(() => {
      if (audioRef.current === audio) audioFailure();
    });
  };
  const audioFailure = () => {
    setAudioState("error");
    setAttempt((prev) =>
      prev
        ? {
            ...prev,
            audioFailures: [...new Set([...prev.audioFailures, q.id])],
          }
        : prev,
    );
  };
  const panelClass = `my-3 mx-auto w-full ${attempt && q.format === "image_select" && !reviewing && !result ? "max-w-4xl" : "max-w-3xl"} rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4 text-slate-900`;
  const buttonClass =
    "min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed";
  if (result)
    return (
      <div className={panelClass}>
        {!storageAvailable && (
          <p role="alert">
            {t(
              "报告未能写入此浏览器，请保持本页打开；服务端保存状态见下方，尚未保存时可重试。",
              "The browser could not store this report. Keep this page open; see its server save status below and retry if unsaved.",
              "Browser gagal menyimpan laporan. Biarkan halaman terbuka; lihat status server di bawah dan coba lagi jika belum tersimpan.",
            )}
          </p>
        )}
        <HskAssessmentReport
          result={result}
          lang={lang}
          saving={saving}
          onRetry={() => void persist(result)}
        />
        <button
          type="button"
          className={`${buttonClass} bg-primary-700 text-white`}
          onClick={() =>
            onComplete({
              ...gradeHskAttempt(result.attempt, lang),
              saveStatus: result.saveStatus,
            })
          }
        >
          {t("回到咨询", "Return to consultation", "Kembali ke konsultasi")}
        </button>
        <button
          type="button"
          className={`${buttonClass} ml-2`}
          onClick={() => {
            setAttempt(null);
            setResult(null);
            setCurrentIdx(0);
            setReviewing(false);
            setDraft(readHskDraft());
          }}
        >
          {t("再次测评", "Take another assessment", "Ikuti tes lagi")}
        </button>
      </div>
    );
  if (!attempt)
    return (
      <section
        className={panelClass}
        aria-label={t(
          "选择测评模式",
          "Select assessment mode",
          "Pilih mode tes",
        )}
      >
        <div>
          <p className="text-xs text-primary-700 font-semibold">UPER</p>
          <h2 className="text-xl font-bold">
            {t(
              "中文分班诊断",
              "Mandarin placement diagnostic",
              "Diagnostik penempatan Mandarin",
            )}
          </h2>
          <p className="mt-2 text-sm">
            {studentName} ·{" "}
            {t(
              "依据所提供的HSK1–3测评卷改编，非官方认证考试。",
              "Adapted from the supplied HSK1–3 diagnostic paper. This is not an official certification exam.",
              "Diadaptasi dari tes diagnostik HSK1–3 yang disediakan. Ini bukan ujian sertifikasi resmi.",
            )}
          </p>
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-2 font-semibold">
            {t("选择模式", "Choose a mode", "Pilih mode")}
          </legend>
          {(["express", "full"] as const).map((value) => {
            const list = getExamQuestions(value);
            const minAudio = list
              .filter((q) => q.section === "listening")
              .reduce(
                (sum, q) =>
                  sum +
                  requireHskVersion(HSK_EXAM_VERSION, HSK_SCORING_VERSION)
                    .audioAssets[String(q.id)].durationSec,
                0,
              );
            return (
              <label
                key={value}
                className={`block rounded-xl border p-3 cursor-pointer ${mode === value ? "border-primary-600 bg-primary-50" : "border-slate-300"}`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="hsk-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  <strong>
                    {value === "full"
                      ? t(
                          "完整分班诊断",
                          "Full placement diagnostic",
                          "Diagnostik penempatan lengkap",
                        )
                      : t("快测筛查", "Quick screening", "Skrining cepat")}{" "}
                    · {list.length} {t("题", "items", "soal")} ·{" "}
                    {list.length * 2} {t("分", "points", "poin")}
                  </strong>
                </span>
                <p className="mt-2 text-sm">
                  {value === "full"
                    ? t(
                        "21听力＋21阅读＋8识字选择。沿用逐题星级和已确认的门槛。原卷建议45分钟，本版不设时限。",
                        "21 listening + 21 reading + 8 character choices. Source star levels and confirmed thresholds are retained. The paper suggests 45 minutes; this adaptation has no time limit.",
                        "21 menyimak + 21 membaca + 8 pilihan karakter. Tingkat bintang dan ambang yang dikonfirmasi dipertahankan. Tes sumber menyarankan 45 menit; adaptasi ini tanpa batas waktu.",
                      )
                    : t(
                        "仅抽样听力和阅读，每级3–4题。提供表现参考，不确定等级；建议后续完成完整测评。",
                        "A small listening and reading sample, with 3–4 items per level. It reports performance without assigning a level; follow with the full diagnostic.",
                        "Sampel kecil menyimak dan membaca, 3–4 soal per tingkat. Menampilkan hasil tanpa menetapkan tingkat; lanjutkan dengan tes lengkap.",
                      )}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  {t(
                    "全部录音完整播放一遍合计",
                    "All clips played in full once total",
                    "Total jika semua klip diputar lengkap sekali",
                  )}{" "}
                  {formatSeconds(minAudio)} ·{" "}
                  {t(
                    "总耗时取决于作答、重听与复查",
                    "Total time varies with answers, replays and review",
                    "Waktu total bergantung pada jawaban, pemutaran ulang dan peninjauan",
                  )}
                </p>
              </label>
            );
          })}
        </fieldset>
        <p className="text-sm rounded-xl bg-slate-50 p-3">
          {t(
            "题图直接截自PDF；书写题改为汉字选择。不限时，记录答题用时与播放次数；允许跳过，跳过和未答均记0分。录音来源与判分依据见报告说明。",
            "Images are direct PDF crops; writing is adapted to character choices. There is no time limit. Active time and playback starts are recorded. Skipped and unanswered items score zero. Audio provenance and grading limitations are described in the report.",
            "Gambar dipotong langsung dari PDF; menulis diadaptasi menjadi pilihan karakter. Tanpa batas waktu. Waktu aktif dan pemutaran dicatat. Soal dilewati dan belum dijawab bernilai nol. Sumber audio dan batas penilaian dijelaskan pada laporan.",
          )}
        </p>
        <p className="text-xs text-slate-600">
          {t(
            "图片选项使用中性朗读标签以避免泄露答案；本版未提供等效的非视觉测评，请需要辅助的学习者联系教师。",
            "Picture choices have neutral labels to avoid revealing answers. An equivalent nonvisual assessment is not provided; learners needing accommodation can contact a teacher.",
            "Pilihan gambar memakai label netral agar tidak membocorkan jawaban. Tes nonvisual setara belum tersedia; peserta yang membutuhkan bantuan dapat menghubungi guru.",
          )}
        </p>
        {draft && (
          <div className="rounded-xl bg-amber-50 p-3 border border-amber-200">
            <p>
              {t(
                "发现未完成的作答",
                "An unfinished attempt was found",
                "Ditemukan tes yang belum selesai",
              )}{" "}
              · {draft.currentIdx + 1}/
              {
                getExamQuestions(
                  draft.attempt.mode,
                  draft.attempt.examVersion,
                  draft.attempt.scoringVersion,
                ).length
              }
            </p>
            <button
              type="button"
              className={`${buttonClass} mt-2`}
              onClick={() => start(true)}
            >
              {t("继续上次作答", "Resume attempt", "Lanjutkan tes")}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${buttonClass} bg-primary-700 text-white`}
            onClick={() => start()}
          >
            {draft
              ? t(
                  "开始新作答（替换草稿）",
                  "Start new attempt (replace draft)",
                  "Mulai tes baru (ganti draf)",
                )
              : t("开始测评", "Start assessment", "Mulai tes")}
          </button>
          {onCancel && (
            <button type="button" className={buttonClass} onClick={onCancel}>
              {t("返回咨询", "Return to chat", "Kembali ke chat")}
            </button>
          )}
        </div>
        {!historyStorageAvailable && (
          <p role="alert" className="text-sm text-amber-800">
            {t(
              "浏览器历史存储不可用，当前可见报告不会因此改变；请保持本页打开。",
              "Browser history storage is unavailable. Visible reports remain available; keep this page open.",
              "Penyimpanan riwayat browser tidak tersedia. Laporan yang terlihat tetap tersedia; biarkan halaman terbuka.",
            )}
          </p>
        )}
        {historyProblems.length > 0 && (
          <details className="rounded-xl border border-amber-200 p-3">
            <summary className="cursor-pointer font-semibold">
              {t(
                "历史记录待核对",
                "History records needing review",
                "Catatan riwayat perlu ditinjau",
              )}{" "}
              ({historyProblems.length})
            </summary>
            <p className="mt-2 text-sm">
              {t(
                "以下记录已隔离保留，不影响其他报告或新测评。",
                "These records are retained separately and do not affect other reports or new assessments.",
                "Catatan ini dipertahankan terpisah dan tidak memengaruhi laporan lain atau tes baru.",
              )}
            </p>
            {historyProblems.map((problem) => (
              <div key={problem.key} className="mt-3">
                {problem.reason === "invalid_container" ||
                problem.reason === "recovery_backup" ? (
                  <p role="status">
                    {problem.reason === "recovery_backup"
                      ? t(
                          "损坏的历史存储已备份保留。",
                          "Damaged history storage has been backed up and retained.",
                          "Penyimpanan riwayat rusak telah dicadangkan dan dipertahankan.",
                        )
                      : t(
                          "历史存储格式损坏；保存新报告前会先备份原始内容，备份失败不会覆盖它。",
                          "History storage is malformed. Its original content will be backed up before saving a new report; failed backup prevents overwrite.",
                          "Format riwayat rusak. Isi asli akan dicadangkan sebelum laporan baru disimpan; kegagalan pencadangan mencegah penimpaan.",
                        )}
                  </p>
                ) : (
                  <HskAssessmentReport result={problem.record} lang={lang} />
                )}
              </div>
            ))}
          </details>
        )}
        {history.length > 0 && (
          <details>
            <summary className="cursor-pointer font-semibold">
              {t("查看历史作答", "View attempt history", "Lihat riwayat tes")} (
              {history.length})
            </summary>
            <div className="mt-2 space-y-2">
              {history.map((r) => (
                <button
                  type="button"
                  key={r.attempt.attemptId}
                  className={`${buttonClass} w-full text-left`}
                  onClick={() => setResult(r)}
                >
                  {r.attempt.mode === "full"
                    ? t("完整测评", "Full diagnostic", "Tes lengkap")
                    : t("快测", "Screening", "Skrining")}{" "}
                  · {r.score}/{r.maxScore} ·{" "}
                  {new Date(r.attempt.completedAt!).toLocaleString(
                    lang === "id" ? "id-ID" : lang === "zh" ? "zh-CN" : "en-US",
                  )}
                </button>
              ))}
            </div>
          </details>
        )}
      </section>
    );
  if (reviewing)
    return (
      <section className={panelClass}>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold">
          {t(
            "提交前复查",
            "Review before submitting",
            "Tinjau sebelum mengirim",
          )}
        </h2>
        <p className="text-sm">
          {t(
            "选择任一题返回检查。跳过和未答均为0分，提交后本次作答锁定。",
            "Select an item to review it. Skipped and unanswered items score zero. Submitting locks this attempt.",
            "Pilih soal untuk memeriksanya. Soal dilewati dan belum dijawab bernilai nol. Jawaban dikunci setelah dikirim.",
          )}
        </p>
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
          {qs.map((question, index) => {
            const v = attempt.answers[question.id];
            return (
              <button
                type="button"
                key={question.id}
                onClick={() => move(index)}
                aria-label={`${t("原卷题号", "Source item", "Soal sumber")} ${question.id}: ${v === null ? t("跳过", "Skipped", "Dilewati") : v === undefined ? t("未答", "Unanswered", "Belum dijawab") : t("已答", "Answered", "Sudah dijawab")}`}
                className={`min-h-11 border rounded-lg text-sm ${v === null ? "bg-amber-50 border-amber-300" : v === undefined ? "bg-white border-slate-300" : "bg-primary-50 border-primary-400"}`}
              >
                {question.id}
                <span className="block text-xs">
                  {v === null ? "—" : v === undefined ? "?" : "✓"}
                </span>
              </button>
            );
          })}
        </div>
        <p>
          {t("已答", "Answered", "Sudah dijawab")}{" "}
          {Object.values(attempt.answers).filter((v) => v !== null).length} ·{" "}
          {t("跳过", "Skipped", "Dilewati")}{" "}
          {Object.values(attempt.answers).filter((v) => v === null).length} ·{" "}
          {t("未答", "Unanswered", "Belum dijawab")}{" "}
          {qs.length - Object.keys(attempt.answers).length}
        </p>
        <button
          type="button"
          className={`${buttonClass} bg-primary-700 text-white`}
          onClick={submit}
        >
          {t(
            "提交并生成报告",
            "Submit and generate report",
            "Kirim dan buat laporan",
          )}
        </button>
        <button
          type="button"
          className={`${buttonClass} ml-2`}
          onClick={() => move(currentIdx)}
        >
          {t("继续检查", "Continue review", "Lanjutkan peninjauan")}
        </button>
      </section>
    );
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap justify-between gap-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          aria-live="polite"
          className="font-bold"
        >
          {sectionLabel} · {t("第", "Item", "Soal")} {currentIdx + 1}/
          {qs.length}
          {attempt.mode === "express" && (
            <span className="block text-xs font-normal text-slate-500">
              {t("对应原卷题号", "Source item", "Nomor soal sumber")} {q.id}
            </span>
          )}
        </h2>
        <span className="text-xs text-slate-600">
          {t(
            "本题页面时长",
            "Time with this item visible",
            "Waktu tampilan soal",
          )}
          : {formatSeconds(attempt.activeSeconds[q.id] || 0)}
        </span>
      </div>
      <progress
        className="w-full h-2 accent-primary-600"
        value={Object.keys(attempt.answers).length}
        max={qs.length}
        aria-label={t(
          "已答或跳过的题数",
          "Items answered or skipped",
          "Soal dijawab atau dilewati",
        )}
      />
      {!storageAvailable && (
        <p role="alert" className="text-sm text-amber-800">
          {t(
            "草稿未能保存，刷新会丢失进度，请保持本页打开。",
            "Draft saving failed. Refreshing will lose progress; keep this page open.",
            "Draf gagal disimpan. Memuat ulang akan menghilangkan kemajuan; biarkan halaman terbuka.",
          )}
        </p>
      )}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
        <p>{hskInstruction(q, lang)}</p>
        <details
          key={q.pageHeader}
          open={
            currentIdx === 0 || qs[currentIdx - 1]?.pageHeader !== q.pageHeader
          }
        >
          <summary className="mt-2 cursor-pointer text-primary-700 font-semibold">
            {t("非计分示例", "Unscored example", "Contoh tanpa nilai")} ·{" "}
            {example.source
              ? t("原卷示例", "Source example", "Contoh sumber")
              : t("操作示例", "Interaction example", "Contoh penggunaan")}
          </summary>
          <p className="mt-2 whitespace-pre-line font-serif">{example.text}</p>
          {example.imageKey && (
            <HskExamImage
              id={example.imageKey}
              examVersion={attempt.examVersion}
              scoringVersion={attempt.scoringVersion}
              className="w-36 h-24"
              lang={lang}
            />
          )}
        </details>
      </div>
      {q.section === "listening" && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 space-y-2">
          <audio
            key={q.id}
            ref={audioRef}
            src={audioAsset.src}
            preload="none"
            onPlay={() => {
              setAudioState("playing");
              setAttempt((prev) =>
                prev
                  ? {
                      ...prev,
                      plays: {
                        ...prev.plays,
                        [q.id]: (prev.plays[q.id] || 0) + 1,
                      },
                    }
                  : prev,
              );
            }}
            onPause={() =>
              setAudioState((prev) => (prev === "playing" ? "idle" : prev))
            }
            onEnded={() => setAudioState("finished")}
            onTimeUpdate={() =>
              setAudioTime(audioRef.current?.currentTime || 0)
            }
            onError={audioFailure}
          />
          <div className="flex flex-wrap justify-between items-center gap-2">
            <button type="button" className={buttonClass} onClick={playback}>
              {audioState === "playing"
                ? t("停止播放", "Stop playback", "Hentikan audio")
                : (attempt.plays[q.id] || 0) > 0
                  ? t("重新播放", "Replay audio", "Putar ulang")
                  : t("播放录音", "Play audio", "Putar audio")}
            </button>
            <span className="text-xs">
              {formatSeconds(audioTime)} /{" "}
              {formatSeconds(audioAsset.durationSec)} ·{" "}
              {t("播放启动", "Starts", "Mulai putar")}{" "}
              {attempt.plays[q.id] || 0}
            </span>
          </div>
          <p className="text-xs text-indigo-900">
            {t(
              "原始MP3直接切片，保留原停顿和重复。录音内部分题号与PDF不同，请以页面题号作答。",
              "Direct source-MP3 crop, retaining original pauses and repeats. Some spoken numbers differ from the PDF; answer the item shown on this page.",
              "Potongan langsung MP3 sumber, dengan jeda dan pengulangan asli. Sebagian nomor lisan berbeda dari PDF; ikuti nomor soal di halaman ini.",
            )}
          </p>
          <p role="status" className="text-xs">
            {audioState === "error"
              ? t(
                  "录音未能播放，请重试或跳过。不会用合成语音替代。",
                  "Audio could not play. Retry or skip. No synthetic fallback is used.",
                  "Audio tidak dapat diputar. Coba lagi atau lewati. Tidak ada pengganti sintetis.",
                )
              : audioState === "playing"
                ? t(
                    "播放中；停止或结束后可切题",
                    "Playing; stop or finish before moving on",
                    "Sedang diputar; hentikan atau selesaikan sebelum pindah",
                  )
                : audioState === "finished"
                  ? t(
                      "播放结束，可选择答案",
                      "Playback finished; choose an answer",
                      "Audio selesai; pilih jawaban",
                    )
                  : t(
                      "点击按钮播放。不限重听次数，并记录播放次数。",
                      "Use the button to play. Replays are unlimited and recorded.",
                      "Gunakan tombol untuk memutar. Pemutaran ulang tidak dibatasi dan dicatat.",
                    )}
          </p>
        </div>
      )}
      {q.section !== "listening" && (
        <HskQuestionPrompt question={q} lang={lang} />
      )}
      <fieldset>
        <legend className="sr-only">
          {t("选择一个答案", "Choose one answer", "Pilih satu jawaban")}
        </legend>
        <div
          className={`grid gap-2 ${q.format === "image_select" ? "grid-cols-2 sm:grid-cols-3" : q.format === "writing_pinyin" ? "grid-cols-3" : q.format === "word_bank" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}
        >
          {options.map((opt) => (
            <div
              key={opt.id}
              className={`relative block rounded-xl border p-3 min-h-12 cursor-pointer focus-within:ring-2 focus-within:ring-primary-600 ${selected === opt.id ? "border-primary-600 bg-primary-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={`hsk-q-${q.id}`}
                id={`hsk-q-${q.id}-${opt.id}`}
                aria-label={
                  opt.imageKey
                    ? t(
                        `图片选项${opt.label}`,
                        `Picture option ${opt.label}`,
                        `Pilihan gambar ${opt.label}`,
                      )
                    : undefined
                }
                value={opt.id}
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
              />
              {opt.imageKey ? (
                <>
                  <HskExamImage
                    id={opt.imageKey}
                    examVersion={attempt.examVersion}
                    scoringVersion={attempt.scoringVersion}
                    lang={lang}
                    label={t(
                      `图片选项${opt.label}`,
                      `Picture option ${opt.label}`,
                      `Pilihan gambar ${opt.label}`,
                    )}
                    className="w-full h-28 sm:h-36"
                  />
                  <label
                    htmlFor={`hsk-q-${q.id}-${opt.id}`}
                    className="block min-h-11 text-center content-center font-semibold cursor-pointer"
                  >
                    {t("选择", "Choose", "Pilih")} {opt.label}
                  </label>
                </>
              ) : (
                <label
                  htmlFor={`hsk-q-${q.id}-${opt.id}`}
                  className="flex min-h-11 items-start gap-2 cursor-pointer"
                >
                  <span className="text-sm font-mono font-semibold pt-1">
                    {opt.label}.
                  </span>
                  {opt.tokens ? (
                    <HskPinyinText
                      tokens={opt.tokens}
                      size={q.section === "writing" ? "lg" : "base"}
                      className="min-w-0"
                    />
                  ) : (
                    <span
                      className={`font-serif whitespace-pre-line ${q.section === "writing" ? "text-2xl font-bold" : "text-base"}`}
                    >
                      {stripSourceLabel(opt.text)}
                    </span>
                  )}
                </label>
              )}
              {selected === opt.id && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-2 text-primary-700"
                >
                  ✓
                </span>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={currentIdx === 0 || audioState === "playing"}
          onClick={() => move(currentIdx - 1)}
        >
          {t("上一题", "Previous", "Sebelumnya")}
        </button>
        <button
          type="button"
          className={`${buttonClass} bg-primary-700 text-white`}
          disabled={
            selected === undefined ||
            selected === null ||
            audioState === "playing"
          }
          onClick={next}
        >
          {currentIdx === qs.length - 1
            ? t("提交前复查", "Review answers", "Tinjau jawaban")
            : t("下一题", "Next", "Berikutnya")}
        </button>
        <button type="button" className={buttonClass} onClick={skip}>
          {t("不知道 / 跳过", "Not sure / skip", "Tidak tahu / lewati")}
        </button>
      </div>
      <div className="flex gap-4 text-xs">
        <button
          type="button"
          className="underline min-h-11"
          disabled={audioState === "playing"}
          onClick={() => setReviewing(true)}
        >
          {t("查看作答清单", "Review answer list", "Tinjau daftar jawaban")}
        </button>
        {onCancel && (
          <button
            type="button"
            className="underline min-h-11"
            onClick={() => {
              stopAudio();
              setExitConfirm(true);
            }}
          >
            {t("保存并退出", "Save and leave", "Simpan dan keluar")}
          </button>
        )}
      </div>
      {exitConfirm && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          <p>
            {storageAvailable
              ? t(
                  "草稿已保存在此浏览器，返回可继续。确认退出？",
                  "The draft is saved in this browser and can be resumed. Leave now?",
                  "Draf tersimpan di browser ini dan dapat dilanjutkan. Keluar sekarang?",
                )
              : t(
                  "草稿保存失败，退出可能丢失进度。",
                  "Draft saving failed; leaving may lose progress.",
                  "Draf gagal disimpan; keluar dapat menghilangkan kemajuan.",
                )}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={buttonClass} onClick={exit}>
              {t("确认退出", "Leave", "Keluar")}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setExitConfirm(false)}
            >
              {t("继续作答", "Keep working", "Lanjutkan")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
