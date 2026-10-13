import type { LeadProfile } from "../types/leadSystem";
import { chooseText, type HskLanguage } from "../data/hskAssessment";
import { safeHskResult } from "../data/hskReportHistory";
import { learnerAssessmentGuidance } from "../data/hskLearnerGuidance";

const recipient = "6281116612062";
const clean = (value: unknown, limit = 100) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit)
    : "";
const labels: Record<string, [string, string, string]> = {
  "University student": ["大学生", "University student", "Mahasiswa"],
  "Fresh graduate": ["应届毕业生", "Fresh graduate", "Lulusan baru"],
  "Working professional": ["在职员工", "Working professional", "Karyawan"],
  "High school student": ["高中生", "High school student", "Siswa SMA"],
  "Teacher or school staff": [
    "教师／学校教职工",
    "Teacher or school staff",
    "Guru / staf sekolah",
  ],
  Other: ["其他", "Other", "Lainnya"],
  Jakarta: ["雅加达", "Jakarta", "Jakarta"],
  Online: ["线上课程", "Online classes", "Kelas online"],
  Offline: ["线下课程", "Offline classes", "Kelas tatap muka"],
  "Not sure": ["待顾问建议", "Need advice", "Perlu saran"],
  "Work in China": ["赴华工作", "Work in China", "Bekerja di Tiongkok"],
  "Work at a Chinese or China-Indonesia joint venture company in Indonesia": [
    "在印尼中资或合资企业工作",
    "Work at a Chinese or joint venture company in Indonesia",
    "Bekerja di perusahaan Tiongkok / JV di Indonesia",
  ],
  "Study in China or scholarship": [
    "赴华留学／奖学金",
    "Study in China / scholarship",
    "Kuliah di Tiongkok / beasiswa",
  ],
  "Prepare for HSK certification": [
    "HSK备考",
    "Prepare for HSK certification",
    "Persiapan sertifikasi HSK",
  ],
  "Improve my Mandarin skills": [
    "提升中文能力",
    "Improve Mandarin skills",
    "Meningkatkan kemampuan Mandarin",
  ],
  "Complete beginner": ["零基础", "Complete beginner", "Pemula total"],
  Beginner: [
    "入门／基础不确定",
    "Beginner / unsure of foundation",
    "Pemula / dasar belum pasti",
  ],
};
export function localizedStudentField(value: unknown, lang: HskLanguage) {
  const s = clean(value);
  const row = labels[s];
  return row ? chooseText(lang, ...row) : s;
}
/** Builds a draft only. No requests, automatic sending, contacts, transcript or answer list. */
export function hskWhatsAppDraft(
  profile: Partial<LeadProfile> | null,
  rawResult: unknown,
  lang: HskLanguage,
) {
  const t = (zh: string, en: string, id: string) =>
    chooseText(lang, zh, en, id);
  const localized = (value: unknown) => localizedStudentField(value, lang);
  const lines = [
    t(
      "您好，我想咨询适合我的中文课程。",
      "Hello, I would like advice on a Mandarin course suitable for me.",
      "Halo, saya ingin berkonsultasi tentang kursus Mandarin yang sesuai.",
    ),
  ];
  const fields = [
    [t("姓名", "Name", "Nama"), clean(profile?.fullName, 60)],
    [t("身份", "Status", "Status"), localized(profile?.currentStatus)],
    [
      t("城市", "City", "Kota"),
      profile?.city === "Other"
        ? clean(profile.cityDetail) || localized(profile.city)
        : localized(profile?.city),
    ],
    [t("学习目标", "Goal", "Tujuan"), localized(profile?.goal)],
    [
      t("上课偏好", "Class preference", "Preferensi kelas"),
      localized(profile?.mode),
    ],
  ];
  for (const [label, value] of fields)
    if (value) lines.push(`${label}：${value}`);
  const result = safeHskResult(rawResult, lang);
  if (result) {
    lines.push(
      `${result.attempt.mode === "full" ? t("完整测评", "Full assessment", "Tes lengkap") : t("快速测评", "Quick assessment", "Tes singkat")}：${result.correctCount}/${result.questionCount} ${t("题正确", "items correct", "soal benar")}`,
    );
    const names = {
      listening: t("听力", "Listening", "Menyimak"),
      reading: t("阅读", "Reading", "Membaca"),
      writing: t("识字", "Character recognition", "Pengenalan karakter"),
    };
    lines.push(
      Object.entries(result.sections)
        .filter(([, v]) => v.total > 0)
        .map(
          ([key, v]) =>
            `${names[key as keyof typeof names]} ${v.correct}/${v.total}`,
        )
        .join(" · "),
    );
    lines.push(
      [1, 2, 3]
        .map(
          (n) =>
            `${"★".repeat(n)} ${result.breakdown[`hsk${n}Correct` as keyof typeof result.breakdown]}/${result.breakdown[`hsk${n}Total` as keyof typeof result.breakdown]}`,
        )
        .join(" · "),
    );
    lines.push(
      `${t("未作答", "Unanswered", "Belum dijawab")}：${result.skippedCount + result.unansweredCount}`,
    );
    const guidance = learnerAssessmentGuidance(result,lang);
    if(result.attempt.mode==='full')lines.push(result.levelConfirmed);
    if (guidance) {
      lines.push(`${t('建议学习起点','Suggested learning start','Titik awal yang disarankan')}：${guidance.start}`);
      if (guidance.review) lines.push(guidance.review);
    } else
      lines.push(
        t(
          "历史抽样结果，起点需顾问复核。",
          "Historical sample; an advisor should verify the starting point.",
          "Sampel lama; titik awal perlu ditinjau konsultan.",
        ),
      );
    if (!guidance && result.attempt.audioFailures.length)
      lines.push(
        t(
          "听力有播放异常，需要复核。",
          "Listening playback errors need review.",
          "Gangguan audio perlu ditinjau.",
        ),
      );
    if (result.saveStatus !== "saved")
      lines.push(
        t(
          "结果仅本地暂存，尚未确认服务端保存。",
          "Results are stored locally; server saving is unconfirmed.",
          "Hasil tersimpan lokal; penyimpanan server belum dikonfirmasi.",
        ),
      );
    lines.push(
      t(
        "仅作学习与分班参考，不是官方HSK成绩。",
        "For learning and placement guidance, not an official HSK score.",
        "Untuk panduan belajar dan penempatan, bukan nilai HSK resmi.",
      ),
    );
  } else if (rawResult)
    lines.push(
      t(
        "历史测评记录待核对。",
        "Historical assessment needs review.",
        "Catatan tes lama perlu ditinjau.",
      ),
    );
  lines.push(
    t(
      "请帮我确认学习起点及合适的课程。",
      "Please help confirm my starting point and suitable classes.",
      "Mohon bantu memastikan titik awal belajar dan kelas yang sesuai.",
    ),
  );
  const message = lines.join("\n");
  return {
    message,
    url: `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`,
    includesResult: !!result,
  };
}
