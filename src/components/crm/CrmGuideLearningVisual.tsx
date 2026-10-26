import {CrmProfileRulesExample} from './CrmProfileRulesExample';
import {CrmSimpleGuideExamples} from './CrmSimpleGuideExamples';
import { CrmPanorama } from "./CrmPanorama";
import React, { useState } from "react";
import {
  guideLessons,
  guideChapterScopes,
  type GuideLesson,
} from "./CrmGuideLearning";
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
      {guideChapterScopes[chapterKey] && (
        <p className="crm-learning-answer">
          {guideChapterScopes[chapterKey][col]}
        </p>
      )}
      <p className="crm-learning-subtitle">{s.title[col]}</p>
      <p className="crm-learning-answer">{s.answer[col]}</p>
      {chapterKey === "tasks-sla" ? (
        <CrmSimpleGuideExamples col={col} />
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
      {chapterKey === "entities" && <CrmProfileRulesExample col={col}/>}
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
      {chapterKey === "followup" && <><CrmSimpleGuideExamples col={col} /><CrmProfileRulesExample col={col}/></>}
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
      t("Use customer facts, original evidence and recorded actions. Information creates no tasks and has no reading or completion checklist.", "Gunakan fakta pelanggan, bukti asli, dan catatan tindakan. Informasi tidak membuat tugas dan tidak memiliki konfirmasi membaca atau daftar penyelesaian.", "依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。"),
      t(
        "Reading is not task completion",
        "Gunakan fakta pelanggan, bukti asli, dan catatan tindakan. Informasi tidak membuat tugas dan tidak memiliki konfirmasi membaca atau daftar penyelesaian.",
        "依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。",
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
