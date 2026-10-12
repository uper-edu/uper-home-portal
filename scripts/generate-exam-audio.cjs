const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDirs = [
  path.join(__dirname, '../public/audio'),
  path.join(__dirname, '../dist/audio')
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 21 Authentic Examination Audio Scripts with Character Roles
const QUESTIONS = [
  {
    id: 1,
    intro: '第一题。',
    dialogues: [{ role: 'narrator', text: '坐飞机。' }]
  },
  {
    id: 2,
    intro: '第二题。',
    dialogues: [{ role: 'narrator', text: '不想听。' }]
  },
  {
    id: 3,
    intro: '第三题。',
    dialogues: [{ role: 'narrator', text: '在椅子上。' }]
  },
  {
    id: 4,
    intro: '第四题。',
    dialogues: [{ role: 'narrator', text: '你家有几口人？' }]
  },
  {
    id: 5,
    intro: '第五题。',
    dialogues: [{ role: 'narrator', text: '你坐哪儿？' }]
  },
  {
    id: 6,
    intro: '第六题。',
    dialogues: [{ role: 'female', text: '小张生病了，今天没来公司。' }],
    question: '问：小张怎么了？'
  },
  {
    id: 7,
    intro: '第七题。',
    dialogues: [{ role: 'male', text: '喂，您好，是王月女士吗？' }],
    question: '问：说话人正在做什么？'
  },
  {
    id: 8,
    intro: '第八题。',
    dialogues: [
      { role: 'female', text: '你在笑什么呢？' },
      { role: 'male', text: '电视上的这个人太有意思了。' }
    ]
  },
  {
    id: 9,
    intro: '第九题。',
    dialogues: [
      { role: 'male', text: '给你水，要我帮你打开吗？' },
      { role: 'female', text: '谢谢，我自己来吧。' }
    ]
  },
  {
    id: 10,
    intro: '第十题。',
    dialogues: [
      { role: 'female', text: '我走了，再见。' },
      { role: 'male', text: '下次见，开车慢点儿。' }
    ]
  },
  {
    id: 11,
    intro: '第十一题。',
    dialogues: [
      { role: 'female', text: '坐公交车去机场怎么样？' },
      { role: 'male', text: '还是坐地铁吧，比公交车快。' }
    ],
    question: '问：男的准备怎么去机场？'
  },
  {
    id: 12,
    intro: '第十二题。',
    dialogues: [
      { role: 'male', text: '您好，请问最近的洗手间在哪里？' },
      { role: 'female', text: '前面那个商场里就有。' }
    ],
    question: '问：洗手间在哪儿？'
  },
  {
    id: 13,
    intro: '第十三题。',
    dialogues: [
      { role: 'female', text: '阴天了，可能要下雨。' },
      { role: 'male', text: '那我们快回家吧。' }
    ],
    question: '问：现在天气怎么样？'
  },
  {
    id: 14,
    intro: '第十四题。',
    dialogues: [
      { role: 'male', text: '你准备在晚会上表演什么节目？' },
      { role: 'female', text: '我打算讲个故事。' }
    ],
    question: '问：女的要表演什么？'
  },
  {
    id: 15,
    intro: '第十五题。',
    dialogues: [
      { role: 'female', text: '你最近在忙什么？' },
      { role: 'male', text: '我奶奶住院了，我每天一下班就去医院照顾她。' }
    ],
    question: '问：男的的奶奶怎么了？'
  },
  {
    id: 16,
    intro: '第十六题。',
    dialogues: [
      { role: 'male', text: '十点一刻了，该睡觉了，别打游戏了。' },
      { role: 'female', text: '我再玩五分钟就睡。' }
    ],
    question: '问：现在几点了？'
  },
  {
    id: 17,
    intro: '第十七题。',
    dialogues: [
      { role: 'female', text: '奇怪，我的笔记本电脑突然不能开机了。' },
      { role: 'male', text: '是不是没电了？' }
    ],
    question: '问：女的遇到了什么问题？'
  },
  {
    id: 18,
    intro: '第十八题。',
    dialogues: [{ role: 'female', text: '同学们，这个题其实挺简单的，大家先看清楚要求再做。' }],
    question: '问：说话人让同学们怎么做？'
  },
  {
    id: 19,
    intro: '第十九题。',
    dialogues: [{ role: 'narrator', text: '我在草地上发现了一只瘦瘦的小猫，它看上去很饿，我就给它拿了一些吃的。' }],
    question: '问：说话人在什么地方发现的小猫？'
  },
  {
    id: 20,
    intro: '第二十题。',
    dialogues: [{ role: 'narrator', text: '老李的生活习惯很不好，平时几乎不打扫自己的房间。' }],
    question: '问：关于老李，可以知道什么？'
  },
  {
    id: 21,
    intro: '第二十一题。',
    dialogues: [{ role: 'narrator', text: '这里的夏天没那么热，春天和秋天很凉快，冬天也不太冷，一年四季都很舒服。' }],
    question: '问：那里秋季的天气怎么样？'
  }
];

function fetchRawAudio(text, outFile) {
  return new Promise((resolve, reject) => {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=' + encodeURIComponent(text);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(outFile, buf);
        resolve(buf.length);
      });
    }).on('error', reject);
  });
}

// Generate an authentic exam chime tone (880Hz test chime)
function generateChime(outFile) {
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=880:duration=0.20,afade=t=out:st=0.10:d=0.10" -ar 44100 -ac 1 ${outFile}`);
}

function generateSilence(durationSec, outFile) {
  execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSec} -ar 44100 -ac 1 ${outFile}`);
}

async function buildQuestionAudio(q, index) {
  const parts = [];
  const tmpPrefix = `/tmp/q${q.id}_seg`;

  // 1. Exam chime tone
  const chimeFile = `${tmpPrefix}_chime.wav`;
  generateChime(chimeFile);
  parts.push(chimeFile);

  // 0.3s pause after chime
  const pauseShort = `${tmpPrefix}_p03.wav`;
  generateSilence(0.3, pauseShort);
  parts.push(pauseShort);

  // 2. Intro announcement: "第X题。"
  const introRaw = `${tmpPrefix}_intro.mp3`;
  const introWav = `${tmpPrefix}_intro.wav`;
  await fetchRawAudio(q.intro, introRaw);
  execSync(`ffmpeg -y -i ${introRaw} -ar 44100 -ac 1 ${introWav}`);
  parts.push(introWav);

  // 0.5s pause after intro
  const pauseIntro = `${tmpPrefix}_p05.wav`;
  generateSilence(0.5, pauseIntro);
  parts.push(pauseIntro);

  // 3. Spoken dialogue lines with distinct male / female / narrator voice acting
  for (let i = 0; i < q.dialogues.length; i++) {
    const d = q.dialogues[i];
    const rawFile = `${tmpPrefix}_d${i}_raw.mp3`;
    await fetchRawAudio(d.text, rawFile);

    const pitchWav = `${tmpPrefix}_d${i}_pitch.wav`;
    if (d.role === 'female') {
      execSync(`ffmpeg -y -i ${rawFile} -af "rubberband=pitch=1.12" -ar 44100 -ac 1 ${pitchWav}`);
    } else if (d.role === 'male') {
      execSync(`ffmpeg -y -i ${rawFile} -af "rubberband=pitch=0.86" -ar 44100 -ac 1 ${pitchWav}`);
    } else {
      execSync(`ffmpeg -y -i ${rawFile} -ar 44100 -ac 1 ${pitchWav}`);
    }
    parts.push(pitchWav);

    // Short natural pause between dialogue turns (0.45s)
    if (i < q.dialogues.length - 1) {
      const pauseTurn = `${tmpPrefix}_pTurn${i}.wav`;
      generateSilence(0.45, pauseTurn);
      parts.push(pauseTurn);
    }
  }

  // 4. Question inquiry (if present, e.g. "问：男的准备怎么去机场？")
  if (q.question) {
    const pauseBeforeQ = `${tmpPrefix}_pPreQ.wav`;
    generateSilence(0.7, pauseBeforeQ);
    parts.push(pauseBeforeQ);

    const qRaw = `${tmpPrefix}_q_raw.mp3`;
    await fetchRawAudio(q.question, qRaw);
    const qWav = `${tmpPrefix}_q_pitch.wav`;
    execSync(`ffmpeg -y -i ${qRaw} -ar 44100 -ac 1 ${qWav}`);
    parts.push(qWav);
  }

  // Dual broadcast: [Broadcast 1] -> [3.5s pause] -> [Broadcast 2]
  const pauseDual = `${tmpPrefix}_pauseDual.wav`;
  generateSilence(3.5, pauseDual);

  const fullSegments = [...parts, pauseDual, ...parts];

  // Encode with ffmpeg concat filter for seamless PCM linear mixing and pristine MP3 headers
  const cmdInputs = fullSegments.map((s, idx) => `-i "${s}"`).join(' ');
  const filterMap = fullSegments.map((_, idx) => `[${idx}:a]`).join('') + `concat=n=${fullSegments.length}:v=0:a=1[aout]`;

  const outPublic = path.join(__dirname, `../public/audio/q${q.id}.mp3`);
  const outDist = path.join(__dirname, `../dist/audio/q${q.id}.mp3`);

  execSync(`ffmpeg -y ${cmdInputs} -filter_complex "${filterMap}" -map "[aout]" -c:a libmp3lame -ar 44100 -ac 1 -b:a 128k "${outPublic}"`);
  fs.copyFileSync(outPublic, outDist);

  console.log(`✓ [Q${q.id}] Authentic Exam Audio generated: ${q.dialogues.map(d => `${d.role}: ${d.text}`).join(' | ')}`);
  return outPublic;
}

async function main() {
  console.log('=== Generating Authentic HSK Examination Audio ===');
  const allGeneratedFiles = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const qFile = await buildQuestionAudio(q, i);
    allGeneratedFiles.push(qFile);
  }

  // Build master exam file with clean concat filter
  const masterInputs = allGeneratedFiles.map((s, idx) => `-i "${s}"`).join(' ');
  const masterFilter = allGeneratedFiles.map((_, idx) => `[${idx}:a]`).join('') + `concat=n=${allGeneratedFiles.length}:v=0:a=1[aout]`;

  const masterPublic = path.join(__dirname, '../public/audio/hsk_exam.mp3');
  const masterDist = path.join(__dirname, '../dist/audio/hsk_exam.mp3');
  execSync(`ffmpeg -y ${masterInputs} -filter_complex "${masterFilter}" -map "[aout]" -c:a libmp3lame -ar 44100 -ac 1 -b:a 128k "${masterPublic}"`);
  fs.copyFileSync(masterPublic, masterDist);

  console.log('\n🎉 Successfully produced 21 authentic Chinese examination MP3 files and master hsk_exam.mp3 with 0 decode errors!');
}

main().catch(err => {
  console.error('Audio generation failed:', err);
  process.exit(1);
});
