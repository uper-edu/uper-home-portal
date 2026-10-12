/**
 * Seeder script for UPER Admissions List
 * Generates 4 high-quality demo data records in Sanity's "admissionsList" table.
 * 
 * Usage:
 *   SANITY_WRITE_TOKEN="your_sanity_write_token" node scripts/seed-admissions.js
 */

const { createClient } = require('@sanity/client');

// Retrieve token from environment
const token = process.env.SANITY_WRITE_TOKEN;

if (!token) {
  console.error('\x1b[31mError: SANITY_WRITE_TOKEN environment variable is required!\x1b[0m');
  console.log('\nHow to run this script:');
  console.log('1. Go to https://www.sanity.io/manage and open your project (xtbhepdi).');
  console.log('2. Navigate to API -> Tokens -> Add New Token, set permissions to "Write", and copy the token.');
  console.log('3. Run the script:');
  console.log('   \x1b[36mSANITY_WRITE_TOKEN="your_copied_token" node scripts/seed-admissions.js\x1b[0m\n');
  process.exit(1);
}

// Initialize writing client
const client = createClient({
  projectId: 'xtbhepdi',
  dataset: 'production',
  apiVersion: '2024-03-06',
  token: token,
  useCdn: false, // Must be false for writing
});

const DEMO_ADMISSIONS = [
  {
    _type: 'admissionsList',
    _id: 'demo-admission-1',
    name: 'Michael Wijaya',
    school: 'Tsinghua University (清华大学)',
    program: 'Mechanical Engineering & Automation (机械工程及自动化)',
    admissionDate: 'September 2026',
    quote: 'Dukungan penuh dari UPER dalam menyusun personal statement sangat berharga. Mentor UPER membantu saya menonjolkan proyek robotika saya, sehingga saya berhasil mendapatkan beasiswa penuh CSC Type B di Tsinghua!',
    scholarship: 'Chinese Government Scholarship (CSC Type B - Full Beasiswa)',
  },
  {
    _type: 'admissionsList',
    _id: 'demo-admission-2',
    name: 'Amanda Sutanto',
    school: 'Peking University (北京大学)',
    program: 'International Economics and Trade (国际经济与贸易)',
    admissionDate: 'September 2026',
    quote: 'Proses wawancara di PKU sangat kompetitif. Berkat simulasi wawancara 1-on-1 dengan alumni UPER, saya bisa menjawab semua pertanyaan akademis dengan tenang dan percaya diri.',
    scholarship: 'Peking University President Scholarship (Full)',
  },
  {
    _type: 'admissionsList',
    _id: 'demo-admission-3',
    name: 'Devin Henderson',
    school: 'Zhejiang University (浙江大学)',
    program: 'Computer Science and Technology (计算机科学与技术)',
    admissionDate: 'September 2026',
    quote: 'Kurikulum bridging CSCA dari UPER benar-benar mempersiapkan saya untuk menghadapi standar akademik ketat di Tiongkok. Transisi dari SMA ke kuliah tingkat tinggi menjadi sangat mulus!',
    scholarship: 'Zhejiang Government Scholarship (Full Beasiswa)',
  },
  {
    _type: 'admissionsList',
    _id: 'demo-admission-4',
    name: 'Clara Audrey',
    school: 'Shanghai Jiao Tong University (上海交通大学)',
    program: 'Biomedical Engineering (生物医学工程)',
    admissionDate: 'September 2026',
    quote: 'Navigasi birokrasi visa dan JW202 sangat membingungkan pada awalnya. Tim UPER mengurus semua detail teknis sehingga saya bisa fokus penuh pada persiapan akademik saya.',
    scholarship: 'SJTU Scholarship + Living Stipend',
  }
];

async function seedData() {
  console.log('\x1b[33mConnecting to Sanity project (xtbhepdi) and seeding admissions list...\x1b[0m\n');
  
  for (const doc of DEMO_ADMISSIONS) {
    try {
      console.log(`Seeding record: ${doc.name} - ${doc.school}...`);
      // Use createOrReplace to ensure idempotency (it overwrites if existing, or creates if not)
      await client.createOrReplace(doc);
      console.log(`\x1b[32m✓ Successfully seeded ${doc.name}!\x1b[0m`);
    } catch (err) {
      console.error(`\x1b[31m✗ Failed to seed ${doc.name}: ${err.message}\x1b[0m`);
    }
  }
  
  console.log('\n\x1b[34;1mSeeding complete!\x1b[0m Check your Sanity Studio or refresh the Study Abroad page to see the changes.');
}

seedData();
