import { chooseText, type HskLanguage } from "./hskAssessment";
import type { RealHskQuestion } from "./hskQuizQuestions";
export function hskInstruction(q: RealHskQuestion, lang: HskLanguage) {
  if (q.section === "listening")
    return chooseText(
      lang,
      "先点击播放，再根据录音选择一个答案。可以重听；播放结束或停止后再切题。",
      "Play the audio, then choose one answer. Replays are allowed. Stop or finish playback before moving on.",
      "Putar audio, lalu pilih satu jawaban. Boleh memutar ulang. Hentikan atau selesaikan audio sebelum pindah soal.",
    );
  if (q.format === "image_select")
    return chooseText(
      lang,
      "阅读句子，选择对应图片。每题独立作答。",
      "Read the sentence and select the matching picture. Answer each item independently.",
      "Baca kalimat dan pilih gambar yang cocok. Jawab setiap soal secara terpisah.",
    );
  if (q.format === "word_bank")
    return chooseText(
      lang,
      "从词库中选择最适合空位的词。每题可独立使用词库。",
      "Choose the word that best fills the blank. The word bank is available independently for each item.",
      "Pilih kata yang paling tepat untuk bagian kosong. Daftar kata dapat digunakan secara terpisah pada setiap soal.",
    );
  if (q.format === "writing_pinyin")
    return chooseText(
      lang,
      "根据句意与空位拼音，选择正确汉字。这是识字选择，不测手写能力。",
      "Use the sentence and the pinyin at the blank to choose a character. This measures recognition, not handwriting.",
      "Gunakan konteks dan pinyin pada bagian kosong untuk memilih karakter. Ini menguji pengenalan, bukan tulisan tangan.",
    );
  return chooseText(
    lang,
    "阅读题干，选择最合适的回答或衔接句。",
    "Read the prompt and choose the best response or continuation.",
    "Baca soal dan pilih jawaban atau lanjutan kalimat yang paling tepat.",
  );
}
/** Source examples contain no scored answer; new examples are explicitly marked as adapted. */
export function hskExample(q: RealHskQuestion) {
  if (q.id <= 3)
    return { text: "苹果。 → C", imageKey: "example_apples", source: false };
  if (q.id <= 5)
    return {
      text: "今天天气怎么样？\nA 在学习　B 很好听　C 非常热\n→ C",
      source: true,
    };
  if (q.id <= 7)
    return {
      text: "下午我去超市，我想买一些水果。\n问：说话的人下午去哪里了？\nA 超市　B 哪里？　C 学校\n→ A",
      source: true,
    };
  if (q.id <= 10)
    return {
      text: "男：你喜欢什么运动？\n女：我最喜欢踢足球。\n→ D",
      imageKey: "soccer_girl",
      source: true,
    };
  if (q.id <= 13)
    return {
      text: "男：给您笔，请在这儿写一下您的姓名。\n女：好的，是这儿吗？\n问：女的要写什么？\nA 姓名　B 时间　C 问题\n→ A",
      source: true,
    };
  if (q.id <= 21)
    return {
      text: "女：我需要搬一些椅子到楼上办公室，你能来帮忙吗？\n男：没问题，我再叫几个人来帮你。\n问：他们要把椅子搬到哪儿？\nA 教室　B 办公室　C 体育馆\n→ B",
      source: true,
    };
  if (q.id <= 25)
    return {
      text: "我很喜欢这本书。 → E",
      imageKey: "reading_chair",
      source: true,
    };
  if (q.format === "word_bank")
    return { text: "我（　）老师。\nA 是　B 吃　C 看\n→ A 是", source: false };
  if (q.section === "writing")
    return { text: "nǐ\n（　）好！\nA 你　B 她　C 他\n→ A 你", source: false };
  return { text: "你去哪儿？ → 我去学校。", source: false };
}
