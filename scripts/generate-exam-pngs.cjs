const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const targetDirs = [
  path.join(__dirname, '../public/images/hsk'),
  path.join(__dirname, '../dist/images/hsk')
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 21 authentic monochrome exam-paper drawings (pure white paper, crisp graphite/ink lines)
const SVGS = {
  car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" width="240" height="160">
    <rect width="240" height="160" fill="#FFFFFF"/>
    <!-- Exam Paper Sedan Car -->
    <path d="M30 110 C30 96 40 90 56 84 L80 56 C90 44 110 40 132 40 L170 40 C190 40 202 50 214 70 L224 88 C230 94 230 104 226 110 L30 110 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="4"/>
    <path d="M84 52 L124 52 L124 78 L66 78 Z" fill="#F8FAFC" stroke="#1E293B" stroke-width="3"/>
    <path d="M130 52 L168 52 C180 52 190 62 198 78 L130 78 Z" fill="#F8FAFC" stroke="#1E293B" stroke-width="3"/>
    <line x1="127" y1="78" x2="127" y2="110" stroke="#1E293B" stroke-width="2.5"/>
    <line x1="100" y1="86" x2="114" y2="86" stroke="#1E293B" stroke-width="3"/>
    <!-- Wheels -->
    <circle cx="70" cy="110" r="22" fill="#FFFFFF" stroke="#1E293B" stroke-width="4.5"/>
    <circle cx="70" cy="110" r="9" fill="#1E293B"/>
    <circle cx="184" cy="110" r="22" fill="#FFFFFF" stroke="#1E293B" stroke-width="4.5"/>
    <circle cx="184" cy="110" r="9" fill="#1E293B"/>
    <!-- Road -->
    <line x1="15" y1="132" x2="225" y2="132" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="8 6"/>
  </svg>`,

  bullet_train: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" width="240" height="160">
    <rect width="240" height="160" fill="#FFFFFF"/>
    <!-- Bullet Train Head & Body -->
    <path d="M15 105 L15 72 C50 72 110 66 170 62 C205 60 226 78 232 94 C232 102 218 106 186 106 L15 106 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="4"/>
    <path d="M185 66 C206 66 220 74 226 86 L185 86 Z" fill="#1E293B"/>
    <line x1="15" y1="84" x2="200" y2="84" stroke="#1E293B" stroke-width="2"/>
    <rect x="36" y="72" width="24" height="9" rx="2" fill="#F8FAFC" stroke="#1E293B" stroke-width="2"/>
    <rect x="74" y="72" width="24" height="9" rx="2" fill="#F8FAFC" stroke="#1E293B" stroke-width="2"/>
    <rect x="112" y="72" width="24" height="9" rx="2" fill="#F8FAFC" stroke="#1E293B" stroke-width="2"/>
    <rect x="150" y="72" width="24" height="9" rx="2" fill="#F8FAFC" stroke="#1E293B" stroke-width="2"/>
    <!-- Railway Track -->
    <line x1="10" y1="112" x2="230" y2="112" stroke="#1E293B" stroke-width="4"/>
    <line x1="30" y1="112" x2="24" y2="124" stroke="#64748B" stroke-width="2.5"/>
    <line x1="75" y1="112" x2="69" y2="124" stroke="#64748B" stroke-width="2.5"/>
    <line x1="120" y1="112" x2="114" y2="124" stroke="#64748B" stroke-width="2.5"/>
    <line x1="165" y1="112" x2="159" y2="124" stroke="#64748B" stroke-width="2.5"/>
    <line x1="210" y1="112" x2="204" y2="124" stroke="#64748B" stroke-width="2.5"/>
  </svg>`,

  airplane: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" width="240" height="160">
    <rect width="240" height="160" fill="#FFFFFF"/>
    <!-- Fuselage -->
    <path d="M25 106 C60 98 135 72 202 48 C218 43 228 48 225 56 C218 66 165 102 120 118 L25 106 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="4"/>
    <!-- Wings -->
    <path d="M112 80 L160 22 L178 26 L136 86 Z" fill="#F8FAFC" stroke="#1E293B" stroke-width="3"/>
    <path d="M88 96 L72 138 L88 139 L118 102 Z" fill="#F8FAFC" stroke="#1E293B" stroke-width="3"/>
    <!-- Tail -->
    <path d="M34 102 L16 64 L34 67 L44 102 Z" fill="#F8FAFC" stroke="#1E293B" stroke-width="3"/>
    <!-- Windows -->
    <circle cx="128" cy="74" r="3" fill="#1E293B"/>
    <circle cx="144" cy="69" r="3" fill="#1E293B"/>
    <circle cx="160" cy="64" r="3" fill="#1E293B"/>
    <circle cx="176" cy="58" r="3" fill="#1E293B"/>
  </svg>`,

  cover_ears: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Face -->
    <circle cx="80" cy="80" r="38" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M42 66 C42 40 66 30 80 30 C94 30 118 40 118 66 C108 50 80 44 42 66 Z" fill="#1E293B"/>
    <!-- Eyes tightly shut -->
    <path d="M62 76 L72 76" stroke="#1E293B" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M88 76 L98 76" stroke="#1E293B" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Distressed wavy mouth -->
    <path d="M70 98 Q80 92 90 98" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
    <!-- Hands over ears -->
    <ellipse cx="38" cy="80" rx="10" ry="18" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <ellipse cx="122" cy="80" rx="10" ry="18" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <!-- Sound waves crossed -->
    <path d="M20 68 Q12 80 20 92" stroke="#64748B" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M140 68 Q148 80 140 92" stroke="#64748B" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  cover_eyes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <circle cx="80" cy="80" r="38" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M42 66 C42 40 66 30 80 30 C94 30 118 40 118 66 C108 50 80 44 42 66 Z" fill="#1E293B"/>
    <circle cx="80" cy="100" r="4.5" fill="#1E293B"/>
    <!-- Hands covering eyes -->
    <ellipse cx="64" cy="74" rx="18" ry="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <ellipse cx="96" cy="74" rx="18" ry="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="62" y1="74" x2="68" y2="74" stroke="#1E293B" stroke-width="2"/>
    <line x1="94" y1="74" x2="100" y2="74" stroke="#1E293B" stroke-width="2"/>
  </svg>`,

  shh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <circle cx="80" cy="80" r="38" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M42 66 C42 40 66 30 80 30 C94 30 118 40 118 66 C108 50 80 44 42 66 Z" fill="#1E293B"/>
    <circle cx="64" cy="72" r="4" fill="#1E293B"/>
    <circle cx="96" cy="72" r="4" fill="#1E293B"/>
    <!-- Shh finger on mouth -->
    <rect x="74" y="82" width="12" height="36" rx="6" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="74" y1="96" x2="86" y2="96" stroke="#1E293B" stroke-width="2"/>
  </svg>`,

  bird_branch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Tree branch -->
    <path d="M15 110 Q80 96 145 104" stroke="#1E293B" stroke-width="5" stroke-linecap="round"/>
    <path d="M95 101 Q120 76 140 68" stroke="#1E293B" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Bird standing on branch -->
    <ellipse cx="76" cy="78" rx="24" ry="18" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="58" cy="66" r="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M46 66 L34 69 L46 73 Z" fill="#1E293B"/>
    <circle cx="58" cy="63" r="2.5" fill="#1E293B"/>
    <path d="M94 82 L116 90 L96 94 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Bird claws -->
    <line x1="72" y1="96" x2="72" y2="105" stroke="#1E293B" stroke-width="2.5"/>
    <line x1="82" y1="96" x2="82" y2="105" stroke="#1E293B" stroke-width="2.5"/>
  </svg>`,

  cat_on_chair: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Chair back & frame -->
    <path d="M46 20 L46 80 L114 80 L114 20" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="46" y1="40" x2="114" y2="40" stroke="#1E293B" stroke-width="2.5"/>
    <line x1="46" y1="60" x2="114" y2="60" stroke="#1E293B" stroke-width="2.5"/>
    <!-- Chair seat -->
    <rect x="40" y="78" width="80" height="8" rx="2.5" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Legs -->
    <line x1="48" y1="86" x2="44" y2="140" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="112" y1="86" x2="116" y2="140" stroke="#1E293B" stroke-width="3.5"/>
    <!-- Cat SITTING ON the seat -->
    <ellipse cx="80" cy="68" rx="18" ry="14" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="80" cy="54" r="11" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <polygon points="70,48 74,38 80,48" fill="#1E293B"/>
    <polygon points="80,48 86,38 90,48" fill="#1E293B"/>
    <circle cx="76" cy="53" r="2" fill="#1E293B"/>
    <circle cx="84" cy="53" r="2" fill="#1E293B"/>
    <path d="M96 74 Q106 68 104 60" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  dog_under_chair: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Chair -->
    <path d="M46 20 L46 80 L114 80 L114 20" stroke="#1E293B" stroke-width="3.5"/>
    <rect x="40" y="78" width="80" height="8" rx="2.5" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <line x1="48" y1="86" x2="40" y2="140" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="112" y1="86" x2="120" y2="140" stroke="#1E293B" stroke-width="3.5"/>
    <!-- Dog UNDER the chair -->
    <ellipse cx="80" cy="114" rx="20" ry="14" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="66" cy="104" r="11" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <ellipse cx="60" cy="102" rx="4" ry="8" fill="#1E293B"/>
    <circle cx="63" cy="104" r="2" fill="#FFFFFF"/>
    <path d="M98 114 Q108 108 104 100" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  hand_bottle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Arm in sleeve -->
    <path d="M15 110 L70 90 L84 104 L29 130 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Hand holding bottle -->
    <circle cx="86" cy="90" r="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Water bottle -->
    <rect x="90" y="32" width="30" height="72" rx="8" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <rect x="98" y="20" width="14" height="12" rx="2.5" fill="#1E293B"/>
    <line x1="90" y1="60" x2="120" y2="60" stroke="#1E293B" stroke-width="2"/>
    <line x1="90" y1="76" x2="120" y2="76" stroke="#1E293B" stroke-width="2"/>
  </svg>`,

  headache: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Head -->
    <circle cx="80" cy="74" r="36" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M46 64 C46 32 66 26 80 26 C94 26 114 32 114 64 Z" fill="#1E293B"/>
    <!-- Hands holding temples -->
    <circle cx="48" cy="70" r="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <circle cx="112" cy="70" r="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Headache spark lines -->
    <path d="M40 48 L28 42" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
    <path d="M120 48 L132 42" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
    <path d="M80 18 L80 8" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  driver_car_wave: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Car side -->
    <path d="M26 102 C26 68 46 62 74 62 L128 62 C142 62 154 74 154 102 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <rect x="54" y="68" width="40" height="28" rx="4" fill="#F8FAFC" stroke="#1E293B" stroke-width="2.5"/>
    <circle cx="74" cy="80" r="8" fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5"/>
    <!-- Driver waving out of window -->
    <path d="M68 66 Q56 48 64 42" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/>
    <!-- Wheels -->
    <circle cx="50" cy="106" r="14" fill="#1E293B"/>
    <circle cx="130" cy="106" r="14" fill="#1E293B"/>
  </svg>`,

  soccer_girl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Flying Soccer Ball -->
    <circle cx="94" cy="34" r="14" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <polygon points="94,27 101,31 98,38 90,38 87,31" fill="#1E293B"/>
    <!-- Kicking figure -->
    <circle cx="78" cy="62" r="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M68 74 L90 74 L86 105 L72 105 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M72 105 L62 138" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M86 105 L104 125" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round"/>
  </svg>`,

  laughing_tv: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Sofa cushion -->
    <ellipse cx="80" cy="122" rx="48" ry="18" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <!-- Person leaning back laughing -->
    <path d="M60 104 L100 104 L94 68 L66 68 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <circle cx="80" cy="52" r="16" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <!-- Wide laughing mouth -->
    <path d="M72 54 Q80 68 88 54 Z" fill="#1E293B"/>
  </svg>`,

  boy_books: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Student walking with stack of books -->
    <circle cx="80" cy="46" r="14" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M66 60 L94 60 L90 114 L70 114 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Stack of three thick textbooks -->
    <rect x="56" y="74" width="48" height="10" rx="2" fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5"/>
    <rect x="58" y="84" width="44" height="10" rx="2" fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5"/>
    <rect x="54" y="94" width="52" height="10" rx="2" fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5"/>
  </svg>`,

  guitar_boy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Person playing guitar -->
    <circle cx="74" cy="46" r="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Guitar -->
    <path d="M34 106 L108 52 L118 60 L48 116 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <line x1="114" y1="56" x2="140" y2="38" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="52" cy="106" r="16" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Music note -->
    <path d="M100 34 Q110 26 114 38" stroke="#1E293B" stroke-width="2.5" fill="none"/>
    <circle cx="114" cy="38" r="3" fill="#1E293B"/>
  </svg>`,

  schoolgirl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Schoolgirl with backpack -->
    <circle cx="74" cy="46" r="11" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M66 57 L82 57 L80 94 L70 94 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M64 91 L86 91 L90 114 L60 114 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Backpack -->
    <rect x="80" y="58" width="18" height="30" rx="4" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
  </svg>`,

  umbrella: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Open Umbrella -->
    <path d="M26 74 C26 34 134 34 134 74 Z" fill="#1E293B" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="80" y1="26" x2="80" y2="74" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="80" y1="74" x2="80" y2="120" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M80 120 C80 128 90 128 90 120" stroke="#1E293B" stroke-width="3.5" fill="none"/>
  </svg>`,

  eggs_milk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Milk glass -->
    <rect x="40" y="52" width="40" height="54" rx="4" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M80 66 Q96 66 96 80 Q96 94 80 94" stroke="#1E293B" stroke-width="3.5" fill="none"/>
    <!-- Three eggs -->
    <ellipse cx="104" cy="98" rx="12" ry="16" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <ellipse cx="122" cy="102" rx="11" ry="15" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
    <ellipse cx="112" cy="85" rx="11" ry="14" fill="#FFFFFF" stroke="#1E293B" stroke-width="3.5"/>
  </svg>`,

  reading_chair: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Person reading in armchair -->
    <path d="M30 60 L30 110 L130 110 L130 60" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="80" cy="50" r="14" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <!-- Open book held in hands -->
    <path d="M64 80 L80 86 L96 80 L96 100 L80 106 L64 100 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
  </svg>`,

  two_men_waving: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" fill="#FFFFFF"/>
    <!-- Man 1 -->
    <circle cx="60" cy="52" r="11" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M50 63 L70 63 L68 112 L54 112 Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M70 65 L92 45" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="92" cy="45" r="4" fill="#1E293B"/>
    <!-- Man 2 -->
    <circle cx="104" cy="58" r="11" fill="#FFFFFF" stroke="#1E293B" stroke-width="3"/>
    <path d="M94 69 L114 69 L112 112 L96 112 Z" fill="#1E293B"/>
  </svg>`
};

async function generateAll() {
  console.log('Generating authentic monochrome exam paper PNGs...');
  for (const [key, svg] of Object.entries(SVGS)) {
    const pngBuffer = await sharp(Buffer.from(svg))
      .png({ quality: 95 })
      .toBuffer();

    for (const dir of targetDirs) {
      const filePath = path.join(dir, `${key}.png`);
      fs.writeFileSync(filePath, pngBuffer);
    }
    console.log(`Generated: ${key}.png`);
  }
  console.log('All 21 PNG files successfully generated!');
}

generateAll().catch(console.error);
