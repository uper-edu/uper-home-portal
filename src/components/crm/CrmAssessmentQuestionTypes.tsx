import type { CrmLanguage } from "../../utils/crmLanguage";
import type { QuestionTypeStats } from "../../utils/crmAssessmentQuestionTypes";

export function CrmAssessmentQuestionTypes({
  stats,
  lang,
}: {
  stats: QuestionTypeStats;
  lang: CrmLanguage;
}) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  if (stats.available === false)
    return (
      <p className="crm-assessment-meta crm-question-types-unavailable">
        {stats.reason === "version"
          ? t(
              "The saved paper version is unavailable; question-type counts cannot be verified.",
              "Versi tes tersimpan tidak tersedia; jumlah per jenis soal tidak dapat diperiksa.",
              "缺少可核对的试卷版本，暂无法展示题型统计。",
            )
          : stats.reason === "answers"
            ? t(
                "Saved item answers are unavailable; question-type counts cannot be shown.",
                "Jawaban per soal tidak tersedia; jumlah per jenis soal tidak dapat ditampilkan.",
                "缺少逐题答案，暂无法展示题型统计。",
              )
            : t(
                "Some saved answers do not match this paper version; question-type counts are unavailable.",
                "Sebagian jawaban tersimpan tidak sesuai dengan versi tes ini; jumlah per jenis soal tidak tersedia.",
                "逐题答案与该次试卷不一致，暂无法展示题型统计。",
              )}
      </p>
    );
  const section = {
    listening: t("Listening", "Menyimak", "听力"),
    reading: t("Reading", "Membaca", "阅读"),
    writing: t("Character selection", "Pilihan karakter", "书写选择"),
  };
  const format = {
    image_select: t("Picture selection", "Pilihan gambar", "图片选择"),
    pinyin_options: t("Pinyin options", "Pilihan pinyin", "拼音选项"),
    pure_hanzi: t("Character options", "Pilihan Hanzi", "汉字选项"),
    word_bank: t(
      "Word-bank completion",
      "Melengkapi dengan bank kata",
      "选词填空",
    ),
    sentence_match: t("Sentence matching", "Mencocokkan kalimat", "句子匹配"),
    passage_comprehension: t(
      "Passage comprehension",
      "Pemahaman bacaan",
      "短文理解",
    ),
    writing_pinyin: t(
      "Character completion",
      "Melengkapi karakter",
      "选字填空",
    ),
  };
  const unanswered = stats.totals.unanswered > 0;
  return (
    <table className="crm-question-types">
      <caption>
        {t("Performance by question type", "Hasil per jenis soal", "题型表现")}{" "}
        <span className="crm-question-types-count">
          · {stats.totals.total} {t("items", "soal", "题")}
        </span>
      </caption>
      <thead>
        <tr>
          <th scope="col">{t("Question type", "Jenis soal", "题型")}</th>
          <th scope="col">{t("Correct", "Benar", "正确")}</th>
          <th scope="col">{t("Incorrect", "Salah", "错误")}</th>
          <th
            scope="col"
            title={t(
              "Explicitly skipped answers",
              "Jawaban yang dilewati secara eksplisit",
              "明确跳过的题目",
            )}
          >
            {t("Skipped", "Dilewati", "跳过")}
          </th>
          {unanswered && (
            <th
              scope="col"
              title={t(
                "No item answer was saved",
                "Tidak ada jawaban per soal yang tersimpan",
                "未保存答案的题目",
              )}
            >
              {t("Unanswered", "Belum dijawab", "未作答")}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {stats.rows.map((row) => (
          <tr key={row.section + ":" + row.format}>
            <th scope="row">
              <span className="crm-question-type-section">
                {section[row.section]}
              </span>
              <span>{format[row.format]}</span>
            </th>
            <td>{row.correct}</td>
            <td>{row.incorrect}</td>
            <td>{row.skipped}</td>
            {unanswered && <td>{row.unanswered}</td>}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{t("Total", "Total", "合计")}</th>
          <td>{stats.totals.correct}</td>
          <td>{stats.totals.incorrect}</td>
          <td>{stats.totals.skipped}</td>
          {unanswered && <td>{stats.totals.unanswered}</td>}
        </tr>
      </tfoot>
    </table>
  );
}
