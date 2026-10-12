/**
 * UPER Official HSK Placement Examination Test Bank (HSK 1~3)
 * Exact replication of the 12-page official exam PDF & audio recording.
 */

export interface QuizOption {
  id: string; // 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  text?: string; // Chinese text
  pinyin?: string; // Pinyin displayed above Hanzi (only when present in PDF)
  imageKey?: string; // Key corresponding to HskExamImage
  isCorrect: boolean;
}

export interface RealHskQuestion {
  id: number;
  level: 'HSK 1' | 'HSK 2' | 'HSK 3';
  section: 'listening' | 'reading' | 'writing';
  format: 'image_select' | 'pinyin_options' | 'pure_hanzi' | 'word_bank' | 'sentence_match' | 'passage_comprehension' | 'writing_pinyin';
  pageHeader: string; // e.g. "一、 听 力\n第 1～3 题 ★"
  example?: {
    textZh: string;
    textPinyin?: string;
    answerKey: string;
  };
  promptText?: string;
  promptPinyin?: string;
  wordBank?: { id: string; pinyin: string; text: string }[];
  options: QuizOption[];
  spokenScript?: string;
  audioStartSec?: number;
  audioEndSec?: number;
  explanationZh: string;
  explanationEn: string;
  isExpressSelected?: boolean;
}

export const OFFICIAL_HSK_EXAM: RealHskQuestion[] = [
  // =================== PART 1: 听力 (LISTENING 21 QUESTIONS) ===================
  // --- Page 2: 第 1～3 题 ★ Image Selection ---
  {
    id: 1,
    level: 'HSK 1',
    section: 'listening',
    format: 'image_select',
    pageHeader: '一、 听 力\n第 1～3 题 ★',
    example: {
      textZh: '例如：苹果。我想买几个大苹果。',
      answerKey: 'C'
    },
    spokenScript: '坐飞机。',
    audioStartSec: 8,
    audioEndSec: 23,
    options: [
      { id: 'A', imageKey: 'car', isCorrect: false },
      { id: 'B', imageKey: 'bullet_train', isCorrect: false },
      { id: 'C', imageKey: 'airplane', isCorrect: true }
    ],
    explanationZh: '录音内容为“坐飞机”。正确答案为 C（飞机）。',
    explanationEn: 'The audio says "坐飞机 (take an airplane)". Correct answer is C.',
    isExpressSelected: true
  },
  {
    id: 2,
    level: 'HSK 1',
    section: 'listening',
    format: 'image_select',
    pageHeader: '一、 听 力\n第 1～3 题 ★',
    spokenScript: '不想听。',
    audioStartSec: 24,
    audioEndSec: 39,
    options: [
      { id: 'A', imageKey: 'cover_ears', isCorrect: true },
      { id: 'B', imageKey: 'cover_eyes', isCorrect: false },
      { id: 'C', imageKey: 'shh', isCorrect: false }
    ],
    explanationZh: '录音内容为“不想听”。正确答案为 A（捂耳朵）。',
    explanationEn: 'The audio says "不想听 (do not want to listen)". Correct answer is A.',
    isExpressSelected: true
  },
  {
    id: 3,
    level: 'HSK 1',
    section: 'listening',
    format: 'image_select',
    pageHeader: '一、 听 力\n第 1～3 题 ★',
    spokenScript: '在椅子上。',
    audioStartSec: 41,
    audioEndSec: 56,
    options: [
      { id: 'A', imageKey: 'bird_branch', isCorrect: false },
      { id: 'B', imageKey: 'cat_on_chair', isCorrect: true },
      { id: 'C', imageKey: 'dog_under_chair', isCorrect: false }
    ],
    explanationZh: '录音内容为“在椅子上”。正确答案为 B（小猫在椅子上）。',
    explanationEn: 'The audio says "在椅子上 (on the chair)". Correct answer is B.'
  },

  // --- Page 3: 第 4～5 题 ★ Pinyin + Hanzi Options ---
  {
    id: 4,
    level: 'HSK 1',
    section: 'listening',
    format: 'pinyin_options',
    pageHeader: '第 4～5 题 ★',
    example: {
      textPinyin: 'Jīntiān tiānqì zěnmeyàng ？',
      textZh: '例如： 今天 天气 怎么样 ？',
      answerKey: 'C'
    },
    spokenScript: '你家有几口人？',
    audioStartSec: 64,
    audioEndSec: 84,
    options: [
      { id: 'A', pinyin: 'xīngqīsì', text: '星期四', isCorrect: false },
      { id: 'B', pinyin: 'sān kuài qián', text: '三 块 钱', isCorrect: false },
      { id: 'C', pinyin: 'wǔ kǒu rén', text: '五 口 人', isCorrect: true }
    ],
    explanationZh: '录音问“你家有几口人？”，对应答案为“五口人”。',
    explanationEn: 'The question asks "How many people in your family?". Correct answer: C.',
    isExpressSelected: true
  },
  {
    id: 5,
    level: 'HSK 1',
    section: 'listening',
    format: 'pinyin_options',
    pageHeader: '第 4～5 题 ★',
    spokenScript: '你坐哪儿？',
    audioStartSec: 88,
    audioEndSec: 104,
    options: [
      { id: 'A', pinyin: 'qiánbian', text: '前边', isCorrect: true },
      { id: 'B', pinyin: 'zuò fàn', text: '做 饭', isCorrect: false },
      { id: 'C', pinyin: 'bú kèqi', text: '不 客气', isCorrect: false }
    ],
    explanationZh: '录音问“你坐哪儿？”，询问方位，答案为“前边”。',
    explanationEn: 'The question asks "Where are you sitting?". Correct answer: A (前边).'
  },

  // --- Page 3: 第 6～7 题 ★ Dialogue Questions ---
  {
    id: 6,
    level: 'HSK 1',
    section: 'listening',
    format: 'pinyin_options',
    pageHeader: '第 6～7 题 ★',
    example: {
      textPinyin: 'Xiàwǔ wǒ qù chāoshì , wǒ xiǎng mǎi yīxiē shuǐguǒ\n问：说话的人下午去哪里了？',
      textZh: '例如： 下午 我 去 超市 ， 我 想买一些水果',
      answerKey: 'A'
    },
    promptPinyin: '',
    promptText: '',
    spokenScript: '小张生病了，今天没来公司。\n问：小张怎么了？',
    audioStartSec: 109,
    audioEndSec: 142,
    options: [
      { id: 'A', pinyin: 'bìng le', text: '病 了', isCorrect: true },
      { id: 'B', pinyin: 'méi lái shàngxué', text: '没 来 上学', isCorrect: false },
      { id: 'C', pinyin: 'bù xiǎng shuìjiào', text: '不 想 睡觉', isCorrect: false }
    ],
    explanationZh: '录音明确指出“小张生病了”，故答案选 A。',
    explanationEn: 'The speaker states "小张生病了 (Xiao Zhang fell ill)". Correct answer: A.'
  },
  {
    id: 7,
    level: 'HSK 1',
    section: 'listening',
    format: 'pinyin_options',
    pageHeader: '第 6～7 题 ★',
    promptPinyin: '',
    promptText: '',
    spokenScript: '喂，您好，是王月女士吗？\n问：说话人正在做什么？',
    audioStartSec: 144,
    audioEndSec: 172,
    options: [
      { id: 'A', pinyin: 'mài chē', text: '卖 车', isCorrect: false },
      { id: 'B', pinyin: 'dǎ diànhuà', text: '打 电话', isCorrect: true },
      { id: 'C', pinyin: 'zhǎo shǒujī', text: '找 手机', isCorrect: false }
    ],
    explanationZh: '以“喂，您好”开头是打电话的标准表达。',
    explanationEn: '"喂，您好" indicates making a phone call. Correct answer: B.'
  },

  // --- Page 4: 第 8～10 题 ★★ Image Selection with Situations ---
  {
    id: 8,
    level: 'HSK 2',
    section: 'listening',
    format: 'image_select',
    pageHeader: '第 8～10 题 ★★',
    example: {
      textPinyin: 'Nǐ xǐhuān shénme yùndòng?\nWǒ zuì xǐhuān tī zúqiú',
      textZh: '例如：男：你喜欢什么运动？\n女：我最喜欢踢足球',
      answerKey: 'D'
    },
    spokenScript: '女：你在笑什么呢？\n男：电视上的这个人太有意思了。',
    audioStartSec: 173,
    audioEndSec: 199,
    options: [
      { id: 'A', imageKey: 'hand_bottle', isCorrect: false },
      { id: 'B', imageKey: 'headache', isCorrect: false },
      { id: 'C', imageKey: 'driver_car_wave', isCorrect: false },
      { id: 'D', imageKey: 'soccer_girl', isCorrect: false },
      { id: 'E', imageKey: 'laughing_tv', isCorrect: true },
      { id: 'F', imageKey: 'boy_books', isCorrect: false }
    ],
    explanationZh: '男士说“电视上的这个人太有意思了”，对应靠在垫子上大笑的图片 E。',
    explanationEn: 'The man says "This person on TV is so funny", matching image E.',
    isExpressSelected: true
  },
  {
    id: 9,
    level: 'HSK 2',
    section: 'listening',
    format: 'image_select',
    pageHeader: '第 8～10 题 ★★',
    spokenScript: '男：给你水，要我帮你打开吗？\n女：谢谢，我自己来吧。',
    audioStartSec: 200,
    audioEndSec: 226,
    options: [
      { id: 'A', imageKey: 'hand_bottle', isCorrect: true },
      { id: 'B', imageKey: 'headache', isCorrect: false },
      { id: 'C', imageKey: 'driver_car_wave', isCorrect: false },
      { id: 'D', imageKey: 'soccer_girl', isCorrect: false },
      { id: 'E', imageKey: 'laughing_tv', isCorrect: false },
      { id: 'F', imageKey: 'boy_books', isCorrect: false }
    ],
    explanationZh: '男士问“给你水，要我帮你打开吗？”，对应手递矿泉水瓶的图片 A。',
    explanationEn: 'Dialogue is about handing a water bottle. Correct answer: A.'
  },
  {
    id: 10,
    level: 'HSK 2',
    section: 'listening',
    format: 'image_select',
    pageHeader: '第 8～10 题 ★★',
    spokenScript: '女：我走了，再见。\n男：下次见，开车慢点儿。',
    audioStartSec: 227,
    audioEndSec: 250,
    options: [
      { id: 'A', imageKey: 'hand_bottle', isCorrect: false },
      { id: 'B', imageKey: 'headache', isCorrect: false },
      { id: 'C', imageKey: 'driver_car_wave', isCorrect: true },
      { id: 'D', imageKey: 'soccer_girl', isCorrect: false },
      { id: 'E', imageKey: 'laughing_tv', isCorrect: false },
      { id: 'F', imageKey: 'boy_books', isCorrect: false }
    ],
    explanationZh: '男士嘱咐“下次见，开车慢点儿”，对应车内挥手告别的图片 C。',
    explanationEn: 'The man says "See you next time, drive carefully", matching image C.'
  },

  // --- Page 5: 第 11～13 题 ★★ Options with Pinyin ---
  {
    id: 11,
    level: 'HSK 2',
    section: 'listening',
    format: 'pinyin_options',
    pageHeader: '第 11～13 题 ★★',
    promptPinyin: '',
    promptText: '',
    spokenScript: '女：坐公交车去机场怎么样？\n男：还是坐地铁吧，比公交车快。\n问：男的准备怎么去机场？',
    audioStartSec: 256,
    audioEndSec: 298,
    options: [
      { id: 'A', pinyin: 'zuò dìtiě', text: '坐 地铁', isCorrect: true },
      { id: 'B', pinyin: 'zuò huǒchē', text: '坐 火车', isCorrect: false },
      { id: 'C', pinyin: 'zuò gōngjiāochē', text: '坐 公交车', isCorrect: false }
    ],
    explanationZh: '录音问“男的准备怎么去机场？”，男士回答“还是坐地铁吧，比公交车快”，故选 A。',
    explanationEn: 'Question asks how the man plans to go to the airport. He chooses the subway ("还是坐地铁吧"). Correct: A.',
    isExpressSelected: true
  },
  {
    id: 12,
    level: 'HSK 2',
    section: 'listening',
    format: 'pinyin_options',
    pageHeader: '第 11～13 题 ★★',
    promptPinyin: '',
    promptText: '',
    spokenScript: '男：您好，请问最近的洗手间在哪里？\n女：前面那个商场里就有。\n问：洗手间在哪儿？',
    audioStartSec: 299,
    audioEndSec: 339,
    options: [
      { id: 'A', pinyin: 'yīyuàn pángbiān', text: '医院 旁边', isCorrect: false },
      { id: 'B', pinyin: 'jiǔdiàn wàimiàn', text: '酒店 外面', isCorrect: false },
      { id: 'C', pinyin: 'shāngchǎng lǐmiàn', text: '商场 里面', isCorrect: true }
    ],
    explanationZh: '录音问“洗手间在哪儿？”，女士回答“前面那个商场里就有”，答案为 C。',
    explanationEn: 'Question asks where the restroom is. Woman answers "Inside the shopping mall ahead". Correct: C.'
  },
  {
    id: 13,
    level: 'HSK 2',
    section: 'listening',
    format: 'pinyin_options',
    pageHeader: '第 11～13 题 ★★',
    promptPinyin: '',
    promptText: '',
    spokenScript: '女：阴天了，可能要下雨。\n男：那我们快回家吧。\n问：现在天气怎么样？',
    audioStartSec: 340,
    audioEndSec: 374,
    options: [
      { id: 'A', pinyin: 'xià xuě le', text: '下雪 了', isCorrect: false },
      { id: 'B', pinyin: 'xià yǔ le', text: '下雨 了', isCorrect: false },
      { id: 'C', pinyin: 'yīn tiān le', text: '阴天 了', isCorrect: true }
    ],
    explanationZh: '录音问“现在天气怎么样？”，女士说“阴天了，可能要下雨”，当前天气是“阴天了”。',
    explanationEn: 'Question asks about the weather. The woman says "It has become overcast". Correct: C.'
  },

  // --- Page 6: 第 14～21 题 ★★★ Pure Hanzi, NO Pinyin (HSK 3 Official Standard) ---
  {
    id: 14,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    example: {
      textZh: '例如： 女： 我需要搬一些椅子到楼上办公室， 你能来帮忙吗？\n男： 没问题， 我再叫几个人来帮你。\n问： 他们要把椅子搬到哪儿？',
      answerKey: 'B'
    },
    promptText: '',
    spokenScript: '男：你准备在晚会上表演什么节目？\n女：我打算讲个故事。\n问：女的要表演什么？',
    audioStartSec: 382,
    audioEndSec: 417,
    options: [
      { id: 'A', text: '跳舞', isCorrect: false },
      { id: 'B', text: '讲故事', isCorrect: true },
      { id: 'C', text: '唱中文歌', isCorrect: false }
    ],
    explanationZh: '录音问“女的要表演什么？”，女士回答“我打算讲个故事”，正确答案选 B。',
    explanationEn: 'Question asks what the woman plans to perform. She replies "I plan to tell a story". Correct answer: B.',
    isExpressSelected: true
  },
  {
    id: 15,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    promptText: '',
    spokenScript: '女：你最近在忙什么？\n男：我奶奶住院了，我每天一下班就去医院照顾她。\n问：男的的奶奶怎么了？',
    audioStartSec: 418,
    audioEndSec: 457,
    options: [
      { id: 'A', text: '住院了', isCorrect: true },
      { id: 'B', text: '变胖了', isCorrect: false },
      { id: 'C', text: '太累了', isCorrect: false }
    ],
    explanationZh: '录音问“男的的奶奶怎么了？”，男士说明“我奶奶住院了”，选 A。',
    explanationEn: 'Question asks what happened to the grandmother. He states she was hospitalized. Correct: A.'
  },
  {
    id: 16,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    promptText: '',
    spokenScript: '男：十点一刻了，该睡觉了，别打游戏了。\n女：我再玩五分钟就睡。\n问：现在几点了？',
    audioStartSec: 458,
    audioEndSec: 493,
    options: [
      { id: 'A', text: '9:05', isCorrect: false },
      { id: 'B', text: '10:15', isCorrect: true },
      { id: 'C', text: '10:30', isCorrect: false }
    ],
    explanationZh: '录音问“现在几点了？”，“十点一刻”为 10 点 15 分，选 B。',
    explanationEn: 'Question asks what time it is. "十点一刻" means 10:15. Correct answer: B.',
    isExpressSelected: true
  },
  {
    id: 17,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    promptText: '',
    spokenScript: '女：奇怪，我的笔记本电脑突然不能开机了。\n男：是不是没电了？\n问：女的遇到了什么问题？',
    audioStartSec: 494,
    audioEndSec: 534,
    options: [
      { id: 'A', text: '手表坏了', isCorrect: false },
      { id: 'B', text: '书包丢了', isCorrect: false },
      { id: 'C', text: '电脑不能开机', isCorrect: true }
    ],
    explanationZh: '录音问“女的遇到了什么问题？”，女士说“笔记本电脑突然不能开机了”，答案选 C。',
    explanationEn: 'Question asks what problem she had. She says her laptop cannot turn on. Correct: C.'
  },
  {
    id: 18,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    promptText: '',
    spokenScript: '同学们，这个题其实挺简单的，大家先看清楚要求再做。\n问：说话人让同学们怎么做？',
    audioStartSec: 535,
    audioEndSec: 574,
    options: [
      { id: 'A', text: '不做难题', isCorrect: false },
      { id: 'B', text: '复习汉字', isCorrect: false },
      { id: 'C', text: '看清楚要求', isCorrect: true }
    ],
    explanationZh: '录音问“说话人让同学们怎么做？”，提示“大家先看清楚要求再做”，答案选 C。',
    explanationEn: 'Question asks what the teacher asked students to do. Read requirements clearly first. Correct: C.'
  },
  {
    id: 19,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    promptText: '',
    spokenScript: '我在草地上发现了一只瘦瘦的小猫，它看上去很饿，我就给它拿了一些吃的。\n问：说话人在什么地方发现的小猫？',
    audioStartSec: 575,
    audioEndSec: 619,
    options: [
      { id: 'A', text: '河边', isCorrect: false },
      { id: 'B', text: '街上', isCorrect: false },
      { id: 'C', text: '草地上', isCorrect: true }
    ],
    explanationZh: '录音问“说话人在什么地方发现的小猫？”，“我在草地上发现了一只瘦瘦的小猫”，地点在草地上。',
    explanationEn: 'Question asks where the cat was found. On the grass ("在草地上"). Correct: C.'
  },
  {
    id: 20,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    promptText: '',
    spokenScript: '老李的生活习惯很不好，平时几乎不打扫自己的房间。\n问：关于老李，可以知道什么？',
    audioStartSec: 620,
    audioEndSec: 657,
    options: [
      { id: 'A', text: '习惯差', isCorrect: true },
      { id: 'B', text: '每晚扫地', isCorrect: false },
      { id: 'C', text: '正在洗碗', isCorrect: false }
    ],
    explanationZh: '录音问“关于老李，可以知道什么？”，录音说“老李的生活习惯很不好”，即习惯差。',
    explanationEn: 'Question asks about Lao Li. He has poor habits ("习惯差"). Correct: A.'
  },
  {
    id: 21,
    level: 'HSK 3',
    section: 'listening',
    format: 'pure_hanzi',
    pageHeader: '第 14～21 题 ★★★',
    promptText: '',
    spokenScript: '这里的夏天没那么热，春天和秋天很凉快，冬天也不太冷，一年四季都很舒服。\n问：那里秋季的天气怎么样？',
    audioStartSec: 658,
    audioEndSec: 700,
    options: [
      { id: 'A', text: '凉快', isCorrect: true },
      { id: 'B', text: '刮大风', isCorrect: false },
      { id: 'C', text: '晴天少', isCorrect: false }
    ],
    explanationZh: '录音问“那里秋季的天气怎么样？”，“春天和秋天很凉快”，故秋季凉快。',
    explanationEn: 'Question asks about autumn weather. It is pleasant and cool ("凉快"). Correct: A.'
  },

  // =================== PART 2: 阅读 (READING 21 QUESTIONS) ===================
  // --- Page 7: 第 22～25 题 ★ Reading Image Match ---
  {
    id: 22,
    level: 'HSK 1',
    section: 'reading',
    format: 'image_select',
    pageHeader: '二、阅 读\n第 22～25 题 ★',
    example: {
      textPinyin: 'Wǒ hěn xǐhuan zhè běn shū .',
      textZh: '例如： 我 很 喜欢 这 本 书。',
      answerKey: 'E'
    },
    promptPinyin: 'Wáng xiānsheng， zàijiàn．',
    promptText: '22． 王 先生 ，再见。',
    options: [
      { id: 'A', imageKey: 'guitar_boy', isCorrect: false },
      { id: 'B', imageKey: 'schoolgirl', isCorrect: false },
      { id: 'C', imageKey: 'umbrella', isCorrect: false },
      { id: 'D', imageKey: 'eggs_milk', isCorrect: false },
      { id: 'E', imageKey: 'reading_chair', isCorrect: false },
      { id: 'F', imageKey: 'two_men_waving', isCorrect: true }
    ],
    explanationZh: '“王先生，再见”对应两位商务男士挥手告别的图片 F。',
    explanationEn: 'Waving goodbye matches image F.'
  },
  {
    id: 23,
    level: 'HSK 1',
    section: 'reading',
    format: 'image_select',
    pageHeader: '二、阅 读\n第 22～25 题 ★',
    promptPinyin: 'Dìdi hěn ài chàng gē .',
    promptText: '23． 弟弟 很 爱 唱 歌。',
    options: [
      { id: 'A', imageKey: 'guitar_boy', isCorrect: true },
      { id: 'B', imageKey: 'schoolgirl', isCorrect: false },
      { id: 'C', imageKey: 'umbrella', isCorrect: false },
      { id: 'D', imageKey: 'eggs_milk', isCorrect: false },
      { id: 'E', imageKey: 'reading_chair', isCorrect: false },
      { id: 'F', imageKey: 'two_men_waving', isCorrect: false }
    ],
    explanationZh: '“弟弟很爱唱歌”对应弹吉他唱歌的男生图片 A。',
    explanationEn: 'Singing with guitar matches image A.'
  },
  {
    id: 24,
    level: 'HSK 1',
    section: 'reading',
    format: 'image_select',
    pageHeader: '二、阅 读\n第 22～25 题 ★',
    promptPinyin: 'Zǎofàn chī jīdàn hé niúnǎi， zěnmeyàng？',
    promptText: '24． 早饭 吃 鸡蛋 和 牛奶，怎么样 ？',
    options: [
      { id: 'A', imageKey: 'guitar_boy', isCorrect: false },
      { id: 'B', imageKey: 'schoolgirl', isCorrect: false },
      { id: 'C', imageKey: 'umbrella', isCorrect: false },
      { id: 'D', imageKey: 'eggs_milk', isCorrect: true },
      { id: 'E', imageKey: 'reading_chair', isCorrect: false },
      { id: 'F', imageKey: 'two_men_waving', isCorrect: false }
    ],
    explanationZh: '“早饭吃鸡蛋和牛奶”对应杯子与鸡蛋的图片 D。',
    explanationEn: 'Breakfast with milk & eggs matches image D.'
  },
  {
    id: 25,
    level: 'HSK 1',
    section: 'reading',
    format: 'image_select',
    pageHeader: '二、阅 读\n第 22～25 题 ★',
    promptPinyin: 'Jīntiān shì mèimei shàng xiǎoxué de dì-yī tiān.',
    promptText: '25． 今天 是 妹妹 上 小学 的 第一天。',
    options: [
      { id: 'A', imageKey: 'guitar_boy', isCorrect: false },
      { id: 'B', imageKey: 'schoolgirl', isCorrect: true },
      { id: 'C', imageKey: 'umbrella', isCorrect: false },
      { id: 'D', imageKey: 'eggs_milk', isCorrect: false },
      { id: 'E', imageKey: 'reading_chair', isCorrect: false },
      { id: 'F', imageKey: 'two_men_waving', isCorrect: false }
    ],
    explanationZh: '妹妹上小学第一天，对应背着书包上学的小女孩图片 B。',
    explanationEn: 'First day of school matches schoolgirl image B.'
  },

  // --- Page 8: 第 26～29 题 ★ Word Bank Selection ---
  {
    id: 26,
    level: 'HSK 1',
    section: 'reading',
    format: 'word_bank',
    pageHeader: '第 26～29 题 ★',
    wordBank: [
      { id: 'A', pinyin: 'shàngwǔ', text: '上午' },
      { id: 'B', pinyin: 'piàoliang', text: '漂亮' },
      { id: 'C', pinyin: 'xiūxi', text: '休息' },
      { id: 'D', pinyin: 'jiào', text: '叫' },
      { id: 'E', pinyin: 'shì', text: '事' },
      { id: 'F', pinyin: 'hěn', text: '很' }
    ],
    promptPinyin: 'Jīntiān shūdiàn li yǒu duō xiǎopéngyǒu．',
    promptText: '26． 今天 书店 里 有 （ ） 多 小朋友 。',
    options: [
      { id: 'A', text: '上午', pinyin: 'shàngwǔ', isCorrect: false },
      { id: 'B', text: '漂亮', pinyin: 'piàoliang', isCorrect: false },
      { id: 'C', text: '休息', pinyin: 'xiūxi', isCorrect: false },
      { id: 'D', text: '叫', pinyin: 'jiào', isCorrect: false },
      { id: 'E', text: '事', pinyin: 'shì', isCorrect: false },
      { id: 'F', text: '很', pinyin: 'hěn', isCorrect: true }
    ],
    explanationZh: '“很多”为常用搭配，选 F（很）。',
    explanationEn: '"很多" means many. Correct: F.',
    isExpressSelected: true
  },
  {
    id: 27,
    level: 'HSK 1',
    section: 'reading',
    format: 'word_bank',
    pageHeader: '第 26～29 题 ★',
    wordBank: [
      { id: 'A', pinyin: 'shàngwǔ', text: '上午' },
      { id: 'B', pinyin: 'piàoliang', text: '漂亮' },
      { id: 'C', pinyin: 'xiūxi', text: '休息' },
      { id: 'D', pinyin: 'jiào', text: '叫' },
      { id: 'E', pinyin: 'shì', text: '事' },
      { id: 'F', pinyin: 'hěn', text: '很' }
    ],
    promptPinyin: 'Tāmen xuéle Zhōngwén．',
    promptText: '27． 他们 （ ） 学了 中文 。',
    options: [
      { id: 'A', text: '上午', pinyin: 'shàngwǔ', isCorrect: true },
      { id: 'B', text: '漂亮', pinyin: 'piàoliang', isCorrect: false },
      { id: 'C', text: '休息', pinyin: 'xiūxi', isCorrect: false },
      { id: 'D', text: '叫', pinyin: 'jiào', isCorrect: false },
      { id: 'E', text: '事', pinyin: 'shì', isCorrect: false },
      { id: 'F', text: '很', pinyin: 'hěn', isCorrect: false }
    ],
    explanationZh: '时间状语置于动词前，“上午学了中文”，选 A。',
    explanationEn: 'Time adverb: "上午 (morning)". Correct: A.'
  },
  {
    id: 28,
    level: 'HSK 1',
    section: 'reading',
    format: 'word_bank',
    pageHeader: '第 26～29 题 ★',
    wordBank: [
      { id: 'A', pinyin: 'shàngwǔ', text: '上午' },
      { id: 'B', pinyin: 'piàoliang', text: '漂亮' },
      { id: 'C', pinyin: 'xiūxi', text: '休息' },
      { id: 'D', pinyin: 'jiào', text: '叫' },
      { id: 'E', pinyin: 'shì', text: '事' },
      { id: 'F', pinyin: 'hěn', text: '很' }
    ],
    promptPinyin: 'Wǒ juéde dì-èr gè bēizi mǎi nàge ba．',
    promptText: '28． 我 觉得 第二 个 杯子 （ ）， 买 那个 吧。',
    options: [
      { id: 'A', text: '上午', pinyin: 'shàngwǔ', isCorrect: false },
      { id: 'B', text: '漂亮', pinyin: 'piàoliang', isCorrect: true },
      { id: 'C', text: '休息', pinyin: 'xiūxi', isCorrect: false },
      { id: 'D', text: '叫', pinyin: 'jiào', isCorrect: false },
      { id: 'E', text: '事', pinyin: 'shì', isCorrect: false },
      { id: 'F', text: '很', pinyin: 'hěn', isCorrect: false }
    ],
    explanationZh: '作形容词谓语评价杯子，“漂亮”，选 B。',
    explanationEn: '"杯子漂亮 (cup is pretty)". Correct: B.'
  },
  {
    id: 29,
    level: 'HSK 1',
    section: 'reading',
    format: 'word_bank',
    pageHeader: '第 26～29 题 ★',
    wordBank: [
      { id: 'A', pinyin: 'shàngwǔ', text: '上午' },
      { id: 'B', pinyin: 'piàoliang', text: '漂亮' },
      { id: 'C', pinyin: 'xiūxi', text: '休息' },
      { id: 'D', pinyin: 'jiào', text: '叫' },
      { id: 'E', pinyin: 'shì', text: '事' },
      { id: 'F', pinyin: 'hěn', text: '很' }
    ],
    promptPinyin: 'Xiàkè , tóngxuémen y íxià .',
    promptText: '29． 下课， 同学们 （ ） 一下。',
    options: [
      { id: 'A', text: '上午', pinyin: 'shàngwǔ', isCorrect: false },
      { id: 'B', text: '漂亮', pinyin: 'piàoliang', isCorrect: false },
      { id: 'C', text: '休息', pinyin: 'xiūxi', isCorrect: true },
      { id: 'D', text: '叫', pinyin: 'jiào', isCorrect: false },
      { id: 'E', text: '事', pinyin: 'shì', isCorrect: false },
      { id: 'F', text: '很', pinyin: 'hěn', isCorrect: false }
    ],
    explanationZh: '下课后动词搭配“休息一下”，选 C。',
    explanationEn: '"休息一下 (take a rest)". Correct: C.'
  },

  // --- Page 8: 第 30～32 题 ★★ Dialogue Logic with Pinyin ---
  {
    id: 30,
    level: 'HSK 2',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 30～32 题 ★★',
    promptPinyin: 'Suīrán wǒ shì wàiguó rén, dàn wǒ yǒu yīgè zhōngwén míngzì',
    promptText: '30. 虽然我是外国人，但我有一个中文名字',
    options: [
      { id: 'B', pinyin: 'Wǒ xìng gāo, wǒ jiào gāo hànwén', text: 'B. 我 姓 高，我叫 高 汉文', isCorrect: true },
      { id: 'A', pinyin: 'Shéi zài wàimiàn？ Zě nme bú jìnlái ？', text: 'A. 谁 在 外面 ？怎么 不 进来？', isCorrect: false },
      { id: 'C', pinyin: 'Suǒyǐ xiànzài hái bùnéng zhù', text: 'C. 所以 现在 还不能 住', isCorrect: false }
    ],
    explanationZh: '提到中文名字，接“我姓高，我叫高汉文”，选 B。',
    explanationEn: 'Matches Chinese name introduction B.',
    isExpressSelected: true
  },
  {
    id: 31,
    level: 'HSK 2',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 30～32 题 ★★',
    promptPinyin: 'Shì wǒ , bāng wǒ kā i y íxià mén．',
    promptText: '31．是 我， 帮 我 开 一下 门 。',
    options: [
      { id: 'A', pinyin: 'Shéi zài wàimiàn？ Zě nme bú jìnlái ？', text: 'A. 谁 在 外面 ？怎么 不 进来？', isCorrect: true },
      { id: 'B', pinyin: 'Wǒ xìng gāo, wǒ jiào gāo hànwén', text: 'B. 我 姓 高，我叫 高 汉文', isCorrect: false },
      { id: 'C', pinyin: 'Suǒyǐ xiànzài hái bùnéng zhù', text: 'C. 所以 现在 还不能 住', isCorrect: false }
    ],
    explanationZh: '开门应答对应提问“谁在外面？怎么不进来？”，选 A。',
    explanationEn: 'Answers "Who is outside?". Correct: A.'
  },
  {
    id: 32,
    level: 'HSK 2',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 30～32 题 ★★',
    promptPinyin: 'Zhège fángjiān yǒu zhuō yǐ, dàn hái méiyǒu chuáng',
    promptText: '32. 这个 房间 有 桌椅，但 还 没有 床。',
    options: [
      { id: 'C', pinyin: 'Suǒyǐ xiànzài hái bùnéng zhù', text: 'C. 所以 现在 还不能 住', isCorrect: true },
      { id: 'A', pinyin: 'Shéi zài wàimiàn？ Zě nme bú jìnlái ？', text: 'A. 谁 在 外面 ？怎么 不 进来？', isCorrect: false },
      { id: 'B', pinyin: 'Wǒ xìng gāo, wǒ jiào gāo hànwén', text: 'B. 我 姓 高，我叫 高 汉文', isCorrect: false }
    ],
    explanationZh: '没有床所以还不能住，因果承接，选 C。',
    explanationEn: 'No bed implies cannot live in yet. Correct: C.'
  },

  // --- Page 9: 第 33～35 题 ★★ Word Bank with Pinyin ---
  {
    id: 33,
    level: 'HSK 2',
    section: 'reading',
    format: 'word_bank',
    pageHeader: '第 33～35 题 ★★',
    wordBank: [
      { id: 'A', pinyin: 'gēn', text: '跟' },
      { id: 'B', pinyin: 'dǎchē', text: '打车' },
      { id: 'C', pinyin: 'cóngxiǎo', text: '从小' },
      { id: 'D', pinyin: 'lóu', text: '楼' },
      { id: 'E', pinyin: 'duō', text: '多' },
      { id: 'F', pinyin: 'yuǎn', text: '远' }
    ],
    promptPinyin: 'Tā jiù ài yùndòng．',
    promptText: '33． 他 （ ） 就 爱 运动 。',
    options: [
      { id: 'C', text: '从小', pinyin: 'cóngxiǎo', isCorrect: true },
      { id: 'A', text: '跟', pinyin: 'gēn', isCorrect: false },
      { id: 'B', text: '打车', pinyin: 'dǎchē', isCorrect: false }
    ],
    explanationZh: '“从小就爱运动”，选 C。',
    explanationEn: '"从小就爱运动" (loved sports since childhood). Correct: C.'
  },
  {
    id: 34,
    level: 'HSK 2',
    section: 'reading',
    format: 'word_bank',
    pageHeader: '第 33～35 题 ★★',
    wordBank: [
      { id: 'A', pinyin: 'gēn', text: '跟' },
      { id: 'B', pinyin: 'dǎchē', text: '打车' },
      { id: 'C', pinyin: 'cóngxiǎo', text: '从小' },
      { id: 'D', pinyin: 'lóu', text: '楼' },
      { id: 'E', pinyin: 'duō', text: '多' },
      { id: 'F', pinyin: 'yuǎn', text: '远' }
    ],
    promptPinyin: 'Zhōngguó zěnmeyàng？ Kuài wǒ shuōshuo．',
    promptText: '34． 中国 怎么样 ？ 快 （ ） 我 说说 。',
    options: [
      { id: 'A', text: '跟', pinyin: 'gēn', isCorrect: true },
      { id: 'B', text: '打车', pinyin: 'dǎchē', isCorrect: false },
      { id: 'D', text: '楼', pinyin: 'lóu', isCorrect: false }
    ],
    explanationZh: '介词“跟我说说”，选 A。',
    explanationEn: 'Preposition "跟" (跟我说说). Correct: A.'
  },
  {
    id: 35,
    level: 'HSK 2',
    section: 'reading',
    format: 'word_bank',
    pageHeader: '第 33～35 题 ★★',
    wordBank: [
      { id: 'A', pinyin: 'gēn', text: '跟' },
      { id: 'B', pinyin: 'dǎchē', text: '打车' },
      { id: 'C', pinyin: 'cóngxiǎo', text: '从小' },
      { id: 'D', pinyin: 'lóu', text: '楼' },
      { id: 'E', pinyin: 'duō', text: '多' },
      { id: 'F', pinyin: 'yuǎn', text: '远' }
    ],
    promptPinyin: 'Nǐ chūláile ma？ Wǒ dào xià le ．',
    promptText: '35． 你 出来了 吗？ 我 到 （ ） 下 了。',
    options: [
      { id: 'D', text: '楼', pinyin: 'lóu', isCorrect: true },
      { id: 'B', text: '打车', pinyin: 'dǎchē', isCorrect: false },
      { id: 'F', text: '远', pinyin: 'yuǎn', isCorrect: false }
    ],
    explanationZh: '“到楼下了”，选 D。',
    explanationEn: '"到楼下了" (arrived downstairs). Correct: D.'
  },

  // --- Page 9: 第 36～40 题 ★★★ Pure Hanzi Match (HSK 3 Official) ---
  {
    id: 36,
    level: 'HSK 3',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 36～40 题 ★★★',
    promptText: '36． 没问题， 有不明白的问我就行。',
    options: [
      { id: 'A', text: 'A. 您好！ 我是李冰， 是您妻子的同事。', isCorrect: false },
      { id: 'B', text: 'B. 八元五角。 要不要来点儿？', isCorrect: false },
      { id: 'C', text: 'C. 经理怎么不在办公室？', isCorrect: false },
      { id: 'D', text: 'D. 你到哪儿了？ 表演快开始了。', isCorrect: false },
      { id: 'E', text: 'E. 我上节数学课没来， 能看看你的笔记吗？ 明天还你。', isCorrect: true },
      { id: 'F', text: 'F. 谢谢你告诉我这个好消息， 我马上过去。', isCorrect: false }
    ],
    explanationZh: '“没问题，有不明白的问我就行”对应“我上节数学课没来，能看看你的笔记吗？明天还你”，选 E。',
    explanationEn: 'Math notes borrow request matches E.',
    isExpressSelected: true
  },
  {
    id: 37,
    level: 'HSK 3',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 36～40 题 ★★★',
    promptText: '37． 这位是我爱人张南， 他在图书馆上班。',
    options: [
      { id: 'A', text: 'A. 您好！ 我是李冰， 是您妻子的同事。', isCorrect: true },
      { id: 'B', text: 'B. 八元五角。 要不要来点儿？', isCorrect: false },
      { id: 'C', text: 'C. 经理怎么不在办公室？', isCorrect: false },
      { id: 'D', text: 'D. 你到哪儿了？ 表演快开始了。', isCorrect: false },
      { id: 'E', text: 'E. 我上节数学课没来， 能看看你的笔记吗？ 明天还你。', isCorrect: false },
      { id: 'F', text: 'F. 谢谢你告诉我这个好消息， 我马上过去。', isCorrect: false }
    ],
    explanationZh: '介绍爱人张南对应同事问候，选 A。',
    explanationEn: 'Introducing spouse matches A.'
  },
  {
    id: 38,
    level: 'HSK 3',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 36～40 题 ★★★',
    promptText: '38． 他休假了， 你有事可以给他发邮件。',
    options: [
      { id: 'A', text: 'A. 您好！ 我是李冰， 是您妻子的同事。', isCorrect: false },
      { id: 'B', text: 'B. 八元五角。 要不要来点儿？', isCorrect: false },
      { id: 'C', text: 'C. 经理怎么不在办公室？', isCorrect: true },
      { id: 'D', text: 'D. 你到哪儿了？ 表演快开始了。', isCorrect: false },
      { id: 'E', text: 'E. 我上节数学课没来， 能看看你的笔记吗？ 明天还你。', isCorrect: false },
      { id: 'F', text: 'F. 谢谢你告诉我这个好消息， 我马上过去。', isCorrect: false }
    ],
    explanationZh: '询问经理不在办公室，选 C。',
    explanationEn: 'Manager absent inquiry matches C.'
  },
  {
    id: 39,
    level: 'HSK 3',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 36～40 题 ★★★',
    promptText: '39． 别急， 我已经上电梯了。',
    options: [
      { id: 'A', text: 'A. 您好！ 我是李冰， 是您妻子的同事。', isCorrect: false },
      { id: 'B', text: 'B. 八元五角。 要不要来点儿？', isCorrect: false },
      { id: 'C', text: 'C. 经理怎么不在办公室？', isCorrect: false },
      { id: 'D', text: 'D. 你到哪儿了？ 表演快开始了。', isCorrect: true },
      { id: 'E', text: 'E. 我上节数学课没来， 能看看你的笔记吗？ 明天还你。', isCorrect: false },
      { id: 'F', text: 'F. 谢谢你告诉我这个好消息， 我马上过去。', isCorrect: false }
    ],
    explanationZh: '催促快开始对应上电梯，选 D。',
    explanationEn: 'Urging about performance matches D.'
  },
  {
    id: 40,
    level: 'HSK 3',
    section: 'reading',
    format: 'sentence_match',
    pageHeader: '第 36～40 题 ★★★',
    promptText: '40． 请问香蕉多少钱一公斤?',
    options: [
      { id: 'A', text: 'A. 您好！ 我是李冰， 是您妻子的同事。', isCorrect: false },
      { id: 'B', text: 'B. 八元五角。 要不要来点儿？', isCorrect: true },
      { id: 'C', text: 'C. 经理怎么不在办公室？', isCorrect: false },
      { id: 'D', text: 'D. 你到哪儿了？ 表演快开始了。', isCorrect: false },
      { id: 'E', text: 'E. 我上节数学课没来， 能看看你的笔记吗？ 明天还你。', isCorrect: false },
      { id: 'F', text: 'F. 谢谢你告诉我这个好消息， 我马上过去。', isCorrect: false }
    ],
    explanationZh: '问水果价格对应“八元五角”，选 B。',
    explanationEn: 'Fruit price inquiry matches B.'
  },

  // --- Page 10: 第 41～42 题 ★★ Reading Passages (Pure Hanzi) ---
  {
    id: 41,
    level: 'HSK 2',
    section: 'reading',
    format: 'passage_comprehension',
    pageHeader: '第 41～42 题 ★★',
    promptText: '41．小海刚来中国生活， 除了我以外， 没什么认识的人。 快要到春节了， 我想请他来咱们家过节， 一起包饺子、 看电视。\n\n★ 小海：',
    options: [
      { id: 'A', text: 'A. 是游客', isCorrect: false },
      { id: 'B', text: 'B. 打算请客', isCorrect: false },
      { id: 'C', text: 'C. 来中国不久', isCorrect: true }
    ],
    explanationZh: '“小海刚来中国生活”，即来中国不久，选 C。',
    explanationEn: 'Xiao Hai came to China recently. Correct: C.',
    isExpressSelected: true
  },
  {
    id: 42,
    level: 'HSK 2',
    section: 'reading',
    format: 'passage_comprehension',
    pageHeader: '第 41～42 题 ★★',
    promptText: '42． 难过的时候， 我会选择做一些运动， 比如出去跑跑步、 骑会儿车。 每次不需要锻炼太久， 只要让身体动起来， 我心里就会觉得舒服很多。\n\n★ 他难过时会怎么做？',
    options: [
      { id: 'A', text: 'A. 笑一笑', isCorrect: false },
      { id: 'B', text: 'B. 锻炼身体', isCorrect: true },
      { id: 'C', text: 'C. 喝几瓶饮料', isCorrect: false }
    ],
    explanationZh: '“做一些运动，比如跑步、骑车”，即锻炼身体，选 B。',
    explanationEn: 'Exercise when sad. Correct: B.'
  },

  // =================== PART 3: 书写 (WRITING 8 QUESTIONS) ===================
  // --- Page 11: 第 43～45 题 ★★ Pinyin + Hanzi ---
  {
    id: 43,
    level: 'HSK 2',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '三、书 写\n第 43～45 题 ★★',
    promptPinyin: 'Wǒ hái zài lùshang， wǒ ( de ) chē huài le．',
    promptText: '43． 我 还 在 路上 ，我 （ ）车 坏 了。',
    options: [
      { id: 'A', text: '的', pinyin: 'de', isCorrect: true },
      { id: 'B', text: '得', pinyin: 'de', isCorrect: false },
      { id: 'C', text: '地', pinyin: 'de', isCorrect: false }
    ],
    explanationZh: '定语修饰名词“我的车”，选“的”。',
    explanationEn: 'Possessive particle "的". Correct: A.'
  },
  {
    id: 44,
    level: 'HSK 2',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '第 43～45 题 ★★',
    promptPinyin: 'Nǐ ( kě ) yǐ zài wǎng shang mǎi jīpiào．',
    promptText: '44． 你 （ ） 以 在 网 上 买 机票。',
    options: [
      { id: 'A', text: '可', pinyin: 'kě', isCorrect: true },
      { id: 'B', text: '渴', pinyin: 'kě', isCorrect: false },
      { id: 'C', text: '课', pinyin: 'kè', isCorrect: false }
    ],
    explanationZh: '“可以”表示许可，汉字为“可”。',
    explanationEn: '"可以" (can/may). Correct: A (可).'
  },
  {
    id: 45,
    level: 'HSK 2',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '第 43～45 题 ★★',
    promptPinyin: 'Wǒ bùhǎo ( yì ) si ràng péngyou bāngmáng．',
    promptText: '45． 我 不好 （ ） 思 让 朋友 帮忙。',
    options: [
      { id: 'A', text: '意', pinyin: 'yì', isCorrect: true },
      { id: 'B', text: '易', pinyin: 'yì', isCorrect: false },
      { id: 'C', text: '忆', pinyin: 'yì', isCorrect: false }
    ],
    explanationZh: '“不好意思”，汉字为“意”。',
    explanationEn: '"不好意思" (feel embarrassed). Correct: A (意).'
  },

  // --- Page 11: 第 46～50 题 ★★★ Pinyin Pronunciation on top, pure Hanzi ---
  {
    id: 46,
    level: 'HSK 3',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '第 46～50 题 ★★★',
    promptPinyin: 'fāng',
    promptText: '46． 听说这些鸟是从北 （ ） 飞过来的。',
    options: [
      { id: 'A', text: '方', isCorrect: true },
      { id: 'B', text: '房', isCorrect: false },
      { id: 'C', text: '放', isCorrect: false }
    ],
    explanationZh: '“北方”，选“方”。',
    explanationEn: '"北方" (the North). Correct: A (方).'
  },
  {
    id: 47,
    level: 'HSK 3',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '第 46～50 题 ★★★',
    promptPinyin: 'gāi',
    promptText: '47． 没有经过我的同意， 你不 （ ） 动我的东西。',
    options: [
      { id: 'A', text: '该', isCorrect: true },
      { id: 'B', text: '改', isCorrect: false },
      { id: 'C', text: '概', isCorrect: false }
    ],
    explanationZh: '“不该”表示不应当，选“该”。',
    explanationEn: '"不该" (should not). Correct: A (该).'
  },
  {
    id: 48,
    level: 'HSK 3',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '第 46～50 题 ★★★',
    promptPinyin: 'máo',
    promptText: '48． 这里一个鸡蛋只要八 （ ） 钱。',
    options: [
      { id: 'A', text: '毛', isCorrect: true },
      { id: 'B', text: '猫', isCorrect: false },
      { id: 'C', text: '帽', isCorrect: false }
    ],
    explanationZh: '“八毛钱”，选“毛”。',
    explanationEn: '"八毛钱" (0.8 yuan). Correct: A (毛).'
  },
  {
    id: 49,
    level: 'HSK 3',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '第 46～50 题 ★★★',
    promptPinyin: 'chéng',
    promptText: '49． 小东这次中文考试考了第一， （ ） 绩比上次高十分。',
    options: [
      { id: 'A', text: '成', isCorrect: true },
      { id: 'B', text: '城', isCorrect: false },
      { id: 'C', text: '诚', isCorrect: false }
    ],
    explanationZh: '“成绩”，选“成”。',
    explanationEn: '"成绩" (grades/achievement). Correct: A (成).'
  },
  {
    id: 50,
    level: 'HSK 3',
    section: 'writing',
    format: 'writing_pinyin',
    pageHeader: '第 46～50 题 ★★★',
    promptPinyin: 'fǎ',
    promptText: '50． 牛先生认为这个办 （ ） 不能解决问题。',
    options: [
      { id: 'A', text: '法', isCorrect: true },
      { id: 'B', text: '发', isCorrect: false },
      { id: 'C', text: '伐', isCorrect: false }
    ],
    explanationZh: '“办法”，选“法”。',
    explanationEn: '"办法" (method/solution). Correct: A (法).'
  }
];

export function getExamQuestions(mode: 'express' | 'full' = 'express'): RealHskQuestion[] {
  if (mode === 'express') {
    return OFFICIAL_HSK_EXAM.filter(q => q.isExpressSelected);
  }
  return OFFICIAL_HSK_EXAM;
}

export function evaluateOfficialHskScore(
  answers: Record<number, string>,
  questions: RealHskQuestion[]
): {
  totalScore: number;
  totalQuestions: number;
  hsk1Correct: number;
  hsk1Total: number;
  hsk2Correct: number;
  hsk2Total: number;
  hsk3Correct: number;
  hsk3Total: number;
  levelConfirmed: 'HSK 3+' | 'HSK 2' | 'HSK 1' | 'Below HSK 1';
  passStandards: {
    passHsk1: boolean;
    passHsk2: boolean;
    passHsk3: boolean;
  };
  recommendationZh: string;
  recommendationEn: string;
  targetTrack: string;
} {
  let hsk1Correct = 0;
  let hsk1Total = 0;
  let hsk2Correct = 0;
  let hsk2Total = 0;
  let hsk3Correct = 0;
  let hsk3Total = 0;
  let totalScore = 0;

  questions.forEach(q => {
    const isL1 = q.level === 'HSK 1';
    const isL2 = q.level === 'HSK 2';
    const isL3 = q.level === 'HSK 3';

    if (isL1) hsk1Total++;
    if (isL2) hsk2Total++;
    if (isL3) hsk3Total++;

    const chosen = answers[q.id];
    const correctOpt = q.options.find(o => o.isCorrect);
    if (chosen && correctOpt && chosen === correctOpt.id) {
      totalScore += 2;
      if (isL1) hsk1Correct++;
      if (isL2) hsk2Correct++;
      if (isL3) hsk3Correct++;
    }
  });

  const totalQuestions = questions.length;

  const hsk1Rate = hsk1Total > 0 ? hsk1Correct / hsk1Total : 0;
  const hsk2Rate = hsk2Total > 0 ? hsk2Correct / hsk2Total : 0;
  const hsk3Rate = hsk3Total > 0 ? hsk3Correct / hsk3Total : 0;

  const passHsk1 = hsk1Rate >= 0.7;
  const passHsk2 = hsk1Rate >= 0.8 && hsk2Rate >= 0.7;
  const passHsk3 = hsk1Rate >= 0.8 && hsk2Rate >= 0.8 && hsk3Rate >= 0.7;

  let levelConfirmed: 'HSK 3+' | 'HSK 2' | 'HSK 1' | 'Below HSK 1' = 'Below HSK 1';
  let recommendationZh = '';
  let recommendationEn = '';
  let targetTrack = '';

  if (passHsk3) {
    levelConfirmed = 'HSK 3+';
    targetTrack = 'HSK 3-4 Advanced Business & University Scholarship Track';
    recommendationZh = '恭喜通过 HSK 3 级标准评测！您的听力与语境理解扎实，词汇量储备已达 600 词以上。建议直接入读【HSK 3-4 进阶中资经贸实战班】或申请【赴华留学全额奖学金】。';
    recommendationEn = 'Congratulations! You have passed the official HSK 3 standard. Your listening and contextual fluency exceed 600 words. Ready for the HSK 3-4 Advanced Business & University Scholarship Track.';
  } else if (passHsk2) {
    levelConfirmed = 'HSK 2';
    targetTrack = 'HSK 2-3 Intermediate Fluency Track';
    recommendationZh = '恭喜通过 HSK 2 级标准评测！您已掌握基础日常会话与 300+ 核心词汇，但在中长句子听力和复杂关联词上有提升空间。建议入读【HSK 2-3 强化突破班】。';
    recommendationEn = 'Congratulations! You have passed the HSK 2 standard (300+ words). Recommended for the HSK 2-3 Intermediate Fluency Track.';
  } else if (passHsk1) {
    levelConfirmed = 'HSK 1';
    targetTrack = 'HSK 1-2 Essential Grammar & Daily Speaking Track';
    recommendationZh = '恭喜通过 HSK 1 级基础评测！您掌握了约 150 个基础生存词汇。建议入读【HSK 1-2 进阶班】，夯实日常生存听说技能与语法骨架。';
    recommendationEn = 'Passed HSK 1 level (150 words). Recommended for the HSK 1-2 Essential Grammar & Daily Speaking Track.';
  } else {
    levelConfirmed = 'Below HSK 1';
    targetTrack = 'HSK 1 Starter & Practical Conversation Track';
    recommendationZh = '诊断显示您的中文处于零基础起步阶段。建议直接入读【HSK 1 零基础启航课】，从拼音声调、常用生存口语与汉字基础系统学起。';
    recommendationEn = 'Diagnosis shows you are at complete beginner stage. Recommended to start with the HSK 1 Starter & Practical Conversation Track.';
  }

  return {
    totalScore,
    totalQuestions,
    hsk1Correct,
    hsk1Total,
    hsk2Correct,
    hsk2Total,
    hsk3Correct,
    hsk3Total,
    levelConfirmed,
    passStandards: { passHsk1, passHsk2, passHsk3 },
    recommendationZh,
    recommendationEn,
    targetTrack
  };
}
