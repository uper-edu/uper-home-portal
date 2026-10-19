import { CrmPanorama } from "./CrmPanorama";
import React, { useEffect, useRef, useState } from "react";
import { guideLessons, type GuideLesson } from "./CrmGuideLearning";
import {
  exerciseWords,
  taskStories,
  taskChanges,
} from "./CrmGuideExerciseContent";

type Props = { col: number };
const words = (col: number, en: string, id: string, zh: string) =>
  [en, id, zh][col];
export function LessonFigure({
  lesson,
  col,
  chapterKey,
}: Props & { lesson: GuideLesson; chapterKey: string }) {
  const [active, setActive] = useState(0);
  const item = lesson.nodes[active];
  const t = (en: string, id: string, zh: string) => words(col, en, id, zh);
  return (
    <figure
      className={`crm-learning-figure crm-learning-${lesson.shape}`}
      aria-label={lesson.title[col]}
    >
      {lesson.shape === "relationship" && (
        <div className="crm-learning-hub">
          <strong>Amelia Putri</strong>
          <span>
            {t(
              "One synthetic customer",
              "Satu pelanggan simulasi",
              "一位模拟客户",
            )}
          </span>
          <div aria-hidden="true">↓</div>
          <small>{t("links to", "terhubung ke", "分别关联")}</small>
        </div>
      )}
      {lesson.shape !== "comparison" && (
        <p className="crm-learning-hint">
          {t(
            "Select a part to read how it works.",
            "Pilih bagian untuk membaca cara kerjanya.",
            "选择图中环节，查看它的作用与变化。",
          )}
        </p>
      )}
      <ol className="crm-learning-nodes">
        {lesson.nodes.map((node, i) => (
          <li key={i}>
            {lesson.shape === "comparison" ? (
              <div className="crm-learning-card">
                <strong>{node.label[col]}</strong>
                <span>{node.detail[col]}</span>
              </div>
            ) : (
              <button
                type="button"
                aria-pressed={active === i}
                aria-controls={`lesson-detail-${chapterKey}`}
                onClick={() => setActive(i)}
              >
                {lesson.shape !== "relationship" && (
                  <span className="crm-learning-number" aria-hidden="true">
                    {i + 1}
                  </span>
                )}
                <strong>{node.label[col]}</strong>
              </button>
            )}
            {(lesson.shape === "flow" || lesson.shape === "procedure") &&
              i < lesson.nodes.length - 1 && (
                <span className="crm-learning-connector" aria-hidden="true">
                  →
                </span>
              )}
          </li>
        ))}
      </ol>
      {lesson.shape !== "comparison" && (
        <div
          id={`lesson-detail-${chapterKey}`}
          className="crm-learning-selected"
          aria-live="polite"
        >
          <strong>{item.label[col]}</strong>
          <p>{item.detail[col]}</p>
        </div>
      )}
      <figcaption>{lesson.caption[col]}</figcaption>
    </figure>
  );
}

export function LessonOpening({
  chapterKey,
  col,
}: Props & { chapterKey: string }) {
  const s = guideLessons[chapterKey];
  if (!s) return null;
  if (chapterKey === "panorama") return <CrmPanorama col={col} />;
  const t = (en: string, id: string, zh: string) => words(col, en, id, zh);
  return (
    <div className="crm-learning-opening">
      <p className="crm-learning-answer">{s.answer[col]}</p>
      {chapterKey === "tasks-sla" ? (
        <TaskStory col={col} />
      ) : chapterKey === "visual-status" ? (
        <StatusLegend col={col} />
      ) : (
        <LessonFigure
          key={chapterKey}
          chapterKey={chapterKey}
          lesson={s}
          col={col}
        />
      )}
      {s.value[col] !== s.caption[col] && (
        <div className="crm-learning-value">
          <h4>
            {s.shape === "procedure"
              ? t("Check the result", "Periksa hasil", "怎样判断做对了")
              : t("Why this matters", "Mengapa ini berguna", "它解决什么问题")}
          </h4>
          <p>{s.value[col]}</p>
        </div>
      )}
      {chapterKey === "measurement" && (
        <figure className="crm-learning-ratio">
          <div
            className="crm-learning-waffle"
            role="img"
            aria-label={t(
              "2 enrolled out of 10 registered customers: 20%",
              "2 terdaftar kelas dari 10 pelanggan: 20%",
              "10位登记客户中2位已报名：20%",
            )}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} data-filled={i < 2} aria-hidden="true">
                {i < 2 ? "●" : "○"}
              </span>
            ))}
          </div>
          <strong>2 / 10 = 20%</strong>
          <figcaption>
            {t(
              "Recorded enrollment share; not verified payment or causal conversion.",
              "Proporsi pendaftaran tercatat; bukan pembayaran terverifikasi atau konversi kausal.",
              "已记录报名占比，不代表已核验付款或因果转化。",
            )}
          </figcaption>
        </figure>
      )}
      <div className="crm-learning-example">
        <h4>
          {t(
            "Worked example · synthetic data",
            "Contoh kasus · data simulasi",
            "规则实例 · 模拟数据",
          )}
        </h4>
        <p>{s.example[col]}</p>
      </div>
      <div className="crm-learning-boundary">
        <h4>
          {t(
            "Keep this distinction",
            "Perhatikan perbedaan ini",
            "不要混淆的边界",
          )}
        </h4>
        <p>{s.boundary[col]}</p>
      </div>
      {chapterKey === "followup" && <FollowupPractice col={col} />}
    </div>
  );
}

function StatusLegend({ col }: Props) {
  const t = (en: string, id: string, zh: string) => words(col, en, id, zh);
  const states = [
    [
      "action",
      "→",
      t("Record result", "Catat hasil", "记录结果"),
      t(
        "Primary action or selection",
        "Tindakan utama atau pilihan",
        "主要操作或当前选中",
      ),
    ],
    [
      "overdue",
      "!",
      t("Overdue / failed", "Terlambat / gagal", "当前逾期／失败"),
      t(
        "Needs attention now",
        "Perlu perhatian sekarang",
        "当前需要关注的问题",
      ),
    ],
    [
      "review",
      "◷",
      t("Due today / review", "Hari ini / perlu ditinjau", "今天到期／待核实"),
      t(
        "Read the state label to distinguish them",
        "Baca label untuk membedakannya",
        "用状态文字区分两种含义",
      ),
    ],
    [
      "new",
      "●",
      t("Unread information", "Informasi belum dibaca", "未读新信息"),
      t(
        "Reading is not task completion",
        "Membaca tidak menyelesaikan tugas",
        "已读不代表任务完成",
      ),
    ],
    [
      "done",
      "✓",
      t("Completed / confirmed", "Selesai / terkonfirmasi", "已完成／已确认"),
      t(
        "A recorded successful outcome",
        "Hasil berhasil yang tercatat",
        "已有记录支持的成功结果",
      ),
    ],
    [
      "category",
      "—",
      t("High interest", "Minat tinggi", "高意向"),
      t(
        "Customer group, not an alarm",
        "Kelompok pelanggan, bukan peringatan",
        "客户分类，不是紧急警报",
      ),
    ],
  ];
  return (
    <figure className="crm-learning-figure">
      <div className="crm-guide-color-legend">
        {states.map(([kind, icon, label, detail]) => (
          <div key={kind}>
            <strong className={"crm-guide-color-chip " + kind}>
              <span aria-hidden="true">{icon}</span>
              {label}
            </strong>
            <p>{detail}</p>
          </div>
        ))}
      </div>
      <figcaption>
        {t(
          "Read color, icon and text together. Customer value does not determine urgency.",
          "Baca warna, ikon, dan teks bersama. Nilai pelanggan tidak menentukan urgensi.",
          "颜色、图标和文字共同表达状态；客户价值高低不直接决定紧急程度。",
        )}
      </figcaption>
    </figure>
  );
}

export function taskStorySnapshot(step: number) {
  return [1, 2, 3].map((id) => ({
    id: `T${id}`,
    present: step >= id - 1,
    completed: id === 1 && step === 4,
    supplemented: id === 1 && step >= 3,
  }));
}

export function TaskStory({ col }: Props) {
  const [step, setStep] = useState(2),
    [change, setChange] = useState(0);
  const t = (key: keyof typeof exerciseWords) => exerciseWords[key][col];
  const task = taskStorySnapshot(step),
    c = taskChanges[change];
  return (
    <>
      <figure className="crm-task-story" aria-label={t("tasksTitle")}>
        <div className="crm-story-header">
          <div>
            <small>{t("syntheticCustomer")}</small>
            <strong>Amelia Putri</strong>
            <span>{t("owner")} · Fadhil</span>
          </div>
          <div>
            <small>{t("exampleClock")}</small>
            <strong>2026-10-19 · 10:00</strong>
            <span>Asia/Jakarta · UTC+7</span>
          </div>
        </div>
        <ol className="crm-story-steps">
          {taskStories.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                aria-current={step === i ? "step" : undefined}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                {s.short[col]}
              </button>
            </li>
          ))}
        </ol>
        <div className="crm-story-event" aria-live="polite">
          <b>{step + 1}</b>
          <div>
            <h4>{taskStories[step].title[col]}</h4>
            <p>{taskStories[step].body[col]}</p>
          </div>
        </div>
        <div className="crm-story-count">
          <strong>{t("taskLedger")}</strong>
          <span>
            {task.filter((x) => x.present && !x.completed).length}{" "}
            {words(col, "open tasks", "tugas terbuka", "项开放任务")}
          </span>
        </div>
        <div className="crm-story-board">
          {task.map((x, i) => (
            <div
              key={x.id}
              className="crm-story-task"
              data-state={
                !x.present ? "absent" : x.completed ? "completed" : "open"
              }
            >
              <small>{x.id}</small>
              {x.present ? (
                <>
                  <h4>{t(`task${i + 1}` as keyof typeof exerciseWords)}</h4>
                  <span
                    className={`crm-learning-status ${x.completed ? "complete" : i === 1 ? "neutral" : "today"}`}
                  >
                    {t(
                      x.completed ? "completed" : i === 1 ? "pending" : "today",
                    )}
                  </span>
                  <p>{t(`due${i + 1}` as keyof typeof exerciseWords)}</p>
                  <small>
                    {t(`source${i + 1}` as keyof typeof exerciseWords)}
                  </small>
                  {x.supplemented && (
                    <p className="crm-story-evidence">{t("sameId")}</p>
                  )}
                </>
              ) : (
                <span>{t("notCreated")}</span>
              )}
            </div>
          ))}
        </div>
        <div className="crm-story-notice">
          <strong>{t("noticeTitle")}</strong>
          <p>
            {step === 4
              ? words(
                  col,
                  "T1 pending reminder: cancelled. T2 and T3: unchanged.",
                  "Pengingat tertunda T1: dibatalkan. T2 dan T3: tetap.",
                  "T1 关联待发提醒取消，T2、T3 保持原状。",
                )
              : words(
                  col,
                  "No task has completed. Existing pending reminders remain.",
                  "Belum ada tugas selesai. Pengingat tertunda tetap.",
                  "尚未完成任何任务，既有关联待发提醒保留。",
                )}
          </p>
          <small>{t("noticeScope")}</small>
        </div>
        <div className="crm-story-controls">
          <button
            type="button"
            disabled={!step}
            onClick={() => setStep(step - 1)}
          >
            {t("previous")}
          </button>
          <span>{step + 1} / 5</span>
          <button type="button" onClick={() => setStep((step + 1) % 5)}>
            {t(step === 4 ? "restart" : "next")}
          </button>
        </div>
        <figcaption>{t("taskCaption")}</figcaption>
      </figure>
      <figure className="crm-learning-figure">
        <h4>{t("changesTitle")}</h4>
        <div className="crm-learning-choices">
          {taskChanges.map((x, i) => (
            <button
              type="button"
              aria-pressed={change === i}
              key={i}
              onClick={() => setChange(i)}
            >
              {x.name[col]}
            </button>
          ))}
        </div>
        <div className="crm-learning-before-after" aria-live="polite">
          <div>
            <strong>{c.left[col]}</strong>
            <small>{c.leftSub[col]}</small>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <strong>{c.right[col]}</strong>
            <small>{c.rightSub[col]}</small>
          </div>
        </div>
        <figcaption>{c.caption[col]}</figcaption>
      </figure>
    </>
  );
}

type Practice = {
  channel: string;
  result: boolean;
  keep: boolean;
  plan: string;
  note: string;
  action: string;
  purpose: string;
  date: string;
};
const blankPractice: Practice = {
  channel: "",
  result: false,
  keep: false,
  plan: "",
  note: "",
  action: "",
  purpose: "",
  date: "",
};
export function validateGuidePractice(p: Practice) {
  if (!p.channel) return "errChannel";
  if (!p.result) return "errResult";
  if (!p.note.trim()) return "errNote";
  if (!p.keep) return "errOutcome";
  if (!p.plan) return "errPlan";
  const at = Date.parse(p.date + ":00+07:00");
  if (
    p.plan === "schedule" &&
    (!p.action.trim() ||
      !p.purpose.trim() ||
      !Number.isFinite(at) ||
      at <= Date.parse("2026-10-19T10:00:00+07:00"))
  )
    return "errSchedule";
  return "";
}
export function FollowupPractice({ col }: Props) {
  const [p, setP] = useState<Practice>({ ...blankPractice }),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [feedbackRequest, setFeedbackRequest] = useState(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!feedbackRequest) return;
    const feedback = error ? errorRef.current : saved ? savedRef.current : null;
    feedback?.focus({ preventScroll: true });
    feedback?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [feedbackRequest, error, saved]);
  const t = (key: keyof typeof exerciseWords) => exerciseWords[key][col];
  const update = (value: Partial<Practice>) => {
    setP((old) => ({ ...old, ...value }));
    setSaved(false);
    setError("");
  };
  return (
    <section className="crm-guide-practice" aria-label={t("practiceTitle")}>
      <h4>{t("practiceTitle")}</h4>
      <p>
        {words(
          col,
          "Teaching exercise only. No CRM records or notifications are created.",
          "Latihan saja. Tidak membuat catatan CRM atau notifikasi.",
          "教学演练，不会写入 CRM 或发送通知。",
        )}
      </p>
      <div className="crm-guide-practice-grid">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const err = validateGuidePractice(p);
            setError(err);
            setSaved(!err);
            setFeedbackRequest((value) => value + 1);
          }}
        >
          <strong>Amelia Putri · Fadhil</strong>
          <p>{t("boundTask")}</p>
          <fieldset>
            <legend>{t("factStep")}</legend>
            <div className="crm-guide-practice-label">{t("channel")}</div>
            <div className="crm-learning-choices">
              {["phone", "wa"].map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={p.channel === k}
                  onClick={() => update({ channel: k })}
                >
                  {t(k as "phone" | "wa")}
                </button>
              ))}
            </div>
            <div className="crm-guide-practice-label">{t("result")}</div>
            <button
              className="crm-learning-choice"
              type="button"
              aria-pressed={p.result}
              onClick={() => update({ result: !p.result })}
            >
              {t("noReply")}
            </button>
            <label>
              {t("noteLabel")}
              <textarea
                value={p.note}
                onChange={(e) => update({ note: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="crm-learning-text-button"
              onClick={() =>
                update({
                  note: "Telepon pukul 10.00 tidak dijawab. Kebutuhan belajar belum dapat dikonfirmasi.",
                })
              }
            >
              {t("fillNote")}
            </button>
            <small>{t("originalNote")}</small>
          </fieldset>
          <fieldset>
            <legend>{t("outcomeStep")}</legend>
            <button
              className="crm-learning-choice"
              type="button"
              aria-pressed={p.keep}
              onClick={() => update({ keep: !p.keep })}
            >
              {t("keepTask")}
            </button>
            <p>{t("outcomeHelp")}</p>
          </fieldset>
          <fieldset>
            <legend>{t("planStep")}</legend>
            <div className="crm-learning-plans">
              {[
                ["keep", "keepPlan", "keepPlanSub"],
                ["schedule", "schedulePlan", "schedulePlanSub"],
                ["record_only", "recordPlan", "recordPlanSub"],
              ].map(([value, label, sub]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={p.plan === value}
                  onClick={() => update({ plan: value })}
                >
                  <strong>{t(label as keyof typeof exerciseWords)}</strong>
                  <small>{t(sub as keyof typeof exerciseWords)}</small>
                </button>
              ))}
            </div>
            {p.plan === "schedule" && (
              <div className="crm-guide-schedule">
                <label>
                  {t("actionLabel")}
                  <input
                    value={p.action}
                    onChange={(e) => update({ action: e.target.value })}
                  />
                </label>
                <label>
                  {t("purposeLabel")}
                  <input
                    value={p.purpose}
                    onChange={(e) => update({ purpose: e.target.value })}
                  />
                </label>
                <label>
                  {t("dateLabel")}
                  <input
                    type="datetime-local"
                    value={p.date}
                    onChange={(e) => update({ date: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="crm-learning-text-button"
                  onClick={() =>
                    update({
                      action: t("nextActionExample"),
                      purpose: t("nextPurposeExample"),
                      date: "2026-10-20T10:00",
                    })
                  }
                >
                  {t("fillPlan")}
                </button>
                <small>{t("scheduleHelp")}</small>
              </div>
            )}
            {p.plan === "record_only" && <p>{t("recordHelp")}</p>}
          </fieldset>
          {error && (
            <p
              id="crm-guide-practice-error"
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="crm-learning-error"
            >
              {t(error as keyof typeof exerciseWords)}
            </p>
          )}
          <div className="crm-learning-choices">
            <button type="submit" className="crm-learning-primary">
              {t("previewSave")}
            </button>
            <button
              type="button"
              onClick={() => {
                setP({ ...blankPractice });
                setSaved(false);
                setError("");
              }}
            >
              {t("resetPractice")}
            </button>
          </div>
        </form>
        <div className="crm-guide-effects">
          <h4>{t("effectTitle")}</h4>
          <figure>
            <ol>
              {[
                ["attemptTitle", p.result ? "attemptBody" : "draft"],
                ["connectedTitle", p.result ? "connectedBody" : "draft"],
                ["taskEffectTitle", p.keep ? "taskEffectBody" : "draft"],
                [
                  "nextEffectTitle",
                  p.plan === "schedule"
                    ? "schedulePlanSub"
                    : p.plan === "keep"
                      ? "keepPlanSub"
                      : p.plan === "record_only"
                        ? "recordPlanSub"
                        : "draft",
                ],
              ].map(([label, body], i) => (
                <li key={label}>
                  <span aria-hidden="true">{i + 1}</span>
                  <div>
                    <strong>{t(label as keyof typeof exerciseWords)}</strong>
                    <p>{t(body as keyof typeof exerciseWords)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <figcaption>{t("effectCaption")}</figcaption>
          </figure>
          {saved && (
            <div ref={savedRef} tabIndex={-1} role="status" className="crm-guide-saved">
              <strong>{t("savedTitle")}</strong>
              <p>{t("savedSummary")}</p>
              <p>{t(p.plan === "schedule" ? "savedNew" : "savedKeep")}</p>
              {p.plan === "schedule" && (
                <p>
                  {p.action}
                  <br />
                  {p.date.replace("T", " ")} · UTC+7
                </p>
              )}
              <small>{t("savedNote")}</small>
              <blockquote>{p.note}</blockquote>
              <small>{t("notSent")}</small>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
